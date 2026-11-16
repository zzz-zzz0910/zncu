/* ========== 内置二维码解码：不依赖 BarcodeDetector，任何浏览器都能读图 ==========
   流程：灰度 → 大津法二值化 → 找三个定位图形的 1:1:3:1:1 → 仿射采样成模块矩阵 → 读格式信息 → RS 纠错 → 解析。
   中间那块 logo 遮掉的模块，就是靠 Reed-Solomon 纠错补回来的，只校验不纠错的话永远读不出微信名片码。 */

/* ---- GF(256) ---- */
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint16Array(256);
(() => {
  let x = 1;
  for(let i=0;i<255;i++){ GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if(x & 0x100) x ^= 0x11D; }
  for(let i=255;i<512;i++) GF_EXP[i] = GF_EXP[i-255];
})();
const gmul = (a,b) => (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;
const ginv = a => GF_EXP[255 - GF_LOG[a]];
const pIsZero = p => p.length === 1 && p[0] === 0;
const pDeg = p => p.length - 1;
const pTrim = p => { let i=0; while(i<p.length-1 && p[i]===0) i++; return i ? p.slice(i) : p; };
const pAdd = (a,b) => {
  if(a.length < b.length){ const t=a; a=b; b=t; }
  const r = a.slice(), off = a.length - b.length;
  for(let i=0;i<b.length;i++) r[i+off] ^= b[i];
  return pTrim(r);
};
const pMul = (a,b) => {
  if(pIsZero(a) || pIsZero(b)) return [0];
  const r = new Array(a.length + b.length - 1).fill(0);
  for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) r[i+j] ^= gmul(a[i], b[j]);
  return pTrim(r);
};
const pMono = (deg, scale) => scale === 0 ? [0] : [scale].concat(new Array(deg).fill(0));
const pMulMono = (p, deg, scale) => {
  if(scale === 0 || pIsZero(p)) return [0];
  const r = new Array(p.length + deg).fill(0);
  for(let i=0;i<p.length;i++) r[i] = gmul(p[i], scale);
  return r;
};
const pEval = (p, x) => { let y = p[0]; for(let i=1;i<p.length;i++) y = gmul(y, x) ^ p[i]; return y; };
const pScale = (p, s) => pMulMono(p, 0, s);

/* 扩展欧几里得：解出错误定位多项式 sigma 和错误值多项式 omega */
function qrEuclid(a, b, R){
  if(pDeg(a) < pDeg(b)){ const t=a; a=b; b=t; }
  let rLast = a, r = b, tLast = [0], t = [1];
  while(2 * pDeg(r) >= R){
    const rLastLast = rLast, tLastLast = tLast;
    rLast = r; tLast = t;
    if(pIsZero(rLast)) return null;
    let r0 = rLastLast, q = [0];
    const dlt = ginv(rLast[0]);
    while(pDeg(r0) >= pDeg(rLast) && !pIsZero(r0)){
      const dd = pDeg(r0) - pDeg(rLast);
      const scale = gmul(r0[0], dlt);
      q = pAdd(q, pMono(dd, scale));
      r0 = pAdd(r0, pMulMono(rLast, dd, scale));
    }
    t = pAdd(pMul(q, tLast), tLastLast);
    r = r0;
  }
  const s0 = t[t.length - 1];
  if(s0 === 0) return null;
  const inv = ginv(s0);
  return [pScale(t, inv), pScale(r, inv)];
}
function qrErrLoc(sigma){
  const nErr = pDeg(sigma), out = [];
  for(let i=1;i<256 && out.length<nErr;i++) if(pEval(sigma, i) === 0) out.push(ginv(i));
  return out.length === nErr ? out : null;
}
function qrErrMag(omega, locs){
  const s = locs.length, out = new Array(s);
  for(let i=0;i<s;i++){
    const xiInv = ginv(locs[i]);
    let den = 1;
    for(let j=0;j<s;j++){
      if(i === j) continue;
      const term = gmul(locs[j], xiInv);
      den = gmul(den, (term & 1) === 0 ? (term | 1) : (term & ~1));
    }
    out[i] = gmul(pEval(omega, xiInv), ginv(den));
  }
  return out;
}
/* 纠正一个块；错太多返回 null */
function qrRSDecode(cw, twoS){
  const n = cw.length;
  if(!twoS) return cw;
  let clean = true;
  const synd = new Array(twoS);
  for(let i=0;i<twoS;i++){
    const e = pEval(cw, GF_EXP[i]);
    synd[twoS-1-i] = e;
    if(e) clean = false;
  }
  if(clean) return cw;
  const eu = qrEuclid(pMono(twoS, 1), pTrim(synd), twoS);
  if(!eu) return null;
  const locs = qrErrLoc(eu[0]);
  if(!locs) return null;
  const mags = qrErrMag(eu[1], locs);
  for(let i=0;i<locs.length;i++){
    const pos = n - 1 - GF_LOG[locs[i]];
    if(pos < 0 || pos >= n) return null;
    cw[pos] ^= mags[i];
  }
  for(let i=0;i<twoS;i++) if(pEval(cw, GF_EXP[i])) return null;
  return cw;
}

