# -*- coding: utf-8 -*-
"""抽出 index.html 里的 <script> 与二维码编码器，供 node 做语法检查和往返测试。"""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

a = html.index('<script>') + len('<script>')
b = html.index('</script>', a)
io.open(os.path.join(ROOT, '_parts', '_check.js'), 'w', encoding='utf-8', newline='\n').write(html[a:b])

i = html.index('/* QR_ENC_BEGIN */')
j = html.index('/* QR_ENC_END */')
code = html[i:j]
code += '\nexport { encodeQR, dataCodewords, rawModules, alignPos, rsRemainder, rsDivisor, ECC_CW, NUM_BLK, ECC_ORDER };\n'
io.open(os.path.join(ROOT, '_parts', '_enc.mjs'), 'w', encoding='utf-8', newline='\n').write(code)
print('[OK] extracted _check.js (%d bytes) and _enc.mjs (%d bytes)' % (b - a, len(code)))
