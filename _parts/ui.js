/* ========== v2：内容类型 · 生成器 · 纠错与留白 · 识码 · 分享 ========== */
let eccKey='M', holeSize=0, kind='text', manual='', bootMode='tree';
let showMode=false, showPayload=null, outMode='qr', spinPaused=false, showView='card';
const vals={enc:'WPA'};
const inHole=(r,c)=>{ const h=curQR&&curQR.hole; return !!h&&r>=h.y0&&r<h.y0+h.s&&c>=h.x0&&c<h.x0+h.s; };

/* ---- 小提示条 ---- */
const toastEl=document.createElement('div'); toastEl.className='toast'; toastEl.setAttribute('role','status'); document.body.appendChild(toastEl);
let toastT=0;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'),2800); }

/* ---- WiFi / vCard 里的特殊字符要转义 ---- */
const wEsc=s=>String(s??'').replace(/([\\;,:"])/g,'\\$1');
const vEsc=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/([,;])/g,'\\$1');

/* ---- 十种内容，扫码器读到的其实都是字符串，区别只在格式约定 ---- */
const KINDS=[
  {k:'text', name:'文字', hint:'微信扫纯文字只会提示「不支持显示内容」，但长按能复制。想让别人在微信里直接看到，把下面的生成方式切到「动画展示页」。'},
  {k:'url', name:'网址', fields:[{id:'u',label:'网址',ph:'example.com/page'}],
   run:v=>{ const s=(v.u||'').trim(); if(!s) return ''; return /^[a-z][a-z0-9+.-]*:/i.test(s)?s:'https://'+s.replace(/^\/+/,''); },
   hint:'没写 http 的话自动补 https://，扫码后直接打开。'},
  {k:'wifi', name:'WiFi', fields:[
      {id:'ssid',label:'网络名称 SSID',ph:'MyHome'},
      {id:'pass',label:'密码',ph:'留空就是不加密'},
      {id:'enc',label:'加密方式',type:'select',opts:[['WPA','WPA / WPA2 / WPA3'],['WEP','WEP'],['nopass','不加密（开放网络）']]},
      {id:'hid',label:'隐藏网络',type:'check'}],
   run:v=>{ const s=(v.ssid||'').trim(); if(!s) return '';
     const t=v.enc==='nopass'?'nopass':(v.enc||'WPA');
     return 'WIFI:T:'+t+';S:'+wEsc(s)+';'+(t==='nopass'?'':'P:'+wEsc(v.pass||'')+';')+(v.hid?'H:true;':'')+';'; },
   hint:'扫码后手机会直接问「是否连接这个 WiFi」，不用再手打密码。密码里的分号、逗号、冒号、引号会自动转义。'},
  {k:'card', name:'名片', fields:[
      {id:'fn',label:'姓名',ph:'王小岛'},
      {id:'org',label:'公司 / 组织',ph:'小岛工作室'},
      {id:'title',label:'职位',ph:'设计师'},
      {id:'tel',label:'手机',ph:'13800000000'},
      {id:'mail',label:'邮箱',ph:'hi@example.com'},
      {id:'url',label:'主页',ph:'example.com'},
      {id:'note',label:'备注',ph:'随时欢迎来聊'}],
   run:v=>{ const L=['BEGIN:VCARD','VERSION:3.0'];
     const add=(k,x)=>{ if(x&&x.trim()) L.push(k+':'+vEsc(x.trim())); };
     add('FN',v.fn); add('ORG',v.org); add('TITLE',v.title);
     const tel=(v.tel||'').replace(/[^\d+]/g,''); if(tel) L.push('TEL;TYPE=CELL:'+tel);
     add('EMAIL',v.mail); add('URL',v.url); add('NOTE',v.note);
     L.push('END:VCARD'); return L.join('\n'); },
   hint:'标准 vCard 3.0，iOS 和安卓扫完会直接弹「添加到通讯录」。微信内置扫一扫只认网址，扫到名片会显示成一段文本。'},
  {k:'tel', name:'电话', fields:[{id:'n',label:'号码',ph:'+8613800000000'}],
   run:v=>{ const s=(v.n||'').replace(/[^\d+]/g,''); return s?'tel:'+s:''; },
   hint:'扫码后跳到拨号界面，号码填好，不会自动拨出去。'},
  {k:'sms', name:'短信', fields:[{id:'n',label:'号码',ph:'10086'},{id:'body',label:'内容',type:'area',ph:'我想问一下……'}],
   run:v=>{ const s=(v.n||'').replace(/[^\d+]/g,''); return s?'SMSTO:'+s+':'+(v.body||'').replace(/[\r\n]+/g,' '):''; },
   hint:'扫码后打开短信界面，号码和内容都填好。'},
  {k:'mail', name:'邮件', fields:[{id:'to',label:'收件人',ph:'hi@example.com'},{id:'sub',label:'主题',ph:'想聊聊合作'},{id:'body',label:'正文',type:'area',ph:''}],
   run:v=>{ const t=(v.to||'').trim(); if(!t) return ''; const q=[];
     if(v.sub) q.push('subject='+encodeURIComponent(v.sub)); if(v.body) q.push('body='+encodeURIComponent(v.body));
     return 'mailto:'+t+(q.length?'?'+q.join('&'):''); },
   hint:'扫码后打开邮件 App，收件人、主题、正文都填好。'},
  {k:'geo', name:'位置', fields:[{id:'lat',label:'纬度',ph:'39.9163'},{id:'lng',label:'经度',ph:'116.3972'},{id:'nm',label:'地点名',ph:'天安门'}],
   run:v=>{ const la=(v.lat||'').trim(), ln=(v.lng||'').trim(); if(!la||!ln) return '';
     return 'geo:'+la+','+ln+(v.nm?';u='+encodeURIComponent(v.nm):''); },
   hint:'地图类 App 一般能识别 geo:。想让微信里直接点开，就改用「网址」类型填一条高德或百度的分享链接。'},
  {k:'wx', name:'微信名片', fields:[{id:'x',label:'名片链接',ph:'https://u.wechat.com/xxxxxxxx'}],
   run:v=>(v.x||'').trim(),
   hint:'微信里点「我 → 二维码名片」截图，用下面的「识码」把那串链接读出来粘到这里，就能换成自己的风格重画。内容一样，微信照样认这张名片。'},
  {k:'douyin', name:'抖音名片', fields:[
      {id:'paste',label:'粘贴抖音分享文案（会自动拆开填好）',type:'area',
       ph:'zncu 抖音号：34229733091\nhttps://v.douyin.com/xxxxxx/',
       parse:(text,v)=>{
         const hit=[];
         const m1=text.match(/抖音号[:：]\s*([0-9A-Za-z_.-]{4,})/);
         if(m1){ v.id=m1[1]; hit.push('id'); }
         const m2=text.match(/https?:\/\/v\.douyin\.com\/[^\s，,。]+/);
         if(m2){ v.url=m2[0]; hit.push('url'); }
         const first=(text.split('\n')[0]||'').replace(/抖音号[:：].*$/,'').replace(/^【|】$/g,'').trim();
         if(first && first.length<=24 && !/^https?:/.test(first)){ v.name=first; hit.push('name'); }
         return hit;
       }},
      {id:'name',label:'昵称',ph:'zncu'},
      {id:'id',label:'抖音号',ph:'34229733091'},
      {id:'bio',label:'简介',ph:'ai小白，尝试驯服ai中。。。'},
      {id:'url',label:'主页链接（选填）',ph:'https://v.douyin.com/xxxxxx/'},
      {id:'av',label:'头像图片地址（选填，不填就用昵称首字）',ph:'https://.../avatar.jpg'}],
   show:v=>{
     const n=(v.name||'').trim(), id=(v.id||'').trim(), bio=(v.bio||'').trim();
     return {text:[n, id?('抖音号：'+id):'', bio].filter(Boolean).join('\n') || n || '抖音名片',
             link:(v.url||'').trim(), av:(v.av||'').trim()};
   },
   run:v=>{
     const n=(v.name||'').trim(), id=(v.id||'').trim(), bio=(v.bio||'').trim(), u=(v.url||'').trim();
     if(u) return u;
     if(!n && !id) return '';
     return [n, id?('抖音号：'+id):'', bio].filter(Boolean).join('\n');
   },
   hint:'抖音的圆形码是它自己的格式，通用扫码器读不了，只能手填。最快的路子：在抖音里「我的 → 分享 → 复制链接」，把那段文案粘到第一栏，昵称、抖音号、链接会自动填好。填了主页链接，扫码就直接打开你的抖音；卡片上显示的是昵称和抖音号。'},
  {k:'pay', name:'收款码', fields:[{id:'x',label:'收款码内容',ph:'wxp://f2f0… 或 https://qr.alipay.com/…'}],
   run:v=>(v.x||'').trim(),
   hint:'收款码本身就是一串内容，重新画一遍只要内容不变就照样能收钱。金额是平台侧设置的，码里塞不进金额。'},
  {k:'raw', name:'原始内容', fields:[{id:'x',label:'直接写进码里的字符串',type:'area',ph:'随便什么，支持中文和换行'}],
   run:v=>(v.x||''), hint:'扫码器读到的就是这段字符串，不加工。做暗号、做彩蛋用这个。'}
];
const kindDef=()=>KINDS.find(d=>d.k===kind)||KINDS[0];

/* ---- 类型切换 ---- */
const kindsEl=$('kinds'), fieldsEl=$('fields');
function syncKinds(){ for(const b of kindsEl.children) b.setAttribute('aria-checked',String(b.dataset.k===kind)); }
function renderKinds(){
  kindsEl.innerHTML='';
  for(const d of KINDS){
    const b=document.createElement('button'); b.type='button'; b.className='kind'; b.setAttribute('role','radio'); b.dataset.k=d.k;
    b.textContent=d.name; b.setAttribute('aria-checked',String(d.k===kind));
    b.addEventListener('click',()=>{ if(kind===d.k) return; kind=d.k; syncKinds(); renderFields(); textEl.readOnly=kind!=='text'; applyNow(); });
    kindsEl.appendChild(b);
  }
}
function renderFields(){
  fieldsEl.innerHTML='';
  const d=kindDef();
  if(!d.fields && !d.hint){ fieldsEl.hidden=true; return; }
  fieldsEl.hidden=false;
  for(const f of (d.fields||[])){
    if(f.type==='check'){
      const lb=document.createElement('label'); lb.className='check';
      const inp=document.createElement('input'); inp.type='checkbox'; inp.checked=!!vals[f.id];
      inp.addEventListener('change',()=>{ vals[f.id]=inp.checked; applySoon(120); });
      lb.append(inp,document.createTextNode(f.label)); fieldsEl.appendChild(lb); continue;
    }
    const wrap=document.createElement('div'); wrap.className='fh';
    const id='fld_'+d.k+'_'+f.id;
    const lb=document.createElement('label'); lb.textContent=f.label; lb.htmlFor=id; wrap.appendChild(lb);
    let inp;
    if(f.type==='select'){
      inp=document.createElement('select');
      for(const [val,txt] of f.opts){ const o=document.createElement('option'); o.value=val; o.textContent=txt; inp.appendChild(o); }
      if(vals[f.id]) inp.value=vals[f.id];
      inp.addEventListener('change',()=>{ vals[f.id]=inp.value; applySoon(100); });
    } else if(f.type==='area'){
      inp=document.createElement('textarea'); inp.rows=3; inp.placeholder=f.ph||''; inp.value=vals[f.id]||'';
      inp.addEventListener('input',()=>{
        vals[f.id]=inp.value;
        if(f.parse){                        // 粘贴一段分享文案，顺手把其他栏填上
          const hit=f.parse(inp.value, vals)||[];
          for(const key of hit){
            const other=document.getElementById('fld_'+d.k+'_'+key);
            if(other) other.value=vals[key]||'';
          }
        }
        applySoon(220);
      });
    } else {
      inp=document.createElement('input'); inp.type='text'; inp.placeholder=f.ph||''; inp.value=vals[f.id]||'';
      inp.addEventListener('input',()=>{ vals[f.id]=inp.value; applySoon(220); });
    }
    inp.id=id; wrap.appendChild(inp); fieldsEl.appendChild(wrap);
  }
  if(d.hint){ const p=document.createElement('p'); p.className='note'; p.textContent=d.hint; fieldsEl.appendChild(p); }
}
/* ---- 生成内容 → 重建二维码 ---- */
let aTm=0;
function applySoon(ms){ clearTimeout(aTm); aTm=setTimeout(applyNow,ms); }
function rawContent(){ return kind==='text' ? manual : (kindDef().run(vals)||''); }
/* 展示页地址统一从这里出：卡片上展示什么（c）、点开后的小码装什么（l）、头像地址（av）都在这儿定 */
function currentShowUrl(){
  const def=kindDef(), raw=rawContent();
  if(!raw) return '';
  const sp = def.show ? def.show(vals) : {text:raw, link:'', av:''};
  return showcaseUrl({c:sp.text||raw, l:sp.link||'', av:sp.av||'', v:showView, k:kind,
                      s:seasonKey, w:weatherKey, r:treeKey, e:eccKey, h:holeSize});
}
function applyNow(){
  const raw = rawContent();
  if(kind!=='text') textEl.value=raw;
  if(!raw){ curText=''; statusEl.textContent = kind==='text' ? '先写下一句话，种子才会发芽。' : '把上面的内容填一下。'; syncHash(); return; }
  if(outMode==='show'){
    const u = currentShowUrl();
    if(!u){ curText=''; statusEl.textContent='本地 file:// 生成不了展示页地址，先把这一页部署到网上。'; syncHash(); return; }
    curText = u;
  } else {
    curText = raw;
  }
  rebuild(qT===1?'qr':'none');
  syncHash();
}

/* ---- 生成方式：一条内容，两种发法 ---- */
function updateOutNote(){
  const p=$('outNote'); if(!p) return;
  const sb=$('shareBtn'), dl=$('saveQR');
  if(sb) sb.textContent = outMode==='show' ? '复制展示页链接' : '复制分享链接';
  if(dl) dl.textContent = outMode==='show' ? '下载这张码' : '下载二维码';
  const sv=$('showView'); if(sv) sv.hidden = outMode!=='show';
  if(outMode!=='show'){ p.textContent='二维码里装的就是上面的内容，扫码器直接读到它。'; return; }
  const raw = kind==='text' ? manual : (kindDef().run(vals)||'');
  const u = raw ? currentShowUrl() : '';
  if(!u){ p.innerHTML='本地 <code>file://</code> 下没有网站地址。用线上地址打开这一页，或者先把 <b>dist</b> 部署上去。'; return; }
  // 把地址明文摆出来：下面那张码里装的就是它，扫一下打开这个动画页
  p.textContent='下面这张码里装的就是这个地址 —— 扫码打开动画页，点一下变内容：';
  const code=document.createElement('code');
  code.className='sc-url'; code.textContent=u;
  p.appendChild(code);
  const a=document.createElement('a');
  a.href=u; a.target='_blank'; a.rel='noopener'; a.textContent='先看看 →'; a.style.color='var(--moss-deep)';
  p.appendChild(a);
}
function setOutMode(v){
  if(v===outMode) return;
  if(v==='show' && location.protocol==='file:'){
    toast('展示页要一个网站地址。用线上版打开这一页，或者先把 dist 部署上去。');
    return;
  }
  outMode=v;
  const el=$('outMode'); if(el) for(const b of el.children) b.setAttribute('aria-checked',String(b.dataset.v===v));
  updateOutNote(); applyNow();
}
function initOutMode(){
  const el=$('outMode'); if(!el) return;
  el.innerHTML='';
  for(const pair of [['qr','只生成二维码'],['show','生成动画展示页']]){
    const b=document.createElement('button'); b.type='button'; b.dataset.v=pair[0]; b.textContent=pair[1];
    b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(outMode===pair[0]));
    b.addEventListener('click',()=>setOutMode(pair[0]));
    el.appendChild(b);
  }
  updateOutNote();
}
/* 「生成动画展示页」之下的第二层选择：点开后到底是内容卡片，还是一张大码 */
function initShowView(){
  const el=document.createElement('div');
  el.className='outmode sub'; el.id='showView'; el.hidden=true;
  el.setAttribute('role','radiogroup'); el.setAttribute('aria-label','点开后显示什么');
  for(const pair of [['card','点开后：内容卡片'],['qr','点开后：大二维码']]){
    const b=document.createElement('button'); b.type='button'; b.dataset.v=pair[0]; b.textContent=pair[1];
    b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(showView===pair[0]));
    b.addEventListener('click',()=>{
      if(showView===pair[0]) return;
      showView=pair[0];
      for(const x of el.children) x.setAttribute('aria-checked',String(x.dataset.v===pair[0]));
      updateOutNote(); applyNow();
    });
    el.appendChild(b);
  }
  const note=$('outNote');
  if(note && note.parentNode) note.parentNode.insertBefore(el, note);
}

