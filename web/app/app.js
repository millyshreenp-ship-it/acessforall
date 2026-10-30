(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
var root=document.documentElement;

/* ---------- settings ---------- */
var S={mode:'system',ts:100,ls:'1.6',target:'44',motion:false};
var DEF=JSON.parse(JSON.stringify(S));
try{var saved=JSON.parse(localStorage.getItem('afa-settings')||'null');if(saved)Object.keys(S).forEach(function(k){if(k in saved)S[k]=saved[k]})}catch(e){}
function saveS(){try{localStorage.setItem('afa-settings',JSON.stringify(S))}catch(e){}}
var reduced=function(){return S.motion||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)};
function applyS(){
  root.style.setProperty('--ts',String(S.ts/100));
  root.style.setProperty('--lh',String(S.ls));
  root.style.setProperty('--target',S.target+'px');
  root.removeAttribute('data-contrast');
  if(S.mode==='system'){root.removeAttribute('data-theme')}
  else if(S.mode==='high'){root.setAttribute('data-contrast','high');root.removeAttribute('data-theme')}
  else{root.setAttribute('data-theme',S.mode)}
  if(S.motion)root.setAttribute('data-motion','reduce');else root.removeAttribute('data-motion');
  $$('[data-setting]').forEach(function(el){
    var k=el.dataset.setting;
    if(el.type==='radio')el.checked=String(S[k])===el.value;
    else if(el.type==='checkbox')el.checked=!!S[k];
    else el.value=S[k];
  });
  $('#tsOut').textContent=S.ts+'%';
  var modeName={system:'match system',light:'light',dark:'dark',high:'high contrast'}[S.mode];
  $('#curSet').textContent=modeName+', text '+S.ts+'%, targets '+S.target+' px';
  var sq=$('#sqCur');sq.style.width=sq.style.height=S.target+'px';sq.textContent=S.target;
  $('#sqCap').textContent='Your setting: '+S.target+' px';
  requestAnimationFrame(function(){measure();if(window.drawTabs)drawTabs()});
}
$$('[data-setting]').forEach(function(el){
  el.addEventListener('input',function(){
    var k=el.dataset.setting;
    if(el.type==='checkbox')S[k]=el.checked;
    else if(el.type==='radio'){if(!el.checked)return;S[k]=el.value}
    else S[k]=k==='ts'?parseInt(el.value,10):el.value;
    saveS();applyS();
  });
});
$('#setReset').addEventListener('click',function(){S=JSON.parse(JSON.stringify(DEF));saveS();applyS()});
$('#setBtn').addEventListener('click',function(){
  var p=$('#settings'),open=p.hidden;p.hidden=!open;this.setAttribute('aria-expanded',String(open));
  if(open)$('#setH').scrollIntoView({block:'nearest'});
});
$('#openSet').addEventListener('click',function(){
  var p=$('#settings');p.hidden=false;$('#setBtn').setAttribute('aria-expanded','true');
  window.scrollTo(0,0);var f=$('#settings input:checked')||$('#settings input');if(f)f.focus();
});
function measure(){
  $$('[data-measure]').forEach(function(b){
    var r=b.getBoundingClientRect(),o=$('[data-for="'+b.dataset.measure+'"]');
    if(o)o.textContent=Math.round(r.width)+' × '+Math.round(r.height)+' px';
  });
}
window.addEventListener('resize',function(){measure();if(window.drawTabs)drawTabs()});

/* ---------- colour maths ---------- */
var toLin=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
var lum=function(c){return 0.2126*toLin(c.r)+0.7152*toLin(c.g)+0.0722*toLin(c.b)};
var ratio=function(a,b){var l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
function hexToRgb(h){h=String(h).trim().replace('#','');if(h.length===3)h=h.split('').map(function(x){return x+x}).join('');if(!/^[0-9a-f]{6}$/i.test(h))return null;return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}}
var rgbToHex=function(c){return '#'+[c.r,c.g,c.b].map(function(v){return Math.round(v).toString(16).padStart(2,'0')}).join('')};
function passingColor(fg,bg,min){
  var dark={r:0,g:0,b:0},light={r:255,g:255,b:255};
  var target=ratio(dark,bg)>=ratio(light,bg)?dark:light;
  for(var t=0;t<=1.0001;t+=0.01){
    var c={r:fg.r+(target.r-fg.r)*t,g:fg.g+(target.g-fg.g)*t,b:fg.b+(target.b-fg.b)*t};
    if(ratio(c,bg)>=min)return c;
  }
  return target;
}
function cssColor(s){
  var m=String(s).match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,\/]+([\d.]+%?))?\s*\)/);
  if(!m)return null;
  var a=m[4]===undefined?1:(m[4].slice(-1)==='%'?parseFloat(m[4])/100:parseFloat(m[4]));
  return{r:+m[1],g:+m[2],b:+m[3],a:a};
}

/* ---------- demo shop ---------- */
var V=$('#victim');
var svgURI=function(s){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)};
var shoe=function(c,label){return svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150"><rect width="240" height="150" fill="#f1efe9"/><path d="M30 100 C30 70 60 60 90 62 L110 40 C120 36 130 44 134 52 L178 66 C205 72 214 90 214 104 L214 112 L30 112 Z" fill="'+c+'"/><rect x="26" y="108" width="192" height="12" rx="6" fill="#222"/><text x="120" y="140" text-anchor="middle" font-family="Arial" font-size="13" fill="#444">'+label+'</text></svg>')};
var IMG={
  hero:svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff9a5a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient></defs><rect width="640" height="220" fill="url(#g)"/><text x="36" y="96" font-family="Arial Black,Arial" font-weight="900" font-size="56" fill="#fff">SUMMER SALE</text><text x="36" y="150" font-family="Arial" font-weight="700" font-size="32" fill="#fff">40% off all sneakers</text><text x="36" y="188" font-family="Arial" font-size="20" fill="#fff">Ends Sunday</text></svg>'),
  shoe1:shoe('#ff7a3d','Trail Runner 2'),
  shoe2:shoe('#3f7cff','Court Classic')
};
$$('img[data-src]',V).forEach(function(i){i.src=IMG[i.dataset.src]});
var INITIAL=V.innerHTML;
var vis=function(el){return !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)};
var txt=function(el){return (el.textContent||'').replace(/\s+/g,' ').trim()};
var uid=0;