/* 1. 二值化 */
function qrBinarize(data, w, h){
  const n = w*h, gray = new Uint8Array(n), hist = new Uint32Array(256);
  for(let i=0,p=0;i<n;i++,p+=4){
    const g = (data[p]*0.299 + data[p+1]*0.587 + data[p+2]*0.114) | 0;
    gray[i] = g; hist[g]++;
  }
  let sum = 0; for(let t=0;t<256;t++) sum += t*hist[t];
  let wB = 0, sumB = 0, best = -1, thr = 128;
  for(let t=0;t<256;t++){
    wB += hist[t]; if(!wB) continue;
    const wF = n - wB; if(!wF) break;
    sumB += t*hist[t];
    const mB = sumB/wB, mF = (sum-sumB)/wF, between = wB*wF*(mB-mF)*(mB-mF);
    if(between > best){ best = between; thr = t; }
  }
  const dark = new Uint8Array(n);
  for(let i=0;i<n;i++) dark[i] = gray[i] <= thr ? 1 : 0;
  return dark;
}

/* 验证候选真的是 7x7 定位图形：中心 3x3 黑、内圈白环、外框黑。
   这一步专门排除 5x5 的对齐图形——它横向比例也是 1:1:1:1:1，很容易蒙混过关。 */
function qrCheckFinder(dark, w, h, x, y, m){
  const at=(dx,dy)=>{ const X=Math.round(x+dx*m), Y=Math.round(y+dy*m);
    if(X<0||X>=w||Y<0||Y>=h) return -1; return dark[Y*w+X]; };
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(at(dx,dy)!==1) return false;
  for(const p of [[0,-2],[0,2],[-2,0],[2,0]]) if(at(p[0],p[1])!==0) return false;
  for(const p of [[0,-3],[0,3],[-3,0],[3,0]]) if(at(p[0],p[1])!==1) return false;
  return true;
}

/* 2. 在一行里找 黑:白:黑:白:黑 = 1:1:3:1:1 的定位图形 */
function qrFindPatterns(dark, w, h){
  const cands = [];
  const step = h > 600 ? 2 : 1;   // 定位图形有 3 个模块高的匹配行，隔行扫不会漏，速度翻倍
  for(let y=0;y<h;y+=step){
    const row = y*w;
    let x = 0;
    while(x < w){
      while(x < w && !dark[row+x]) x++;
      if(x >= w) break;
      const s = x;
      let p = s, lens = [], col = 1;
      for(let k=0;k<5 && p<w;k++){
        let c = 0;
        while(p < w && (dark[row+p] ? 1 : 0) === col){ p++; c++; }
        if(!c) break;
        lens.push(c); col ^= 1;
      }
      if(lens.length === 5){
        const tot = lens[0]+lens[1]+lens[2]+lens[3]+lens[4], m = tot/7;
        if(m >= 1.4 &&
           Math.abs(lens[0]-m) < m*0.8 && Math.abs(lens[1]-m) < m*0.8 &&
           Math.abs(lens[2]-3*m) < m*1.2 &&
           Math.abs(lens[3]-m) < m*0.8 && Math.abs(lens[4]-m) < m*0.8){
          const cx = s + tot/2, cy = y + 0.5;
          if(qrCheckFinder(dark, w, h, cx, cy, m)) cands.push({ x: cx, y: cy, m });
        }
      }
      x = s + 1;   // 只前进一格：这里的 5 段不匹配，不代表下一个黑点不是定位图形的起点
    }
  }
  const groups = [];
  for(const c of cands){
    let hit = null;
    for(const g of groups){
      if(Math.abs(g.x-c.x) < Math.max(g.m,c.m)*1.7 && Math.abs(g.y-c.y) < Math.max(g.m,c.m)*1.7){ hit = g; break; }
    }
    if(hit){ const k = hit.n+1; hit.x = (hit.x*hit.n+c.x)/k; hit.y = (hit.y*hit.n+c.y)/k; hit.m = (hit.m*hit.n+c.m)/k; hit.n = k; }
    else groups.push({ x:c.x, y:c.y, m:c.m, n:1 });
  }
  return groups.filter(g => g.n >= 2);
}

