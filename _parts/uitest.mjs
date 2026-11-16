/* 交互体检：真的点一遍每种类型、切状态、改窗口，全程盯着有没有报错。 */
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = list.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push((d.exception && d.exception.description || d.text || '').split('\n')[0]);
  }
  if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
await new Promise(r => ws.addEventListener('open', r));
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = async e => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } };

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8788/index.html' });
await sleep(800);
await send('Page.reload', { ignoreCache: true });
await sleep(3800);

/* 1. 十种类型逐个点 */
const names = ['文字', '网址', 'WiFi', '名片', '电话', '短信', '邮件', '位置', '微信名片', '抖音名片', '收款码', '原始内容'];
for (const n of names) {
  const r = await J(`(function(){
    const b=[...document.querySelectorAll('.kind')].find(x=>x.textContent===${JSON.stringify(n)});
    if(!b) return 'no-chip';
    b.click();
    return [document.getElementById('fields').hidden ? 'no-fields' : 'fields',
            document.getElementById('text').readOnly ? 'readonly' : 'editable'].join('/');
  })()`);
  check('类型 ' + n, r !== 'no-chip', r);
  await sleep(160);
}
check('类型数量 = 12', (await J("document.querySelectorAll('.kind').length")) === 12);

/* 2. WiFi 类型真的生成 WIFI: 串 */
const wifiOut = await J(`(function(){
  [...document.querySelectorAll('.kind')].find(x=>x.textContent==='WiFi').click();
  const set=(id,v)=>{ const el=document.getElementById('fld_wifi_'+id); el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
  set('ssid','My Home'); set('pass','p@ss;1');
  return new Promise(res=>setTimeout(()=>res(document.getElementById('text').value),400));
})()`);
check('WiFi 生成格式', /^WIFI:T:WPA;S:My Home;P:p@ss\\;1;;$/.test(wifiOut), wifiOut);

/* 3. 回到文字，内容要还在 */
await J("[...document.querySelectorAll('.kind')].find(x=>x.textContent==='文字').click()");
await sleep(300);
check('切回文字内容还在', (await J("document.getElementById('text').value.length")) > 0);

/* 4. 空内容提示 */
const emptyTip = await J(`(function(){
  const t=document.getElementById('text'); t.value='';
  t.dispatchEvent(new Event('input',{bubbles:true}));
  return new Promise(res=>setTimeout(()=>res(document.getElementById('status').textContent),450));
})()`);
check('空内容有提示', /先写下|填一下/.test(emptyTip), emptyTip);

/* 5. 超长内容 */
const longTip = await J(`(function(){
  const t=document.getElementById('text'); t.value='字'.repeat(300);
  t.dispatchEvent(new Event('input',{bubbles:true}));
  return new Promise(res=>setTimeout(()=>res(document.getElementById('status').textContent),500));
})()`);
check('超长有提示或能编', typeof longTip === 'string' && longTip.length > 4, longTip);

/* 6. 恢复一个正常内容 */
await J(`(function(){ const t=document.getElementById('text'); t.value='愿你今天也被温柔以待'; t.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(500);

/* 7. 生成方式两种 */
const m1 = await J("document.getElementById('vStyle').textContent");
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(500);
const m2 = await J("document.getElementById('vStyle').textContent");
check('模式1/模式2 的码不同', m1 !== m2, m1 + ' vs ' + m2);
check('模式2 按钮文案', (await J("document.getElementById('saveQR').textContent")) === '下载这张码');
await J("document.querySelector('#outMode button[data-v=qr]').click()");
await sleep(400);

/* 8. 快捷键 */
await J("window.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}))");
await sleep(400);
check('快捷键 2 换季', (await J("document.getElementById('vSeason').textContent")) === '夏天');
await J("window.dispatchEvent(new KeyboardEvent('keydown',{key:'t',bubbles:true}))");
await sleep(400);
check('快捷键 t 换天气', (await J("document.getElementById('vWeather').textContent")) === '夜晚');

/* 9. 收起/展开 */
await J("window.dispatchEvent(new KeyboardEvent('keydown',{key:'[',bubbles:true}))");
await sleep(700);
check('收起后面板隐藏', (await J("getComputedStyle(document.querySelector('.panel')).display")) === 'none');
check('收起后舞台变宽', (await J("document.querySelector('.stage').clientWidth")) === 1440);
await J("window.dispatchEvent(new KeyboardEvent('keydown',{key:'[',bubbles:true}))");
await sleep(700);
check('展开后面板回来', (await J("getComputedStyle(document.querySelector('.panel')).display")) !== 'none');

/* 10. 窗口尺寸来回切 */
for (const [w, h] of [[390, 844], [1024, 768], [1600, 1000], [320, 640]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
  await sleep(700);
  const sw = await J("document.querySelector('.stage').clientWidth");
  check(`视口 ${w} 舞台不溢出`, sw <= w && sw > 0, 'stage=' + sw);
  const pw = await J("document.querySelector('.panel').scrollWidth");
  check(`视口 ${w} 面板不横向溢出`, pw <= w + 1, 'scrollW=' + pw);
}

/* 11. 回到桌面，切到二维码视角再回来 */
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(600);
await J("document.getElementById('toQR').click()");
await sleep(600);
check('切到二维码视角', (await J("document.getElementById('stage').dataset.mode")) === 'qr');
await J("document.getElementById('toTree').click()");
await sleep(600);
check('切回小岛', (await J("document.getElementById('stage').dataset.mode")) === 'tree');

/* 12. canvas 真的在画（非空白） */
const painted = await J(`(function(){
  const c=document.getElementById('gl');
  const gl=c.getContext('webgl2');
  const px=new Uint8Array(4);
  gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px.join(',');
})()`);
check('canvas 有内容（不是全透明）', painted !== '0,0,0,0', painted);

console.log('\n交互体检：%d 通过 / %d 失败', pass, fail);
if (errors.length) { console.log('捕获到 JS 异常：'); for (const e of [...new Set(errors)]) console.log('  ! ' + e); }
else console.log('全程没有 JS 异常');
if (fail || errors.length) process.exitCode = 1;
ws.close();
