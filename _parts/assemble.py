# -*- coding: utf-8 -*-
"""把 qr-tree.html 组装成 v2：保留原来的体素小岛 / WebGL 渲染，替换编码器与交互层。"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = r'C:\Users\Admin（无密码）\Desktop\qr-tree.html'
OUT  = os.path.join(ROOT, 'index.html')

def read(p):
    return io.open(p, encoding='utf-8').read()

def part(name):
    return read(os.path.join(ROOT, '_parts', name))

def rep(s, old, new, label):
    n = s.count(old)
    if n != 1:
        raise SystemExit('[FAIL] %s: 期望命中 1 次，实际 %d 次' % (label, n))
    return s.replace(old, new)

def cut(s, a, b, new, label):
    i = s.find(a)
    if i < 0:
        raise SystemExit('[FAIL] %s: 找不到起点' % label)
    j = s.find(b, i)
    if j < 0:
        raise SystemExit('[FAIL] %s: 找不到终点' % label)
    return s[:i] + new + s[j:]

src = read(SRC).replace('\r\n', '\n')
s = src
log = []

# 1. head：标题 + 图标 + 分享卡片 meta
s = rep(s, '<title>小岛二维码</title>', part('head.html').rstrip('\n'), 'head')
fav = io.open(os.path.join(ROOT, '_parts', 'favicon.txt'), encoding='utf-8').read().strip()
touch = io.open(os.path.join(ROOT, '_parts', 'touchicon.txt'), encoding='utf-8').read().strip()
if '__FAVICON__' not in s or '__TOUCHICON__' not in s:
    raise SystemExit('[FAIL] head 里没有图标占位符，先跑 python _parts/makeicons.py')
s = s.replace('__FAVICON__', fav).replace('__TOUCHICON__', touch)
log.append('head')

# 2. 追加 v2 样式
s = rep(s,
        '@media (max-width:520px){h1 span{width:36px;height:36px;font-size:19px}.stage{height:62vh;min-height:340px}.toggle button{padding:8px 14px}.chip{padding:0 10px}}\n</style>',
        '@media (max-width:520px){h1 span{width:36px;height:36px;font-size:19px}.stage{height:62vh;min-height:340px}.toggle button{padding:8px 14px}.chip{padding:0 10px}}\n'
        + part('style.css').rstrip('\n') + '\n</style>',
        'style')
log.append('style')

# 3. 面板：类型 chips + 输入区 + 生成器字段
old_panel = ('  <section class="panel">\n'
             '    <textarea id="text" rows="2" maxlength="120" placeholder="写下网址或一句话" aria-label="要变成二维码的内容">愿你今天也被温柔以待</textarea>\n')
s = rep(s, old_panel, part('panel.html').rstrip('\n') + '\n', 'panel')
log.append('panel')

# 4. 选项：追加"样式"和"识码"
old_weather = ('        <div class="opt-body"><div class="chips" id="weatherChips" role="radiogroup" aria-label="天气"></div></div>\n'
               '      </details>\n'
               '    </div>\n')
s = rep(s, old_weather,
        '        <div class="opt-body"><div class="chips" id="weatherChips" role="radiogroup" aria-label="天气"></div></div>\n'
        '      </details>\n'
        + part('opts.html').rstrip('\n') + '\n'
        '    </div>\n',
        'opts')
log.append('opts')

# 5. 按钮
old_actions = ('      <div class="actions">\n'
               '        <button class="btn" id="saveView" type="button">保存当前画面</button>\n'
               '        <button class="btn primary" id="saveQR" type="button">下载二维码</button>\n'
               '      </div>\n')
s = rep(s, old_actions, part('actions.html'), 'actions')
log.append('actions')

# 5b. 生成方式：只出二维码 / 出动画展示页
s = rep(s,
        '    <div class="row">\n      <p class="status" id="status"',
        '    <div class="outmode" id="outMode" role="radiogroup" aria-label="生成方式"></div>\n'
        '    <p class="note" id="outNote"></p>\n'
        '    <div class="row">\n      <p class="status" id="status"',
        'outmode')
log.append('outmode')

# 6. 编码器整块
s = cut(s, '/* ========== 二维码编码', '/* ========== 小工具', part('encoder.js').rstrip('\n') + '\n\n', 'encoder')
log.append('encoder')

# 7. buildScene 里收集深色格子时跳过中心留白
s = rep(s,
        "  const mods=[]; for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(M[r][c]) mods.push({r,c,x:(c-h)*m,z:(r-h)*m,d:Math.hypot(c-h,r-h)+rand()*1.5});",
        "  const hs=qr.hole, isHole=(r,c)=>!!hs&&r>=hs.y0&&r<hs.y0+hs.s&&c>=hs.x0&&c<hs.x0+hs.s;\n"
        "  const mods=[]; for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(M[r][c]&&!isHole(r,c)) mods.push({r,c,x:(c-h)*m,z:(r-h)*m,d:Math.hypot(c-h,r-h)+rand()*1.5});",
        'buildScene')
log.append('buildScene')

# 7b. 地标按真实比例重做
s = cut(s, "  canton:{ b:[-4,4,33.5,-4,4]", "  pearl:{ b:[-6,6,32.5,-6,6]", part('canton.js'), 'canton')
s = cut(s, "  pearl:{ b:[-6,6,32.5,-6,6]", "  temple:{ b:[-7,7,12.5,-7,7]", part('pearl.js'), 'pearl')
s = cut(s, "  temple:{ b:[-7,7,12.5,-7,7]", "  pagoda:{ b:[-4.5,4.5,22.5,-4.5,5.5]", part('temple.js'), 'temple')
log.append('landmarks')

# 8. 季节 / 天气 / 树 切换时：地址栏同步；展示页模式下只更新码里的 URL，不打断生长动画
s = rep(s,
        "function setTree(k){ if(k===treeKey) return; treeKey=k; markChips('treeChips',k); markChips('landChips',k); rebuild(qT===0?'tree':'none'); }",
        "function setTree(k){ if(k===treeKey) return; treeKey=k; markChips('treeChips',k); markChips('landChips',k);"
        " if(outMode==='show'){ const nu=currentShowUrl(); if(nu) curText=nu; }"
        " rebuild(qT===0?'tree':'none'); syncHash(); }",
        'setTree')
s = rep(s,
        "  if(k===seasonKey) return; seasonKey=k; markChips('seasonChips',k); stage.dataset.season=k;\n"
        "  if(!glOK){ if(curQR) drawFlat(); return; }\n"
        "  recolor(); initSeasonFX(); updateStatus();",
        "  if(k===seasonKey) return; seasonKey=k; markChips('seasonChips',k); stage.dataset.season=k;\n"
        "  if(outMode==='show'){ applyNow(); return; }\n"
        "  if(!glOK){ if(curQR) drawFlat(); syncHash(); return; }\n"
        "  recolor(); initSeasonFX(); syncHash(); updateStatus();",
        'setSeason')
s = rep(s,
        "  if(glOK){ initWeatherFX(); if(wasNight||k==='night') recolor(); } updateStatus();",
        "  if(outMode==='show'){ applyNow(); return; }\n"
        "  if(glOK){ initWeatherFX(); if(wasNight||k==='night') recolor(); }\n"
        "  syncHash(); updateStatus();",
        'setWeather')

# 8b. 地标越高，云就抬得越高，免得云从广州塔中间穿过去
s = rep(s,
        "  const W=WEATHERS[weatherKey], wind=W.wind*.6, pv=vis*Math.min(1,Math.max(0,clock-1.6)), white=hx('#ffffff');",
        "  const W=WEATHERS[weatherKey], wind=W.wind*.6, pv=vis*Math.min(1,Math.max(0,clock-1.6)), white=hx('#ffffff');\n"
        "  const cloudLift=scene?Math.max(0,(scene.tree.maxY-16)*0.9):0;",
        'cloudLift')
s = rep(s,
        "const cx=u*.96-lat*.28, cz=u*.28+lat*.96, cy=c.h+Math.sin(clock*.5+c.a)*.3;",
        "const cx=u*.96-lat*.28, cz=u*.28+lat*.96, cy=c.h+cloudLift+Math.sin(clock*.5+c.a)*.3;",
        'cloudY')
# 8c. P 键暂停自转：只停这一项，别的动画照常
s = rep(s,
        "if(!dragging){ treeYaw+=vel; vel*=.92; if(q===0&&!reduced) treeYaw+=dt*.1; }",
        "if(!dragging){ treeYaw+=vel; vel*=.92; if(q===0&&!reduced&&!spinPaused) treeYaw+=dt*.1; }",
        'spinPause')
log.append('sync')

# 9. 平面兜底绘制：跳过留白
s = rep(s,
        "  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(curQR.mod[r][c]){ x.fillStyle=css(qrInk(r,c,n,1)); x.fillRect(ox+(c+4)*m,oy+(r+4)*m,m,m); }",
        part('drawflat.js').rstrip('\n'), 'drawFlat')
log.append('drawFlat')

# 10. updateStatus 整块
s = cut(s, 'function updateStatus(){', 'function drawFlat(){', part('status.js').rstrip('\n') + '\n', 'updateStatus')
log.append('updateStatus')

# 11. rebuild 整块
s = cut(s, 'function rebuild(mode){', '/* ========== 相机：', part('rebuild.js').rstrip('\n') + '\n', 'rebuild')
log.append('rebuild')

# 12. 下载二维码：尺寸可选 + 跳过留白
s = cut(s, "$('saveQR').addEventListener('click'", "$('saveView').addEventListener('click'", part('saveqr.js').rstrip('\n') + '\n', 'saveQR')
log.append('saveQR')

# 13. 旧输入监听 → 内置解码器 + 整套 v2 交互层
s = cut(s, 'let tmr=0;', 'function download(url,name)',
        part('decoder.js').rstrip('\n') + '\n\n' + part('ui.js').rstrip('\n') + '\n', 'decoder+ui')
log.append('decoder')
log.append('ui')

# 14. 末尾初始化 → boot()
i = s.rfind("curText=textEl.value.trim()")
j = s.rfind('})();')
if i < 0 or j < 0 or i > j:
    raise SystemExit('[FAIL] boot: 锚点异常')
s = s[:i] + 'boot();\n' + s[j:]
log.append('boot')

s = s.replace('\n\n\n', '\n\n')
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(s)
print('[OK] ->', OUT)
print('[OK] %d bytes, %d lines' % (len(s.encode('utf-8')), s.count('\n') + 1))
print('[OK] steps:', ' '.join(log))