/* 3. 三个定位里挑出直角顶点（左上）和两条腰 */
function qrPickTriple(gs){
  let best = null;
  for(let i=0;i<gs.length;i++) for(let j=i+1;j<gs.length;j++) for(let k=0;k<gs.length;k++){
    if(k===i||k===j) continue;
    const a=gs[i], b=gs[j], c=gs[k];
    const ab=Math.hypot(a.x-b.x,a.y-b.y), ac=Math.hypot(a.x-c.x,a.y-c.y), bc=Math.hypot(b.x-c.x,b.y-c.y);
    if(ac<9||bc<9) continue;
    const mm=(a.m+b.m+c.m)/3;
    if(Math.abs(a.m-mm)>mm*0.4 || Math.abs(b.m-mm)>mm*0.4 || Math.abs(c.m-mm)>mm*0.4) continue;
    if(Math.abs(ac-bc) > Math.min(ac,bc)*0.25) continue;
    if(Math.abs(ab*ab - ac*ac - bc*bc) > ab*ab*0.34) continue;
    if(!best || ab > best.score){
      const cr = (a.x-c.x)*(b.y-c.y) - (a.y-c.y)*(b.x-c.x);
      best = cr > 0 ? { tl:c, tr:a, bl:b, score:ab } : { tl:c, tr:b, bl:a, score:ab };
    }
  }
  return best;
}

/* 4. 按仿射把每个模块中心采出来 */
function qrSample(dark, w, h, tl, tr, bl, size){
  const sx = (tr.x-tl.x)/(size-7), sy = (tr.y-tl.y)/(size-7);
  const tx = (bl.x-tl.x)/(size-7), ty = (bl.y-tl.y)/(size-7);
  const mod = [];
  for(let r=0;r<size;r++){
    const row = [];
    for(let c=0;c<size;c++){
      const px0 = tl.x + (c-3)*sx + (r-3)*tx;
      const py0 = tl.y + (c-3)*sy + (r-3)*ty;
      let v = 0, k = 0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const X = Math.round(px0 + dx*0.28), Y = Math.round(py0 + dy*0.28);
        if(X>=0 && X<w && Y>=0 && Y<h){ v += dark[Y*w+X]; k++; }
      }
      row.push(k && v*2 >= k);
    }
    mod.push(row);
  }
  return mod;
}

/* 5. 重建功能图形掩码（定位、时序、对齐、格式、版本区） */
function qrFunctionMask(ver, size){
  const fn = Array.from({length:size}, () => new Array(size).fill(false));
  const mark = (x,y) => { if(x>=0 && x<size && y>=0 && y<size) fn[y][x] = true; };
  for(let i=0;i<size;i++){ mark(6,i); mark(i,6); }
  for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])
    for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) mark(cx+dx, cy+dy);
  const ap = alignPos(ver,size), na = ap.length;
  for(let i=0;i<na;i++) for(let j=0;j<na;j++){
    if((i===0&&j===0)||(i===0&&j===na-1)||(i===na-1&&j===0)) continue;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) mark(ap[i]+dx, ap[j]+dy);
  }
  for(let i=0;i<=5;i++) mark(8,i);
  mark(8,7); mark(8,8); mark(7,8);
  for(let i=9;i<15;i++) mark(14-i,8);
  for(let i=0;i<8;i++) mark(size-1-i,8);
  for(let i=8;i<15;i++) mark(8,size-15+i);
  mark(8,size-8);
  if(ver>=7) for(let i=0;i<18;i++){ const a=size-11+i%3, c=Math.floor(i/3); mark(a,c); mark(c,a); }
  return fn;
}
const QR_MASK = (m,x,y) => {
  switch(m){
    case 0: return (x+y)%2===0; case 1: return y%2===0; case 2: return x%3===0;
    case 3: return (x+y)%3===0; case 4: return (Math.floor(x/3)+Math.floor(y/2))%2===0;
    case 5: return x*y%2 + x*y%3===0; case 6: return (x*y%2 + x*y%3)%2===0;
    default: return ((x+y)%2 + x*y%3)%2===0;
  }
};

