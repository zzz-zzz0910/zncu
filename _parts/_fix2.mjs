const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = list.find(x => x.type === "page");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
ws.addEventListener("message", ev => { const m = JSON.parse(ev.data);
  if(m.method==="Runtime.exceptionThrown") errs.push(((m.params.exceptionDetails.exception||{}).description||"").split("\n")[0]);
  if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener("open", r));
const send = (m,p={}) => new Promise(res => { const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const fs = await import("node:fs");
const J = async e => (await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
const key = k => J(`window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`);

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:900,height:1000,deviceScaleFactor:1,mobile:false});
// 造一个展示页链接
await send("Page.navigate",{url:"http://127.0.0.1:8788/index.html"});
await sleep(900); await send("Page.reload",{ignoreCache:true}); await sleep(3600);
await key("s"); await sleep(600);
await J("document.querySelector('#outMode button[data-v=show]').click()");
await sleep(700);
const href = await J("(document.querySelector('#outNote a')||{}).href || ''");
// 打开展示页，切到下雨
await send("Page.navigate",{url:href}); await sleep(900);
await send("Page.reload",{ignoreCache:true}); await sleep(3600);
await key("e"); await sleep(2500);
console.log("展示页里切天气 ->", await J("document.getElementById('vWeather').textContent"));
const r = await send("Page.captureScreenshot",{format:"png"});
fs.writeFileSync("fix-show-rain.png", Buffer.from(r.result.data,"base64"));
console.log("saved fix-show-rain.png");
console.log("JS 异常:", errs.length?errs:"无");
ws.close();
