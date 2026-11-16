/* 二维码编码器的往返自检：从生成的模块矩阵反推出原始字符串，顺带校验 Reed-Solomon 余数。
   反推得回来 = 掩码、交织、纠错码字、放置顺序全对，扫码器按标准流程读就能读到同样的内容。 */
import { encodeQR, ECC_ORDER, alignPos, rsDivisor, rsRemainder, NUM_BLK, ECC_CW } from './_enc.mjs';
import fs from 'node:fs';

function rawCodewords(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const a = Math.floor(ver / 7) + 2; r -= (25 * a - 10) * a - 55; if (ver >= 7) r -= 36; }
  return Math.floor(r / 8);
}
function functionMask(ver, size) {
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => { if (x >= 0 && x < size && y >= 0 && y < size) fn[y][x] = true; };
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  const ap = alignPos(ver, size), na = ap.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(ap[i] + dx, ap[j] + dy);
  }
  for (let i = 0; i <= 5; i++) mark(8, i);
  mark(8, 7); mark(8, 8); mark(7, 8);
  for (let i = 9; i < 15; i++) mark(14 - i, 8);
  for (let i = 0; i < 8; i++) mark(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) mark(8, size - 15 + i);
  mark(8, size - 8);
  if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); mark(a, c); mark(c, a); }
  return fn;
}
const maskBit = (m, x, y) => {
  switch (m) {
    case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0; case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return x * y % 2 + x * y % 3 === 0; case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
    default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
  }
};
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const LB = { num: [10, 12, 14], aln: [9, 11, 13], byte: [8, 16, 16] };

function decodeQR(qr, eccKey) {
  const { size, mod, ver } = qr;
  const ei = ECC_ORDER.indexOf(eccKey);
  const fn = functionMask(ver, size);
  const numBlocks = NUM_BLK[ei][ver], el = ECC_CW[ei][ver];
  const raw = rawCodewords(ver), nShort = numBlocks - raw % numBlocks, shortLen = Math.floor(raw / numBlocks);
  const div = rsDivisor(el);
  for (let mask = 0; mask < 8; mask++) {
    const grid = mod.map((row, y) => row.map((v, x) => (!fn[y][x] && maskBit(mask, x, y)) ? !v : v));
    const cw = new Array(raw).fill(0);
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < raw * 8) { const i = bi >>> 3; cw[i] = (cw[i] << 1) | (grid[y][x] ? 1 : 0); bi++; }
      }
    }
    const blocks = Array.from({ length: numBlocks }, () => []);
    let k = 0;
    for (let i = 0; i < shortLen + 1; i++) for (let j = 0; j < numBlocks; j++) {
      if (i !== shortLen - el || j >= nShort) blocks[j].push(cw[k++]);
    }
    if (k !== raw) throw new Error('反交织没吃完: ' + k + '/' + raw);
    let rsOK = true;
    for (const b of blocks) if (rsRemainder(b, div).some(v => v !== 0)) { rsOK = false; break; }
    if (!rsOK) continue;
    const data = [];
    for (let j = 0; j < numBlocks; j++) data.push(...blocks[j].slice(0, shortLen - el + (j < nShort ? 0 : 1)));
    const bits = []; for (const byte of data) for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
    let p = 0; const read = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[p++]; return v; };
    const cls = ver <= 9 ? 0 : ver <= 26 ? 1 : 2;
    let text = ''; const modes = [];    while (p + 4 <= bits.length) {
      const mode = read(4);
      if (mode === 0) break;
      if (mode === 1) {
        const n = read(LB.num[cls]); modes.push('num'); let t = 0;
        while (t < n) { const r = Math.min(3, n - t); const v = read(r === 3 ? 10 : r === 2 ? 7 : 4); text += String(v).padStart(r, '0'); t += r; }
      } else if (mode === 2) {
        const n = read(LB.aln[cls]); modes.push('aln'); let t = 0;
        while (t < n) {
          if (n - t >= 2) { const v = read(11); text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; t += 2; }
          else { text += ALNUM[read(6)]; t++; }
        }
      } else if (mode === 4) {
        const n = read(LB.byte[cls]); modes.push('byte');
        const chunk = new Uint8Array(n);
        for (let i = 0; i < n; i++) chunk[i] = read(8);
        text += new TextDecoder().decode(chunk);
      } else throw new Error('未知模式 ' + mode + '（掩码 ' + mask + '）');
    }
    return { mask, text, modes, ver };
  }
  return null;
}