/* 6. 读格式信息：15 位里带着纠错等级和掩码，BCH 能纠 3 位错。
   必须靠它定等级——低等级的生成多项式是高等级的因子，光看 RS 余数会误判：
   一张 Q 级的码用 M 级的 18 次多项式去除，余数同样是 0。 */
const QR_FB = [1, 0, 3, 2];   // L,M,Q,H 在格式信息里的 2 位标识
function qrFmtCode(ei, mask){
  const d = (QR_FB[ei] << 3) | mask;
  let r = d; for(let i=0;i<10;i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  return ((d << 10) | r) ^ 0x5412;
}
function qrReadFormat(mod, size, flipped){
  const bit = (y,x) => { const v = mod[y][x] ? 1 : 0; return flipped ? v ^ 1 : v; };
  const bits = [];
  for(let i=0;i<=5;i++) bits.push(bit(i,8));
  bits.push(bit(7,8)); bits.push(bit(8,8)); bits.push(bit(8,7));
  for(let i=9;i<15;i++) bits.push(bit(8,14-i));
  let v = 0; for(let i=0;i<15;i++) if(bits[i]) v |= 1 << i;
  let best = null, bestD = 9;
  for(let ei=0;ei<4;ei++) for(let mask=0;mask<8;mask++){
    let d = 0, x = v ^ qrFmtCode(ei, mask);
    while(x){ d += x & 1; x >>>= 1; }
    if(d < bestD){ bestD = d; best = { ei, mask }; if(!d) return best; }
  }
  return bestD <= 3 ? best : null;
}

/* 7. 矩阵 → 文本 */
function qrDecodeMatrix(mod, ver, flipped){
  const size = mod.length, fn = qrFunctionMask(ver, size);
  const rawCirc = (() => { let r=(16*ver+128)*ver+64; if(ver>=2){ const a=Math.floor(ver/7)+2; r-=(25*a-10)*a-55; if(ver>=7) r-=36; } return Math.floor(r/8); })();
  const fmt = qrReadFormat(mod, size, flipped);
  const tries = [];
  if(fmt) tries.push(fmt);
  // 格式信息读不准时，按纠错强度从高到低试：强的码用弱多项式也能过，反过来不行
  for(let ei=3; ei>=0; ei--) for(let mask=0; mask<8; mask++){
    if(fmt && fmt.ei === ei && fmt.mask === mask) continue;
    tries.push({ ei, mask });
  }
  for(const t of tries){
    const ei = t.ei, mask = t.mask;
    const nb = NUM_BLK[ei][ver], el = ECC_CW[ei][ver];
    const nShort = nb - rawCirc % nb, shortLen = Math.floor(rawCirc / nb);
    const cw = new Uint8Array(rawCirc);
    let bi = 0;
    for(let right=size-1; right>=1; right-=2){
      if(right === 6) right = 5;
      for(let vert=0; vert<size; vert++) for(let j=0;j<2;j++){
        const x = right-j, up = ((right+1)&2)===0, y = up ? size-1-vert : vert;
        if(!fn[y][x] && bi < rawCirc*8){
          let bit = mod[y][x] ? 1 : 0;
          if(flipped) bit ^= 1;
          if(QR_MASK(mask,x,y)) bit ^= 1;
          cw[bi >>> 3] = (cw[bi >>> 3] << 1) | bit;
          bi++;
        }
      }
    }
    if(bi !== rawCirc*8) continue;
    const blocks = Array.from({length:nb}, () => []);
    let k = 0;
    for(let i=0;i<shortLen+1;i++) for(let j=0;j<nb;j++){
      if(i !== shortLen-el || j >= nShort) blocks[j].push(cw[k++]);
    }
    if(k !== rawCirc) continue;
    let ok = true;
    const fixed = new Array(nb);
    for(let j=0;j<nb;j++){
      const r = qrRSDecode(blocks[j].slice(), el);
      if(!r){ ok = false; break; }
      fixed[j] = r;
    }
    if(!ok) continue;
    const data = [];
    for(let j=0;j<nb;j++) for(const v of fixed[j].slice(0, shortLen-el + (j<nShort?0:1))) data.push(v);
    const bits = [];
    for(const byte of data) for(let i=7;i>=0;i--) bits.push((byte>>>i)&1);
    let p = 0; const read = n => { let v=0; for(let i=0;i<n;i++) v = (v<<1) | bits[p++]; return v; };
    const cls = ver<=9?0:ver<=26?1:2, LB = qrLenBits, AL = ALNUM;
    let text = '';
    try{
      while(p + 4 <= bits.length){
        const mode = read(4);
        if(mode === 0) break;
        if(mode === 1){
          const cnt = read(LB.num[cls]); if(!cnt) break; let t = 0;
          while(t < cnt){ const r = Math.min(3, cnt-t); const v = read(r===3?10:r===2?7:4); text += String(v).padStart(r,'0'); t += r; }
        } else if(mode === 2){
          const cnt = read(LB.aln[cls]); if(!cnt) break; let t = 0;
          while(t < cnt){
            if(cnt-t >= 2){ const v = read(11); text += AL[Math.floor(v/45)] + AL[v%45]; t += 2; }
            else { text += AL[read(6)]; t++; }
          }
        } else if(mode === 4){
          const cnt = read(LB.byte[cls]); if(!cnt) break;
          const buf = new Uint8Array(cnt);
          for(let i=0;i<cnt;i++) buf[i] = read(8);
          text += new TextDecoder().decode(buf);
        } else break;
      }
    }catch(e){ continue; }
    if(text) return { text, ecc: ECC_ORDER[ei], mask, ver, size };
  }
  return null;
}

/* 7. 二值图 → 文本 */
function qrScan(dark, w, h){
  const gs = qrFindPatterns(dark, w, h);
  if(gs.length < 3) return null;
  const tri = qrPickTriple(gs);
  if(!tri) return null;
  const { tl, tr, bl } = tri;
  const d1 = Math.hypot(tr.x-tl.x, tr.y-tl.y), d2 = Math.hypot(bl.x-tl.x, bl.y-tl.y);
  const ms = (tl.m + tr.m + bl.m) / 3;
  const span = ((d1 + d2) / 2) / ms + 7;
  const guess = Math.round((span - 17) / 4) * 4 + 17;
  for(const size of [guess, guess-4, guess+4, guess-8, guess+8]){
    if(size < 21 || size > 177) continue;
    const ver = (size - 17) / 4;
    if(ver < 1 || ver > 40 || ver % 1 !== 0) continue;
    const mod = qrSample(dark, w, h, tl, tr, bl, size);
    const r = qrDecodeMatrix(mod, ver, false);
    if(r) return r;
  }
  return null;
}

/* 8. 整张图 → 文本。反色码很少见，只有黑像素过半才回头试一次，省掉一半扫描时间 */
function qrDecodeImage(data, w, h){
  if(w < 21 || h < 21) return null;
  const dark = qrBinarize(data, w, h);
  let cnt = 0;
  for(let i=0;i<dark.length;i++) cnt += dark[i];
  const hit = qrScan(dark, w, h);
  if(hit) return hit;
  if(cnt / dark.length < 0.5) return null;
  const inv = new Uint8Array(dark.length);
  for(let i=0;i<dark.length;i++) inv[i] = dark[i] ^ 1;
  return qrScan(inv, w, h);
}

/* 8. 文件 → 文本。先问浏览器（有就用，最省事），没有就走内置解码 */
let qrDetector = null, qrDetectorTried = false;
async function qrBrowserDetect(bmp){
  if(qrDetectorTried) return qrDetector ? await qrDetector.detect(bmp) : null;
  qrDetectorTried = true;
  try{
    if(!('BarcodeDetector' in window)) return null;
    const fmts = await BarcodeDetector.getSupportedFormats();
    if(!fmts || fmts.indexOf('qr_code') < 0) return null;
    qrDetector = new BarcodeDetector({ formats: ['qr_code'] });
    return await qrDetector.detect(bmp);
  }catch(e){ qrDetector = null; return null; }
}
