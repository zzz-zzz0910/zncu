# -*- coding: utf-8 -*-
"""跟独立实现 segno 逐格比对：版本号、选中的掩码、以及整张模块矩阵。
   两边都对上，说明这不只是"自己能读懂自己"，而是符合标准、任何扫码器都能读。"""
import io, json, os, sys
import segno

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_path = os.path.join(ROOT, '_parts', 'enc_out.json')
data = json.loads(io.open(out_path, encoding='utf-8').read())
ok = bad = 0
sink = []
for c in data:
    text, ecc = c['text'], c['ecc'].lower()
    try:
        q = segno.make(text, error=ecc, micro=False)
    except Exception as e:
        print('SEGNO-ERR %-6s %s -> %s' % (c['ecc'], text[:28], e))
        continue
    same_ver = (q.version == c['ver'])
    same_mask = (q.mask == c['mask'])
    rows = [''.join(str(v) for v in row) for row in q.matrix]
    sink.append({'text': text, 'ecc': c['ecc'], 'ver': q.version, 'rows': rows})
    same_mat = (rows == c['rows'])
    if same_mat:
        ok += 1
        print('SAME  [%s] v%-2d %-3d mask=%d  %s' % (c['ecc'], c['ver'], c['size'], c['mask'], json.dumps(text[:26], ensure_ascii=False)))
    else:
        bad += 1
        print('DIFF  [%s] v%-2d %-3d mask=%d  %s' % (c['ecc'], c['ver'], c['size'], c['mask'], json.dumps(text[:26], ensure_ascii=False)))
        print('      ver same=%s  mask same=%s  (segno v%d mask%d)' % (same_ver, same_mask, q.version, q.mask))
        for i, (a, b) in enumerate(zip(c['rows'], rows)):
            if a != b:
                print('      行 %d:\n       ours  %s\n       segno %s' % (i, a, b))
                break
print('\n与 segno 矩阵比对: %d 相同 / %d 不同' % (ok, bad))
io.open(os.path.join(ROOT, '_parts', 'segno_out.json'), 'w', encoding='utf-8').write(json.dumps(sink, ensure_ascii=False))
sys.exit(0)
