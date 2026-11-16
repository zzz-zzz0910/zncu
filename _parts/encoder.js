/* QR_ENC_BEGIN */
/* ========== 二维码编码：数字 / 字母数字 / 字节 多段模式，L M Q H 四级纠错，中心可留白 ==========
   结构参考 Nayuki 的 QR Code generator；ECC_CW / NUM_BLK 是标准容量表，顺序为 [L,M,Q,H][版本]。 */
const ECC_ORDER = ['L','M','Q','H'];
const ECC_FMT = { L:1, M:0, Q:3, H:2 };   // 格式信息里的 2 位纠错标识
const ECC_CW = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];
const NUM_BLK = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const QR_ENC = new TextEncoder();
function rawModules(v){ let r=(16*v+128)*v+64; if(v>=2){ const a=Math.floor(v/7)+2; r-=(25*a-10)*a-55; if(v>=7) r-=36; } return r; }
function dataCodewords(v,e){ return Math.floor(rawModules(v)/8)-ECC_CW[e][v]*NUM_BLK[e][v]; }
function gfMul(x,y){ let z=0; for(let i=7;i>=0;i--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>i)&1)*x; } return z; }
function rsDivisor(d){ const r=new Array(d).fill(0); r[d-1]=1; let root=1; for(let i=0;i<d;i++){ for(let j=0;j<d;j++){ r[j]=gfMul(r[j],root); if(j+1<d) r[j]^=r[j+1]; } root=gfMul(root,2); } return r; }
function rsRemainder(data,div){ const r=div.map(()=>0); for(const b of data){ const f=b^r.shift(); r.push(0); div.forEach((c,i)=>{ r[i]^=gfMul(c,f); }); } return r; }
function alignPos(v,size){ if(v===1) return []; const n=Math.floor(v/7)+2; const step=Math.floor((v*8+n*3+5)/(n*4-4))*2; const r=[6]; for(let p=size-7;r.length<n;p-=step) r.splice(1,0,p); return r; }
const qrLenBits = { num:[10,12,14], aln:[9,11,13], byte:[8,16,16] };
const qrMaxSeg  = [{num:1023,aln:511,byte:255},{num:4095,aln:2047,byte:65535},{num:8191,aln:4095,byte:65535}];
/* 分段规划：动态规划，在「4 位段头 + 长度位 + 数据位」的代价下找最省的分段方式。
   纯数字内容用数字模式每字符 3.33bit，比字节模式的 8bit 省一半以上，版本能小好几级。 */