/* ---- 把状态塞进 URL，发出去就是同一张码 ---- */
const b64u=str=>{ const b=QR_ENC.encode(str); let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u=str=>{ const s=atob(str.replace(/-/g,'+').replace(/_/g,'/')); const a=new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return new TextDecoder().decode(a); };
function syncHash(){
  if(showMode) return;
  try{ history.replaceState(null,'','#'+b64u(JSON.stringify({k:kind,t:kind==='text'?manual:(kindDef().run(vals)||''),v:vals,e:eccKey,h:holeSize,s:seasonKey,w:weatherKey,r:treeKey,m:qT===1?'qr':'tree',o:outMode}))); }catch(e){}
}
function readHash(){
  const raw=location.hash.replace(/^#/,''); if(!raw) return false;
  let o; try{ o=JSON.parse(unb64u(raw)); }catch(e){ return false; }
  if(!o||typeof o!=='object') return false;
  if(o.k&&KINDS.some(d=>d.k===o.k)) kind=o.k;
  if(o.v&&typeof o.v==='object') Object.assign(vals,o.v);
  if(o.e&&ECC_ORDER.indexOf(o.e)>=0) eccKey=o.e;
  if(typeof o.h==='number') holeSize=Math.max(0,Math.min(11,o.h|0));
  if(o.s&&SEASONS[o.s]) seasonKey=o.s;
  if(o.w&&WEATHERS[o.w]) weatherKey=o.w;
  if(o.r&&(TREES[o.r]||LANDMARKS[o.r])) treeKey=o.r;
  if(o.m==='qr'||o.m==='tree') bootMode=o.m;
  if(o.o==='show'||o.o==='qr') outMode=o.o;
  if(kind==='text'&&typeof o.t==='string') manual=o.t;
  return true;
}

/* ---- 展示页：把状态压成一条 URL，扫码打开就是全屏舞台 ----
   载荷用紧凑格式「内容~季节~天气~树种~纠错~留白」，比 JSON 短一半，链接发出去没那么吓人。 */
const escShow=s=>String(s).replace(/\\/g,'\\\\').replace(/~/g,'\\~');
function packShow(p){
  const v=[escShow(p.c||''), p.s||'spring', p.w||'sunny', p.r||'sakura', p.e||'M', String(p.h||0), p.k||'text', escShow(p.l||''), escShow(p.av||''), p.v||'card'];
  const d=['', 'spring', 'sunny', 'sakura', 'M', '0', 'text', '', '', 'card'];
  let n=v.length;
  while(n>1 && v[n-1]===d[n-1]) n--;   // 尾巴上的默认值全砍掉，链接能短一截
  return v.slice(0,n).join('~');
}
function unpackShow(str){
  const parts=[]; let cur='';
  for(let i=0;i<str.length;i++){
    const ch=str.charAt(i);
    if(ch==='\\' && i+1<str.length){ cur+=str.charAt(i+1); i++; }
    else if(ch==='~'){ parts.push(cur); cur=''; }
    else cur+=ch;
  }
  parts.push(cur);
  return {c:parts[0]||'', s:parts[1]||'spring', w:parts[2]||'sunny', r:parts[3]||'sakura', e:parts[4]||'M', h:parseInt(parts[5],10)||0,
          k:parts[6]||'text', l:parts[7]||'', av:parts[8]||'', v:parts[9]||'card'};
}
function showcaseUrl(p){
  if(location.protocol==='file:') return '';
  return location.protocol+'//'+location.host+location.pathname+'#v='+b64u(packShow(p));
}
function readShowHash(){
  if(location.hash.indexOf('#v=')!==0) return false;
  try{
    const raw=unb64u(location.hash.slice(3));
    const p = raw.charAt(0)==='{' ? JSON.parse(raw) : unpackShow(raw);   // 老的 JSON 格式也照读
    if(!p || typeof p.c!=='string' || !p.c.trim()) return false;
    showPayload=p; showMode=true;
    if(p.r&&(TREES[p.r]||LANDMARKS[p.r])) treeKey=p.r;
    if(p.s&&SEASONS[p.s]) seasonKey=p.s;
    if(p.w&&WEATHERS[p.w]) weatherKey=p.w;
    if(p.e&&ECC_ORDER.indexOf(p.e)>=0) eccKey=p.e;
    if(typeof p.h==='number') holeSize=Math.max(0,Math.min(11,p.h|0));
    return true;
  }catch(e){ return false; }
}

/* 落定之后浮出来的是一张内容卡片：直接能读，底下挂一个小码给想存下来的人。
   卡片里的文字全部转义——payload 在 URL 里，谁都能改，不能当 HTML 用。 */
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderShowCard(){
  const p = showPayload || {}, raw = p.c || '', k = p.k || 'text';
  const lab = t => '<p class="sc-lab">' + escHtml(t) + '</p>';
  const big = t => '<p class="sc-big">' + escHtml(t) + '</p>';
  const sub = t => '<p class="sc-sub">' + escHtml(t) + '</p>';
  let body;
  if(k === 'wifi'){
    const o = wifiParse(raw.replace(/^WIFI:/i, ''));
    body = lab('WiFi') + big(o.S || '未命名网络') +
      (o.P ? sub('密码 ' + o.P) : '（开放网络）') + (o.H === 'true' ? sub('隐藏网络') : '');
  } else if(k === 'card'){
    const get = n => { const m = raw.match(new RegExp('^' + n + '[^:]*:(.*)$', 'im')); return m ? m[1].trim() : ''; };
    const lines = [get('ORG'), get('TITLE')].filter(Boolean).map(sub).join('');
    const tel = get('TEL'), mail = get('EMAIL');
    body = lab('名片') + big(get('FN') || '未具名') + lines + (tel ? sub(tel) : '') + (mail ? sub(mail) : '');
  } else if(k === 'url'){
    let host = raw;
    try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch(e){ }
    body = lab('网址') + big(host) + sub(raw);
  } else if(k === 'tel'){
    body = lab('电话') + big(raw.replace(/^tel:/i, ''));
  } else if(k === 'sms'){
    const m = raw.match(/^SMSTO:([^:]*):?([\s\S]*)$/i);
    body = lab('短信') + big((m ? m[1] : raw).replace(/[^\d+]/g, '') || raw) + (m && m[2] ? '<p class="sc-text">' + escHtml(m[2]) + '</p>' : '');
  } else if(k === 'mail'){
    body = lab('邮件') + big(raw.replace(/^mailto:/i, '').split('?')[0]);
  } else if(k === 'geo'){
    const m = raw.match(/^geo:([^,]+),([^,;]+)/i);
    body = lab('位置') + big(m ? (m[1] + ', ' + m[2]) : raw);
  } else if(k === 'douyin'){
    const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const name = lines[0] || '抖音';
    const av = p.av
      ? '<img class="sc-avatar" src="' + escHtml(p.av) + '" alt="">'
      : '<div class="sc-avatar">' + escHtml((name[0] || '抖').toUpperCase()) + '</div>';
    body = av + lab('抖音名片') + big(name) + lines.slice(1).map(sub).join('');
  } else if(k === 'wx'){
    body = lab('微信名片') + big('加个微信吧') + sub('点开链接，或长按下面的码');
  } else if(k === 'pay'){
    body = lab('收款码') + big('扫码付款') + sub('长按下面的码');
  } else {
    body = '<p class="sc-text">' + escHtml(raw) + '</p>';
  }
  return '<div class="sc-body">' + body + '</div>' +
    '<div class="sc-mini"><img alt="二维码"><span>' + (p.l ? '扫码打开抖音' : '扫码 / 长按保存') + '</span></div>';
}

let cardEl=null, cardT=0;
function ensureCard(){
  if(cardEl) return cardEl;
  cardEl = document.createElement('div');
  cardEl.className = 'sc-card';
  cardEl.addEventListener('click', e => {
    if(e.target.closest('.sc-mini')) return;    // 点小码不切换，方便长按识别
    if(qT === 1) flipShow();
  });
  document.body.appendChild(cardEl);
  return cardEl;
}
function handleCard(){
  if(!showMode) return;
  const el = ensureCard(); clearTimeout(cardT);
  if(qT === 1){
    const poster = (showPayload.v === 'qr');     // 点开后要一处大码，还是要一张卡片
    el.classList.toggle('poster', poster);
    el.innerHTML = poster ? '<img class="sc-poster" alt="二维码">' : renderShowCard();
    // 大码模式：装的就是这个展示页自己的网址，扫出来又回到这里，可以无限转发
    const target = (showPayload.v === 'qr') ? location.href : (showPayload.l || showPayload.c);
    const c = qrCanvas(target);
    const im = el.querySelector(poster ? '.sc-poster' : '.sc-mini img');
    if(c && im) im.src = c.toDataURL('image/png');
    cardT = setTimeout(()=>{
      if(qT !== 1) return;
      el.classList.add('on');
      document.body.classList.add('qr-on');
    }, 1900);
  } else {
    el.classList.remove('on');
    document.body.classList.remove('qr-on');
  }
}
function flipShow(){ setMode(qT===1?'tree':'qr'); handleCard(); }

function buildShowcase(){
  // 展示页里只有一座岛：轻点切换，拖动转一转，别的什么都没有
  const wrap=document.createElement('div'); wrap.className='sc-wrap';
  wrap.innerHTML='<div class="sc-tip" id="scTip">轻触切换 · 拖动转一转</div>';
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('on'));

  let sx=0, sy=0, down=false, moved=false;
  canvas.addEventListener('pointerdown',e=>{ down=true; moved=false; sx=e.clientX; sy=e.clientY; },{passive:true});
  canvas.addEventListener('pointermove',e=>{
    if(down && !moved && Math.hypot(e.clientX-sx,e.clientY-sy) > 9) moved=true;
  },{passive:true});
  canvas.addEventListener('pointerup',()=>{ if(!down) return; down=false; if(!moved) flipShow(); });
  canvas.addEventListener('pointercancel',()=>{ down=false; });

  const tip=wrap.querySelector('#scTip');
  setTimeout(()=>tip.classList.add('hide'),3800);
  setTimeout(()=>{ if(tip.parentNode) tip.remove(); },5800);
}

/* ---- 纠错等级与中心留白 ---- */
function setEcc(k){
  if(k===eccKey) return; eccKey=k; markChips('eccChips',k);
  if(k!=='Q'&&k!=='H'&&holeSize>0){ holeSize=0; markChips('holeChips','0'); toast('中心留白要靠 Q 或 H 级纠错补回来，帮你关掉了。'); }
  applyNow();
}
function setHole(k){
  const v=parseInt(k,10)||0;
  if(v>0&&eccKey!=='Q'&&eccKey!=='H'){ toast('中心留白要靠纠错补回来，先把上面的纠错调到 Q 或 H。'); return; }
  if(v===holeSize) return;
  holeSize=v; markChips('holeChips',String(v)); applyNow();
}
function initStyleChips(){
  const ECCN={L:'L · 7%',M:'M · 15%',Q:'Q · 25%',H:'H · 30%'};
  for(const k of ECC_ORDER) chip('eccChips',ECCN[k],k,eccKey,setEcc,false);
  for(const [k,t] of [['0','关'],['5','小 5 格'],['7','中 7 格']]) chip('holeChips',t,k,String(holeSize),setHole,false);
}

/* ---- 识码：把别人二维码里的内容读出来 ---- */
function detectKind(raw){
  const s=raw.trim();
  if(/^wxp:\/\//i.test(s)||/^https?:\/\/qr\.alipay\.com/i.test(s)||/^alipays?:\/\//i.test(s)) return 'pay';
  if(/u\.wechat\.com|weixin\.qq\.com\/r\//i.test(s)) return 'wx';
  if(/^WIFI:/i.test(s)) return 'wifi';
  if(/^TEL:/i.test(s)) return 'tel';
  if(/^SMS(TO)?:/i.test(s)) return 'sms';
  if(/^mailto:/i.test(s)) return 'mail';
  if(/^geo:/i.test(s)) return 'geo';
  if(/^https?:\/\//i.test(s)) return 'url';
  return 'raw';
}
function wifiParse(raw){
  const out={}; let cur='';
  for(let p=0;p<raw.length;p++){ const ch=raw[p];
    if(ch==='\\'&&p+1<raw.length){ cur+=raw[p+1]; p++; }
    else if(ch===';'){ const j=cur.indexOf(':'); if(j>=0) out[cur.slice(0,j).toUpperCase()]=cur.slice(j+1); cur=''; }
    else cur+=ch; }
  const j=cur.indexOf(':'); if(j>=0) out[cur.slice(0,j).toUpperCase()]=cur.slice(j+1);
  return out;
}
function applyDecoded(raw){
  const k=detectKind(raw);
  if(k==='wx'||k==='pay'){ vals.x=raw; }
  else if(k==='url'){ vals.u=raw; }
  else if(k==='tel'){ vals.n=raw.replace(/^tel:/i,'').split(';')[0].replace(/[^\d+]/g,''); }
  else if(k==='sms'){ const m=raw.match(/^SMS(?:TO)?:([^:]*):?([\s\S]*)$/i); if(m){ vals.n=(m[1]||'').replace(/[^\d+]/g,''); vals.body=m[2]||''; } }
  else if(k==='mail'){ const m=raw.match(/^mailto:([^?]*)(?:\?([\s\S]*))?$/i);
    if(m){ vals.to=m[1]||''; const q=new URLSearchParams(m[2]||''); vals.sub=q.get('subject')||''; vals.body=q.get('body')||''; } }
  else if(k==='geo'){ const m=raw.match(/^geo:([^,;]+),([^,;]+)/i);
    if(m){ vals.lat=m[1]; vals.lng=m[2]; const u=raw.match(/[;?&]u=([^&;]+)/); if(u) vals.nm=decodeURIComponent(u[1]); } }
  else if(k==='wifi'){ const o=wifiParse(raw.replace(/^WIFI:/i,''));
    vals.ssid=o.S||''; vals.pass=o.P||''; vals.hid=String(o.H||'').toLowerCase()==='true';
    const t=String(o.T||'WPA').toUpperCase();
    vals.enc = t==='NOPASS' ? 'nopass' : (t==='WEP' ? 'WEP' : 'WPA'); }
  else { vals.x=raw; }
  if(k==='raw') manual=raw;
  kind=k; syncKinds(); renderFields(); textEl.readOnly=kind!=='text';
  applyNow();
  toast('读到了 '+raw.length+' 个字符，按「'+kindDef().name+'」填好了');
}
async function qrToBitmap(file){
  if('createImageBitmap' in window){ try{ return await createImageBitmap(file); }catch(e){ } }
  return await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=URL.createObjectURL(file); });
}
async function decodeFile(file){
  const note=$('scanNote'); if(!file) return;
  note.textContent='正在识别…';
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));  // 先把"正在识别"画出来，别让人以为点空了
  try{
    const bmp = await qrToBitmap(file);
    let raw = null, how = '';
    try{
      const res = await qrBrowserDetect(bmp);
      if(res && res.length){ raw = res[0].rawValue || ''; how = '浏览器识别'; }
    }catch(e){ }
    if(!raw){
      const scale = Math.min(1, 1400/Math.max(bmp.width||1, bmp.height||1));
      const w = Math.max(1, Math.round((bmp.width||1)*scale)), h = Math.max(1, Math.round((bmp.height||1)*scale));
      const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
      const cx = cv.getContext('2d', {willReadFrequently:true});
      cx.drawImage(bmp, 0, 0, w, h);
      const im = cx.getImageData(0, 0, w, h);
      const r = qrDecodeImage(im.data, w, h);
      if(r){ raw = r.text; how = '内置解码 v'+r.ver+' / '+r.ecc+' 级'; }
    }
    if(!raw){ note.textContent='这张图里没找到能识别的二维码。尽量用原图、别裁太狠，二维码四周留一点白边最容易认。'; return; }
    note.textContent = '读到（'+how+'）：' + (raw.length>140 ? raw.slice(0,140)+'…' : raw);
    applyDecoded(raw);
  }catch(err){
    note.textContent='读图失败：'+((err&&err.message)||err);
  }
}
function bindScan(){
  const drop=$('drop'), fi=$('qrfile');
  const pick=f=>{ if(f && /^image\//.test(f.type||'image/')) decodeFile(f); };
  ['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }));
  ['dragleave','dragend'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
    pick(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  fi.addEventListener('change',()=>{ pick(fi.files && fi.files[0]); fi.value=''; });
  // 拖到页面任何地方都能读，并给出明确的视觉反馈——之前"没反应"就是缺了这一步
  const hasFiles=e=>{ const t=e.dataTransfer&&e.dataTransfer.types; return t && Array.prototype.indexOf.call(t,'Files')>=0; };
  addEventListener('dragover',e=>{
    if(!hasFiles(e)) return;
    e.preventDefault();
    if(!document.body.classList.contains('dragging-file')) document.body.classList.add('dragging-file');
  });
  addEventListener('dragleave',e=>{ if(!e.relatedTarget) document.body.classList.remove('dragging-file'); });
  addEventListener('drop',e=>{
    document.body.classList.remove('dragging-file');
    if(!hasFiles(e)) return;
    e.preventDefault();
    pick(e.dataTransfer.files && e.dataTransfer.files[0]);
  });
  addEventListener('paste',e=>{
    const items=e.clipboardData&&e.clipboardData.items; if(!items) return;
    for(const it of items){ if(it.type&&it.type.indexOf('image/')===0){ const f=it.getAsFile(); if(f){ decodeFile(f); break; } } }
  });
}
function bindShare(){
  $('shareBtn').addEventListener('click',async()=>{
    let url='', tip='';
    if(outMode==='show'){
      url = curText || '';
      if(!url || url.indexOf('#v=')<0){ toast('先在上面写上内容，展示页地址才生得出来'); return; }
      tip = '展示页链接已复制，朋友打开就是那座小岛';
    } else {
      syncHash();
      url = location.protocol+'//'+location.host+location.pathname+location.search+location.hash;
      tip = location.protocol==='file:' ? '链接已复制。本地打开时它只对你这台电脑有效，部署到网上之后才是能发给别人的链接。' : '链接已复制，谁打开都是同一张码';
    }
    try{ await navigator.clipboard.writeText(url); toast(tip); }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=url; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      let ok=false; try{ ok=document.execCommand('copy'); }catch(_){ }
      ta.remove();
      toast(ok?tip:'复制没成功，地址栏里 # 后面那一串就是分享内容');
    }
  });
}

/* ---- 面板收纳 + 键盘快捷键：调整样式时不用往下滑，岛一直在旁边 ---- */
let panelCollapsed=false;
function initCollapse(){
  const b=document.createElement('button');
  b.type='button'; b.className='collapse-btn'; b.textContent='‹'; b.title='收起面板（[）';
  b.addEventListener('click',toggleCollapse);
  document.body.appendChild(b);
}
function toggleCollapse(){
  panelCollapsed=!panelCollapsed;
  document.body.classList.toggle('collapsed',panelCollapsed);
  const b=document.querySelector('.collapse-btn');
  if(b){ b.textContent=panelCollapsed?'›':'‹'; b.title=(panelCollapsed?'展开':'收起')+'面板（[）'; }
}
const KEY_SEASON={'1':'spring','2':'summer','3':'autumn','4':'winter'};
const KEY_WEATHER={q:'sunny',w:'cloudy',e:'rain',r:'snow',t:'night'};
const KEY_SHAPE={a:'apple',s:'pine',d:'sakura',f:'birch',g:'canton',h:'pearl',j:'temple',k:'pagoda'};
function bindKeys(){
  addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    const t=e.target;
    if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
    if(e.key===' '||e.code==='Space'){ setMode(qT===1?'tree':'qr'); e.preventDefault(); return; }
    if(e.key==='['){ toggleCollapse(); e.preventDefault(); return; }
    const k=e.key.length===1 ? e.key.toLowerCase() : '';
    if(!k) return;
    if(k==='p'){ toggleSpin(); e.preventDefault(); return; }
    if(KEY_SEASON[k]){ setSeason(KEY_SEASON[k]); e.preventDefault(); return; }
    if(KEY_WEATHER[k]){ setWeather(KEY_WEATHER[k]); e.preventDefault(); return; }
    if(KEY_SHAPE[k]){ setTree(KEY_SHAPE[k]); e.preventDefault(); return; }
  });
}
/* 只停小岛的自转，季节、天气、粒子、拖动全都照常 */
function toggleSpin(){
  spinPaused=!spinPaused;
  document.body.classList.toggle('spin-paused',spinPaused);
  toast(spinPaused?'小岛已停止自转（按 P 继续）':'小岛继续转');
}

/* ---- 启动 ---- */
function boot(){
  if(readShowHash()){   // 扫码打开的展示页：全屏小岛 + 点一下变二维码
    manual = showPayload.c; kind = 'text';
    renderKinds(); renderFields(); initStyleChips();
    textEl.readOnly = true; textEl.value = manual;
    stage.dataset.season = seasonKey; stage.dataset.weather = weatherKey;
    markChips('treeChips',treeKey); markChips('landChips',treeKey);
    markChips('seasonChips',seasonKey); markChips('weatherChips',weatherKey);
    curText = manual;
    document.body.classList.add('showcase');
    rebuild('all');
    if(glOK){ setMode('tree'); requestAnimationFrame(frame); }
    else { $('toggle').hidden=true; hint.hidden=true; updateStatus(); }
    buildShowcase();
    return;
  }
  readHash();
  if(!KINDS.some(d=>d.k===kind)) kind='text';
  manual = manual || (textEl.value||'').trim() || '愿你今天也被温柔以待';
  renderKinds(); renderFields(); initStyleChips(); initOutMode(); initShowView();
  textEl.readOnly = kind!=='text';
  stage.dataset.season=seasonKey; stage.dataset.weather=weatherKey;
  markChips('treeChips',treeKey); markChips('landChips',treeKey);
  markChips('seasonChips',seasonKey); markChips('weatherChips',weatherKey);
  curText = kind==='text' ? manual : (kindDef().run(vals)||'');
  textEl.value = curText;
  rebuild('all');
  if(glOK){ setMode(bootMode); requestAnimationFrame(frame); }
  else { $('toggle').hidden=true; hint.hidden=true; addEventListener('resize',()=>{ if(curQR) drawFlat(); }); updateStatus(); }
  bindScan(); bindShare(); bindKeys(); initCollapse();
  textEl.addEventListener('input',()=>{ if(kind!=='text') return; manual=textEl.value; applySoon(320); });
  syncHash();
}
