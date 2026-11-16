/* 内置解码器的自检：把编码器生成的矩阵渲染成"截图"，再让解码器从像素里把它读回来。
   覆盖版本、纠错等级、白边、缩放倍率、轻微模糊、反色。 */
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('抽不到片段: ' + a);
  return html.slice(i, j);
}
const src = slice('/* QR_ENC_BEGIN */', '/* QR_ENC_END */')
  + slice('/* ========== 内置二维码解码', '/* 8. 文件 → 文本')
  + '\nreturn { encodeQR, qrDecodeImage, qrBinarize, qrFindPatterns, qrPickTriple, qrSample, qrDecodeMatrix, qrFunctionMask, rsDivisor, rsRemainder, NUM_BLK, ECC_CW, ECC_ORDER };';
const M = new Function(src)();
const { encodeQR, qrDecodeImage } = M;

function render(rows, scale, quiet, invert) {
  const n = rows.length, side = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  const bg = invert ? 0 : 255, fg = invert ? 255 : 0;
  for (let i = 0; i < side * side; i++) { data[i * 4] = bg; data[i * 4 + 1] = bg; data[i * 4 + 2] = bg; data[i * 4 + 3] = 255; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (rows[y][x] !== '1') continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = ((y + quiet) * scale + dy) * side + ((x + quiet) * scale + dx);
      data[px * 4] = fg; data[px * 4 + 1] = fg; data[px * 4 + 2] = fg;
    }
  }
  return { data, w: side, h: side };
}
function blur(img) {
  const { data, w, h } = img, out = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += data[((y + dy) * w + (x + dx)) * 4];
    const v = (s / 9) | 0, p = (y * w + x) * 4;
    out[p] = out[p + 1] = out[p + 2] = v;
  }
  return { data: out, w, h };
}
/* 模拟微信名片码中间那块 logo：挖掉正中间一块，涂成微信绿 */
function logoMask(img, ratio) {
  const { data, w, h } = img;
  const n = Math.round(Math.min(w, h) * ratio), x0 = (w - n) >> 1, y0 = (h - n) >> 1;
  const out = new Uint8ClampedArray(data);
  for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) {
    const p = (y * w + x) * 4;
    out[p] = 0x2e; out[p + 1] = 0xb8; out[p + 2] = 0x72;
  }
  return { data: out, w, h };
}

const contents = [
  'HELLO WORLD',
  'https://example.com/a?b=1&c=2',
  '你好，世界',
  '愿你今天也被温柔以待',
  'WIFI:T:WPA;S:MyHome;P:12345678;;',
  '13800000000',
  'https://u.wechat.com/EBAbCdEfGh1234567890',
  'wxp://f2f0Q7KvXy8sZb3Tn5mR1jLpD4hGc6aB',
  'x'.repeat(120),
  '小岛二维码'.repeat(12),
];

const scenarios = [
  ['干净 6x + 白边 4', (rows) => render(rows, 6, 4, false)],
  ['小倍率 3x + 白边 2', (rows) => render(rows, 3, 2, false)],
  ['大倍率 10x + 白边 6', (rows) => render(rows, 10, 6, false)],
  ['无白边', (rows) => render(rows, 6, 0, false)],
  ['轻微模糊', (rows) => blur(render(rows, 6, 4, false))],
  ['反色码', (rows) => render(rows, 6, 4, true)],
  ['中间 18% 被 logo 盖住', (rows) => logoMask(render(rows, 6, 4, false), 0.18)],
  // 24% 这种大遮挡只有 v4 以上（模块够多、纠错码字够多）才补得回来，小码在物理上就没余量了
  ['中间 24% 被 logo 盖住', (rows) => rows.length >= 33 ? logoMask(render(rows, 6, 4, false), 0.24) : null],
];

