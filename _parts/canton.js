  canton:{ b:[-4.5,4.5,40,-4.5,4.5], f(){ // 广州塔：双曲面镂空网筒，腰部收到最细再放开，顶上细长天线
    const H=30;
    return (x,y,z)=>{
      if(y<.6) return Math.abs(x)<3.4&&Math.abs(z)<3.4?['stone',Math.max(Math.abs(x),Math.abs(z))>2.9?'#cfc8ba':'#ddd7cb']:null;
      if(y<H){ const t=y/H, wa=.55, w=t<wa?Math.pow((wa-t)/wa,1.45):Math.pow((t-wa)/(1-wa),1.35);
        const a=1.0+(t<wa?1.45:.62)*w, b=.84+(t<wa?1.0:.42)*w, th=t*2.6, c=Math.cos(th), s=Math.sin(th), u=x*c+z*s, v=-x*s+z*c, e=Math.hypot(u/a,v/b);
        if(Math.hypot(u/.5,v/.62)<=1) return ['stone','#cfd4d9'];
        if(y>H-1&&e<=1) return ['stone',e>.8?'#d9dde2':'#e6e9ec'];
        if(e<=1&&e>=1-.58/Math.min(a,b)){ const ph=Math.atan2(v/b,u/a)/(Math.PI*2), column=((ph*16+t*4)%1+1)%1<.43, ring=band(y,2.0,.62);
          if(column||ring) return ['glow','lattice',t]; }
        return null; }
      if(y<H+2.8) return Math.abs(x)<.5&&Math.abs(z)<.5?['stone','#e4e7ea']:null;
      if(y<H+8.5) return solidSq(x,z)?['stone',band(y-H,1.6,.5)?'#f1f3f5':'#d5dade']:null;
      if(y<H+9) return solidSq(x,z)?['glow','#ef6a5a']:null;
      return null; }; } },
