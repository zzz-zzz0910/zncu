/* 识码的解析逻辑最容易写错：把 detectKind / wifiParse 从成品里抽出来，喂一批真实形状的码内容。 */
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function grab(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('找不到 ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let p = i; p < html.length; p++) {
    if (html[p] === '{') depth++;
    else if (html[p] === '}') { depth--; if (depth === 0) return html.slice(start, p + 1); }
  }
  throw new Error('括号没配平: ' + name);
}
const src = grab('detectKind') + '\n' + grab('wifiParse') + '\nreturn { detectKind, wifiParse };';
const { detectKind, wifiParse } = new Function(src)();

const kindCases = [
  ['https://u.wechat.com/EBAbCdEfGh123456', 'wx'],
  ['http://weixin.qq.com/r/abcdefg', 'wx'],
  ['wxp://f2f0AbCdEf1234567890', 'pay'],
  ['https://qr.alipay.com/bax0123456789', 'pay'],
  ['alipays://platformapi/startapp?appId=20000067', 'pay'],
  ['WIFI:T:WPA;S:MyHome;P:12345678;;', 'wifi'],
  ['TEL:+8613800138000', 'tel'],
  ['SMSTO:10086:你好', 'sms'],
  ['mailto:hi@example.com?subject=Hi&body=Yo', 'mail'],
  ['geo:39.9163,116.3972;u=%E5%A4%A9%E5%AE%89%E9%97%A8', 'geo'],
  ['https://example.com/page', 'url'],
  ['随便一段中文，不是网址', 'raw'],
  ['BEGIN:VCARD\nVERSION:3.0\nFN:王小岛\nEND:VCARD', 'raw'],
  ['0123456789', 'raw'],
];

const wifiCases = [
  ['T:WPA;S:MyHome;P:12345678;;', { T: 'WPA', S: 'MyHome', P: '12345678' }],
  ['T:WPA;S:My\\;Home;P:pa\\;ss\\:word;;', { T: 'WPA', S: 'My;Home', P: 'pa;ss:word' }],
  ['T:nopass;S:FreeWiFi;;', { T: 'nopass', S: 'FreeWiFi' }],
  ['T:WPA;S:Café 2;P:ünïcode;H:true;;', { T: 'WPA', S: 'Café 2', P: 'ünïcode', H: 'true' }],
];

let bad = 0;
for (const [input, want] of kindCases) {
  const got = detectKind(input);
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'WRONG') + '  ' + JSON.stringify(input.slice(0, 40)) + '  -> ' + got + (ok ? '' : '（期望 ' + want + '）'));
}
console.log('');
for (const [input, want] of wifiCases) {
  const got = wifiParse(input);
  const ok = Object.keys(want).every(k => got[k] === want[k]);
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'WRONG') + '  ' + JSON.stringify(input) + '  -> ' + JSON.stringify(got));
}
console.log('\n解析结果: ' + (bad ? bad + ' 处不对' : '全部正确'));
if (bad) process.exitCode = 1;
