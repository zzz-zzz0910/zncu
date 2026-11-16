function updateStatus(){
  if(!curQR) return; const n=curQR.size, v=curQR.ver;
  $('vShape').textContent=shapeName(treeKey); $('vSeason').textContent=SEASONS[seasonKey].name; $('vWeather').textContent=WEATHERS[weatherKey].name;
  $('vStyle').textContent=`${curQR.ecc} 级 · ${curQR.hole?'留白 '+curQR.hole.s+' 格':'实心'} · 版本 ${v} · ${n}×${n}`;
  if(!glOK){ statusEl.textContent=`这个浏览器不支持 3D 显示，先给你平面的 ${n}×${n} 二维码。`; return; }
  statusEl.textContent = qT===1
    ? `${n}×${n} 的二维码，用手机对准屏幕就能扫。`
    : `${SEASONS[seasonKey].name}的${shapeName(treeKey)}，${WEATHERS[weatherKey].name}。切到二维码，它会落成一张 ${n}×${n} 的码。`;
}
