  temple:{ b:[-6.5,6.5,12.5,-6.5,6.5], f(){ // 天坛祈年殿：三层汉白玉圆台，红墙金窗，三重檐蓝瓦攒尖顶，彩画檐带，鎏金宝顶
    const paint=['#2f7d6d','#2f5fae','#d9a548'], blue=ab=>ab%3===0?'#3d72c0':'#2c5ba8';
    const hall=(r,R,ab,y,y0,y1)=>r>R-.42&&ab%2===0&&y>y0+.25&&y<y1-.25?['glow','#e3ae4c']:['stone','#c43d34'];
    return (x,y,z)=>{ const r=Math.hypot(x,z), ab=Math.floor((Math.atan2(z,x)/(Math.PI*2)+1)*24)%24;
      // 台基：三层逐层收，边缘只留一道细收边，不做花纹，免得碎成石堆
      for(const [y0,y1,R] of [[0,.72,5.2],[.72,1.44,4.5],[1.44,2.16,3.8]]){
        if(y>=y0&&y<y1&&r<=R) return ['stone', r>R-.32?'#e4dfd1':'#f5f2ea'];
      }
      const along=Math.max(Math.abs(x),Math.abs(z)), across=Math.min(Math.abs(x),Math.abs(z));
      if(across<.85&&along>=3.6&&along<=5.5&&y<2.16*(1-(along-3.6)/1.9)) return ['stone','#e8e3d6'];
      if(y>=2.16&&y<3.6&&r<=2.35) return hall(r,2.35,ab,y,2.16,3.6);
      if(y>=3.6&&y<4.05&&r<=2.55) return ['stone',paint[ab%3]];
      if(y>=4.05&&y<4.95){ const R=3.45-(y-4.05)*1.25; if(r<=R) return ['stone',r>R-.45&&y<4.5?'#24498a':blue(ab)]; }
      if(y>=4.95&&y<5.65&&r<=1.85) return hall(r,1.85,ab,y,4.95,5.65);
      if(y>=5.65&&y<6.1&&r<=2.05) return ['stone',paint[ab%3]];
      if(y>=6.1&&y<6.95){ const R=2.8-(y-6.1)*1.15; if(r<=R) return ['stone',r>R-.45&&y<6.55?'#24498a':blue(ab)]; }
      if(y>=6.95&&y<7.6&&r<=1.35) return hall(r,1.35,ab,y,6.95,7.6);
      if(y>=7.6&&y<8.05&&r<=1.55) return ['stone',paint[ab%3]];
      if(y>=8.05&&y<9.7){ const R=2.25*(1-(y-8.05)/1.8)+.1; if(r<=R) return ['stone',r>R-.45&&y<8.5?'#24498a':blue(ab)]; }
      if(y>=9.7&&y<10.6&&r<=.45) return ['glow','#e3b04b'];
      if(y>=10.6&&y<11.1&&solidSq(x,z)) return ['glow','#f0c75a'];
      return null; }; } },
