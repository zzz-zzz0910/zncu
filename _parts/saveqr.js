function qrCanvas(text){
  let qr = curQR;
  if(text && text !== curText){
    try{ qr = encodeQR(text, eccKey, holeSize); }catch(e){ return null; }
  }
  if(!qr) return null;
  const n = qr.size, pad = 4, S = n + pad*2;
  const h = qr.hole, inH = (r,c)=> !!h && r>=h.y0 && r<h.y0+h.s && c>=h.x0 && c<h.x0+h.s;
  const sel=$('exportSize'), want=Math.max(320,parseInt(sel&&sel.value,10)||1024), m=Math.max(4,Math.round(want/S)), px=S*m;
  const c=document.createElement('canvas'); c.width=c.height=px;
  const x=c.getContext('2d'); x.imageSmoothingEnabled=false;
  x.fillStyle=QRPAL[seasonKey].board; x.fillRect(0,0,px,px);
  for(let r=0;r<n;r++) for(let cc=0;cc<n;cc++) if(qr.mod[r][cc]&&!inH(r,cc)){ x.fillStyle=css(qrInk(r,cc,n,1)); x.fillRect((cc+pad)*m,(r+pad)*m,m,m); }
  return c;
}
function exportQR(){
  const c=qrCanvas(); if(!c) return;
  download(c.toDataURL('image/png'),`小岛二维码-${curQR.size}x${curQR.size}-${curQR.ecc}.png`);
}
$('saveQR').addEventListener('click',exportQR);