function accName(el){
  var a=el.getAttribute('aria-label');if(a&&a.trim())return a.trim();
  var lb=el.getAttribute('aria-labelledby');
  if(lb){var t=lb.split(' ').map(function(i){return document.getElementById(i)}).filter(Boolean).map(txt).join(' ');if(t)return t}
  if(el.id){var l=V.querySelector('label[for="'+el.id+'"]');if(l&&txt(l))return txt(l)}
  var w=el.closest('label');if(w&&txt(w))return txt(w);
  return '';
}
function bgOf(el){
  var layers=[];
  for(var n=el;n&&n!==V.parentNode;n=n.parentElement){
    var c=cssColor(getComputedStyle(n).backgroundColor);
    if(c&&c.a>0){layers.push(c);if(c.a>=1)break}
  }
  var base={r:255,g:255,b:255};
  for(var i=layers.length-1;i>=0;i--){var c2=layers[i];base={r:c2.r*c2.a+base.r*(1-c2.a),g:c2.g*c2.a+base.g*(1-c2.a),b:c2.b*c2.a+base.b*(1-c2.a)}}
  return base;
}
function contrastIssues(){
  var out=[];
  $$('*',V).forEach(function(el){
    if(/^(SCRIPT|STYLE|IMG|SVG|PATH|INPUT)$/i.test(el.tagName)||!vis(el))return;
    var own=Array.prototype.some.call(el.childNodes,function(n){return n.nodeType===3&&n.textContent.trim()});
    if(!own)return;
    var cs=getComputedStyle(el),fg=cssColor(cs.color);if(!fg)return;
    var px=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight,10)>=700;
    var min=(px>=24||(px>=18.66&&bold))?3:4.5;
    var r=ratio(fg,bgOf(el));
    if(r<min)out.push({el:el,min:min,r:r});
  });
  return out;
}
var VAGUE=/^(click here|here|more|read more|learn more)$/i;
var LM={banner:1,navigation:1,main:1,contentinfo:1};
var INTERACTIVE='a[href],button,input:not([type=hidden]),select,textarea,[role=button],[data-click]';

