const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = list.find(x => x.type === "page");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener("open", r));
const send = (m,p={}) => new Promise(res => { const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const fs = await import("node:fs");
const J = async e => (await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
const key = k => J(`window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`);
const shot = async n => { const r = await send("Page.captureScreenshot",{format:"png"}); fs.writeFileSync(n, Buffer.from(r.result.data,"base64")); console.log("saved", n); };

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:900,height:1000,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:"http://127.0.0.1:8788/index.html"});
await sleep(900); await send("Page.reload",{ignoreCache:true}); await sleep(3800);
await key("["); await sleep(800);   // 收起面板，看全屏

await key("s"); await sleep(2000);  // 松树
await shot("fix-pine.png");

await key("e"); await sleep(2200);  // 下雨
const rainCount = await J(`(function(){
  const c=document.getElementById('gl'); return 'canvas ' + c.width + 'x' + c.height;
})()`);
console.log("下雨后:", rainCount, " 天气:", await J("document.getElementById('vWeather').textContent"));
await shot("fix-rain.png");
ws.close();
