function rebuild(mode){ // mode: all=首次全部长出 tree=树重新长 qr=码格子弹出 none=无动画
  let qr;
  try{ qr=encodeQR(curText,eccKey,holeSize); }
  catch(err){
    if(err&&err.tooLong) statusEl.textContent=`这段内容在 ${eccKey} 级纠错下放不下了（${eccKey} 级最多约 ${err.capBytes} 字节），删一点，或者把纠错调低。`;
    else statusEl.textContent='这段内容编不进二维码，换短一点试试。';
    return;
  }
  curQR=qr;
  if(!glOK){ drawFlat(); updateStatus(); return; }
  scene=buildScene(qr,curText,mode); geom=packAll(scene.list); colors=packColors(scene.list); applyColors(geom,colors,null,1);
  count=scene.list.length; fade=null; if(mode!=='none') grow=0;
  gl.bindBuffer(gl.ARRAY_BUFFER,instBuf); gl.bufferData(gl.ARRAY_BUFFER,geom,gl.DYNAMIC_DRAW);
  if(mode==='all') initParticles(); else if(particleTree!==treeKey) initSeasonFX();
  updateStatus();
}
