  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(curQR.mod[r][c]&&!inHole(r,c)){ x.fillStyle=css(qrInk(r,c,n,1)); x.fillRect(ox+(c+4)*m,oy+(r+4)*m,m,m); }
