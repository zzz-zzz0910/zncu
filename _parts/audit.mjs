/* 全面自检：把成品里的纯逻辑抽出来，往死里灌边界输入。 */
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('抽不到: ' + a);
  return html.slice(i, j);
}
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
const src = slice('/* QR_ENC_BEGIN */', '/* QR_ENC_END */')
  + slice('/* ========== 内置二维码解码', '/* 8. 文件')
  + '\n' + slice('const escShow=', 'function packShow(') + grab('packShow') + '\n' + grab('unpackShow') + '\n' + grab('detectKind') + '\n' + grab('wifiParse')
  + '\nreturn { encodeQR, qrDecodeImage, qrBinarize, packShow, unpackShow, detectKind, wifiParse, ECC_ORDER };';
const M = new Function(src)();

let pass = 0, fail = 0;
const bad = [];
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; bad.push(name + (extra ? '  → ' + extra : '')); }
}
function noThrow(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; bad.push(name + '  → 抛异常: ' + e.message); }
}

/* ---------- 1. 编码器边界 ---------- */
for (const ecc of ['L', 'M', 'Q', 'H']) {
  ok('空内容不崩 [' + ecc + ']', (() => { try { const q = M.encodeQR('', ecc, 0); return q && q.size === 21; } catch (e) { return false; } })());
  ok('单字符 [' + ecc + ']', (() => { try { const q = M.encodeQR('a', ecc, 0); return q.size === 21; } catch (e) { return false; } })());
  ok('300 个中文字 [' + ecc + ']', (() => { try { M.encodeQR('好'.repeat(300), ecc, 0); return true; } catch (e) { return e.tooLong === true; } })());
  ok('超长必须抛 tooLong [' + ecc + ']', (() => { try { M.encodeQR('x'.repeat(4000), ecc, 0); return false; } catch (e) { return e.tooLong === true; } })());
}
/* 每个版本边界都编一次，确认不越界 */
const allVer = [];
for (const ecc of ['L', 'M', 'Q', 'H']) for (let n = 1; n <= 900; n += 37) {
  try { allVer.push(M.encodeQR('A'.repeat(n), ecc, 0).ver); } catch (e) { if (!e.tooLong) bad.push('编码异常 n=' + n); }
}
ok('版本覆盖到 20 以上', Math.max(...allVer) >= 20, 'max=' + Math.max(...allVer));
/* 留白非法时应当被忽略而不是崩 */
ok('留白 L 级不生效', M.encodeQR('hi', 'L', 7).hole === null);
ok('留白 v1 自动收到 5 格', (() => { const q = M.encodeQR('hi', 'Q', 7); return !q.hole || q.hole.s <= 5; })());
ok('留白 99 格不崩', (() => { const q = M.encodeQR('hi', 'H', 99); return !q.hole || q.hole.s <= 11; })());

/* ---------- 2. 解码器对垃圾输入 ---------- */
function rgba(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = fill; d[i * 4 + 3] = 255; }
  return d;
}
ok('全白图返回 null', M.qrDecodeImage(rgba(80, 80, 255), 80, 80) === null);
ok('全黑图返回 null', M.qrDecodeImage(rgba(80, 80, 0), 80, 80) === null);
ok('1x1 图不崩', M.qrDecodeImage(rgba(1, 1, 128), 1, 1) === null);
ok('20x20 太小返回 null', M.qrDecodeImage(rgba(20, 20, 255), 20, 20) === null);
ok('随机噪声不崩', (() => {
  const w = 200, h = 200, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = Math.random() * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  try { M.qrDecodeImage(d, w, h); return true; } catch (e) { return false; }
})());

/* ---------- 3. 展示页载荷打包 ---------- */
const tricky = ['愿你也温柔', 'a~b~c', 'back\\slash', 'tilde~and\\both', 'emoji 🌸🌙', '换行\n第二行', 'x'.repeat(120)];
for (const c of tricky) {
  const packed = M.packShow({ c, s: 'autumn', w: 'night', r: 'canton', e: 'Q', h: 5 });
  const back = M.unpackShow(packed);
  ok('载荷往返 ' + JSON.stringify(c.slice(0, 12)), back.c === c && back.s === 'autumn' && back.w === 'night' && back.r === 'canton' && back.e === 'Q' && back.h === 5,
    '得到 ' + JSON.stringify(back.c));
}
ok('默认值被省略', M.packShow({ c: 'hi' }) === 'hi');
ok('旧 JSON 载荷还能解析（靠 readShowHash 的分支，这里只验格式）',
  M.unpackShow(JSON.parse('{"c":"x"}').c) !== null);

/* ---------- 4. 识码分类 ---------- */
const kinds = [
  ['https://u.wechat.com/EBabc', 'wx'], ['wxp://f2f0abc', 'pay'], ['https://qr.alipay.com/x', 'pay'],
  ['WIFI:T:WPA;S:a;P:b;;', 'wifi'], ['TEL:+8613800138000', 'tel'], ['SMSTO:10086:hi', 'sms'],
  ['mailto:a@b.c?subject=x', 'mail'], ['geo:39.9,116.4', 'geo'], ['https://example.com', 'url'],
  ['随便一句话', 'raw'], ['', 'raw'],
];
for (const [input, want] of kinds) ok('分类 ' + JSON.stringify(input.slice(0, 20)), M.detectKind(input) === want, '得到 ' + M.detectKind(input));
/* WiFi 解析的转义 */
const wf = M.wifiParse('T:WPA;S:My\\;Net;P:p\\:ass;;');
ok('WiFi 转义解析', wf.S === 'My;Net' && wf.P === 'p:ass', JSON.stringify(wf));

/* ---------- 输出 ---------- */
if (bad.length) { console.log('失败项：'); for (const b of bad) console.log('  ✗ ' + b); }
console.log('\n全面自检：%d 通过 / %d 失败', pass, fail);
if (fail) process.exitCode = 1;
