/* 端到端：真的把一张二维码图片丢进去识码；真的打开生成的展示页。 */
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

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8788/index.html' });
await sleep(800);
await send('Page.reload', { ignoreCache: true });
await sleep(3800);

/* --- A. 把一张真实二维码图片 drop 进页面，看能不能读出来 --- */
const dropResult = await J(`(async function(){
  const res = await fetch('/_parts/test-qr.png');
  if(!res.ok) return 'fetch-fail ' + res.status;
  const blob = await res.blob();
  const file = new File([blob], 'test.png', {type:'image/png'});
  const dt = new DataTransfer();
  dt.items.add(file);
  document.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
  await new Promise(r=>setTimeout(r, 2200));
  return document.getElementById('scanNote').textContent;
})()`);
check('拖图识码有结果', /读到/.test(dropResult || ''), (dropResult || '').slice(0, 80));
check('识出的内容正确', /愿你今天也被温柔以待/.test(dropResult || ''), (dropResult || '').slice(0, 80));

/* --- B. 生成一条展示页链接并真的打开 --- */
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(600);
const href = await J("(document.querySelector('#outNote a')||{}).href || ''");
check('展示页链接生成', /#v=/.test(href || ''), (href || '').slice(0, 60));

if (href) {
  await send('Page.navigate', { url: href });
  await sleep(900);
  await send('Page.reload', { ignoreCache: true });
  await sleep(3800);
  check('打开后是展示页', (await J('document.body.className')).indexOf('showcase') >= 0, await J('document.body.className'));
  check('展示页铺满', (await J("document.querySelector('.stage').clientWidth")) === 1440, String(await J("document.querySelector('.stage').clientWidth")));
  check('面板已隐藏', (await J("getComputedStyle(document.querySelector('.panel')).display")) === 'none');
  /* 点一下切换 */
  await J(`(function(){const c=document.getElementById('gl');
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:700,clientY:500,bubbles:true,pointerId:1}));
    c.dispatchEvent(new PointerEvent('pointerup',{clientX:700,clientY:500,bubbles:true,pointerId:1}));})()`);
  await sleep(300);
  check('展示页点一下变码', (await J("document.getElementById('stage').dataset.mode")) === 'qr');
  await sleep(2600);
  const cardOn = await J("(function(){const i=document.querySelector('.sc-card'); return i ? (i.classList.contains('on')?'on':'off') : 'none';})()");
  check('内容卡片浮上来', cardOn === 'on', cardOn);
  /* 再点一下回去 */
  await J("document.querySelector('.sc-card').click()");
  await sleep(500);
  check('再点回到小岛', (await J("document.getElementById('stage').dataset.mode")) === 'tree');
}

console.log('\n端到端：%d 通过 / %d 失败', pass, fail);
if (errors.length) { console.log('JS 异常：'); for (const e of [...new Set(errors)]) console.log('  ! ' + e); }
else console.log('全程没有 JS 异常');
if (fail || errors.length) process.exitCode = 1;
ws.close();