let pass = 0, fail = 0;
let shown = 0;
for (const text of contents) {
  for (const ecc of ['M', 'Q']) {
    let qr;
    try { qr = encodeQR(text, ecc, 0); } catch (e) { continue; }
    const rows = qr.mod.map(r => r.map(v => v ? '1' : '0').join(''));
    for (const [label, make] of scenarios) {
      const img = make(rows);
      if (!img) continue;
      const r = qrDecodeImage(img.data, img.w, img.h);
      const ok = !!r && r.text === text;
      if (ok) pass++;
      else {
        fail++;
        const direct = M.qrDecodeMatrix(qr.mod, qr.ver, false);
        console.log('FAIL  [%s] v%d %s  %s   直接解矩阵:%s', ecc, qr.ver, label, JSON.stringify(text.slice(0, 22)),
          direct ? (direct.text === text ? '通过' : '解出但不对') : '失败');
        if (shown++ < 2) {
          const dark = M.qrBinarize(img.data, img.w, img.h);
          const gs = M.qrFindPatterns(dark, img.w, img.h);
          const tri = M.qrPickTriple(gs);
          console.log('      图像 %dx%d，候选定位 %d 个：%s', img.w, img.h, gs.length,
            gs.map(g => '(' + g.x.toFixed(0) + ',' + g.y.toFixed(0) + ' m=' + g.m.toFixed(2) + ' n=' + g.n + ')').join(' '));
          console.log('      三角：%s', tri ? ('tl(' + tri.tl.x.toFixed(0) + ',' + tri.tl.y.toFixed(0) + ') tr(' + tri.tr.x.toFixed(0) + ',' + tri.tr.y.toFixed(0) + ') bl(' + tri.bl.x.toFixed(0) + ',' + tri.bl.y.toFixed(0) + ')') : 'null');
        }
      }
    }
  }
}
console.log('\n内置解码: %d 通过 / %d 失败', pass, fail);

/* 超大版本单独跑：177x177 也要认得出来 */
try {
  const long = 'A'.repeat(1000);
  const qr = encodeQR(long, 'L', 0);
  const rows = qr.mod.map(r => r.map(v => v ? '1' : '0').join(''));
  const img = render(rows, 3, 4, false);
  const r = qrDecodeImage(img.data, img.w, img.h);
  const ok = !!r && r.text === long;
  console.log('大版本 v%d (%dx%d): %s', qr.ver, qr.size, qr.size, ok ? '通过' : '失败');
  if (!ok) fail++;
} catch (e) { console.log('大版本跳过: ' + e.message); }

if (fail) process.exitCode = 1;

/* ---- 专项：为什么 v4-Q 直接解矩阵会"解出但不对" ---- */
{
  const text = 'wxp://f2f0Q7KvXy8sZb3Tn5mR1jLpD4hGc6aB';
  const qr = encodeQR(text, 'Q', 0);
  const ver = qr.ver, size = qr.size;
  const fn = M.qrFunctionMask(ver, size);
  let rawCirc = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const a = Math.floor(ver / 7) + 2; rawCirc -= (25 * a - 10) * a - 55; if (ver >= 7) rawCirc -= 36; }
  rawCirc = Math.floor(rawCirc / 8);
  console.log('\n调试 v%d %dx%d rawCirc=%d', ver, size, size, rawCirc);
  for (let ei = 0; ei < 4; ei++) {
    const nb = M.NUM_BLK[ei][ver], el = M.ECC_CW[ei][ver];
    const nShort = nb - rawCirc % nb, shortLen = Math.floor(rawCirc / nb);
    const div = M.rsDivisor(el);
    for (let mask = 0; mask < 8; mask++) {
      const cw = new Uint8Array(rawCirc);
      let bi = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
          if (!fn[y][x] && bi < rawCirc * 8) {
            let bit = qr.mod[y][x] ? 1 : 0;
            if (((m, x2, y2) => {
              switch (m) {
                case 0: return (x2 + y2) % 2 === 0; case 1: return y2 % 2 === 0; case 2: return x2 % 3 === 0;
                case 3: return (x2 + y2) % 3 === 0; case 4: return (Math.floor(x2 / 3) + Math.floor(y2 / 2)) % 2 === 0;
                case 5: return x2 * y2 % 2 + x2 * y2 % 3 === 0; case 6: return (x2 * y2 % 2 + x2 * y2 % 3) % 2 === 0;
                default: return ((x2 + y2) % 2 + x2 * y2 % 3) % 2 === 0;
              }
            })(mask, x, y)) bit ^= 1;
            cw[bi >>> 3] = (cw[bi >>> 3] << 1) | bit;
            bi++;
          }
        }
      }
      if (bi !== rawCirc * 8) { console.log('  ei=%d mask=%d bi=%d 不等于 %d', ei, mask, bi, rawCirc * 8); continue; }
      const blocks = Array.from({ length: nb }, () => []);
      let k = 0;
      for (let i = 0; i < shortLen + 1; i++) for (let j = 0; j < nb; j++) {
        if (i !== shortLen - el || j >= nShort) blocks[j].push(cw[k++]);
      }
      if (k !== rawCirc) { console.log('  ei=%d mask=%d 反交织 k=%d', ei, mask, k); continue; }
      const bad = blocks.filter(b => M.rsRemainder(b, div).some(v => v !== 0)).length;
      if (bad === 0) {
        const lens = blocks.map(b => b.length).join('/');
        console.log('  RS 通过: ei=%d(%s) mask=%d  块数=%d 块长=%s', ei, M.ECC_ORDER[ei], mask, nb, lens);
      }
    }
  }
}
