# -*- coding: utf-8 -*-
"""生成站点图标：favicon(SVG) / apple-touch-icon(PNG) / 微信分享卡片图(og.png)。"""
import base64, io, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)

G, T, D = '#5f8f62', '#8e6447', '#c8a27f'

def draw_tree(d, s, ox, oy, g=G):
    def r(x, y, w, h, c):
        d.rectangle([ox + x * s, oy + y * s, ox + (x + w) * s - 1, oy + (y + h) * s - 1], fill=c)
    r(4, 1, 4, 1, g); r(3, 2, 6, 1, g); r(2, 3, 8, 1, g)
    r(1, 4, 10, 1, g); r(2, 5, 8, 1, g); r(3, 6, 6, 1, g); r(4, 7, 4, 1, g)
    r(5, 8, 2, 3, T)
    r(3, 11, 6, 1, D)


def icon_png(size=180):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill='#eef4ec')
    cell = size / 12.0
    draw_tree(d, cell, 0, 0)
    return im


def og_png(path):
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), '#e4eee8')
    d = ImageDraw.Draw(im)
    for i in range(H):                      # 一点天空渐变
        k = i / H
        d.line([(0, i), (W, i)], fill=(int(228 + 10 * k), int(238 + 6 * k), int(232 + 4 * k)))
    cell = 28
    draw_tree(d, cell, W // 2 - 6 * cell, 38)
    try:
        f1 = ImageFont.truetype(r'C:\Windows\Fonts\msyhbd.ttc', 62)
        f2 = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 27)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    t1 = '小岛二维码'
    t2 = '写下一句话，让岛上的方块落成一张能扫的码'
    w1 = d.textlength(t1, font=f1)
    d.text(((W - w1) / 2, 402), t1, font=f1, fill='#4f4239')
    w2 = d.textlength(t2, font=f2)
    d.text(((W - w2) / 2, 500), t2, font=f2, fill='#85776b')
    im.save(path, 'PNG', optimize=True)


FAVICON_SVG = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
    "<rect width='64' height='64' rx='14' fill='#eef4ec'/>"
    "<g fill='#5f8f62'>"
    "<rect x='26' y='6' width='12' height='6'/>"
    "<rect x='20' y='12' width='24' height='6'/>"
    "<rect x='14' y='18' width='36' height='6'/>"
    "<rect x='8' y='24' width='48' height='6'/>"
    "<rect x='14' y='30' width='36' height='6'/>"
    "<rect x='20' y='36' width='24' height='6'/>"
    "</g>"
    "<rect x='29' y='42' width='6' height='10' fill='#8e6447'/>"
    "<rect x='16' y='52' width='32' height='6' fill='#c8a27f'/>"
    "</svg>"
)

b64 = lambda b: base64.b64encode(b).decode('ascii')

fav = 'data:image/svg+xml;base64,' + b64(FAVICON_SVG.encode('utf-8'))
buf = io.BytesIO(); icon_png(180).save(buf, 'PNG', optimize=True)
touch = 'data:image/png;base64,' + b64(buf.getvalue())

open(P('_parts', 'favicon.txt'), 'w').write(fav)
open(P('_parts', 'touchicon.txt'), 'w').write(touch)
os.makedirs(P('dist'), exist_ok=True)
og_png(P('dist', 'og.png'))
icon_png(512).save(P('dist', 'icon-512.png'), 'PNG', optimize=True)

print('[OK] favicon   %d 字符' % len(fav))
print('[OK] touchicon %d 字符' % len(touch))
print('[OK] dist/og.png %d 字节' % os.path.getsize(P('dist', 'og.png')))
print('[OK] dist/icon-512.png %d 字节' % os.path.getsize(P('dist', 'icon-512.png')))