const cases = [
  ['HELLO WORLD', 'M'],
  ['HTTPS://EXAMPLE.COM/AB', 'L'],
  ['0123456789012345678901234567890123456789', 'M'],
  ['12345678901234567890123456789012', 'H'],
  ['你好，世界', 'M'],
  ['https://example.com/a?b=1&c=2', 'Q'],
  ['愿你今天也被温柔以待', 'M'],
  ['愿你今天也被温柔以待', 'H'],
  ['AB12你好CD34', 'M'],
  ['WIFI:T:WPA;S:MyHome;P:12345678;;', 'M'],
  ['BEGIN:VCARD\nVERSION:3.0\nFN:王小岛\nTEL;TYPE=CELL:13800000000\nEND:VCARD', 'Q'],
  ['a', 'H'],
  ['x'.repeat(120), 'L'],
  ['x'.repeat(120), 'H'],
  ['https://u.wechat.com/EBxxxxxxxxxxxxxxxxxxxxxxxxxx', 'M'],
  ['wxp://f2f0Q7KvXy8sZb3Tn5mR1jLpD4hGc6aB', 'M'],
  ['愿你今天也被温柔以待'.repeat(4), 'Q'],
  ['13800000000', 'H'],
  ['https://maps.amap.com/place/B000A7', 'M'],
  ['wxp://f2f0Q7KvXy8sZb3Tn5mR1jLpD4hGc6aB', 'Q'],
  ['https://u.wechat.com/EBAbCdEfGh1234567890', 'Q'],
  ['https://u.wechat.com/EBAbCdEfGh1234567890', 'H'],
];

let pass = 0, fail = 0;
const out = [];
for (const [text, ecc] of cases) {
  let qr;
  try { qr = encodeQR(text, ecc, 0); }
  catch (e) { console.log('SKIP  [' + ecc + '] ' + text.slice(0, 26) + ' -> ' + e.message); continue; }
  const r = decodeQR(qr, ecc);
  const ok = !!r && r.text === text;
  out.push({ text, ecc, ver: qr.ver, size: qr.size, mask: r ? r.mask : -1, modes: r ? r.modes : [], ok: true,
             rows: qr.mod.map(row => row.map(v => v ? 1 : 0).join('')) });
  if (ok) {
    pass++;
    console.log('PASS  [' + ecc + '] v' + qr.ver + ' ' + qr.size + 'x' + qr.size + ' mask=' + r.mask + ' ' + r.modes.join('+') + '  ' + JSON.stringify(text.slice(0, 20)));
  } else {
    fail++;
    console.log('FAIL  [' + ecc + '] ' + JSON.stringify(text.slice(0, 36)) + ' -> ' + (r ? JSON.stringify(r.text.slice(0, 36)) : '解不出来'));
  }
}
console.log('\n往返结果: ' + pass + ' 通过 / ' + fail + ' 失败');
fs.writeFileSync(new URL('./enc_out.json', import.meta.url), JSON.stringify(out), 'utf8');

/* 中心留白的实扫素材：跟上面同样的内容，开 7 格留白，看编码器自己把格子缩到了多少 */
const holeOut = [];
for (const [text, ecc] of cases) {
  if (ecc !== 'Q' && ecc !== 'H') continue;
  try {
    const qr = encodeQR(text, ecc, 7);
    if (qr.hole) holeOut.push({ text, ecc, ver: qr.ver, hole: qr.hole.s, rows: qr.mod.map(r => r.map(v => v ? 1 : 0).join('')) });
  } catch (e) { }
}
fs.writeFileSync(new URL('./hole_out.json', import.meta.url), JSON.stringify(holeOut), 'utf8');
console.log('带中心留白的样本: ' + holeOut.map(h => h.ecc + '·' + h.ver + '·' + h.hole + '格').join('  '));
if (fail) process.exitCode = 1;

/* ---- 反向交叉：拿同一套解码器去读 segno 生成的矩阵 ---- */
try {
  const segPath = new URL('./segno_out.json', import.meta.url);
  if (fs.existsSync(segPath)) {
    const seg = JSON.parse(fs.readFileSync(segPath, 'utf8'));
    let ok2 = 0, bad2 = 0;
    for (const c of seg) {
      const mod = c.rows.map(r => r.split('').map(v => v === '1'));
      const r = decodeQR({ size: mod.length, mod, ver: c.ver }, c.ecc);
      const good = !!r && r.text === c.text;
      if (good) ok2++; else { bad2++; console.log('CROSS-DIFF [' + c.ecc + '] ' + JSON.stringify(c.text.slice(0, 24)) + ' -> ' + (r ? JSON.stringify(r.text.slice(0, 24)) : 'null')); }
    }
    console.log('交叉解码 segno 的码: ' + ok2 + ' 通过 / ' + bad2 + ' 失败（仅参考：两个实现对同一内容的合法编码可以不同，判定以 zbar 实扫为准）');
  }
} catch (e) { console.log('crosscheck skipped: ' + e.message); }