var CHECKS=[
 {id:'img-alt',group:'visual',sev:'crit',title:'Images missing text alternatives',wcag:'1.1.1',review:true,
  detect:function(){return $$('img:not([alt])',V)},
  fix:function(els){return els.map(function(el){var a=el.dataset.ocr||'Image';el.alt=a;return '<img> alt="'+a+'" (read by OCR)'})}},
 {id:'contrast',group:'visual',sev:'ser',title:'Text contrast below 4.5:1 (3:1 for large text)',wcag:'1.4.3',
  detect:function(){return contrastIssues().map(function(i){return i.el})},
  fix:function(){
    var log=[];
    contrastIssues().forEach(function(i){
      var fg=cssColor(getComputedStyle(i.el).color),bg=bgOf(i.el);
      var n=passingColor(fg,bg,i.min+0.25),before=i.r.toFixed(1);
      i.el.style.color=rgbToHex(n);
      log.push('Text colour on "'+txt(i.el).slice(0,28)+'": '+before+':1 → '+ratio(n,bg).toFixed(1)+':1');
    });
    return log;
  }},
 {id:'label',group:'visual',sev:'ser',title:'Form fields without labels',wcag:'1.3.1',
  detect:function(){return $$('input:not([type=hidden]),select,textarea',V).filter(function(el){return !accName(el)})},
  fix:function(els){return els.map(function(el){
    if(!el.id)el.id='af-f'+(++uid);
    var l=document.createElement('label');l.className='af-label';l.htmlFor=el.id;l.textContent=el.placeholder||'Field';
    el.parentNode.insertBefore(l,el);return 'Added visible label "'+l.textContent+'" to a text field';
  })}},
 {id:'headings',group:'visual',sev:'ser',title:'Visual headings not marked up as headings',wcag:'1.3.1',
  detect:function(){return $$('div,span,p',V).filter(function(el){
    if(!vis(el)||!txt(el)||el.children.length>0)return false;
    var cs=getComputedStyle(el);
    return parseFloat(cs.fontSize)>=24&&parseInt(cs.fontWeight,10)>=600&&!el.closest('h1,h2,h3,h4,h5,h6,[role=heading]');
  })},
  fix:function(els){return els.map(function(el){
    var lvl=parseFloat(getComputedStyle(el).fontSize)>=30?1:2;
    el.setAttribute('role','heading');el.setAttribute('aria-level',String(lvl));
    return '"'+txt(el)+'" is now a level '+lvl+' heading';
  })}},
 {id:'landmarks',group:'visual',sev:'mod',title:'Page regions not marked as landmarks',wcag:'2.4.1',
  detect:function(){return $$('[data-landmark]:not([role])',V)},
  fix:function(els){return els.map(function(el){el.setAttribute('role',el.dataset.landmark);return 'Added role="'+el.dataset.landmark+'" landmark'})}},
 {id:'link-color',group:'visual',sev:'mod',title:'Links told apart by colour alone',wcag:'1.4.1',
  detect:function(){return $$('p a,li a',V).filter(function(a){return getComputedStyle(a).textDecorationLine==='none'})},
  fix:function(els){return els.map(function(a){a.classList.add('af-underline');return 'Underlined link "'+txt(a)+'"'})}},
 {id:'link-purpose',group:'visual',sev:'mod',title:'Vague link text such as "click here"',wcag:'2.4.4',review:true,
  detect:function(){return $$('a[href]',V).filter(function(a){return VAGUE.test(txt(a))&&!a.getAttribute('aria-label')})},
  fix:function(els){return els.map(function(a){var n=a.dataset.context||'Read more';a.setAttribute('aria-label',n);return 'Link "'+txt(a)+'" now named "'+n+'" for screen readers'})}},
 {id:'video',group:'hearing',sev:'crit',title:'Video without captions or a transcript',wcag:'1.2.2',
  detect:function(){return $$('[data-media="video"]:not([data-captions])',V)},
  fix:function(els){return els.map(function(el){
    var t=el.dataset.transcript||'',first=t.split(/\[|\./)[0];
    el.dataset.captions='on';
    var cc=document.createElement('div');cc.className='af-cc';cc.textContent='Captions on · '+first+'.';
    var d=document.createElement('details');d.className='af-tr';d.innerHTML='<summary>Transcript</summary><p>'+esc(t)+'</p>';
    el.insertAdjacentElement('afterend',cc);cc.insertAdjacentElement('afterend',d);
    return 'Added captions strip and transcript under the video';
  })}},
 {id:'contact',group:'hearing',sev:'mod',title:'Support offered by phone only',wcag:'Best practice',
  detect:function(){return $$('[data-contact="phone-only"]',V)},
  fix:function(els){return els.map(function(el){
    el.dataset.contact='multi';
    var h=document.createElement('div');h.className='af-help';
    h.innerHTML='<button type="button">Live chat</button><button type="button">Text us</button><button type="button">Email us</button>';
    el.appendChild(h);return 'Added live chat, text and email support options';
  })}},
 {id:'kbd',group:'motor',sev:'crit',title:'Clickable elements the keyboard cannot reach',wcag:'2.1.1',
  detect:function(){return $$('[data-click]',V).filter(function(el){
    return !(el.matches('button,a[href],input,select,textarea')||(el.hasAttribute('tabindex')&&el.getAttribute('role')));
  })},
  fix:function(els){return els.map(function(el){el.setAttribute('role','button');el.setAttribute('tabindex','0');return '"'+txt(el).slice(0,26)+'" is now a focusable button (Enter and Space work)'})}},
 {id:'focus',group:'motor',sev:'ser',title:'Keyboard focus indicator removed',wcag:'2.4.7',
  detect:function(){
    var nodes=$$('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',V).filter(vis),prev=document.activeElement,bad=[];
    nodes.forEach(function(n){
      try{
        n.focus({preventScroll:true});
        var cs=getComputedStyle(n);
        var o=cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0,s=cs.boxShadow&&cs.boxShadow!=='none';
        if(!o&&!s)bad.push(n);
      }catch(e){}
    });
    if(prev&&prev!==document.body&&prev.focus)prev.focus({preventScroll:true});else if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    return bad;
  },
  fix:function(els){V.classList.add('af-fixed');return ['Added a two-ring focus indicator to '+els.length+' controls']}},
 {id:'timer',group:'motor',sev:'ser',title:'Time limit with no way to pause or extend',wcag:'2.2.1',
  detect:function(){return $$('[data-timer]:not([data-timer-ctl])',V)},
  fix:function(els){return els.map(function(el){
    el.dataset.timerCtl='1';
    var c=document.createElement('div');c.className='af-ctl';
    c.innerHTML='<button type="button">Pause timer</button><button type="button">Add 10 minutes</button><button type="button">Turn off</button>';
    el.insertAdjacentElement('afterend',c);return 'Added pause, extend and turn-off controls for the offer timer';
  })}},
 {id:'size',group:'motor',sev:'mod',title:'Touch targets smaller than 44 × 44 px',wcag:'2.5.8',
  detect:function(){return $$(INTERACTIVE,V).filter(function(el){
    if(!vis(el)||el.closest('p'))return false;
    var r=el.getBoundingClientRect();return r.width<43.5||r.height<43.5;
  })},
  fix:function(els){els.forEach(function(el){el.classList.add('af-target')});return ['Enlarged '+els.length+' targets to at least 44 × 44 px']}}
];
var WT={crit:14,ser:9,mod:4};
var GROUPS=[['visual','For visually impaired users'],['hearing','For hearing-impaired users'],['motor','For motor-impaired users']];
var SEVN={crit:'Critical',ser:'Serious',mod:'Moderate'};
var fixedIds=new Set(),touched={},changeLog=[],lastRes=null,selected=null,scanning=false,hasFixed=false;

function statusOf(r){
  if(r.els.length)return 'issue';
  if(fixedIds.has(r.c.id))return r.c.review?'review':'fixed';
  return 'pass';
}
function clearMarks(){$$('[data-af-flag],[data-af-sel]',V).forEach(function(e){e.removeAttribute('data-af-flag');e.removeAttribute('data-af-sel')})}
function markIssues(){
  clearMarks();
  lastRes.forEach(function(r){r.els.forEach(function(e){e.setAttribute('data-af-flag','')})});
  if(selected)selectFinding(selected,true);
}
function renderReport(){
  var w=0,tot=0,nIssue=0,nFixed=0,nReview=0,nEls=0;
  lastRes.forEach(function(r){
    r.st=statusOf(r);var wt=WT[r.c.sev];tot+=wt;
    if(r.st==='issue'){w+=wt;nIssue++;nEls+=r.els.length}
    else if(r.st==='review'){w+=wt*0.25;nReview++}
    else if(r.st==='fixed')nFixed++;
  });
  var score=Math.round(100-90*w/tot);
  $('#scoreNum').textContent=score;
  $('#scoreFill').style.width=score+'%';
  $('#repState').textContent=hasFixed?'After repair':'Before repair';
  $('#repSummary').textContent=nIssue
    ? nIssue+' of '+CHECKS.length+' checks failing on '+nEls+' elements.'
    : nFixed+' checks fixed automatically, '+nReview+' need a human check.';
  var html='';
  GROUPS.forEach(function(g){
    var rows=lastRes.filter(function(r){return r.c.group===g[0]});
    html+='<div class="fgroup"><h4>'+g[1]+'</h4><ul class="flist">';
    rows.forEach(function(r){
      var n=r.st==='issue'?r.els.length:(touched[r.c.id]||[]).length;
      var meta=r.st==='issue'?n+(n===1?' element':' elements')
        :r.st==='review'?n+' generated, please confirm'
        :r.st==='fixed'?n+' fixed':'No problems';
      var stLabel={issue:'Issue',review:'Review',fixed:'Fixed',pass:'Pass'}[r.st];
      html+='<li><button type="button" class="f" data-id="'+r.c.id+'"'+(selected===r.c.id?' aria-current="true"':'')+'>'
        +'<span class="f-title">'+esc(r.c.title)+'</span>'
        +'<span class="f-meta"><span class="pill '+r.c.sev+'">'+SEVN[r.c.sev]+'</span><span>WCAG '+esc(r.c.wcag)+'</span><span>'+meta+'</span></span>'
        +'<span class="pill '+r.st+'">'+stLabel+'</span></button></li>';
    });
    html+='</ul></div>';
  });
  $('#findings').innerHTML=html;
  var ch=$('#changes');
  ch.hidden=!changeLog.length;
  $('#changesSum').textContent='What changed ('+changeLog.length+')';
  $('#changeList').innerHTML=changeLog.map(function(c){return '<li>'+esc(c)+'</li>'}).join('');
  return {score:score,nIssue:nIssue,nFixed:nFixed,nReview:nReview};
}
function selectFinding(id,keep){
  var r=lastRes&&lastRes.filter(function(x){return x.c.id===id})[0];if(!r)return;
  $$('[data-af-sel]',V).forEach(function(e){e.removeAttribute('data-af-sel')});
  selected=id;
  var els=r.els.length?r.els:(touched[id]||[]);
  els=els.filter(function(e){return V.contains(e)});
  els.forEach(function(e){e.setAttribute('data-af-sel','')});
  $$('.f',$('#findings')).forEach(function(b){if(b.dataset.id===id)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
  if(keep||!els.length)return;
  setTab('page');
  var sc=$('#vScroll'),a=els[0].getBoundingClientRect(),b=sc.getBoundingClientRect();
  sc.scrollTop+=a.top-b.top-b.height/3;
}
$('#findings').addEventListener('click',function(e){var b=e.target.closest('.f');if(b)selectFinding(b.dataset.id)});

/* tab order overlay + counts */
var tabsOn=false;
function focusables(){return $$('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]',V).filter(function(el){return vis(el)&&!el.disabled&&el.tabIndex>=0})}
window.drawTabs=function(){
  var layer=$('#tabLayer');layer.innerHTML='';
  var f=focusables(),all=$$(INTERACTIVE+',summary',V).filter(vis).length;
  $('#tabCount').textContent='Tab reaches '+f.length+' of '+all+' interactive elements';
  if(!tabsOn||$('#pane-page').hidden)return;
  var base=$('#vContent').getBoundingClientRect();
  f.forEach(function(el,i){
    var r=el.getBoundingClientRect(),b=document.createElement('span');b.className='tb';b.textContent=i+1;
    b.style.left=Math.max(0,r.left-base.left-8)+'px';b.style.top=Math.max(0,r.top-base.top-8)+'px';layer.appendChild(b);
  });
};
$('#btnTabs').addEventListener('click',function(){
  tabsOn=!tabsOn;this.setAttribute('aria-pressed',String(tabsOn));this.textContent=tabsOn?'Hide tab order':'Show tab order';setTab('page');drawTabs();
});

/* screen reader view */
function srItems(){
  var out=[];
  function inline(n){var s='';n.childNodes.forEach(function(c){if(c.nodeType===3)s+=c.textContent;else if(c.nodeType===1)s+=c.tagName==='A'?txt(c)+' (link)':c.textContent});return s.replace(/\s+/g,' ').trim()}
  function walk(el){
    if(!(el instanceof Element)||!vis(el))return;
    var tag=el.tagName.toLowerCase(),role=el.getAttribute('role');
    if(role&&LM[role])out.push({k:'Landmark',t:role});
    if(/^h[1-6]$/.test(tag)||role==='heading'){out.push({k:'Heading '+(role==='heading'?(el.getAttribute('aria-level')||2):tag[1]),t:txt(el)});return}
    if(tag==='img'){var a=el.getAttribute('alt');out.push(a!==null?{k:'Image',t:a||'decorative'}:{k:'Graphic',t:'unlabelled',bad:'No text alternative. The user hears only "graphic".'});return}
    if(tag==='label')return;
    if(tag==='input'||tag==='select'||tag==='textarea'){var n=accName(el);out.push({k:'Edit text',t:n||'blank',bad:n?'':'No label. The user hears "edit text, blank".'});return}
    if(el.dataset.media==='video'){var cap=el.dataset.captions;out.push({k:'Video',t:txt(el),bad:cap?'':'No captions and no transcript.'});if(!(role==='button')){}return}
    if(tag==='button'||role==='button'){out.push({k:'Button',t:el.getAttribute('aria-label')||txt(el)});return}
    if(tag==='a'&&el.hasAttribute('href')){out.push({k:'Link',t:el.getAttribute('aria-label')||txt(el),bad:VAGUE.test(txt(el))&&!el.getAttribute('aria-label')?'Link text means nothing out of context.':''});return}
    if(tag==='summary'){out.push({k:'Expandable',t:txt(el)});return}
    if(el.hasAttribute('data-click')&&!role){out.push({k:'Text',t:txt(el),bad:'Looks like a button but is announced as plain text, and Tab skips it.'});return}
    if(tag==='p'){out.push({k:'Text',t:inline(el)});return}
    if(!el.children.length){if(txt(el))out.push({k:'Text',t:txt(el)});return}
    var kids=Array.prototype.slice.call(el.childNodes);
    kids.forEach(function(c){
      if(c.nodeType===3){var s=c.textContent.trim();if(s)out.push({k:'Text',t:s})}
      else walk(c);
    });
  }
  Array.prototype.forEach.call(V.children,walk);
  return out;
}
function renderSR(){
  var items=srItems();
  $('#srList').innerHTML=items.map(function(i){
    return '<li class="sr-row'+(i.bad?' bad':'')+'"><span class="sr-k">'+esc(i.k)+'</span><span class="sr-t">'+esc(i.t)+(i.bad?'<em>Problem: '+esc(i.bad)+'</em>':'')+'</span></li>';
  }).join('');
  return items;
}
var speaking=false;
if(!('speechSynthesis' in window))$('#srSpeak').hidden=true;
$('#srSpeak').addEventListener('click',function(){
  var btn=this;
  try{
    if(speaking){speechSynthesis.cancel();speaking=false;btn.textContent='Read aloud';return}
    var items=srItems().slice(0,40),u=new SpeechSynthesisUtterance(items.map(function(i){return i.k+', '+i.t}).join('. '));
    u.onend=u.onerror=function(){speaking=false;btn.textContent='Read aloud'};
    speaking=true;btn.textContent='Stop reading';speechSynthesis.speak(u);
  }catch(e){speaking=false}
});

/* tabs */
function setTab(name){
  var page=name==='page';
  $('#tab-page').setAttribute('aria-selected',String(page));$('#tab-page').tabIndex=page?0:-1;
  $('#tab-sr').setAttribute('aria-selected',String(!page));$('#tab-sr').tabIndex=page?-1:0;
  $('#pane-page').hidden=!page;$('#pane-sr').hidden=page;
  if(!page)renderSR();else drawTabs();
}
$('#tab-page').addEventListener('click',function(){setTab('page')});
$('#tab-sr').addEventListener('click',function(){setTab('sr')});
$('.tabs').addEventListener('keydown',function(e){
  var k=e.key;if(!/^(ArrowLeft|ArrowRight|Home|End)$/.test(k))return;
  e.preventDefault();var to=(k==='ArrowRight'||k==='End')?'sr':'page';
  if(k==='ArrowLeft'||k==='ArrowRight'){to=$('#tab-page').getAttribute('aria-selected')==='true'?'sr':'page'}
  setTab(to);$('#tab-'+to).focus();
});

/* axe-core cross-check */
var axeChain=Promise.resolve();
function runAxe(){
  var line=$('#axeLine');
  if(!window.axe){line.textContent='axe-core did not load in this view. The built-in rules above still ran.';return}
  line.textContent='Cross-checking with axe-core…';
  axeChain=axeChain.then(function(){
    return axe.run(V,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']},resultTypes:['violations']});
  }).then(function(r){
    var nodes=r.violations.reduce(function(n,v){return n+v.nodes.length},0);
    var ids=r.violations.map(function(v){return v.id});
    line.innerHTML='axe-core '+esc(axe.version)+' reports '+r.violations.length+' rule violations on '+nodes+' elements'+(ids.length?': <code>'+ids.map(esc).join(', ')+'</code>':'.');
  }).catch(function(){line.textContent='axe-core could not finish on this page.'});
}

/* scan + fix + reset */
function setStatus(t){$('#demoStatus').textContent=t}
async function runScan(instant){
  if(scanning)return;scanning=true;
  setTab('page');clearMarks();
  var res=[],prev=document.activeElement;
  for(var i=0;i<CHECKS.length;i++){
    if(!instant&&!reduced()){$('#scoreFill').style.width=Math.round((i+1)/CHECKS.length*40)+'%';await sleep(60)}
    var els=[];try{els=CHECKS[i].detect()}catch(e){console.error(CHECKS[i].id,e)}
    res.push({c:CHECKS[i],els:els});
  }
  lastRes=res;
  if(prev&&prev!==document.body&&prev.focus)prev.focus({preventScroll:true});
  var sum=renderReport();markIssues();drawTabs();
  if($('#pane-sr').hidden===false)renderSR();
  runAxe();scanning=false;
  return sum;
}
async function runFix(){
  if(!lastRes)await runScan(true);
  var n=0;
  CHECKS.forEach(function(c){
    var els=[];try{els=c.detect()}catch(e){}
    if(!els.length)return;
    var logs=c.fix(els)||[];logs.forEach(function(m){changeLog.push(m)});
    fixedIds.add(c.id);touched[c.id]=(touched[c.id]||[]).concat(els);n+=els.length;
  });
  hasFixed=true;
  var sum=await runScan(true);
  setStatus('Accessible version generated: '+n+' elements repaired, '+sum.nReview+' checks need your review. Score '+sum.score+' out of 100. Press Tab to try the shop with the keyboard.');
}
async function runReset(){
  V.innerHTML=INITIAL;V.className='v';
  $$('img[data-src]',V).forEach(function(i){i.src=IMG[i.dataset.src]});
  fixedIds=new Set();touched={};changeLog=[];selected=null;hasFixed=false;lastRes=null;
  $('#vEvent').textContent='Last action in the shop: none yet.';
  var s=await runScan(true);
  setStatus('Demo reset. '+s.nIssue+' of '+CHECKS.length+' checks failing.');
}
$('#btnFix').addEventListener('click',runFix);
$('#btnScan').addEventListener('click',async function(){setStatus('Scanning…');var s=await runScan(false);setStatus('Scan complete. '+(s.nIssue?s.nIssue+' checks failing. Score '+s.score+'.':'No failing checks. Score '+s.score+'.'))});
$('#btnReset').addEventListener('click',runReset);
/* shop behaviour */
V.addEventListener('click',function(e){
  var a=e.target.closest('a[href="#"]');if(a)e.preventDefault();
  var c=e.target.closest('[data-click]');
  if(c)$('#vEvent').textContent='Last action in the shop: "'+txt(c).slice(0,30)+'" activated'+(e.detail===0?' with the keyboard.':'.');
  var b=e.target.closest('.af-help button,.af-ctl button');
  if(b)$('#vEvent').textContent='Last action in the shop: "'+txt(b)+'" activated'+(e.detail===0?' with the keyboard.':'.');
});
V.addEventListener('keydown',function(e){
  var t=e.target;
  if(t.hasAttribute&&t.hasAttribute('data-click')&&t.getAttribute('role')==='button'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click()}
});

/* ---------- visual section ---------- */
function ccRender(){
  var f=hexToRgb($('#fgHex').value),b=hexToRgb($('#bgHex').value);
  if(!f||!b){$('#ccRatio').textContent='Enter a 6-digit hex colour';return}
  var r=ratio(f,b);
  $('#ccRatio').textContent=r.toFixed(2)+':1';
  $('#ccPrev').style.background=rgbToHex(b);$('#ccPrev').style.color=rgbToHex(f);
  var rows=[['Normal text, AA',4.5],['Large text, AA',3],['Normal text, AAA',7],['Large text, AAA',4.5],['UI parts and graphics',3]];
  $('#ccRows').innerHTML=rows.map(function(x){var ok=r>=x[1];return '<tr><td>'+x[0]+'</td><td>'+x[1]+':1</td><td class="'+(ok?'res-pass':'res-fail')+'">'+(ok?'✓ Pass':'✗ Fail')+'</td></tr>'}).join('');
  var sug=$('#ccSug');
  if(r<4.5){
    var n=passingColor(f,b,4.5),h=rgbToHex(n);
    sug.hidden=false;
    sug.innerHTML='<span><i style="background:'+h+'"></i> Nearest text colour that passes AA: <code>'+h+'</code> ('+ratio(n,b).toFixed(2)+':1)</span><button class="btn small" type="button" id="ccUse">Use it</button>';
    $('#ccUse').onclick=function(){$('#fgHex').value=h;$('#fg').value=h;ccRender()};
  }else sug.hidden=true;
}
function pairUp(c,h){
  c.addEventListener('input',function(){h.value=c.value;ccRender()});
  h.addEventListener('input',function(){var v=h.value.trim();if(v[0]!=='#')v='#'+v;if(hexToRgb(v)){c.value=rgbToHex(hexToRgb(v))}ccRender()});
}
pairUp($('#fg'),$('#fgHex'));pairUp($('#bg'),$('#bgHex'));
$('#ccSwap').addEventListener('click',function(){
  var a=$('#fgHex').value;$('#fgHex').value=$('#bgHex').value;$('#bgHex').value=a;
  var f=hexToRgb($('#fgHex').value),b=hexToRgb($('#bgHex').value);if(f)$('#fg').value=rgbToHex(f);if(b)$('#bg').value=rgbToHex(b);ccRender();
});
$('#sampleScale').addEventListener('input',function(){
  var v=this.value;$('#sampleOut').textContent=v+'%';$('#sample').style.fontSize=(v/100)+'rem';
});
$('#applyScale').addEventListener('click',function(){S.ts=parseInt($('#sampleScale').value,10);saveS();applyS()});
function buildOutline(){
  var els=$$('body header,body nav,body main,body footer,h1,h2,h3').filter(function(e){return !e.closest('.frame')});
  var rname={HEADER:'banner',NAV:'navigation',MAIN:'main',FOOTER:'contentinfo'};
  $('#outline').innerHTML=els.map(function(e){
    var t=e.tagName,isH=/^H[1-3]$/.test(t);
    var label=isH?'Heading '+t[1]:'Landmark';
    var name=isH?txt(e):(e.getAttribute('aria-label')||rname[t]);
    return '<li style="--lvl:'+(isH?parseInt(t[1],10)-1:0)+'"><span class="o-role">'+label+'</span><span>'+esc(name)+'</span></li>';
  }).join('');
}

/* ---------- hearing section ---------- */
var CAP=[
 {t:0,d:3,s:'Maya',x:'Welcome to AccessForAll. Let’s scan a page together.'},
 {t:3,d:2.5,cue:1,x:'[soft keyboard typing]'},
 {t:5.5,d:4,s:'Maya',x:'First, we paste the address of the shop. The scan takes about ten seconds.'},
 {t:9.5,d:2.5,cue:1,x:'[a bell rings: scan complete]'},
 {t:12,d:5,s:'Maya',x:'The report lists every problem. Three are critical, so we fix those first.'},
 {t:17,d:5,s:'Maya',x:'One click makes an accessible version, and every change is listed so you can review it.'},
 {t:22,d:3,s:'Jonas',x:'And it works with the keyboard alone?'},
 {t:25,d:3,s:'Maya',x:'Yes. Press Tab to try it.'}
];
var DUR=28,ct=0,cPlaying=false,cTimer=null,cLast=0;
var fmt=function(s){s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
$('#trans').innerHTML=CAP.map(function(l,i){
  return '<li><button type="button" class="tl'+(l.cue?' cue':'')+'" data-i="'+i+'"><time>'+fmt(l.t)+'</time><span>'+(l.s?'<strong>'+l.s+':</strong> ':'')+esc(l.x)+'</span></button></li>';
}).join('');
function cRender(){
  var active=-1;
  CAP.forEach(function(l,i){if(ct>=l.t&&ct<l.t+l.d)active=i});
  var cap=$('#cap'),on=$('#cOn').checked,l=CAP[active];
  cap.textContent=(on&&l)?(l.s?l.s+': ':'')+l.x:'';
  cap.style.fontSize=$('#cSize').value+'rem';cap.className='cap'+($('#cBg').value==='tr'?' tr':'');
  $('#stage').classList.toggle('cue',!!(l&&l.cue));$('#stage').classList.toggle('on',cPlaying);
  $('#cSeek').value=ct;$('#cTime').textContent=fmt(ct)+' / '+fmt(DUR);
  $$('.tl',$('#trans')).forEach(function(b,i){if(i===active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
}
function cStop(){cPlaying=false;clearInterval(cTimer);$('#cPlay').textContent='Play demo';cRender()}
function cStart(){
  if(ct>=DUR)ct=0;cPlaying=true;cLast=performance.now();$('#cPlay').textContent='Pause demo';
  clearInterval(cTimer);cTimer=setInterval(function(){var n=performance.now();ct+=(n-cLast)/1000;cLast=n;if(ct>=DUR){ct=DUR;cStop()}else cRender()},100);cRender();
}
$('#cPlay').addEventListener('click',function(){cPlaying?cStop():cStart()});
$('#cSeek').addEventListener('input',function(){ct=parseFloat(this.value);cLast=performance.now();cRender()});
['#cOn','#cSize','#cBg'].forEach(function(s){$(s).addEventListener('input',cRender)});
$('#trans').addEventListener('click',function(e){var b=e.target.closest('.tl');if(!b)return;ct=CAP[+b.dataset.i].t;cLast=performance.now();cRender()});

var CM={chat:null,sms:['Mobile number','tel'],email:['Email address','email'],video:['Preferred time slot','text']};
var CMN={chat:'live chat',sms:'text message',email:'email',video:'video call with an interpreter'};
function ctSync(){
  var m=$('input[name="cm"]:checked').value,d=CM[m];
  $('#ctDetailWrap').hidden=!d;
  if(d){$('#ctDetailL').textContent=d[0];$('#ctDetail').type=d[1]==='text'?'text':d[1];}
}
$$('input[name="cm"]').forEach(function(r){r.addEventListener('change',ctSync)});
ctSync();
$('#ctForm').addEventListener('submit',function(e){
  e.preventDefault();var m=$('input[name="cm"]:checked').value;
  $('#ctStatus').textContent='Thanks. We would reply by '+CMN[m]+'. This is a demo, so nothing was sent.';
});

var SUB=[['at your earliest convenience','soon'],['will be required to','must'],['in order to','to'],['prior to','before'],['is unable to','can’t'],['are unable to','can’t'],['unable to','can’t'],['authentication procedure','sign-in'],['utilization','use'],['utilise','use'],['utilize','use'],['facilitate','help with'],['commence','start'],['subsequently','then'],['endeavour','try'],['necessary','needed'],['documentation','documents'],['credentials','details'],['verification','check'],['approximately','about'],['additional','more'],['assistance','help'],['requirements','needs'],['requirement','need'],['procedure','steps'],['purchase','buy'],['terminate','end'],['obtain','get']];
function syl(w){w=w.toLowerCase().replace(/[^a-z]/g,'');if(!w)return 0;if(w.length<=3)return 1;w=w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').replace(/^y/,'');var m=w.match(/[aeiouy]{1,2}/g);return m?m.length:1}
function readability(t){
  var sents=t.split(/(?<=[.!?])\s+/).filter(function(s){return s.trim()});
  var words=(t.match(/[A-Za-z’']+/g)||[]);
  if(!sents.length||!words.length)return null;
  var sy=words.reduce(function(n,w){return n+syl(w)},0);
  var ease=206.835-1.015*(words.length/sents.length)-84.6*(sy/words.length);
  var label=ease>=70?'Easy':ease>=60?'Plain English':ease>=50?'Fairly difficult':ease>=30?'Difficult':'Very difficult';
  return{sents:sents,words:words.length,avg:words.length/sents.length,ease:Math.max(0,Math.min(100,ease)),label:label};
}
function plRender(){
  var t=$('#plIn').value,r=readability(t);
  if(!r){$('#plStat').innerHTML='';$('#plHints').innerHTML='<li>Type or paste some text.</li>';return}
  $('#plStat').innerHTML='<div><b>'+Math.round(r.ease)+'</b><span>Reading ease, '+r.label+'</span></div><div><b>'+r.avg.toFixed(1)+'</b><span>Words per sentence</span></div><div><b>'+r.words+'</b><span>Words</span></div>';
  var hints=[],low=t.toLowerCase();
  r.sents.forEach(function(s){var n=(s.match(/[A-Za-z’']+/g)||[]).length;if(n>20)hints.push('Long sentence ('+n+' words): "'+s.slice(0,48)+'…"')});
  var found=SUB.filter(function(x){return low.indexOf(x[0])>-1}).map(function(x){return '“'+x[0]+'” → “'+x[1]+'”'});
  if(found.length)hints.push('Simpler words: '+found.join(', '));
  $('#plHints').innerHTML=(hints.length?hints:['No long sentences or hard words found.']).map(function(h){return '<li>'+esc(h)+'</li>'}).join('');
}
$('#plIn').addEventListener('input',plRender);
$('#plFix').addEventListener('click',function(){
  var t=$('#plIn').value;
  SUB.forEach(function(x){
    var re=new RegExp('\\b'+x[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi');
    t=t.replace(re,function(m){return m[0]===m[0].toUpperCase()?x[1][0].toUpperCase()+x[1].slice(1):x[1]});
  });
  $('#plOut').value=t;$('#plOutWrap').hidden=false;
  var a=readability($('#plIn').value),b=readability(t);
  $('#plOutNote').textContent=a&&b?'Reading ease '+Math.round(a.ease)+' → '+Math.round(b.ease)+'. Swaps are word-level, so read the result before using it.':'';
});

/* ---------- motor section ---------- */
var tb=$('#tb'),tbs=$$('button',tb);
tbs.forEach(function(b,i){b.tabIndex=i===0?0:-1});
tb.addEventListener('keydown',function(e){
  var i=tbs.indexOf(document.activeElement);if(i<0)return;
  var n=null;
  if(e.key==='ArrowRight')n=(i+1)%tbs.length;
  else if(e.key==='ArrowLeft')n=(i-1+tbs.length)%tbs.length;
  else if(e.key==='Home')n=0;else if(e.key==='End')n=tbs.length-1;
  if(n!==null){e.preventDefault();tbs[i].tabIndex=-1;tbs[n].tabIndex=0;tbs[n].focus()}
});
tb.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));
  var s=$('#fmtSample').style,pr=function(k){var x=tb.querySelector('[data-fmt="'+k+'"]');return x.getAttribute('aria-pressed')==='true'};
  s.fontWeight=pr('b')?'700':'400';s.fontStyle=pr('i')?'italic':'normal';s.textDecoration=pr('u')?'underline':'none';s.fontSize=pr('l')?'1.5rem':'1rem';
  s.background=pr('h')?'var(--focus)':'var(--bg)';s.color=pr('h')?'#000':'var(--fg)';
});
$('#kbdCard').addEventListener('keydown',function(e){
  var el=document.activeElement,name=el&&(el.getAttribute('aria-label')||txt(el)||el.tagName.toLowerCase());
  $('#lastKey').textContent=(e.key===' '?'Space':e.key)+(name?' on "'+String(name).slice(0,24)+'"':'');
});

var tm={rem:120,state:'idle',warned:false,iv:null};
function tmShow(){$('#tmOut').textContent=tm.state==='off'?'No limit':fmt(tm.rem)}
function tmSay(t){$('#tmStatus').textContent=t}
function tmEnd(){clearInterval(tm.iv);tm.state='expired';tmShow();$('#tmWarn').hidden=true;tmSay('Time ran out, but nothing was lost. Your cart is saved. Start a new session when you are ready.')}
function tmTick(){
  if(tm.state!=='run')return;
  tm.rem--;tmShow();
  if(tm.rem===20&&!tm.warned){tm.warned=true;var w=$('#tmWarn');w.hidden=false;w.textContent='Your session ends in 20 seconds. Use “Add 5 minutes” to keep going.'}
  if(tm.rem<=0)tmEnd();
}
$('#tmStart').addEventListener('click',function(){
  clearInterval(tm.iv);tm.rem=120;tm.state='run';tm.warned=false;$('#tmWarn').hidden=true;$('#tmPause').textContent='Pause';
  tmShow();tm.iv=setInterval(tmTick,1000);tmSay('Session started with 2 minutes. You can pause, add time or turn the limit off.');
});
$('#tmPause').addEventListener('click',function(){
  if(tm.state==='run'){tm.state='pause';this.textContent='Resume';tmSay('Paused. The clock is stopped.')}
  else if(tm.state==='pause'){tm.state='run';this.textContent='Pause';tmSay('Resumed.')}
  else tmSay('Start a session first.');
});
$('#tmAdd').addEventListener('click',function(){
  if(tm.state==='idle'||tm.state==='expired'){tmSay('Start a session first.');return}
  tm.rem+=300;tm.warned=false;$('#tmWarn').hidden=true;tmShow();tmSay('Added 5 minutes. '+fmt(tm.rem)+' remaining.');
});
$('#tmOff').addEventListener('click',function(){
  clearInterval(tm.iv);tm.state='off';$('#tmWarn').hidden=true;tmShow();tmSay('Time limit turned off. Take as long as you need.');
});
tmShow();

var TYPO={'gmial.com':'gmail.com','gamil.com':'gmail.com','gmail.con':'gmail.com','gmai.com':'gmail.com','yaho.com':'yahoo.com','yahooo.com':'yahoo.com','hotnail.com':'hotmail.com','outlok.com':'outlook.com'};
var EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function setErr(id,msg){
  var p=$('#e-'+id),inp=$('#f'+id[0].toUpperCase()+id.slice(1));
  p.textContent=msg||'';p.hidden=!msg;if(msg)inp.setAttribute('aria-invalid','true');else inp.removeAttribute('aria-invalid');
}
function chkName(){var v=$('#fName').value.trim();var m=v?'':'Enter your full name so we can address the delivery.';setErr('name',m);return m?['name',m]:null}
function chkEmail(){
  var v=$('#fEmail').value.trim(),m='',sug=$('#sug');sug.hidden=true;
  if(!v)m='Enter your email so we can send the confirmation.';
  else if(!EMAIL.test(v))m='This email looks incomplete. Use the form name@example.com.';
  else{
    var parts=v.split('@'),dom=parts[1].toLowerCase();
    if(TYPO[dom]){
      var fix=parts[0]+'@'+TYPO[dom];sug.hidden=false;
      sug.innerHTML='Did you mean <strong>'+esc(fix)+'</strong>? <button type="button" class="btn small" id="useSug">Use this address</button>';
      $('#useSug').onclick=function(){$('#fEmail').value=fix;sug.hidden=true;setErr('email','');$('#fEmail').focus()};
    }
  }
  setErr('email',m);return m?['email',m]:null;
}
function chkPhone(){
  var v=$('#fPhone').value.trim(),m='';
  if(v){var d=v.replace(/\D/g,'');if(!/^[\d\s()+\-.]+$/.test(v)||d.length<7||d.length>15)m='Use 7 to 15 digits. Spaces and dashes are fine, for example 555 010 2030.'}
  setErr('phone',m);return m?['phone',m]:null;
}
$('#fName').addEventListener('blur',chkName);$('#fEmail').addEventListener('blur',chkEmail);$('#fPhone').addEventListener('blur',chkPhone);
$('#fm').addEventListener('submit',function(e){
  e.preventDefault();
  var errs=[chkName(),chkEmail(),chkPhone()].filter(Boolean),sum=$('#errSum');
  if(errs.length){
    sum.hidden=false;
    sum.innerHTML='<strong>Fix '+errs.length+(errs.length===1?' thing':' things')+' to continue</strong><ul>'+errs.map(function(x){return '<li><a href="#f'+x[0][0].toUpperCase()+x[0].slice(1)+'" data-f="'+x[0]+'">'+esc(x[1])+'</a></li>'}).join('')+'</ul>';
    sum.focus();return;
  }
  sum.hidden=true;$('#fm').hidden=true;
  var ok=$('#fmOk');ok.hidden=false;ok.textContent='Thanks, '+$('#fName').value.trim().split(' ')[0]+'. A confirmation is on its way to '+$('#fEmail').value.trim()+'. This is a demo, so nothing was sent.';ok.focus();
});
$('#errSum').addEventListener('click',function(e){
  var a=e.target.closest('a[data-f]');if(!a)return;e.preventDefault();
  var id='f'+a.dataset.f[0].toUpperCase()+a.dataset.f.slice(1);$('#'+id).focus();
});

/* ---------- boot ---------- */
buildOutline();ccRender();plRender();cRender();applyS();
runScan(true).then(function(s){if(s)setStatus('Scan complete. '+s.nIssue+' of '+CHECKS.length+' checks failing. Score '+s.score+' out of 100.')});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){measure();drawTabs()});
})();
