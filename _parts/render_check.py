# -*- coding: utf-8 -*-
"""最接近真实扫码的验证：把矩阵渲染成 PNG，用 zbar 扫一遍，看能不能读回原文。
   顺带验证中心留白（Q / H 级）被挖掉一块之后还能不能扫出来。"""
import io, json, os, sys
from PIL import Image
from pyzbar.pyzbar import decode, ZBarSymbol

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda name: os.path.join(ROOT, '_parts', name)


def render(rows, scale=8, quiet=4, hole=0):
    n = len(rows)
    side = (n + quiet * 2) * scale
    img = Image.new('L', (side, side), 255)
    px = img.load()
    hx0 = (n - hole) // 2 if hole else -1
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '1':
                continue
            if hole and hx0 <= x < hx0 + hole and hx0 <= y < hx0 + hole:
                continue
            for dy in range(scale):
                base = ((y + quiet) * scale + dy) * side
                for dx in range(scale):
                    px[(x + quiet) * scale + dx, (y + quiet) * scale + dy] = 0
    return img


def scan(img):
    res = decode(img, symbols=[ZBarSymbol.QRCODE])
    if not res:
        return None
    raw = res[0].data
    try:
        s = raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw.decode('latin-1')
    # 码里没写 ECI 时 zbar 会按 latin-1 猜，中文就成了「ä½」这种，这里还原回去。
    # 微信 / 支付宝自己会优先按 UTF-8 解，不需要码里带 ECI。
    try:
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def run(label, cases, hole=0):
    ok = bad = 0
    for c in cases:
        img = render(c['rows'], hole=hole)
        got = scan(img)
        if got == c['text']:
            ok += 1
            print('  %s  [%s] v%-2d %s' % ('OK  ', c['ecc'], c['ver'], json.dumps(c['text'][:26], ensure_ascii=False)))
        else:
            bad += 1
            print('  %s  [%s] v%-2d %s -> %s' % ('FAIL', c['ecc'], c['ver'], json.dumps(c['text'][:26], ensure_ascii=False), json.dumps((got or '')[:26], ensure_ascii=False)))
    print('%s: %d 扫得出 / %d 扫不出\n' % (label, ok, bad))
    return bad


mine = json.loads(io.open(P('enc_out.json'), encoding='utf-8').read())
fails = run('我的编码 → zbar 扫描', mine)

seg_path = P('segno_out.json')
if os.path.exists(seg_path):
    seg = json.loads(io.open(seg_path, encoding='utf-8').read())
    run('segno 的码 → zbar 扫描（对照组）', seg)

holes = json.loads(io.open(P('hole_out.json'), encoding='utf-8').read()) if os.path.exists(P('hole_out.json')) else []
if holes:
    for c in holes:
        img = render(c['rows'], hole=c['hole'])
        got = scan(img)
        if got == c['text']:
            print('  OK   留白 %d 格  [%s] v%-2d %s' % (c['hole'], c['ecc'], c['ver'], json.dumps(c['text'][:24], ensure_ascii=False)))
        else:
            fails += 1
            print('  FAIL 留白 %d 格  [%s] v%-2d %s' % (c['hole'], c['ecc'], c['ver'], json.dumps(c['text'][:24], ensure_ascii=False)))
    print('中心留白 → zbar 扫描: %d 个样本\n' % len(holes))

sys.exit(1 if fails else 0)
