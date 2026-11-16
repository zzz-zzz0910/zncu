  pearl:{ b:[-6,6,32.5,-6,6], f(){ // 东方明珠：三根直筒 + 三根斜撑托起下球，五颗小珠串到上球，再接太空舱和天线
    const ang=[Math.PI/2,Math.PI*7/6,Math.PI*11/6], cols=ang.map(a=>[Math.cos(a)*1.35,Math.sin(a)*1.35]);
    const legs=ang.map(a=>a+Math.PI/3).map(a=>[[Math.cos(a)*4.9,0,Math.sin(a)*4.9],[Math.cos(a)*1.7,5.2,Math.sin(a)*1.7],.45,.38]);
    const small=[0,1,2,3,4].map(k=>{ const a=k/5*Math.PI*2+.3; return [Math.cos(a)*1.4,10.6+k*.75,Math.sin(a)*1.4,.6]; });
    // 球面按纬度分成横向环带——真实那颗球就是一层层观景窗，比棋盘格干净得多
    const sph=(x,y,z,cy,r)=>{
      const dy=y-cy; if(Math.hypot(x,dy,z)>r) return null;
      const lat=dy/r, band=Math.floor((lat*.5+.5)*9);
      const col=(lat>.86||lat<-.86)?'#a92f5b':(band%2?'#cf3f73':'#e46b97');
      return ['glow',col];
    };
    return (x,y,z)=>{ const r=Math.hypot(x,z);
      if(y<.5) return r<5.8?['stone',r>4.8?'#cfc8ba':'#ddd7cb']:null;
      const s=sph(x,y,z,6.6,2.7)||sph(x,y,z,17.2,2.0)||sph(x,y,z,22.4,.85); if(s) return s;
      for(const b of small) if(Math.hypot(x-b[0],y-b[1],z-b[2])<=b[3]) return ['glow','#cf3f73'];
      if(y<17.5) for(const c of cols) if(Math.hypot(x-c[0],z-c[1])<=.46) return ['stone','#e7e4de'];
      if(r<=.42&&y<23) return ['stone','#e7e4de'];
      if(inCaps(x,y,z,legs)) return ['stone','#cdc6ba'];
      if(y>=23.2&&y<31.5&&(r<=.4-(y-23.2)*.033||solidSq(x,z))) return ['stone',band(y-23.2,1.6,.55)?'#f1f3f5':'#d5dade'];
      if(y>=31.5&&y<32&&solidSq(x,z)) return ['glow','#ff8a6a'];
      return null; }; } },