function planSegments(cpb, cls){
  const n=cpb.length, pre=[0]; for(let i=0;i<n;i++) pre.push(pre[i]+cpb[i].length);
  const L=qrLenBits, M=qrMaxSeg[cls];
  const isNum=new Uint8Array(n), isAln=new Uint8Array(n);
  for(let i=0;i<n;i++){ const b=cpb[i]; isNum[i]=b.length===1&&b[0]>=48&&b[0]<=57; isAln[i]=b.length===1&&ALNUM.indexOf(String.fromCharCode(b[0]))>=0; }
  const cost=new Float64Array(n+1); cost.fill(1e18); const prev=new Array(n+1).fill(null); cost[0]=0;
  for(let i=0;i<n;i++){
    const base=cost[i]; if(base>=1e17) continue;
    for(let j=i+1;j<=n&&isNum[j-1];j++){ const k=j-i; if(k>M.num) break;
      const c=base+4+L.num[cls]+Math.floor(k/3)*10+[0,4,7][k%3]; if(c<cost[j]){ cost[j]=c; prev[j]={i,m:'num'}; } }
    for(let j=i+1;j<=n&&isAln[j-1];j++){ const k=j-i; if(k>M.aln) break;
      const c=base+4+L.aln[cls]+Math.floor(k/2)*11+(k%2)*6; if(c<cost[j]){ cost[j]=c; prev[j]={i,m:'aln'}; } }
    for(let j=i+1;j<=n;j++){ const nb=pre[j]-pre[i]; if(nb>M.byte) break;
      const c=base+4+L.byte[cls]+8*nb; if(c<cost[j]){ cost[j]=c; prev[j]={i,m:'byte'}; } }
  }
  const segs=[]; let p=n; while(p>0&&prev[p]){ const s=prev[p]; segs.push({m:s.m,i:s.i,j:p}); p=s.i; }
  segs.reverse();
  return { bits:cost[n], segs, pre };
}
function encodeQR(text, eccKey, holeSize){
  const ei = ECC_ORDER.indexOf(eccKey)>=0 ? ECC_ORDER.indexOf(eccKey) : 1;
  const key = ECC_ORDER[ei], fmt = ECC_FMT[key];
  const cpb = Array.from(text||'').map(ch => Array.from(QR_ENC.encode(ch)));
  const plans = {}; const planFor = cls => plans[cls] || (plans[cls] = planSegments(cpb, cls));
  let ver = 0, cap = 0, plan = null;
  for(let v=1; v<=40; v++){
    const cls = v<=9?0:v<=26?1:2, p = planFor(cls), c = dataCodewords(v,ei)*8;
    if(p.bits <= c){ ver=v; cap=c; plan=p; break; }
  }
  if(!ver){ const e = new Error('too long'); e.tooLong = true; e.capBytes = dataCodewords(40,ei); throw e; }
  const cls = ver<=9?0:ver<=26?1:2, L = qrLenBits;
  const bits = []; const push = (v,n) => { for(let i=n-1;i>=0;i--) bits.push((v>>>i)&1); };
  for(const s of plan.segs){
    const k = s.j-s.i;
    if(s.m==='num'){
      push(1,4); push(k,L.num[cls]);
      for(let t=s.i;t<s.j;){ const r=Math.min(3,s.j-t); let v=0; for(let u=0;u<r;u++) v = v*10 + (cpb[t+u][0]-48); push(v, r===3?10:r===2?7:4); t+=r; }
    } else if(s.m==='aln'){
      push(2,4); push(k,L.aln[cls]);
      for(let t=s.i;t<s.j;){ if(s.j-t>=2){ push(ALNUM.indexOf(String.fromCharCode(cpb[t][0]))*45 + ALNUM.indexOf(String.fromCharCode(cpb[t+1][0])),11); t+=2; }
        else { push(ALNUM.indexOf(String.fromCharCode(cpb[t][0])),6); t++; } }
    } else {
      push(4,4); push(plan.pre[s.j]-plan.pre[s.i], L.byte[cls]);
      for(let t=s.i;t<s.j;t++) for(const b of cpb[t]) push(b,8);
    }
  }
  push(0, Math.min(4, cap-bits.length)); push(0, (8-bits.length%8)%8);
  for(let p=0xEC; bits.length<cap; p^=0xEC^0x11) push(p,8);
  const data=[]; for(let i=0;i<bits.length;i+=8){ let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b); }
  const nb=NUM_BLK[ei][ver], el=ECC_CW[ei][ver], raw=Math.floor(rawModules(ver)/8), nShort=nb-raw%nb, shortLen=Math.floor(raw/nb), div=rsDivisor(el);
  const blocks=[];
  for(let i=0,k=0;i<nb;i++){ const d=data.slice(k,k+shortLen-el+(i<nShort?0:1)); k+=d.length; const ec=rsRemainder(d,div); if(i<nShort) d.push(0); blocks.push(d.concat(ec)); }
  const cw=[]; for(let i=0;i<blocks[0].length;i++) blocks.forEach((b,j)=>{ if(i!==shortLen-el||j>=nShort) cw.push(b[i]); });
  const size=ver*4+17, mod=[], fn=[];
  for(let y=0;y<size;y++){ mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
  const set=(x,y,d)=>{ mod[y][x]=d; fn[y][x]=true; };
  for(let i=0;i<size;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
  const finder=(cx,cy)=>{ for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const d=Math.max(Math.abs(dx),Math.abs(dy)), x=cx+dx, y=cy+dy; if(x>=0&&x<size&&y>=0&&y<size) set(x,y,d!==2&&d!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  const ap=alignPos(ver,size), na=ap.length;
  for(let i=0;i<na;i++) for(let j=0;j<na;j++){
    if((i===0&&j===0)||(i===0&&j===na-1)||(i===na-1&&j===0)) continue;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) set(ap[i]+dx,ap[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  const drawFormat=m=>{
    const d=(fmt<<3)|m; let r=d; for(let i=0;i<10;i++) r=(r<<1)^((r>>>9)*0x537);
    const b=((d<<10)|r)^0x5412, g=i=>((b>>>i)&1)!==0;
    for(let i=0;i<=5;i++) set(8,i,g(i));
    set(8,7,g(6)); set(8,8,g(7)); set(7,8,g(8));
    for(let i=9;i<15;i++) set(14-i,8,g(i));
    for(let i=0;i<8;i++) set(size-1-i,8,g(i));
    for(let i=8;i<15;i++) set(8,size-15+i,g(i));
    set(8,size-8,true);
  };
  drawFormat(0);
  if(ver>=7){ let r=ver; for(let i=0;i<12;i++) r=(r<<1)^((r>>>11)*0x1F25); const b=(ver<<12)|r;
    for(let i=0;i<18;i++){ const bit=((b>>>i)&1)!==0, a=size-11+i%3, c=Math.floor(i/3); set(a,c,bit); set(c,a,bit); } }
  let bi=0;
  for(let right=size-1;right>=1;right-=2){ if(right===6) right=5;
    for(let vert=0;vert<size;vert++) for(let j=0;j<2;j++){ const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
      if(!fn[y][x]&&bi<cw.length*8){ mod[y][x]=((cw[bi>>>3]>>>(7-(bi&7)))&1)!==0; bi++; } } }
  const applyMask=m=>{ for(let y=0;y<size;y++) for(let x=0;x<size;x++){ if(fn[y][x]) continue; let v;
    switch(m){ case 0:v=(x+y)%2===0;break; case 1:v=y%2===0;break; case 2:v=x%3===0;break; case 3:v=(x+y)%3===0;break;
      case 4:v=(Math.floor(x/3)+Math.floor(y/2))%2===0;break; case 5:v=x*y%2+x*y%3===0;break; case 6:v=(x*y%2+x*y%3)%2===0;break; default:v=((x+y)%2+x*y%3)%2===0; }
    if(v) mod[y][x]=!mod[y][x]; } };
  const P1=[1,0,1,1,1,0,1,0,0,0,0], P2=[0,0,0,0,1,0,1,1,1,0,1];
  const penalty=()=>{ let p=0;
    for(let a=0;a<size;a++){ let rr=1, rc=1;
      for(let b=1;b<=size;b++){
        if(b<size&&mod[a][b]===mod[a][b-1]) rr++; else { if(rr>=5) p+=rr-2; rr=1; }
        if(b<size&&mod[b][a]===mod[b-1][a]) rc++; else { if(rc>=5) p+=rc-2; rc=1; } } }
    for(let y=0;y<size-1;y++) for(let x=0;x<size-1;x++){ const c=mod[y][x]; if(c===mod[y][x+1]&&c===mod[y+1][x]&&c===mod[y+1][x+1]) p+=3; }
    for(let a=0;a<size;a++) for(let b=0;b<=size-11;b++){ let r1=1,r2=1,c1=1,c2=1;
      for(let k=0;k<11;k++){ const h=mod[a][b+k]?1:0, v=mod[b+k][a]?1:0; if(h!==P1[k]) r1=0; if(h!==P2[k]) r2=0; if(v!==P1[k]) c1=0; if(v!==P2[k]) c2=0; }
      p+=40*(r1+r2+c1+c2); }
    let dk=0; for(const row of mod) for(const c of row) if(c) dk++;
    const t=size*size; p+=Math.max(0,Math.ceil(Math.abs(dk*20-t*10)/t)-1)*10; return p; };
  let best=0, bestP=Infinity;
  for(let m=0;m<8;m++){ applyMask(m); drawFormat(m); const p=penalty(); if(p<bestP){ bestP=p; best=m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  let hole=null; const hsIn=Math.max(0,Math.min(11, holeSize|0));
  if(hsIn>0 && (key==='Q'||key==='H') && hsIn<size-9){
    // 留白吃掉的是数据区，上限取码宽的 1/4：v1（21 格）最多 5 格，再大就补不回来了
    let hs=Math.min(hsIn, Math.floor(size/4)); if(hs%2===0) hs--;
    if(hs>=5){ const o=Math.floor((size-hs)/2); hole={x0:o,y0:o,s:hs}; }
  }
  return { size, mod, ver, ecc:key, hole };
}
/* QR_ENC_END */
