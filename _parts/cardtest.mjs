/* 验证展示页：点开后浮出来的到底是内容本身，还是一张码。 */
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = list.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
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
const check = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };
const openEditor = async () => {
  await send('Page.navigate', { url: 'http://127.0.0.1:8788/index.html' });
  await sleep(800); await send('Page.reload', { ignoreCache: true }); await sleep(3600);
};
const openShow = async href => {
  await send('Page.navigate', { url: href });
  await sleep(800); await send('Page.reload', { ignoreCache: true }); await sleep(3600);
};
const tap = () => J(`(function(){const c=document.getElementById('gl');
  c.dispatchEvent(new PointerEvent('pointerdown',{clientX:450,clientY:600,bubbles:true,pointerId:1}));
  c.dispatchEvent(new PointerEvent('pointerup',{clientX:450,clientY:600,bubbles:true,pointerId:1}));})()`);

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });

/* --- A. 文字 --- */
await openEditor();
await J(`(function(){ const t=document.getElementById('text'); t.value='2026年5月20日\\n老地方，下午四点'; t.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(600);
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(700);
const linkA = await J("(document.querySelector('#outNote a')||{}).href || ''");
check('文字：链接生成', /#v=/.test(linkA), String(linkA).slice(0, 50));
await openShow(linkA);
await tap(); await sleep(2800);
const cardA = await J("(function(){const c=document.querySelector('.sc-card'); return c ? c.textContent.replace(/\\s+/g,' ').trim() : 'none';})()");
check('文字：卡片直接显示内容', /2026年5月20日/.test(cardA) && /老地方/.test(cardA), cardA);
check('文字：卡片里有小码', await J("(function(){const i=document.querySelector('.sc-mini img'); return !!(i && i.src && i.src.indexOf('data:image/png')===0);})()"));
check('文字：换行保留', await J("(function(){const t=document.querySelector('.sc-text'); return t ? getComputedStyle(t).whiteSpace : 'x';})()") === 'pre-wrap');

/* --- B. WiFi --- */
await openEditor();
await J(`(function(){
  [...document.querySelectorAll('.kind')].find(x=>x.textContent==='WiFi').click();
  const set=(id,v)=>{ const el=document.getElementById('fld_wifi_'+id); el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
  set('ssid','MyHome'); set('pass','88888888');
})()`);
await sleep(700);
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(700);
const linkB = await J("(document.querySelector('#outNote a')||{}).href || ''");
await openShow(linkB);
await tap(); await sleep(2800);
const cardB = await J("(function(){const c=document.querySelector('.sc-card'); return c ? c.textContent.replace(/\\s+/g,' ').trim() : 'none';})()");
check('WiFi：卡片显示网络名', /MyHome/.test(cardB), cardB);
check('WiFi：卡片显示密码', /88888888/.test(cardB), cardB);
check('WiFi：标签是 WiFi', /WiFi/.test(cardB), cardB);

/* --- C. 点卡片能变回小岛 --- */
await J("document.querySelector('.sc-card').click()");
await sleep(500);
check('点卡片变回小岛', (await J("document.getElementById('stage').dataset.mode")) === 'tree');

/* --- D. XSS：内容带尖括号不能被当 HTML 执行 --- */
await openEditor();
await J(`(function(){ const t=document.getElementById('text'); t.value='<img src=x onerror=alert(1)>'; t.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(600);
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(700);
const linkD = await J("(document.querySelector('#outNote a')||{}).href || ''");
await openShow(linkD);
await tap(); await sleep(2800);
check('XSS：尖括号被转义', await J("(function(){const b=document.querySelector('.sc-body'); return !!(b && b.querySelector('img')===null);})()"), '卡片里不该出现 img');

console.log('\n内容卡片：%d 通过 / %d 失败', pass, fail);
if (errors.length) { console.log('JS 异常：'); for (const e of [...new Set(errors)]) console.log('  ! ' + e); }
else console.log('全程没有 JS 异常');
if (fail || errors.length) process.exitCode = 1;
ws.close();
