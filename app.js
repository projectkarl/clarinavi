/* Self-contained lightweight chart compatibility layer */
(()=>{
  if(window.LightweightCharts)return;
  const DPR=()=>Math.min(2,window.devicePixelRatio||1);
  const typeKey=t=>String(t||'line');
  const timeKey=t=>typeof t==='number'?t:String(t??'');
  const valueOf=(row,type)=>{
    if(type==='candlestick')return [row.low,row.high,row.open,row.close].filter(Number.isFinite);
    const v=Number(row?.value); return Number.isFinite(v)?[v]:[];
  };
  function createChart(host,options={}){
    if(!host)return null;
    host.innerHTML='';
    host.style.position=host.style.position||'relative';
    const root=document.createElement('div');root.className='lc-lite-root';
    const canvas=document.createElement('canvas');root.appendChild(canvas);host.appendChild(root);
    const ctx=canvas.getContext('2d');
    const state={host,root,canvas,ctx,options:{...options},series:[],paneHeights:new Map(),cross:[],removed:false,markers:new Map()};
    function size(){
      const cssW=Math.max(260,Number(state.options.width)||host.clientWidth||600);
      const cssH=Math.max(160,Number(state.options.height)||host.clientHeight||420);
      const d=DPR();canvas.width=Math.round(cssW*d);canvas.height=Math.round(cssH*d);canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';ctx.setTransform(d,0,0,d,0,0);return{w:cssW,h:cssH};
    }
    function paneLayout(h){
      const count=Math.max(1,...state.series.map(s=>s.pane+1));
      const raw=Array.from({length:count},(_,i)=>state.paneHeights.get(i)||0);
      const explicit=raw.reduce((a,b)=>a+b,0),remain=Math.max(0,h-explicit),auto=raw.filter(v=>!v).length||1;
      let y=0;return raw.map(v=>{const hh=v||remain/auto||h/count;const r={y,h:hh};y+=hh;return r});
    }
    function allTimes(){
      const set=new Map();
      for(const s of state.series)for(const r of s.data||[])set.set(String(timeKey(r.time)),r.time);
      return [...set.values()].sort((a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b)));
    }
    function render(){
      if(state.removed)return;
      const {w,h}=size(), panes=paneLayout(h), times=allTimes(), index=new Map(times.map((t,i)=>[String(timeKey(t)),i]));
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle=state.options?.layout?.background?.color||'transparent'; if(ctx.fillStyle!=='transparent')ctx.fillRect(0,0,w,h);
      const left=8,right=8,topPad=8,bottomPad=10;
      panes.forEach((pane,paneIndex)=>{
        const ss=state.series.filter(s=>s.pane===paneIndex && s.data?.length);
        if(!ss.length)return;
        const vals=[]; for(const s of ss)for(const r of s.data)vals.push(...valueOf(r,s.type));
        for(const s of ss)for(const p of s.priceLines){const v=Number(p.price);if(Number.isFinite(v))vals.push(v)}
        let lo=Math.min(...vals),hi=Math.max(...vals); if(!Number.isFinite(lo)||!Number.isFinite(hi)){lo=0;hi=1}
        if(hi===lo){hi+=1;lo-=1}
        const pad=(hi-lo)*.08;lo-=pad;hi+=pad;
        const py=v=>pane.y+topPad+(pane.h-topPad-bottomPad)*(1-(v-lo)/(hi-lo));
        const px=t=>left+(w-left-right)*(index.get(String(timeKey(t)))||0)/Math.max(1,times.length-1);
        ctx.save();ctx.beginPath();ctx.rect(0,pane.y,w,pane.h);ctx.clip();
        ctx.strokeStyle='rgba(150,160,175,.12)';ctx.lineWidth=1;
        for(let g=1;g<4;g++){const yy=pane.y+pane.h*g/4;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.stroke()}
        for(const s of ss){
          const opt=s.options||{}, data=s.data||[];
          if(s.type==='candlestick'){
            const bw=Math.max(2,Math.min(10,(w-left-right)/Math.max(1,times.length)*.58));
            for(const r of data){
              const x=px(r.time),o=Number(r.open),cl=Number(r.close),hiV=Number(r.high),loV=Number(r.low);
              if(![o,cl,hiV,loV].every(Number.isFinite))continue;
              const up=cl>=o,col=up?(opt.upColor||'#ff5a6d'):(opt.downColor||'#17b26a');
              ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1;
              ctx.beginPath();ctx.moveTo(x,py(hiV));ctx.lineTo(x,py(loV));ctx.stroke();
              const y=Math.min(py(o),py(cl)),hh=Math.max(1,Math.abs(py(o)-py(cl)));ctx.fillRect(x-bw/2,y,bw,hh);
            }
          }else if(s.type==='histogram'){
            const bw=Math.max(1.5,Math.min(12,(w-left-right)/Math.max(1,times.length)*.72));
            const base=py(Math.max(0,lo));
            for(const r of data){const v=Number(r.value);if(!Number.isFinite(v))continue;const x=px(r.time),y=py(v);ctx.fillStyle=r.color||opt.color||'rgba(197,164,109,.45)';ctx.fillRect(x-bw/2,Math.min(base,y),bw,Math.max(1,Math.abs(base-y)))}
          }else{
            const pts=data.map(r=>({x:px(r.time),y:py(Number(r.value)),v:Number(r.value)})).filter(p=>Number.isFinite(p.v));
            if(pts.length){
              if(s.type==='area'){
                ctx.beginPath();ctx.moveTo(pts[0].x,pane.y+pane.h-bottomPad);for(const p of pts)ctx.lineTo(p.x,p.y);ctx.lineTo(pts.at(-1).x,pane.y+pane.h-bottomPad);ctx.closePath();
                const grd=ctx.createLinearGradient(0,pane.y,0,pane.y+pane.h);grd.addColorStop(0,opt.topColor||'rgba(197,164,109,.22)');grd.addColorStop(1,opt.bottomColor||'rgba(197,164,109,.02)');ctx.fillStyle=grd;ctx.fill();
              }
              ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=opt.lineColor||opt.color||'#c5a46d';ctx.lineWidth=Number(opt.lineWidth)||1.6;
              if(opt.lineStyle===2)ctx.setLineDash([5,4]);else ctx.setLineDash([]);ctx.stroke();ctx.setLineDash([]);
            }
          }
          for(const pl of s.priceLines){const v=Number(pl.price);if(!Number.isFinite(v))continue;const y=py(v);ctx.strokeStyle=pl.color||'rgba(180,185,195,.6)';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.setLineDash([])}
          const marks=s.markers||[];
          for(const m of marks){const row=data.find(r=>String(timeKey(r.time))===String(timeKey(m.time)));if(!row)continue;const vv=Number(row.close??row.value);if(!Number.isFinite(vv))continue;const x=px(row.time),y=py(vv)+(m.position==='belowBar'?11:-11);ctx.fillStyle=m.color||'#e3c78f';ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill()}
        }
        ctx.restore();
      });
      state._geom={w,h,panes,times,index};
    }
    function nearest(clientX){
      const rect=canvas.getBoundingClientRect(),g=state._geom;if(!g?.times?.length)return null;const x=clientX-rect.left;const i=Math.max(0,Math.min(g.times.length-1,Math.round((x-8)/(Math.max(1,g.w-16))*(g.times.length-1))));return g.times[i]
    }
    canvas.addEventListener('mousemove',e=>{const t=nearest(e.clientX);if(t==null)return;const map=new Map();for(const s of state.series){const r=s.data?.find(x=>String(timeKey(x.time))===String(timeKey(t)));if(r)map.set(s,r)}for(const cb of state.cross)cb({time:t,seriesData:map})});
    canvas.addEventListener('mouseleave',()=>{for(const cb of state.cross)cb({time:null,seriesData:new Map()})});
    const chart={
      addSeries(type,opt={},pane=0){
        const s={type:typeKey(type),options:{...opt},pane:Number(pane)||0,data:[],priceLines:[],markers:[],
          setData(a){this.data=Array.isArray(a)?a:[];render()},
          createPriceLine(o){this.priceLines.push(o||{});render();return o},
          applyOptions(o){this.options={...this.options,...o};render()},
          setMarkers(a){this.markers=Array.isArray(a)?a:[];render()},
          priceToCoordinate(v){
            const p=state._geom?.panes?.[this.pane];if(!p||!this.data.length)return null;
            const vals=this.data.flatMap(r=>valueOf(r,this.type));let lo=Math.min(...vals),hi=Math.max(...vals);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi===lo)return p.y+p.h/2;const pad=(hi-lo)*.08;lo-=pad;hi+=pad;return p.y+8+(p.h-18)*(1-(v-lo)/(hi-lo))
          }
        };state.series.push(s);render();return s
      },
      applyOptions(o={}){state.options={...state.options,...o};render()},
      timeScale(){return{fitContent(){render()}}},
      panes(){const n=Math.max(1,...state.series.map(s=>s.pane+1));return Array.from({length:n},(_,i)=>({setHeight(h){state.paneHeights.set(i,Number(h)||0);render()}}))},
      subscribeCrosshairMove(cb){if(typeof cb==='function')state.cross.push(cb)},
      remove(){state.removed=true;root.remove();state.series=[]},
      _render:render
    };
    queueMicrotask(render);return chart
  }
  window.LightweightCharts={
    createChart,
    LineSeries:'line',AreaSeries:'area',HistogramSeries:'histogram',CandlestickSeries:'candlestick',
    createSeriesMarkers(series,markers){if(series){series.markers=Array.isArray(markers)?markers:[];series.setMarkers?.(series.markers)}return markers}
  };
})();

(()=>{
  const real=window.fetch.bind(window), cache=new Map(), inflight=new Map();
  const canonical=(u)=>{try{const x=new URL(typeof u==='string'?u:u.url,location.href);if(x.origin!==location.origin||!x.pathname.startsWith('/api/'))return null;x.searchParams.delete('_');return x.pathname+'?'+[...x.searchParams.entries()].sort().map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')}catch{return null}};
  window.fetch=(input,opt={})=>{
    const method=String(opt.method||input?.method||'GET').toUpperCase();
    const key=method==='GET'&&opt.cache!=='no-store'&&!(opt.signal)?canonical(input):null;
    if(!key)return real(input,opt);
    const now=Date.now(), hit=cache.get(key);
    if(hit&&now-hit.t<8000)return Promise.resolve(hit.r.clone());
    if(inflight.has(key))return inflight.get(key).then(r=>r.clone());
    const p=real(input,opt).then(r=>{if(r.ok)cache.set(key,{t:Date.now(),r:r.clone()});return r}).finally(()=>inflight.delete(key));
    inflight.set(key,p);return p.then(r=>r.clone());
  };
})();

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],E=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(n)?Number(n).toLocaleString('zh-TW',{maximumFractionDigits:d}):'—',money=n=>{if(!Number.isFinite(n))return'—';const a=Math.abs(n);if(a>=1e12)return(n/1e12).toFixed(2)+'兆';if(a>=1e8)return(n/1e8).toFixed(2)+'億';if(a>=1e4)return(n/1e4).toFixed(1)+'萬';return fmt(n,0)},lots=n=>Number.isFinite(n)?fmt(n/1000,0)+' 張':'—';
const DATA_REFRESH={quote:5000,marketOverview:5000,rank:10000,etf:10000,portfolio:10000};
function taipeiClock(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${o.year}-${o.month}-${o.day}`,hm:`${o.hour}:${o.minute}`,weekday:o.weekday};
}
function twRegularSessionOpen(){
  const t=taipeiClock();
  if(!['Mon','Tue','Wed','Thu','Fri'].includes(t.weekday))return false;
  return t.hm>='09:00'&&t.hm<='13:33';
}
let twClosedDate='';
function twLivePollingAllowed(){
  const t=taipeiClock();
  return document.visibilityState==='visible'&&twRegularSessionOpen()&&twClosedDate!==t.date;
}
function noteTwQuoteDate(date){
  const t=taipeiClock(),d=String(date||'').slice(0,10);
  if(twRegularSessionOpen()&&d&&d<t.date)twClosedDate=t.date;
  else if(d===t.date)twClosedDate='';
}
let market='TW',current='',months=6,lastData=null,chart=null,chartRO=null,chartMode='line',liveTimer=null,loaded=new Set(),deep={},radarLoaded=false,indicatorMap={},etfData=null,miniChart=null,newsItems=null,industryMarket='TW',industryData=null,industrySelected='',calendarDate=new Date(),calendarItems=[],calendarSelected='',calendarHighOnly=false,intradayBucket=60,linePriceSeries=null,lineVolumeSeries=null,lineAvgSeries=null,dataLoadedMonths=6,chartRangeMonths=6,etfNavData=null,chipsData=null,targetData=null,flowChart=null,flowRO=null,flowLargeSeries=null,flowSmallSeries=null,holderChart=null,holderRO=null;
const TWQUICK=[['2330','台積電'],['2454','聯發科'],['2308','台達電'],['0050','元大台灣50'],['006208','富邦台50'],['00919','群益台灣精選高息']],USQUICK=[['NVDA','NVIDIA'],['AAPL','Apple'],['MSFT','Microsoft'],['TSLA','Tesla'],['AMD','AMD'],['SPY','S&P 500 ETF']];
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),1800)}
function stat(l,v){return `<div class="stat"><span>${E(l)}</span><b>${E(v)}</b></div>`}function mini(l,v,c=''){return `<div class="mini"><span>${E(l)}</span><b class="${c}">${E(v)}</b></div>`}
function showScreen(id){$$('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));$$('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${id}`));if(id==='watch')renderWatch();if(id==='radar')loadRadar(false);if(id==='industry')loadIndustry(false);if(id==='calendar')loadCalendar(false);if(id==='kol'&&window.loadKolFeed)window.loadKolFeed(false);window.scrollTo({top:0,behavior:'smooth'})}

const MARKET_CAPS={
  TW:{chips:true,fund:true,chain:true,company:true,valuation:true,compare:true,flow:true},
  US:{chips:'probe',fund:'probe',chain:'probe',company:true,valuation:true,compare:true,flow:'probe'}
};
function setSubVisible(id,visible){
  const b=document.querySelector(`.subTab[data-sub="${id}"]`);
  if(b)b.classList.toggle('hidden',!visible);
}
function syncMarketSpecificUI(){
  const caps=MARKET_CAPS[market]||MARKET_CAPS.TW;
  ['chips','fund','chain','company','valuation','compare'].forEach(id=>setSubVisible(id,caps[id]!==false));
  document.querySelector('#flowCard')?.classList.toggle('hidden',caps.flow===false);
}
function hasUsefulPayload(v){
  if(v==null)return false;
  if(Array.isArray(v))return v.length>0;
  if(typeof v==='object')return Object.values(v).some(hasUsefulPayload);
  if(typeof v==='number')return Number.isFinite(v);
  return String(v).trim()!==''&&String(v)!=='—';
}
function applySourceAvailability(id,payload){
  if(market!=='US')return true;
  const ok=hasUsefulPayload(payload);
  setSubVisible(id,ok);
  return ok;
}

function renderQuick(){const a=market==='TW'?TWQUICK:USQUICK;$('#quick').innerHTML=a.map(([c,n])=>`<button class="chip" data-code="${c}">${c} ${n}</button>`).join('');$$('#quick .chip').forEach(b=>b.onclick=()=>search(b.dataset.code))}
function setMarket(m){market=m;syncMarketSpecificUI();months=6;chartRangeMonths=6;dataLoadedMonths=6;intradayBucket=60;$$('.marketBtn').forEach(b=>b.classList.toggle('active',b.dataset.market===m));$('#q').placeholder=m==='TW'?'2330 / 0050':'AAPL / NVDA / SPY';$('#lineMode').textContent=m==='TW'?'分時走勢':'日線走勢';$$('#rangeBar button').forEach(b=>{b.classList.toggle('active',+b.dataset.months===6);b.classList.toggle('hidden',m==='US'&&+b.dataset.months>6)});$$('#intradayBar button').forEach(b=>b.classList.toggle('active',+b.dataset.bucket===60));syncMarketSpecificUI();renderQuick();$('#stockResult').classList.add('hidden');$('#status').textContent=m==='TW'?'台股：TWSE / TPEx 公開行情與官方開放資料。':'美股：先顯示可用研究功能；只有實際資料源回傳不可用或空資料時才隱藏該欄位，並保留公司、估值、技術與新聞等可用內容。'}
function openSheet(id){document.body.classList.add('modalOpen');$('#backdrop').classList.add('show');$('#'+id).classList.add('show')}function openPopup(id){document.body.classList.add('modalOpen');$('#backdrop').classList.add('show');$('#'+id).classList.add('show')}function closeSheets(){document.body.classList.remove('modalOpen');$('#backdrop').classList.remove('show');$$('.sheet,.popup').forEach(x=>x.classList.remove('show'));try{miniChart?.remove()}catch{}miniChart=null}
function getWatch(){try{return JSON.parse(localStorage.getItem('pulse-watch')||'[]')}catch{return[]}}function setWatch(a){localStorage.setItem('pulse-watch',JSON.stringify(a.slice(0,24)));updateFav();renderWatch()}
function cacheKey(m,c){return `pulse-cache-${m}-${c}`}function saveQuoteCache(d){if(!d?.snapshot)return;localStorage.setItem(cacheKey(d.snapshot.market==='US'?'US':'TW',d.snapshot.code),JSON.stringify({name:d.snapshot.name,code:d.snapshot.code,market:d.snapshot.market==='US'?'US':'TW',price:d.snapshot.close,changePct:d.snapshot.changePct,date:d.snapshot.date,t:Date.now()}))}
function toggleFav(){if(!current||!lastData)return;const w=getWatch(),m=lastData.snapshot.market==='US'?'US':'TW',i=w.findIndex(x=>x.code===current&&x.market===m);if(i>=0)w.splice(i,1);else w.unshift({code:current,market:m,name:lastData.snapshot.name});setWatch(w);toast(i>=0?'已移出自選':'已加入自選')}
function updateFav(){if(!current||!lastData){$('#favBtn').classList.remove('on');$('#favBtn').textContent='☆';return}const m=lastData.snapshot.market==='US'?'US':'TW',on=getWatch().some(x=>x.code===current&&x.market===m);$('#favBtn').classList.toggle('on',on);$('#favBtn').textContent=on?'★':'☆'}
function renderWatch(){const w=getWatch();if(!w.length){$('#watchGrid').innerHTML='<div class="empty">尚未加入自選。查詢股票後點右上角 ☆ 即可儲存。</div>';return}$('#watchGrid').innerHTML=w.map(x=>{let c={};try{c=JSON.parse(localStorage.getItem(cacheKey(x.market,x.code))||'{}')}catch{}const cls=c.changePct>0?'up':c.changePct<0?'down':'muted';return `<div class="watchCard" data-code="${E(x.code)}" data-market="${E(x.market)}"><div class="watchTop"><div><div class="watchName">${E(c.name||x.name||x.code)}</div><div class="watchCode">${E(x.market)} · ${E(x.code)} · ${c.date||'尚未查詢'}</div></div><span class="pill">${x.market}</span></div><div class="watchPrice">${fmt(c.price)}</div><div class="${cls}" style="font-size:11px;font-weight:850;margin-top:4px">${Number.isFinite(c.changePct)?`${c.changePct>0?'+':''}${fmt(c.changePct,2)}%`:'點擊更新'}</div></div>`}).join('');$$('.watchCard').forEach(c=>c.onclick=()=>{setMarket(c.dataset.market);showScreen('market');$('#q').value=c.dataset.code;search(c.dataset.code)})}
async function refreshWatch(){const tw=getWatch().filter(x=>x.market==='TW').slice(0,12);if(!tw.length)return toast('目前沒有台股自選');$('#refreshWatch').textContent='更新中…';await Promise.all(tw.map(async x=>{try{const q=await fetch(`/api/quote?code=${encodeURIComponent(x.code)}`,{cache:'no-store'}).then(r=>r.json());if(q.available){localStorage.setItem(cacheKey('TW',x.code),JSON.stringify({name:q.name,code:x.code,market:'TW',price:q.price??q.prevClose,changePct:q.changePct,date:q.date,t:Date.now()}))}}catch{}}));$('#refreshWatch').textContent='更新台股快照';renderWatch()}
function chartOptions(){return{layout:{background:{type:'solid',color:'rgba(255,255,255,0)'},textColor:'#7a7f91',fontSize:10,panes:{separatorColor:'#e7e9f1',separatorHoverColor:'#8a82ff',enableResize:true}},grid:{vertLines:{color:'#eff0f5'},horzLines:{color:'#eff0f5'}},rightPriceScale:{borderColor:'#e3e5ee'},timeScale:{borderColor:'#e3e5ee',rightOffset:0,fixLeftEdge:true,fixRightEdge:true,timeVisible:true,secondsVisible:chartMode==='line'&&market==='TW'&&intradayBucket===5},crosshair:{mode:0},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},kineticScroll:{mouse:true,touch:true},localization:{locale:'zh-TW'}}}
function destroyChart(){try{chartRO?.disconnect()}catch{};chartRO=null;try{chart?.remove()}catch{};chart=null;linePriceSeries=null;lineVolumeSeries=null;lineAvgSeries=null;$('#mainChart').innerHTML=''}
function watchChart(){if(!chart)return;chartRO=new ResizeObserver(()=>chart.applyOptions({width:$('#mainChart').clientWidth,height:$('#mainChart').clientHeight}));chartRO.observe($('#mainChart'))}
function linePointTime(date,time){if(!date)return Math.floor(Date.now()/1000);const t=(time&&/^\d{2}:\d{2}/.test(time)?time:'13:30:00').split(':').map(Number);return Math.floor(new Date(`${date}T${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}:${String(t[2]||0).padStart(2,'0')}+08:00`).getTime()/1000)}
function sessionKey(s){return `pulse-intraday-${s.code}-${s.date}`}
function readRawSession(s){let a=[];try{a=JSON.parse(localStorage.getItem(sessionKey(s))||'[]')}catch{};return Array.isArray(a)?a:[]}
function writeRawSession(s,a){try{localStorage.setItem(sessionKey(s),JSON.stringify(a.slice(-4000)))}catch{try{sessionStorage.setItem(sessionKey(s),JSON.stringify(a.slice(-1000)))}catch{}}}
function getSession(s){let a=readRawSession(s);if(!a.length&&Number.isFinite(s.open))a.push({time:linePointTime(s.date,'09:00:00'),value:s.open,volume:0,tradeVolume:0});const v=s.close;if(Number.isFinite(v)){const t=linePointTime(s.date,s.time||'13:30:00'),row={time:t,value:v,volume:Number.isFinite(s.volume)?s.volume:null,tradeVolume:Number.isFinite(s.tradeVolume)?s.tradeVolume:null};if(!a.length||a.at(-1).time!==t)a.push(row);else a[a.length-1]={...a[a.length-1],...row}}a=a.filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.value)).sort((x,y)=>x.time-y.time);writeRawSession(s,a);return a}
function appendSession(q){if(!lastData?.snapshot||!q?.available||!Number.isFinite(q.price))return;const s=lastData.snapshot,a=readRawSession(s),t=linePointTime(q.date||s.date,q.time||'13:30:00'),row={time:t,value:q.price,volume:Number.isFinite(q.volume)?q.volume:null,tradeVolume:Number.isFinite(q.tradeVolume)?q.tradeVolume:null,bid1:Number.isFinite(q.bidPrices?.[0])?q.bidPrices[0]:null,ask1:Number.isFinite(q.askPrices?.[0])?q.askPrices[0]:null};if(!a.length||t>a.at(-1).time)a.push(row);else if(a.at(-1).time===t)a[a.length-1]={...a[a.length-1],...row};writeRawSession(s,a)}

function destroyFlow(){try{flowRO?.disconnect()}catch{};flowRO=null;try{flowChart?.remove()}catch{};flowChart=null;flowLargeSeries=null;flowSmallSeries=null;if($('#flowChart'))$('#flowChart').innerHTML=''}
function flowFromSession(s){const bid=(s?.bidVolumes||[]).reduce((a,x)=>a+(Number(x)||0),0),ask=(s?.askVolumes||[]).reduce((a,x)=>a+(Number(x)||0),0);return{bid,ask,imbalance:bid+ask?(bid-ask)/(bid+ask)*100:null}}
function refreshFlow(){const card=$('#flowCard');if(!card)return;if(market!=='TW'||!lastData){card.classList.add('hidden');destroyFlow();return}card.classList.remove('hidden');destroyFlow();const s=lastData.snapshot||{},f=flowFromSession(s),bp=Number(s.bidPrices?.[0]),ap=Number(s.askPrices?.[0]),spread=Number.isFinite(bp)&&Number.isFinite(ap)?ap-bp:null;$('#flowStats').innerHTML=[mini('五檔委買量',Number.isFinite(f.bid)?fmt(f.bid):'—'),mini('五檔委賣量',Number.isFinite(f.ask)?fmt(f.ask):'—'),mini('委託失衡',Number.isFinite(f.imbalance)?`${f.imbalance>0?'+':''}${fmt(f.imbalance,0)}%`:'—'),mini('買一',Number.isFinite(bp)?fmt(bp,2):'—'),mini('買賣價差',Number.isFinite(spread)?fmt(spread,2):'—')].join('');$('#flowNote').textContent='直接呈現 TWSE MIS 買賣五檔公開委託快照。掛單可能撤單或改價，不能辨識法人、主力或散戶，也不代表實際資金淨流入。';const head=card.querySelector('.flowHead');if(head)head.innerHTML='<div><h3>盤中委託簿壓力</h3><p>觀察公開五檔的買賣盤深度與失衡，不使用固定金額門檻猜測大單／小單。</p></div><span class="flowBadge">公開五檔快照 · 非成交資金流</span>';const chart=$('#flowChart');if(chart)chart.innerHTML='<div class="empty">此區改以真實五檔快照為主，不繪製推估資金流曲線。</div>'}
function bucketSession(s,bucket=60){const raw=getSession(s);if(bucket<=5)return raw;const m=new Map();for(const x of raw){const t=Math.floor(x.time/bucket)*bucket,prev=m.get(t);m.set(t,{time:t,value:x.value,volume:Number.isFinite(x.volume)?x.volume:prev?.volume??null,tradeVolume:Number.isFinite(x.tradeVolume)?(prev?.tradeVolume||0)+x.tradeVolume:prev?.tradeVolume??0})}return [...m.values()].sort((a,b)=>a.time-b.time)}
function seriesMap(series){const m={};for(const [k,a] of Object.entries(series||{}))for(const x of a||[])(m[x.time]||(m[x.time]={}))[k]=x.value;return m}
function renderIndicators(time=null){if(!lastData)return;const a=lastData.analysis,z=time?indicatorMap[time]||{}:{};const vals={ma5:time?z.ma5:a.ma5,ma20:time?z.ma20:a.ma20,ma60:time?z.ma60:a.ma60,rsi:time?z.rsi:a.rsi14,macd:time?z.macdHist:a.macd?.hist,k:time?z.kdK:a.kd?.k,d:time?z.kdD:a.kd?.d};$('#indicatorStrip').innerHTML=[['MA5',fmt(vals.ma5)],['MA20',fmt(vals.ma20)],['MA60',fmt(vals.ma60)],['RSI',fmt(vals.rsi,1)],['MACD Hist',fmt(vals.macd)],['KD',`${fmt(vals.k,1)} / ${fmt(vals.d,1)}`],['量比',Number.isFinite(a.volumeRatio)?fmt(a.volumeRatio,2)+'×':'—'],['支撐',fmt(a.support20)],['壓力',fmt(a.resistance20)]].map(([l,v])=>`<span class="indicator">${l}<b>${v}</b></span>`).join('')}
function intradayLabel(){return intradayBucket===5?'5 秒':intradayBucket===60?'1 分鐘':intradayBucket===300?'5 分鐘':intradayBucket===900?'15 分鐘':'60 分鐘'}
function intradayData(s){const session=bucketSession(s,intradayBucket),price=session.map(x=>({time:x.time,value:x.value})),vol=[];let cumV=0,cumPV=0;const avg=[];for(let i=0;i<session.length;i++){const x=session[i],prev=i?session[i-1].volume:0,delta=Number.isFinite(x.volume)&&Number.isFinite(prev)?Math.max(0,x.volume-prev):(x.tradeVolume||0),up=i===0||x.value>=session[Math.max(0,i-1)].value;vol.push({time:x.time,value:delta||0,color:up?'rgba(255,91,114,.46)':'rgba(29,187,157,.46)'});if(delta>0){cumV+=delta;cumPV+=x.value*delta}avg.push({time:x.time,value:cumV?cumPV/cumV:session.slice(0,i+1).reduce((a,y)=>a+y.value,0)/(i+1)})}return{session,price,vol,avg}}
function intradayQuickHtml(s,pack){const a=pack.session.map(x=>x.value).filter(Number.isFinite),hi=a.length?Math.max(...a):null,lo=a.length?Math.min(...a):null,avg=pack.avg.at(-1)?.value,vr=lastData?.analysis?.volumeRatio,bid=(s.bidVolumes||[]).reduce((x,y)=>x+(+y||0),0),ask=(s.askVolumes||[]).reduce((x,y)=>x+(+y||0),0),imb=bid+ask?(bid-ask)/(bid+ask)*100:null;return [['今開',fmt(s.open)],['分時高',fmt(hi)],['分時低',fmt(lo)],['均價',fmt(avg)],['成交量',money(s.volume)],['量比',Number.isFinite(vr)?fmt(vr,2)+'×':'—'],['五檔力道',Number.isFinite(imb)?`${imb>0?'+':''}${fmt(imb,0)}%`:'—']].map(([l,v])=>`<div class="iq"><span>${l}</span><b>${v}</b></div>`).join('')}
function refreshIntradaySeries(){if(!lastData||market!=='TW'||chartMode!=='line'||!linePriceSeries||!lineVolumeSeries)return renderLineChart();const s=lastData.snapshot,pack=intradayData(s),{session,price,vol,avg}=pack;linePriceSeries.setData(price);lineVolumeSeries.setData(vol);if(lineAvgSeries)lineAvgSeries.setData(avg);$('#intradayQuick').innerHTML=intradayQuickHtml(s,pack);$('#sampleCount').textContent=`${session.length} 點`;$('#chartHint').textContent=`當日 ${intradayLabel()} · 價格＋量能`;$('#chartLiveBadge').className='chartLiveBadge live';$('#chartLiveBadge').textContent=`5秒快照 · ${E(s.time||'更新中')}`;const notice=$('#chartNotice');notice.classList.toggle('hidden',session.length>=3);if(session.length<3)notice.textContent='公開免費來源不提供「開盤至現在」完整逐筆回補；已啟動 5 秒快照累積，1分／5分會自動聚合。已累積資料會保留在此瀏覽器當日紀錄。'}
function renderLineChart(){destroyChart();if(!window.LightweightCharts||!lastData)return;$('#mainChart').className='mainChart';$('#rangeBar').classList.add('hidden');$('#intradayBar').classList.toggle('hidden',market!=='TW');$('#chartLoading').classList.add('hidden');const s=lastData.snapshot;chart=LightweightCharts.createChart($('#mainChart'),chartOptions());let data=[];if(s.market==='US'){$('#intradayQuick').innerHTML='';linePriceSeries=chart.addSeries(LightweightCharts.AreaSeries,{lineColor:'#6b63ff',topColor:'rgba(107,99,255,.22)',bottomColor:'rgba(107,99,255,.02)',lineWidth:2,priceLineVisible:false,lastValueVisible:true,crosshairMarkerRadius:4},0);data=(lastData.history||[]).slice(-35).map(x=>({time:x.date,value:x.close}));linePriceSeries.setData(data);$('#chartHint').textContent='免費美股模式：最近收盤線（EOD / 非即時）';$('#sampleCount').textContent=`${data.length} 日`;$('#chartLiveBadge').className='chartLiveBadge';$('#chartLiveBadge').textContent='EOD';$('#chartNotice').classList.add('hidden')}else{linePriceSeries=chart.addSeries(LightweightCharts.AreaSeries,{lineColor:'#6b63ff',topColor:'rgba(107,99,255,.24)',bottomColor:'rgba(85,167,255,.02)',lineWidth:2,priceLineVisible:false,lastValueVisible:true,crosshairMarkerRadius:4},0);const pack=intradayData(s);data=pack.price;linePriceSeries.setData(data);lineAvgSeries=chart.addSeries(LightweightCharts.LineSeries,{color:'#e2a33a',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,title:'均價'},0);lineAvgSeries.setData(pack.avg);lineVolumeSeries=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);lineVolumeSeries.setData(pack.vol);try{const panes=chart.panes();panes[0]?.setHeight(330);panes[1]?.setHeight(90)}catch{}$('#chartHint').textContent=`當日 ${intradayLabel()} · 價格＋均價＋量能`;$('#sampleCount').textContent=`${pack.session.length} 點`;$('#intradayQuick').innerHTML=intradayQuickHtml(s,pack);$('#chartLiveBadge').className='chartLiveBadge live';$('#chartLiveBadge').textContent=`5秒快照 · ${E(s.time||'更新中')}`;const notice=$('#chartNotice');notice.classList.toggle('hidden',pack.session.length>=3);if(pack.session.length<3)notice.textContent='公開免費來源不提供「開盤至現在」完整逐筆回補；已啟動 5 秒快照累積，1分／5分會自動聚合。已累積資料會保留在此瀏覽器當日紀錄。'}if(Number.isFinite(s.prevClose))linePriceSeries.createPriceLine({price:s.prevClose,color:'#b9bdca',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'昨收'});chart.timeScale().fitContent();chart.subscribeCrosshairMove(p=>{if(!p?.time){$('#crossInfo').textContent='—';return}const x=p.seriesData.get(linePriceSeries);if(x)$('#crossInfo').textContent=`${typeof p.time==='string'?p.time:new Date(p.time*1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:intradayBucket===5?'2-digit':undefined})} · ${fmt(x.value)}`});watchChart();renderIndicators()}
function addLine(c,data,color,width=1,pane=0,opt={}){const s=c.addSeries(LightweightCharts.LineSeries,{color,lineWidth:width,priceLineVisible:false,lastValueVisible:false,...opt},pane);s.setData(data||[]);return s}
function rangeSlice(){const all=lastData?.history||[];if(!all.length)return{h:[],s:{}};const bars=Math.max(22,Math.ceil(chartRangeMonths*23)),h=all.slice(-bars),start=h[0]?.date||'';const src=lastData.series||{},out={};for(const [k,a] of Object.entries(src))out[k]=(a||[]).filter(x=>!start||String(x.time)>=start);return{h,s:out}}
function renderTechChart(){destroyChart();if(!window.LightweightCharts||!lastData)return;$('#intradayQuick').innerHTML='';$('#mainChart').className='mainChart tech';$('#intradayBar').classList.add('hidden');$('#rangeBar').classList.remove('hidden');$('#chartLoading').classList.add('hidden');$('#chartNotice').classList.add('hidden');$('#chartHint').textContent=`技術 K 線 · ${chartRangeMonths}M · MA5/10/20/60 · BB · Volume · MACD · RSI · KD`;$('#chartLiveBadge').className='chartLiveBadge';$('#chartLiveBadge').textContent='拖曳 / 縮放 / 十字線';const pack=rangeSlice(),h=pack.h,s=pack.s,candles=h.filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).map(x=>({time:x.date,open:x.open,high:x.high,low:x.low,close:x.close}));chart=LightweightCharts.createChart($('#mainChart'),chartOptions());const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#ff5b72',downColor:'#1dbb9d',wickUpColor:'#ff5b72',wickDownColor:'#1dbb9d',borderVisible:false},0);cs.setData(candles);window.__clarinaviCandleSeries=cs;addLine(chart,s.ma5,'#ffad45',2,0);addLine(chart,s.ma10,'#6cc7bb',1.5,0);addLine(chart,s.ma20,'#55a7ff',2,0);addLine(chart,s.ma60,'#8a77ff',2,0);addLine(chart,s.bollUpper,'#b8bbc8',1,0,{lineStyle:2});addLine(chart,s.bollLower,'#b8bbc8',1,0,{lineStyle:2});const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);vol.setData(h.map((x,i)=>({time:x.date,value:x.volume||0,color:i&&x.close<h[i-1].close?'rgba(29,187,157,.48)':'rgba(255,91,114,.48)'})));const mh=chart.addSeries(LightweightCharts.HistogramSeries,{priceLineVisible:false,lastValueVisible:false},2);mh.setData((s.macdHist||[]).map(x=>({time:x.time,value:x.value,color:x.value>=0?'rgba(255,91,114,.5)':'rgba(29,187,157,.5)'})));addLine(chart,s.macdDif,'#ffad45',1,2);addLine(chart,s.macdDea,'#55a7ff',1,2);addLine(chart,s.rsi,'#7c64f3',2,3);addLine(chart,h.map(x=>({time:x.date,value:70})),'#c8cbd5',1,3,{lineStyle:2});addLine(chart,h.map(x=>({time:x.date,value:30})),'#c8cbd5',1,3,{lineStyle:2});addLine(chart,s.kdK,'#ffad45',1,4);addLine(chart,s.kdD,'#55a7ff',1,4);addLine(chart,h.map(x=>({time:x.date,value:80})),'#c8cbd5',1,4,{lineStyle:2});addLine(chart,h.map(x=>({time:x.date,value:20})),'#c8cbd5',1,4,{lineStyle:2});try{const p=chart.panes();p[0]?.setHeight(315);p[1]?.setHeight(90);p[2]?.setHeight(105);p[3]?.setHeight(95);p[4]?.setHeight(95)}catch{}chart.timeScale().fitContent();chart.subscribeCrosshairMove(p=>{if(!p?.time){$('#crossInfo').textContent='滑動查看 OHLC';renderIndicators();return}const x=p.seriesData.get(cs);if(x)$('#crossInfo').textContent=`${p.time} O ${fmt(x.open)} H ${fmt(x.high)} L ${fmt(x.low)} C ${fmt(x.close)}`;renderIndicators(p.time)});watchChart();renderIndicators();$('#sampleCount').textContent=`${h.length} 根 K`}
async function loadChartRange(n){chartRangeMonths=n;$$('#rangeBar button').forEach(x=>x.classList.toggle('active',+x.dataset.months===n));if(!current||!lastData)return;if(n<=dataLoadedMonths){renderTechChart();return}$('#chartLoading').classList.remove('hidden');try{let d;if(market==='TW'){const r=await fetch(`/api/stock?code=${encodeURIComponent(current)}&months=${n}`);d=await r.json();if(!r.ok)throw new Error(d.error||'歷史圖表資料失敗')}else{const key=localStorage.getItem('pulse-av-key')||'';const r=await fetch(`/api/us?symbol=${encodeURIComponent(current)}`,{headers:{'X-AV-Key':key}});d=await r.json();if(d.error)throw new Error(d.error)}lastData.history=d.history||lastData.history;lastData.series=d.series||lastData.series;indicatorMap=seriesMap(lastData.series||{});dataLoadedMonths=Math.max(dataLoadedMonths,n);renderTechChart()}catch(e){$('#chartLoading').classList.add('hidden');toast('圖表區間載入失敗：'+(e.message||'資料來源暫時無法使用'))}}
function renderChart(){chartMode==='tech'?renderTechChart():renderLineChart()}
function adviceNarrative(d){const s=d.snapshot,a=d.analysis,p=s.close,parts=[];if(Number.isFinite(a.ma20))parts.push(p>=a.ma20?'股價位於 MA20 之上，短中期趨勢較有利多方':'股價仍在 MA20 下方，趨勢確認度較弱');if(Number.isFinite(a.rsi14))parts.push(a.rsi14>=75?'RSI 已在高檔區，追價風險提高':a.rsi14>=50?'RSI 位於多方區且尚未明顯過熱':'RSI 低於 50，動能仍偏保守');if(Number.isFinite(a.macd?.hist))parts.push(a.macd.hist>0?'MACD 柱狀體為正，動能偏多':'MACD 柱狀體為負，短線動能偏弱');if(Number.isFinite(a.volumeRatio))parts.push(a.volumeRatio>=1.3?'量能明顯高於近期均值，可再觀察是否為有效突破':'量能沒有明顯放大，突破訊號需要更多確認');let end='較適合把支撐、壓力與成交量一起看，而不是只依單一指標進場。';if(a.score>=72&&a.rsi14<75)end='目前條件偏多，可優先觀察回測支撐不破或突破壓力伴隨量能的情境。';if(a.score<=38)end='目前風險訊號較多，較適合等待重新站回關鍵均線或動能翻正後再評估。';if(a.rsi14>=80)end='趨勢可能仍強，但短線已過熱，應留意高檔震盪與快速回測。';return `${parts.join('；')}。${end}`}
function sumInst(inst,n=5,key='total'){return (inst||[]).slice(-n).reduce((a,x)=>a+(Number.isFinite(x?.[key])?x[key]:0),0)}
function holderDelta(hist,key){const a=(hist||[]).filter(x=>Number.isFinite(x?.[key]));return a.length>=2?a.at(-1)[key]-a[0][key]:null}
function researchModel(){if(!lastData)return null;const a=lastData.analysis,s=lastData.snapshot,inst=chipsData?.institutional||[],hist=chipsData?.tdccHistory||[],inst5=sumInst(inst,5),inst10=sumInst(inst,10),bigDelta=holderDelta(hist,'big400'),retailDelta=holderDelta(hist,'retail10'),target=targetData?.median,upside=Number.isFinite(target)&&Number.isFinite(s.close)&&s.close?((target/s.close)-1)*100:null;let score=Number.isFinite(a.score)?a.score:50;if(inst.length){score+=inst5>0?4:inst5<0?-4:0;score+=sumInst(inst,5,'trust')>0?2:0}if(Number.isFinite(bigDelta))score+=bigDelta>.3?6:bigDelta<-.3?-6:0;if(Number.isFinite(retailDelta))score+=retailDelta<-.3?3:retailDelta>.3?-3:0;if(Number.isFinite(upside))score+=upside>=15?5:upside>=5?2:upside<=-5?-6:0;if(Number.isFinite(etfNavData?.premiumPct)){const p=etfNavData.premiumPct;score+=p<=-.5?2:p>=1?-4:0}score=Math.max(0,Math.min(100,Math.round(score)));const label=score>=76?'偏多觀察':score>=60?'多方略優':score>=44?'中性等待':'風險偏高',parts=[];parts.push(Number.isFinite(a.ma20)?(s.close>=a.ma20?'價格站在 MA20 之上':'價格仍在 MA20 下方'):'技術線等待更多資料');if(Number.isFinite(a.rsi14))parts.push(a.rsi14>=78?`RSI ${fmt(a.rsi14,0)} 已偏熱`:a.rsi14>=50?`RSI ${fmt(a.rsi14,0)} 位於多方區`:`RSI ${fmt(a.rsi14,0)} 動能偏弱`);if(inst.length)parts.push(`近5日法人${inst5>=0?'買超':'賣超'} ${lots(Math.abs(inst5))}`);if(Number.isFinite(bigDelta))parts.push(`400張以上大戶近${Math.max(1,hist.length-1)}週 ${bigDelta>=0?'+':''}${fmt(bigDelta,2)}pp`);if(Number.isFinite(retailDelta))parts.push(`10張以下散戶 ${retailDelta>=0?'+':''}${fmt(retailDelta,2)}pp`);if(Number.isFinite(upside))parts.push(`公開目標價中位數 ${fmt(target)}，距現價 ${upside>=0?'+':''}${fmt(upside,1)}%`);if(Number.isFinite(etfNavData?.premiumPct))parts.push(`ETF 折溢價 ${etfNavData.premiumPct>=0?'+':''}${fmt(etfNavData.premiumPct,2)}%`);let action='目前較適合觀察支撐、壓力與量能是否互相確認。';if(score>=76&&a.rsi14<78)action=`綜合條件偏強，可優先觀察回測 ${fmt(a.support20)} 附近不破，或放量突破 ${fmt(a.resistance20)} 的情境；仍不宜只因分數追價。`;else if(score<44)action=`籌碼或動能確認度不足，較適合等待重新站回關鍵均線／法人轉買，並把 ${fmt(a.support20)} 視為風險觀察位。`;else if(a.rsi14>=78)action='趨勢可能仍強，但短線過熱，追價風險較高，可等待量價降溫或回測支撐再評估。';return{score,label,text:`${parts.join('；')}。${action}`,inst5,inst10,bigDelta,retailDelta,target,upside}}
function renderResearchAdvice(){if(!lastData)return;const m=researchModel();if(!m)return;$('#researchScore').textContent=`${m.score} · ${m.label}`;$('#researchAdviceTitle').textContent=targetData?.count?`研究觀點 · 目標價樣本 ${targetData.count}`:'研究觀點';$('#researchAdviceText').textContent=m.text;$('#researchAdviceMeta').innerHTML=[['技術分數',`${lastData.analysis.score}/100`],['法人5日',market==='TW'&&lastData.snapshot.assetHint!=='ETF'?(chipsData?.institutional?.length?lots(m.inst5):'讀取中'):'—'],['大戶趨勢',market==='TW'&&lastData.snapshot.assetHint!=='ETF'?(Number.isFinite(m.bigDelta)?`${m.bigDelta>=0?'+':''}${fmt(m.bigDelta,2)}pp`:'讀取中'):'—'],['公開目標價',Number.isFinite(m.target)?`${fmt(m.target)} (${m.upside>=0?'+':''}${fmt(m.upside,1)}%)`:(lastData.snapshot.assetHint==='ETF'?'ETF 不適用':targetData?'暫無公開樣本':'搜尋中')]].map(([l,v])=>`<div class="rMeta"><span>${E(l)}</span><b>${E(v)}</b></div>`).join('');const tl=$('#targetList'),items=targetData?.items||[];tl.classList.toggle('hidden',!items.length);tl.innerHTML=items.slice(0,3).map(x=>`<div class="targetItem"><b>${E(x.broker||x.source)}</b><a href="${E(x.url)}" target="_blank" rel="noopener" title="${E(x.title)}">${E(x.title)}</a><span>${fmt(x.target)} · ${E(x.date||'')}</span></div>`).join('')}
async function loadTargets(){if(!lastData||lastData.snapshot.assetHint==='ETF'){targetData={items:[],count:0};renderResearchAdvice();return}try{if(market==='US'){const key=localStorage.getItem('pulse-av-key')||'';if(!key)return;const j=await fetch(`/api/us?symbol=${encodeURIComponent(current)}&mode=profile`,{headers:{'X-AV-Key':key}}).then(r=>r.json()),t=j.profile?.analystTarget;targetData=Number.isFinite(t)?{median:t,count:1,items:[],source:'Alpha Vantage 公司概覽'}:{items:[],count:0}}else targetData=await fetch(`/api/targets?symbol=${encodeURIComponent(current)}&name=${encodeURIComponent(lastData.snapshot.name)}&market=TW`).then(r=>r.json())}catch{targetData={items:[],count:0}}renderResearchAdvice()}
async function hydrateResearchAdvice(){renderResearchAdvice();const code=current;if(market==='TW'&&lastData?.snapshot.assetHint!=='ETF'){try{const j=await apiResearch('chips');if(current!==code)return;chipsData=j.data||null;deep.chips=j;renderResearchAdvice()}catch{}}else if(market==='TW'&&lastData?.snapshot.assetHint==='ETF'){chipsData=null;renderResearchAdvice()}loadTargets()}
function openAdvice(){if(!lastData)return;const m=researchModel(),a=lastData.analysis,s=lastData.snapshot;$('#adviceTitle').textContent=`${s.name} ${s.code}`;$('#adviceScore').textContent=m?.score??a.score;$('#adviceLabel').textContent=m?.label??a.label;$('#adviceText').textContent=m?.text||adviceNarrative(lastData);$('#adviceReasons').innerHTML=(a.reasons||[]).map(x=>`<span class="reasonChip">${E(x)}</span>`).join('');openSheet('adviceSheet')}
function renderDepth(s){const bp=s.bidPrices||[],bv=s.bidVolumes||[],ap=s.askPrices||[],av=s.askVolumes||[];if(!bp.length&&!ap.length){$('#depthBook').innerHTML='';return}const side=(title,prices,vols,cls)=>`<div class="depthSide"><div class="depthTitle"><b>${title}</b><span>價 / 量</span></div>${Array.from({length:Math.min(5,Math.max(prices.length,vols.length))},(_,i)=>`<div class="depthRow"><span>${i+1}</span><span class="${cls}">${fmt(prices[i])}</span><span>${Number.isFinite(vols[i])?fmt(vols[i],0):'—'}</span></div>`).join('')}</div>`;$('#depthBook').innerHTML=side('買五檔',bp,bv,'bid')+side('賣五檔',ap,av,'ask')}
function setEtfButton(s){const b=$('#etfHoldBtn'),on=market==='TW'&&s.assetHint==='ETF';b.classList.toggle('hidden',!on);b.textContent='';if(on)b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>成分股'}
function etfPremiumState(p){if(!Number.isFinite(p))return{label:'—',cls:'',hint:'目前無法判斷折溢價。'};if(p>=2)return{label:'溢價偏高',cls:'warn',hint:`市價較盤中預估淨值高 ${fmt(p,2)}%，追價需留意溢價收斂風險。`};if(p>=.5)return{label:'小幅溢價',cls:'warn',hint:`市價高於預估淨值 ${fmt(p,2)}%，可先比較 iNAV 與買賣價差。`};if(p<=-1)return{label:'明顯折價',cls:'good',hint:`市價低於預估淨值 ${fmt(Math.abs(p),2)}%，屬折價交易，但仍應確認流動性與標的市場時差。`};if(p<=-.3)return{label:'小幅折價',cls:'good',hint:`市價略低於預估淨值 ${fmt(Math.abs(p),2)}%。折價不代表一定便宜，仍需看追蹤標的與流動性。`};return{label:'接近淨值',cls:'',hint:'市價與盤中預估淨值接近，折溢價風險相對較低。'}}
async function loadEtfNav(s){const box=$('#etfValuePanel');etfNavData=null;if(market!=='TW'||s.assetHint!=='ETF'){box.classList.add('hidden');return}box.classList.remove('hidden');$('#etfNav').textContent='…';$('#etfPremium').textContent='…';$('#etfFairness').textContent='讀取中';$('#etfValueHint').className='etfValueHint';$('#etfValueHint').textContent='讀取 TWSE MIS ETF 盤中預估淨值與折溢價…';try{const j=await fetch(`/api/etf-nav?code=${encodeURIComponent(s.code)}`,{cache:'no-store'}).then(r=>r.json());if(!j.available)throw new Error(j.error||'目前沒有預估淨值');etfNavData={...j,_clientTime:Date.now()};$('#etfNav').textContent=fmt(j.estimatedNav);const p=j.premiumPct,cls=p>0?'up':p<0?'down':'muted';$('#etfPremium').className=cls;$('#etfPremium').textContent=Number.isFinite(p)?`${p>0?'+':''}${fmt(p,2)}%`:'—';const state=etfPremiumState(p);$('#etfFairness').textContent=state.label;$('#etfValueHint').className=`etfValueHint ${state.cls}`;$('#etfValueHint').textContent=`${state.hint}${j.time?' · '+j.time:''}`;renderResearchAdvice()}catch(e){$('#etfNav').textContent='—';$('#etfPremium').textContent='—';$('#etfFairness').textContent='暫無資料';$('#etfValueHint').textContent='盤中預估淨值暫時無法取得，可改以投信官網／TWSE ETF 淨值頁交叉確認。';renderResearchAdvice()}}
function renderMain(d){lastData=d;current=d.snapshot.code;indicatorMap=seriesMap(d.series||{});loaded.clear();deep={};etfData=null;etfNavData=null;newsItems=null;chipsData=null;targetData=null;destroyFlow();try{holderRO?.disconnect()}catch{};holderRO=null;try{holderChart?.remove()}catch{};holderChart=null;dataLoadedMonths=Number(d.meta?.months)||6;chartRangeMonths=6;intradayBucket=60;$$('#rangeBar button').forEach(b=>b.classList.toggle('active',+b.dataset.months===6));$$('#intradayBar button').forEach(b=>b.classList.toggle('active',+b.dataset.bucket===60));const s=d.snapshot,a=d.analysis||{score:50,label:'資料載入中',level:'',reasons:[],macd:{}};d.analysis=a;$('#stockResult').classList.remove('hidden');$('#stockName').textContent=`${s.name} ${s.code}`;$('#stockMeta').textContent=`${s.market} · ${s.date||'最新'} · ${d.meta?.latencyType||''}`;$('#price').textContent=fmt(s.close);const cls=s.change>0?'up':s.change<0?'down':'muted';$('#chg').className=`chg ${cls}`;$('#chg').textContent=`${s.change>0?'+':''}${fmt(s.change)} ${Number.isFinite(s.changePct)?`(${s.changePct>0?'+':''}${fmt(s.changePct,2)}%)`:''}`;$('#freshPill').className=`pill ${s.isRealtimePrice?'live':''}`;$('#freshPill').innerHTML=s.isRealtimePrice?`<span class="pulse"></span>公開近即時 ${E(s.time||'')}`:'最近交易 / EOD';$('#assetPill').textContent=s.assetHint==='ETF'?'ETF / Fund':s.market==='US'?'US Equity':'Stock';const quoteRows=[['開',s.open],['高',s.high],['低',s.low],['量',s.volume],['PE',s.pe],['殖利率',s.yield]].filter(([,v])=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(([l,v])=>[l,l==='量'?money(Number(v)):l==='殖利率'?fmt(Number(v),2)+'%':fmt(Number(v))]);
$('#quoteStats').innerHTML=quoteRows.map(([l,v])=>stat(l,v)).join('');renderDepth(s);setEtfButton(s);loadEtfNav(s);$('#adviceBtn').className=`adviceBtn ${a.level||''}`;$('#expertRail').innerHTML=(d.experts||[]).map(x=>`<div class="expert"><strong>${E(x.name)}</strong><small>${E(x.expert)}</small><div class="state ${x.level==='positive'?'up':x.level==='negative'?'down':''}">${E(x.state)}</div><p>${E(x.note||'')}</p></div>`).join('')||`<div class="expert"><strong>技術綜合</strong><div class="state">${E(a.label)}</div><p>${E(adviceNarrative(d))}</p></div>`;$('#newsPreview').innerHTML='<div class="skeleton"></div>';updateFav();saveQuoteCache(d);renderChart();$$('.subTab').forEach(x=>x.classList.remove('active'));$$('.subPanel').forEach(x=>x.classList.remove('active'));$('#deepPanel').classList.add('hidden');$('#newsList').className='newsList hidden';$('#newsList').innerHTML='';$('#newsMoreBtn').textContent='展開全部';renderResearchAdvice();refreshFlow();setTimeout(()=>loadNewsPreview(),260);setTimeout(()=>hydrateResearchAdvice(),420)}
function mergeAvailableQuote(s,q){if(!s||!q)return s;const map={price:'close',prevClose:'prevClose',change:'change',changePct:'changePct',open:'open',high:'high',low:'low',volume:'volume',tradeVolume:'tradeVolume',upperLimit:'upperLimit',lowerLimit:'lowerLimit',bidPrices:'bidPrices',bidVolumes:'bidVolumes',askPrices:'askPrices',askVolumes:'askVolumes',time:'time',date:'date',name:'name',source:'liveSource'};for(const [src,dst] of Object.entries(map)){const v=q[src];if(v!==null&&v!==undefined&&v!==''&&(!Array.isArray(v)||v.length))s[dst]=v}s.isRealtimePrice=/MIS/.test(String(q.source||''));return s}
function refreshQuoteUI(s,q){$('#price').textContent=fmt(s.close);const c=s.change;$('#chg').textContent=`${c>0?'+':''}${fmt(c)} ${Number.isFinite(s.changePct)?`(${s.changePct>0?'+':''}${fmt(s.changePct,2)}%)`:''}`;$('#chg').className=`chg ${c>0?'up':c<0?'down':'muted'}`;$('#freshPill').className=`pill ${s.isRealtimePrice?'live':''}`;$('#freshPill').innerHTML=s.isRealtimePrice?`<span class="pulse"></span>公開近即時 ${E(s.time||'')}`:E(q.source||'最近交易 / 延遲備援');const rows=[['開',s.open],['高',s.high],['低',s.low],['量',s.volume],['PE',s.pe],['殖利率',s.yield]].filter(([,v])=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(([l,v])=>[l,l==='量'?money(Number(v)):l==='殖利率'?fmt(Number(v),2)+'%':fmt(Number(v))]);$('#quoteStats').innerHTML=rows.map(([l,v])=>stat(l,v)).join('');renderDepth(s)}
async function applyLive(code){if(market!=='TW')return;try{const q=await fetch(`/api/quote?code=${encodeURIComponent(code)}&_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());if(current!==code||!q?.available)return;appendSession(q);const s=mergeAvailableQuote(lastData.snapshot,q);refreshQuoteUI(s,q);refreshFlow();saveQuoteCache(lastData);renderResearchAdvice();if(chartMode==='line')refreshIntradaySeries();if(s.assetHint==='ETF'&&etfNavData&&Date.now()-(etfNavData._clientTime||0)>15000)loadEtfNav(s)}catch{}}
function setupLive(){
  clearInterval(liveTimer);liveTimer=null;
  if(market!=='TW'||!current)return;
  const tick=()=>{if(twLivePollingAllowed())applyLive(current)};
  tick();
  liveTimer=setInterval(tick,DATA_REFRESH.quote);
}
function partialStockData(code,q=null,reason=''){
 const price=Number.isFinite(q?.price)?q.price:Number.isFinite(q?.prevClose)?q.prevClose:null;
 const prev=Number.isFinite(q?.prevClose)?q.prevClose:null;
 const change=Number.isFinite(q?.change)?q.change:(Number.isFinite(price)&&Number.isFinite(prev)?price-prev:null);
 const changePct=Number.isFinite(q?.changePct)?q.changePct:(Number.isFinite(change)&&prev?change/prev*100:null);
 const snapshot={code,name:q?.name||code,market:q?.market||'TWSE',date:q?.date||'',time:q?.time||'',close:price,prevClose:prev,change,changePct,open:q?.open??null,high:q?.high??null,low:q?.low??null,volume:q?.volume??null,tradeVolume:q?.tradeVolume??null,bidPrices:q?.bidPrices||[],bidVolumes:q?.bidVolumes||[],askPrices:q?.askPrices||[],askVolumes:q?.askVolumes||[],isRealtimePrice:/MIS/.test(String(q?.source||'')),assetHint:/^(00|006|007|008|009)/.test(code)?'ETF':'STOCK'};
 const row=Number.isFinite(price)?[{date:snapshot.date||new Date().toISOString().slice(0,10),open:snapshot.open??price,high:snapshot.high??price,low:snapshot.low??price,close:price,volume:snapshot.volume??0}]:[];
 return{snapshot,analysis:{score:50,label:'等待完整資料',level:'',reasons:[],ma5:null,ma20:null,rsi14:null,macd:{hist:null},kd:{k:null,d:null},volumeRatio:null,support20:null,resistance20:null},experts:[],history:row,series:{},meta:{months:1,tradingDays:row.length,generatedAt:new Date().toISOString(),latencyType:q?.source||'部分資料模式',partial:true,sourceErrors:reason?[reason]:[]}};
}
async function search(raw){
 const code=String(raw||'').trim().toUpperCase();
 if(market==='TW'&&!/^\d{4,6}[A-Z]?$/.test(code))return toast('請輸入台股 / ETF 代號');
 if(market==='US'&&!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(code))return toast('請輸入美股 ticker，例如 AAPL');
 current=code;$('#q').value=code;$('#status').innerHTML='<span class="loader"></span>讀取行情與圖表…';
 const t=performance.now();
 try{
  let d,warning='';
  if(market==='TW'){
   const [stockRes,quoteRes]=await Promise.allSettled([
    fetch(`/api/stock?code=${encodeURIComponent(code)}&months=${months}&_=${Date.now()}`,{cache:'no-store'}),
    fetch(`/api/quote?code=${encodeURIComponent(code)}&_=${Date.now()}`,{cache:'no-store'})
   ]);
   let stockJson=null,quoteJson=null;
   if(stockRes.status==='fulfilled')try{stockJson=await stockRes.value.json()}catch{}
   if(quoteRes.status==='fulfilled')try{quoteJson=await quoteRes.value.json()}catch{}
   if(stockRes.status==='fulfilled'&&stockRes.value.ok&&stockJson?.snapshot){d=stockJson;if(quoteJson?.available)mergeAvailableQuote(d.snapshot,quoteJson)}
   else{
    warning=stockJson?.error||'完整歷史資料暫時無法取得';
    if(!quoteJson?.available){try{const c=JSON.parse(localStorage.getItem(cacheKey('TW',code))||'null');if(c?.price!=null)quoteJson={available:true,code,name:c.name||code,market:'TWSE',date:c.date||'',price:Number(c.price),changePct:Number(c.changePct),source:'本機最近成功快照'}}catch{}}
    d=partialStockData(code,quoteJson?.available?quoteJson:null,warning);
   }
  }else{
   const key=localStorage.getItem('pulse-av-key')||'';
   if(!key){$('#avKey').value='';openSheet('settingsSheet');throw new Error('請先設定自己的免費 Alpha Vantage API Key')}
   const r=await fetch(`/api/us?symbol=${encodeURIComponent(code)}`,{headers:{'X-AV-Key':key}});d=await r.json();if(d.needsKey||d.error)throw new Error(d.error||d.note||'美股資料失敗')
  }
  renderMain(d);
  $('#status').textContent=warning?`個股頁已開啟 · ${warning} · 其他欄位持續更新`:`完成 ${((performance.now()-t)/1000).toFixed(1)} 秒 · ${d.meta?.latencyType||'公開資料'}`;
  history.replaceState(null,'',`?market=${market}&code=${encodeURIComponent(code)}`);localStorage.setItem('pulse-last',JSON.stringify({market,code}));
  if(market==='TW'){applyLive(code);setupLive()}else clearInterval(liveTimer)
 }catch(e){
  if(market==='TW'){const d=partialStockData(code,null,e.message||'資料來源暫時無法使用');renderMain(d);$('#status').textContent='個股頁已開啟 · 行情來源暫時無法連線，資料恢復後會自動補上';setupLive()}
  else $('#status').textContent='查詢失敗：'+(e.message||'資料來源暫時無法使用')
 }
}
async function apiResearch(section,extra=''){const m=lastData.snapshot.market;const r=await fetch(`/api/research?code=${encodeURIComponent(current)}&market=${encodeURIComponent(m)}&section=${section}${extra}`);return await r.json()}
async function fetchNewsItems(){if(newsItems)return newsItems;let mops=[];if(market==='TW')try{const e=await apiResearch('events');mops=e.data||[]}catch{}const j=await fetch(`/api/news?symbol=${encodeURIComponent(current)}&name=${encodeURIComponent(lastData.snapshot.name)}&market=${market}`).then(r=>r.json()),items=[];for(const x of (j.items||[]).slice(0,10))items.push(x);for(const x of mops.slice(0,4))items.push({title:x.title||'重大訊息',source:'MOPS 官方重大訊息',date:`${x.date||''} ${x.time||''}`,url:null});newsItems=items.slice(0,14);return newsItems}
function newsHtml(x,compact=false){if(x.url)return `<a class="${compact?'newsPreviewItem':'newsItem'}" href="${E(x.url)}" target="_blank" rel="noopener"><div><b>${E(x.title)}</b><span>${E(x.source||'新聞來源')} · ${E(x.date||'')}</span></div>${compact?'':'<div class="arrow">↗</div>'}</a>`;return compact?`<div class="newsPreviewItem"><b>${E(x.title)}</b><span>${E(x.source)} · ${E(x.date||'')}</span></div>`:`<div class="eventItem"><div><b>${E(x.title)}</b><span>${E(x.source)} · ${E(x.date||'')}</span></div></div>`}
async function loadNewsPreview(){try{const out=await fetchNewsItems();if(!lastData)return;$('#newsPreview').innerHTML=out.length?out.slice(0,4).map(x=>newsHtml(x,true)).join(''):'<div class="empty">近幾日暫無可得相關消息。</div>'}catch(e){$('#newsPreview').innerHTML='<div class="empty">新聞暫時無法載入。</div>'}}
async function loadNews(){const box=$('#newsList');box.classList.remove('hidden');$('#newsMoreBtn').textContent='收合';if(loaded.has('news')&&box.children.length)return;loaded.add('news');box.className='skeleton';try{const out=await fetchNewsItems();box.className='newsList';box.innerHTML=out.length?out.slice(0,10).map(x=>newsHtml(x,false)).join(''):'<div class="empty">目前沒有取得最新相關消息。</div>'}catch(e){box.className='empty';box.textContent='新聞來源暫時無法使用：'+e.message}}
function toggleNews(){const box=$('#newsList');if(!box.classList.contains('hidden')){box.classList.add('hidden');$('#newsMoreBtn').textContent='展開全部';return}loadNews()}
function chipModel(d){const inst=d?.institutional||[],hist=d?.tdccHistory||[],td=d?.tdcc||{},mg=d?.margin||{},inst5=sumInst(inst,5),inst10=sumInst(inst,10),foreign5=sumInst(inst,5,'foreign'),trust5=sumInst(inst,5,'trust'),bigDelta=holderDelta(hist,'big400'),retailDelta=holderDelta(hist,'retail10');let score=50;if(inst.length)score+=inst5>0?8:inst5<0?-8:0;if(trust5>0)score+=3;if(Number.isFinite(bigDelta))score+=bigDelta>.3?12:bigDelta<-.3?-12:0;if(Number.isFinite(retailDelta))score+=retailDelta<-.3?6:retailDelta>.3?-6:0;if(Number.isFinite(mg.marginBalance)&&Number.isFinite(mg.shortBalance)&&mg.marginBalance>0&&mg.shortBalance/mg.marginBalance>.08)score+=2;score=Math.max(0,Math.min(100,Math.round(score)));const parts=[];if(inst.length)parts.push(`近5日三大法人${inst5>=0?'買超':'賣超'} ${lots(Math.abs(inst5))}，其中外資 ${foreign5>=0?'+':''}${lots(foreign5)}、投信 ${trust5>=0?'+':''}${lots(trust5)}`);if(Number.isFinite(bigDelta))parts.push(`400張以上大戶近${Math.max(1,hist.length-1)}週 ${bigDelta>=0?'+':''}${fmt(bigDelta,2)}pp`);if(Number.isFinite(retailDelta))parts.push(`10張以下散戶同期 ${retailDelta>=0?'+':''}${fmt(retailDelta,2)}pp`);if(Number.isFinite(td.big1000))parts.push(`1000張以上持股 ${fmt(td.big1000,1)}%`);let label=score>=70?'籌碼偏多':score>=55?'籌碼略佳':score>=45?'籌碼中性':'籌碼偏弱';return{score,label,text:(parts.join('；')||'目前公開籌碼樣本不足')+'。TDCC 為每週持股結構，非即時下單資料。',inst5,inst10,foreign5,trust5,bigDelta,retailDelta}}
function renderHolderChart(hist){const wrap=$('#holderChartWrap');try{holderRO?.disconnect()}catch{};holderRO=null;try{holderChart?.remove()}catch{};holderChart=null;if(!window.LightweightCharts||!(hist||[]).filter(x=>Number.isFinite(x.big400)&&Number.isFinite(x.retail10)).length){wrap.classList.add('hidden');return}const h=(hist||[]).filter(x=>x.date&&Number.isFinite(x.big400)&&Number.isFinite(x.retail10));if(h.length<2){wrap.classList.add('hidden');return}wrap.classList.remove('hidden');holderChart=LightweightCharts.createChart($('#holderChart'),{...chartOptions(),height:220,width:$('#holderChart').clientWidth,timeScale:{borderVisible:false,timeVisible:false},rightPriceScale:{borderVisible:false}});const big=holderChart.addSeries(LightweightCharts.LineSeries,{color:'#ff5b72',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'400張以上'}),retail=holderChart.addSeries(LightweightCharts.LineSeries,{color:'#55a7ff',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'10張以下'});big.setData(h.map(x=>({time:x.date,value:x.big400})));retail.setData(h.map(x=>({time:x.date,value:x.retail10})));holderChart.timeScale().fitContent();holderRO=new ResizeObserver(()=>holderChart?.applyOptions({width:$('#holderChart').clientWidth}));holderRO.observe($('#holderChart'))}
function renderChips(d){chipsData=d||{};const td=d?.tdcc,mg=d?.margin,inst=d?.institutional||[],hist=d?.tdccHistory||[],cm=chipModel(d),mh=d?.majorHolders||[];const lv=td?.levels||[],sumLv=(lo,hi)=>lv.filter(x=>x.level>=lo&&x.level<=hi).reduce((a,x)=>a+(Number.isFinite(x.pct)?x.pct:0),0),mix=[['散戶≤10張',sumLv(1,3),'#7db7ff'],['10–100張',sumLv(4,9),'#75d7c6'],['100–400張',sumLv(10,11),'#b39aff'],['400–1000張',sumLv(12,14),'#ffb36b'],['1000張以上',sumLv(15,15),'#ff7186']];$('#chipSummary').innerHTML=[mini('籌碼分數',`${cm.score}/100`,cm.score>=60?'up':cm.score<45?'down':''),mini('法人5日',inst.length?lots(cm.inst5):'—',cm.inst5>0?'up':cm.inst5<0?'down':''),mini('法人10日',inst.length?lots(cm.inst10):'—',cm.inst10>0?'up':cm.inst10<0?'down':''),mini('400張以上',Number.isFinite(td?.big400)?fmt(td.big400,1)+'%':'—'),mini('大戶趨勢',Number.isFinite(cm.bigDelta)?`${cm.bigDelta>=0?'+':''}${fmt(cm.bigDelta,2)}pp`:'—',cm.bigDelta>0?'up':cm.bigDelta<0?'down':''),mini('10張以下',Number.isFinite(td?.retail10)?fmt(td.retail10,1)+'%':'—'),mini('散戶趨勢',Number.isFinite(cm.retailDelta)?`${cm.retailDelta>=0?'+':''}${fmt(cm.retailDelta,2)}pp`:'—',cm.retailDelta<0?'up':cm.retailDelta>0?'down':''),mini('融資 / 融券',`${Number.isFinite(mg?.marginBalance)?fmt(mg.marginBalance,0):'—'} / ${Number.isFinite(mg?.shortBalance)?fmt(mg.shortBalance,0):'—'}`),mini('券資比',Number.isFinite(mg?.shortBalance)&&Number.isFinite(mg?.marginBalance)&&mg.marginBalance?fmt(mg.shortBalance/mg.marginBalance*100,1)+'%':'—',(mg?.shortBalance&&mg?.marginBalance&&mg.shortBalance/mg.marginBalance>=.2)?'down':'')].join('');const insight=$('#chipInsight');insight.classList.remove('hidden');insight.innerHTML=`<div class="chipScore">${cm.score}</div><div><b>${E(cm.label)}</b><p>${E(cm.text)}</p></div>`;renderHolderChart(hist);let html='';if(mix.some(x=>x[1]>0)){const total=mix.reduce((a,x)=>a+x[1],0)||100;html+=`<div class="holderMix"><h4>目前持股結構</h4><div class="mixBar">${mix.map(x=>`<span class="mixSeg" style="width:${Math.max(0,x[1]/total*100)}%;background:${x[2]}"></span>`).join('')}</div><div class="mixLegend">${mix.map(x=>`<span>${E(x[0])}<b>${fmt(x[1],1)}%</b></span>`).join('')}</div></div>`}if(inst.length)html+=`<div class="tableWrap" style="margin-top:10px"><table class="dataTable"><thead><tr><th>日期</th><th>外資</th><th>投信</th><th>自營商</th><th>合計</th></tr></thead><tbody>${inst.slice().reverse().map(x=>`<tr><td>${E(x.date)}</td><td class="${x.foreign>0?'up':x.foreign<0?'down':''}">${lots(x.foreign)}</td><td class="${x.trust>0?'up':x.trust<0?'down':''}">${lots(x.trust)}</td><td>${lots(x.dealer)}</td><td class="${x.total>0?'up':x.total<0?'down':''}"><b>${lots(x.total)}</b></td></tr>`).join('')}</tbody></table></div>`;if(mh.length)html+=`<div class="sectionHead" style="margin-top:12px"><div><h3>持股逾 10% / 主要大股東</h3><p>依交易所公開大股東資料；不是盤中主力名單。</p></div></div><div class="tableWrap"><table class="dataTable"><thead><tr><th>名稱</th><th>持股數</th><th>持股比率</th></tr></thead><tbody>${mh.map(x=>`<tr><td>${E(x.name)}</td><td>${money(x.shares)}</td><td>${Number.isFinite(x.pct)?fmt(x.pct,2)+'%':'—'}</td></tr>`).join('')}</tbody></table></div>`;html+=`<div class="legalNote" style="margin-top:10px">${E(d?.note||'TDCC 大戶/散戶為每週持股結構；盤中主力代理則來自 5 秒成交快照，兩者口徑不同。')}</div>`;$('#chipBody').innerHTML=html||'<div class="empty">目前沒有可得法人明細。</div>';renderResearchAdvice()}
async function loadChips(){if(loaded.has('chips')&&chipsData){renderChips(chipsData);return}loaded.add('chips');if(market==='US'){ $('#chipSummary').innerHTML='<div class="empty">美股籌碼目前不使用未授權即時訂單流；可再接 SEC 13F、insider transactions 與合法 options flow 供應商。</div>';$('#chipInsight').classList.add('hidden');$('#holderChartWrap').classList.add('hidden');$('#chipBody').innerHTML='';return}try{let j=deep.chips;if(!j)j=await apiResearch('chips');deep.chips=j;renderChips(j.data||{})}catch(e){$('#chipSummary').innerHTML=`<div class="empty">籌碼資料暫時無法使用：${E(e.message)}</div>`}}
async function loadFund(){if(loaded.has('fund'))return;loaded.add('fund');if(market==='US'){ $('#fundSummary').innerHTML='<div class="empty">美股基本面目前不接未授權第三方資料。後續可接 SEC Company Facts（官方）做營收、EPS、資產負債歷史。</div>';$('#fundBody').innerHTML='';return}try{const [rj,fj]=await Promise.all([apiResearch('revenue','&months=36'),apiResearch('financials')]),rows=rj.data?.rows||[],qr=fj.data?.rows||[],latest=rows.at(-1),avg=rows.slice(-3).map(x=>x.yoy).filter(Number.isFinite);$('#fundSummary').innerHTML=[mini('最新月份',latest?.month||'—'),mini('單月營收',money(latest?.revenue)),mini('YoY',Number.isFinite(latest?.yoy)?`${latest.yoy>0?'+':''}${fmt(latest.yoy,1)}%`:'—',latest?.yoy>0?'up':latest?.yoy<0?'down':''),mini('近3月 YoY',avg.length?fmt(avg.reduce((a,b)=>a+b,0)/avg.length,1)+'%':'—')].join('');let html='';if(rows.length)html+=`<div class="tableWrap"><table class="dataTable"><thead><tr><th>月份</th><th>營收</th><th>MoM</th><th>YoY</th><th>累計</th></tr></thead><tbody>${rows.slice().reverse().map(x=>`<tr><td>${E(x.month)}</td><td>${money(x.revenue)}</td><td>${Number.isFinite(x.mom)?fmt(x.mom,1)+'%':'—'}</td><td class="${x.yoy>0?'up':x.yoy<0?'down':''}">${Number.isFinite(x.yoy)?fmt(x.yoy,1)+'%':'—'}</td><td>${money(x.cumRevenue)}</td></tr>`).join('')}</tbody></table></div>`;if(qr.length)html+=`<div class="tableWrap" style="margin-top:9px"><table class="dataTable"><thead><tr><th>季別</th><th>營收</th><th>毛利</th><th>營業利益</th><th>淨利</th><th>EPS</th></tr></thead><tbody>${qr.slice().reverse().map(x=>`<tr><td>${E(x.quarter)}</td><td>${money(x.revenue)}</td><td>${money(x.grossProfit)}</td><td>${money(x.operatingIncome)}</td><td>${money(x.netIncome)}</td><td>${fmt(x.eps)}</td></tr>`).join('')}</tbody></table></div>`;$('#fundBody').innerHTML=html||'<div class="empty">這檔目前沒有可解析的公司財務歷史（ETF 通常不適用）。</div>'}catch(e){$('#fundSummary').innerHTML=`<div class="empty">財務資料暫時無法使用：${E(e.message)}</div>`}}
function renderEtfHoldings(filter=''){if(!etfData)return;const q=String(filter||'').trim().toLowerCase(),all=etfData.holdings||[],h=q?all.filter(x=>x.code.toLowerCase().includes(q)||String(x.name||'').toLowerCase().includes(q)):all;$('#etfCount').textContent=`${h.length} / ${all.length} 檔 · 有價 ${etfData.priced||0}`;$('#etfHoldingsBody').className='';$('#etfHoldingsBody').innerHTML=h.length?`<div class="tableWrap"><table class="dataTable constituentTable"><thead><tr><th>#</th><th>成分股</th><th>權重</th><th>最新 / 昨收</th><th>漲跌幅</th><th>狀態</th></tr></thead><tbody>${h.map((x,i)=>`<tr><td>${i+1}</td><td><button class="constituentBtn" data-code="${E(x.code)}" data-name="${E(x.name)}">${E(x.code)} ${E(x.name)}</button></td><td>${fmt(x.weight,2)}%</td><td>${fmt(x.quote?.price)}</td><td class="${x.quote?.changePct>0?'up':x.quote?.changePct<0?'down':''}">${Number.isFinite(x.quote?.changePct)?`${x.quote.changePct>0?'+':''}${fmt(x.quote.changePct,2)}%`:'—'}</td><td><span class="quoteDot ${x.quote?.isRealtime?'live':''}"></span>${x.quote?.isRealtime?'盤中':'昨收/最近'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">沒有符合的成分股。</div>';$$('.constituentBtn').forEach(b=>b.onclick=()=>openConstituent(b.dataset.code,b.dataset.name))}
async function openETFHoldings(){if(!lastData||market!=='TW'||lastData.snapshot.assetHint!=='ETF')return;openSheet('etfSheet');$('#etfSheetTitle').textContent=`${lastData.snapshot.name} ${current} · 全部成分股`;$('#etfFilter').value='';if(etfData?.code===current){renderEtfHoldings();return}$('#etfHoldingsBody').className='skeleton';$('#etfHoldingsBody').innerHTML='';$('#etfCount').textContent='載入中…';try{const j=await fetch(`/api/etf?code=${encodeURIComponent(current)}`).then(r=>r.json());etfData=j;$('#etfSheetMeta').textContent=`${j.source||'ETF 公開持股'}${j.asOf?' · '+j.asOf:''} · ${j.note||''}`;if(!j.holdings?.length){$('#etfHoldingsBody').className='empty';$('#etfHoldingsBody').textContent='目前尚無可完整解析的成分股來源。';$('#etfCount').textContent='0 檔';return}renderEtfHoldings()}catch(e){$('#etfHoldingsBody').className='empty';$('#etfHoldingsBody').textContent='ETF 成分股暫時無法使用：'+e.message;$('#etfCount').textContent='載入失敗'}}
async function openConstituent(code,name){openPopup('constituentPopup');$('#cqName').textContent=`${name||code} ${code}`;$('#cqMeta').textContent='讀取最新行情與技術快照…';$('#cqPrice').textContent='—';$('#cqChg').textContent='—';$('#cqStats').innerHTML='<div class="skeleton" style="grid-column:1/-1"></div>';$('#cqTech').innerHTML='';$('#cqChart').innerHTML='';try{const [d,q]=await Promise.all([fetch(`/api/stock?code=${encodeURIComponent(code)}&months=2`).then(r=>r.json()),fetch(`/api/quote?code=${encodeURIComponent(code)}`,{cache:'no-store'}).then(r=>r.json())]);if(d.error)throw new Error(d.error);const s=d.snapshot,a=d.analysis,price=q.available&&Number.isFinite(q.price)?q.price:s.close,chg=q.available&&Number.isFinite(q.change)?q.change:s.change,pct=q.available&&Number.isFinite(q.changePct)?q.changePct:s.changePct;$('#cqMeta').textContent=`${q.available?'TWSE MIS 公開市況':'最近交易'} · ${q.time||s.date||''}`;$('#cqPrice').textContent=fmt(price);$('#cqChg').className=`chg ${chg>0?'up':chg<0?'down':'muted'}`;$('#cqChg').textContent=`${chg>0?'+':''}${fmt(chg)} ${Number.isFinite(pct)?`(${pct>0?'+':''}${fmt(pct,2)}%)`:''}`;$('#cqStats').innerHTML=[mini('開',fmt(q.open??s.open)),mini('高',fmt(q.high??s.high)),mini('低',fmt(q.low??s.low)),mini('量',money(q.volume??s.volume))].join('');$('#cqTech').innerHTML=[['MA5',fmt(a.ma5)],['MA20',fmt(a.ma20)],['RSI',fmt(a.rsi14,1)],['MACD',fmt(a.macd?.hist)],['KD',`${fmt(a.kd?.k,1)}/${fmt(a.kd?.d,1)}`],['量比',Number.isFinite(a.volumeRatio)?fmt(a.volumeRatio,2)+'×':'—']].map(([l,v])=>`<span class="indicator">${l}<b>${v}</b></span>`).join('');try{miniChart?.remove()}catch{};miniChart=LightweightCharts.createChart($('#cqChart'),{...chartOptions(),height:190,width:$('#cqChart').clientWidth,timeScale:{borderVisible:false,timeVisible:false},rightPriceScale:{borderVisible:false}});const ser=miniChart.addSeries(LightweightCharts.AreaSeries,{lineColor:'#6b63ff',topColor:'rgba(107,99,255,.20)',bottomColor:'rgba(107,99,255,.02)',lineWidth:2,priceLineVisible:false,lastValueVisible:true});ser.setData((d.history||[]).slice(-35).map(x=>({time:x.date,value:x.close})));miniChart.timeScale().fitContent();$('#cqOpenFull').onclick=()=>{closeSheets();setMarket('TW');showScreen('market');$('#q').value=code;search(code)}}catch(e){$('#cqMeta').textContent='資料載入失敗';$('#cqStats').innerHTML=`<div class="empty" style="grid-column:1/-1">${E(e.message)}</div>`}}
async function loadCompany(){
 if(loaded.has('company'))return;loaded.add('company');$('#companyDesc').classList.add('hidden');$('#companyDesc').textContent='';
 if(market==='US'){
  const key=localStorage.getItem('pulse-av-key')||'';if(!key){$('#profile').innerHTML='<div class="empty">請先在設定中加入自己的 Alpha Vantage 免費 API Key。</div>';return}
  try{const r=await fetch(`/api/us?symbol=${encodeURIComponent(current)}&mode=profile`,{headers:{'X-AV-Key':key}}),j=await r.json();if(j.error)throw new Error(j.error);const p=j.profile||{},pairs=[['公司名稱',p.name],['交易所',p.exchange],['國家',p.country],['產業',p.sector],['細分產業',p.industry],['市值',Number.isFinite(p.marketCap)?money(p.marketCap):null],['本益比',Number.isFinite(p.pe)?fmt(p.pe,2):null],['EPS',Number.isFinite(p.eps)?fmt(p.eps,2):null],['股息殖利率',Number.isFinite(p.dividendYield)?fmt(p.dividendYield*100,2)+'%':null],['52週高',fmt(p.week52High)],['52週低',fmt(p.week52Low)],['分析師目標',fmt(p.analystTarget)]];
   $('#profile').innerHTML=p.name?pairs.map(([a,b])=>`<div class="info"><span>${E(a)}</span><b>${E(b||'—')}</b></div>`).join(''):'<div class="empty">沒有公司主檔資料。</div>';if(p.description){$('#companyDesc').textContent=p.description;$('#companyDesc').classList.remove('hidden')}}catch(e){$('#profile').innerHTML=`<div class="empty">美股公司資料暫時無法使用：${E(e.message)}</div>`}return;
 }
 try{const pj=await apiResearch('profile'),p=pj.data||{},pairs=[['公司全名',p.name],['產業',p.industry],['董事長',p.chairman],['總經理',p.manager],['成立日',p.foundedDate],['掛牌日',p.listedDate],['資本額',Number.isFinite(p.capital)?money(p.capital):null],['網站',p.website]];$('#profile').innerHTML=p.name?pairs.map(([a,b])=>`<div class="info"><span>${E(a)}</span>${a==='網站'&&b?`<a href="${E(b.startsWith('http')?b:'https://'+b)}" target="_blank" rel="noopener">${E(b)}</a>`:`<b>${E(b||'—')}</b>`}</div>`).join(''):'<div class="empty">沒有公司主檔資料。</div>'}catch(e){$('#profile').innerHTML=`<div class="empty">公司資料暫時無法使用：${E(e.message)}</div>`}
}

function quantileSorted(a,p){if(!a.length)return null;const x=(a.length-1)*p,i=Math.floor(x),f=x-i;return a[i+1]!=null?a[i]+(a[i+1]-a[i])*f:a[i]}
function quarterRelease(q){const m=String(q||'').match(/^(\d{4})Q([1-4])$/);if(!m)return null;const y=+m[1],k=+m[2];return k===1?`${y}-05-15`:k===2?`${y}-08-31`:k===3?`${y}-11-14`:`${y+1}-03-31`}
function peRiverSvg(rows,quarters){
 const eps=quarters.filter(x=>Number.isFinite(Number(x.eps))).map(x=>({...x,eps:Number(x.eps),release:quarterRelease(x.quarter)})).filter(x=>x.release).sort((a,b)=>a.release.localeCompare(b.release));
 if(eps.length<4||rows.length<40)return null;
 const roll=[];for(let i=3;i<eps.length;i++){const ttm=eps.slice(i-3,i+1).reduce((a,x)=>a+x.eps,0);if(ttm>0)roll.push({date:eps[i].release,ttm})}
 if(!roll.length)return null;let j=0,ttm=null;const points=[];for(const r of rows){while(j<roll.length&&roll[j].date<=r.date){ttm=roll[j].ttm;j++}const close=Number(r.close);if(ttm>0&&close>0)points.push({date:r.date,close,ttm,pe:close/ttm})}
 if(points.length<30)return null;const pes=points.map(x=>x.pe).filter(x=>x>0&&x<200).sort((a,b)=>a-b);if(pes.length<20)return null;const levels=[.2,.35,.5,.65,.8].map(p=>quantileSorted(pes,p));const series=points.map(x=>({...x,bands:levels.map(pe=>x.ttm*pe)}));
 const all=series.flatMap(x=>[x.close,...x.bands]).filter(Number.isFinite),lo=Math.min(...all),hi=Math.max(...all),W=820,H=300,P=18,sx=i=>P+i*(W-2*P)/Math.max(1,series.length-1),sy=v=>H-P-(v-lo)*(H-2*P)/Math.max(1,hi-lo);
 const path=vals=>vals.map((v,i)=>`${i?'L':'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');const poly=(a,b)=>`${a.map((v,i)=>`${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')} ${b.map((v,i)=>`${sx(b.length-1-i).toFixed(1)},${sy(b[b.length-1-i]).toFixed(1)}`).join(' ')}`;
 const bandArrays=levels.map((_,k)=>series.map(x=>x.bands[k]));const fills=['rgba(61,99,255,.08)','rgba(61,99,255,.12)','rgba(197,164,109,.14)','rgba(197,164,109,.10)'];let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="本益比河流">`;
 for(let k=0;k<4;k++)svg+=`<polygon points="${poly(bandArrays[k],bandArrays[k+1])}" fill="${fills[k]}"/>`;
 svg+=`<path d="${path(bandArrays[2])}" fill="none" stroke="rgba(197,164,109,.9)" stroke-width="1.5"/><path d="${path(series.map(x=>x.close))}" fill="none" stroke="currentColor" stroke-width="2.3"/>`;
 const last=series.at(-1);svg+=`</svg><div class="peRiverLegend"><span>股價</span><span>P20 ${levels[0].toFixed(1)}x</span><span>中位 ${levels[2].toFixed(1)}x</span><span>P80 ${levels[4].toFixed(1)}x</span></div>`;
 const rank=pes.filter(x=>x<=last.pe).length/pes.length*100;return{html:svg,currentPE:last.pe,medianPE:levels[2],percentile:rank,levels,from:series[0].date,to:last.date};
}
async function loadValuationPanel(){
 if(loaded.has('valuation'))return;loaded.add('valuation');const sum=$('#valuationSummary'),chart=$('#peRiverChart'),targets=$('#valuationTargetList');if(!sum||!chart||!targets)return;
 if(lastData?.snapshot?.assetHint==='ETF'){sum.innerHTML='<div class="empty">ETF 不適用公司本益比河流。</div>';chart.innerHTML='';targets.innerHTML='';return}
 sum.innerHTML='<div class="skeleton"></div>';chart.innerHTML='<div class="skeleton" style="height:280px"></div>';targets.innerHTML='<div class="skeleton"></div>';
 try{
  if(!targetData)await loadTargets();
  if(market==='US'){
   const pe=lastData?.snapshot?.pe;sum.innerHTML=[mini('目前 PE',fmt(pe)),mini('公開目標價',Number.isFinite(targetData?.median)?fmt(targetData.median):'—'),mini('目標價樣本',targetData?.count||0),mini('河流','台股優先')].join('');chart.innerHTML='<div class="empty">美股本益比河流暫不接未授權歷史基本面資料；公司概覽仍使用使用者自己的 Alpha Vantage Key。</div>';targets.innerHTML='<div class="empty">目標價依 Alpha Vantage 公司概覽顯示。</div>';$('#peRiverSource').textContent='資料來源：使用者自備 Alpha Vantage API Key；不另抓第三方付費資料。';return
  }
  const [fj,long]=await Promise.all([apiResearch('financials'),dataLoadedMonths>=36?Promise.resolve(lastData):fetch(`/api/stock?code=${encodeURIComponent(current)}&months=36`).then(r=>r.json())]);
  const river=peRiverSvg((long.history||[]).filter(x=>Number.isFinite(Number(x.close))).slice(-760),fj?.data?.rows||[]),px=Number(lastData?.snapshot?.close),target=Number(targetData?.median),up=Number.isFinite(target)&&px?((target/px)-1)*100:null;
  sum.innerHTML=[mini('目前 PE',river?fmt(river.currentPE,1):fmt(lastData?.snapshot?.pe,1)),mini('歷史中位 PE',river?fmt(river.medianPE,1):'—'),mini('PE 歷史位置',river?`${river.percentile.toFixed(0)}%`:'—'),mini('公開目標價',Number.isFinite(target)?`${fmt(target)}${Number.isFinite(up)?` (${up>=0?'+':''}${fmt(up,1)}%)`:''}`:'—')].join('');
  chart.innerHTML=river?river.html:'<div class="empty">近 3 年可用 EPS／價格樣本不足，暫時無法建立本益比河流。</div>';
  $('#peRiverPeriod').textContent=river?`${river.from} → ${river.to}`:'近 3 年';$('#peRiverSource').textContent='資料來源：MOPS 官方季度 EPS＋TWSE / TPEx 官方股價歷史。河流採滾動四季 EPS 與歷史 PE 分位數計算，屬研究估值工具。';
  const items=targetData?.items||[];targets.innerHTML=items.length?items.slice(0,8).map(x=>`<a class="valuationTargetRow" href="${E(x.url)}" target="_blank" rel="noopener"><b>${E(x.broker||x.source||'公開來源')}</b><span>${E(x.title)}</span><strong>${fmt(x.target)}</strong><small>${E(x.date||'')}</small></a>`).join(''):'<div class="empty">近期公開新聞索引沒有足夠可辨識的目標價樣本。</div>';$('#valuationTargetSource').textContent=targetData?.source||'資料來源：GDELT 公開新聞索引；僅摘錄可追溯原文的券商／分析師目標價。';
 }catch(e){sum.innerHTML=`<div class="empty">估值資料暫時無法取得：${E(e.message)}</div>`;chart.innerHTML='';targets.innerHTML=''}
}
function chainRows(items){return items?.length?items.map(x=>`<button class="chainStock" data-chain-code="${E(x.code)}"><b>${E(x.name)} <span>${E(x.code)}</span></b><small>${E(x.industry||'')}</small></button>`).join(''):'<div class="empty">目前沒有明確產業分類關聯。</div>'}
async function loadSupplyChain(){
 if(loaded.has('chain'))return;loaded.add('chain');const sum=$('#chainSummary');if(!sum)return;if(market!=='TW'||lastData?.snapshot?.assetHint==='ETF'){sum.innerHTML='<div class="empty">目前供應鏈導覽優先支援台股公司。</div>';return}
 try{const j=await fetch(`/api/supply-chain?code=${encodeURIComponent(current)}`).then(r=>r.json());if(!j.ok)throw new Error(j.error||'資料不足');sum.innerHTML=[mini('公司',j.current?.name||current),mini('產業',j.current?.industry||'—'),mini('上游關聯',j.upstream?.length||0),mini('下游關聯',j.downstream?.length||0)].join('');$('#chainUpstream').innerHTML=chainRows(j.upstream);$('#chainPeers').innerHTML=chainRows(j.peers);$('#chainDownstream').innerHTML=chainRows(j.downstream);$$('[data-chain-code]').forEach(b=>b.onclick=()=>openSymbol('TW',b.dataset.chainCode));$('#chainSource').textContent=`資料來源：${j.source||'TWSE / TPEx 官方公司主檔'}。${j.note||''}`}
 catch(e){sum.innerHTML=`<div class="empty">供應鏈資料暫時無法取得：${E(e.message)}</div>`;$('#chainUpstream').innerHTML='';$('#chainPeers').innerHTML='';$('#chainDownstream').innerHTML=''}
}
async function switchSub(id){
 const requested=document.querySelector(`.subTab[data-sub="${id}"]`);
 if(requested?.classList.contains('hidden'))id='company';
 $('#deepPanel').classList.remove('hidden');$$('.subTab').forEach(x=>x.classList.toggle('active',x.dataset.sub===id));$$('.subPanel').forEach(x=>x.classList.toggle('active',x.id===`sub-${id}`));if(id==='chips')loadChips();if(id==='fund')loadFund();if(id==='valuation')loadValuationPanel();if(id==='chain')loadSupplyChain();if(id==='company')loadCompany()}

function openSymbol(m,c){setMarket(m);showScreen('market');$('#q').value=c;search(c)}
window.openSymbol=openSymbol;
async function loadIndustry(force=false){
 if(industryData&&!force&&industryData.market===industryMarket){renderIndustry();return}
 $('#industryChips').innerHTML='<div class="skeleton" style="min-width:220px;height:46px"></div>';$('#industryList').innerHTML='<div class="skeleton"></div>';$('#industrySource').innerHTML='<span class="loader"></span>讀取產業分類…';
 try{const r=await fetch(`/api/industry?market=${industryMarket}`,{cache:force?'no-store':'default'}),j=await r.json();industryData=j;industrySelected='';$('#industrySource').textContent=(j.source||'產業資料')+(j.errors?.length?` · 部分來源暫時失效：${j.errors.join(' / ')}`:'');renderIndustry()}catch(e){$('#industrySource').textContent='產業資料失敗：'+e.message;$('#industryChips').innerHTML='';$('#industryList').innerHTML='<div class="empty">目前無法載入產業分類。</div>'}
}
function renderIndustry(){
 if(!industryData)return;const q=($('#industrySearch')?.value||'').trim().toUpperCase(),sectors=industryData.sectors||[];
 $('#industryChips').innerHTML=`<button class="industryChip ${!industrySelected?'active':''}" data-industry="">全部</button>`+sectors.map(s=>`<button class="industryChip ${industrySelected===s.id?'active':''}" data-industry="${E(s.id)}">${E(s.name)} <small>${s.count}</small></button>`).join('');
 $$('#industryChips .industryChip').forEach(b=>b.onclick=()=>{industrySelected=b.dataset.industry||'';renderIndustry()});
 let a=(industryData.items||[]).filter(x=>(!industrySelected||x.industryCode===industrySelected)&&(!q||x.code.includes(q)||x.name.toUpperCase().includes(q)||String(x.industry||'').toUpperCase().includes(q)));
 const title=industrySelected?(sectors.find(s=>s.id===industrySelected)?.name||'產業'):'全部產業';$('#industryTitle').textContent=title;$('#industryCount').textContent=`${a.length} 檔`;$('#industryNote').textContent=industryMarket==='TW'?'上市／上櫃公司依交易所產業類別整理。':'美股採高流動性產業快選，避免一次載入全市場造成延遲。';
 $('#industryList').innerHTML=a.length?a.slice(0,300).map(x=>`<button class="industryStock" data-code="${E(x.code)}"><div class="left"><b>${E(x.name)} <span class="muted">${E(x.code)}</span></b><small>${E(x.market)} · ${E(x.industry)}</small></div><span class="openArrow">›</span></button>`).join(''):'<div class="empty">沒有符合條件的公司。</div>';
 $$('#industryList .industryStock').forEach(b=>b.onclick=()=>openSymbol(industryMarket,b.dataset.code));
}
function setIndustryMarket(m){industryMarket=m;industryData=null;industrySelected='';$$('.industryMarket').forEach(b=>b.classList.toggle('active',b.dataset.imarket===m));$('#industrySearch').value='';loadIndustry(true)}
function ym(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function niceDate(s){if(!s)return'—';const d=new Date(s+'T00:00:00');return `${d.getMonth()+1}/${d.getDate()}`}
function sameMonthDate(y,m,day){return `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
async function loadCalendar(force=false){
 const month=ym(calendarDate);$('#calMonthTitle').textContent=`${calendarDate.getFullYear()} 年 ${calendarDate.getMonth()+1} 月`;$('#calMonthSub').textContent='上市＋上櫃官方預告';
 $('#calendarGrid').innerHTML='<div class="skeleton" style="grid-column:1/-1;height:180px"></div>';$('#dividendList').innerHTML='<div class="skeleton"></div>';
 try{const r=await fetch(`/api/dividends?month=${month}&high=5`,{cache:force?'no-store':'default'}),j=await r.json();calendarItems=j.items||[];calendarSelected='';renderCalendar(j)}catch(e){calendarItems=[];$('#calendarGrid').innerHTML='<div class="empty" style="grid-column:1/-1">行事曆資料暫時無法使用。</div>';$('#dividendList').innerHTML=`<div class="empty">${E(e.message)}</div>`}
}
function renderCalendar(meta={}){
 const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),today=new Date(),by={};for(const x of calendarItems)(by[x.date]||(by[x.date]=[])).push(x);
 let html='';for(let i=0;i<first;i++)html+='<div class="calDay emptyDay"></div>';for(let d=1;d<=days;d++){const date=sameMonthDate(y,m,d),a=by[date]||[],isToday=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;html+=`<button class="calDay ${a.length?'hasEvent':''} ${calendarSelected===date?'selected':''} ${isToday?'today':''}" data-date="${date}"><span class="dayNum">${d}</span><span class="calEvents">${a.slice(0,2).map(x=>`<span class="calEvent ${x.highYield?'high':''}">${E(x.code)} ${E(x.name)}</span>`).join('')}${a.length>2?`<span class="calMore">+${a.length-2}</span>`:''}</span></button>`}
 $('#calendarGrid').innerHTML=html;$$('#calendarGrid .calDay[data-date]').forEach(b=>b.onclick=()=>{const d=b.dataset.date;calendarSelected=calendarSelected===d?'':d;renderCalendar(meta)});
 const exDiv=calendarItems.filter(x=>String(x.type).includes('息')).length,exRight=calendarItems.filter(x=>String(x.type).includes('權')).length,hi=calendarItems.filter(x=>x.highYield).length;$('#calendarSummary').innerHTML=[mini('本月事件',String(calendarItems.length)),mini('含除息',String(exDiv)),mini('含除權',String(exRight)),mini('高殖利率',String(hi),hi?'up':'')].join('');
 renderDividendList();if(meta.errors?.length)$('#calMonthSub').textContent='部分來源暫時失效 · '+meta.errors.join(' / ');
}
function renderDividendList(){
 let a=calendarItems.filter(x=>(!calendarSelected||x.date===calendarSelected)&&(!calendarHighOnly||x.highYield));$('#dayEventTitle').textContent=calendarSelected?`${niceDate(calendarSelected)} 除權息清單`:'本月除權息清單';$('#highYieldOnly').classList.toggle('active',calendarHighOnly);
 $('#dividendList').innerHTML=a.length?a.map(x=>`<button class="dividendItem" data-code="${E(x.code)}"><div class="divDate">${niceDate(x.date)}<br><span class="muted">${E(x.market)}</span></div><div class="dividendMain"><b>${E(x.name)} <span class="muted">${E(x.code)}</span></b><span>${E(x.type)} · 現金股利 ${Number.isFinite(x.cashDividend)?fmt(x.cashDividend,4)+' 元':'待公告'}${Number.isFinite(x.stockDividendRatio)&&x.stockDividendRatio?` · 配股率 ${fmt(x.stockDividendRatio,4)}`:''}</span></div><div class="yieldBox"><strong>${Number.isFinite(x.eventYield)?fmt(x.eventYield,2)+'%':'—'}</strong><small>單次配息率</small>${x.yieldLevel&&x.yieldLevel!=='unknown'&&x.yieldLevel!=='normal'?`<span class="yieldBadge ${E(x.yieldLevel)}">${x.yieldLevel==='very-high'?'特高':x.yieldLevel==='high'?'高':'偏高'}</span>`:''}</div></button>`).join(''):'<div class="empty">目前沒有符合條件的除權息事件。</div>';
 $$('#dividendList .dividendItem').forEach(b=>b.onclick=()=>openSymbol('TW',b.dataset.code));
}
function moveCalendar(n){calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+n,1);loadCalendar(true)}
async function loadRadar(force=false){if(radarLoaded&&!force)return;radarLoaded=true;$('#radarList').innerHTML='<div class="skeleton"></div>';$('#refreshRadar').textContent='掃描中…';try{const j=await fetch('/api/radar',{cache:'no-store'}).then(r=>r.json()),a=j.items||[];$('#radarList').innerHTML=a.length?a.map((x,i)=>`<div class="radarCard" data-code="${E(x.code)}"><div class="rank">${i+1}</div><div><div class="radarName">${E(x.name)} ${E(x.code)} <span class="${x.changePct>0?'up':'down'}" style="margin-left:5px;font-size:11px">${x.changePct>0?'+':''}${fmt(x.changePct,2)}%</span></div><div class="radarReason">${E((x.reasons||[]).join(' · '))}${x.event?` · 重大訊息：${E(x.event.slice(0,42))}`:''}</div></div><div class="scoreBubble" title="綜合強勢分數">${x.score}</div></div>`).join(''):'<div class="empty">目前雷達資料暫時不足。</div>';$$('.radarCard').forEach(c=>c.onclick=()=>{setMarket('TW');showScreen('market');$('#q').value=c.dataset.code;search(c.dataset.code)})}catch(e){$('#radarList').innerHTML='<div class="empty">強勢雷達暫時無法使用：'+E(e.message)+'</div>'}finally{$('#refreshRadar').textContent='重新掃描'}}
$$('[data-screen]').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));$$('.marketBtn').forEach(b=>b.onclick=()=>setMarket(b.dataset.market));$('#go').onclick=()=>search($('#q').value);$('#q').onkeydown=e=>{if(e.key==='Enter')search(e.target.value)};$('#favBtn').onclick=toggleFav;$('#adviceBtn').onclick=openAdvice;$('#etfHoldBtn').onclick=openETFHoldings;$('#etfFilter').oninput=e=>renderEtfHoldings(e.target.value);$('#newsMoreBtn').onclick=toggleNews;$('#settingsBtn').onclick=()=>{$('#avKey').value=localStorage.getItem('pulse-av-key')||'';openSheet('settingsSheet')};$('#backdrop').onclick=closeSheets;$$('.sheetClose,.popupClose').forEach(b=>b.onclick=closeSheets);$('#saveKey').onclick=()=>{const k=$('#avKey').value.trim();if(!k)return toast('請貼上 API Key');localStorage.setItem('pulse-av-key',k);closeSheets();toast('美股 Key 已儲存在此瀏覽器')};$('#clearKey').onclick=()=>{localStorage.removeItem('pulse-av-key');$('#avKey').value='';toast('已清除美股 Key')};$('#lineMode').onclick=()=>{chartMode='line';$('#lineMode').classList.add('active');$('#techMode').classList.remove('active');renderLineChart()};$('#techMode').onclick=()=>{chartMode='tech';$('#techMode').classList.add('active');$('#lineMode').classList.remove('active');renderTechChart()};$$('#intradayBar button').forEach(b=>b.onclick=()=>{intradayBucket=+b.dataset.bucket||60;$$('#intradayBar button').forEach(x=>x.classList.toggle('active',x===b));if(chartMode==='line')renderLineChart()});$$('#rangeBar button').forEach(b=>b.onclick=()=>{const n=+b.dataset.months;if(n===chartRangeMonths)return;loadChartRange(n)});$$('.subTab').forEach(b=>b.onclick=()=>switchSub(b.dataset.sub));$('#refreshWatch').onclick=refreshWatch;$('#refreshRadar').onclick=()=>loadRadar(true);$$('.industryMarket').forEach(b=>b.onclick=()=>setIndustryMarket(b.dataset.imarket));$('#industrySearch').oninput=renderIndustry;$('#calPrev').onclick=()=>moveCalendar(-1);$('#calNext').onclick=()=>moveCalendar(1);$('#refreshCalendar').onclick=()=>loadCalendar(true);$('#highYieldOnly').onclick=()=>{calendarHighOnly=!calendarHighOnly;renderDividendList()};
renderQuick();renderWatch();try{const p=JSON.parse(localStorage.getItem('pulse-last')||'null');const u=new URLSearchParams(location.search),m=u.get('market')||p?.market,c=u.get('code');if(m&&['TW','US'].includes(m))setMarket(m);if(c){$('#q').value=c;search(c)}}catch{}

(()=>{
'use strict';
const V5={kFrame:'D',drawMode:'',drawPts:[],drawings:[],lab:null,advanced:null,news90:null,benchmark:null,compareChart:null,compareRO:null,alerts:JSON.parse(localStorage.getItem('pulse-alerts-v5')||'{}'),layout:localStorage.getItem('pulse-layout-v5')||'research'};
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const mean=a=>{const b=a.filter(Number.isFinite);return b.length?b.reduce((s,x)=>s+x,0)/b.length:null};
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const last=a=>a?.length?a[a.length-1]:null;
const med=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b[Math.floor((b.length-1)/2)]:null};
const sd=a=>{const m=mean(a);return m==null?null:Math.sqrt(mean(a.map(x=>(x-m)**2))||0)};
const fmtPct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(1)}%`:'—';
function sma(a,n){let out=Array(a.length).fill(null),sum=0,c=0;for(let i=0;i<a.length;i++){let x=a[i];if(Number.isFinite(x)){sum+=x;c++}if(i>=n){let o=a[i-n];if(Number.isFinite(o)){sum-=o;c--}}if(i>=n-1&&c===n)out[i]=sum/n}return out}
function ema(a,n){let out=Array(a.length).fill(null),k=2/(n+1),p=null;for(let i=0;i<a.length;i++){let x=a[i];if(!Number.isFinite(x))continue;p=p==null?x:x*k+p*(1-k);out[i]=p}return out}
function rsi(a,n=14){let o=Array(a.length).fill(null);if(a.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){let d=a[i]-a[i-1];d>=0?g+=d:l-=d}let ag=g/n,al=l/n;o[n]=al===0?100:100-100/(1+ag/al);for(let i=n+1;i<a.length;i++){let d=a[i]-a[i-1],gg=Math.max(d,0),ll=Math.max(-d,0);ag=(ag*(n-1)+gg)/n;al=(al*(n-1)+ll)/n;o[i]=al===0?100:100-100/(1+ag/al)}return o}
function macd(a){let e12=ema(a,12),e26=ema(a,26),dif=a.map((_,i)=>Number.isFinite(e12[i])&&Number.isFinite(e26[i])?e12[i]-e26[i]:null),dea=ema(dif.map(x=>x??0),9).map((x,i)=>dif[i]==null?null:x),hist=dif.map((x,i)=>Number.isFinite(x)&&Number.isFinite(dea[i])?(x-dea[i])*2:null);return{dif,dea,hist}}
function kd(rows,n=9){let K=Array(rows.length).fill(null),D=Array(rows.length).fill(null),k=50,d=50;for(let i=n-1;i<rows.length;i++){let w=rows.slice(i-n+1,i+1),hi=Math.max(...w.map(x=>x.high??x.close)),lo=Math.min(...w.map(x=>x.low??x.close)),r=hi===lo?50:(rows[i].close-lo)/(hi-lo)*100;k=k*2/3+r/3;d=d*2/3+k/3;K[i]=k;D[i]=d}return{k:K,d:D}}
function obv(rows){let out=Array(rows.length).fill(0),v=0;for(let n=1;n<rows.length;n++){let q=Number(rows[n].volume)||0;if(rows[n].close>rows[n-1].close)v+=q;else if(rows[n].close<rows[n-1].close)v-=q;out[n]=v}return out}
function indicators(rows){let c=rows.map(x=>x.close),m5=sma(c,5),m10=sma(c,10),m20=sma(c,20),m60=sma(c,60),rr=rsi(c),mm=macd(c),kk=kd(rows);return{c,ma5:m5,ma10:m10,ma20:m20,ma60:m60,rsi:rr,macd:mm,kd:kk,obv:obv(rows)}}
function aggregate(rows,frame){if(frame==='D')return rows.slice();const groups=new Map();for(const r of rows){const d=new Date(r.date+'T00:00:00');let key;if(frame==='M')key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;else{const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);key=x.toISOString().slice(0,10)}let g=groups.get(key);if(!g)groups.set(key,g={date:key,open:r.open,high:r.high,low:r.low,close:r.close,volume:0});else{g.high=Math.max(g.high,r.high);g.low=Math.min(g.low,r.low);g.close=r.close}g.volume+=(r.volume||0)}return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date))}
function addLineV5(ch,arr,color,width,pane=0,extra={}){if(!arr?.length)return null;const s=ch.addSeries(LightweightCharts.LineSeries,{color,lineWidth:width,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,...extra},pane);s.setData(arr.filter(x=>Number.isFinite(x.value)));return s}
function seriesFrom(rows,a){return rows.map((r,i)=>Number.isFinite(a[i])?{time:r.date,value:a[i]}:null).filter(Boolean)}
function bt(rows,signal,horizons=[5,10,20]){let events=[];for(let i=0;i<rows.length-Math.max(...horizons);i++)if(signal(i,rows)){let e={i,date:rows[i].date};for(const h of horizons){let ret=(rows[i+h].close/rows[i].close-1)*100;e[h]=ret}events.push(e)}const stats={count:events.length};for(const h of horizons){let vals=events.map(x=>x[h]).filter(Number.isFinite);stats[h]={win:vals.length?vals.filter(x=>x>0).length/vals.length*100:null,avg:mean(vals)}}return{events,stats}}
function backtestText(bt,h=10){const x=bt?.stats?.[h];return bt?.stats?.count?`近3年此訊號出現 ${bt.stats.count} 次，${h}日後上漲機率 ${x?.win?.toFixed(0)??'—'}%，平均報酬 ${fmtPct(x?.avg)}`:'近3年有效樣本不足，暫不顯示勝率'}
function miniLineSvg(rows,keys,labels){if(!rows?.length)return'<div class="empty">資料不足</div>';const W=520,H=150,pad=18,vals=[];for(const r of rows)for(const k of keys)if(Number.isFinite(r[k]))vals.push(r[k]);if(!vals.length)return'<div class="empty">資料不足</div>';let min=Math.min(...vals),max=Math.max(...vals);if(max===min){max+=1;min-=1}const x=i=>pad+(W-pad*2)*(i/Math.max(1,rows.length-1)),y=v=>H-pad-(H-pad*2)*(v-min)/(max-min);let colors=['#675cf5','#10b79a','#ff8c42','#e84b68'];let paths=keys.map((k,ki)=>{let d='';rows.forEach((r,i)=>{if(!Number.isFinite(r[k]))return;d+=(d?' L ':'M ')+`${x(i).toFixed(1)} ${y(r[k]).toFixed(1)}`});return `<path d="${d}" fill="none" stroke="${colors[ki]}" stroke-width="2" vector-effect="non-scaling-stroke"/>`}).join('');return `<svg viewBox="0 0 ${W} ${H}" class="miniSvg" role="img">${paths}</svg><div class="miniLegend">${labels.map((l,i)=>`<span><i style="background:${colors[i]}"></i>${E(l)}</span>`).join('')}</div>`}
function radarSvg(scores){const W=250,H=220,cx=125,cy=108,R=82,axes=['技術','籌碼','基本','消息'],pts=axes.map((_,i)=>{let a=-Math.PI/2+i*Math.PI/2;return[cx+Math.cos(a)*R,cy+Math.sin(a)*R]}),poly=(r)=>pts.map((p,i)=>{let rr=r*(scores[i]/100),a=-Math.PI/2+i*Math.PI/2;return`${cx+Math.cos(a)*R*rr},${cy+Math.sin(a)*R*rr}`}).join(' '),grid=[.25,.5,.75,1].map(r=>`<polygon points="${pts.map((p,i)=>{let a=-Math.PI/2+i*Math.PI/2;return`${cx+Math.cos(a)*R*r},${cy+Math.sin(a)*R*r}`}).join(' ')}" fill="none" stroke="rgba(120,130,160,.25)"/>`).join('');return `<svg viewBox="0 0 ${W} ${H}" class="radarSvg">${grid}<line x1="${cx}" y1="${cy-R}" x2="${cx}" y2="${cy+R}" stroke="rgba(120,130,160,.2)"/><line x1="${cx-R}" y1="${cy}" x2="${cx+R}" y2="${cy}" stroke="rgba(120,130,160,.2)"/><polygon points="${poly(1)}" fill="rgba(103,92,245,.18)" stroke="#675cf5" stroke-width="2"/>${axes.map((t,i)=>{let a=-Math.PI/2+i*Math.PI/2;return`<text x="${cx+Math.cos(a)*(R+21)}" y="${cy+Math.sin(a)*(R+21)+4}" text-anchor="middle" font-size="12" fill="currentColor">${t}</text>`}).join('')}</svg>`}
function card(title,badge,body,detail='',cls=''){return `<article class="labCard ${cls}"><div class="labHead"><div><h4>${title}</h4>${badge?`<span class="labBadge">${badge}</span>`:''}</div></div><div class="labBody">${body}</div>${detail?`<details><summary>計算邏輯／歷史驗證</summary><div class="labDetail">${detail}</div></details>`:''}</article>`}
function scoreFund(fin,rev){let s=50,reasons=[];const rows=fin?.rows||[],q=last(rows),prev=rows.at(-5),r=last(rev?.rows||[]);if(Number.isFinite(r?.yoy)){let d=clamp(r.yoy,-30,30)/3;s+=d;reasons.push(`月營收 YoY ${fmtPct(r.yoy)}`)}if(Number.isFinite(q?.eps)&&Number.isFinite(prev?.eps)&&prev.eps!==0){let g=(q.eps/prev.eps-1)*100;s+=clamp(g,-30,30)/3;reasons.push(`EPS 年增 ${fmtPct(g)}`)}if(Number.isFinite(q?.netIncome)&&Number.isFinite(q?.equity)&&q.equity){let roe=q.netIncome/q.equity*4*100;s+=(roe-10)*.6;reasons.push(`季化 ROE 約 ${roe.toFixed(1)}%`)}if(Number.isFinite(q?.operatingCashFlow)){s+=q.operatingCashFlow>0?6:-6;reasons.push(`營業現金流${q.operatingCashFlow>0?'為正':'為負'}`)}if(Number.isFinite(q?.liabilities)&&Number.isFinite(q?.assets)&&q.assets){let dr=q.liabilities/q.assets*100;s+=(55-dr)*.2;reasons.push(`負債比約 ${dr.toFixed(1)}%`)}return{score:Math.round(clamp(s)),reasons}}
function sentimentScore(items){const pos=['調高','上修','成長','創高','優於','突破','獲利','看好','買進','增持','強勁','beat','upgrade','growth','record','surge','buy'],neg=['調降','下修','衰退','虧損','警告','裁員','跌破','賣出','減持','疲弱','miss','downgrade','loss','warning','sell','probe'];let rows=(items||[]).map(x=>{let t=(x.title||'').toLowerCase(),v=0;for(const w of pos)if(t.includes(w))v++;for(const w of neg)if(t.includes(w))v--;return{...x,sent:clamp(v,-3,3)}});let m=mean(rows.map(x=>x.sent))??0;return{score:Math.round(clamp(50+m*13)),mean:m,rows}}
function chipScoreLocal(d){try{return chipModel(d)}catch{}let s=50,r=[];const inst=d?.institutional||[],sum5=inst.slice(-5).reduce((a,x)=>a+(x.total||0),0);if(sum5>0){s+=12;r.push('近5日法人偏買')}else if(sum5<0){s-=12;r.push('近5日法人偏賣')}let h=d?.tdccHistory||[];if(h.length>=2){let x=h.at(-1).big400-h.at(-2).big400;s+=clamp(x*8,-12,12);r.push(`400張以上週變 ${x>0?'+':''}${x.toFixed(2)}pp`)}return{score:Math.round(clamp(s)),reasons:r}}
function techScoreLocal(){let s=lastData?.analysis?.score;if(Number.isFinite(s))return Math.round(clamp(s));const h=lastData?.history||[],i=indicators(h),n=h.length-1,p=h[n]?.close;let x=50;if(p>i.ma20[n])x+=12;if(i.ma20[n]>i.ma60[n])x+=12;if(i.macd.hist[n]>0)x+=10;if(i.rsi[n]>50&&i.rsi[n]<75)x+=8;return Math.round(clamp(x))}
function priceVolumeHealth(rows){if(rows.length<25)return null;let p5=pct(rows.at(-1).close,rows.at(-6).close),v5=mean(rows.slice(-5).map(x=>x.volume)),vp=mean(rows.slice(-25,-5).map(x=>x.volume)),vc=pct(v5,vp);let state,color;if(p5>=0&&vc>=0){state='健康上漲';color='green'}else if(p5>=0&&vc<0){state='假突破警示';color='yellow'}else if(p5<0&&vc>=0){state='恐慌賣壓';color='red'}else{state='惜售止跌';color='green'}let strength=Math.round(clamp(50+(p5||0)*2+(vc||0)*.3));return{p5,vc,state,color,score:strength}}
function pvQuadrantSvg(x,y){const xx=clamp(50+x*4,5,95),yy=clamp(50-y*.6,5,95);return `<div class="quadrant"><span class="q q1">健康上漲</span><span class="q q2">假突破</span><span class="q q3">惜售止跌</span><span class="q q4">恐慌賣壓</span><i style="left:${xx}%;top:${yy}%"></i></div>`}
function volumeProfile(rows,bins=30){if(!rows.length)return null;let lo=Math.min(...rows.map(x=>x.low)),hi=Math.max(...rows.map(x=>x.high));if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)return null;let step=(hi-lo)/bins,a=Array.from({length:bins},(_,i)=>({lo:lo+i*step,hi:lo+(i+1)*step,mid:lo+(i+.5)*step,volume:0}));for(const r of rows){let p=(r.high+r.low+r.close)/3,ix=Math.max(0,Math.min(bins-1,Math.floor((p-lo)/step)));a[ix].volume+=(r.volume||0)}let top=a.slice().sort((x,y)=>y.volume-x.volume).slice(0,3);return{bins:a,top,lo,hi,max:Math.max(...a.map(x=>x.volume))}}
function renderVPOverlay(rows,cs){const el=$('#volumeProfileOverlay');if(!el||!chart||!cs){el?.classList.add('hidden');return}const vp=volumeProfile(rows.slice(-180));if(!vp){el.classList.add('hidden');return}el.innerHTML='';el.classList.remove('hidden');let w=el.clientWidth||120;for(const b of vp.bins){if(!b.volume)continue;let y=cs.priceToCoordinate(b.mid);if(!Number.isFinite(y))continue;let bar=document.createElement('i');bar.style.top=`${y}px`;bar.style.width=`${Math.max(2,b.volume/vp.max*w*.22)}px`;bar.title=`${b.mid.toFixed(2)} · 量 ${Math.round(b.volume).toLocaleString()}`;el.appendChild(bar)}for(const z of vp.top){try{cs.createPriceLine({price:z.mid,color:'rgba(103,92,245,.4)',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'VP'})}catch{}}}
function frameSignal(rows){let i=indicators(rows),n=rows.length-1;if(n<20)return{ok:false,score:0};let p=rows[n].close,checks=[p>i.ma20[n],i.ma5[n]>i.ma20[n],i.macd.hist[n]>0,i.rsi[n]>=48&&i.rsi[n]<=75,i.ma20[n]>(i.ma20[n-5]??i.ma20[n])],score=checks.filter(Boolean).length/5*100;return{ok:score>=80,score:Math.round(score),checks}}
function resonance(rows){let D=frameSignal(aggregate(rows,'D')),W=frameSignal(aggregate(rows,'W')),M=frameSignal(aggregate(rows,'M'));return{D,W,M,ok:D.ok&&W.ok&&M.ok,score:Math.round((D.score+W.score+M.score)/3)}}
function fakeBreakoutDaily(rows){let ind=indicators(rows);return bt(rows,(i,a)=>{if(i<20)return false;let prior=Math.max(...a.slice(i-20,i).map(x=>x.high)),avg=mean(a.slice(i-20,i).map(x=>x.volume))||1;return a[i].high>prior&&(a[i].close<prior||a[i].volume/avg<1.2)})}
function currentFakeBreakout(){if(market!=='TW'||!lastData)return null;const h=lastData.history||[];if(h.length<22)return null;let prior=Math.max(...h.slice(-21,-1).map(x=>x.high)),sess=readRawSession(lastData.snapshot)||[],breakRow=sess.find(x=>x.value>prior);if(!breakRow)return{flag:false,reason:`尚未突破20日壓力 ${fmt(prior)}`,prior};let now=last(sess),elapsed=now?.time-breakRow.time,bid=now?.bidDepth??0,ask=now?.askDepth??0,ratio=ask?bid/ask:null,recent=sess.filter(x=>x.time>=now.time-300).map(x=>x.tradeVolume||0),older=sess.filter(x=>x.time<now.time-300&&x.time>=now.time-600).map(x=>x.tradeVolume||0),shrinking=(mean(recent)||0)<(mean(older)||Infinity),returned=now.value<prior,flag=elapsed>=1800&&returned&&shrinking;return{flag,reason:flag?'突破後30分鐘內量縮且價格回到壓力下方':'已突破，持續監測30分鐘量價與五檔厚度',prior,elapsed,ratio}}
function appendDepthSession(q){try{if(!lastData?.snapshot||!q?.available)return;let s=lastData.snapshot,a=readRawSession(s);if(!a.length)return;let r=a[a.length-1],t=linePointTime(q.date||s.date,q.time||'13:30:00');if(r.time!==t)return;r.bidDepth=(q.bidVolumes||[]).reduce((u,x)=>u+(Number(x)||0),0);r.askDepth=(q.askVolumes||[]).reduce((u,x)=>u+(Number(x)||0),0);writeRawSession(s,a)}catch{}}
const oldAppendSession=appendSession;appendSession=function(q){oldAppendSession(q);appendDepthSession(q)};
async function getAdvanced(){if(market!=='TW'||!lastData)return null;if(V5.advanced?.code===current)return V5.advanced;let m=lastData.snapshot.market==='TPEx'?'TPEX':'TWSE';V5.advanced=await fetch(`/api/advanced?code=${encodeURIComponent(current)}&market=${m}`).then(r=>r.json());return V5.advanced}
function divergenceModel(a){let inst=a?.institutional||[],mg=a?.marginHistory||[];if(inst.length<5||mg.length<5)return null;let sum5=inst.slice(-5).reduce((s,x)=>s+(x.total||0),0),m0=mg.at(-6)?.marginBalance,m1=mg.at(-1)?.marginBalance,mc=pct(m1,m0),flag=sum5>0&&mc<0?'潛在買點':sum5<0&&mc>0?'潛在賣點':'無明顯背離',score=Math.round(clamp(50+(sum5>0?20:sum5<0?-20:0)+(mc<0?20:mc>0?-20:0)));let merged=mg.slice(-15).map((x,i)=>({date:x.date,margin:mc==null?0:(x.marginBalance/(mg[0]?.marginBalance||x.marginBalance)-1)*100,inst:(inst.slice(0,Math.min(inst.length,i+1)).reduce((s,z)=>s+(z.total||0),0))/1e6}));return{sum5,mc,flag,score,merged}}
function divergenceBacktest(a,rows){let inst=a?.institutional||[],mg=a?.marginHistory||[];let map=new Map(rows.map((r,i)=>[r.date,i]));let ev=[];for(let k=5;k<Math.min(inst.length,mg.length);k++){let sum=inst.slice(Math.max(0,k-4),k+1).reduce((s,x)=>s+(x.total||0),0),m0=mg[Math.max(0,k-5)]?.marginBalance,m1=mg[k]?.marginBalance,mc=pct(m1,m0),buy=sum>0&&mc<0,idx=map.get(inst[k]?.date)||map.get(mg[k]?.date);if(buy&&Number.isInteger(idx))ev.push(idx)}return bt(rows,i=>ev.includes(i))}
async function getNews90(){if(V5.news90?.code===current)return V5.news90;let q=`/api/news?market=${market}&code=${encodeURIComponent(current)}&name=${encodeURIComponent(lastData?.snapshot?.name||current)}&days=90`;V5.news90=await fetch(q).then(r=>r.json()).catch(()=>({items:[]}));V5.news90.code=current;return V5.news90}
async function getBenchmark(){if(V5.benchmark)return V5.benchmark;V5.benchmark=await fetch('/api/benchmark?months=36').then(r=>r.json()).catch(()=>null);return V5.benchmark}
function antiFragile(rows,bm){let br=bm?.rows||[];if(!br.length)return null;let sm=new Map(rows.map(x=>[x.date,x])),aligned=[];for(const b of br){let s=sm.get(b.date);if(s)aligned.push({date:b.date,s:s.close,b:b.close})}if(aligned.length<60)return null;let sr=aligned.map((x,i)=>i?pct(x.s,aligned[i-1].s):null),mr=aligned.map((x,i)=>i?pct(x.b,aligned[i-1].b):null),down=mr.map((x,i)=>Number.isFinite(x)&&x<=-1.5?i:null).filter(Number.isInteger),ex=down.map(i=>(sr[i]??0)-(mr[i]??0)),capture=mean(down.map(i=>mr[i]?((sr[i]??0)/mr[i])*100:null)),score=Math.round(clamp(55+(mean(ex)||0)*12+(100-(capture??100))*.12));let events=down.slice(-12).map(i=>({date:aligned[i].date,market:mr[i],stock:sr[i],excess:(sr[i]??0)-(mr[i]??0)}));return{score,capture,excess:mean(ex),events}}
function sentimentDivergence(news,rows){let s=sentimentScore(news?.items||[]),ret5=rows.length>5?pct(rows.at(-1).close,rows.at(-6).close):null,flag='無明顯背離';if(s.mean<=-.35&&ret5>=-1)flag='利空出盡股價止跌';if(s.mean>=.45&&ret5<=1)flag='消息過熱股價滯漲';let dated=s.rows.map(x=>({date:(x.date||x.seendate||'').slice(0,10),sent:x.sent})).filter(x=>x.date);return{...s,ret5,flag,dated}}
async function industryRotation(){if(market!=='TW')return null;let pj=deep.profile||await apiResearch('profile').catch(()=>null);let p=pj?.data||pj;if(!p?.industry)return null;let ind=await fetch('/api/industry?market=TW').then(r=>r.json()).catch(()=>null);let peers=(ind?.items||[]).filter(x=>String(x.industryCode)===String(p.industry)&&x.code!==current).slice(0,8);if(!peers.length)return null;let res=await Promise.all(peers.map(async x=>{try{let d=await fetch(`/api/stock?code=${x.code}&months=3`).then(r=>r.json()),h=d.history||[],r20=h.length>20?pct(h.at(-1).close,h.at(-21).close):null;return{...x,r20,score:d.analysis?.score,pe:d.snapshot?.pe,yield:d.snapshot?.yield,rows:h}}catch{return null}}));res=res.filter(Boolean);let own=lastData.history.length>20?pct(lastData.history.at(-1).close,lastData.history.at(-21).close):null,median=med(res.map(x=>x.r20));res.forEach(x=>x.catchup=Math.round(clamp(50+((median??0)-(x.r20??0))*2+((x.score??50)-50)*.5)));res.sort((a,b)=>b.catchup-a.catchup);return{industry:p.industry,own,median,peers:res.slice(0,6)}}
function sentimentBacktest(news,rows){let ss=sentimentScore(news?.items||[]),by={};for(const x of ss.rows){let d=String(x.date||x.seendate||'').slice(0,10);if(d)(by[d]||(by[d]=[])).push(x.sent)}let idx=new Map(rows.map((r,i)=>[r.date,i])),signals=new Set();for(const [d,a] of Object.entries(by)){let i=idx.get(d);if(i==null||i<5)continue;let m=mean(a),r5=pct(rows[i].close,rows[i-5].close);if(m<=-.35&&r5>=-1)signals.add(i)}return bt(rows,i=>signals.has(i))}
function rotationBacktest(rot,rows){if(!rot?.peers?.length)return null;let maps=rot.peers.map(p=>new Map((p.rows||[]).map(x=>[x.date,x.close]))),sig=new Set();for(let i=25;i<rows.length-20;i++){let date=rows[i].date,prev=rows[i-20].date,own=pct(rows[i].close,rows[i-20].close),prs=[];for(const m of maps){let a=m.get(date),b=m.get(prev);if(Number.isFinite(a)&&Number.isFinite(b))prs.push(pct(a,b))}let md=med(prs);if(prs.length>=3&&Number.isFinite(md)&&Number.isFinite(own)&&own<md-3)sig.add(i)}return bt(rows,i=>sig.has(i))}
function antiBacktest(rows,bm){let br=bm?.rows||[],sm=new Map(rows.map((r,i)=>[r.date,{r,i}])),signals=new Set();for(let i=1;i<br.length;i++){let mr=pct(br[i].close,br[i-1].close),x=sm.get(br[i].date),xp=sm.get(br[i-1].date);if(mr<=-1.5&&x&&xp){let sr=pct(x.r.close,xp.r.close);if(sr>mr)signals.add(x.i)}}return bt(rows,i=>signals.has(i))}
function fundamentalsBacktestProxy(rows){let ind=indicators(rows);return bt(rows,i=>i>=60&&ind.ma20[i]>ind.ma60[i]&&ind.ma20[i]>ind.ma20[i-5])}
function techSignalBT(rows){let i=indicators(rows);return bt(rows,(n)=>n>=60&&rows[n].close>i.ma20[n]&&i.ma5[n]>i.ma20[n]&&i.macd.hist[n]>0&&i.rsi[n]>=50&&i.rsi[n]<=72)}
function resonanceBT(rows){let i=indicators(rows);return bt(rows,n=>n>=120&&rows[n].close>i.ma20[n]&&i.ma20[n]>i.ma60[n]&&i.ma20[n]>i.ma20[n-10]&&rows[n].close>mean(rows.slice(n-60,n+1).map(x=>x.close)))}
function pvBT(rows,state){return bt(rows,(i,a)=>{if(i<25)return false;let x=priceVolumeHealth(a.slice(0,i+1));return x?.state===state})}
function volumeProfileBT(rows){return bt(rows,(i,a)=>{if(i<80)return false;let vp=volumeProfile(a.slice(Math.max(0,i-120),i+1)),p=a[i].close,z=vp?.top?.[0]?.mid;return Number.isFinite(z)&&Math.abs(p/z-1)<=.012})}
async function buildConfidence(fin,rev,news,chips){let t=techScoreLocal(),c=chipScoreLocal(chips),f=scoreFund(fin,rev),n=sentimentScore(news?.items||[]),total=Math.round(t*.30+c.score*.30+f.score*.25+n.score*.15);return{total,tech:t,chips:c.score,fund:f.score,news:n.score,details:{tech:['技術分數採趨勢、動能、量價與支撐壓力規則；權重30%。'],chips:c.reasons||[],fund:f.reasons,news:[`近90日可得新聞標題情緒均值 ${n.mean.toFixed(2)}；權重15%。`]}}}
function btTable(name,b){let s=b?.stats;if(!s?.count)return `<div class="btRow"><b>${E(name)}</b><span>資料不足</span></div>`;return `<div class="btRow"><b>${E(name)}</b><span>${s.count}次</span><span>5日 ${s[5].win?.toFixed(0)}% / ${fmtPct(s[5].avg)}</span><span>10日 ${s[10].win?.toFixed(0)}% / ${fmtPct(s[10].avg)}</span><span>20日 ${s[20].win?.toFixed(0)}% / ${fmtPct(s[20].avg)}</span></div>`}
async function loadDecisionLab(force=false){if(!lastData)return;if(V5.lab?.code===current&&!force){$('#labRoot').innerHTML=V5.lab.html;return}const root=$('#labRoot');root.innerHTML='<div class="skeleton" style="grid-column:1/-1;height:300px"></div>';try{const rows=(lastData.history||[]).slice(-760);let [chipsJ,revJ,finJ,adv,news,bm,rot]=await Promise.all([
  chipsData?Promise.resolve({data:chipsData}):apiResearch('chips').catch(()=>({data:{}})),
  apiResearch('revenue','&months=36').catch(()=>({data:{rows:[]}})),
  apiResearch('financials').catch(()=>({data:{rows:[]}})),
  getAdvanced().catch(()=>null),getNews90(),getBenchmark(),industryRotation().catch(()=>null)
 ]);let chips=chipsJ?.data||{},rev=revJ?.data||{},fin=finJ?.data||{};if(!chipsData)chipsData=chips;let conf=await buildConfidence(fin,rev,news,chips),div=divergenceModel(adv),pv=priceVolumeHealth(rows),res=resonance(rows),fb=currentFakeBreakout(),sent=sentimentDivergence(news,rows),anti=antiFragile(rows,bm);let btTech=techSignalBT(rows),btPv=pv?pvBT(rows,pv.state):null,btVp=volumeProfileBT(rows),btRes=resonanceBT(rows),btFake=fakeBreakoutDaily(rows),btDiv=div?divergenceBacktest(adv,rows):null,btFund=fundamentalsBacktestProxy(rows),btSent=sentimentBacktest(news,rows),btRot=rotationBacktest(rot,rows),btAnti=antiBacktest(rows,bm);
 let confBody=`<div class="confidenceWrap"><div class="confidenceScore"><strong>${conf.total}</strong><span>/100</span><small>${conf.total>=75?'高信心觀察':conf.total>=60?'偏多觀察':conf.total>=45?'中性觀察':'風險偏高'}</small></div>${radarSvg([conf.tech,conf.chips,conf.fund,conf.news])}</div><div class="scoreBars">${[['技術 30%',conf.tech],['籌碼 30%',conf.chips],['基本 25%',conf.fund],['消息 15%',conf.news]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b><i><em style="width:${v}%"></em></i></div>`).join('')}</div>`;
 let confDetail=`<p><b>公式：</b>技術×30%＋籌碼×30%＋基本×25%＋消息×15%。每個子分數都由可見規則計算。</p>${Object.entries(conf.details).map(([k,a])=>`<p>${a.map(E).join('；')}</p>`).join('')}<p><b>回測限制：</b>免費資料缺乏完整 point-in-time 歷史新聞與財報快照，因此完整四因子分數不硬算「假勝率」。下方回測中心改列可回溯模組的真實樣本。</p>`;
 let divBody=div?`<div class="flag ${div.flag.includes('買')?'good':div.flag.includes('賣')?'bad':'neutral'}">${div.flag}</div><div class="metricPairs"><span>近5日法人 <b>${money(div.sum5)}</b></span><span>融資5日動能 <b>${fmtPct(div.mc)}</b></span><span>背離分數 <b>${div.score}</b></span></div>${miniLineSvg(div.merged,['inst','margin'],['法人累積(百萬股)','融資變化%'])}`:`<div class="empty">目前歷史法人／融資樣本不足（上櫃公開歷史支援有限）。</div>`;
 let divDetail=`<p>近5日法人買賣超總和 > 0 且融資餘額下降 → 潛在買點；法人賣超且融資增加 → 潛在賣點。這代表「專業資金與散戶槓桿行為方向相反」，不等於保證反轉。</p><p>${div&&btDiv?backtestText(btDiv):'可對齊樣本不足，暫不顯示勝率。'}</p>`;
 let pvBody=pv?`<div class="traffic ${pv.color}"><i></i><strong>${pv.state}</strong><span>${pv.score}/100</span></div>${pvQuadrantSvg(pv.p5,pv.vc)}<div class="metricPairs"><span>5日價格 ${fmtPct(pv.p5)}</span><span>量能變化 ${fmtPct(pv.vc)}</span></div>`:'<div class="empty">量價樣本不足</div>';
 let vp=volumeProfile(rows.slice(-180)),vpBody=vp?`<div class="profileLevels">${vp.top.map((z,i)=>`<span><b>${i+1}</b> 高成交密集區 ${fmt(z.lo)}–${fmt(z.hi)}</span>`).join('')}</div><p class="muted">高成交量價格區已同步疊加在技術 K 主圖，作為支撐／壓力雲參考。</p>`:'<div class="empty">Volume Profile 樣本不足</div>';
 let resBody=`<div class="resonance">${[['日',res.D],['週',res.W],['月',res.M]].map(([n,x])=>`<span class="${x.ok?'on':''}"><b>${n}</b>${x.score}</span>`).join('')}<strong>${res.ok?'三框共振 ✓':'尚未三框共振'}</strong></div>`;
 let fakeBody=fb?`<div class="flag ${fb.flag?'bad':'neutral'}">${fb.flag?'疑似誘多／假突破':'監測中'}</div><p>${E(fb.reason)}</p><div class="metricPairs"><span>20日壓力 <b>${fmt(fb.prior)}</b></span><span>委買/委賣厚度比 <b>${Number.isFinite(fb.ratio)?fb.ratio.toFixed(2):'—'}</b></span></div>`:'<div class="empty">目前無盤中樣本</div>';
 let sentBody=`<div class="flag ${sent.flag.includes('出盡')?'good':sent.flag.includes('過熱')?'bad':'neutral'}">${sent.flag}</div><div class="metricPairs"><span>新聞情緒 <b>${sent.mean.toFixed(2)}</b></span><span>5日股價 <b>${fmtPct(sent.ret5)}</b></span><span>樣本 <b>${sent.rows.length}</b></span></div>`;
 let rotBody=rot?.peers?.length?`<div class="rotationList">${rot.peers.map((x,i)=>`<button onclick="openSymbol('TW','${x.code}')"><b>#${i+1} ${E(x.name)} ${E(x.code)}</b><span>20日 ${fmtPct(x.r20)} · 技術 ${x.score??'—'} · 補漲分 ${x.catchup}</span></button>`).join('')}</div><p class="muted">同產業中「20日漲幅落後＋技術分數不弱」的代理排序；基本面相似度僅使用目前可得估值／基本資料，不宣稱完整同質比較。</p>`:'<div class="empty">同產業同業樣本不足</div>';
 let antiBody=anti?`<div class="confidenceScore small"><strong>${anti.score}</strong><span>/100</span><small>抗跌評分</small></div><div class="metricPairs"><span>下跌日相對超額 <b>${fmtPct(anti.excess)}</b></span><span>下檔捕捉率 <b>${Number.isFinite(anti.capture)?anti.capture.toFixed(0)+'%':'—'}</b></span></div><div class="antiEvents">${anti.events.slice(-6).map(x=>`<span>${x.date} 大盤 ${fmtPct(x.market)} / 個股 ${fmtPct(x.stock)}</span>`).join('')}</div>`:'<div class="empty">大盤對齊樣本不足</div>';
 let backtests=`<div class="btTable"><div class="btRow head"><b>訊號</b><span>樣本</span><span>5日 勝率/均報</span><span>10日</span><span>20日</span></div>${btTable('技術多因子',btTech)}${btTable('量價健康',btPv)}${btTable('成交量密集區',btVp)}${btTable('多時間框架代理',btRes)}${btTable('假突破風險',btFake)}${btTable('法人×融資背離',btDiv)}${btTable('新聞利空出盡',btSent)}${btTable('產業落後補漲',btRot)}${btTable('抗跌相對強勢',btAnti)}</div><p class="muted">回測使用目前下載到瀏覽器的近3年日線，未計交易成本、滑價、停牌與生存者偏差；完整四因子分數因缺少歷史 point-in-time 新聞／財報，不顯示虛構勝率。</p>`;
 let html=[
  card('1. 買點信心綜合分數','透明四因子',confBody,confDetail,'wide'),
  card('2. 法人與散戶行為背離雷達',div?.flag||'盤後資料',divBody,divDetail,'wide'),
  card('3. 量價健康度',pv?.state||'—',pvBody,`<p>5日價格報酬 × 最近5日平均量相對前20日平均量，劃分四象限。${btPv?backtestText(btPv):''}</p>`),
  card('4. 成交量分布支撐壓力雲','Volume Profile',vpBody,`<p>將近180日每根K棒成交量配置到典型價格 (H+L+C)/3 的30個價格桶，標示成交最密集前三區。${backtestText(btVp)}</p>`),
  card('5. 多時間框架共振','日 / 週 / 月',resBody,`<p>各週期同時檢查：收盤>MA20、MA5>MA20、MACD柱>0、RSI 48–75、MA20向上。五條至少四條成立才算該週期通過；三個週期全通過才提示共振。</p><p>歷史回測為可回溯的日線等價代理，非逐日重建所有週/月K：${backtestText(btRes)}</p>`),
  card('7. 假突破偵測器','盤中代理',fakeBody,`<p>盤中突破20日高後，觀察五檔委買/委賣厚度、30分鐘是否跌回突破位與最近5分鐘量能是否衰退。5秒公開快照不是券商逐筆訂單，所以標示為代理。</p><p>日線歷史代理：突破前20日高，但收回壓力下方或量比<1.2。${backtestText(btFake)}</p>`),
  card('8. 新聞情緒 × 股價背離',sent.flag,sentBody,`<p>標題採簡易正負向詞典計分，不使用付費LLM。負面新聞但5日股價不再下跌 →「利空出盡」候選；正面新聞過熱但股價5日停滯 →「消息過熱滯漲」。新聞歷史免費覆蓋有限；目前可對齊樣本的「利空出盡」代理：${backtestText(btSent)}。</p>`),
  card('9. 同產業相對強弱輪動','補漲雷達',rotBody,`<p>以交易所產業分類找同族群，計算20日相對落後幅度與技術分數，做補漲候選排序。完整同業基本面相似度需要更長資料載入，因此此版採輕量代理。歷史橫截面落後代理：${backtestText(btRot)}。</p>`,'wide'),
  card('10. 反脆弱 / 抗跌評分','大盤下跌驗證',antiBody,`<p>對齊近3年台股加權指數，挑大盤單日跌幅≤-1.5%的交易日，比較個股同日跌幅與下檔捕捉率。分數越高代表歷史下跌日相對抗跌，不代表未來一定抗跌。抗跌後續報酬代理：${backtestText(btAnti)}。</p>`),
  card('6. 訊號回測透明化','5 / 10 / 20 日',backtests,'','wide')
 ].join('');root.innerHTML=html;V5.lab={code:current,html};
 }catch(e){root.innerHTML=`<div class="empty" style="grid-column:1/-1">買點實驗室暫時無法完成：${E(e.message)}</div>`}}

renderIndicators=function(time=null){if(!lastData)return;const a=lastData.analysis,z=time?indicatorMap[time]||{}:{},vals={ma5:time?z.ma5:a.ma5,ma10:time?z.ma10:a.ma10,ma20:time?z.ma20:a.ma20,ma60:time?z.ma60:a.ma60,rsi:time?z.rsi:a.rsi14,macd:time?z.macdHist:a.macd?.hist,k:time?z.kdK:a.kd?.k,d:time?z.kdD:a.kd?.d,obv:time?z.obv:a.obv};$('#indicatorStrip').innerHTML=[['MA5',fmt(vals.ma5)],['MA10',fmt(vals.ma10)],['MA20',fmt(vals.ma20)],['MA60',fmt(vals.ma60)],['RSI',fmt(vals.rsi,1)],['MACD',fmt(vals.macd)],['KD',`${fmt(vals.k,1)} / ${fmt(vals.d,1)}`],['OBV',money(vals.obv)],['量比',Number.isFinite(a.volumeRatio)?fmt(a.volumeRatio,2)+'×':'—'],['支撐',fmt(a.support20)],['壓力',fmt(a.resistance20)]].map(([l,v])=>`<span class="indicator">${l}<b>${v}</b></span>`).join('')};
// D/W/M technical chart + MA10 + Volume Profile overlay
function autoLevelsV54(rows){
  if(!rows?.length)return null;const a=rows.slice(-160),px=a.at(-1)?.close;if(!Number.isFinite(px))return null;
  const piv=[];for(let i=2;i<a.length-2;i++){const r=a[i],lo=r.low,hi=r.high;if(Number.isFinite(lo)&&lo<=a[i-1].low&&lo<=a[i-2].low&&lo<=a[i+1].low&&lo<=a[i+2].low)piv.push({v:lo,t:'S'});if(Number.isFinite(hi)&&hi>=a[i-1].high&&hi>=a[i-2].high&&hi>=a[i+1].high&&hi>=a[i+2].high)piv.push({v:hi,t:'R'})}
  function best(type,side){let c=piv.filter(x=>x.t===type&&(side==='below'?x.v<px:x.v>px));if(!c.length){const vals=a.slice(-40).map(x=>type==='S'?x.low:x.high).filter(Number.isFinite);if(!vals.length)return null;return type==='S'?Math.min(...vals):Math.max(...vals)}
    const clusters=[];for(const x of c){let z=clusters.find(y=>Math.abs(y.v-x.v)/x.v<.012);if(z){z.v=(z.v*z.n+x.v)/(z.n+1);z.n++}else clusters.push({v:x.v,n:1})}
    clusters.sort((x,y)=>(y.n-x.n)||Math.abs(px-x.v)-Math.abs(px-y.v));return clusters[0]?.v??null}
  return{support:best('S','below'),resistance:best('R','above')}
}
function crossMarkersV54(rows,i){const m=[],from=Math.max(1,rows.length-100);for(let n=from;n<rows.length;n++){
  const date=rows[n].date;
  if(Number.isFinite(i.macd.dif[n-1])&&Number.isFinite(i.macd.dea[n-1])&&Number.isFinite(i.macd.dif[n])&&Number.isFinite(i.macd.dea[n])){if(i.macd.dif[n-1]<=i.macd.dea[n-1]&&i.macd.dif[n]>i.macd.dea[n])m.push({time:date,position:'belowBar',color:'#7b68ee',shape:'arrowUp',text:'MACD金叉'});else if(i.macd.dif[n-1]>=i.macd.dea[n-1]&&i.macd.dif[n]<i.macd.dea[n])m.push({time:date,position:'aboveBar',color:'#e24e63',shape:'arrowDown',text:'MACD死叉'})}
  if(Number.isFinite(i.kd.k[n-1])&&Number.isFinite(i.kd.d[n-1])&&Number.isFinite(i.kd.k[n])&&Number.isFinite(i.kd.d[n])){if(i.kd.k[n-1]<=i.kd.d[n-1]&&i.kd.k[n]>i.kd.d[n]&&i.kd.k[n]<60)m.push({time:date,position:'belowBar',color:'#11a886',shape:'circle',text:'KD金叉'});else if(i.kd.k[n-1]>=i.kd.d[n-1]&&i.kd.k[n]<i.kd.d[n]&&i.kd.k[n]>40)m.push({time:date,position:'aboveBar',color:'#d28a2b',shape:'circle',text:'KD死叉'})}
  if(Number.isFinite(i.rsi[n-1])&&Number.isFinite(i.rsi[n])){if(i.rsi[n-1]<=50&&i.rsi[n]>50)m.push({time:date,position:'belowBar',color:'#3f8cff',shape:'square',text:'RSI>50'});else if(i.rsi[n-1]>=50&&i.rsi[n]<50)m.push({time:date,position:'aboveBar',color:'#8890a6',shape:'square',text:'RSI<50'})}
  }
  return m.slice(-16)
}
const oldRenderTech=renderTechChart;renderTechChart=function(){
  destroyChart();if(!window.LightweightCharts||!lastData)return;$('#mainChart').className='mainChart tech';$('#intradayBar').classList.add('hidden');$('#rangeBar').classList.remove('hidden');$('#kFrameBar').classList.remove('hidden');$('#drawTools').classList.remove('hidden');$('#chartLoading').classList.add('hidden');$('#chartNotice').classList.add('hidden');
  let raw=rangeSlice().h||[],h=aggregate(raw,V5.kFrame),i=indicators(h);$('#chartHint').textContent=`${V5.kFrame==='D'?'日':V5.kFrame==='W'?'週':'月'} K · ${chartRangeMonths}M · MA / BB / Volume / MACD / RSI / KD · VP`;$('#chartLiveBadge').className='chartLiveBadge';$('#chartLiveBadge').textContent='上下捲頁 · 左右看圖 · 縮放';chart=LightweightCharts.createChart($('#mainChart'),chartOptions());
  const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#ff5b72',downColor:'#1dbb9d',wickUpColor:'#ff5b72',wickDownColor:'#1dbb9d',borderVisible:false},0);cs.setData(h.map(x=>({time:x.date,open:x.open,high:x.high,low:x.low,close:x.close})));
  addLineV5(chart,seriesFrom(h,i.ma5),'#ffad45',2);addLineV5(chart,seriesFrom(h,i.ma10),'#e783c8',1.5);addLineV5(chart,seriesFrom(h,i.ma20),'#55a7ff',2);addLineV5(chart,seriesFrom(h,i.ma60),'#8a77ff',2);
  let mid=i.ma20,bu=Array(h.length).fill(null),bl=Array(h.length).fill(null);for(let n=19;n<h.length;n++){let w=i.c.slice(n-19,n+1),m=mid[n],ss=sd(w);if(Number.isFinite(m)&&Number.isFinite(ss)){bu[n]=m+2*ss;bl[n]=m-2*ss}}addLineV5(chart,seriesFrom(h,bu),'#b8bbc8',1,0,{lineStyle:2});addLineV5(chart,seriesFrom(h,bl),'#b8bbc8',1,0,{lineStyle:2});
  const lv=autoLevelsV54(h);try{if(Number.isFinite(lv?.support))cs.createPriceLine({price:lv.support,color:'#10a985',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'支撐'});if(Number.isFinite(lv?.resistance))cs.createPriceLine({price:lv.resistance,color:'#e45367',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'壓力'})}catch{}
  try{const marks=crossMarkersV54(h,i);if(marks.length&&LightweightCharts.createSeriesMarkers)LightweightCharts.createSeriesMarkers(cs,marks)}catch{}
  let vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);vol.setData(h.map((x,n)=>({time:x.date,value:x.volume||0,color:n&&x.close<h[n-1].close?'rgba(29,187,157,.48)':'rgba(255,91,114,.48)'})));
  let mh=chart.addSeries(LightweightCharts.HistogramSeries,{priceLineVisible:false,lastValueVisible:false},2);mh.setData(seriesFrom(h,i.macd.hist).map(x=>({...x,color:x.value>=0?'rgba(255,91,114,.5)':'rgba(29,187,157,.5)'})));addLineV5(chart,seriesFrom(h,i.macd.dif),'#ffad45',1,2);addLineV5(chart,seriesFrom(h,i.macd.dea),'#55a7ff',1,2);addLineV5(chart,seriesFrom(h,i.rsi),'#7c64f3',2,3);addLineV5(chart,h.map(x=>({time:x.date,value:70})),'#c8cbd5',1,3,{lineStyle:2});addLineV5(chart,h.map(x=>({time:x.date,value:30})),'#c8cbd5',1,3,{lineStyle:2});addLineV5(chart,seriesFrom(h,i.kd.k),'#ffad45',1,4);addLineV5(chart,seriesFrom(h,i.kd.d),'#55a7ff',1,4);addLineV5(chart,seriesFrom(h,i.obv),'#10b79a',1.5,5);
  try{let p=chart.panes();p[0]?.setHeight(300);p[1]?.setHeight(80);p[2]?.setHeight(95);p[3]?.setHeight(85);p[4]?.setHeight(85);p[5]?.setHeight(80)}catch{}chart.timeScale().fitContent();chart.subscribeCrosshairMove(p=>{if(!p?.time){$('#crossInfo').textContent='滑動查看 OHLC';return}let x=p.seriesData.get(cs);if(x)$('#crossInfo').textContent=`${p.time} O ${fmt(x.open)} H ${fmt(x.high)} L ${fmt(x.low)} C ${fmt(x.close)}`});watchChart();$('#sampleCount').textContent=`${h.length} 根 ${V5.kFrame}K`;setTimeout(()=>renderVPOverlay(h,cs),80);setupDrawLayer();renderIndicators();setTimeout(()=>window.dispatchEvent(new CustomEvent('clarinavi:tech-render',{detail:{frame:V5.kFrame,levels:lv}})),0)
};
function setupDrawLayer(){const svg=$('#drawLayer');if(!svg)return;const active=!!V5.drawMode;svg.setAttribute('viewBox',`0 0 ${svg.clientWidth||900} ${svg.clientHeight||600}`);svg.classList.toggle('drawing',active);svg.style.pointerEvents=active?'auto':'none';renderDrawings();svg.onpointerdown=e=>{if(!V5.drawMode)return;e.preventDefault();e.stopPropagation();let r=svg.getBoundingClientRect(),p={x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top))};if(V5.drawMode==='horizontal'){V5.drawings.push({type:'h',p});V5.drawMode='';renderDrawings();syncDrawBtns();toast?.('水平線已加入');return}V5.drawPts.push(p);if(V5.drawPts.length===1){toast?.('已選第一點，再點第二點');return}if(V5.drawPts.length===2){V5.drawings.push({type:V5.drawMode,p1:V5.drawPts[0],p2:V5.drawPts[1]});V5.drawPts=[];V5.drawMode='';renderDrawings();syncDrawBtns();toast?.('繪圖已加入')}}}
function renderDrawings(){const svg=$('#drawLayer');if(!svg)return;let W=svg.clientWidth||900,H=svg.clientHeight||600;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);let s='';for(const d of V5.drawings){if(d.type==='h')s+=`<line x1="0" y1="${d.p.y}" x2="${W}" y2="${d.p.y}" class="drawStroke"/>`;else if(d.type==='trend')s+=`<line x1="${d.p1.x}" y1="${d.p1.y}" x2="${d.p2.x}" y2="${d.p2.y}" class="drawStroke"/>`;else if(d.type==='fib'){let y1=d.p1.y,y2=d.p2.y,lo=Math.min(y1,y2),hi=Math.max(y1,y2);for(const q of [0,.236,.382,.5,.618,1]){let y=lo+(hi-lo)*q;s+=`<line x1="${Math.min(d.p1.x,d.p2.x)}" y1="${y}" x2="${Math.max(d.p1.x,d.p2.x)}" y2="${y}" class="drawFib"/><text x="${Math.min(d.p1.x,d.p2.x)+4}" y="${y-3}" class="drawText">${q}</text>`}}}svg.innerHTML=s;svg.classList.toggle('drawing',!!V5.drawMode);svg.style.pointerEvents=V5.drawMode?'auto':'none'}
function syncDrawBtns(){$$('#drawTools button').forEach(b=>b.classList.toggle('active',b.dataset.draw===V5.drawMode));setupDrawLayer()}

// Compare 2–5 symbols, standardized to 100. TW adds TAIEX benchmark.
async function runCompare(){let raw=$('#compareInput').value.trim(),codes=raw.split(/[ ,，]+/).filter(Boolean).slice(0,5);if(!codes.length)codes=[current];$('#compareChart').innerHTML='<div class="skeleton" style="height:260px"></div>';try{let packs=await Promise.all(codes.map(async c=>{if(market==='US'){let key=localStorage.getItem('pulse-av-key')||'';let d=await fetch(`/api/us?symbol=${encodeURIComponent(c)}&months=12`,{headers:{'X-AV-Key':key}}).then(r=>r.json());return{name:c,rows:d.history||[]}}let d=await fetch(`/api/stock?code=${encodeURIComponent(c)}&months=12`).then(r=>r.json());return{name:`${d.snapshot?.name||c} ${c}`,rows:d.history||[]}}));if(market==='TW'){let b=await getBenchmark();if(b?.rows?.length)packs.push({name:'加權指數',rows:b.rows})}try{V5.compareChart?.remove()}catch{}let el=$('#compareChart');el.innerHTML='';V5.compareChart=LightweightCharts.createChart(el,{...chartOptions(),height:300,width:el.clientWidth});let colors=['#675cf5','#10b79a','#ff8c42','#e84b68','#55a7ff','#8b5cf6'],stats=[];packs.forEach((p,ix)=>{let rows=p.rows.filter(x=>Number.isFinite(x.close)).slice(-250),base=rows[0]?.close;if(!base)return;let s=V5.compareChart.addSeries(LightweightCharts.LineSeries,{color:colors[ix%colors.length],lineWidth:2,priceLineVisible:false,lastValueVisible:true});s.setData(rows.map(x=>({time:x.date,value:x.close/base*100})));let ret=rows.length>1?pct(rows.at(-1).close,base):null;stats.push({name:p.name,ret})});V5.compareChart.timeScale().fitContent();$('#compareStats').innerHTML=stats.map(x=>mini(x.name,fmtPct(x.ret),x.ret>0?'up':x.ret<0?'down':'')).join('')}catch(e){$('#compareChart').innerHTML=`<div class="empty">比較失敗：${E(e.message)}</div>`}}

// Fundamentals expanded: 3 statements, 12-quarter trends, valuation proxy, insider timeline.
const oldLoadFund=loadFund;loadFund=async function(){if(loaded.has('fund-v5'))return;loaded.add('fund-v5');if(market==='US'){return oldLoadFund()}try{let [rj,fj,ij]=await Promise.all([apiResearch('revenue','&months=36'),apiResearch('financials'),apiResearch('insiders').catch(()=>({data:{}}))]),rows=rj.data?.rows||[],qr=fj.data?.rows||[],ins=ij.data||{};deep.financials=fj;deep.revenue=rj;let latest=rows.at(-1),q=qr.at(-1),qPrev=qr.at(-2),qYear=qr.at(-5),qoq=Number.isFinite(q?.revenue)&&Number.isFinite(qPrev?.revenue)&&qPrev.revenue?(q.revenue/qPrev.revenue-1)*100:null,qyoy=Number.isFinite(q?.revenue)&&Number.isFinite(qYear?.revenue)&&qYear.revenue?(q.revenue/qYear.revenue-1)*100:null,roe=Number.isFinite(q?.netIncome)&&Number.isFinite(q?.equity)&&q.equity?q.netIncome/q.equity*4*100:null,debt=Number.isFinite(q?.liabilities)&&Number.isFinite(q?.assets)&&q.assets?q.liabilities/q.assets*100:null;$('#fundSummary').innerHTML=[mini('月營收 YoY',Number.isFinite(latest?.yoy)?fmtPct(latest.yoy):'—',latest?.yoy>0?'up':latest?.yoy<0?'down':''),mini('季營收 QoQ',Number.isFinite(qoq)?fmtPct(qoq):'—',qoq>0?'up':qoq<0?'down':''),mini('季營收 YoY',Number.isFinite(qyoy)?fmtPct(qyoy):'—',qyoy>0?'up':qyoy<0?'down':''),mini('最新 EPS',fmt(q?.eps)),mini('季化 ROE',Number.isFinite(roe)?roe.toFixed(1)+'%':'—'),mini('負債比',Number.isFinite(debt)?debt.toFixed(1)+'%':'—')].join('');let revSvg=miniLineSvg(rows.slice(-24).map(x=>({date:x.month,revenue:x.revenue/1e6,yoy:x.yoy})),['revenue','yoy'],['營收(百萬)','YoY%']);let epsSvg=miniLineSvg(qr.map(x=>({date:x.quarter,eps:x.eps,revenue:(x.revenue||0)/1e9})),['eps','revenue'],['EPS','營收(十億)']);let income=`<div class="tableWrap"><table class="dataTable"><thead><tr><th>季別</th><th>營收</th><th>毛利</th><th>營業利益</th><th>淨利</th><th>EPS</th></tr></thead><tbody>${qr.slice().reverse().map(x=>`<tr><td>${E(x.quarter)}</td><td>${money(x.revenue)}</td><td>${money(x.grossProfit)}</td><td>${money(x.operatingIncome)}</td><td>${money(x.netIncome)}</td><td>${fmt(x.eps)}</td></tr>`).join('')}</tbody></table></div>`;let bal=`<div class="tableWrap"><table class="dataTable"><thead><tr><th>季別</th><th>資產</th><th>負債</th><th>權益</th></tr></thead><tbody>${qr.slice().reverse().map(x=>`<tr><td>${E(x.quarter)}</td><td>${money(x.assets)}</td><td>${money(x.liabilities)}</td><td>${money(x.equity)}</td></tr>`).join('')}</tbody></table></div>`;let cash=`<div class="tableWrap"><table class="dataTable"><thead><tr><th>季別</th><th>營業現金流</th><th>投資現金流</th><th>融資現金流</th></tr></thead><tbody>${qr.slice().reverse().map(x=>`<tr><td>${E(x.quarter)}</td><td>${money(x.operatingCashFlow)}</td><td>${money(x.investingCashFlow)}</td><td>${money(x.financingCashFlow)}</td></tr>`).join('')}</tbody></table></div>`;let insider=`<h4>董監／內部人公開申報</h4>${(ins.transfers||[]).length?`<div class="timeline">${ins.transfers.slice(0,12).map(x=>`<div><b>${E(x.date||'—')} ${E(x.name||'')}</b><span>${E(x.method||'申報轉讓')} · ${money(x.shares)} 股</span></div>`).join('')}</div>`:'<div class="empty">近期無可解析的申報轉讓資料。</div>'}`;$('#fundBody').innerHTML=`<div class="fundCharts"><div><h4>營收趨勢</h4>${revSvg}</div><div><h4>EPS / 季營收（近12季）</h4>${epsSvg}</div></div><details open><summary>損益表（季度）</summary>${income}</details><details><summary>資產負債表（季度）</summary>${bal}</details><details><summary>現金流量表（季度）</summary>${cash}</details><details><summary>月營收歷史</summary><div class="tableWrap"><table class="dataTable"><thead><tr><th>月份</th><th>營收</th><th>MoM</th><th>YoY</th></tr></thead><tbody>${rows.slice().reverse().map(x=>`<tr><td>${E(x.month)}</td><td>${money(x.revenue)}</td><td>${fmtPct(x.mom)}</td><td>${fmtPct(x.yoy)}</td></tr>`).join('')}</tbody></table></div></details>${insider}`||'<div class="empty">資料不足</div>'}catch(e){$('#fundSummary').innerHTML=`<div class="empty">財務資料暫時無法使用：${E(e.message)}</div>`}};

// Alerts while app is open.
function alertKey(){return `${market}:${current}`}
function openAlertSheet(){if(!current)return;let a=V5.alerts[alertKey()]||{};$('#alertPrice').value=a.price||'';$('#alertSignal').value=a.signal||'';openSheet('alertSheet')}
function saveAlert(){if(!current)return;V5.alerts[alertKey()]={price:Number($('#alertPrice').value)||null,signal:$('#alertSignal').value||'',last:false};localStorage.setItem('pulse-alerts-v5',JSON.stringify(V5.alerts));if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});closeSheets();toast('提醒已儲存（頁面開啟時監測）')}
function clearAlert(){delete V5.alerts[alertKey()];localStorage.setItem('pulse-alerts-v5',JSON.stringify(V5.alerts));closeSheets();toast('提醒已清除')}
function checkAlerts(){
 let a=V5.alerts[alertKey()];if(!a||!lastData)return;let s=lastData.snapshot,A=lastData.analysis,hit=false,msg='';
 if(Number.isFinite(a.price)&&Number.isFinite(s.close)&&s.close>=a.price){hit=true;msg=`${s.name} 已到 ${fmt(s.close)}（設定 ${fmt(a.price)}）`}
 const h=lastData.history||[];if(a.signal&&h.length>=65){const I=indicators(h),n=h.length-1,prev=n-1;
   if(a.signal==='macdCross'&&Number.isFinite(I.macd.dif[prev])&&Number.isFinite(I.macd.dea[prev])&&I.macd.dif[prev]<=I.macd.dea[prev]&&I.macd.dif[n]>I.macd.dea[n]){hit=true;msg=`${s.name} MACD 出現黃金交叉`}
   if(a.signal==='kdCross'&&Number.isFinite(I.kd.k[prev])&&Number.isFinite(I.kd.d[prev])&&I.kd.k[prev]<=I.kd.d[prev]&&I.kd.k[n]>I.kd.d[n]){hit=true;msg=`${s.name} KD 出現黃金交叉`}
   if(a.signal==='rsi50'&&Number.isFinite(I.rsi[prev])&&Number.isFinite(I.rsi[n])&&I.rsi[prev]<=50&&I.rsi[n]>50){hit=true;msg=`${s.name} RSI 上穿 50`}
   if(a.signal==='maBull'){const nowBull=I.ma5[n]>I.ma10[n]&&I.ma10[n]>I.ma20[n]&&I.ma20[n]>I.ma60[n],prevBull=I.ma5[prev]>I.ma10[prev]&&I.ma10[prev]>I.ma20[prev]&&I.ma20[prev]>I.ma60[prev];if(nowBull&&!prevBull){hit=true;msg=`${s.name} 均線轉為多頭排列`}}
   if(a.signal==='ma20'&&Number.isFinite(I.ma20[n])&&Number.isFinite(I.ma20[prev])&&h[prev].close<=I.ma20[prev]&&s.close>I.ma20[n]){hit=true;msg=`${s.name} 已站上 MA20`}
 }
 if(a.signal==='breakout'&&Number.isFinite(s.close)&&Number.isFinite(A?.resistance20)&&s.close>=A.resistance20){hit=true;msg=`${s.name} 已突破壓力區`}
 if(hit&&!a.last){a.last=true;localStorage.setItem('pulse-alerts-v5',JSON.stringify(V5.alerts));toast(msg);if(Notification.permission==='granted')new Notification('ClariNavi 提醒',{body:msg})}if(!hit)a.last=false
}
const oldApplyLive=applyLive;applyLive=async function(code){await oldApplyLive(code);checkAlerts();if($('#sub-lab')?.classList.contains('active')){V5.lab=null;loadDecisionLab(true).catch(()=>{})}};

// Appearance / layout presets.
function applyTheme(t){document.body.dataset.theme=t;localStorage.setItem('pulse-theme-v5',t);$('#themeLight')?.classList.toggle('active',t==='light');$('#themeDark')?.classList.toggle('active',t==='dark')}
function applyLayout(v){V5.layout=v;localStorage.setItem('pulse-layout-v5',v);$$('[data-layout]').forEach(b=>b.classList.toggle('active',b.dataset.layout===v));let area=$('#stockResult');if(!area)return;area.dataset.layout=v}
const AUDIT=[
 ['即時報價／五檔','完整（台股公開近即時）','TWSE MIS 公開5秒快照；不是券商授權逐筆。'],
 ['K線 1/5/15/60分、日週月','完整／條件式','分K為當日瀏覽器累積快照聚合；日週月使用歷史OHLC。'],
 ['MA5/10/20/60、MACD、KD、RSI、布林、OBV、量柱','完整','MA10於v5補齊；OBV保留於技術指標資料。'],
 ['趨勢線／水平線／斐波那契','完整（輕量版）','繪圖儲存在當前頁面，非雲端同步。'],
 ['多股同框比較＋大盤','完整','2–5檔起點100標準化，台股自動加入加權指數。'],
 ['完整三表季度／年度','部分','季度三表已補齊；年度可由季度聚合，銀行/保險欄位可能不同。'],
 ['本益比河流＋目標價','完整（台股按需）','MOPS 滾動四季 EPS＋TWSE/TPEx 歷史股價；公開目標價只納入可追溯樣本。'],
 ['EPS/營收12季','完整','MOPS季度與月營收。'],
 ['同業比較雷達／產業排名','部分','v5補漲輪動已做；完整ROE/PE同業雷達需批量載入，採lazy模式。'],
 ['三大法人、融資券、大戶','完整（公開口徑）','法人、融資券、TDCC大戶/散戶分開呈現。'],
 ['董監持股／內部人轉讓','完整（最佳努力）','TWSE/TPEx OpenAPI公開申報。'],
 ['AND/OR篩選器＋範本','待下一層UI','目前有強勢雷達/產業篩選；複合條件Builder尚未完整。'],
 ['每日自動排程','受限','純前端無背景排程；可做「每日首次開啟自動掃描」。真正排程需Vercel Cron或Automation。'],
 ['除權息＋股利試算','部分','除權息行事曆完整；股利試算器尚未獨立UI。'],
 ['到價／技術提醒','App開啟時完整','v5可瀏覽器通知；真正離線推播需Web Push後端。'],
 ['自訂儀表板','部分','提供研究/圖表/新聞優先預設；自由拖曳版尚未加入。'],
 ['深色／淺色','完整','本機保存偏好。'],
 ['真正券商分點主力即時','無法免費合法提供','券商分點資料屬付費授權；本站只提供大單代理與公開籌碼。']
];
function auditHtml(){return `<div class="auditList">${AUDIT.map(([f,s,n])=>`<div><b>${E(f)}</b><span class="auditStatus ${s.startsWith('完整')?'ok':s.includes('無法')?'no':'partial'}">${E(s)}</span><small>${E(n)}</small></div>`).join('')}</div>`}
function addAuditToLab(){}
const oldLoadLab=loadDecisionLab;loadDecisionLab=async function(force=false){await oldLoadLab(force);addAuditToLab()};

// Override sub navigation for new modules.
switchSub=async function(id){$('#deepPanel').classList.remove('hidden');$$('.subTab').forEach(x=>x.classList.toggle('active',x.dataset.sub===id));$$('.subPanel').forEach(x=>x.classList.toggle('active',x.id===`sub-${id}`));if(id==='lab')await loadDecisionLab();if(id==='chips')loadChips();if(id==='fund')loadFund();if(id==='valuation')await loadValuationPanel();if(id==='chain')await loadSupplyChain();if(id==='compare')runCompare();if(id==='company')loadCompany()};

// Reset v5 cache when a new symbol is rendered.
const oldRenderMain=typeof renderMain==='function'?renderMain:null;if(oldRenderMain){renderMain=function(d){V5.lab=null;V5.advanced=null;V5.news90=null;V5.drawings=[];V5.drawPts=[];oldRenderMain(d);checkAlerts()}}

function bindV5(){
 $('#alertBtn')&&( $('#alertBtn').onclick=openAlertSheet );$('#saveAlert')&&( $('#saveAlert').onclick=saveAlert );$('#clearAlert')&&( $('#clearAlert').onclick=clearAlert );
 $$('#kFrameBar button').forEach(b=>b.onclick=()=>{V5.kFrame=b.dataset.kframe;$$('#kFrameBar button').forEach(x=>x.classList.toggle('active',x===b));if(chartMode==='tech')renderTechChart()});
 $$('#drawTools button').forEach(b=>b.onclick=()=>{let m=b.dataset.draw;if(m==='clear'){V5.drawings=[];V5.drawPts=[];V5.drawMode='';renderDrawings();syncDrawBtns();return}V5.drawMode=V5.drawMode===m?'':m;V5.drawPts=[];syncDrawBtns()});
 $('#compareRun')&&( $('#compareRun').onclick=runCompare );
 $('#themeLight')&&( $('#themeLight').onclick=()=>applyTheme('light') );$('#themeDark')&&( $('#themeDark').onclick=()=>applyTheme('dark') );$$('[data-layout]').forEach(b=>b.onclick=()=>applyLayout(b.dataset.layout));
 applyTheme(localStorage.getItem('pulse-theme-v5')||'light');applyLayout(V5.layout);
 window.addEventListener('resize',()=>{if(chartMode==='tech')renderDrawings()});
}
setTimeout(bindV5,0);
window.PulseV5={loadDecisionLab,runCompare,audit:AUDIT,volumeProfile,resonance,backtest:bt};
})();
(()=>{
  let lastLoad=0,loading=false,homeTimer=null;
  const fmtHome=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:Math.abs(Number(v))<10?Math.min(d,2):0}):'—';
  const cls=v=>Number(v)>0?'up':Number(v)<0?'down':'muted';
  const signed=(v,d=2)=>Number.isFinite(Number(v))?`${Number(v)>0?'+':''}${fmtHome(v,d)}`:'—';
  function pairHtml(x){
    const s=x?.spot||{},f=x?.future||{},sp=s.changePct,fp=f.changePct,hasFuture=Number.isFinite(Number(f.price));
    const secondary=hasFuture
      ? `<div class="pairFuture"><span>${E(f.name||'期貨')}</span><b class="${cls(fp)}">${fmtHome(f.price)} · ${signed(fp)}%</b></div>`
      : `<div class="pairFuture"><span>資料</span><b>${E(s.source||'公開行情')} · ${E(s.date||'最近')}</b></div>`;
    return `<div class="marketPair"><div class="pairTitleRow"><div class="pairTitle">${E(s.name||f.name||'市場')}</div></div><div class="pairSpot"><b>${fmtHome(s.price??f.price)}</b><span class="pairMove ${cls(sp??fp)}">${signed(sp??fp)}%</span></div>${secondary}<div class="pairMeta">${E((hasFuture?f.changeBasis:'更新')||'更新')} · ${E(f.date||s.date||'最近')} ${E(f.time||s.time||'')}</div></div>`
  }
  function heatStyle(v){const a=Math.min(.30,.07+Math.min(Math.abs(Number(v)||0),4)/4*.23);if(Number(v)>0)return `background:rgba(255,91,114,${a})`;if(Number(v)<0)return `background:rgba(29,187,157,${a})`;return 'background:#f7f8fc'}
  function renderGlobal(j){
    const box=$('#globalPairs');if(!box)return;
    if(j?.error||!j?.pairs?.length){box.innerHTML='<div class="empty">國際市場資料暫時無法取得</div>';return}
    box.innerHTML=j.pairs.map(pairHtml).join('');$('#globalSource').textContent=j.note||'市場資料可能延遲，交易前請以交易所或券商即時行情為準。';const d=new Date(j.updatedAt||Date.now());$('#globalTime')&&($('#globalTime').textContent='更新 '+d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  }
  function renderSectors(j){
    const box=$('#sectorHeatmap');if(!box)return;
    if(j?.error||!j?.sectors?.length){box.innerHTML='<div class="empty">產業行情暫時無法取得</div>';return}
    box.innerHTML=j.sectors.slice(0,30).map(x=>`<button class="heatTile" data-sector="${E(x.name)}" style="${heatStyle(x.changePct)}"><b>${E(x.name)}</b><strong class="${cls(x.changePct)}">${signed(x.changePct)}%</strong><small>${fmtHome(x.price)} · ${E(x.time||'')}</small><em>查看成分股 ›</em></button>`).join('');box.querySelectorAll('[data-sector]').forEach(b=>b.onclick=()=>window.ClariNaviV58?.openSectorDetail?.(b.dataset.sector));
    const d=new Date(j.updatedAt||Date.now());$('#sectorTime').textContent='更新 '+d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  function contribRow(x,max){const w=Math.max(3,Math.min(100,Math.abs(Number(x.points)||0)/(max||1)*100)),c=Number(x.points)>=0?'rgba(255,91,114,.76)':'rgba(29,187,157,.76)';return `<div class="contribRow" data-code="${E(x.code)}"><div class="contribName"><b>${E(x.name)} ${E(x.code)}</b><span>${signed(x.changePct)}%</span></div><div class="contribTrack"><i style="width:${w}%;background:${c}"></i></div><div class="contribValue ${cls(x.points)}"><b>${signed(x.points,1)} 點</b><span>${fmtHome(x.price)}</span></div></div>`}
  function renderContrib(j){
    const box=$('#contribList');if(!box)return;
    const rows=[...(j?.positive||[]),...(j?.negative||[])].sort((a,b)=>Math.abs(b.points)-Math.abs(a.points));
    if(j?.error||!rows.length){box.innerHTML='<div class="empty">點數貢獻暫時無法估算</div>';return}
    const max=Math.max(...rows.map(x=>Math.abs(x.points)||0),1);box.innerHTML=rows.slice(0,10).map(x=>contribRow(x,max)).join('');const d=new Date(j.updatedAt||Date.now());$('#contribTime')&&($('#contribTime').textContent='估算 · '+d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}));
    box.querySelectorAll('.contribRow').forEach(r=>r.onclick=()=>openSymbol('TW',r.dataset.code));
  }
  async function get(mode){const r=await fetch(`/api/market-home?mode=${mode}&_=${Math.floor(Date.now()/5000)}`,{cache:'no-store'});return await r.json()}
  const HOME_CACHE_KEY='clarinavi-home-last-good-v13';
  function readHomeCache(){try{const x=JSON.parse(localStorage.getItem(HOME_CACHE_KEY)||'null');return x&&typeof x==='object'?x:{}}catch{return {}}}
  function saveHomeCache(x){try{localStorage.setItem(HOME_CACHE_KEY,JSON.stringify({...x,savedAt:Date.now()}))}catch{}}
  const cachedHome=readHomeCache();
  const lastGoodHome={global:cachedHome.global||null,sectors:cachedHome.sectors||null,contrib:cachedHome.contrib||null};
  const usableGlobal=j=>!!(j&&!j.error&&((j.cards||[]).some(c=>!c?.error&&Number.isFinite(Number(c?.price)))||(j.pairs||[]).some(p=>[p?.spot,p?.future].some(c=>!c?.error&&Number.isFinite(Number(c?.price))))));
  const usableSectors=j=>!!(j&&!j.error&&(j.sectors||[]).some(x=>Number.isFinite(Number(x?.price))));
  const usableContrib=j=>!!(j&&!j.error&&((j.positive?.length||0)+(j.negative?.length||0)));
  async function loadMarketHome(force=false){
    if(loading)return;
    if(!force&&Date.now()-lastLoad<DATA_REFRESH.marketOverview)return;
    loading=true;
    try{
      const [g,ss,c]=await Promise.allSettled([get('global'),get('sectors'),get('contrib')]);
      const rawG=g.status==='fulfilled'?g.value:null,rawS=ss.status==='fulfilled'?ss.value:null,rawC=c.status==='fulfilled'?c.value:null;
      let changed=false;
      if(usableGlobal(rawG)){lastGoodHome.global=rawG;changed=true}
      if(usableSectors(rawS)){lastGoodHome.sectors=rawS;changed=true}
      if(usableContrib(rawC)){lastGoodHome.contrib=rawC;changed=true}
      if(changed)saveHomeCache(lastGoodHome);
      const gj=lastGoodHome.global||(usableGlobal(rawG)?rawG:{error:1}),sj=lastGoodHome.sectors||(usableSectors(rawS)?rawS:{error:1}),cj=lastGoodHome.contrib||(usableContrib(rawC)?rawC:{error:1});
      renderGlobal(gj);renderSectors(sj);renderContrib(cj);
      window.__clarinaviMarketHome={global:gj,sectors:sj,contrib:cj};
      window.dispatchEvent(new CustomEvent('clarinavi:market-home',{detail:window.__clarinaviMarketHome}));
      lastLoad=Date.now();
    }finally{loading=false}
  }
  function showHome(){
    $('#marketHome')?.classList.remove('hidden');$('#stockResult')?.classList.add('hidden');history.replaceState(null,'',location.pathname);loadMarketHome(false);
  }
  const oldShow=showScreen;showScreen=function(id){oldShow(id);if(id==='market')showHome()};
  const oldRender=renderMain;renderMain=function(d){$('#marketHome')?.classList.add('hidden');oldRender(d)};
  $('#homeRefresh')?.addEventListener('click',()=>loadMarketHome(true));
  window.ClariNaviMarketHome={load:loadMarketHome,show:showHome};
  setTimeout(()=>{const u=new URLSearchParams(location.search);if(!u.get('code'))showHome();homeTimer=null},20);
})();

(()=>{
  const BRAND='ClariNavi';
  const KEY_PORT='aevoryn-portfolio-v52';
  const KEY_TOUR='clarinavi-tour-v54';
  const KEY_RADAR='aevoryn-radar-last-v52';
  const KEY_FOCUS='clarinavi-today-focus-v13';
  let portTimer=null, portfolioBusy=false, focusLoadedAt=0, communityLoadedAt=0;
  const $v=s=>document.querySelector(s), $$v=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const money2=(v,cur)=>Number.isFinite(v)?new Intl.NumberFormat('zh-TW',{style:'currency',currency:cur,maximumFractionDigits:cur==='TWD'?0:2}).format(v):'—';
  const pct2=v=>Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(2)}%`:'—';
  const nowTime=()=>new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
  function read(k,fb){try{const x=JSON.parse(localStorage.getItem(k));return x??fb}catch{return fb}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}

  // cache richer research data for sorting and portfolio use
  const oldRenderMain52=window.renderMain;
  if(typeof oldRenderMain52==='function') window.renderMain=function(d){oldRenderMain52(d);try{const s=d?.snapshot||{},a=d?.analysis||{},m=s.market==='US'?'US':'TW',k=cacheKey(m,s.code),old=read(k,{});write(k,{...old,name:s.name,code:s.code,market:m,price:s.close,changePct:s.changePct,date:s.date,t:Date.now(),score:a.score,yield:s.yield,pe:s.pe,pb:s.pb})}catch{}};

  // Watchlist sorting + grouping
  let watchSort='default',watchGroup='all';
  function watchGroups(w){return [...new Set(w.map(x=>x.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'))}
  function cacheFor(x){return read(cacheKey(x.market,x.code),{})}
  function sortedWatch(){let w=getWatch().slice();if(watchGroup!=='all')w=w.filter(x=>(x.group||'未分組')===watchGroup);const val=(x,k,miss=-1e99)=>{const v=Number(cacheFor(x)[k]);return Number.isFinite(v)?v:miss};if(watchSort==='change')w.sort((a,b)=>val(b,'changePct')-val(a,'changePct'));if(watchSort==='score')w.sort((a,b)=>val(b,'score')-val(a,'score'));if(watchSort==='yield')w.sort((a,b)=>val(b,'yield')-val(a,'yield'));return w}
  function rebuildWatchFilters(){const w=getWatch(),sel=$v('#watchGroupFilter');if(!sel)return;const current=watchGroup;sel.innerHTML='<option value="all">全部分組</option><option value="未分組">未分組</option>'+watchGroups(w).map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');if([...sel.options].some(o=>o.value===current))sel.value=current;else{watchGroup='all';sel.value='all'}}
  function setGroup(code,marketName){const w=getWatch(),i=w.findIndex(x=>x.code===code&&x.market===marketName);if(i<0)return;$v('#watchGroupCode').value=code;$v('#watchGroupMarket').value=marketName;$v('#watchGroupName').value=w[i].group||'';openSheet('watchGroupSheet');setTimeout(()=>$v('#watchGroupName')?.focus(),180)}
  function saveWatchGroup(clear=false){const code=$v('#watchGroupCode').value,marketName=$v('#watchGroupMarket').value,w=getWatch(),i=w.findIndex(x=>x.code===code&&x.market===marketName);if(i<0)return closeSheets();w[i].group=clear?'':$v('#watchGroupName').value.trim();setWatch(w);rebuildWatchFilters();renderWatch();closeSheets();toast(clear?'已移到未分組':'分組已更新')}
  window.renderWatch=function(){rebuildWatchFilters();const w=sortedWatch(),box=$v('#watchGrid');if(!box)return;if(!w.length){box.innerHTML='<div class="empty">目前沒有符合條件的自選股。查詢股票後點右上角 ☆ 即可加入。</div>';return}box.innerHTML=w.map(x=>{const c=cacheFor(x),cls=c.changePct>0?'up':c.changePct<0?'down':'muted',score=Number.isFinite(Number(c.score))?`${Math.round(c.score)}分`:'—',dy=Number.isFinite(Number(c.yield))?`${Number(c.yield).toFixed(2)}%`:'—';return `<article class="watchCard premiumWatch" data-code="${esc(x.code)}" data-market="${esc(x.market)}"><div class="watchTop"><div><div class="watchName">${esc(c.name||x.name||x.code)}</div><div class="watchCode">${esc(x.market)} · ${esc(x.code)} · ${esc(x.group||'未分組')}</div></div><button class="watchGroupBtn" data-act="group">分組</button></div><div class="watchPrice">${fmt(c.price)}</div><div class="watchMetrics"><b class="${cls}">${Number.isFinite(Number(c.changePct))?pct2(Number(c.changePct)):'尚未更新'}</b><span>技術 ${score}</span><span>殖利率 ${dy}</span></div><div class="microStamp">${c.t?'更新 '+new Date(c.t).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'點擊股票取得完整資料'}</div></article>`}).join('');box.querySelectorAll('.watchCard').forEach(card=>{card.addEventListener('click',e=>{if(e.target.closest('[data-act]'))return;setMarket(card.dataset.market);showScreen('market');$v('#q').value=card.dataset.code;search(card.dataset.code)});card.querySelector('[data-act="group"]')?.addEventListener('click',e=>{e.stopPropagation();setGroup(card.dataset.code,card.dataset.market)})})};
  // Today focus: reuse existing endpoints; lazy and cached in browser session
  async function loadTodayFocus(force=false){
    const root=$v('#todayFocus');if(!root)return;
    if(!force&&Date.now()-focusLoadedAt<30000)return;
    focusLoadedAt=Date.now();
    const cached=read(KEY_FOCUS,null);
    if(!cached?.cards?.length)root.innerHTML='<div class="focusSkeleton"></div><div class="focusSkeleton"></div><div class="focusSkeleton"></div>';
    const renderCards=(cards,stamp,label='更新')=>{
      if(!cards?.length)return false;
      root.innerHTML=cards.slice(0,6).map(x=>`<button class="focusCard" data-code="${esc(x.code)}" data-market="${esc(x.market||'TW')}"><span>${esc(x.kind)}</span><b>${esc(x.title)}</b><strong>${esc(x.value)}</strong><small>${esc(x.sub||'')}</small></button>`).join('');
      root.querySelectorAll('.focusCard').forEach(b=>b.onclick=()=>openSymbol(b.dataset.market||'TW',b.dataset.code));
      const pill=$v('#focusUpdated');if(pill)pill.textContent=`${label} ${new Date(stamp||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`;
      return true;
    };
    try{
      const ym=new Date().toISOString().slice(0,7);
      const [rr,dd,mr]=await Promise.allSettled([
        fetch('/api/radar',{cache:'no-store'}).then(r=>r.json()),
        fetch(`/api/dividends?month=${ym}`,{cache:'no-store'}).then(r=>r.json()),
        fetch('/api/market-rankings?sort=gain&limit=6',{cache:'no-store'}).then(r=>r.json())
      ]);
      const radar=rr.status==='fulfilled'?(rr.value.items||[]):[],divs=dd.status==='fulfilled'?(dd.value.items||[]):[],movers=mr.status==='fulfilled'?(mr.value.items||[]):[];
      const prev=read(KEY_RADAR,[]),prevSet=new Set(prev),nowCodes=radar.map(x=>x.code);write(KEY_RADAR,nowCodes);
      const upcoming=divs.filter(x=>x.date>=new Date().toISOString().slice(0,10)).slice(0,4),cards=[];
      radar.slice(0,2).forEach(x=>cards.push({kind:prevSet.has(x.code)?'強勢觀察':'新進強勢',title:`${x.name} ${x.code}`,value:`${x.score} 分`,sub:(x.reasons||[]).slice(0,2).join(' · '),code:x.code,market:'TW'}));
      radar.filter(x=>x.event).slice(0,2).forEach(x=>cards.push({kind:'重大訊息',title:`${x.name} ${x.code}`,value:'新訊息',sub:String(x.event).slice(0,58),code:x.code,market:'TW'}));
      upcoming.slice(0,2).forEach(x=>cards.push({kind:x.highYield?'高配息事件':'除權息',title:`${x.name} ${x.code}`,value:x.date.slice(5),sub:Number.isFinite(x.eventYield)?`本次配息率約 ${x.eventYield.toFixed(2)}%`:'即將除權息',code:x.code,market:'TW'}));
      if(cards.length<3)movers.filter(x=>Number(x.changePct)>0).slice(0,3-cards.length).forEach(x=>cards.push({kind:'盤中強勢',title:`${x.name||x.code} ${x.code}`,value:`${Number(x.changePct)>0?'+':''}${Number(x.changePct).toFixed(2)}%`,sub:`現價 ${Number.isFinite(Number(x.price))?Number(x.price).toLocaleString('zh-TW'):'—'} · 官方公開行情`,code:x.code,market:'TW'}));
      if(cards.length){const payload={cards,updatedAt:Date.now()};write(KEY_FOCUS,payload);renderCards(cards,payload.updatedAt);return}
      if(cached?.cards?.length){renderCards(cached.cards,cached.updatedAt,'最近成功');return}
      root.innerHTML='<div class="empty">目前沒有新增焦點，行情排行仍會持續更新。</div>';
    }catch(e){
      if(cached?.cards?.length)renderCards(cached.cards,cached.updatedAt,'最近成功');
      else root.innerHTML='<div class="empty">焦點來源暫時無法取得，其他即時行情仍會持續更新。</div>';
    }
  }

  // Portfolio
  function getPortfolio(){return read(KEY_PORT,[])}
  function savePortfolio(a){write(KEY_PORT,a.slice(0,80))}
  function portCacheKey(x){return `aevoryn-port-quote-${x.market}-${x.code}`}
  function getPortQuote(x){return read(portCacheKey(x),{})}
  function setPortQuote(x,q){write(portCacheKey(x),q)}
  async function quoteOne(x){if(x.market==='TW'){const q=await fetch(`/api/quote?code=${encodeURIComponent(x.code)}`,{cache:'no-store'}).then(r=>r.json());if(q.available){const z={price:n(q.price??q.prevClose),changePct:n(q.changePct),t:Date.now(),date:q.date,name:q.name||x.name};setPortQuote(x,z);return z}return getPortQuote(x)}const key=localStorage.getItem('pulse-av-key')||'';if(!key)return getPortQuote(x);try{const d=await fetch(`/api/us?symbol=${encodeURIComponent(x.code)}`,{headers:{'X-AV-Key':key}}).then(r=>r.json());if(d?.snapshot?.close){const z={price:n(d.snapshot.close),changePct:n(d.snapshot.changePct),t:Date.now(),date:d.snapshot.date,name:d.snapshot.name||x.name};setPortQuote(x,z);return z}}catch{}return getPortQuote(x)}
  function allocationPalette(i){return ['#6b63ff','#55a7ff','#c5a46d','#1dbb9d','#ff8c42','#8b5cf6','#6cc7bb'][i%7]}
  function renderAllocationMarket(rows,marketName){const a=rows.filter(x=>x.market===marketName).map(x=>{const q=getPortQuote(x),p=n(q.price),qty=n(x.qty)||0,cost=n(x.cost)||0,value=(Number.isFinite(p)?p:cost)*qty;return{code:x.code,name:q.name||x.name||x.code,value}}).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);if(!a.length)return'';const total=a.reduce((s,x)=>s+x.value,0),top=a.slice(0,6),rest=a.slice(6).reduce((s,x)=>s+x.value,0),parts=rest>0?[...top,{code:'OTHER',name:'其他',value:rest}]:top;let at=0,stops=[];parts.forEach((x,i)=>{const pct=x.value/total*100,from=at,to=at+pct;stops.push(`${allocationPalette(i)} ${from.toFixed(2)}% ${to.toFixed(2)}%`);at=to});const cur=marketName==='TW'?'TWD':'USD';return `<div class="allocationMarket"><div class="allocationDonut" style="--allocation:${stops.join(',')}" aria-label="${marketName} 投組配置"><div><b>${marketName==='TW'?'台股':'美股'}</b><span>${money2(total,cur)}</span></div></div><div class="allocationLegend">${parts.map((x,i)=>`<div><i style="background:${allocationPalette(i)}"></i><b>${esc(x.name)}</b><span>${(x.value/total*100).toFixed(1)}%</span></div>`).join('')}</div></div>`}
  function renderPortfolioAllocation(rows){const host=$v('#portfolioAllocation');if(!host)return;const html=renderAllocationMarket(rows,'TW')+renderAllocationMarket(rows,'US');host.innerHTML=html||'<div class="empty">加入持股後顯示配置。</div>'}
  function communityClientId(){let id=localStorage.getItem('clarinavi-community-client');if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;localStorage.setItem('clarinavi-community-client',id)}return id}
  function renderCommunityBoard(j){const box=$v('#communityPortfolioList'),src=$v('#communityPortfolioSource');if(!box)return;if(!j?.enabled){box.innerHTML='<div class="empty">公開排行榜尚未啟用雲端儲存。私人投組與配置圖仍可正常使用。</div>';if(src)src.textContent='要跨使用者保存 Top 10，可在 Vercel 專案設定免費 Upstash / Vercel KV REST 環境變數；未設定時不顯示假排行榜。';return}const items=j.items||[];box.innerHTML=items.length?items.map((x,i)=>`<article class="communityPortfolioRow"><div class="communityRank">${i+1}</div><div class="communityIdentity"><b>${esc(x.nickname||'匿名投資人')}</b><span>${x.publishedAt?new Date(x.publishedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</span></div><div class="communityReturn ${x.returnPct>0?'up':x.returnPct<0?'down':'muted'}"><b>${pct2(Number(x.returnPct))}</b><span>公開時未實現報酬</span></div><div class="communityAllocation">${(x.allocation||[]).slice(0,10).map(a=>`<span>${esc(a.name||a.code)} ${Number(a.weight||0).toFixed(0)}%</span>`).join('')}</div></article>`).join(''):'<div class="empty">目前還沒有使用者公開投組。</div>';if(src)src.textContent=j.source||'使用者主動匿名公開＋TWSE MIS 公開市況驗證。'}
  async function loadCommunityBoard(force=false){if(!force&&Date.now()-communityLoadedAt<60000)return;communityLoadedAt=Date.now();const box=$v('#communityPortfolioList');if(!box)return;box.innerHTML='<div class="skeleton" style="height:120px"></div>';try{const j=await fetch('/api/community-portfolios',{cache:'no-store'}).then(r=>r.json());renderCommunityBoard(j)}catch(e){box.innerHTML='<div class="empty">公開排行榜暫時無法取得。</div>'}}
  async function publishCommunityPortfolio(){const rows=getPortfolio().filter(x=>x.market==='TW');if(!rows.length)return toast('公開排行榜目前只驗證台股持股');if(!confirm('公開後只顯示匿名暱稱、股票配置權重與報酬率；不公開本金、股數或成本。是否繼續？'))return;const nickname=(prompt('公開暱稱（可留白）','匿名投資人')||'匿名投資人').trim().slice(0,18);const btn=$v('#portfolioPublish');if(btn){btn.disabled=true;btn.textContent='驗證中…'}try{const r=await fetch('/api/community-portfolios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:communityClientId(),nickname,positions:rows.map(x=>({code:x.code,name:x.name,qty:x.qty,cost:x.cost}))})}),j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'公開失敗');toast('已匿名公開投組績效');communityLoadedAt=0;await loadCommunityBoard(true)}catch(e){toast(e.message||'公開排行暫時無法使用')}finally{if(btn){btn.disabled=false;btn.textContent='匿名公開'}}}
  function renderPortfolio(){const rows=getPortfolio(),root=$v('#portfolioList'),sum=$v('#portfolioSummary');if(!root||!sum)return;renderPortfolioAllocation(rows);if(!rows.length){sum.innerHTML='<div class="portHeroEmpty"><b>建立你的第一個投資組合</b><span>輸入持有股數與平均成本，台股盤中可依公開行情更新未實現損益；美股免費模式依最近 EOD。</span></div>';root.innerHTML='<div class="empty">尚無持股。點「新增持股」開始記錄。</div>';return}let tw={cost:0,mv:0,pnl:0},us={cost:0,mv:0,pnl:0};const html=rows.map(x=>{const q=getPortQuote(x),p=n(q.price),qty=n(x.qty)||0,cost=n(x.cost)||0,mv=Number.isFinite(p)?p*qty:null,pnl=Number.isFinite(p)?(p-cost)*qty:null,ret=cost&&Number.isFinite(p)?(p/cost-1)*100:null,b=x.market==='TW'?tw:us;b.cost+=cost*qty;if(Number.isFinite(mv)){b.mv+=mv;b.pnl+=pnl}return `<article class="portfolioRow" data-id="${esc(x.id)}"><div class="portIdentity"><b>${esc(q.name||x.name||x.code)}</b><span>${esc(x.market)} · ${esc(x.code)} · ${qty.toLocaleString()} 股</span></div><div class="portPrice"><b>${Number.isFinite(p)?fmt(p):'—'}</b><span>成本 ${fmt(cost)}</span></div><div class="portPnl ${pnl>0?'up':pnl<0?'down':'muted'}"><b>${money2(pnl,x.market==='TW'?'TWD':'USD')}</b><span>${pct2(ret)}</span></div><div class="portActions"><button data-edit>編輯</button><button data-del>刪除</button></div><div class="microStamp">${q.t?'更新 '+new Date(q.t).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'尚未取得行情'}</div></article>`}).join('');root.innerHTML=html;const tiles=[];if(rows.some(x=>x.market==='TW'))tiles.push(portSummaryTile('台股市值',tw.mv,'TWD'),portSummaryTile('台股未實現',tw.pnl,'TWD',tw.cost?tw.pnl/tw.cost*100:null));if(rows.some(x=>x.market==='US'))tiles.push(portSummaryTile('美股市值',us.mv,'USD'),portSummaryTile('美股未實現',us.pnl,'USD',us.cost?us.pnl/us.cost*100:null));sum.innerHTML=tiles.join('');root.querySelectorAll('.portfolioRow').forEach(r=>{r.querySelector('[data-edit]').onclick=()=>openPortfolioEditor(r.dataset.id);r.querySelector('[data-del]').onclick=()=>{if(confirm('移除此持股紀錄？')){savePortfolio(getPortfolio().filter(x=>x.id!==r.dataset.id));renderPortfolio()}}});}
  function portSummaryTile(label,val,cur,ret){return `<div class="portSummaryTile"><span>${label}</span><b class="${val>0&&label.includes('未實現')?'up':val<0?'down':''}">${money2(val,cur)}</b>${Number.isFinite(ret)?`<small class="${ret>0?'up':ret<0?'down':''}">${pct2(ret)}</small>`:''}</div>`}
  async function refreshPortfolio(force=false){if(portfolioBusy)return;const rows=getPortfolio();if(!rows.length)return renderPortfolio();portfolioBusy=true;$v('#portfolioRefresh').textContent='更新中…';const tw=rows.filter(x=>x.market==='TW'),us=rows.filter(x=>x.market==='US');if(tw.length){try{const j=await fetch(`/api/portfolio-quotes?codes=${encodeURIComponent(tw.map(x=>x.code).join(','))}`,{cache:'no-store'}).then(r=>r.json());for(const q of j.items||[]){const x=tw.find(v=>v.code===q.code);if(x&&Number.isFinite(n(q.price)))setPortQuote(x,{price:n(q.price),changePct:n(q.changePct),t:Date.now(),date:q.date,name:q.name||x.name})}}catch{await Promise.all(tw.slice(0,8).map(x=>quoteOne(x).catch(()=>null)))}}if(force&&us.length){for(const x of us.slice(0,5))await quoteOne(x).catch(()=>null)}portfolioBusy=false;$v('#portfolioRefresh').textContent='更新損益';$v('#portfolioUpdated').textContent='最後更新 '+nowTime()+' · 台股公開快照';renderPortfolio()}
  function openPortfolioEditor(id=''){const rows=getPortfolio(),x=rows.find(v=>v.id===id);$v('#portEditId').value=id;$v('#portMarket').value=x?.market||'TW';$v('#portCode').value=x?.code||'';$v('#portName').value=x?.name||'';$v('#portQty').value=x?.qty??'';$v('#portCost').value=x?.cost??'';openSheet('portfolioSheet')}
  function savePortfolioForm(){const id=$v('#portEditId').value,marketName=$v('#portMarket').value,code=$v('#portCode').value.trim().toUpperCase(),name=$v('#portName').value.trim(),qty=n($v('#portQty').value),cost=n($v('#portCost').value);if(!code||!(qty>0)||!(cost>=0))return toast('請填入代號、股數與成本價');const rows=getPortfolio(),row={id:id||crypto.randomUUID?.()||String(Date.now()),market:marketName,code,name:name||code,qty,cost};const i=rows.findIndex(x=>x.id===id);if(i>=0)rows[i]=row;else rows.unshift(row);savePortfolio(rows);closeSheets();renderPortfolio();refreshPortfolio(true);toast(id?'持股已更新':'已加入投資組合')}

  // Interactive first-run product tour: navigate to the real feature, then spotlight it.
  const tourSteps=[
    {tag:'01 · 行情首頁',title:'先看今天市場在走什麼',body:'這裡是每天打開 ClariNavi 的第一站。先看市場播報、國際指數與台股盤勢。',screen:'market',target:'#marketBroadcast',hint:'正在聚焦「市場播報」；盤中會持續更新。'},
    {tag:'02 · 搜尋個股',title:'直接輸入代號或名稱',body:'搜尋框是最快入口。輸入台股代號或美股代號後，會進入個股研究頁。',screen:'market',target:'#q',hint:'試著記住這個搜尋框；導覽不會替你送出搜尋。'},
    {tag:'03 · ETF',title:'ETF 有自己的排行與分類',body:'ETF 頁可依成交量、漲跌、價格、定期定額與類型切換，不必混在個股排行裡找。',screen:'etf',target:'#screen-etf .pageTitle',hint:'已實際切到 ETF 頁。'},
    {tag:'04 · 排行',title:'快速找市場正在動的股票',body:'Top 100 可以切換上市、上櫃，以及價格、漲跌、成交量與成交金額排序。',screen:'rank',target:'#screen-rank .rankTabs, #screen-rank .pageTitle',hint:'已實際切到排行頁；盤中頁面可見時會持續更新。'},
    {tag:'05 · 自選',title:'把真正關心的標的留下來',body:'加入自選後，可以排序、分組，再從這裡快速回到個股分析。',screen:'watch',target:'#screen-watch .pageTitle',hint:'自選資料只依你的操作建立，導覽不會自動加入股票。'},
    {tag:'06 · 產業',title:'從產業角度找股票',body:'產業頁可以搜尋類別並篩選台股估值、殖利率等條件，適合從族群開始研究。',screen:'industry',target:'#screen-industry .pageTitle',hint:'已實際切到產業頁。'},
    {tag:'07 · 強勢雷達',title:'把技術訊號集中成雷達',body:'雷達把市場候選標的整理成較容易掃描的清單，再回到個股頁做第二層確認。',screen:'radar',target:'#screen-radar .pageTitle',hint:'雷達是研究工具，不是買賣訊號。'},
    {tag:'08 · 研究工具',title:'進階服務收在首頁這一排',body:'投組、配息、申購、法人、警示、新聞、KOL 與設定都放在這裡；點進去才載入，首頁保持輕量。',screen:'market',target:'#serviceDock',hint:'這排就是「工具」導覽的目的地；手機底部工具鍵也會帶你到這裡。'},
    {tag:'09 · 投資組合',title:'用自己的成本看未實現損益',body:'投組頁可記錄成本與股數，台股盤中停留此頁時會更新公開行情快照。',screen:'portfolio',target:'#screen-portfolio .pageTitle',hint:'已實際切到投資組合；導覽不會建立或修改持股。'},
    {tag:'10 · 完成',title:'之後可以從設定重新播放',body:'你已走過主要功能。台股資料較完整；美股則依實際可取得資料源顯示功能，沒有可靠資料才隱藏。',screen:'market',target:'#serviceDock',hint:'完成後回到行情首頁開始使用。'}
  ];
  let tourI=0,tourTarget=null;
  function clearTourTarget(){
    document.querySelectorAll('.tourTarget').forEach(x=>x.classList.remove('tourTarget'));
    tourTarget=null;
  }
  function resolveTourTarget(sel){
    if(!sel)return null;
    for(const part of sel.split(',')){const x=document.querySelector(part.trim());if(x&&x.offsetParent!==null)return x}
    return null;
  }
  function positionTour(){
    const overlay=$v('#onboarding'),card=$v('#tourCard'),spot=$v('#tourSpot');
    if(!overlay?.classList.contains('show')||!card)return;
    const t=tourTarget;
    if(!t){spot?.classList.remove('show');card.style.removeProperty('--tour-x');card.style.removeProperty('--tour-y');return}
    const r=t.getBoundingClientRect(),pad=8;
    if(spot){
      spot.classList.add('show');
      spot.style.left=Math.max(6,r.left-pad)+'px';spot.style.top=Math.max(6,r.top-pad)+'px';
      spot.style.width=Math.min(innerWidth-12,r.width+pad*2)+'px';spot.style.height=Math.min(innerHeight-12,r.height+pad*2)+'px';
    }
    const cw=Math.min(390,innerWidth-24),ch=card.offsetHeight||300,gap=14;
    let x=Math.min(Math.max(12,r.left),innerWidth-cw-12);
    let y=r.bottom+gap;
    if(y+ch>innerHeight-12)y=Math.max(12,r.top-ch-gap);
    card.style.width=cw+'px';card.style.left=x+'px';card.style.top=y+'px';
  }
  function activateTourStep(x){
    clearTourTarget();
    if(x.screen&&typeof showScreen==='function')showScreen(x.screen);
    setTimeout(()=>{
      tourTarget=resolveTourTarget(x.target);
      if(tourTarget){
        tourTarget.classList.add('tourTarget');
        tourTarget.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
        setTimeout(positionTour,220);
      }else positionTour();
    },140);
  }
  function renderTour(){
    const x=tourSteps[tourI];
    $v('#tourTag').textContent=x.tag;$v('#tourTitle').textContent=x.title;$v('#tourBody').textContent=x.body;
    $v('#tourActionHint').textContent=x.hint||'';
    $v('#tourDots').innerHTML=tourSteps.map((_,i)=>`<i class="${i===tourI?'active':''}"></i>`).join('');
    $v('#tourNext').textContent=tourI===tourSteps.length-1?'開始使用':'下一步';
    activateTourStep(x);
  }
  function openTour(){tourI=0;$v('#onboarding')?.classList.add('show');document.body.classList.add('tourOpen');renderTour()}
  function closeTour(){write(KEY_TOUR,{done:true,t:Date.now()});clearTourTarget();$v('#tourSpot')?.classList.remove('show');$v('#onboarding')?.classList.remove('show');document.body.classList.remove('tourOpen');const c=$v('#tourCard');if(c){c.style.left='';c.style.top='';c.style.width=''}}
  window.addEventListener('resize',()=>{if($v('#onboarding')?.classList.contains('show'))positionTour()},{passive:true});

  // wrap navigation to refresh portfolio/focus and stop unnecessary polling
  const oldShow52=window.showScreen;
  if(typeof oldShow52==='function') window.showScreen=function(id){oldShow52(id);clearInterval(portTimer);portTimer=null;if(id==='portfolio'){renderPortfolio();refreshPortfolio(false);loadCommunityBoard(false);portTimer=setInterval(()=>{if($v('#screen-portfolio')?.classList.contains('active')&&twLivePollingAllowed())refreshPortfolio(false)},DATA_REFRESH.portfolio)}if(id==='market')setTimeout(()=>loadTodayFocus(false),80)};

  // interactions
  $v('#watchGroupSave')?.addEventListener('click',()=>saveWatchGroup(false));
  $v('#watchGroupClear')?.addEventListener('click',()=>saveWatchGroup(true));
  $v('#portfolioAdd')?.addEventListener('click',()=>openPortfolioEditor());
  $v('#portfolioRefresh')?.addEventListener('click',()=>refreshPortfolio(true));
  $v('#portfolioPublish')?.addEventListener('click',publishCommunityPortfolio);
  $v('#refreshWatch')?.addEventListener('click',()=>setTimeout(()=>{$v('#watchUpdated')&&($v('#watchUpdated').textContent='更新 '+nowTime())},400));
  $v('#portSave')?.addEventListener('click',savePortfolioForm);
  $v('#watchSort')?.addEventListener('change',e=>{watchSort=e.target.value;renderWatch()});
  $v('#watchGroupFilter')?.addEventListener('change',e=>{watchGroup=e.target.value;renderWatch()});
  $v('#focusRefresh')?.addEventListener('click',()=>loadTodayFocus(true));
  $v('#tourNext')?.addEventListener('click',()=>{if(tourI<tourSteps.length-1){tourI++;renderTour()}else closeTour()});
  $v('#tourSkip')?.addEventListener('click',closeTour);
  $v('#tourReplay')?.addEventListener('click',()=>{closeSheets();openTour()});

  // Lightweight industry filters. TW uses exchange-wide official quote/valuation maps from /api/industry.
  function renderIndustry52(){
    if(!industryData)return;
    const data=industryData,q=($v('#industrySearch')?.value||'').trim().toUpperCase(),sectors=data.sectors||[];
    const capMin=Number($v('#industryCap')?.value||0),yieldMin=Number($v('#industryYield')?.value||0),peMax=Number($v('#industryPe')?.value||0),isTW=industryMarket==='TW';
    [$v('#industryCap'),$v('#industryYield'),$v('#industryPe')].forEach(x=>{if(x)x.disabled=!isTW});
    $v('#industryChips').innerHTML=`<button class="industryChip ${!industrySelected?'active':''}" data-industry="">全部</button>`+sectors.map(x=>`<button class="industryChip ${industrySelected===x.id?'active':''}" data-industry="${esc(x.id)}">${esc(x.name)} <small>${x.count}</small></button>`).join('');
    $v('#industryChips').querySelectorAll('.industryChip').forEach(b=>b.onclick=()=>{industrySelected=b.dataset.industry||'';renderIndustry52()});
    let a=(data.items||[]).filter(x=>(!industrySelected||x.industryCode===industrySelected)&&(!q||String(x.code).includes(q)||String(x.name||'').toUpperCase().includes(q)||String(x.industry||'').toUpperCase().includes(q)));
    if(isTW){
      if(capMin)a=a.filter(x=>Number.isFinite(Number(x.marketCap))&&Number(x.marketCap)>=capMin);
      if(yieldMin)a=a.filter(x=>Number.isFinite(Number(x.yield))&&Number(x.yield)>=yieldMin);
      if(peMax)a=a.filter(x=>Number.isFinite(Number(x.pe))&&Number(x.pe)>0&&Number(x.pe)<=peMax);
    }
    const title=industrySelected?(sectors.find(x=>x.id===industrySelected)?.name||'產業'):'全部產業';
    $v('#industryTitle').textContent=title;$v('#industryCount').textContent=`${a.length} 檔`;
    $v('#industryNote').textContent=isTW?'可用產業、規模、殖利率與估值快速縮小範圍。數值以最近可得交易所公開資料為準。':'美股為高流動性產業快選；免費行情依個人 Alpha Vantage Key 按需讀取。';
    $v('#industryList').innerHTML=a.length?a.slice(0,400).map(x=>{const pc=Number(x.changePct),py=Number(x.yield),pp=Number(x.pe),mc=Number(x.marketCap);return `<button class="industryStock" data-code="${esc(x.code)}"><div class="left"><b>${esc(x.name)} <span class="muted">${esc(x.code)}</span></b><small>${esc(x.market)} · ${esc(x.industry)}</small></div><div class="marketMetrics">${Number.isFinite(Number(x.price))?`<strong class="${pc>0?'up':pc<0?'down':''}">${fmt(Number(x.price))}</strong>`:''}${Number.isFinite(pc)?`<span class="${pc>0?'up':pc<0?'down':''}">${pc>0?'+':''}${pc.toFixed(2)}%</span>`:''}${Number.isFinite(py)?`<em>殖 ${py.toFixed(1)}%</em>`:''}${Number.isFinite(pp)?`<em>PE ${pp.toFixed(1)}</em>`:''}${Number.isFinite(mc)?`<em>${(mc/1e8).toFixed(0)}億</em>`:''}<span class="openArrow">›</span></div></button>`}).join(''):'<div class="empty">沒有符合條件的公司。</div>';
    $v('#industryList').querySelectorAll('.industryStock').forEach(b=>b.onclick=()=>openSymbol(industryMarket,b.dataset.code));
  }
  renderIndustry=renderIndustry52;
  if($v('#industrySearch'))$v('#industrySearch').oninput=renderIndustry52;
  ['#industryCap','#industryYield','#industryPe'].forEach(sel=>$v(sel)?.addEventListener('change',renderIndustry52));

  // Beginner-friendly institutional summary: keep the raw table, add one concise interpretation above it.
  function institutionStreak(inst){
    const rows=(inst||[]).filter(x=>Number.isFinite(Number(x.total)));
    if(!rows.length)return null;
    const last=rows.at(-1), sign=Number(last.total)>0?1:Number(last.total)<0?-1:0;
    if(!sign)return {days:0,sign:0,sum5:rows.slice(-5).reduce((a,x)=>a+(Number(x.total)||0),0)};
    let days=0;for(let i=rows.length-1;i>=0;i--){const z=Number(rows[i].total)||0;if((z>0?1:z<0?-1:0)!==sign)break;days++;}
    return {days,sign,sum5:rows.slice(-5).reduce((a,x)=>a+(Number(x.total)||0),0),trust5:rows.slice(-5).reduce((a,x)=>a+(Number(x.trust)||0),0)};
  }
  const oldRenderChips52=window.renderChips;
  if(typeof oldRenderChips52==='function')window.renderChips=function(d){
    oldRenderChips52(d);
    const box=$v('#chipSummary');if(!box)return;
    let note=$v('#chipPlainSummary');if(!note){note=document.createElement('div');note.id='chipPlainSummary';note.className='chipPlainSummary';box.insertAdjacentElement('afterend',note)}
    const st=institutionStreak(d?.institutional||[]), hist=d?.tdccHistory||[];
    if(!st){note.textContent='法人歷史資料不足，先以大戶持股與融資券變化作為輔助。';return}
    const big=hist.length>=2&&Number.isFinite(Number(hist.at(-1)?.big400))&&Number.isFinite(Number(hist[0]?.big400))?Number(hist.at(-1).big400)-Number(hist[0].big400):null;
    const dir=st.sign>0?'買超':st.sign<0?'賣超':'買賣互見';
    const parts=[st.days?`法人連續 ${st.days} 日${dir}`:`法人近期${dir}`,`近5日合計 ${lots(st.sum5)}`];
    if(Number.isFinite(st.trust5)&&st.trust5!==0)parts.push(`投信5日${st.trust5>0?'偏買':'偏賣'} ${lots(Math.abs(st.trust5))}`);
    if(Number.isFinite(big))parts.push(`400張以上大戶${big>=0?'增加':'減少'} ${Math.abs(big).toFixed(2)}pp`);
    note.textContent=parts.join(' · ');
  };

  // dataset freshness labels
  const oldRadar=window.loadRadar;if(typeof oldRadar==='function')window.loadRadar=async function(force){const r=await oldRadar(force);$v('#radarUpdated')&&($v('#radarUpdated').textContent='更新 '+nowTime());return r};
  const oldCal=window.loadCalendar;if(typeof oldCal==='function')window.loadCalendar=async function(force){const r=await oldCal(force);$v('#calendarUpdated')&&($v('#calendarUpdated').textContent='更新 '+nowTime());return r};
  const oldIndustry=window.loadIndustry;if(typeof oldIndustry==='function')window.loadIndustry=async function(force){const r=await oldIndustry(force);$v('#industryUpdated')&&($v('#industryUpdated').textContent='更新 '+nowTime());return r};

  // expose beginner-oriented feature audit only internally, not UI rules
  window.ClariNavi={refreshPortfolio,loadTodayFocus,openTour};
  setTimeout(()=>{rebuildWatchFilters();renderWatch();loadTodayFocus(false);if(!read(KEY_TOUR,null))openTour()},350);
})();

(()=>{
  let stockData=null, marketData=null, activeCard=null;
  const $q=s=>document.querySelector(s), n=v=>Number.isFinite(Number(v))?Number(v):null;
  const fmt=(v,d=2)=>Number.isFinite(n(v))?n(v).toLocaleString('zh-TW',{maximumFractionDigits:d}):'—';
  const signed=(v,d=2)=>Number.isFinite(n(v))?`${n(v)>0?'+':''}${fmt(v,d)}`:'—';
  const avatarHtml=()=>'<img class="guideAvatar" src="/guide-avatar.webp" alt="ClariNavi 市場學習助理" loading="lazy" decoding="async">';
  document.querySelectorAll('[data-avatar]').forEach(x=>x.innerHTML=avatarHtml());
  function setState(el,text,kind=''){if(!el)return;el.textContent=text;el.className=`broadcastState ${kind}`.trim()}
  function marketInterpret(j){
    const pairs=j?.global?.pairs||j?.pairs||[], cards=j?.global?.cards||j?.cards||[];
    const find=k=>cards.find(x=>x?.key===k||x?.symbol===k)||pairs.flatMap(x=>[x?.spot,x?.future]).find(x=>x?.key===k||x?.symbol===k);
    const tw=find('TAIEX')||pairs.find(x=>x?.spot?.symbol==='TAIEX')?.spot, tx=find('TX')||pairs.find(x=>x?.future?.symbol==='TX')?.future;
    const ch=n(tw?.changePct),fp=n(tx?.changePct),parts=[];let state='大盤整理',kind='';
    if(Number.isFinite(ch)){state=ch>0?'大盤上漲':ch<0?'大盤下跌':'大盤平盤';kind=ch>0?'positive':ch<0?'negative':'';parts.push(`台灣加權指數 ${fmt(tw?.price)}，${ch>0?'上漲':ch<0?'下跌':'平盤'} ${fmt(Math.abs(ch))}%`)}
    if(Number.isFinite(fp))parts.push(`台指期 ${fmt(tx?.price)}，${fp>0?'上漲':fp<0?'下跌':'平盤'} ${fmt(Math.abs(fp))}%`);
    if(Number.isFinite(ch)&&Number.isFinite(fp))parts.push(Math.sign(ch)===Math.sign(fp)?'期現貨方向一致':'期現貨方向分歧');
    return{state,kind,text:(parts.length?parts.join('；'):'大盤資料更新中')+'。',meta:'只播報台灣大盤與台指期；公開行情可能延遲。'}
  }
  function stockInterpret(d){
    if(!d?.snapshot)return{state:'等待行情',kind:'',text:'查詢完成後會整理當日狀態與研究觀察重點。'};
    const s=d.snapshot,a=d.analysis||{},ch=n(s.changePct),price=n(s.close),ma20=n(a.ma20),rsi=n(a.rsi14),vr=n(a.volumeRatio),score=n(a.score);
    let state=s.isRealtimePrice?'盤中觀察':'收盤中性',kind='';
    if((score??50)>=72){state=s.isRealtimePrice?'盤中偏多':'偏多收盤';kind='positive'}else if((score??50)<=38){state=s.isRealtimePrice?'盤中偏弱':'偏弱收盤';kind='negative'}else if(rsi>=78){state='短線偏熱';kind='warning'}
    const spokenName=(s.name&&String(s.name).trim()&&String(s.name).trim()!==String(s.code||'').trim())?String(s.name).trim():'這檔標的';
    const parts=[];parts.push(`${spokenName}${s.isRealtimePrice?'目前':'最近收盤'} ${fmt(price)} 元${Number.isFinite(ch)?`，漲跌 ${signed(ch)}%`:''}`);if(Number.isFinite(ma20)&&Number.isFinite(price))parts.push(price>=ma20?'價格站在20日均線之上':'價格仍低於20日均線');if(Number.isFinite(rsi))parts.push(rsi>=75?`RSI ${fmt(rsi,0)} 偏熱`:rsi>=50?`RSI ${fmt(rsi,0)} 位於多方區`:`RSI ${fmt(rsi,0)} 偏弱`);if(Number.isFinite(vr))parts.push(`短期量比約 ${fmt(vr,2)} 倍`);
    let advice=(d.analysis?.reasons||[]).slice(0,2).join('、');if(advice)advice=`目前訊號重點是${advice}。`;
    const research=$q('#researchAdviceText')?.textContent?.trim();if(research&&research.length>20&&!research.includes('形成研究摘要'))advice=research;
    return{state,kind,text:`${parts.join('；')}。${advice||'可持續觀察支撐、壓力與量能是否互相確認。'}`,meta:`資料：${s.source||d.meta?.latencyType||'公開市場資料'} · 僅供研究參考`};
  }
  function pairInterpret(symbol){const pairs=marketData?.global?.pairs||[],x=pairs.find(p=>p?.spot?.symbol===symbol||p?.future?.symbol===symbol);if(!x)return'';const s=x.spot||{},f=x.future||{},c=n(s.changePct),fc=n(f.changePct);let tone='走勢震盪';if(c>=.8)tone='收盤偏強';else if(c<=-.8)tone='收盤偏弱';else if(c>=.25)tone='小幅偏多';else if(c<=-.25)tone='小幅偏空';const sync=Number.isFinite(c)&&Number.isFinite(fc)?(Math.sign(c)===Math.sign(fc)?'期貨方向與現貨一致':'期貨與現貨方向分歧'):'期貨資料待確認';return`${s.name||'指數'}最近數值 ${fmt(s.price)}，漲跌 ${signed(c)}%，目前屬於${tone}。${f.name||'對應期貨'} ${fmt(f.price)}，漲跌 ${signed(fc)}%，${sync}。公開行情可能延遲，僅供市場研究參考。`}
  function bindPairSpeak(){}
  function renderMarket(){const x=marketInterpret(marketData);setState($q('#marketBroadcastState'),x.state,x.kind);$q('#marketBroadcastText').textContent=x.text;$q('#marketBroadcastMeta').textContent=x.meta}
  function renderStock(){const x=stockInterpret(stockData);setState($q('#stockBroadcastState'),x.state,x.kind);$q('#stockBroadcastText').textContent=x.text;$q('#stockBroadcastMeta').textContent=x.meta;$q('#stockBroadcastTitle').textContent=stockData?.snapshot?.isRealtimePrice?'個股盤中解讀':'個股收盤解讀'}
  function pickVoice(){const a=speechSynthesis.getVoices?.()||[];return a.find(v=>/^zh-TW/i.test(v.lang))||a.find(v=>/^zh/i.test(v.lang))||null}
  function speechBtn(card){return card?.id==='stockBroadcast'?$q('#stockSpeakBtn'):$q('#marketSpeakBtn')}
  function resetSpeechBtn(card){const b=speechBtn(card);if(b)b.textContent=card?.id==='stockBroadcast'?'▶ 聽解讀':'▶ 聽播報'}
  function stopSpeech(){
    if('speechSynthesis'in window)speechSynthesis.cancel();
    document.querySelectorAll('.broadcastCard').forEach(c=>{c.classList.remove('speaking','speechPaused');resetSpeechBtn(c)});
    activeCard=null
  }
  function speak(cardSel,textSel){
    if(!('speechSynthesis'in window)){alert('此瀏覽器目前不支援語音播報。');return}
    const card=$q(cardSel),btn=speechBtn(card),text=$q(textSel)?.textContent?.trim();if(!card||!text)return;
    if(activeCard===card&&speechSynthesis.speaking){
      if(speechSynthesis.paused){speechSynthesis.resume();card.classList.remove('speechPaused');if(btn)btn.textContent='Ⅱ 暫停'}
      else{speechSynthesis.pause();card.classList.add('speechPaused');if(btn)btn.textContent='▶ 繼續'}
      return
    }
    stopSpeech();
    const speechText=String(text||'').replace(/\b\d{4,6}[A-Z]?\b\s*/g,'').replace(/\s{2,}/g,' ').trim();const u=new SpeechSynthesisUtterance(speechText);u.lang='zh-TW';u.rate=.96;u.pitch=1.02;const voice=pickVoice();if(voice)u.voice=voice;
    u.onstart=()=>{activeCard=card;card.classList.add('speaking');card.classList.remove('speechPaused');if(btn)btn.textContent='Ⅱ 暫停'};
    u.onend=u.onerror=()=>{card.classList.remove('speaking','speechPaused');resetSpeechBtn(card);activeCard=null};
    try{speechSynthesis.resume()}catch{}
    setTimeout(()=>{try{speechSynthesis.speak(u)}catch(e){alert('語音播放失敗，請確認裝置未靜音並重新點一次播放。')}},60)
  }
  $q('#marketSpeakBtn')?.addEventListener('click',()=>speak('#marketBroadcast','#marketBroadcastText'));
  $q('#stockSpeakBtn')?.addEventListener('click',()=>speak('#stockBroadcast','#stockBroadcastText'));
  window.addEventListener('clarinavi:market-home',e=>{marketData=e.detail;renderMarket();setTimeout(bindPairSpeak,0)});
  const oldRender=window.renderMain;if(typeof oldRender==='function')window.renderMain=function(d){oldRender(d);stockData=d;setTimeout(renderStock,0);setTimeout(renderStock,1800)};
  const adv=$q('#researchAdviceText');if(adv)new MutationObserver(()=>stockData&&renderStock()).observe(adv,{childList:true,subtree:true,characterData:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech()});
  window.ClariNaviBroadcast={stop:stopSpeech,renderStock,renderMarket};
})();

(()=>{
'use strict';
const BRAND='ClariNavi';
const $q=s=>document.querySelector(s), $$q=s=>[...document.querySelectorAll(s)];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(v,d=2)=>Number.isFinite(num(v))?num(v).toLocaleString('zh-TW',{maximumFractionDigits:d}):'—';
const fp=v=>Number.isFinite(num(v))?`${num(v)>0?'+':''}${num(v).toFixed(1)}%`:'—';
const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const now=()=>new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
const state={timelineKey:'',timeline:null,toolsKey:'',radar:null,radarAt:0};
function getLast(){try{return typeof lastData!=='undefined'?lastData:null}catch{return null}}
function getMarket(){try{return typeof market!=='undefined'?market:'TW'}catch{return'TW'}}
function getCode(){try{return typeof current!=='undefined'?current:''}catch{return''}}
function closev(a,b){return Number.isFinite(a)&&Number.isFinite(b)?a-b:null}
function sma(a,n){const o=Array(a.length).fill(null);let s=0,c=0;for(let i=0;i<a.length;i++){if(Number.isFinite(a[i])){s+=a[i];c++}if(i>=n&&Number.isFinite(a[i-n])){s-=a[i-n];c--}if(i>=n-1&&c===n)o[i]=s/n}return o}
function ema(a,n){const o=Array(a.length).fill(null),k=2/(n+1);let p=null;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i]))continue;p=p==null?a[i]:a[i]*k+p*(1-k);o[i]=p}return o}
function rsi(a,n=14){const o=Array(a.length).fill(null);if(a.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){let d=a[i]-a[i-1];d>=0?g+=d:l-=d}let ag=g/n,al=l/n;o[n]=al===0?100:100-100/(1+ag/al);for(let i=n+1;i<a.length;i++){let d=a[i]-a[i-1];ag=(ag*(n-1)+Math.max(d,0))/n;al=(al*(n-1)+Math.max(-d,0))/n;o[i]=al===0?100:100-100/(1+ag/al)}return o}
function macd(a){const e12=ema(a,12),e26=ema(a,26),dif=a.map((_,i)=>Number.isFinite(e12[i])&&Number.isFinite(e26[i])?e12[i]-e26[i]:null),dea=ema(dif.map(x=>x??0),9).map((x,i)=>dif[i]==null?null:x);return{dif,dea,hist:dif.map((x,i)=>Number.isFinite(x)&&Number.isFinite(dea[i])?(x-dea[i])*2:null)}}
function kd(rows,n=9){const K=Array(rows.length).fill(null),D=Array(rows.length).fill(null);let k=50,d=50;for(let i=n-1;i<rows.length;i++){let w=rows.slice(i-n+1,i+1),hi=Math.max(...w.map(x=>x.high??x.close)),lo=Math.min(...w.map(x=>x.low??x.close)),rv=hi===lo?50:(rows[i].close-lo)/(hi-lo)*100;k=k*2/3+rv/3;d=d*2/3+k/3;K[i]=k;D[i]=d}return{k:K,d:D}}
function tech(rows){const c=rows.map(x=>num(x.close)),ma5=sma(c,5),ma10=sma(c,10),ma20=sma(c,20),ma60=sma(c,60),m=macd(c),rr=rsi(c),kk=kd(rows);return{c,ma5,ma10,ma20,ma60,macd:m,rsi:rr,kd:kk}}
function latestCross(a,b){if(!a?.length||a.length<2)return null;const i=a.length-1;if(![a[i],b[i],a[i-1],b[i-1]].every(Number.isFinite))return null;if(a[i-1]<=b[i-1]&&a[i]>b[i])return'up';if(a[i-1]>=b[i-1]&&a[i]<b[i])return'down';return null}
function structure(rows){if(rows.length<60)return null;const i=tech(rows),n=rows.length-1,vals=[i.ma5[n],i.ma10[n],i.ma20[n],i.ma60[n]];if(!vals.every(Number.isFinite))return null;if(vals[0]>vals[1]&&vals[1]>vals[2]&&vals[2]>vals[3])return{label:'均線多頭排列',kind:'good'};if(vals[0]<vals[1]&&vals[1]<vals[2]&&vals[2]<vals[3])return{label:'均線空頭排列',kind:'bad'};return{label:'均線整理',kind:'warn'}}
function pvDivergence(rows){if(rows.length<25)return null;const p5=pct(rows.at(-1).close,rows.at(-6).close),v5=mean(rows.slice(-5).map(x=>num(x.volume)||0)),v20=mean(rows.slice(-25,-5).map(x=>num(x.volume)||0)),vc=pct(v5,v20);if(!Number.isFinite(p5)||!Number.isFinite(vc))return null;if(p5>2&&vc<-15)return{label:'價漲量縮背離',kind:'warn'};if(p5<-2&&vc>20)return{label:'跌價增量警示',kind:'bad'};if(p5>0&&vc>0)return{label:'量價同步',kind:'good'};if(p5<0&&vc<0)return{label:'量縮整理',kind:'warn'};return{label:'量價中性',kind:'warn'}}
function renderSignalStrip(){const d=getLast(),root=$q('.chartCard .indicatorStrip');if(!d?.history?.length||!root)return;let row=$q('#v54SignalRow');if(!row){row=document.createElement('div');row.id='v54SignalRow';row.className='v54SignalRow';root.insertAdjacentElement('beforebegin',row)}const rows=d.history,t=tech(rows),n=rows.length-1,s=structure(rows),pv=pvDivergence(rows),mac=latestCross(t.macd.dif,t.macd.dea),kdc=latestCross(t.kd.k,t.kd.d),r=t.rsi[n],arr=[];if(s)arr.push(s);if(mac)arr.push({label:`MACD ${mac==='up'?'黃金交叉':'死亡交叉'}`,kind:mac==='up'?'good':'bad'});if(kdc)arr.push({label:`KD ${kdc==='up'?'黃金交叉':'死亡交叉'}`,kind:kdc==='up'?'good':'bad'});if(Number.isFinite(r))arr.push({label:`RSI ${r.toFixed(0)}${r>=70?' 偏熱':r<=30?' 偏低':''}`,kind:r>=75?'warn':r<=30?'good':'good'});if(pv)arr.push(pv);row.innerHTML=arr.map(x=>`<span class="v54Sig ${x.kind}">${esc(x.label)}</span>`).join('')}
function injectAvatar(){document.querySelectorAll('[data-avatar]').forEach(x=>{x.innerHTML='<img class="guideAvatar" src="/guide-avatar.webp" alt="ClariNavi 投資學習助理" loading="lazy" decoding="async">'});document.querySelectorAll('.brandText b').forEach(x=>x.textContent=BRAND)}
function injectPanels(){
 const tabs=$q('#subTabs'),deep=$q('#deepPanel');if(tabs&&deep&&!$q('[data-sub="timeline"]')){
   tabs.insertAdjacentHTML('beforeend','<button class="subTab" data-sub="timeline">事件時間軸</button><button class="subTab" data-sub="tools">學習工具</button>');
   deep.insertAdjacentHTML('beforeend',`<section class="subPanel" id="sub-timeline"><div class="sectionHead"><div><h3>全事件時間軸</h3><p>把公司重大訊息、新聞、法人籌碼、大戶變化與除權息放到同一條時間軸。</p></div><span class="pill" id="timelineUpdated">—</span></div><div id="eventTimeline" class="timelineList"><div class="skeleton"></div></div><div class="legalNote" style="margin-top:10px">事件日期與資料口徑依各公開來源而異；新聞僅顯示標題與來源連結，籌碼為盤後公開資料。請以公司及交易所最終公告為準。</div></section>
   <section class="subPanel" id="sub-tools"><div class="sectionHead"><div><h3>學習與風險工具</h3><p>用歷史資料理解訊號有效性，並先估算風險再評估部位。</p></div><span class="pill">Learning</span></div><div class="toolGrid"><div class="toolCard"><h4>訊號可信度</h4><p>依此股票近年歷史資料，統計常見技術訊號觸發後的表現。</p><div id="signalTrust" class="trustList"></div></div><div class="toolCard"><h4>部位 / 停損試算</h4><p>依可承受最大損失反推建議股數；不代表實際交易建議。</p><div class="calcGrid"><label>資金<input id="calcCapital" type="number" value="1000000" inputmode="decimal"></label><label>單筆風險 %<input id="calcRisk" type="number" value="1" step="0.1" inputmode="decimal"></label><label>預計進場價<input id="calcEntry" type="number" step="0.01" inputmode="decimal"></label><label>停損價<input id="calcStop" type="number" step="0.01" inputmode="decimal"></label></div><div id="calcOut" class="calcOut"></div></div><div class="toolCard"><h4>相對強弱</h4><p>比較此標的與大盤近 20 / 60 日表現，協助理解是個股領先或只是跟漲。</p><div id="relativeStrength"><div class="skeleton"></div></div></div><div class="toolCard"><h4>除息 / 填息追蹤</h4><p>僅在可取得且能用歷史價格驗證的除息事件上計算，不補造缺失樣本。</p><div id="fillTracker"><div class="skeleton"></div></div></div></div><div class="legalNote" style="margin-top:10px">歷史勝率與回測僅描述過去資料，未計入交易成本、滑價與個別市場情境，不保證未來結果。</div></section>`)
 }
 const rs=$q('#screen-radar');if(rs&&!$q('#strategyPanel')){const list=$q('#radarList');list?.insertAdjacentHTML('beforebegin',`<article class="panelCard anomalyPanel" id="anomalyPanel"><div class="sectionHead"><div><h3>異常共振</h3><p>找出同時出現量增、突破、大戶變化或新聞事件的少見組合。</p></div><span class="pill" id="anomalyUpdated">—</span></div><div id="anomalyRibbon" class="anomalyRibbon"><div class="skeleton"></div></div></article><article class="panelCard strategyPanel" id="strategyPanel"><div class="sectionHead"><div><h3>自訂策略篩選</h3><p>用候選池組合條件快速縮小研究標的，可切換 AND / OR。</p></div><span class="pill">策略掃描</span></div><div class="strategyGrid"><label>邏輯<select id="strategyLogic"><option value="AND">全部符合 AND</option><option value="OR">任一符合 OR</option></select></label><label>最低分<input id="strategyScore" type="number" value="65" min="0" max="100"></label><label>最低量比<input id="strategyVolume" type="number" value="1.2" step="0.1"></label><label>RSI 下限<input id="strategyRsiMin" type="number" value="45"></label><label>RSI 上限<input id="strategyRsiMax" type="number" value="75"></label><label>範本<select id="strategyPreset"><option value="">自訂</option><option value="trend">趨勢突破</option><option value="holder">大戶增持</option><option value="event">事件共振</option></select></label></div><div class="strategyChecks"><label><input type="checkbox" id="stBreak"> 近20日突破</label><label><input type="checkbox" id="stHolder"> 大戶增加</label><label><input type="checkbox" id="stNews"> 近期新聞</label><label><input type="checkbox" id="stEvent"> 重大訊息</label></div><div class="strategyActions"><button class="refreshBtn" id="runStrategy">套用條件</button><button class="filterBtn" id="saveStrategy">儲存目前條件</button><span class="microStamp" id="strategyStamp">候選資料待載入</span></div><div id="strategyResult" class="strategyResult"></div></article>`)}
}
function bindSub(){const old=typeof switchSub==='function'?switchSub:null;if(!old||old.__clarinavi)return;const fn=async id=>{if(id==='timeline'||id==='tools'){$q('#deepPanel')?.classList.remove('hidden');$$q('.subTab').forEach(x=>x.classList.toggle('active',x.dataset.sub===id));$$q('.subPanel').forEach(x=>x.classList.toggle('active',x.id===`sub-${id}`));if(id==='timeline')await loadTimeline();else await loadTools();return}return old(id)};fn.__clarinavi=true;switchSub=fn;$$q('.subTab').forEach(b=>b.onclick=()=>switchSub(b.dataset.sub))}
async function j(url){const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function marketApi(){const d=getLast();return d?.snapshot?.market||'TWSE'}
async function loadTimeline(force=false){const code=getCode(),d=getLast();if(!code||!d)return;const key=`${marketApi()}:${code}`;if(!force&&state.timelineKey===key&&state.timeline){renderTimeline(state.timeline);return}const root=$q('#eventTimeline');if(root)root.innerHTML='<div class="skeleton"></div>';const m=marketApi(),isTW=getMarket()==='TW';try{const tasks=[j(`/api/news?symbol=${encodeURIComponent(code)}&name=${encodeURIComponent(d.snapshot?.name||'')}&market=${isTW?'TW':'US'}&days=90`)];if(isTW)tasks.push(j(`/api/research?code=${encodeURIComponent(code)}&market=${encodeURIComponent(m)}&section=events`),j(`/api/research?code=${encodeURIComponent(code)}&market=${encodeURIComponent(m)}&section=chips`),j('/api/dividends'));const a=await Promise.allSettled(tasks),items=[];const news=a[0].status==='fulfilled'?a[0].value?.items||[]:[];news.forEach(x=>items.push({date:String(x.date||'').slice(0,10),tag:'新聞',title:x.title,detail:x.source,url:x.url}));if(isTW){const ev=a[1]?.status==='fulfilled'?a[1].value?.data||[]:[];ev.forEach(x=>items.push({date:x.date,tag:'重大訊息',title:x.title,detail:x.content||''}));const chips=a[2]?.status==='fulfilled'?a[2].value?.data||{}:{};(chips.institutional||[]).forEach(x=>items.push({date:x.date,tag:'法人',title:`三大法人當日合計 ${Number(x.total)>=0?'+':''}${Math.round(Number(x.total)||0).toLocaleString()} 股`,detail:`外資 ${Math.round(Number(x.foreign)||0).toLocaleString()} · 投信 ${Math.round(Number(x.trust)||0).toLocaleString()}`}));(chips.tdccHistory||[]).forEach((x,i,arr)=>{if(!x.date)return;const prev=i?arr[i-1]:null,delta=prev&&Number.isFinite(num(x.big400))&&Number.isFinite(num(prev.big400))?num(x.big400)-num(prev.big400):null;items.push({date:x.date,tag:'大戶',title:`400張以上持股 ${Number.isFinite(num(x.big400))?num(x.big400).toFixed(2)+'%':'—'}`,detail:Number.isFinite(delta)?`較前期 ${delta>=0?'+':''}${delta.toFixed(2)}pp`:'TDCC 股權分散'})});const divs=a[3]?.status==='fulfilled'?a[3].value?.items||[]:[];divs.filter(x=>x.code===code).forEach(x=>items.push({date:x.date,tag:'除權息',title:`${x.type||'除權息'}${Number.isFinite(num(x.cashDividend))?` · 現金股利 ${f(x.cashDividend)} 元`:''}`,detail:'日期與金額以公司最終公告為準'}))}
 state.timelineKey=key;state.timeline=items.filter(x=>/^\d{4}-\d{2}-\d{2}/.test(x.date||'')).sort((x,y)=>y.date.localeCompare(x.date)).slice(0,50);renderTimeline(state.timeline)}catch(e){if(root)root.innerHTML=`<div class="empty">事件資料暫時無法取得：${esc(e.message)}</div>`}}
function renderTimeline(items){const root=$q('#eventTimeline');if(!root)return;$q('#timelineUpdated').textContent='更新 '+now();root.innerHTML=items.length?items.map(x=>`<div class="timelineItem"><div class="timelineDate">${esc(x.date)}</div><div class="timelineDot"></div><div class="timelineContent"><span class="timelineTag">${esc(x.tag)}</span>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(x.title)}</b></a>`:`<b>${esc(x.title)}</b>`}${x.detail?`<p>${esc(String(x.detail).slice(0,180))}</p>`:''}</div></div>`).join(''):'<div class="empty">目前沒有可整合的事件資料。</div>'}
function backtest(rows,fn,h=[5,10,20]){const ev=[];const mx=Math.max(...h);for(let i=1;i<rows.length-mx;i++)if(fn(i)){const e={};h.forEach(k=>e[k]=(rows[i+k].close/rows[i].close-1)*100);ev.push(e)}const out={count:ev.length};h.forEach(k=>{const a=ev.map(x=>x[k]).filter(Number.isFinite);out[k]={win:a.length?a.filter(x=>x>0).length/a.length*100:null,avg:mean(a)}});return out}
function renderTrust(rowsOverride=null){const d=getLast(),root=$q('#signalTrust');const source=rowsOverride||d?.history;if(!root||!source?.length)return;const rows=source.slice(-760),i=tech(rows),signals=[['MACD 黃金交叉',n=>i.macd.dif[n-1]<=i.macd.dea[n-1]&&i.macd.dif[n]>i.macd.dea[n]],['KD 黃金交叉',n=>i.kd.k[n-1]<=i.kd.d[n-1]&&i.kd.k[n]>i.kd.d[n]&&i.kd.k[n]<60],['站上 MA20',n=>rows[n-1].close<=i.ma20[n-1]&&rows[n].close>i.ma20[n]],['20日突破',n=>n>=20&&rows[n].close>Math.max(...rows.slice(n-20,n).map(x=>x.high))]];root.innerHTML=signals.map(([name,fn])=>{let b;try{b=backtest(rows,fn)}catch{b={count:0}}return `<div class="trustItem"><div><b>${esc(name)}</b><span>${b.count||0} 次</span></div><div class="trustBars">${[5,10,20].map(k=>`<em>${k}日：${Number.isFinite(b[k]?.win)?b[k].win.toFixed(0)+'%':'—'} · ${Number.isFinite(b[k]?.avg)?fp(b[k].avg):'—'}</em>`).join('')}</div></div>`}).join('')}
function calcPosition(){const cap=num($q('#calcCapital')?.value),risk=num($q('#calcRisk')?.value),entry=num($q('#calcEntry')?.value),stop=num($q('#calcStop')?.value),out=$q('#calcOut');if(!out)return;if(![cap,risk,entry,stop].every(x=>Number.isFinite(x)&&x>0)||stop>=entry){out.innerHTML='<div style="grid-column:1/-1"><span>請輸入有效數值，且停損價需低於進場價。</span></div>';return}const maxLoss=cap*risk/100,per=entry-stop,shares=Math.floor(maxLoss/per),position=shares*entry,pctStop=per/entry*100;out.innerHTML=`<div><span>最大風險</span><b>${Math.round(maxLoss).toLocaleString()} 元</b></div><div><span>每股風險</span><b>${f(per)} 元</b></div><div><span>試算股數</span><b>${shares.toLocaleString()} 股</b></div><div><span>部位約</span><b>${Math.round(position).toLocaleString()} 元</b></div><div><span>停損幅度</span><b>${pctStop.toFixed(2)}%</b></div><div><span>資金占比</span><b>${(position/cap*100).toFixed(1)}%</b></div>`}
async function loadRelative(){const root=$q('#relativeStrength'),d=getLast();if(!root||!d?.history?.length)return;if(getMarket()!=='TW'){root.innerHTML='<div class="empty">美股免費資料模式目前先顯示個股自身趨勢；市場基準比較暫以台股完整支援。</div>';return}try{const b=await j('/api/benchmark?months=6'),h=d.history.filter(x=>Number.isFinite(num(x.close))),br=b.rows||[];function ret(a,n){return a.length>n?pct(a.at(-1).close,a.at(-1-n).close):null}const s20=ret(h,20),s60=ret(h,60),b20=ret(br,20),b60=ret(br,60),r20=Number.isFinite(s20)&&Number.isFinite(b20)?s20-b20:null,r60=Number.isFinite(s60)&&Number.isFinite(b60)?s60-b60:null;root.innerHTML=`<div class="fillStats"><div><span>20日個股</span><b>${fp(s20)}</b></div><div><span>20日大盤</span><b>${fp(b20)}</b></div><div><span>20日超額</span><b class="${r20>0?'up':r20<0?'down':''}">${fp(r20)}</b></div><div><span>60日個股</span><b>${fp(s60)}</b></div><div><span>60日大盤</span><b>${fp(b60)}</b></div><div><span>60日超額</span><b class="${r60>0?'up':r60<0?'down':''}">${fp(r60)}</b></div></div><p class="status" style="padding:8px 0 0">${r20>0&&r60>0?'短中期皆領先大盤，屬相對強勢。':r20>0?'短期轉強，但中期仍需確認。':r60>0?'中期仍領先，短期動能回落。':'短中期相對大盤偏弱。'}</p>`}catch(e){root.innerHTML='<div class="empty">大盤比較資料暫時無法取得。</div>'}}
async function loadFill(rowsOverride=null){const root=$q('#fillTracker'),d=getLast(),code=getCode();if(!root||!d||!code)return;if(getMarket()!=='TW'){root.innerHTML='<div class="empty">目前先支援台股官方除權息事件。</div>';return}try{const x=await j('/api/dividends'),events=(x.items||[]).filter(e=>e.code===code&&e.date<=new Date().toISOString().slice(0,10)&&Number.isFinite(num(e.cashDividend))&&num(e.cashDividend)>0),hist=rowsOverride||d.history||[],samples=[];for(const e of events){const idx=hist.findIndex(r=>r.date>=e.date);if(idx<0)continue;const pre=hist[idx-1]?.close;if(!Number.isFinite(num(pre)))continue;const target=num(pre),after=hist.slice(idx,idx+61);let days=null;for(let k=0;k<after.length;k++)if(num(after[k].high)>=target){days=k;break}samples.push({date:e.date,days,filled:days!=null})}if(!samples.length){root.innerHTML='<div class="empty">目前官方可驗證的歷史除息樣本不足；不以推估資料補造填息機率。</div>';return}const filled=samples.filter(x=>x.filled),rate=filled.length/samples.length*100,avg=filled.length?mean(filled.map(x=>x.days)):null;root.innerHTML=`<div class="fillStats"><div><span>可驗證樣本</span><b>${samples.length} 次</b></div><div><span>60日內填息</span><b>${rate.toFixed(0)}%</b></div><div><span>平均天數</span><b>${Number.isFinite(avg)?avg.toFixed(1)+' 日':'—'}</b></div></div><div class="trustList" style="margin-top:7px">${samples.slice(-6).reverse().map(x=>`<div class="trustItem"><div><b>${esc(x.date)}</b><span>${x.filled?`${x.days} 日填息`:'60日內未填息'}</span></div></div>`).join('')}</div>`}catch{root.innerHTML='<div class="empty">填息資料暫時無法取得。</div>'}}
async function loadTools(){const d=getLast();if(!d)return;const key=`${marketApi()}:${getCode()}`;if(state.toolsKey!==key){state.toolsKey=key;const px=num(d.snapshot?.close);if(Number.isFinite(px)){$q('#calcEntry').value=px;$q('#calcStop').value=(px*.95).toFixed(2)}renderTrust();calcPosition();loadRelative();loadFill();if(getMarket()==='TW'){try{const long=await j(`/api/stock?code=${encodeURIComponent(getCode())}&months=36`),rows=long.history||[];if(rows.length){renderTrust(rows);loadFill(rows)}}catch{}}}['calcCapital','calcRisk','calcEntry','calcStop'].forEach(id=>{const el=$q('#'+id);if(el&&!el.dataset.v54bound){el.dataset.v54bound='1';el.addEventListener('input',calcPosition)}})}
async function loadRadarData(force=false){if(!force&&state.radar&&Date.now()-state.radarAt<180000)return state.radar;const d=await j('/api/radar');state.radar=d.items||[];state.radarAt=Date.now();renderAnomaly();applyStrategy();return state.radar}
function anomalyScore(x){const checks=[num(x.volumeRatio)>=1.5,!!x.breakout,!!x.holderTrend?.continuous||num(x.holderTrend?.weeklyDelta)>.15,(num(x.newsHeat?.count)||0)>=2||!!x.event,num(x.score)>=72];return{count:checks.filter(Boolean).length,checks}}
function renderAnomaly(){const root=$q('#anomalyRibbon');if(!root)return;const a=(state.radar||[]).map(x=>({...x,_a:anomalyScore(x)})).filter(x=>x._a.count>=3).sort((x,y)=>y._a.count-x._a.count||y.score-x.score);$q('#anomalyUpdated').textContent='更新 '+now();root.innerHTML=a.length?a.slice(0,6).map(x=>`<button class="anomalyItem" data-code="${esc(x.code)}"><b>${esc(x.name)} ${esc(x.code)}</b><div class="anomalyScore">${x._a.count}/5 共振</div><span>${esc((x.reasons||[]).slice(0,3).join(' · '))}</span></button>`).join(''):'<div class="empty">目前候選池未出現 3 項以上的明顯異常共振。</div>';root.querySelectorAll('.anomalyItem').forEach(b=>b.onclick=()=>{try{openSymbol('TW',b.dataset.code)}catch{}})}
function readStrategy(){return{logic:$q('#strategyLogic')?.value||'AND',score:num($q('#strategyScore')?.value)??0,vol:num($q('#strategyVolume')?.value)??0,rmin:num($q('#strategyRsiMin')?.value)??0,rmax:num($q('#strategyRsiMax')?.value)??100,br:$q('#stBreak')?.checked||false,holder:$q('#stHolder')?.checked||false,news:$q('#stNews')?.checked||false,event:$q('#stEvent')?.checked||false}}
function passStrategy(x,s){const cond=[num(x.score)>=s.score,num(x.volumeRatio)>=s.vol,num(x.rsi)>=s.rmin&&num(x.rsi)<=s.rmax];if(s.br)cond.push(!!x.breakout);if(s.holder)cond.push(!!x.holderTrend?.continuous||num(x.holderTrend?.weeklyDelta)>0);if(s.news)cond.push(num(x.newsHeat?.count)>0);if(s.event)cond.push(!!x.event);return s.logic==='OR'?cond.some(Boolean):cond.every(Boolean)}
function applyStrategy(){const root=$q('#strategyResult');if(!root)return;const s=readStrategy(),a=(state.radar||[]).filter(x=>passStrategy(x,s));$q('#strategyStamp').textContent=`${a.length} / ${(state.radar||[]).length} 檔符合`;root.innerHTML=a.length?a.map(x=>`<button class="strategyHit" data-code="${esc(x.code)}"><span><b>${esc(x.name)} ${esc(x.code)}</b><small>${esc((x.reasons||[]).slice(0,4).join(' · '))}</small></span><strong>${x.score}</strong></button>`).join(''):'<div class="empty">目前候選池沒有符合條件的標的，可放寬條件後再篩選。</div>';root.querySelectorAll('.strategyHit').forEach(b=>b.onclick=()=>{try{openSymbol('TW',b.dataset.code)}catch{}})}
function applyPreset(v){if(v==='trend'){$q('#strategyScore').value=70;$q('#strategyVolume').value=1.3;$q('#strategyRsiMin').value=50;$q('#strategyRsiMax').value=75;$q('#stBreak').checked=true;$q('#stHolder').checked=false;$q('#stNews').checked=false;$q('#stEvent').checked=false}else if(v==='holder'){$q('#strategyScore').value=60;$q('#strategyVolume').value=1;$q('#strategyRsiMin').value=40;$q('#strategyRsiMax').value=78;$q('#stBreak').checked=false;$q('#stHolder').checked=true;$q('#stNews').checked=false;$q('#stEvent').checked=false}else if(v==='event'){$q('#strategyScore').value=60;$q('#strategyVolume').value=1.2;$q('#strategyRsiMin').value=40;$q('#strategyRsiMax').value=80;$q('#stBreak').checked=false;$q('#stHolder').checked=false;$q('#stNews').checked=true;$q('#stEvent').checked=true}applyStrategy()}
function bindRadar(){['strategyLogic','strategyScore','strategyVolume','strategyRsiMin','strategyRsiMax','stBreak','stHolder','stNews','stEvent'].forEach(id=>$q('#'+id)?.addEventListener('change',applyStrategy));$q('#runStrategy')?.addEventListener('click',()=>loadRadarData(false));$q('#strategyPreset')?.addEventListener('change',e=>applyPreset(e.target.value));$q('#saveStrategy')?.addEventListener('click',()=>{localStorage.setItem('clarinavi-strategy-v54',JSON.stringify(readStrategy()));try{toast('策略條件已儲存在此瀏覽器')}catch{}});const saved=JSON.parse(localStorage.getItem('clarinavi-strategy-v54')||'null');if(saved){$q('#strategyLogic').value=saved.logic||'AND';$q('#strategyScore').value=saved.score??65;$q('#strategyVolume').value=saved.vol??1.2;$q('#strategyRsiMin').value=saved.rmin??45;$q('#strategyRsiMax').value=saved.rmax??75;$q('#stBreak').checked=!!saved.br;$q('#stHolder').checked=!!saved.holder;$q('#stNews').checked=!!saved.news;$q('#stEvent').checked=!!saved.event}
 $$q('[data-screen="radar"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>loadRadarData(false).catch(()=>{}),100)));$q('#refreshRadar')?.addEventListener('click',()=>setTimeout(()=>loadRadarData(true).catch(()=>{}),150))}
function cleanPublicCopy(){document.querySelectorAll('.legalNote').forEach(x=>x.classList.add('riskNotice'));const flow=$q('#flowNote');if(flow)flow.textContent='盤中資金流為公開行情快照的估算分類，無法辨識投資人身分，也不等同券商分點或真實主力委託。';const lab=$q('#sub-lab .pill');if(lab)lab.textContent='研究工具';document.querySelectorAll('.homeSource').forEach(x=>{if(/不構成投資建議|交易前/.test(x.textContent))x.classList.add('riskish')})}

function pivotLevels(rows){
 const px=num(rows?.at(-1)?.close);if(!Number.isFinite(px)||rows.length<12)return{support:null,resistance:null};
 const pts=[];for(let i=2;i<rows.length-2;i++){const r=rows[i],lo=num(r.low),hi=num(r.high);if(!Number.isFinite(lo)||!Number.isFinite(hi))continue;const lows=rows.slice(i-2,i+3).map(x=>num(x.low)).filter(Number.isFinite),highs=rows.slice(i-2,i+3).map(x=>num(x.high)).filter(Number.isFinite);if(lo===Math.min(...lows))pts.push({p:lo,k:'s',w:1+(num(r.volume)||0)});if(hi===Math.max(...highs))pts.push({p:hi,k:'r',w:1+(num(r.volume)||0)})}
 function clusters(kind){const a=pts.filter(x=>x.k===kind).sort((a,b)=>a.p-b.p),out=[];for(const x of a){let c=out.find(z=>Math.abs(z.p/x.p-1)<=.012);if(!c)out.push(c={p:x.p,n:0,w:0});c.p=(c.p*c.n+x.p)/(c.n+1);c.n++;c.w+=Math.log10(Math.max(10,x.w))}return out.sort((a,b)=>(b.n+b.w*.08)-(a.n+a.w*.08))}
 const sup=clusters('s').filter(x=>x.p<px*1.005).sort((a,b)=>Math.abs(px-b.p)-Math.abs(px-a.p))[0];
 const res=clusters('r').filter(x=>x.p>px*.995).sort((a,b)=>Math.abs(a.p-px)-Math.abs(b.p-px))[0];
 return{support:sup?.p??num(getLast()?.analysis?.support20),resistance:res?.p??num(getLast()?.analysis?.resistance20)}
}
function signalMarkers(rows){
 if(!rows?.length)return[];const t=tech(rows),out=[],start=Math.max(1,rows.length-100);for(let i=start;i<rows.length;i++){
  const date=rows[i].date;if(!date)continue;
  if([t.macd.dif[i-1],t.macd.dea[i-1],t.macd.dif[i],t.macd.dea[i]].every(Number.isFinite)){
   if(t.macd.dif[i-1]<=t.macd.dea[i-1]&&t.macd.dif[i]>t.macd.dea[i])out.push({time:date,position:'belowBar',color:'#8b5cf6',shape:'arrowUp',text:'MACD 金叉'});
   else if(t.macd.dif[i-1]>=t.macd.dea[i-1]&&t.macd.dif[i]<t.macd.dea[i])out.push({time:date,position:'aboveBar',color:'#e24758',shape:'arrowDown',text:'MACD 死叉'});
  }
  if([t.kd.k[i-1],t.kd.d[i-1],t.kd.k[i],t.kd.d[i]].every(Number.isFinite)){
   if(t.kd.k[i-1]<=t.kd.d[i-1]&&t.kd.k[i]>t.kd.d[i])out.push({time:date,position:'belowBar',color:'#0e9f80',shape:'circle',text:'KD 金叉'});
   else if(t.kd.k[i-1]>=t.kd.d[i-1]&&t.kd.k[i]<t.kd.d[i])out.push({time:date,position:'aboveBar',color:'#d97706',shape:'circle',text:'KD 死叉'});
  }
  if(Number.isFinite(t.rsi[i-1])&&Number.isFinite(t.rsi[i])){
   if(t.rsi[i-1]<50&&t.rsi[i]>=50)out.push({time:date,position:'belowBar',color:'#2563eb',shape:'square',text:'RSI↑50'});
   if(t.rsi[i-1]>70&&t.rsi[i]<=70)out.push({time:date,position:'aboveBar',color:'#64748b',shape:'square',text:'RSI離開過熱'});
  }
 }
 return out.slice(-28)
}
function decorateTechChart(){
 const d=getLast(),cs=window.__clarinaviCandleSeries;if(!d?.history?.length||!cs)return;const rows=d.history,lv=pivotLevels(rows);try{
  if(Number.isFinite(lv.support))cs.createPriceLine({price:lv.support,color:'#10a37f',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'支撐'});
  if(Number.isFinite(lv.resistance))cs.createPriceLine({price:lv.resistance,color:'#e24758',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'壓力'});
  const marks=signalMarkers(rows);if(window.LightweightCharts?.createSeriesMarkers)window.LightweightCharts.createSeriesMarkers(cs,marks);else if(typeof cs.setMarkers==='function')cs.setMarkers(marks)
 }catch{}
}
function advancedState(){
 const d=getLast();if(!d?.history?.length)return{};const rows=d.history.map(x=>({...x})),s=d.snapshot||{};if(rows.length&&Number.isFinite(num(s.close))){const r=rows[rows.length-1];r.close=num(s.close);if(Number.isFinite(num(s.high)))r.high=num(s.high);if(Number.isFinite(num(s.low)))r.low=num(s.low)}const t=tech(rows),i=rows.length-1,prev=i-1,mac=latestCross(t.macd.dif,t.macd.dea),kdc=latestCross(t.kd.k,t.kd.d),maBull=[t.ma5[i],t.ma10[i],t.ma20[i],t.ma60[i]].every(Number.isFinite)&&t.ma5[i]>t.ma10[i]&&t.ma10[i]>t.ma20[i]&&t.ma20[i]>t.ma60[i],prevBull=[t.ma5[prev],t.ma10[prev],t.ma20[prev],t.ma60[prev]].every(Number.isFinite)&&t.ma5[prev]>t.ma10[prev]&&t.ma10[prev]>t.ma20[prev]&&t.ma20[prev]>t.ma60[prev],rsi50=Number.isFinite(t.rsi[prev])&&Number.isFinite(t.rsi[i])&&t.rsi[prev]<50&&t.rsi[i]>=50;return{macdCross:mac==='up',kdCross:kdc==='up',maBull:maBull&&!prevBull,rsi50}
}
function checkAdvancedAlerts(){
 let code=getCode();if(!code)return;const key=`${getMarket()}:${code}`,all=JSON.parse(localStorage.getItem('pulse-alerts-v5')||'{}'),a=all[key];if(!a?.signal||!['macdCross','kdCross','maBull','rsi50'].includes(a.signal))return;const st=advancedState(),hit=!!st[a.signal],labels={macdCross:'MACD 出現黃金交叉',kdCross:'KD 出現黃金交叉',maBull:'均線轉為多頭排列',rsi50:'RSI 上穿 50'};if(hit&&!a.advancedLast){a.advancedLast=true;all[key]=a;localStorage.setItem('pulse-alerts-v5',JSON.stringify(all));const msg=`${getLast()?.snapshot?.name||code} ${labels[a.signal]}`;try{toast(msg)}catch{};if('Notification'in window&&Notification.permission==='granted')try{new Notification('ClariNavi 提醒',{body:msg})}catch{}}else if(!hit&&a.advancedLast){a.advancedLast=false;all[key]=a;localStorage.setItem('pulse-alerts-v5',JSON.stringify(all))}
}
function bindChartAndAlerts(){
 const oldTech=typeof renderTechChart==='function'?renderTechChart:null;if(oldTech&&!oldTech.__clarinaviDecorated){const w=function(){oldTech();setTimeout(()=>{decorateTechChart();renderSignalStrip()},0)};w.__clarinaviDecorated=true;renderTechChart=w}
 const oldLive=typeof applyLive==='function'?applyLive:null;if(oldLive&&!oldLive.__clarinaviAdvanced){const w=async function(...args){const r=await oldLive(...args);checkAdvancedAlerts();return r};w.__clarinaviAdvanced=true;applyLive=w}
}

function onRendered(){injectAvatar();renderSignalStrip();decorateTechChart();checkAdvancedAlerts();state.timelineKey='';state.timeline=null;state.toolsKey=''}
function boot(){injectAvatar();injectPanels();bindSub();bindRadar();bindChartAndAlerts();cleanPublicCopy();const old=typeof renderMain==='function'?renderMain:null;if(old&&!old.__clarinavi54){const w=function(d){old(d);setTimeout(onRendered,0);setTimeout(onRendered,400)};w.__clarinavi54=true;renderMain=w}window.addEventListener('clarinavi:tech-render',()=>{renderSignalStrip();decorateTechChart()});window.addEventListener('clarinavi:market-home',()=>injectAvatar());setTimeout(()=>loadRadarData(false).catch(()=>{}),1000)}
boot();window.ClariNavi={...(window.ClariNavi||{}),loadTimeline,loadTools,loadRadarData,renderSignalStrip,decorateTechChart,pivotLevels};
})();
(()=>{
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],KEY='clarinavi-kol-follow-v57',CUSTOM='clarinavi-kol-custom-v57';
 const defaults=['trump-truth','musk-x','jensen-official','banini-fb'];let presets=[],catalog=[],items=[],filter='all';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function getFollow(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(x)&&x.length?x:defaults}catch{return defaults}}
 function setFollow(a){localStorage.setItem(KEY,JSON.stringify(a))}
 function getCustom(){try{const x=JSON.parse(localStorage.getItem(CUSTOM)||'[]');return Array.isArray(x)?x.slice(0,8):[]}catch{return[]}}
 function setCustom(a){localStorage.setItem(CUSTOM,JSON.stringify(a.slice(0,8)))}
 function when(s){if(!s)return'近期';const d=new Date(s);if(!isFinite(d))return'近期';const diff=Date.now()-d.getTime(),h=Math.floor(diff/36e5);return h<1?'剛剛':h<24?`${h} 小時前`:d.toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'})}
 function initials(n){return String(n||'?').replace(/\s+/g,'').slice(0,2)}
 function sourceState(src){return src.state==='live'?['自動更新','live']:src.state==='auth'?['需 API 授權','auth']:src.state==='error'?['來源暫失效','auth']:['原始入口','']}
 function customId(x){return`custom-${x.platform}-${String(x.handle).toLowerCase()}`}
 function normalizeCustom(x){let p=String(x.platform||'x').toLowerCase(),h=String(x.handle||'').trim().replace(/^@/,'');if(p==='x'&&!/^[A-Za-z0-9_]{1,15}$/.test(h))return null;if((p==='truth'||p==='facebook')&&!/^[A-Za-z0-9_.-]{1,80}$/.test(h))return null;return{platform:p,handle:h,id:customId({platform:p,handle:h})}}
 function customQuery(){const c=getCustom(),by=p=>c.filter(x=>x.platform===p).map(x=>x.handle).join(',');return`&xHandles=${encodeURIComponent(by('x'))}&truthHandles=${encodeURIComponent(by('truth'))}&fbHandles=${encodeURIComponent(by('facebook'))}`}
 function renderSources(){const rail=$('#kolSourceRail');if(!rail)return;rail.innerHTML=`<button class="kolSourceChip ${filter==='all'?'active':''}" data-kol-filter="all">全部</button>`+presets.map(s=>`<button class="kolSourceChip ${filter===s.id?'active':''}" data-kol-filter="${esc(s.id)}">${esc(s.name)}</button>`).join('');$$('[data-kol-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.kolFilter;renderSources();renderFeed()})}
 function renderFeed(){const root=$('#kolFeed');if(!root)return;const follow=new Set(getFollow()),customIds=new Set(getCustom().map(customId)),visibleSources=presets.filter(s=>follow.has(s.id)||customIds.has(s.id)||s.custom),filtered=items.filter(x=>(follow.has(x.sourceId)||customIds.has(x.sourceId)||x.sourceId.startsWith('custom-'))&&(filter==='all'||x.sourceId===filter));let html='';for(const x of filtered){const src=presets.find(s=>s.id===x.sourceId)||{},st=sourceState(src);html+=`<a class="kolPost" href="${esc(x.url||src.url)}" target="_blank" rel="noopener noreferrer"><div class="kolAvatar">${esc(initials(x.source))}</div><div><h3>${esc(x.source)}</h3><div class="kolMeta">${esc(x.role||'')} · ${esc(x.platform||'')} · ${esc(when(x.date))}</div><p>${esc(x.text||'前往原始來源查看最新公開內容')}</p></div><span class="kolState ${st[1]}">${st[0]}</span></a>`}
 for(const src of visibleSources.filter(s=>!filtered.some(x=>x.sourceId===s.id)&&(filter==='all'||filter===s.id))){const st=sourceState(src);html+=`<a class="kolPost" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><div class="kolAvatar">${esc(initials(src.name))}</div><div><h3>${esc(src.name)}</h3><div class="kolMeta">${esc(src.role||'')} · ${esc(src.platform||'')}</div><p>${esc(src.note||'目前此來源提供原始帳號入口。')}</p></div><span class="kolState ${st[1]}">${st[0]}</span></a>`}
 root.innerHTML=html||'<div class="kolEmpty">尚未選擇追蹤來源。</div>'}
 function ensureCustomUI(){const sheet=$('#kolSheet');if(!sheet||$('#kolCustomBox'))return;const actions=sheet.querySelector('.sheetActions');const box=document.createElement('div');box.id='kolCustomBox';box.className='kolCustomBox';box.innerHTML=`<div class="kolCustomTitle"><b>新增其他追蹤來源</b><span>支援 X / Truth Social / Facebook 帳號</span></div><div class="kolCustomForm"><select id="kolCustomPlatform"><option value="x">X</option><option value="truth">Truth Social</option><option value="facebook">Facebook</option></select><input id="kolCustomHandle" placeholder="輸入帳號，例如 satyanadella"><button id="kolCustomAdd" type="button">加入</button></div><div id="kolCustomList"></div><p class="kolCustomNote">X 與 Facebook 自動抓取仍需站方使用官方 API 授權；未授權時會保留可直接前往原始帳號的入口。自訂帳號只儲存在這個瀏覽器。</p>`;sheet.insertBefore(box,actions);$('#kolCustomAdd').onclick=addCustom;renderCustom()}
 function renderCustom(){const root=$('#kolCustomList');if(!root)return;const c=getCustom();root.innerHTML=c.length?c.map((x,i)=>`<div class="kolCustomRow"><span>${esc(x.platform.toUpperCase())}</span><b>@${esc(x.handle)}</b><button data-kol-rm="${i}" type="button">移除</button></div>`).join(''):'<div class="kolCustomEmpty">尚未新增其他帳號。</div>';$$('[data-kol-rm]').forEach(b=>b.onclick=()=>{const a=getCustom();a.splice(+b.dataset.kolRm,1);setCustom(a);renderCustom();load(true)})}
 function addCustom(){const x=normalizeCustom({platform:$('#kolCustomPlatform').value,handle:$('#kolCustomHandle').value});if(!x){window.toast?.('帳號格式不正確');return}const a=getCustom();if(!a.some(y=>customId(y)===x.id))a.push({platform:x.platform,handle:x.handle});setCustom(a);$('#kolCustomHandle').value='';renderCustom();load(true)}
 function renderManage(){ensureCustomUI();const root=$('#kolManageList');if(!root)return;const follow=new Set(getFollow());const list=catalog.length?catalog:presets.filter(x=>!x.custom);root.innerHTML=list.map(s=>`<label class="kolManageRow"><input type="checkbox" value="${esc(s.id)}" ${follow.has(s.id)?'checked':''}><div><b>${esc(s.name)}</b><span>${esc(s.role||'')} · ${esc(s.platform||'')}</span></div><span class="kolBadge">${sourceState(s)[0]}</span></label>`).join('');renderCustom()}
 async function load(force=false){const root=$('#kolFeed');if(root)root.innerHTML='<div class="skeleton" style="height:150px"></div>';const ids=getFollow().join(',');try{const r=await fetch(`/api/kol?ids=${encodeURIComponent(ids)}${customQuery()}`,{cache:force?'no-store':'default'}),j=await r.json();presets=j.sources||[];catalog=j.catalog||catalog;items=j.items||[];$('#kolUpdated').textContent='更新 '+new Date(j.updatedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});renderSources();renderFeed()}catch(e){if(root)root.innerHTML=`<div class="kolEmpty">KOL 動態暫時無法更新：${esc(e.message)}</div>`}}
 window.loadKolFeed=load;window.ClariNaviKol={load,getCustom};
 document.addEventListener('click',e=>{if(e.target?.id==='kolRefresh')load(true);if(e.target?.id==='kolManage'){renderManage();window.openSheet?.('kolSheet')}if(e.target?.id==='kolSave'){const a=$$('#kolManageList input:checked').map(x=>x.value);setFollow(a.length?a:defaults);window.closeSheets?.();load(true)}});
})();

(()=>{
'use strict';
const V56={frame:'1m',lastKRefresh:0,hydrating:new Set(),sectorHistoryKey:'clarinavi-v56-sector-history'};
const nf=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const oldIntradayLabel=typeof intradayLabel==='function'?intradayLabel:null;
intradayLabel=function(){return intradayBucket===5?'5 秒':intradayBucket===60?'1 分鐘':intradayBucket===300?'5 分鐘':intradayBucket===900?'15 分鐘':intradayBucket===1800?'30 分鐘':intradayBucket===3600?'60 分鐘':oldIntradayLabel?oldIntradayLabel():'盤中'};

/* ---------- Dark chart palette ---------- */
const oldChartOptions=typeof chartOptions==='function'?chartOptions:null;
if(oldChartOptions){
  chartOptions=function(){
    const o=oldChartOptions(),dark=document.body.dataset.theme==='dark';
    if(!dark)return o;
    return {
      ...o,
      layout:{...o.layout,background:{type:'solid',color:'rgba(11,19,34,0)'},textColor:'#7f8da8',fontSize:10,panes:{...(o.layout?.panes||{}),separatorColor:'rgba(126,140,174,.13)',separatorHoverColor:'#776dff'}},
      grid:{vertLines:{color:'rgba(126,140,174,.075)'},horzLines:{color:'rgba(126,140,174,.075)'}},
      rightPriceScale:{...o.rightPriceScale,borderColor:'rgba(126,140,174,.14)'},
      timeScale:{...o.timeScale,borderColor:'rgba(126,140,174,.14)'},
      crosshair:{mode:0,vertLine:{color:'rgba(174,166,255,.42)',style:2,width:1},horzLine:{color:'rgba(174,166,255,.32)',style:2,width:1}}
    };
  };
}

/* ---------- Full-day 1m hydration ---------- */
function mergeIntradayRows(s,rows){
  if(!s||!Array.isArray(rows)||!rows.length)return 0;
  let old=readRawSession(s),m=new Map(old.map(x=>[x.time,x]));
  for(const r of rows){
    if(!nf(r.time)||!nf(r.close))continue;
    const prev=m.get(Number(r.time))||{};
    m.set(Number(r.time),{...prev,time:Number(r.time),value:Number(r.close),open:n(r.open),high:n(r.high),low:n(r.low),close:n(r.close),tradeVolume:n(r.volume),source:'full-day'});
  }
  const all=[...m.values()].filter(x=>nf(x.time)&&nf(x.value)).sort((a,b)=>a.time-b.time);
  writeRawSession(s,all);return all.length;
}
async function hydrateIntraday(s){
  if(!s||market!=='TW'||!s.code||V56.hydrating.has(s.code))return;
  V56.hydrating.add(s.code);
  try{
    const r=await fetch(`/api/intraday?code=${encodeURIComponent(s.code)}&market=${encodeURIComponent(s.market||'')}&_=${Math.floor(Date.now()/15000)}`,{cache:'no-store'});
    const j=await r.json();
    if(r.ok&&j.available&&Array.isArray(j.rows)&&j.rows.length){
      const count=mergeIntradayRows(s,j.rows);
      const note=$('#intradaySourceNote');if(note)note.textContent=`${j.source||'盤中資料'} · 已加入 ${j.rows.length} 根，5秒快照持續更新`;
      if(chartMode==='line')renderLineChart();else if(chartMode==='tech'&&isIntradayFrame(V56.frame))renderTechChart();
      window.dispatchEvent(new CustomEvent('clarinavi:v56-intraday',{detail:{count,source:j.source}}));
    }else{const note=$('#intradaySourceNote');if(note)note.textContent=j.note||'TWSE MIS 公開快照會從頁面開啟後持續累積；不使用非官方分鐘線補齊。'}
  }catch(e){
    const note=$('#intradaySourceNote');if(note)note.textContent='完整分時回補暫不可用；改以 TWSE MIS 5 秒快照在瀏覽器持續累積。';
  }finally{V56.hydrating.delete(s.code)}
}

/* ---------- Intraday candles ---------- */
const FRAME_SECONDS={"1m":60,"5m":300,"15m":900,"30m":1800,"60m":3600};
function isIntradayFrame(f){return !!FRAME_SECONDS[f]}
function frameLabel(f){return ({'1m':'1分K','5m':'5分K','15m':'15分K','30m':'30分K','60m':'60分K','D':'日K','W':'週K','M':'月K'})[f]||f}
function rawToCandles(s,bucket){
  const raw=getSession(s).slice().sort((a,b)=>a.time-b.time),groups=new Map();
  for(let i=0;i<raw.length;i++){
    const x=raw[i],t=Math.floor(x.time/bucket)*bucket,px=n(x.value);if(px==null)continue;
    let dv=0;
    if(nf(x.tradeVolume))dv=Math.max(0,Number(x.tradeVolume));
    else if(i>0&&nf(x.volume)&&nf(raw[i-1].volume))dv=Math.max(0,Number(x.volume)-Number(raw[i-1].volume));
    let g=groups.get(t);
    const ro=n(x.open),rh=n(x.high),rl=n(x.low),rc=n(x.close)??px;
    if(!g){g={time:t,open:ro??px,high:rh??px,low:rl??px,close:rc,volume:dv};groups.set(t,g)}
    else{g.high=Math.max(g.high,rh??px);g.low=Math.min(g.low,rl??px);g.close=rc;g.volume+=dv}
  }
  return [...groups.values()].sort((a,b)=>a.time-b.time);
}
function aggregateHistory(rows,frame){
  if(frame==='D')return rows.slice();const m=new Map();
  for(const r of rows){const d=new Date(`${r.date}T00:00:00`);let key;
    if(frame==='M')key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    else{const x=new Date(d),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);key=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
    let g=m.get(key);if(!g)m.set(key,g={date:key,open:r.open,high:r.high,low:r.low,close:r.close,volume:Number(r.volume)||0});else{g.high=Math.max(g.high,r.high);g.low=Math.min(g.low,r.low);g.close=r.close;g.volume+=Number(r.volume)||0}
  }
  return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function sma(a,p){let out=Array(a.length).fill(null),sum=0,c=0;for(let i=0;i<a.length;i++){if(nf(a[i])){sum+=Number(a[i]);c++}if(i>=p&&nf(a[i-p])){sum-=Number(a[i-p]);c--}if(i>=p-1&&c===p)out[i]=sum/p}return out}
function ema(a,p){let out=Array(a.length).fill(null),k=2/(p+1),v=null;for(let i=0;i<a.length;i++){if(!nf(a[i]))continue;v=v==null?Number(a[i]):Number(a[i])*k+v*(1-k);out[i]=v}return out}
function rsi(a,p=14){let out=Array(a.length).fill(null);if(a.length<=p)return out;let g=0,l=0;for(let i=1;i<=p;i++){const d=a[i]-a[i-1];d>=0?g+=d:l-=d}let ag=g/p,al=l/p;out[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<a.length;i++){const d=a[i]-a[i-1],gg=Math.max(d,0),ll=Math.max(-d,0);ag=(ag*(p-1)+gg)/p;al=(al*(p-1)+ll)/p;out[i]=al===0?100:100-100/(1+ag/al)}return out}
function macd(a){const a12=ema(a,12),a26=ema(a,26),dif=a.map((_,i)=>nf(a12[i])&&nf(a26[i])?a12[i]-a26[i]:null),dea=ema(dif.map(x=>x??0),9).map((x,i)=>dif[i]==null?null:x),hist=dif.map((x,i)=>nf(x)&&nf(dea[i])?(x-dea[i])*2:null);return{dif,dea,hist}}
function kd(rows,p=9){let K=Array(rows.length).fill(null),D=Array(rows.length).fill(null),k=50,d=50;for(let i=p-1;i<rows.length;i++){const w=rows.slice(i-p+1,i+1),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low)),rv=hi===lo?50:(rows[i].close-lo)/(hi-lo)*100;k=k*2/3+rv/3;d=d*2/3+k/3;K[i]=k;D[i]=d}return{k:K,d:D}}
function calcInd(rows){const c=rows.map(x=>x.close),m=macd(c);return{ma5:sma(c,5),ma10:sma(c,10),ma20:sma(c,20),ma60:sma(c,60),rsi:rsi(c),macd:m,kd:kd(rows)}}
function lineSeries(c,rows,a,color,width=1,pane=0,opts={}){const data=rows.map((r,i)=>nf(a[i])?{time:r.time??r.date,value:Number(a[i])}:null).filter(Boolean);if(!data.length)return null;const s=c.addSeries(LightweightCharts.LineSeries,{color,lineWidth:width,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,...opts},pane);s.setData(data);return s}
function applyPaneHeights(c,intraday=false){try{const p=c.panes();p[0]?.setHeight(intraday?300:310);p[1]?.setHeight(82);p[2]?.setHeight(92);p[3]?.setHeight(82);p[4]?.setHeight(82)}catch{}}
function updateTechMetrics(ind,rows){const i=rows.length-1;if(i<0)return;const vals=[['MA5',ind.ma5[i]],['MA10',ind.ma10[i]],['MA20',ind.ma20[i]],['MA60',ind.ma60[i]],['RSI',ind.rsi[i]],['MACD',ind.macd.hist[i]],['KD K',ind.kd.k[i]],['KD D',ind.kd.d[i]]];$('#indicatorStrip').innerHTML=vals.map(([l,v])=>`<span class="indicator">${l}<b>${nf(v)?fmt(Number(v),l.includes('RSI')||l.includes('KD')?1:2):'—'}</b></span>`).join('')}

function signalMarkers56(rows,ind){
  const out=[],start=Math.max(1,rows.length-120),t=r=>r.time??r.date;
  for(let i=start;i<rows.length;i++){
    const time=t(rows[i]); if(time==null)continue;
    if([ind.macd.dif[i-1],ind.macd.dea[i-1],ind.macd.dif[i],ind.macd.dea[i]].every(nf)){
      if(ind.macd.dif[i-1]<=ind.macd.dea[i-1]&&ind.macd.dif[i]>ind.macd.dea[i])out.push({time,position:'belowBar',color:'#b8a7ff',shape:'arrowUp',text:'MACD 黃金交叉'});
      else if(ind.macd.dif[i-1]>=ind.macd.dea[i-1]&&ind.macd.dif[i]<ind.macd.dea[i])out.push({time,position:'aboveBar',color:'#ff7f91',shape:'arrowDown',text:'MACD 死亡交叉'});
    }
    if([ind.kd.k[i-1],ind.kd.d[i-1],ind.kd.k[i],ind.kd.d[i]].every(nf)){
      if(ind.kd.k[i-1]<=ind.kd.d[i-1]&&ind.kd.k[i]>ind.kd.d[i])out.push({time,position:'belowBar',color:'#49ddb7',shape:'circle',text:'KD 黃金交叉'});
      else if(ind.kd.k[i-1]>=ind.kd.d[i-1]&&ind.kd.k[i]<ind.kd.d[i])out.push({time,position:'aboveBar',color:'#f1bd61',shape:'circle',text:'KD 死亡交叉'});
    }
    if(nf(ind.rsi[i-1])&&nf(ind.rsi[i])){
      if(ind.rsi[i-1]<50&&ind.rsi[i]>=50)out.push({time,position:'belowBar',color:'#65b2ff',shape:'square',text:'RSI 上穿 50'});
      else if(ind.rsi[i-1]>70&&ind.rsi[i]<=70)out.push({time,position:'aboveBar',color:'#9ba8c4',shape:'square',text:'RSI 離開過熱'});
    }
  }
  return out.slice(-24);
}
function makeKChart(rows,intraday){
  destroyChart();if(!window.LightweightCharts||!rows.length)return;
  $('#mainChart').className='mainChart tech';chart=LightweightCharts.createChart($('#mainChart'),chartOptions());
  const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#ff6277',downColor:'#2bd6ae',wickUpColor:'#ff6277',wickDownColor:'#2bd6ae',borderVisible:false},0);
  cs.setData(rows.map(r=>({time:r.time??r.date,open:r.open,high:r.high,low:r.low,close:r.close})));
  const ind=calcInd(rows);lineSeries(chart,rows,ind.ma5,'#f3c46d',2);lineSeries(chart,rows,ind.ma10,'#e38bc9',1.4);lineSeries(chart,rows,ind.ma20,'#5da9ff',1.8);lineSeries(chart,rows,ind.ma60,'#a69cff',1.8);
  try{const marks=signalMarkers56(rows,ind);if(marks.length&&window.LightweightCharts?.createSeriesMarkers)window.LightweightCharts.createSeriesMarkers(cs,marks);else if(marks.length&&typeof cs.setMarkers==='function')cs.setMarkers(marks)}catch{}
  const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);vol.setData(rows.map((r,i)=>({time:r.time??r.date,value:Number(r.volume)||0,color:i&&r.close<rows[i-1].close?'rgba(43,214,174,.45)':'rgba(255,98,119,.45)'})));
  const mh=chart.addSeries(LightweightCharts.HistogramSeries,{priceLineVisible:false,lastValueVisible:false},2);mh.setData(rows.map((r,i)=>nf(ind.macd.hist[i])?{time:r.time??r.date,value:ind.macd.hist[i],color:ind.macd.hist[i]>=0?'rgba(255,98,119,.48)':'rgba(43,214,174,.48)'}:null).filter(Boolean));lineSeries(chart,rows,ind.macd.dif,'#f3c46d',1,2);lineSeries(chart,rows,ind.macd.dea,'#5da9ff',1,2);
  lineSeries(chart,rows,ind.rsi,'#9c8cff',1.7,3);lineSeries(chart,rows,rows.map(()=>70),'rgba(145,157,184,.55)',1,3,{lineStyle:2});lineSeries(chart,rows,rows.map(()=>30),'rgba(145,157,184,.55)',1,3,{lineStyle:2});
  lineSeries(chart,rows,ind.kd.k,'#f3c46d',1.2,4);lineSeries(chart,rows,ind.kd.d,'#5da9ff',1.2,4);lineSeries(chart,rows,rows.map(()=>80),'rgba(145,157,184,.45)',1,4,{lineStyle:2});lineSeries(chart,rows,rows.map(()=>20),'rgba(145,157,184,.45)',1,4,{lineStyle:2});
  if(!intraday&&V56.frame==='D'&&lastData?.analysis){try{const a=lastData.analysis;if(nf(a.support20))cs.createPriceLine({price:Number(a.support20),color:'#2bd6ae',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'支撐'});if(nf(a.resistance20))cs.createPriceLine({price:Number(a.resistance20),color:'#ff6277',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'壓力'})}catch{}}
  applyPaneHeights(chart,intraday);chart.timeScale().fitContent();chart.subscribeCrosshairMove(p=>{if(!p?.time){$('#crossInfo').textContent='滑動查看 OHLC';return}const x=p.seriesData.get(cs);if(x){const label=typeof p.time==='number'?new Date(p.time*1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):p.time;$('#crossInfo').textContent=`${label} O ${fmt(x.open)} H ${fmt(x.high)} L ${fmt(x.low)} C ${fmt(x.close)}`}});watchChart();updateTechMetrics(ind,rows);
  setTimeout(()=>window.dispatchEvent(new CustomEvent('clarinavi:v56-tech-render',{detail:{frame:V56.frame,intraday,rows:rows.length}})),0);
}
function renderIntradayK(){
  if(!lastData||market!=='TW')return renderHistoricalK('D');
  $('#intradayBar').classList.add('hidden');$('#kFrameBar').classList.add('hidden');$('#drawTools').classList.remove('hidden');$('#rangeBar').classList.add('hidden');$('#v56KBar').classList.add('show');$('#chartLoading').classList.add('hidden');
  const rows=rawToCandles(lastData.snapshot,FRAME_SECONDS[V56.frame]);
  makeKChart(rows,true);$('#chartHint').textContent=`當日 ${frameLabel(V56.frame)} · MA5/10/20/60 · 成交量 · MACD · RSI · KD`;$('#chartLiveBadge').className='chartLiveBadge live v56DataBadge';$('#chartLiveBadge').textContent='盤中 K · 5秒續更';$('#sampleCount').textContent=`${rows.length} 根 K`;
  const notice=$('#chartNotice');notice.classList.toggle('hidden',rows.length>=8);if(rows.length<8)notice.textContent='盤中 K 線樣本仍少。本站只使用實際取得的 TWSE MIS 公開快照，從頁面開啟後依 1／5／15／30／60 分鐘聚合；不以非官方來源補造開盤至現在的分鐘線。';
}
function historySlice(){const all=lastData?.history||[];if(!all.length)return[];const bars=Math.max(25,Math.ceil(chartRangeMonths*23));return all.slice(-bars)}
function renderHistoricalK(frame){
  $('#intradayBar').classList.add('hidden');$('#kFrameBar').classList.add('hidden');$('#drawTools').classList.remove('hidden');$('#rangeBar').classList.remove('hidden');$('#v56KBar').classList.add('show');$('#chartLoading').classList.add('hidden');$('#chartNotice').classList.add('hidden');
  const raw=historySlice(),rows=aggregateHistory(raw,frame);makeKChart(rows,false);$('#chartHint').textContent=`${frameLabel(frame)} · ${chartRangeMonths}M 視窗 · MA / Volume / MACD / RSI / KD`;$('#chartLiveBadge').className='chartLiveBadge';$('#chartLiveBadge').textContent='歷史 K · 拖曳 / 縮放';$('#sampleCount').textContent=`${rows.length} 根 K`;
}
const legacyRenderLine=renderLineChart;
renderLineChart=function(){
  $('#v56KBar')?.classList.remove('show');$('#kFrameBar')?.classList.add('hidden');$('#drawTools')?.classList.remove('hidden');
  legacyRenderLine();
  if(market==='TW'){$('#chartHint').textContent=`當日走勢 · ${intradayLabel()} · 均價＋成交量`;$('#chartLiveBadge').className='chartLiveBadge live v56DataBadge';}
};
renderTechChart=function(){isIntradayFrame(V56.frame)?renderIntradayK():renderHistoricalK(V56.frame)};

/* ---------- Homepage orientation + momentum ---------- */
function briefHtml(){return `<section class="v56Brief" id="v56Brief"><article class="v56BriefLead"><div class="v56BriefAvatar"></div><div><span class="v56Eyebrow">CLARINAVI MARKET GUIDE</span><b>今天市場，先看三件事</b><p id="v56BriefText">先確認大盤方向、強弱板塊，再進一步查看個股訊號。</p></div></article><article class="v56BriefCard"><span>市場方向</span><b id="v56Dir">—</b><small id="v56DirSub">等待市場資料</small></article><article class="v56BriefCard"><span>最強板塊</span><b id="v56TopSector">—</b><small id="v56TopSectorSub">等待類股資料</small></article><article class="v56BriefCard"><span>權重焦點</span><b id="v56Weight">—</b><small id="v56WeightSub">等待貢獻估算</small></article></section>`}
function momentumHtml(){return `<section class="homePanel v56Momentum" id="v56Momentum"><div class="homeHead compact"><div><h2>板塊動能象限</h2><p>用類股相對強弱與歷次觀測速度，快速看板塊正在加速或降溫</p></div><span class="pill">Momentum Beta</span></div><div class="v56MomentumGrid"><div class="v56QuadrantWrap" id="v56Quadrant"><span class="v56QLabel v56Q1">強勢加速</span><span class="v56QLabel v56Q2">強勢降溫</span><span class="v56QLabel v56Q3">弱勢修復</span><span class="v56QLabel v56Q4">弱勢加速</span><span class="v56AxisX">今日類股相對強弱 →</span><span class="v56AxisY">動能速度 →</span></div><div class="v56MomentumSide" id="v56MomentumSide"></div></div><div class="v56MomentumNote">第一版以 TWSE 類股指數公開漲跌與本站每日觀測紀錄計算「動能代理」，不是法人資金淨流向；累積多個交易日後，速度軸會更有參考性。</div></section>`}
function getSectorHistory(){try{return JSON.parse(localStorage.getItem(V56.sectorHistoryKey)||'[]')}catch{return[]}}
function storeSectorHistory(sectors){const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),rows=(sectors||[]).map(x=>({name:x.name,pct:Number(x.changePct)||0}));let h=getSectorHistory().filter(x=>x.day!==day);h.push({day,rows});h=h.slice(-20);try{localStorage.setItem(V56.sectorHistoryKey,JSON.stringify(h))}catch{}return h}
function priorPct(history,name){for(let i=history.length-2;i>=0;i--){const x=history[i].rows?.find(r=>r.name===name);if(x&&nf(x.pct))return Number(x.pct)}return null}
function renderMomentum(j){const sectors=(j?.sectors||[]).filter(x=>nf(x.changePct)).slice(0,30);if(!sectors.length)return;const hist=storeSectorHistory(sectors),q=$('#v56Quadrant'),side=$('#v56MomentumSide');if(!q||!side)return;q.querySelectorAll('.v56Dot').forEach(x=>x.remove());const max=Math.max(1,...sectors.map(x=>Math.abs(Number(x.changePct))));const points=sectors.map(x=>{const p=Number(x.changePct),prev=priorPct(hist,x.name),speed=prev==null?0:p-prev;return{...x,p,speed}});const maxS=Math.max(1,...points.map(x=>Math.abs(x.speed)));for(const x of points){const left=50+clamp(x.p/max,-1,1)*40,top=50-clamp(x.speed/maxS,-1,1)*38,size=26+Math.min(18,Math.abs(x.p)*3),d=document.createElement('button');d.className=`v56Dot ${x.p>=0?'pos':'neg'}`;d.style.left=`${left}%`;d.style.top=`${top}%`;d.style.width=d.style.height=`${size}px`;d.title=`${x.name} 今日 ${x.p>0?'+':''}${x.p.toFixed(2)}% · 速度 ${x.speed>0?'+':''}${x.speed.toFixed(2)}`;d.textContent=x.name.replace(/類指數|類|業/g,'').slice(0,4);d.dataset.sector=x.name;d.onclick=()=>window.ClariNaviV58?.openSectorDetail?.(x.name);q.appendChild(d)}const rank=points.sort((a,b)=>b.p-a.p).slice(0,5);side.innerHTML=rank.map((x,i)=>`<button class="v56Rank" data-sector="${E(x.name)}"><i>${i+1}</i><b>${E(x.name)}</b><span class="${x.p>=0?'up':'down'}">${x.p>0?'+':''}${x.p.toFixed(2)}%</span></button>`).join('');side.querySelectorAll('[data-sector]').forEach(b=>b.onclick=()=>window.ClariNaviV58?.openSectorDetail?.(b.dataset.sector))}
function updateBrief(home){const pairs=home?.global?.pairs||[],tw=pairs.find(x=>x.spot?.symbol==='TAIEX')?.spot||pairs[0]?.spot,secs=home?.sectors?.sectors||[],top=secs.filter(x=>nf(x.changePct)).sort((a,b)=>b.changePct-a.changePct)[0],cont=[...(home?.contrib?.positive||[]),...(home?.contrib?.negative||[])].sort((a,b)=>Math.abs(b.points||0)-Math.abs(a.points||0))[0];if($('#v56Dir')){$('#v56Dir').textContent=nf(tw?.changePct)?`${tw.changePct>=0?'偏多':'偏空'} ${Math.abs(tw.changePct).toFixed(2)}%`:'盤勢整理';$('#v56Dir').className=nf(tw?.changePct)?(tw.changePct>=0?'up':'down'):'';$('#v56DirSub').textContent=tw?.name||'台灣加權'}if($('#v56TopSector')){$('#v56TopSector').textContent=top?.name||'—';$('#v56TopSectorSub').textContent=nf(top?.changePct)?`${top.changePct>0?'+':''}${Number(top.changePct).toFixed(2)}%`:'等待資料'}if($('#v56Weight')){$('#v56Weight').textContent=cont?`${cont.name}`:'—';$('#v56WeightSub').textContent=cont&&nf(cont.points)?`${cont.points>0?'+':''}${Number(cont.points).toFixed(1)} 點估算`:'等待資料'}const bits=[];if(nf(tw?.changePct))bits.push(`大盤${tw.changePct>=0?'偏強':'偏弱'}`);if(top)bits.push(`${top.name}相對領先`);if(cont)bits.push(`${cont.name}是權重焦點`);if($('#v56BriefText'))$('#v56BriefText').textContent=bits.length?`${bits.join('；')}。再用個股分時與多週期 K 線確認節奏。`:'先確認大盤方向、強弱板塊，再進一步查看個股訊號。';if(home?.sectors)renderMomentum(home.sectors)}
function injectHomeModules(){document.querySelector('#v56Brief')?.remove();document.querySelector('#v56Momentum')?.remove();}

/* ---------- K period UI ---------- */
function injectKBar(){const card=$('.chartCard.modernChart');if(!card||$('#v56KBar'))return;const row=document.createElement('div');row.id='v56KBar';row.className='v56KBar';row.innerHTML=`<button class="active" data-v56-frame="1m">1分</button><button data-v56-frame="5m">5分</button><button data-v56-frame="15m">15分</button><button data-v56-frame="30m">30分</button><button data-v56-frame="60m">60分</button><i class="v56KGroupSep"></i><button data-v56-frame="D">日</button><button data-v56-frame="W">週</button><button data-v56-frame="M">月</button>`;const period=card.querySelector('.chartPeriodRow');period.insertAdjacentElement('afterend',row);row.querySelectorAll('button').forEach(b=>b.onclick=()=>{V56.frame=b.dataset.v56Frame;row.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));chartMode='tech';$('#techMode').classList.add('active');$('#lineMode').classList.remove('active');renderTechChart()})}
function bindChartButtons(){injectKBar();const ib=$('#intradayBar');if(ib&&!ib.querySelector('[data-bucket="1800"]')){const b=document.createElement('button');b.dataset.bucket='1800';b.textContent='30分';const last=ib.querySelector('[data-bucket="3600"]');ib.insertBefore(b,last);b.onclick=()=>{intradayBucket=1800;$$('#intradayBar button').forEach(x=>x.classList.toggle('active',x===b));if(chartMode==='line')renderLineChart()}}
  $('#lineMode').onclick=()=>{chartMode='line';$('#lineMode').classList.add('active');$('#techMode').classList.remove('active');$('#v56KBar')?.classList.remove('show');renderLineChart()};
  $('#techMode').onclick=()=>{chartMode='tech';if(market!=='TW'&&isIntradayFrame(V56.frame)){V56.frame='D';const bar=$('#v56KBar');bar?.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.v56Frame==='D'))}$('#techMode').classList.add('active');$('#lineMode').classList.remove('active');$('#v56KBar')?.classList.add('show');renderTechChart()};
  $$('#intradayBar button').forEach(b=>b.onclick=()=>{intradayBucket=+b.dataset.bucket||60;$$('#intradayBar button').forEach(x=>x.classList.toggle('active',x===b));if(chartMode==='line')renderLineChart()});
}

/* ---------- lifecycle hooks ---------- */
const beforeRenderMain=renderMain;renderMain=function(d){beforeRenderMain(d);setTimeout(()=>hydrateIntraday(d.snapshot),60)};
const beforeApplyLive=applyLive;applyLive=async function(code){await beforeApplyLive(code);if(chartMode==='tech'&&isIntradayFrame(V56.frame)&&Date.now()-V56.lastKRefresh>12000){V56.lastKRefresh=Date.now();renderTechChart()}};
window.addEventListener('clarinavi:market-home',e=>updateBrief(e.detail));
function defaultTheme(){if(!localStorage.getItem('clarinavi-v56-theme-migrated')){localStorage.setItem('pulse-theme-v5','dark');localStorage.setItem('clarinavi-v56-theme-migrated','1')}document.body.dataset.theme=localStorage.getItem('pulse-theme-v5')||'dark'}
function boot(){defaultTheme();injectHomeModules();bindChartButtons();const oldText=$('#techMode');if(oldText)oldText.textContent='K線';const line=$('#lineMode');if(line)line.textContent='當日走勢';const note=$('#intradaySourceNote');if(note)note.textContent='TWSE MIS 公開快照即時累積；不以非官方來源補造完整分鐘線';}
setTimeout(boot,40);
window.ClariNaviV56={hydrateIntraday,renderMomentum,setFrame:f=>{V56.frame=f;renderTechChart()},state:V56};
})();

(()=>{
'use strict';
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toLocaleString('zh-TW',{maximumFractionDigits:d}):'—';
let ipoCache=null, alertCache=null, alertFilter='all';
function addNavButton(nav,id,label,svg){if(!nav||nav.querySelector(`[data-screen="${id}"]`))return;const b=document.createElement('button');b.className=nav.classList.contains('desktopNav')?'navBtn':'';b.dataset.screen=id;b.innerHTML=`${svg||''}${label}`;const before=nav.querySelector('[data-screen="kol"]');before?nav.insertBefore(b,before):nav.appendChild(b);b.onclick=()=>showScreen(id)}
function installScreens(){
 const kol=q('#screen-kol');if(!kol)return;
 if(!q('#screen-ipo'))kol.insertAdjacentHTML('beforebegin',`<section class="screen" id="screen-ipo"><div class="pageTitle"><div><h1>股票申購</h1><p>整理 TWSE 公開申購公告、申購期間、承銷價、抽籤日與中籤率；不自行推估未公告價格。</p></div><div class="pageActions"><span class="microStamp" id="ipoUpdated">—</span><button class="refreshBtn" id="ipoRefresh">更新</button></div></div><div class="v57Toolbar" style="margin-bottom:10px"><select id="ipoStatus"><option value="active">近期 / 進行中</option><option value="all">全部</option><option value="申購中">申購中</option><option value="即將開始">即將開始</option><option value="等待抽籤">等待抽籤</option></select><input id="ipoSearch" placeholder="搜尋代號 / 名稱"></div><div id="ipoList" class="v57List"><div class="skeleton" style="height:150px"></div></div><div class="legalNote" style="margin-top:10px">公開申購時程與實際承銷價可能變動，請以 TWSE、主辦承銷商與券商最新公告為準。本區只整理公開資料，不代替申購資格或資金檢核。</div></section>`);
 if(!q('#screen-alerts'))kol.insertAdjacentHTML('beforebegin',`<section class="screen" id="screen-alerts"><div class="pageTitle"><div><h1>市場警示</h1><p>整合交易所「公布注意股票」與「處置股票」。注意是風險提醒，不代表一定會進入處置。</p></div><div class="pageActions"><span class="microStamp" id="alertsUpdated">—</span><button class="refreshBtn" id="alertsRefresh">更新</button></div></div><div class="v57Toolbar" style="margin-bottom:10px"><select id="alertsType"><option value="all">全部</option><option value="notice">注意股票</option><option value="disposition">處置股票</option></select><input id="alertsSearch" placeholder="搜尋代號 / 名稱 / 原因"></div><div id="alertsList" class="v57List"><div class="skeleton" style="height:150px"></div></div><div class="legalNote" style="margin-top:10px">「公布注意」係交易所依市場監視標準提醒投資人注意交易風險；「處置」才會附處置期間與交易措施。請以交易所最新公告為準。</div></section>`);
 if(!q('#riskDetailSheet'))document.body.insertAdjacentHTML('beforeend',`<div class="sheet" id="riskDetailSheet"><div class="sheetHead"><div><h2 id="riskDetailTitle">市場警示原因</h2><p id="riskDetailMeta">交易所公開資訊</p></div><button class="iconBtn sheetClose" id="riskDetailClose">×</button></div><div id="riskDetailBody" class="riskDetail">—</div><a id="riskDetailLink" class="officialLink" href="#" target="_blank" rel="noopener noreferrer">前往官方公告 ↗</a></div>`);
 const qm=q('.quoteMeta');if(qm&&!q('#marketRiskBadge'))qm.insertAdjacentHTML('afterend','<div id="marketRiskBadge" class="marketRiskBadge hidden"></div>');
 q('#ipoRefresh')?.addEventListener('click',()=>loadIPO(true));q('#ipoStatus')?.addEventListener('change',renderIPO);q('#ipoSearch')?.addEventListener('input',renderIPO);q('#alertsRefresh')?.addEventListener('click',()=>loadAlerts(true));q('#alertsType')?.addEventListener('change',renderAlerts);q('#alertsSearch')?.addEventListener('input',renderAlerts);q('#riskDetailClose')?.addEventListener('click',closeSheets);
}
const oldShow=typeof showScreen==='function'?showScreen:null;if(oldShow){showScreen=function(id){oldShow(id);if(id==='ipo')loadIPO(false);if(id==='alerts')loadAlerts(false)}}
function statusClass(s){return s==='申購中'?'statusApply':s==='即將開始'?'statusSoon':s==='等待抽籤'?'statusWait':''}
async function loadIPO(force=false){const root=q('#ipoList');if(!root)return;if(ipoCache&&!force){renderIPO();return}root.innerHTML='<div class="skeleton" style="height:150px"></div>';try{const j=await fetch('/api/ipo',{cache:'no-store'}).then(r=>r.json());ipoCache=j;q('#ipoUpdated').textContent='更新 '+new Date(j.updatedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});renderIPO()}catch(e){root.innerHTML=`<div class="empty">公開申購資料暫時無法使用：${esc(e.message)}</div>`}}
function renderIPO(){if(!ipoCache)return;const root=q('#ipoList'),st=q('#ipoStatus')?.value||'active',term=(q('#ipoSearch')?.value||'').trim().toLowerCase(),now=Date.now();let a=(ipoCache.items||[]).filter(x=>!x.cancelled);if(st==='active')a=a.filter(x=>['申購中','即將開始','等待抽籤'].includes(x.status)||(!x.drawDate||new Date(x.drawDate).getTime()>now-14*864e5));else if(st!=='all')a=a.filter(x=>x.status===st);if(term)a=a.filter(x=>`${x.code} ${x.name} ${x.market} ${x.broker}`.toLowerCase().includes(term));root.innerHTML=a.length?a.slice(0,120).map(x=>`<article class="ipoCard"><div><h3>${esc(x.name)} <span class="muted">${esc(x.code)}</span></h3><p>${esc(x.market||'')} · 主辦 ${esc(x.broker||'—')}</p><div class="ipoMeta"><span class="${statusClass(x.status)}">${esc(x.status)}</span><span>申購 ${esc(x.applyStart||'—')} ～ ${esc(x.applyEnd||'—')}</span><span>抽籤 ${esc(x.drawDate||'—')}</span><span>撥券 ${esc(x.allocationDate||'—')}</span>${Number.isFinite(x.winRate)?`<span>中籤率 ${nf(x.winRate,2)}%</span>`:''}</div></div><div class="ipoPrice"><small>申購 / 承銷價</small><b>${Number.isFinite(x.price)?nf(x.price,2):esc(x.priceText||'未訂出')}</b><small>${Number.isFinite(x.applyShares)?`每件 ${nf(x.applyShares)} 股`:''}</small></div></article>`).join(''):`<div class="empty">目前沒有符合篩選條件的股票申購案件。</div>`}
async function loadAlerts(force=false){const root=q('#alertsList');if(!root)return;if(alertCache&&!force){renderAlerts();return}root.innerHTML='<div class="skeleton" style="height:150px"></div>';try{const j=await fetch('/api/market-alerts',{cache:'no-store'}).then(r=>r.json());alertCache=j;q('#alertsUpdated').textContent='更新 '+new Date(j.updatedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});renderAlerts()}catch(e){root.innerHTML=`<div class="empty">市場警示資料暫時無法使用：${esc(e.message)}</div>`}}
function alertTitle(x){return x.type==='disposition'?'處置股票':'注意股票'}
function renderAlerts(){if(!alertCache)return;const root=q('#alertsList'),type=q('#alertsType')?.value||'all',term=(q('#alertsSearch')?.value||'').trim().toLowerCase();let a=alertCache.items||[];if(type!=='all')a=a.filter(x=>x.type===type);if(term)a=a.filter(x=>`${x.code} ${x.name} ${x.reason} ${x.period}`.toLowerCase().includes(term));root.innerHTML=a.length?a.slice(0,160).map((x,i)=>`<article class="marketAlertCard"><div><h3>${esc(x.name||'—')} <span class="muted">${esc(x.code||'')}</span></h3><p>${esc(x.market)} · ${esc(x.date||'—')}${x.period?` · ${esc(x.period)}`:''}</p><div class="ipoMeta"><span class="alertTag ${x.type==='disposition'?'disposition':''}">${alertTitle(x)}</span><span>${esc((x.reason||x.measure||'詳見官方公告').slice(0,90))}</span></div></div><button class="reasonBtn" data-alert-i="${i}">查看原因</button></article>`).join(''):'<div class="empty">目前沒有符合條件的公告。</div>';qa('[data-alert-i]').forEach(b=>b.onclick=()=>openRiskDetail(a[+b.dataset.alertI]))}
function openRiskDetail(x){if(!x)return;q('#riskDetailTitle').textContent=`${x.name||''} ${x.code||''} · ${alertTitle(x)}`;q('#riskDetailMeta').textContent=[x.market,x.date,x.period].filter(Boolean).join(' · ');q('#riskDetailBody').textContent=[x.reason&&`原因：${x.reason}`,x.measure&&`措施：${x.measure}`,x.detail].filter(Boolean).join('\n\n');q('#riskDetailLink').href=x.sourceUrl||'#';openSheet('riskDetailSheet')}
async function loadStockRisk(code){const box=q('#marketRiskBadge');if(!box||market!=='TW'||!code){box?.classList.add('hidden');return}try{const j=await fetch(`/api/market-alerts?code=${encodeURIComponent(code)}`,{cache:'no-store'}).then(r=>r.json()),a=j.items||[];if(!a.length){box.classList.add('hidden');return}const x=a.find(v=>v.type==='disposition')||a[0];box.className=`marketRiskBadge ${x.type==='disposition'?'disposition':''}`;box.innerHTML=`<div><b>${x.type==='disposition'?'目前有處置公告':'近期有注意交易公告'}</b><br><span>${esc((x.reason||x.period||'點擊查看官方原因').slice(0,88))}</span></div><button type="button">查看原因</button>`;box.querySelector('button').onclick=()=>openRiskDetail(x)}catch{box.classList.add('hidden')}}
/* Replace inferred money-flow with directly observed order-book snapshots. */
function depthRows(s){return readRawSession(s).filter(x=>Number.isFinite(x.bidDepth)||Number.isFinite(x.askDepth)).slice(-180)}
function sparkSvg(rows){if(rows.length<2)return'<div class="empty" style="height:100%;display:grid;place-items:center">保持頁面開啟後，會累積五檔委託量快照。</div>';const W=800,H=170,P=14,vals=rows.flatMap(x=>[x.bidDepth,x.askDepth]).filter(Number.isFinite),lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(1,hi-lo),X=i=>P+(W-P*2)*(i/(rows.length-1)),Y=v=>H-P-(H-P*2)*(v-lo)/span,path=k=>rows.map((r,i)=>`${i?'L':'M'} ${X(i).toFixed(1)} ${Y(Number(r[k])||0).toFixed(1)}`).join(' '),grid=[.25,.5,.75].map(z=>`<line class="grid" x1="0" x2="${W}" y1="${H*z}" y2="${H*z}"/>`).join('');return`<svg class="depthSpark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<path class="bid" d="${path('bidDepth')}"/><path class="ask" d="${path('askDepth')}"/></svg>`}
refreshFlow=function(){const card=q('#flowCard');if(!card)return;if(market!=='TW'||!lastData){card.classList.add('hidden');destroyFlow();return}card.classList.remove('hidden');const s=lastData.snapshot,bid=(s.bidVolumes||[]).reduce((a,x)=>a+(Number(x)||0),0),ask=(s.askVolumes||[]).reduce((a,x)=>a+(Number(x)||0),0),imb=bid+ask?(bid-ask)/(bid+ask)*100:null,bp=Number(s.bidPrices?.[0]),ap=Number(s.askPrices?.[0]),spread=Number.isFinite(bp)&&Number.isFinite(ap)?ap-bp:null,rows=depthRows(s);const head=card.querySelector('.flowHead');if(head)head.innerHTML=`<div><h3>盤中委託簿壓力</h3><p>直接呈現 TWSE MIS 買賣五檔委託量快照，不再用成交量級猜測「大單／散戶資金流」。</p></div><span class="flowBadge">公開五檔快照 · 非成交資金流</span>`;q('#flowStats').innerHTML=[mini('五檔委買量',Number.isFinite(bid)?nf(bid):'—'),mini('五檔委賣量',Number.isFinite(ask)?nf(ask):'—'),mini('委託失衡',Number.isFinite(imb)?`${imb>0?'+':''}${nf(imb,0)}%`:'—'),mini('買一',Number.isFinite(bp)?nf(bp,2):'—'),mini('買賣價差',Number.isFinite(spread)?nf(spread,2):'—')].join('');q('#flowChart').innerHTML=sparkSvg(rows);const legend=card.querySelector('.flowLegend');if(legend)legend.innerHTML='<span><b style="color:#55a7ff">藍線</b>：五檔委買總量</span><span><b style="color:#ff7186">粉線</b>：五檔委賣總量</span><span>快照數：'+rows.length+'</span>';q('#flowNote').textContent='委託簿是「尚未成交」的掛單快照，可能撤單或改價；它可用來觀察買賣盤深度與失衡，但不能辨識法人、主力或散戶身分，也不能當作實際資金淨流入。'}
/* TDCC: compare changes (percentage points), not two unrelated absolute shares on one scale. */
renderHolderChart=function(hist){const wrap=q('#holderChartWrap');try{holderRO?.disconnect()}catch{};holderRO=null;try{holderChart?.remove()}catch{};holderChart=null;const h=(hist||[]).filter(x=>x.date&&Number.isFinite(x.big400)&&Number.isFinite(x.retail10));if(!window.LightweightCharts||h.length<2){wrap.classList.add('hidden');return}wrap.classList.remove('hidden');const baseB=h[0].big400,baseR=h[0].retail10,head=wrap.querySelector('.holderChartHead');if(head)head.innerHTML='<b>集保持股結構變化</b><span>TDCC 每週分級；以首期為 0，比較百分點變化</span>';let leg=wrap.querySelector('.holderDeltaLegend');if(!leg){leg=document.createElement('div');leg.className='holderDeltaLegend';wrap.insertBefore(leg,q('#holderChart'))}leg.innerHTML='<span class="b"><i></i>400張以上變化</span><span class="r"><i></i>10張以下變化</span><span>兩者不是互補比例</span>';holderChart=LightweightCharts.createChart(q('#holderChart'),{...chartOptions(),height:220,width:q('#holderChart').clientWidth,timeScale:{borderVisible:false,timeVisible:false},rightPriceScale:{borderVisible:false}});const zero=holderChart.addSeries(LightweightCharts.LineSeries,{color:'rgba(140,148,173,.35)',lineWidth:1,priceLineVisible:false,lastValueVisible:false});zero.setData(h.map(x=>({time:x.date,value:0})));const big=holderChart.addSeries(LightweightCharts.LineSeries,{color:'#8a7cff',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'400張以上 Δpp'}),retail=holderChart.addSeries(LightweightCharts.LineSeries,{color:'#55a7ff',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'10張以下 Δpp'});big.setData(h.map(x=>({time:x.date,value:+(x.big400-baseB).toFixed(3)})));retail.setData(h.map(x=>({time:x.date,value:+(x.retail10-baseR).toFixed(3)})));holderChart.timeScale().fitContent();holderRO=new ResizeObserver(()=>holderChart?.applyOptions({width:q('#holderChart').clientWidth}));holderRO.observe(q('#holderChart'))}
function upgradeLabels(){const sec=q('#sub-chips .sectionHead p');if(sec)sec.textContent='法人累計、融資券、TDCC 集保持股結構、10% 大股東與盤中五檔委託簿壓力；不把代理值包裝成主力資金流。';const d=q('.disclaimerHero');if(d)d.textContent='研究提醒：資料與模型僅供教學／研究，不構成投資建議；交易前請以交易所、公司公告與合法券商資訊為準。';const av=q('#stockBroadcast .broadcastAvatar'),play=q('#stockSpeakBtn');if(av&&play){av.style.cursor='pointer';av.title='點擊讓 Lumi 播放個股解讀';av.onclick=()=>play.click();const card=q('#stockBroadcast');new MutationObserver(()=>{play.textContent=card.classList.contains('speechPaused')?'▶ 繼續':card.classList.contains('speaking')?'Ⅱ 暫停':'▶ 聽解讀'}).observe(card,{attributes:true,attributeFilter:['class']})}}
const oldRender=typeof renderMain==='function'?renderMain:null;if(oldRender){renderMain=function(d){oldRender(d);setTimeout(()=>{refreshFlow();loadStockRisk(d?.snapshot?.code)},60)}}
installScreens();upgradeLabels();
window.ClariNaviV57={loadIPO,loadAlerts,loadStockRisk,openRiskDetail};
})();

(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=2)=>{const x=n(v);return x==null?'—':x.toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:d})};
const pct=v=>{const x=n(v);return x==null?'—':`${x>0?'+':''}${x.toFixed(2)}%`};
const PORT_KEY='aevoryn-portfolio-v52';
const PULSE_KEY='clarinavi-v58-port-pulse';
const V58={editingId:'',candidate:null,started:false};

function readJson(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'')??fallback}catch{return fallback}}
function saveJson(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function portRows(){const a=readJson(PORT_KEY,[]);return Array.isArray(a)?a:[]}
function savePortRows(a){saveJson(PORT_KEY,(a||[]).slice(0,80))}
function quoteCache(x){return readJson(`aevoryn-port-quote-${x.market}-${x.code}`,{})||{}}
function money(v,cur){const x=n(v);if(x==null)return'—';return new Intl.NumberFormat('zh-TW',{style:'currency',currency:cur,maximumFractionDigits:cur==='TWD'?0:2}).format(x)}

/* ---------- Intraday accuracy: keep only the current TW trading session ---------- */
function taipeiParts(sec){try{const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(Number(sec)*1000));const o={};for(const p of parts)o[p.type]=p.value;return{date:`${o.year}-${o.month}-${o.day}`,hm:`${o.hour}:${o.minute}`,hms:`${o.hour}:${o.minute}:${o.second}`}}catch{return null}}
function installSessionSanitizer(){
 if(typeof readRawSession!=='function'||readRawSession.__v58)return;
 const old=readRawSession;const wrap=function(snapshot){const a=old(snapshot),date=String(snapshot?.date||'');if(!Array.isArray(a)||!date)return Array.isArray(a)?a:[];const now=Math.floor(Date.now()/1000);return a.filter(x=>{if(!Number.isFinite(Number(x?.time)))return false;const z=taipeiParts(x.time);if(!z||z.date!==date||z.hm<'09:00'||z.hm>'13:30')return false;const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());if(date===today&&Number(x.time)>now+90)return false;return true}).sort((x,y)=>x.time-y.time)};wrap.__v58=true;readRawSession=wrap;
}

/* ---------- Chart controls: separate interval / range / K aggregation ---------- */
function chartControlMarkup(){return `<div class="v58ChartControls" id="v58ChartControls">
  <div class="v58ControlGroup" id="v58IntervalGroup"><div class="v58ControlLabel"><b>分時更新間隔</b><span>當日線圖取樣</span></div><div class="v58ControlSlot" data-slot="interval"></div></div>
  <div class="v58ControlGroup" id="v58KGroup"><div class="v58ControlLabel"><b>K 棒週期</b><span>每根 K 棒代表多久</span></div><div class="v58ControlSlot" data-slot="k"></div></div>
  <div class="v58ControlGroup" id="v58RangeGroup"><div class="v58ControlLabel"><b>歷史查詢區間</b><span>畫面載入多長資料</span></div><div class="v58ControlSlot" data-slot="range"></div></div>
</div>`}
function currentFrame(){return window.ClariNaviV56?.state?.frame || q('#v56KBar button.active')?.dataset?.v56Frame || '1m'}
function chartIsLine(){return q('#lineMode')?.classList.contains('active')}
function syncChartGroups(){
 const line=chartIsLine(), frame=currentFrame(), intraday=['1m','5m','15m','30m','60m'].includes(frame);
 q('#v58IntervalGroup')?.classList.toggle('hidden',!line);
 q('#v58KGroup')?.classList.toggle('hidden',line);
 q('#v58RangeGroup')?.classList.toggle('hidden',line||intraday);
 q('#v58SignalLegend')?.classList.toggle('hidden',line);
}
function installChartGroups(){
 const card=q('.chartCard.modernChart')||q('.chartCard'); if(!card)return;
 if(!q('#v58ChartControls')){
   const period=q('.chartPeriodRow',card)||q('.chartToolbar',card);
   period?.insertAdjacentHTML('afterend',chartControlMarkup());
 }
 const slots={interval:q('[data-slot="interval"]'),k:q('[data-slot="k"]'),range:q('[data-slot="range"]')};
 const ib=q('#intradayBar'), kb=q('#v56KBar'), rb=q('#rangeBar');
 if(ib&&slots.interval&&!slots.interval.contains(ib)){ib.classList.remove('hidden');slots.interval.appendChild(ib)}
 if(kb&&slots.k&&!slots.k.contains(kb)){kb.classList.add('show');slots.k.appendChild(kb)}
 if(rb&&slots.range&&!slots.range.contains(rb)){rb.classList.remove('hidden');slots.range.appendChild(rb)}
 q('#kFrameBar')?.classList.add('hidden');
 if(!q('#v58SignalLegend')){
   const stage=q('.chartStage',card)||q('#mainChart')?.parentElement;
   stage?.insertAdjacentHTML('afterend',`<div class="v58SignalLegend" id="v58SignalLegend"><span class="gold">● KD 黃金交叉</span><span class="death">● KD 死亡交叉</span><span class="macdGold">◆ MACD 黃金交叉</span><span class="macdDeath">◆ MACD 死亡交叉</span><small>訊號標記直接顯示在 K 線；僅供教學研究。</small></div>`);
 }
 const tool=q('#drawTools'); if(tool){tool.classList.remove('hidden');let hint=q('.v58DrawHint',tool);if(!hint){hint=document.createElement('span');hint.className='v58DrawHint';hint.textContent='選擇工具後，在圖表上點選位置';tool.prepend(hint)}}
 card.addEventListener('click',()=>setTimeout(syncChartGroups,0));
 window.addEventListener('clarinavi:v56-tech-render',()=>{q('#drawTools')?.classList.remove('hidden');setTimeout(syncChartGroups,0)});
 setTimeout(syncChartGroups,60);
}

/* ---------- Portfolio: add/edit inside the portfolio page ---------- */
function portfolioComposerHtml(){return `<section class="v58PortComposer" id="v58PortComposer">
 <div class="v58PortHead"><div><span>投資組合</span><h2>直接在這裡加入持股</h2><p>搜尋股票 → 確認標的 → 填入成本與股數。資料只存在此瀏覽器，可隨時編輯或刪除。</p></div><div class="v58PortStep"><b>1</b>搜尋 <i></i><b>2</b>填資料 <i></i><b>3</b>即時追蹤</div></div>
 <div class="v58LookupRow"><select id="v58PortMarket" aria-label="市場"><option value="TW">台股 / ETF</option><option value="US">美股 / ETF</option></select><input id="v58PortCode" autocomplete="off" placeholder="輸入股票代號，例如 2330 / NVDA"><button id="v58PortLookup" class="primaryMini">搜尋股票</button></div>
 <div class="v58LookupMsg" id="v58PortMsg">先搜尋股票代號，確認名稱與最新可用價格後再加入。</div>
 <div class="v58PortCandidate hidden" id="v58PortCandidate"></div>
 <div class="v58PortFields hidden" id="v58PortFields"><label><span>持有股數</span><input id="v58PortQty" type="number" min="0" step="0.001" inputmode="decimal" placeholder="例如 1000"></label><label><span>平均成本價</span><input id="v58PortCost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="例如 920"></label><div class="v58PortPreview" id="v58PortPreview">填入股數與成本後顯示試算。</div></div>
 <div class="v58PortSaveRow hidden" id="v58PortSaveRow"><button id="v58PortSave" class="v58Primary">加入組合</button><button id="v58PortCancel" class="v58Ghost">取消</button></div>
 </section><section class="v58PortfolioPulse" id="v58PortfolioPulse"><div class="v58PulseHead"><div><b>組合損益追蹤</b><span>台股盤中依交易所公開快照近即時更新；美股免費模式依最近可用 EOD；不同幣別分開計算</span></div><span id="v58PulseTime">—</span></div><div class="v58PulseGrid" id="v58PulseGrid"><div class="v58PulseEmpty">加入持股後，這裡會顯示整體市值與未實現損益。</div></div></section>`}
function resetComposer(){
 V58.editingId='';V58.candidate=null;
 ['v58PortCode','v58PortQty','v58PortCost'].forEach(id=>{const x=q('#'+id);if(x)x.value=''});
 q('#v58PortCandidate')?.classList.add('hidden');q('#v58PortFields')?.classList.add('hidden');q('#v58PortSaveRow')?.classList.add('hidden');
 if(q('#v58PortSave'))q('#v58PortSave').textContent='加入組合';
 if(q('#v58PortMsg'))q('#v58PortMsg').textContent='先搜尋股票代號，確認名稱與最新可用價格後再加入。';
}
function showCandidate(x){
 V58.candidate=x; const box=q('#v58PortCandidate'); if(!box)return;
 box.classList.remove('hidden'); q('#v58PortFields')?.classList.remove('hidden'); q('#v58PortSaveRow')?.classList.remove('hidden');
 box.innerHTML=`<div><span>${E(x.market==='TW'?'台股 / ETF':'美股 / ETF')}</span><b>${E(x.name||x.code)} <small>${E(x.code)}</small></b></div><div class="v58CandidatePrice"><span>最新可用價</span><b>${x.price!=null?fmt(x.price):'—'}</b><small>${E(x.note||'')}</small></div>`;
 calcPortPreview();
}
async function lookupPortfolio(){
 const market=q('#v58PortMarket')?.value||'TW', raw=(q('#v58PortCode')?.value||'').trim().toUpperCase(), msg=q('#v58PortMsg');
 if(!raw){if(msg)msg.textContent='請先輸入股票代號。';return}
 const code=market==='TW'?raw.replace(/[^0-9A-Z]/g,''):raw.replace(/[^A-Z0-9.\-]/g,'');
 if(msg)msg.textContent='查詢中…';q('#v58PortLookup').disabled=true;
 try{
   if(market==='TW'){
     const j=await fetch(`/api/quote?code=${encodeURIComponent(code)}`,{cache:'no-store'}).then(r=>r.json());
     if(j?.error||j?.available===false)throw new Error(j?.error||'找不到這個台股代號');
     const s=j.snapshot||j; showCandidate({market,code:s.code||code,name:s.name||j.name||code,price:n(s.price),note:s.isRealtimePrice?'公開盤中快照':'最近可用行情'});
   }else{
     const key=localStorage.getItem('pulse-av-key')||'';
     if(key){const j=await fetch(`/api/us?symbol=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`,{cache:'no-store'}).then(r=>r.json());const s=j.snapshot||j;if(j?.error)throw new Error(j.error);showCandidate({market,code:s.code||code,name:s.name||code,price:n(s.price),note:'免費美股資料依資料源最近可用 EOD'})}
     else showCandidate({market,code,name:code,price:null,note:'尚未設定美股資料 Key，可先建立持股；價格於設定資料源後更新'});
   }
   if(msg)msg.textContent=V58.editingId?'已找到標的，可修改持股資料。':'確認標的後填入成本與股數。';
 }catch(e){V58.candidate=null;if(msg)msg.textContent='查詢失敗：'+(e?.message||'資料暫時無法使用');q('#v58PortCandidate')?.classList.add('hidden');q('#v58PortFields')?.classList.add('hidden');q('#v58PortSaveRow')?.classList.add('hidden')}
 finally{q('#v58PortLookup').disabled=false}
}
function calcPortPreview(){
 const box=q('#v58PortPreview');if(!box)return;const qty=n(q('#v58PortQty')?.value),cost=n(q('#v58PortCost')?.value),p=n(V58.candidate?.price),cur=V58.candidate?.market==='US'?'USD':'TWD';
 if(qty==null||cost==null||qty<=0||cost<0){box.textContent='填入股數與成本後顯示試算。';return}
 const invested=qty*cost;if(p==null){box.innerHTML=`投入成本 <b>${money(invested,cur)}</b> · 尚無最新價格`;return}
 const mv=qty*p,pl=mv-invested,ret=invested?pl/invested*100:null;box.innerHTML=`投入 <b>${money(invested,cur)}</b> · 目前市值 <b>${money(mv,cur)}</b> · <strong class="${pl>0?'up':pl<0?'down':''}">${money(pl,cur)} (${pct(ret)})</strong>`;
}
function saveComposer(){
 const x=V58.candidate,qty=n(q('#v58PortQty')?.value),cost=n(q('#v58PortCost')?.value);if(!x)return;if(qty==null||qty<=0||cost==null||cost<0){q('#v58PortMsg').textContent='請輸入有效的持有股數與平均成本。';return}
 const rows=portRows(), old=rows.find(r=>r.id===V58.editingId), item={id:old?.id||`p${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,market:x.market,code:x.code,name:x.name||x.code,qty,cost};
 const next=old?rows.map(r=>r.id===old.id?item:r):[item,...rows];savePortRows(next);resetComposer();window.ClariNavi?.refreshPortfolio?.(true);setTimeout(()=>{wirePortfolioRows();updatePortfolioPulse()},280);
}
function editPortfolio(id){
 const x=portRows().find(r=>r.id===id);if(!x)return;V58.editingId=id;const cq=quoteCache(x);q('#v58PortMarket').value=x.market;q('#v58PortCode').value=x.code;q('#v58PortQty').value=x.qty;q('#v58PortCost').value=x.cost;q('#v58PortSave').textContent='更新持股';showCandidate({market:x.market,code:x.code,name:cq.name||x.name||x.code,price:n(cq.price),note:cq.t?'目前快取行情':'目前尚無行情'});q('#v58PortMsg').textContent='正在編輯這筆持股，修改後按「更新持股」。';q('#v58PortComposer')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function deletePortfolio(id){if(!confirm('移除此持股紀錄？'))return;savePortRows(portRows().filter(x=>x.id!==id));window.ClariNavi?.refreshPortfolio?.(true);setTimeout(()=>{wirePortfolioRows();updatePortfolioPulse()},220)}
function wirePortfolioRows(){qa('#portfolioList .portfolioRow').forEach(r=>{const e=q('[data-edit]',r),d=q('[data-del]',r);if(e)e.onclick=()=>editPortfolio(r.dataset.id);if(d)d.onclick=()=>deletePortfolio(r.dataset.id)})}
function calcSummaryFor(market){let totalCost=0,quotedCost=0,mv=0,quoted=0,count=0;for(const x of portRows().filter(r=>r.market===market)){count++;const qty=n(x.qty)||0,c=n(x.cost)||0,p=n(quoteCache(x).price);totalCost+=qty*c;if(p!=null){mv+=qty*p;quotedCost+=qty*c;quoted++}}const pnl=quoted?mv-quotedCost:null,ret=quoted&&quotedCost?pnl/quotedCost*100:null;return{market,totalCost,quotedCost,mv,pnl,ret,quoted,count}}
function updatePortfolioPulse(){
 const root=q('#v58PulseGrid');if(!root)return;const all=portRows();if(!all.length){root.innerHTML='<div class="v58PulseEmpty">加入持股後，這裡會顯示整體市值與未實現損益。</div>';return}
 const groups=['TW','US'].map(calcSummaryFor).filter(x=>x.count),now=Date.now(),hist=readJson(PULSE_KEY,[]);let newHist=Array.isArray(hist)?hist:[];
 root.innerHTML=groups.map(g=>{const cur=g.market==='TW'?'TWD':'USD',prev=[...newHist].reverse().find(h=>h.market===g.market&&h.quoted===g.quoted&&n(h.mv)!=null),delta=prev&&g.quoted?g.mv-prev.mv:null,status=g.market==='TW'?'盤中公開快照':'最近可用 EOD';return `<article class="v58PulseCard"><div class="v58PulseMarket"><b>${g.market==='TW'?'台股組合':'美股組合'}</b><span>${g.quoted}/${g.count} 檔已有行情 · ${status}</span></div><div><span>目前市值</span><b>${g.quoted?money(g.mv,cur):'—'}</b></div><div><span>未實現損益</span><b class="${g.pnl>0?'up':g.pnl<0?'down':''}">${g.pnl!=null?money(g.pnl,cur):'—'}</b><small>${pct(g.ret)}${g.quoted<g.count?' · 僅計已取得行情持股':''}</small></div><div><span>本次更新變化</span><b class="${delta>0?'up':delta<0?'down':''}">${delta!=null?money(delta,cur):'等待相同覆蓋率的下一次更新'}</b></div></article>`}).join('');
 for(const g of groups)if(g.quoted)newHist.push({t:now,market:g.market,mv:g.mv,quoted:g.quoted});newHist=newHist.filter(h=>now-(h.t||0)<86400000).slice(-80);saveJson(PULSE_KEY,newHist);q('#v58PulseTime').textContent='更新 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function installPortfolioComposer(){
 const screen=q('#screen-portfolio');if(!screen)return;if(!q('#v58PortComposer')){const title=q('.pageTitle',screen);title?.insertAdjacentHTML('afterend',portfolioComposerHtml())}
 const add=q('#portfolioAdd');if(add&&!add.dataset.v58){const clone=add.cloneNode(true);clone.dataset.v58='1';clone.textContent='＋ 加入股票';add.replaceWith(clone);clone.onclick=()=>{q('#v58PortComposer')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>q('#v58PortCode')?.focus(),260)}}
 q('#portfolioSheet')?.classList.add('v58Deprecated');
 q('#v58PortLookup').onclick=lookupPortfolio;q('#v58PortCode').onkeydown=e=>{if(e.key==='Enter')lookupPortfolio()};q('#v58PortQty').oninput=calcPortPreview;q('#v58PortCost').oninput=calcPortPreview;q('#v58PortSave').onclick=saveComposer;q('#v58PortCancel').onclick=resetComposer;
 const list=q('#portfolioList');if(list)new MutationObserver(()=>{wirePortfolioRows();updatePortfolioPulse()}).observe(list,{childList:true,subtree:true});wirePortfolioRows();updatePortfolioPulse();
 if(q('#portfolioUpdated'))q('#portfolioUpdated').textContent='持股價格依各市場可用資料更新；資料即時性統一顯示於頁面上方「資料狀態」。';
}

/* ---------- Avatar: real speech + visible mouth motion overlay ---------- */
function renderHeroNumbers(home){const root=q('#v58HeroNumbers');if(!root)return;const pairs=home?.global?.pairs||[];const items=[];for(const p of pairs){for(const x of [p?.spot,p?.future]){if(!x||items.length>=4)continue;const price=n(x.price??x.value??x.close),chg=n(x.changePct);if(price==null)continue;items.push({name:x.name||x.symbol||'市場',price,chg})}}root.innerHTML=items.length?items.map(x=>`<span><small>${E(x.name)}</small><b>${fmt(x.price,2)}</b><em class="${x.chg>0?'up':x.chg<0?'down':''}">${pct(x.chg)}</em></span>`).join(''):'<span><small>最新市場數字</small><b>等待更新</b></span>'}
function installAvatarMouth(){
  qa('.broadcastAvatar').forEach(av=>{qa('.v58Mouth,.v61Mouth,.v65Aura,.v65Blink,.v65MouthDeck,.v65VoiceWave',av).forEach(x=>x.remove());});
}

/* ---------- ETF-only UI defensive guard ---------- */
function guardEtfVisibility(snapshot){
 const hint=String(snapshot?.assetHint||snapshot?.assetType||'').toUpperCase(),code=String(snapshot?.code||'');const isETF=(typeof market==='undefined'||market==='TW')&&(hint.includes('ETF')||/^00\d{2,4}$/.test(code)&&hint!=='STOCK');
 q('#etfValuePanel')?.classList.toggle('hidden',!isETF);q('#etfHoldBtn')?.classList.toggle('hidden',!isETF);
 if(!isETF){['etfNav','etfPremium','etfFairness'].forEach(id=>{const x=q('#'+id);if(x)x.textContent='—'})}
 return isETF;
}
function installEtfGuard(){if(typeof renderMain==='function'&&!renderMain.__v58){const old=renderMain;const wrap=function(d){old(d);setTimeout(()=>guardEtfVisibility(d?.snapshot),0)};wrap.__v58=true;renderMain=wrap}}

/* ---------- Sector drill-down from heatmap / momentum ---------- */
function sectorTerm(name){return String(name||'').replace(/類指數|類股指數|指數|類$/g,'').replace(/業$/g,'').trim()}
function openSectorDetail(name){const term=sectorTerm(name)||String(name||'');if(typeof showScreen==='function')showScreen('industry');try{if(typeof industryMarket!=='undefined'&&industryMarket!=='TW'&&typeof setIndustryMarket==='function')setIndustryMarket('TW')}catch{}setTimeout(()=>{const input=q('#industrySearch');if(input)input.value=term;try{if(typeof industryData!=='undefined'&&industryData&&typeof renderIndustry==='function')renderIndustry();else if(typeof loadIndustry==='function')loadIndustry(true)}catch{}q('#industrySearch')?.focus()},80)}

/* ---------- Centralized data status & responsive navigation ---------- */
function dataPolicyHtml(){return `<div class="v58DataPolicy" id="v58DataPolicy"><div><b>資料狀態</b><span id="v58DataPolicyText">台股盤中使用交易所公開市況；美股免費模式依最近可用 EOD。</span></div><button id="v58DataSettings">資料設定</button></div>`}
function currentScreenId(){return q('.screen.active')?.id?.replace('screen-','')||'market'}
function syncDataPolicy(){const bar=q('#v58DataPolicy');if(!bar)return;const screen=currentScreenId(),m=typeof market!=='undefined'?market:'TW';bar.classList.toggle('compact',screen==='market'&&m==='TW');let text;if(['watch','portfolio'].includes(screen))text='台股盤中採交易所公開市況／快照；美股免費模式依最近可用 EOD。不同幣別與更新頻率分開呈現。';else text=m==='US'?'美股免費模式依最近可用 EOD；若設定個人資料 Key，仍以該資料源授權與更新頻率為準。':'台股盤中行情採交易所公開市況／快照；不是券商逐筆成交，研究前請留意時間戳。';q('#v58DataPolicyText').textContent=text}
function installDataPolicy(){
 const top=q('.topbar');if(top&&!q('#v58DataPolicy'))top.insertAdjacentHTML('afterend',dataPolicyHtml());q('#v58DataSettings').onclick=()=>{if(typeof openSheet==='function')openSheet('settingsSheet')};
 qa('#screen-watch .legalNote,#screen-portfolio .legalNote').forEach(x=>{x.textContent='資料與個人紀錄僅供研究與追蹤；市場資料更新頻率請見上方「資料狀態」。'});
 if(typeof showScreen==='function'&&!showScreen.__v58){const old=showScreen;const wrap=function(id){old(id);setTimeout(()=>{syncDataPolicy();if(id==='portfolio'){wirePortfolioRows();updatePortfolioPulse()}},0)};wrap.__v58=true;showScreen=wrap}
 if(typeof setMarket==='function'&&!setMarket.__v58){const old=setMarket;const wrap=function(m){old(m);setTimeout(syncDataPolicy,0)};wrap.__v58=true;setMarket=wrap}
 syncDataPolicy();
}

function installNavGuard(){document.documentElement.classList.add('v58ResponsiveNav')}
function staticAccuracyCleanup(){
 const flowTitle=q('#flowCard .flowHead h3');if(flowTitle&&/資金流|大單/.test(flowTitle.textContent))flowTitle.textContent='盤中委託簿壓力';
 qa('[data-old-flow-note]').forEach(x=>x.remove());
}
function installPortfolioRefreshHook(){const btn=q('#portfolioRefresh');if(btn&&!btn.dataset.v58){btn.dataset.v58='1';btn.addEventListener('click',()=>setTimeout(updatePortfolioPulse,700))}}

function boot(){if(V58.started)return;V58.started=true;installSessionSanitizer();installChartGroups();installPortfolioComposer();installAvatarMouth();installEtfGuard();installDataPolicy();installNavGuard();staticAccuracyCleanup();installPortfolioRefreshHook();setTimeout(()=>{installChartGroups();installAvatarMouth();wirePortfolioRows();syncChartGroups();syncDataPolicy()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});else setTimeout(boot,80);
window.ClariNaviV58={guardEtfVisibility,syncChartGroups,wirePortfolioRows,updatePortfolioPulse,editPortfolio,resetComposer,openSectorDetail};
})();

(function(){
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const fmt=(v,d=2)=>{const x=num(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const pct=v=>{const x=num(v);return x==null?'—':`${x>0?'+':''}${x.toFixed(2)}%`};
  const state={booted:false};

  function metricCard(label,value,sub,cls=''){
    return `<article class="v61MetricCard"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b><small>${esc(sub||'')}</small></article>`;
  }
  function extractHomeMetrics(home){
    const pairs=home?.global?.pairs||[];
    const tw=pairs.find(x=>x?.spot?.symbol==='TAIEX')?.spot||pairs[0]?.spot||{};
    const fut=pairs.find(x=>x?.future)?.future||{};
    const sectors=(home?.sectors?.sectors||[]).filter(x=>num(x.changePct)!=null).sort((a,b)=>num(b.changePct)-num(a.changePct));
    const contrib=[...(home?.contrib?.positive||[]),...(home?.contrib?.negative||[])].sort((a,b)=>Math.abs(num(b.points)||0)-Math.abs(num(a.points)||0))[0]||{};
    return {tw,fut,top:sectors[0]||{},weak:sectors.at(-1)||{},contrib};
  }
  function renderHeroPanel(){q('#v61HeroPanel')?.remove()}
  function cinematicHome(){
    const hero=q('.homeHero');if(!hero)return;
    hero.classList.remove('v61Cinematic','v65Hero');
    q('#v61HeroPanel')?.remove();
    const title=q('#marketBroadcast .broadcastEyebrow b');if(title)title.textContent='Lumi 市場播報';
    const meta=q('#marketBroadcastMeta');if(meta)meta.textContent='公開市場資料自動更新；語音可播放、暫停與繼續。';
  }

  function installAvatarMotion(){
    qa('.broadcastAvatar').forEach(av=>{qa('.v58Mouth,.v61Mouth,.v65Aura,.v65Blink,.v65MouthDeck,.v65VoiceWave',av).forEach(x=>x.remove());av.classList.remove('speaking');});
    qa('.broadcastCard').forEach(card=>card.classList.remove('speaking','v61Talking','v65Talking'));
  }

  function stripCodesForSpeech(){ /* Keep the native SpeechSynthesisUtterance constructor intact for iOS/Safari compatibility. */ }

  function setDailyKActive(){
    try{window.ClariNaviV56&&(window.ClariNaviV56.state.frame='D')}catch{}
    qa('#v56KBar button').forEach(b=>b.classList.toggle('active',b.dataset.v56Frame==='D'));
    qa('#kFrameBar button').forEach(b=>b.classList.toggle('active',b.dataset.kframe==='D'));
  }
  function installDailyKDefault(){
    const tech=q('#techMode'), line=q('#lineMode');
    if(tech&&!tech.dataset.v61Daily){
      tech.dataset.v61Daily='1';
      tech.onclick=()=>{
        try{chartMode='tech'}catch{window.chartMode='tech'}
        setDailyKActive();
        tech.classList.add('active'); line?.classList.remove('active');
        q('#v56KBar')?.classList.add('show');
        try{(typeof renderTechChart==='function'?renderTechChart:window.renderTechChart)()}catch(e){console.error(e)}
        setTimeout(()=>{q('#chartHint')&&(q('#chartHint').textContent='日 K 線 · 成交量 · MACD · RSI · KD · 訊號標記')},60);
      };
    }
    qa('#v56KBar button[data-v56-frame="D"]').forEach(b=>{if(!b.dataset.v61Label){b.dataset.v61Label='1';b.textContent='日K'}});
  }

  function installIntradayIntegrity(){
    if(typeof window.getSession==='function'&&!window.getSession.__v61){
      const oldRaw=window.readRawSession, oldWrite=window.writeRawSession, oldLine=window.linePointTime;
      const safe=function(snapshot){
        let a=[];try{a=typeof oldRaw==='function'?oldRaw(snapshot):[]}catch{}
        if(!Array.isArray(a))a=[];
        const date=String(snapshot?.date||'');
        a=a.filter(x=>Number.isFinite(Number(x?.time))&&Number.isFinite(Number(x?.value))).sort((x,y)=>x.time-y.time);
        const close=num(snapshot?.close), tm=String(snapshot?.time||'');
        if(date&&close!=null&&/^([01]\d|2[0-3]):[0-5]\d/.test(tm)&&tm>='09:00'&&tm<='13:30'){
          const t=typeof oldLine==='function'?oldLine(date,tm):Math.floor(Date.now()/1000);
          const row={time:t,value:close,volume:num(snapshot?.volume),tradeVolume:num(snapshot?.tradeVolume)};
          const last=a[a.length-1];
          if(!last||t>last.time)a.push(row); else if(t===last.time)a[a.length-1]={...last,...row};
        }
        // Do not inject a synthetic 09:00 open-to-current line. It looked like a complete intraday chart but was only two points.
        if(typeof oldWrite==='function')try{oldWrite(snapshot,a)}catch{}
        return a;
      };
      safe.__v61=true; window.getSession=safe;
    }
  }
  function installChartNotice(){
    const old=window.renderLineChart;
    if(typeof old==='function'&&!old.__v61){
      const wrap=function(){old();setTimeout(()=>{
        const count=Number((q('#sampleCount')?.textContent||'').replace(/[^0-9]/g,''));
        const notice=q('#chartNotice'), hint=q('#chartHint');
        if(hint)hint.innerHTML='盤中快照累積 <span class="v61ChartHint">若資料點不足，請改看日K確認趨勢</span>';
        if(notice&&(!Number.isFinite(count)||count<3)){
          notice.classList.remove('hidden');notice.classList.add('v61ClearNotice');
          notice.textContent='目前公開盤中快照尚未累積足夠資料，已停止用開盤價與最新價連成假走勢線。請保持頁面開啟累積，或按「K線」查看日K。';
        }
      },60)}; wrap.__v61=true; window.renderLineChart=wrap;
    }
  }

  function renderEtfCards(filter=''){
    let data=null;try{data=etfData}catch{data=window.etfData} if(!data)return;
    const term=String(filter||'').trim().toLowerCase(), all=data.holdings||[];
    const list=term?all.filter(x=>String(x.code||'').toLowerCase().includes(term)||String(x.name||'').toLowerCase().includes(term)):all;
    const count=q('#etfCount'), body=q('#etfHoldingsBody'); if(!body)return;
    if(count)count.textContent=`${list.length} / ${all.length} 檔 · 有價 ${data.priced||0}`;
    body.className='';
    const src=data.official?'官方公開持股':'公開持股來源';
    body.innerHTML=list.length?`<div class="v61EtfSummary"><span><b>完整清單</b>：目前成功解析 ${all.length} 檔，畫面不截斷長名稱，可用上方搜尋縮小範圍。</span><span>${esc(src)}${data.asOf?' · '+esc(data.asOf):''}</span></div><div class="v61EtfCards">${list.map((x,i)=>{
      const chg=num(x.quote?.changePct), px=num(x.quote?.price), w=num(x.weight);
      return `<button class="v61EtfCard" data-code="${esc(x.code)}" data-name="${esc(x.name)}"><div class="v61EtfName"><b>${esc(x.name||x.code)}</b><small>${i+1}. ${esc(x.code)} · 權重 ${w==null?'—':fmt(w,2)+'%'} · ${esc(x.quote?.market||'')}</small></div><div class="v61EtfPrice"><strong>${px==null?'—':fmt(px)}</strong><small class="${chg>0?'up':chg<0?'down':''}">${chg==null?'—':pct(chg)}</small><small>${x.quote?.isRealtime?'盤中':'最近/昨收'}</small></div></button>`}).join('')}</div>`:'<div class="empty">沒有符合的成分股。</div>';
    qa('#etfHoldingsBody .v61EtfCard').forEach(b=>b.onclick=()=>{try{(typeof openConstituent==='function'?openConstituent:window.openConstituent)(b.dataset.code,b.dataset.name)}catch{}});
  }
  function installEtfFullList(){
    if(typeof window.renderEtfHoldings==='function'&&!window.renderEtfHoldings.__v61){
      const f=function(filter=''){renderEtfCards(filter)}; f.__v61=true; window.renderEtfHoldings=f;
      const inp=q('#etfFilter'); if(inp)inp.oninput=e=>renderEtfCards(e.target.value);
    }
  }

  function avoidEllipsis(){document.documentElement.classList.add('v61NoEllipsis')}

  function boot(){
    if(state.booted)return; state.booted=true;
    stripCodesForSpeech(); cinematicHome(); installAvatarMotion(); installDailyKDefault(); installIntradayIntegrity(); installChartNotice(); installEtfFullList(); avoidEllipsis();
    window.addEventListener('clarinavi:market-home',e=>{cinematicHome(); renderHeroPanel(e.detail); installAvatarMotion()});
    setTimeout(()=>{cinematicHome();installAvatarMotion();installDailyKDefault();installEtfFullList()},900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,120),{once:true}); else setTimeout(boot,120);
  window.ClariNaviV61={setDailyKActive,renderEtfCards,cinematicHome,installAvatarMotion};
})();

(function(){
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const fmt=(v,d=2)=>{const x=n(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const pct=v=>{const x=n(v);return x==null?'—':`${x>0?'+':''}${x.toFixed(2)}%`};
  const money=v=>{const x=n(v);return x==null?'—':x>=1e8?`${(x/1e8).toFixed(2)}億`:x>=1e4?`${(x/1e4).toFixed(1)}萬`:x.toLocaleString('zh-TW')};
  const toastMsg=msg=>{try{typeof toast==='function'?toast(msg):console.log(msg)}catch{console.log(msg)}};

  function sum(arr){return (arr||[]).reduce((a,b)=>a+(n(b)||0),0)}
  function weightedValue(prices,vols){let s=0;for(let i=0;i<Math.min(prices?.length||0,vols?.length||0,5);i++){const p=n(prices[i]),v=n(vols[i]);if(p!=null&&v!=null)s+=p*v}return s}
  function barRow(label,val,max,cls){const w=max?Math.max(4,Math.min(100,Math.abs(val)/max*100)):0;return `<div class="v62PowerRow"><span>${E(label)}</span><b class="${cls||''}">${fmt(val,0)}</b><i><em class="${cls||''}" style="width:${w.toFixed(1)}%"></em></i></div>`}
  function renderQuotePower(snapshot){
    const card=q('#flowCard'); if(!card)return;
    const m=(typeof market!=='undefined'?market:(snapshot?.market==='US'?'US':'TW'));
    if(m!=='TW'||!snapshot){card.classList.add('hidden');return}
    card.classList.remove('hidden');
    const bp=snapshot.bidPrices||[],bv=snapshot.bidVolumes||[],ap=snapshot.askPrices||[],av=snapshot.askVolumes||[];
    const bq=sum(bv.slice(0,5)), aq=sum(av.slice(0,5)), bvlu=weightedValue(bp,bv), avlu=weightedValue(ap,av);
    const imb=bq+aq?((bq-aq)/(bq+aq))*100:null;
    const spread=n(ap[0])!=null&&n(bp[0])!=null?n(ap[0])-n(bp[0]):null;
    const label=imb==null?'五檔不足':imb>=25?'委買明顯較強':imb<=-25?'委賣明顯較強':'買賣盤接近平衡';
    const head=card.querySelector('.flowHead');
    if(head)head.innerHTML=`<div><h3>買賣力資訊</h3><p>以公開五檔委託快照取代故障的「委託簿壓力圖」，避免把掛單解讀成實際成交資金流。</p></div><span class="flowBadge">五檔報價 · 穩定替代</span>`;
    const stats=q('#flowStats');
    if(stats)stats.innerHTML=[
      miniSafe('委買總量',bq?fmt(bq,0):'—'), miniSafe('委賣總量',aq?fmt(aq,0):'—'),
      miniSafe('買賣力差',imb==null?'—':`${imb>0?'+':''}${fmt(imb,0)}%`,imb>0?'up':imb<0?'down':''),
      miniSafe('買一 / 賣一',`${fmt(bp[0])} / ${fmt(ap[0])}`), miniSafe('價差',fmt(spread,2))
    ].join('');
    const chart=q('#flowChart');
    if(chart){
      if(!bq&&!aq){
        chart.innerHTML=`<div class="v62PowerEmpty"><b>目前五檔資料不足</b><span>可能為非盤中、資料源未回傳、或標的暫停交易。請改看日K、成交量與技術訊號。</span></div>`;
      }else{
        const max=Math.max(bq,aq,1);
        chart.innerHTML=`<div class="v62PowerBox"><div class="v62PowerTitle"><b>${label}</b><span>${E(snapshot.time||snapshot.date||'最新快照')}</span></div>${barRow('委買五檔量',bq,max,'up')}${barRow('委賣五檔量',aq,max,'down')}<div class="v62BookMini"><div><b>買方估算掛單金額</b><span>${money(bvlu)}</span></div><div><b>賣方估算掛單金額</b><span>${money(avlu)}</span></div></div></div>`;
      }
    }
    const note=q('#flowNote');
    if(note)note.textContent='這裡只呈現五檔掛單快照與買賣量差，不再使用固定金額門檻推估大單/小單。掛單可能撤單或改價，不能當作法人、主力或散戶實際買賣。';
  }
  function miniSafe(label,value,cls=''){try{if(typeof mini==='function')return mini(label,value,cls)}catch{}return `<div class="mini"><span>${E(label)}</span><b class="${cls}">${E(value)}</b></div>`}

  function patchFlow(){
    const oldRefresh=window.refreshFlow;
    window.refreshFlow=function(){
      try{const d=typeof lastData!=='undefined'?lastData:null; renderQuotePower(d?.snapshot);}
      catch(e){console.warn('[v6.2 flow]',e); try{oldRefresh&&oldRefresh()}catch{}}
    };
    const oldRender=window.renderMain;
    if(typeof oldRender==='function'&&!oldRender.__v62){
      const wrap=function(d){oldRender(d);setTimeout(()=>renderQuotePower(d?.snapshot),40)};wrap.__v62=true;window.renderMain=wrap;
    }
    const oldApply=window.applyLive;
    if(typeof oldApply==='function'&&!oldApply.__v62){
      const wrap=async function(code){await oldApply(code);try{renderQuotePower(lastData?.snapshot)}catch{}};wrap.__v62=true;window.applyLive=wrap;
    }
  }

  function normalizedCommon(packs){
    const maps=packs.map(p=>new Map((p.rows||[]).filter(r=>n(r.close)!=null).map(r=>[String(r.date),n(r.close)])));
    if(!maps.length)return [];
    let dates=[...maps[0].keys()];
    for(const m of maps.slice(1))dates=dates.filter(d=>m.has(d));
    dates=dates.sort().slice(-260);
    return packs.map((p,i)=>{const first=dates.find(d=>n(maps[i].get(d))!=null),base=first?maps[i].get(first):null;return {...p,common:dates.map(d=>({date:d,close:maps[i].get(d),value:base?maps[i].get(d)/base*100:null})).filter(x=>n(x.value)!=null)}});
  }
  async function runPeerCompare(){
    const input=q('#compareInput'); if(!input)return;
    let codes=input.value.split(/[ ,，、\n\t]+/).map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,5);
    if(!codes.length&&typeof current!=='undefined'&&current)codes=[current];
    if(codes.length<2){q('#compareChart').innerHTML='<div class="empty">請輸入至少 2 檔股票，例如 2330,2454,2308。</div>';return}
    q('#compareChart').innerHTML='<div class="skeleton" style="height:260px"></div>';q('#compareStats').innerHTML='';
    try{
      const mk=typeof market!=='undefined'?market:'TW';
      const key=localStorage.getItem('pulse-av-key')||'';
      const packs=(await Promise.all(codes.map(async code=>{
        if(mk==='US'){
          if(!key)throw new Error('美股比較需要先在設定填入自己的 Alpha Vantage Key');
          const j=await fetch(`/api/us?symbol=${encodeURIComponent(code)}`,{headers:{'X-AV-Key':key},cache:'no-store'}).then(r=>r.json());
          if(j.error||j.needsKey)throw new Error(`${code}: ${j.error||j.note||'資料不足'}`);
          return {code,name:j.snapshot?.name||code,rows:j.history||[]};
        }
        const j=await fetch(`/api/stock?code=${encodeURIComponent(code)}&months=12`,{cache:'no-store'}).then(r=>r.json());
        if(j.error)throw new Error(`${code}: ${j.error}`);
        return {code,name:j.snapshot?.name||code,rows:j.history||[]};
      }))).filter(p=>(p.rows||[]).length>2);
      const aligned=normalizedCommon(packs).filter(p=>p.common.length>=5);
      if(aligned.length<2)throw new Error('共同交易日不足，暫時無法建立可比較線圖。');
      try{window.V5?.compareChart?.remove?.()}catch{}
      const el=q('#compareChart');el.innerHTML='';
      const opt=typeof chartOptions==='function'?chartOptions():{};
      const h=Math.max(300,Math.min(430,el.clientWidth*.52||320));
      window.V5=window.V5||{};
      window.V5.compareChart=LightweightCharts.createChart(el,{...opt,height:h,width:el.clientWidth||640});
      const colors=['#8b7cff','#4cc9f0','#f7b267','#ff6f91','#56d39a'];
      const stats=[];
      aligned.forEach((p,ix)=>{
        const ser=window.V5.compareChart.addSeries(LightweightCharts.LineSeries,{color:colors[ix%colors.length],lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:p.code});
        ser.setData(p.common.map(x=>({time:x.date,value:x.value})));
        const ret=p.common.length>1?p.common.at(-1).value-100:null;
        stats.push({name:`${p.name} ${p.code}`,ret,days:p.common.length});
      });
      window.V5.compareChart.timeScale().fitContent();
      q('#compareStats').innerHTML=stats.map(x=>miniSafe(x.name,`${pct(x.ret)} · ${x.days}日`,x.ret>0?'up':x.ret<0?'down':'')).join('');
    }catch(e){q('#compareChart').innerHTML=`<div class="empty">比較失敗：${E(e.message||'資料不足')}</div>`}
  }
  function patchCompare(){
    const title=q('#sub-compare .sectionHead h3'); if(title)title.textContent='多股比較';
    const p=q('#sub-compare .sectionHead p'); if(p)p.textContent='輸入 2–5 檔股票，只和其他股票比較；不再自動加入大盤，避免線圖被指數尺度干擾。';
    const input=q('#compareInput'); if(input)input.placeholder='例如 2330,2454,2308（至少 2 檔）';
    window.runCompare=runPeerCompare;
    const btn=q('#compareRun'); if(btn){btn.onclick=runPeerCompare;btn.textContent='比較股票'}
  }

  function fallbackDailyUsLine(){
    if(!window.LightweightCharts||!lastData)return;
    const el=q('#mainChart'); if(!el)return;
    try{destroyChart()}catch{}
    q('#intradayQuick').innerHTML='';q('#mainChart').className='mainChart';
    chart=LightweightCharts.createChart(el,typeof chartOptions==='function'?chartOptions():{});
    linePriceSeries=chart.addSeries(LightweightCharts.AreaSeries,{lineColor:'#8b7cff',topColor:'rgba(139,124,255,.22)',bottomColor:'rgba(139,124,255,.02)',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
    const data=(lastData.history||[]).slice(-45).map(x=>({time:x.date,value:x.close})).filter(x=>n(x.value)!=null);
    linePriceSeries.setData(data);chart.timeScale().fitContent();
    q('#chartHint').textContent='美股最近收盤線（EOD）；設定 Alpha Vantage Key 後會嘗試載入當日 intraday。';
    q('#sampleCount').textContent=`${data.length} 日`;q('#chartLiveBadge').className='chartLiveBadge';q('#chartLiveBadge').textContent='EOD';
    q('#chartNotice').classList.remove('hidden');q('#chartNotice').textContent='美股即時／延遲盤中行情涉及交易所授權。本功能以使用者自己的資料 Key 讀取，若來源限制則退回 EOD。';
    try{watchChart()}catch{};try{renderIndicators()}catch{}
  }
  async function renderUsIntraday(){
    fallbackDailyUsLine();
    const key=localStorage.getItem('pulse-av-key')||''; if(!key||!current)return;
    const notice=q('#chartNotice'); if(notice){notice.classList.remove('hidden');notice.textContent='正在嘗試讀取美股當日盤中線圖…'}
    try{
      const j=await fetch(`/api/us?symbol=${encodeURIComponent(current)}&mode=intraday&interval=1min`,{headers:{'X-AV-Key':key},cache:'no-store'}).then(r=>r.json());
      if(j.error||j.needsKey||!Array.isArray(j.rows)||j.rows.length<2)throw new Error(j.error||j.note||'盤中資料不足');
      const rows=j.rows;
      try{destroyChart()}catch{}
      const el=q('#mainChart');chart=LightweightCharts.createChart(el,{...(typeof chartOptions==='function'?chartOptions():{}),timeScale:{timeVisible:true,secondsVisible:false}});
      linePriceSeries=chart.addSeries(LightweightCharts.AreaSeries,{lineColor:'#8b7cff',topColor:'rgba(139,124,255,.24)',bottomColor:'rgba(76,201,240,.03)',lineWidth:2,priceLineVisible:false,lastValueVisible:true},0);
      linePriceSeries.setData(rows.map(x=>({time:x.time,value:x.close})));
      lineVolumeSeries=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);
      lineVolumeSeries.setData(rows.map((x,i)=>({time:x.time,value:x.volume||0,color:i&&x.close<rows[i-1].close?'rgba(34,197,94,.45)':'rgba(239,68,68,.45)'})));
      try{const panes=chart.panes();panes[0]?.setHeight(330);panes[1]?.setHeight(90)}catch{}
      chart.timeScale().fitContent();
      q('#chartHint').textContent=`美股當日盤中線 · ${j.interval||'1min'} · ${j.sessionDate||''}`;
      q('#sampleCount').textContent=`${rows.length} 點`;q('#chartLiveBadge').className='chartLiveBadge live';q('#chartLiveBadge').textContent='Alpha Vantage intraday';
      if(notice){notice.classList.remove('hidden');notice.textContent=j.note||'盤中資料由使用者自己的 Alpha Vantage Key 讀取；更新頻率與額度依資料源規則。'}
      chart.subscribeCrosshairMove(p=>{if(!p?.time){q('#crossInfo').textContent='—';return}const x=p.seriesData.get(linePriceSeries);if(x)q('#crossInfo').textContent=`${new Date(Number(p.time)*1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})} · ${fmt(x.value)}`});
      try{watchChart()}catch{};try{renderIndicators()}catch{}
    }catch(e){if(notice){notice.classList.remove('hidden');notice.textContent='美股盤中線暫時無法讀取：'+(e.message||'資料不足')+'；已保留 EOD 線圖。'}}
  }
  function patchUsLine(){
    const old=window.renderLineChart;
    if(typeof old==='function'&&!old.__v62){
      const wrap=function(){try{if(typeof market!=='undefined'&&market==='US')return renderUsIntraday();}catch{}return old()};wrap.__v62=true;window.renderLineChart=wrap;
    }
  }

  function installKolGuide(){
    const screen=q('#screen-kol'); if(!screen||q('#v62KolGuide'))return;
    const guide=document.createElement('section');guide.id='v62KolGuide';guide.className='panelCard v62KolGuide';
    guide.innerHTML=`<div class="sectionHead"><div><h3>KOL 貼文串接方式</h3><p>為了合規與穩定，只有官方 API、官方 RSS/網站或公開合法介面可自動更新。</p></div><span class="pill">Connection</span></div><div class="v62KolGrid"><div><b>Truth Social</b><span>可嘗試讀取公開帳號介面；失敗時保留原文入口。</span></div><div><b>X / 馬斯克等</b><span>需在 Vercel 環境變數設定 X_BEARER_TOKEN，使用 X API recent search。</span></div><div><b>Facebook 粉專</b><span>需 Meta Page Access Token 與公開內容權限，設定 META_PAGE_ACCESS_TOKEN。</span></div><div><b>黃仁勳 / NVIDIA</b><span>優先讀官方 NVIDIA Blog / Newsroom，不冒充個人社群。</span></div></div><p class="v62Policy">不做繞過登入、盜抓或重製全文；只顯示可授權取得的片段與原文連結。</p>`;
    const feed=q('#kolFeed',screen); feed?feed.before(guide):screen.appendChild(guide);
  }
  function improveKolEmpty(){
    const old=window.renderFeed;
    if(typeof old==='function'&&!old.__v62){const wrap=function(){old();installKolGuide();qa('.kolState.auth').forEach(x=>x.title='需要站方設定官方 API Token 才能自動抓取貼文')};wrap.__v62=true;window.renderFeed=wrap;}
  }

  function patchNewsTexts(){
    const p=q('.newsPreviewCard .previewHead p'); if(p)p.textContent='優先查公司名稱 + 股票，最多 10 則；若 GDELT 不足會由 Google News RSS 補齊。';
    const old=window.loadNewsPreview;
    if(typeof old==='function'&&!old.__v62){const wrap=async function(){try{await old();if(q('#newsPreview .empty')){q('#newsPreview .empty').textContent='近期公開新聞索引暫無結果，可稍後重試或改用公司全名搜尋。'}}catch(e){q('#newsPreview').innerHTML='<div class="empty">新聞暫時無法載入；已改成 GDELT + Google News RSS 雙來源，請稍後重試。</div>'}};wrap.__v62=true;window.loadNewsPreview=wrap;}
  }

  function boot(){patchFlow();patchCompare();patchUsLine();installKolGuide();improveKolEmpty();patchNewsTexts();try{if(lastData?.snapshot)renderQuotePower(lastData.snapshot)}catch{}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('clarinavi:screen',boot);
})();

(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const fmt=(v,d=2)=>{const x=n(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const pct=v=>{const x=n(v);return x==null?'—':`${x>0?'+':''}${x.toFixed(2)}%`};
  const money=v=>{const x=n(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:2})};
  let loaded=false, newsCache=null, costsCache=null, fromNews=false;

  function iconNews(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h13a3 3 0 0 1 3 3v11H6a2 2 0 0 1-2-2V5Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`}
  function iconCost(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18h16"/><path d="M6 15l4-4 3 2 5-7"/><path d="M6 9h2M10 6h2M14 10h2"/></svg>`}

  function addNav(){}

  function ensureScreen(){
    if($('#screen-news'))return;
    const sec=document.createElement('section');sec.className='screen';sec.id='screen-news';
    sec.innerHTML=`
      <div class="pageTitle v63NewsTitle">
        <div><h1>財經新聞專區</h1><p>集中顯示財經新聞，並自動替標題中提到的股票加上標籤，可直接跳到個股頁。</p></div>
        <div class="pageActions"><span class="microStamp" id="v63NewsUpdated">—</span><button class="refreshBtn" id="v63NewsRefresh">更新新聞</button></div>
      </div>
      <div class="v63NewsHero panelCard">
        <div><span class="v63Eyebrow">MARKET NEWS</span><h2>先看市場發生什麼，再點股票深入研究</h2><p>新聞只顯示標題、來源、時間與原文連結；股票標籤是由標題關鍵字自動比對，方便快速研究，不代表該新聞只影響該公司。</p></div>
        <div class="v63NewsTools"><input id="v63NewsQuery" placeholder="搜尋新聞：台積電 / AI / 美股 / 金融"><button id="v63NewsSearch">搜尋</button></div>
      </div>
      <div class="v63NewsTabs"><button class="active" data-v63tab="all">全部</button><button data-v63tab="tagged">有股票標籤</button><button data-v63tab="tw">台股</button><button data-v63tab="us">美股總經</button></div>
      <div class="v63NewsLayout">
        <section class="panelCard v63NewsPanel"><div class="sectionHead"><div><h3>最新財經新聞</h3><p id="v63NewsNote">讀取公開新聞索引中…</p></div><span class="pill" id="v63NewsCount">—</span></div><div id="v63NewsList" class="v63NewsList"><div class="skeleton"></div></div></section>
        <aside class="panelCard v63CostPanel"><div class="sectionHead"><div><h3>外資歷史估算成本清單</h3><p>以本次載入的歷史區間，估算外資買超日加權成本，並標示實際起始日。</p></div><span class="pill">估算</span></div><div class="v63CostSearch"><input id="v63CostCodes" placeholder="自訂代號：2330,2454,2308"><button id="v63CostRun">更新</button></div><div id="v63CostList" class="v63CostList"><div class="skeleton"></div></div><div class="legalNote v63CostNote" id="v63CostNote">此功能不是外資真實庫存成本，也不使用未授權券商分點資料。</div></aside>
      </div>
      <div class="legalNote v63NewsLegal">資料來源：GDELT DOC 2.0、Google News RSS 公開新聞索引，以及 TWSE 三大法人買賣超日報與日收盤資料。新聞內容與連結屬原發布者；本站不重製全文。外資成本線為估算與教學研究用途，不構成投資建議。</div>`;
    const kol=$('#screen-kol');(kol&&kol.parentNode?kol.parentNode:$('.app')||document.body).insertBefore(sec,kol||null);
    $('#v63NewsRefresh').onclick=()=>loadNewsHub(true);
    $('#v63NewsSearch').onclick=()=>loadNewsHub(true,$('#v63NewsQuery').value.trim());
    $('#v63NewsQuery').onkeydown=e=>{if(e.key==='Enter')loadNewsHub(true,e.target.value.trim())};
    $$('.v63NewsTabs button').forEach(b=>b.onclick=()=>{ $$('.v63NewsTabs button').forEach(x=>x.classList.toggle('active',x===b)); renderNews(); });
    $('#v63CostRun').onclick=()=>loadForeignCosts(true);
  }

  function showNewsScreen(){
    ensureScreen();addNav();
    if(typeof window.showScreen==='function')window.showScreen('news');
    $$('#screen-news [data-v63tab]').forEach((b,i)=>b.classList.toggle('active',i===0));
    if(!newsCache)loadNewsHub(false);
    if(!costsCache)loadForeignCosts(false);
  }

  function patchShowScreen(){
    if(typeof window.showScreen!=='function'||window.showScreen.__v63)return;
    const old=window.showScreen;
    const wrap=function(id){old(id); if(id==='news'){ensureScreen(); if(!newsCache)loadNewsHub(false); if(!costsCache)loadForeignCosts(false);} };
    wrap.__v63=true;window.showScreen=wrap;
  }

  function openTaggedStock(market,code){
    fromNews=true;
    try{localStorage.setItem('clarinavi-return-news','1')}catch{}
    if(typeof window.openSymbol==='function')window.openSymbol(market||'TW',code);
    else{window.location.href=`/?market=${encodeURIComponent(market||'TW')}&code=${encodeURIComponent(code)}`}
    setTimeout(addBackNewsBar,500);
  }
  window.v63OpenStockFromNews=openTaggedStock;
  function addBackNewsBar(){
    const stock=$('#stockResult'); if(!stock||$('#v63BackNews'))return;
    const b=document.createElement('button');b.id='v63BackNews';b.className='v63BackNews';b.innerHTML='← 回新聞專區';b.onclick=()=>{fromNews=false;try{localStorage.removeItem('clarinavi-return-news')}catch{}showNewsScreen();b.remove();};
    stock.prepend(b);
  }

  async function loadNewsHub(force=false,query=''){
    ensureScreen();
    const list=$('#v63NewsList'); if(list)list.innerHTML='<div class="skeleton"></div>';
    $('#v63NewsUpdated').textContent='更新中…';
    try{
      const u=new URL('/api/news-hub',location.origin);u.searchParams.set('days','7');u.searchParams.set('limit','36');if(query)u.searchParams.set('q',query);
      const j=await fetch(u,{cache:'no-store'}).then(r=>r.json());
      newsCache=j;renderNews();
      $('#v63NewsUpdated').textContent='更新 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
      $('#v63NewsNote').textContent=j.note||'已載入公開新聞索引。';
    }catch(e){
      $('#v63NewsList').innerHTML=`<div class="empty">新聞專區暫時無法載入：${E(e.message||'資料源錯誤')}</div>`;
      $('#v63NewsUpdated').textContent='載入失敗';
      $('#v63NewsNote').textContent='請稍後重試，或改用個股頁近期新聞。';
    }
  }

  function renderNews(){
    const box=$('#v63NewsList'); if(!box||!newsCache)return;
    const tab=$('.v63NewsTabs button.active')?.dataset.v63tab||'all';
    let items=newsCache.items||[];
    if(tab==='tagged')items=items.filter(x=>(x.tags||[]).length);
    if(tab==='tw')items=items.filter(x=>(x.tags||[]).some(t=>t.market==='TW')||/台股|台積電|半導體|金融|航運|上櫃|上市/.test(x.title||''));
    if(tab==='us')items=items.filter(x=>(x.tags||[]).some(t=>t.market==='US')||/美股|NASDAQ|那斯達克|S&P|Fed|NVIDIA|Tesla|Apple|Microsoft/i.test(x.title||''));
    $('#v63NewsCount').textContent=`${items.length} 則`;
    if(!items.length){box.innerHTML='<div class="empty">目前沒有符合篩選的新聞。</div>';return;}
    box.innerHTML=items.map((x,idx)=>`
      <article class="v63NewsCard">
        <div class="v63NewsMeta"><span>${E(x.topic||'財經新聞')}</span><b>${E(x.source||'新聞來源')}</b><time>${E(String(x.date||'').replace('T',' ').slice(0,16))}</time></div>
        <h3>${E(x.title)}</h3>
        <div class="v63StockTags">${(x.tags||[]).length?(x.tags||[]).map(t=>`<button data-market="${E(t.market)}" data-code="${E(t.code)}">${E(t.name)} <small>${E(t.code)}</small></button>`).join(''):'<span>未偵測到明確個股</span>'}</div>
        <div class="v63NewsActions">${x.url?`<a href="${E(x.url)}" target="_blank" rel="noopener">閱讀原文 ↗</a>`:''}<span>${E(x.via||'Public index')}</span></div>
      </article>`).join('');
    $$('#v63NewsList .v63StockTags button').forEach(b=>b.onclick=()=>openTaggedStock(b.dataset.market,b.dataset.code));
  }

  async function loadForeignCosts(force=false){
    ensureScreen();const box=$('#v63CostList');if(box)box.innerHTML='<div class="skeleton"></div>';
    try{
      const codes=($('#v63CostCodes')?.value||'').trim();const u=new URL('/api/foreign-costs',location.origin);if(codes)u.searchParams.set('codes',codes);
      const j=await fetch(u,{cache:'no-store'}).then(r=>r.json());costsCache=j;renderForeignCosts();
      $('#v63CostNote').textContent=j.note||'外資歷史估算成本為公開資料估算，不代表外資真實持倉成本。';
    }catch(e){box.innerHTML=`<div class="empty">外資成本清單暫時無法載入：${E(e.message||'資料源錯誤')}</div>`}
  }
  function costCell(line,current,label){
    const cost=num(line?.cost),net=num(line?.netShares),start=line?.firstDate||'—',end=line?.lastDate||'—';
    return `<div class="v108CostCell"><span>${E(label)}</span><b class="${cls(current!=null&&cost!=null?current-cost:0)}">${cost!=null?fmt(cost,2):'—'}</b><small>${E(start)} → ${E(end)}</small><em>${net==null?'樣本不足':(net>=0?'+':'')+fmt(net/1000,0)+' 張'} · ${E(line?.sampleDays||0)} 日</em></div>`;
  }
  function renderForeignCosts(){
    const box=$('#v63CostList'); if(!box||!costsCache)return;const items=costsCache.items||[];
    if(!items.length){box.innerHTML='<div class="empty">目前無法取得三大法人成本估算資料。</div>';return;}
    const cell=(line,current,label)=>`<td><div class="v108CostCell"><span>${E(label)}</span><b class="${cls(current!=null&&num(line?.cost)!=null?current-num(line.cost):0)}">${num(line?.cost)!=null?fmt(line.cost,2):'—'}</b><small>${E(line?.firstDate||'—')} → ${E(line?.lastDate||'—')}</small></div></td>`;
    box.innerHTML=`<div class="v63CostTableWrap"><table class="v63CostTable"><thead><tr><th>股票</th><th>現價</th><th>外資</th><th>投信</th><th>自營商</th><th>判讀</th></tr></thead><tbody>${items.map(x=>{const l=x.lines||{foreign:x.accumulated||{},trust:{},dealer:{}};return `<tr><td><button class="v63CostStock" data-code="${E(x.code)}">${E(x.name)}<small>${E(x.code)}</small></button></td><td><b>${fmt(x.current,2)}</b><small>${E(x.lastDate||'')}</small></td>${cell(l.foreign,x.current,'外資')}${cell(l.trust,x.current,'投信')}${cell(l.dealer,x.current,'自營商')}<td><span class="v63SignalText">${E(x.signal||'—')}</span></td></tr>`}).join('')}</tbody></table></div>`;
    $$('#v63CostList .v63CostStock').forEach(b=>b.onclick=()=>openTaggedStock('TW',b.dataset.code));
  }

  function patchStockNewsPreview(){
    const btn=$('#newsMoreBtn');
    if(btn&&!$('#v63NewsHubShortcut')){
      const s=document.createElement('button');s.id='v63NewsHubShortcut';s.type='button';s.textContent='新聞專區';s.onclick=showNewsScreen;btn.insertAdjacentElement('afterend',s);
    }
  }

  function boot(){
    ensureScreen();addNav();patchShowScreen();patchStockNewsPreview();
    try{if(localStorage.getItem('clarinavi-return-news'))setTimeout(addBackNewsBar,800)}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setTimeout(boot,800);
})();

(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const fmt=(v,d=0)=>{const x=n(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d});};
  const lots=v=>{const x=n(v);return x==null?'—':`${x>0?'+':''}${(x/1000).toLocaleString('zh-TW',{maximumFractionDigits:0})} 張`;};
  const cls=v=>n(v)>0?'up':n(v)<0?'down':'muted';
  let stockCache=new Map(), listCache=null, activeKey='total';

  function icon(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16V9"/><path d="M12 16V6"/><path d="M16 16v-4"/><path d="M20 16V8"/></svg>`}
  function addNav(){}
  function ensureInstitutionScreen(){
    if($('#screen-institutional'))return;
    const sec=document.createElement('section');sec.className='screen';sec.id='screen-institutional';
    sec.innerHTML=`
      <div class="pageTitle"><div><h1>法人籌碼觀察</h1><p>查詢外資、投信、自營商與三大法人買賣超；使用官方公開資料重新設計，不抓取 Yahoo 頁面。</p></div><div class="pageActions"><span class="microStamp" id="v64ListUpdated">—</span><button class="refreshBtn" id="v64ListRefresh">更新清單</button></div></div>
      <div class="v64Hero panelCard"><div><span class="v64Eyebrow">INSTITUTIONAL FLOW</span><h2>先看法人方向，再點個股深入</h2><p>支援個股查詢、逐日買賣超、連買連賣、5/10/20日累計，以及最近交易日法人排行。</p></div><div class="v64Search"><input id="v64StockCode" placeholder="輸入股票代號：2409 / 2330"><button id="v64StockRun">查詢法人</button></div></div>
      <div class="v64InstLayout">
        <section class="panelCard"><div class="sectionHead"><div><h3>個股法人買賣</h3><p id="v64StockNote">輸入股票代號後，會整理成外資／投信／自營商／三大法人四個角度。</p></div><span class="pill" id="v64StockSource">官方公開資料</span></div><div id="v64StockPanel" class="v64StockPanel"><div class="empty">請先輸入股票代號，或在個股頁開啟「法人 / 大戶」。</div></div></section>
        <aside class="panelCard"><div class="sectionHead"><div><h3>法人買賣排行清單</h3><p>最近可得交易日的法人買賣超排行，可切換外資／投信／自營商／合計。</p></div><span class="pill" id="v64RankDate">—</span></div><div class="v64RankTools"><select id="v64RankType"><option value="foreign">外資</option><option value="trust">投信</option><option value="dealer">自營商</option><option value="total">三大法人</option></select><select id="v64RankSide"><option value="buy">買超排行</option><option value="sell">賣超排行</option></select></div><div id="v64RankList" class="v64RankList"><div class="skeleton"></div></div><div class="legalNote">排行為盤後公開資料，不等於盤中法人委託，也不是券商分點主力。</div></aside>
      </div>
      <div class="legalNote">資料口徑：上市使用 TWSE T86 三大法人買賣超日報；上櫃使用 TPEx 三大法人公開資料。本站重新設計資料呈現，不複製第三方頁面版型或資料庫。</div>`;
    const news=$('#screen-news'), kol=$('#screen-kol');(news?.parentNode||kol?.parentNode||$('.app')||document.body).insertBefore(sec,news||kol||null);
    $('#v64StockRun').onclick=()=>loadInstitutionStock($('#v64StockCode').value.trim(), 'TWSE', $('#v64StockPanel'));
    $('#v64StockCode').onkeydown=e=>{if(e.key==='Enter')loadInstitutionStock(e.target.value.trim(),'TWSE',$('#v64StockPanel'))};
    $('#v64ListRefresh').onclick=()=>loadRank(true);
    $('#v64RankType').onchange=()=>loadRank(true);
    $('#v64RankSide').onchange=()=>loadRank(true);
  }
  function showInstitutionScreen(){ensureInstitutionScreen();addNav(); if(typeof window.showScreen==='function')window.showScreen('institutional'); if(!listCache)loadRank(false);}
  function patchShowScreen(){if(typeof window.showScreen!=='function'||window.showScreen.__v64)return;const old=window.showScreen;const wrap=function(id){old(id);if(id==='institutional'){ensureInstitutionScreen();if(!listCache)loadRank(false);}};wrap.__v64=true;window.showScreen=wrap;}
  function openStock(code){ if(!code)return; if(typeof window.openSymbol==='function')window.openSymbol('TW',code); else {const q=$('#q'); if(q){q.value=code; $('#go')?.click();} } }

  function activeStock(){
    const t=$('#stockName')?.textContent||'',m=t.match(/(\d{4,6}[A-Z]?)/); if(!m)return null;
    const meta=$('#stockMeta')?.textContent||'',market=/TPEx|OTC|上櫃/i.test(meta)?'TPEx':'TWSE'; return {code:m[1],market};
  }
  function ensureStockChipPanel(){
    const root=$('#sub-chips'); if(!root)return null;
    let panel=$('#v64InstStockEmbed');
    if(!panel){panel=document.createElement('div');panel.id='v64InstStockEmbed';panel.className='v64EmbeddedInst panelCard';panel.innerHTML=`<div class="sectionHead"><div><h3>法人買賣查詢</h3><p>比照常見籌碼頁的資訊邏輯，重新整理為四類法人、逐日表格與累計訊號。</p></div><span class="pill">官方資料</span></div><div class="v64StockPanel"><div class="skeleton"></div></div>`;const target=$('#chipInsight')||$('#chipSummary')||root.firstChild;root.insertBefore(panel,target?target.nextSibling:null);}return panel.querySelector('.v64StockPanel');
  }
  async function loadStockEmbed(){const s=activeStock();const box=ensureStockChipPanel();if(!s||!box)return;await loadInstitutionStock(s.code,s.market,box);}
  function patchSub(){
    $$('.subTab[data-sub="chips"]').forEach(b=>{if(b.__v64)return;b.__v64=true;b.addEventListener('click',()=>setTimeout(loadStockEmbed,220));});
    if(typeof window.switchSub==='function'&&!window.switchSub.__v64){const old=window.switchSub;const wrap=async function(id){const r=await old(id);if(id==='chips')setTimeout(loadStockEmbed,160);return r};wrap.__v64=true;window.switchSub=wrap;}
    if(typeof window.renderMain==='function'&&!window.renderMain.__v64){const old=window.renderMain;const wrap=function(d){const r=old(d);setTimeout(()=>{if($('#sub-chips.active'))loadStockEmbed();},360);return r};wrap.__v64=true;window.renderMain=wrap;}
  }

  async function loadInstitutionStock(code,market,box){
    code=String(code||'').trim().toUpperCase(); if(!/^\d{4,6}[A-Z]?$/.test(code)){if(box)box.innerHTML='<div class="empty">請輸入正確股票代號。</div>';return;}
    box=box||$('#v64StockPanel'); if(!box)return; box.innerHTML='<div class="skeleton"></div>'; activeKey='total';
    try{const key=`${market}:${code}`;let j=stockCache.get(key);if(!j){const u=new URL('/api/institutional',location.origin);u.searchParams.set('code',code);u.searchParams.set('market',market||'TWSE');u.searchParams.set('days','24');j=await fetch(u,{cache:'no-store'}).then(r=>r.json());stockCache.set(key,j);}renderInstitutionStock(j,box);const sc=$('#v64StockSource');if(sc)sc.textContent=j.market||market||'TWSE';const note=$('#v64StockNote');if(note)note.textContent=j.note||'已載入官方公開法人資料。';}
    catch(e){box.innerHTML=`<div class="empty">法人資料暫時無法載入：${E(e.message||'資料源錯誤')}</div>`;}
  }
  function statBlock(label,obj){const v=n(obj?.net);return `<div class="v64Stat"><span>${E(label)}</span><b class="${cls(v)}">${lots(v)}</b><small>${E(obj?.sampleDays?`${obj.sampleDays} 日樣本`:'')}</small></div>`;}
  function typeLabel(k){return {foreign:'外資',trust:'投信',dealer:'自營商',total:'三大法人'}[k]||k;}
  function renderInstitutionStock(j,box){
    if(!j?.ok){box.innerHTML=`<div class="empty">${E(j?.error||'法人資料無法取得')}</div>`;return;}
    const rows=j.rows||[],sum=j.summary||{},code=j.code||''; if(!rows.length){box.innerHTML='<div class="empty">目前查無這檔股票的法人公開資料。</div>';return;}
    const latest=rows.at(-1),tabs=['total','foreign','trust','dealer'];
    box.innerHTML=`<div class="v64StockHead"><div><b>${E(latest.name||code)} <small>${E(code)}</small></b><span>最新資料日 ${E(latest.date||'—')}</span></div><button data-open-stock="${E(code)}">回個股頁</button></div>
      <div class="v64InstTabs">${tabs.map(k=>`<button class="${k===activeKey?'active':''}" data-inst-key="${k}">${typeLabel(k)}</button>`).join('')}</div>
      <div class="v64InstStats" id="v64InstStats"></div>
      <div class="v64MiniChart" id="v64MiniChart"></div>
      <div class="v64InstTableWrap"><table class="v64InstTable"><thead><tr><th>日期</th><th>外資</th><th>投信</th><th>自營商</th><th>三大法人</th></tr></thead><tbody>${rows.slice().reverse().map(r=>`<tr><td>${E(r.date)}</td><td class="${cls(r.foreign?.net)}">${lots(r.foreign?.net)}</td><td class="${cls(r.trust?.net)}">${lots(r.trust?.net)}</td><td class="${cls(r.dealer?.net)}">${lots(r.dealer?.net)}</td><td class="${cls(r.total?.net)}"><b>${lots(r.total?.net)}</b></td></tr>`).join('')}</tbody></table></div>
      <div class="legalNote">${E(j.note||'法人買賣超為公開盤後資料，不能視為即時下單。')}</div>`;
    box.querySelector('[data-open-stock]')?.addEventListener('click',()=>openStock(code));
    box.querySelectorAll('[data-inst-key]').forEach(b=>b.onclick=()=>{activeKey=b.dataset.instKey;box.querySelectorAll('[data-inst-key]').forEach(x=>x.classList.toggle('active',x===b));renderInstStats(j,box);renderMiniChart(j,box);});
    renderInstStats(j,box);renderMiniChart(j,box);
  }
  function renderInstStats(j,box){const s=j.summary?.[activeKey]||{},latest=j.summary?.latest?.[activeKey]?.net;const el=box.querySelector('#v64InstStats');if(!el)return;el.innerHTML=[statBlock('最新一日', {net:latest,sampleDays:1}),statBlock('5日累計',s.sum5),statBlock('10日累計',s.sum10),statBlock('20日累計',s.sum20),`<div class="v64Stat"><span>連續買賣</span><b>${E(s.streak?.label||'—')}</b><small>${typeLabel(activeKey)}</small></div>`].join('');}
  function renderMiniChart(j,box){const rows=(j.rows||[]).slice(-20),mx=Math.max(1,...rows.map(r=>Math.abs(n(r[activeKey]?.net)||0))),el=box.querySelector('#v64MiniChart');if(!el)return;el.innerHTML=rows.map(r=>{const v=n(r[activeKey]?.net)||0,h=Math.max(4,Math.round(Math.abs(v)/mx*68));return `<div class="v64BarItem" title="${E(r.date)} ${lots(v)}"><span class="${v>=0?'pos':'neg'}" style="height:${h}px"></span><small>${E(String(r.date||'').slice(5))}</small></div>`}).join('');}

  async function loadRank(force=false){
    ensureInstitutionScreen(); const box=$('#v64RankList'); if(!box)return; box.innerHTML='<div class="skeleton"></div>';
    const type=$('#v64RankType')?.value||'foreign',side=$('#v64RankSide')?.value||'buy';
    try{const u=new URL('/api/institutional',location.origin);u.searchParams.set('mode','list');u.searchParams.set('type',type);u.searchParams.set('side',side);u.searchParams.set('limit','25');const j=await fetch(u,{cache:'no-store'}).then(r=>r.json());listCache=j;renderRank(j);}
    catch(e){box.innerHTML=`<div class="empty">排行資料暫時無法載入：${E(e.message||'')}</div>`;}
  }
  function renderRank(j){const box=$('#v64RankList'); if(!box)return; const items=j.items||[]; $('#v64RankDate')&&($('#v64RankDate').textContent=j.date||'—'); $('#v64ListUpdated')&&($('#v64ListUpdated').textContent='更新 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})); if(!items.length){box.innerHTML='<div class="empty">目前無可用排行。</div>';return;} box.innerHTML=items.slice(0,18).map((x,i)=>`<button class="v64RankRow" data-code="${E(x.code)}"><span>${i+1}</span><b>${E(x.name)}<small>${E(x.code)}</small></b><strong class="${cls(x.net)}">${lots(x.net)}</strong></button>`).join(''); box.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>openStock(b.dataset.code));}

  function patchVercelHint(){const note=document.createElement('div');note.id='v64DeployHint';note.className='v64DeployHint';note.innerHTML='<b>部署提醒</b><span>v6.4 已移除 package.json 的 engines.node，Vercel 將不再出現 Node.js Version override 警告；若專案設定仍有 Node 版本，會由 Vercel Project Settings 控制。</span>';const legal=document.querySelector('.thirdPartyNotice')||document.querySelector('.app'); if(legal&&!$('#v64DeployHint'))legal.insertAdjacentElement('beforebegin',note);}
  function boot(){addNav();ensureInstitutionScreen();patchShowScreen();patchSub();patchVercelHint();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot(); setTimeout(boot,800);
})();

(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:null};
  const fmt=(v,d=2)=>{const x=num(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const lots=v=>{const x=num(v);return x==null?'—':`${x.toLocaleString('zh-TW',{maximumFractionDigits:0})} 張`};
  const money=v=>{const x=num(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:0})};
  const cls=v=>{const x=num(v);return x>0?'up':x<0?'down':'muted'};
  const COST_DEFAULT='2330,2454,2308,2317,2409,2382,3231,6669';
  let costCache=null, v65LastData=null, v65Market='TW', v65Current='';

  function ensureDarkReadable(){
    document.body.classList.add('v65-ready');
    if(!document.body.dataset.theme){
      try{ if((localStorage.getItem('clarinavi-theme')||localStorage.getItem('pulse-theme')||'dark')==='dark') document.body.dataset.theme='dark'; }catch{document.body.dataset.theme='dark'}
    }
  }

  function enhanceAvatar(av){
    if(!av)return;av.dataset.v65Avatar='static';av.classList.remove('speaking','v65AvatarEnhanced');
    $$('.v58Mouth,.v61Mouth,.v65Aura,.v65Blink,.v65MouthDeck,.v65VoiceWave',av).forEach(x=>x.remove());
  }
  function markTalking(card,on){
    if(!card)return;
    card.classList.toggle('v65Talking',!!on);
    const av=$('.broadcastAvatar',card); if(av)av.classList.toggle('speaking',!!on);
  }
  function installAvatarMotion(){
    $$('.broadcastAvatar').forEach(enhanceAvatar);$$('.broadcastCard').forEach(c=>c.classList.remove('speaking','v61Talking','v65Talking'));
  }

  function tuneHome(){
    const hero=$('.homeHero'); if(!hero)return;
    hero.classList.remove('v65Hero','v61Cinematic');
    const head=$('.homeHead',hero); if(head){
      const h=head.querySelector('h1'); if(h)h.textContent='用數據照亮投資之路';
      const p=head.querySelector('p'); if(p)p.textContent='主要指數、台指期與台股盤面集中顯示。';
    }
    const mb=$('#marketBroadcast'); if(mb){
      mb.classList.remove('v65AvatarCard');
      const title=mb.querySelector('.broadcastEyebrow b'); if(title)title.textContent='Lumi 市場播報';
      const meta=$('#marketBroadcastMeta'); if(meta)meta.textContent='完整人物多幀動畫；語音與行情資料分開運作。';
    }
    $$('.marketPair').forEach(x=>x.classList.add('v65IndexCard'));
    installAvatarMotion();
  }

  function costCell(line,current,label){
    const cost=num(line?.cost),net=num(line?.netShares),start=line?.firstDate||'—',end=line?.lastDate||'—';
    return `<div class="v108CostCell"><span>${E(label)}</span><b class="${cls(current!=null&&cost!=null?current-cost:0)}">${cost!=null?fmt(cost,2):'—'}</b><small>${E(start)} → ${E(end)}</small><em>${net==null?'樣本不足':(net>=0?'+':'')+fmt(net/1000,0)+' 張'} · ${E(line?.sampleDays||0)} 日</em></div>`;
  }
  function costRow(x,detail=true){
    const current=num(x.current),lines=x.lines||{foreign:x.foreign||x.accumulated||{},trust:x.trust||{},dealer:x.dealer||{}},start=x.historyStart||lines.foreign?.firstDate||'—',end=x.historyEnd||lines.foreign?.lastDate||'—';
    return `<article class="v65CostRow v108CostRow" data-cost-code="${E(x.code)}"><button type="button" class="v108CostIdentity" data-open-cost-stock="${E(x.code)}"><b>${E(x.name||x.code)}</b><span>${E(x.code)} · 現價 ${fmt(current,2)}</span><small>最早 ${E(start)} · 最新 ${E(end)}</small></button>${costCell(lines.foreign,current,'外資')}${costCell(lines.trust,current,'投信')}${costCell(lines.dealer,current,'自營商')}${detail?`<button type="button" class="v65CostToggle" data-toggle-cost="${E(x.code)}">說明</button>`:''}</article>${detail?`<div class="v65CostDetail" id="v65CostDetail-${E(x.code)}"><b>三大法人歷史成本估算</b><br>每條線都從資料源實際可取得且可對齊收盤價的最早日期開始；以淨買超為正的交易日按淨買超股數加權收盤價。非真實庫存成本。</div>`:''}`;
  }
  function bindCostRows(root=document){
    $$('[data-open-cost-stock]',root).forEach(b=>{if(b.dataset.v65Open)return;b.dataset.v65Open='1';b.onclick=()=>openStock(b.dataset.openCostStock)});
    $$('[data-toggle-cost]',root).forEach(b=>{if(b.dataset.v65Toggle)return;b.dataset.v65Toggle='1';b.onclick=()=>{$(`#v65CostDetail-${CSS.escape(b.dataset.toggleCost)}`)?.classList.toggle('show')}});
  }
  function openStock(code){
    if(!code)return;
    if(typeof window.openSymbol==='function')return window.openSymbol('TW',code);
    const q=$('#q'); if(q){q.value=code; $('#go')?.click();}
  }
  async function fetchCosts(codes=COST_DEFAULT,force=false){
    const key=String(codes||COST_DEFAULT);
    if(costCache&&!force&&costCache.key===key&&Date.now()-costCache.t<900000)return costCache.data;
    const u=new URL('/api/foreign-costs',location.origin);u.searchParams.set('codes',key);if(!key.includes(','))u.searchParams.set('all','1');
    const j=await fetch(u,{cache:'no-store'}).then(r=>r.json());
    costCache={key,t:Date.now(),data:j};return j;
  }
  // Homepage cost panel is owned by the unified module below. Keep this legacy module stock-only.
  function ensureHomeCosts(){ return null; }
  async function loadHomeCosts(){ return null; }
  async function loadStockCostPanel(){
    const code=String(v65Current||$('#stockName')?.textContent?.match(/\d{4,6}[A-Z]?/)?.[0]||'').trim();
    if(!/^\d{4,6}[A-Z]?$/.test(code))return;
    const shell=$('#stockResult .stockShell'); if(!shell)return;
    let panel=$('#v65StockCostPanel');
    if(!panel){panel=document.createElement('article');panel.id='v65StockCostPanel';panel.className='panelCard v65StockCostCard';panel.innerHTML='<div class="v65CostHead"><div><h3>三大法人歷史成本（三線）</h3><p>外資／投信／自營商全歷史估算；每條線顯示實際最早資料日。</p></div><span class="pill">估算</span></div><div id="v65StockCostBody"><div class="skeleton"></div></div>'; const chart=$('.chartCard',shell); chart?chart.after(panel):shell.appendChild(panel);}
    const body=$('#v65StockCostBody'); if(!body)return; body.innerHTML='<div class="skeleton"></div>';
    try{const j=await fetchCosts(code,true);const x=(j.items||[])[0];body.innerHTML=x?costRow(x,false)+`<div class="v65CostDetail show"><b>${E(x.signal||'估算成本區')}</b><br>${E(j.note||'外資成本線為公開資料估算，不代表真實庫存成本。')}</div>`:'<div class="empty">這檔目前樣本不足，無法計算三大法人成本。</div>';bindCostRows(body);}catch(e){body.innerHTML=`<div class="empty">三大法人成本暫時無法使用：${E(e.message||'')}</div>`;}
  }

  function renderEtfFallbackCard(code){
    return `<div class="empty v65NoTruncate"><b>尚未取得完整官方成分股</b><br>這檔 ETF 目前無法由已接入的公開來源完整解析。v6.5 會顯示「可得清單」或「指數主要成分參考」，不再假裝完整。若需要正式持股，請以發行投信每日公告為準。</div>`;
  }
  function renderEtfListV65(filter=''){
    let data=null; try{data=window.etfData||etfData}catch{data=window.etfData}
    const body=$('#etfHoldingsBody'); if(!body)return;
    const term=String(filter||'').trim().toLowerCase();
    let all=(data?.holdings||[]).filter(x=>String(x.code||'').trim());
    if(term)all=all.filter(x=>String(x.code||'').toLowerCase().includes(term)||String(x.name||'').toLowerCase().includes(term));
    const count=$('#etfCount'); if(count)count.textContent=`${all.length} 檔${data?.priced!=null?' · 有價 '+data.priced:''}`;
    body.className='v65NoTruncate';
    if(!all.length){body.innerHTML=renderEtfFallbackCard(data?.code||'');return;}
    body.innerHTML=`<div class="v65EtfSummary"><span><b>成分股清單</b>：顯示目前公開來源成功解析的 ${all.length} 檔，長名稱完整換行。</span><span>${E(data?.source||'公開來源')}${data?.asOf?' · '+E(data.asOf):''}</span></div><div class="v65EtfList">${all.map((x,i)=>{
      const q=x.quote||{}, ch=num(q.changePct), price=num(q.price), w=num(x.weight);
      return `<button class="v65EtfItem" data-code="${E(x.code)}" data-name="${E(x.name||x.code)}"><span><b>${E(x.name||x.code)}</b><small>${i+1}. ${E(x.code)} · 權重 ${w==null?'—':fmt(w,2)+'%'}${x.reference?' · 參考':' '} </small></span><span><strong>${price==null?'—':fmt(price,2)}</strong><small class="${cls(ch)}">${ch==null?'—':(ch>0?'+':'')+fmt(ch,2)+'%'}</small></span></button>`;
    }).join('')}</div>`;
    $$('#etfHoldingsBody .v65EtfItem').forEach(b=>{b.onclick=()=>{try{(window.openConstituent||openConstituent)(b.dataset.code,b.dataset.name)}catch{openStock(b.dataset.code)}}});
  }
  function patchETF(){
    window.renderEtfHoldings=renderEtfListV65;
    const inp=$('#etfFilter'); if(inp)inp.oninput=e=>renderEtfListV65(e.target.value);
    const btn=$('#etfHoldBtn'); if(btn){btn.onclick=async()=>{
      const s=v65LastData?.snapshot||{}; const code=String(v65Current||s.code||'');
      if(!/^00\d{2,4}[A-Z]?$/.test(code)&&s.assetHint!=='ETF')return;
      if(typeof window.openSheet==='function')window.openSheet('etfSheet'); else $('#etfSheet')?.classList.add('show');
      $('#etfSheetTitle')&&($('#etfSheetTitle').textContent=`${s.name||code} ${code} · 成分股`);
      $('#etfFilter')&&($('#etfFilter').value='');
      $('#etfHoldingsBody')&&($('#etfHoldingsBody').innerHTML='<div class="skeleton"></div>');
      $('#etfCount')&&($('#etfCount').textContent='載入中…');
      try{const j=await fetch(`/api/etf?code=${encodeURIComponent(code)}`,{cache:'no-store'}).then(r=>r.json());window.etfData=j;try{etfData=j}catch{};$('#etfSheetMeta')&&($('#etfSheetMeta').textContent=`${j.source||'ETF 公開持股'}${j.asOf?' · '+j.asOf:''} · ${j.note||''}`);renderEtfListV65();}
      catch(e){$('#etfHoldingsBody').innerHTML=`<div class="empty">ETF 成分股暫時無法使用：${E(e.message||'')}</div>`;}
    }}
  }

  function normalizeDepthArrays(s){
    const bp=(s?.bidPrices||[]).map(num), bv=(s?.bidVolumes||[]).map(num), ap=(s?.askPrices||[]).map(num), av=(s?.askVolumes||[]).map(num);
    const bids=[], asks=[];
    for(let i=0;i<5;i++){if(bp[i]!=null||bv[i]!=null)bids.push({price:bp[i],volume:bv[i]}); if(ap[i]!=null||av[i]!=null)asks.push({price:ap[i],volume:av[i]});}
    return {bids,asks};
  }
  function sideHtml(title,rows,kind){
    return `<div class="v65PowerSide"><h4>${E(title)}</h4>${rows.length?rows.map((r,i)=>`<div class="v65DepthRow"><span>${i+1}</span><span class="${kind==='bid'?'down':'up'}">${fmt(r.price,2)}</span><span>${lots(r.volume)}</span></div>`).join(''):'<div class="empty">無五檔資料</div>'}</div>`;
  }
  function renderDepthV65(s){
    const box=$('#depthBook'); if(!box)return;
    const {bids,asks}=normalizeDepthArrays(s||{});
    if(!bids.length&&!asks.length){box.innerHTML='<div class="empty">目前未取得五檔報價。非盤中、暫停交易或資料源未回傳時會顯示空白。</div>';return;}
    box.innerHTML=sideHtml('買五檔｜委買價 / 張數',bids,'bid')+sideHtml('賣五檔｜委賣價 / 張數',asks,'ask')+`<div class="v65PowerWarn">五檔是公開委託掛單快照，單位以張數呈現；掛單可能撤單或改價，不能當成實際成交資金流。</div>`;
  }
  function flowV65(){
    const card=$('#flowCard'); if(!card||!v65LastData)return;
    const s=v65LastData.snapshot||{}, {bids,asks}=normalizeDepthArrays(s);
    const bidVol=bids.reduce((a,x)=>a+(num(x.volume)||0),0), askVol=asks.reduce((a,x)=>a+(num(x.volume)||0),0);
    const bidVal=bids.reduce((a,x)=>a+(num(x.volume)||0)*(num(x.price)||0)*1000,0), askVal=asks.reduce((a,x)=>a+(num(x.volume)||0)*(num(x.price)||0)*1000,0);
    const imb=bidVol+askVol?(bidVol-askVol)/(bidVol+askVol)*100:null;
    const head=card.querySelector('.flowHead'); if(head)head.innerHTML='<div><h3>買賣力資訊</h3><p>用買賣五檔張數與估算掛單金額呈現，不再使用會誤導的委託簿壓力圖。</p></div><span class="flowBadge">公開五檔 · 快照</span>';
    $('#flowStats')&&($('#flowStats').innerHTML=[
      miniSafe('委買五檔',lots(bidVol)),miniSafe('委賣五檔',lots(askVol)),miniSafe('買賣力差',imb==null?'—':`${imb>0?'+':''}${fmt(imb,0)}%`,cls(imb)),miniSafe('買方掛單金額',money(bidVal)),miniSafe('賣方掛單金額',money(askVal))
    ].join(''));
    const chart=$('#flowChart'); if(chart)chart.innerHTML=`<div class="v65PowerBook">${sideHtml('買五檔',bids,'bid')}${sideHtml('賣五檔',asks,'ask')}</div><div class="v65PowerSummary"><div><span>委買張數</span><b class="down">${lots(bidVol)}</b></div><div><span>委賣張數</span><b class="up">${lots(askVol)}</b></div><div><span>力道差</span><b class="${cls(imb)}">${imb==null?'—':(imb>0?'+':'')+fmt(imb,0)+'%'}</b></div></div>`;
    $('#flowNote')&&($('#flowNote').textContent='買賣力只描述公開五檔掛單，不能推論法人或主力，也不能視為實際成交資金流。');
  }
  function miniSafe(label,value,klass=''){
    if(typeof window.mini==='function')try{return window.mini(label,value,klass)}catch{}
    return `<div class="mini"><span>${E(label)}</span><b class="${klass}">${E(value)}</b></div>`;
  }
  function patchDepthAndFlow(){
    window.renderDepth=renderDepthV65;
    if(typeof window.refreshFlow==='function'&&!window.refreshFlow.__v65){
      const old=window.refreshFlow; const wrap=function(){try{old()}catch{};setTimeout(flowV65,20)}; wrap.__v65=true; window.refreshFlow=wrap;
    }
  }

  function patchLineChartNotice(){
    if(typeof window.renderLineChart==='function'&&!window.renderLineChart.__v65){
      const old=window.renderLineChart;
      const wrap=function(){old();setTimeout(()=>{
        const n=Number(($('#sampleCount')?.textContent||'').replace(/[^0-9]/g,''));
        const notice=$('#chartNotice');
        if((v65Market==='TW'||$('#assetPill')?.textContent!=='US Equity')&&(!Number.isFinite(n)||n<3)&&notice){
          notice.classList.remove('hidden');
          notice.innerHTML='當日分時目前只使用實際取得的公開快照，資料點不足時不補造走勢。建議按「技術 K」查看日K；若保持頁面開啟，盤中快照會逐步累積。';
        }
      },80)}; wrap.__v65=true; window.renderLineChart=wrap;
    }
  }
  function patchRenderMain(){
    if(typeof window.renderMain==='function'&&!window.renderMain.__v65){
      const old=window.renderMain;
      const wrap=function(d){v65LastData=d||null;v65Current=String(d?.snapshot?.code||'');v65Market=d?.snapshot?.market==='US'?'US':'TW';const r=old(d);setTimeout(()=>{installAvatarMotion();patchETF();renderDepthV65(d?.snapshot||{});flowV65();loadStockCostPanel();},280);return r};
      wrap.__v65=true; window.renderMain=wrap;
    }
  }

  function boot(){
    ensureDarkReadable();tuneHome();ensureHomeCosts();patchETF();patchDepthAndFlow();patchLineChartNotice();patchRenderMain();
    const cp=$('#v65HomeCosts'); if(cp&&!cp.dataset.v108Lazy){cp.dataset.v108Lazy='1'; if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();if(!costCache)loadHomeCosts(false)}},{rootMargin:'280px'});io.observe(cp)}else setTimeout(()=>{if(!costCache)loadHomeCosts(false)},1800);}
    setTimeout(()=>{tuneHome();installAvatarMotion();},600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('clarinavi:market-home',()=>setTimeout(()=>{tuneHome();ensureHomeCosts();},80));

})();

(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:null};
  const fmt=(v,d=2)=>{const x=num(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  let activeStockTab='data';

  function icon(name){
    const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"';
    const paths={market:'<path d="M3 17l5-6 4 3 5-8 4 3"/>',watch:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',portfolio:'<path d="M4 6h16v13H4z"/><path d="M8 6V4h8v2M4 11h16"/>',industry:'<path d="M4 19V9l5-3v13M9 19V5l5-2v16M14 19v-8l6-3v11"/><path d="M2 19h20"/>',more:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>'};
    return `<svg ${common}>${paths[name]||paths.more}</svg>`;
  }
  function navigate(screen){
    try{ if(typeof window.showScreen==='function') window.showScreen(screen); else showScreen(screen); }
    catch{ const sec=$('#screen-'+screen); if(sec){$$('.screen').forEach(s=>s.classList.toggle('active',s===sec)); window.scrollTo(0,0);} }
    setActiveNav(screen);
  }
  function setActiveNav(screen){
    const extras=new Set(['portfolio','calendar','ipo','institutional','alerts','news','kol']);
    $$('.bottomNav button,.desktopNav button').forEach(b=>{
      const s=b.dataset.screen,isBottom=!!b.closest('.bottomNav');
      b.classList.toggle('active',s===screen || (isBottom&&s==='more'&&extras.has(screen)));
    });
  }
  function openServiceDock(){
    navigate('market');
    requestAnimationFrame(()=>{
      const dock=$('#serviceDock');
      if(!dock)return;
      dock.scrollIntoView({behavior:'smooth',block:'center'});
      dock.classList.add('serviceDockPulse');
      setTimeout(()=>dock.classList.remove('serviceDockPulse'),900);
    });
  }
  function bindServiceDock(){
    const dock=$('#serviceDock');if(!dock||dock.dataset.bound==='1')return;dock.dataset.bound='1';
    $$('[data-service-screen]',dock).forEach(b=>b.onclick=()=>navigate(b.dataset.serviceScreen));
    $('[data-service-action="settings"]',dock)?.addEventListener('click',()=>$('#settingsBtn')?.click());
  }
  function patchBottomNav(){
    const nav=$('.bottomNav'); if(!nav||nav.dataset.v66Nav)return; nav.dataset.v66Nav='1'; nav.classList.add('v66BottomNav');
    nav.innerHTML=[
      ['market','行情','market'],['etf','ETF','market'],['rank','排行','market'],['watch','自選','watch'],['more','工具','more']
    ].map(([screen,label,ic])=>`<button type="button" data-screen="${screen}" class="${screen==='market'?'active':''}">${icon(ic)}${label}</button>`).join('');
    $$('button',nav).forEach(b=>b.onclick=()=>{if(b.dataset.screen==='more'){openServiceDock();setActiveNav('more');return;}navigate(b.dataset.screen)});
  }
  function patchDesktopNav(){
    const nav=$('.desktopNav'); if(!nav||nav.dataset.v66Desktop)return; nav.dataset.v66Desktop='1';
    nav.innerHTML=['market:行情','etf:ETF','rank:排行','watch:自選','industry:產業','radar:強勢雷達'].map(x=>{const [screen,label]=x.split(':');return `<button class="navBtn ${screen==='market'?'active':''}" data-screen="${screen}">${label}</button>`}).join('');
    $$('button',nav).forEach(b=>b.onclick=()=>navigate(b.dataset.screen));
  }
  function wrapShowScreen(){
    if(typeof window.showScreen==='function'&&!window.showScreen.__v66){
      const old=window.showScreen; const fn=function(id){const r=old(id);setTimeout(()=>setActiveNav(id),20);return r;}; fn.__v66=true; window.showScreen=fn;
    }
  }

  function makeQuickData(d){
    const s=d?.snapshot||{};
    const rows=[['開盤',fmt(s.open)],['最高',fmt(s.high)],['最低',fmt(s.low)],['成交量',num(s.volume)==null?'—':fmt(num(s.volume)/1000,0)+' 張'],['昨收',fmt(s.prevClose)],['均價/VWAP',fmt(s.avgPrice||s.vwap)],['更新',s.time||s.date||'—'],['資料',s.market==='US'?'美股 EOD / Key':'TWSE / TPEx']];
    let box=$('#v66QuickData');
    if(!box){box=document.createElement('div');box.id='v66QuickData';box.className='v66QuickData';$('.quoteStats')?.before(box);}
    box.innerHTML=rows.map(([a,b])=>`<div class="mini"><span>${E(a)}</span><b>${E(b)}</b></div>`).join('');
  }
  function ensureStockNav(){
    const result=$('#stockResult'), shell=$('#stockResult .stockShell'), quote=$('#stockResult .quoteCard'); if(!result||!shell||!quote)return;
    if($('#v66StockNav'))return;
    const nav=document.createElement('div'); nav.id='v66StockNav'; nav.className='v66StockNav';
    nav.innerHTML=`<button class="active" data-v66-stock-tab="data">數據</button><button data-v66-stock-tab="chart">圖表</button><button data-v66-stock-tab="chips">法人</button><button data-v66-stock-tab="fund">財務</button><button data-v66-stock-tab="news">新聞</button><button data-v66-stock-tab="more">更多</button>`;
    quote.after(nav);
    $$('button',nav).forEach(b=>b.onclick=()=>selectStockTab(b.dataset.v66StockTab,true));
  }
  function selectStockTab(tab,user=false){
    activeStockTab=tab||'data'; const result=$('#stockResult'); if(!result)return; result.dataset.v66Tab=activeStockTab;
    $$('#v66StockNav button').forEach(b=>b.classList.toggle('active',b.dataset.v66StockTab===activeStockTab));
    if(user){
      if(activeStockTab==='chips')try{switchSub('chips')}catch{}
      if(activeStockTab==='fund')try{switchSub('fund')}catch{}
      if(activeStockTab==='more'){
        try{switchSub('lab')}catch{}
        setTimeout(()=>{const dp=$('#deepPanel'); if(dp)dp.classList.remove('hidden');},20);
      }
      if(activeStockTab==='chart'){ setTimeout(()=>ensureDrawTools(),160); }
    }
    setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
  }
  function patchStockPage(d){ensureStockNav();makeQuickData(d);selectStockTab('data',false);}

  function regroupChartControls(){
    const card=$('.chartCard.modernChart'), row=$('.chartPeriodRow'); if(!card||!row||row.dataset.v66Grouped)return;
    row.dataset.v66Grouped='1';
    const intr=$('#intradayBar'), range=$('#rangeBar'), k56=$('#v56KBar'), kLegacy=$('#kFrameBar');
    const wrap=document.createElement('div'); wrap.className='v66ChartGroups';
    const g1=document.createElement('div'); g1.className='v66ControlGroup'; g1.dataset.group='intraday'; g1.innerHTML='<label>分時間隔</label>'; if(intr)g1.appendChild(intr);
    const g2=document.createElement('div'); g2.className='v66ControlGroup'; g2.dataset.group='range'; g2.innerHTML='<label>歷史區間</label>'; if(range)g2.appendChild(range);
    const g3=document.createElement('div'); g3.className='v66ControlGroup'; g3.dataset.group='k'; g3.innerHTML='<label>K棒類型</label>'; if(k56)g3.appendChild(k56); else if(kLegacy)g3.appendChild(kLegacy);
    wrap.append(g1,g2,g3); row.innerHTML=''; row.appendChild(wrap); if(kLegacy&&k56)kLegacy.classList.add('hidden');
    const hint=document.createElement('div');hint.id='v66DrawHint';hint.className='v66DrawHint';hint.textContent='繪圖工具：先選工具，再在圖上點選。趨勢線與斐波那契需要兩個點，水平線只需一個點。';$('#drawTools')?.after(hint);
    syncChartGroups();
  }
  function syncChartGroups(){
    const isTech=$('#techMode')?.classList.contains('active');
    const gIntr=$('[data-group="intraday"]'), gRange=$('[data-group="range"]'), gK=$('[data-group="k"]');
    if(gIntr)gIntr.classList.toggle('hidden',!!isTech);
    if(gRange)gRange.classList.toggle('hidden',!isTech);
    if(gK)gK.classList.toggle('hidden',!isTech);
  }
  function patchModeButtons(){
    ['lineMode','techMode'].forEach(id=>{const b=$('#'+id); if(!b||b.dataset.v66Mode)return; b.dataset.v66Mode='1'; b.addEventListener('click',()=>setTimeout(()=>{syncChartGroups();ensureDrawTools();},120),true);});
  }

  const draw={mode:'',pts:[],items:[]};
  function normPoint(evt,svg){const r=svg.getBoundingClientRect();return {x:(evt.clientX-r.left)/Math.max(1,r.width),y:(evt.clientY-r.top)/Math.max(1,r.height)};}
  function renderDraw(){
    const svg=$('#drawLayer'); if(!svg)return; const W=svg.clientWidth||900,H=svg.clientHeight||520; svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    let html='';
    for(const d of draw.items){
      if(d.type==='horizontal'){const y=d.p.y*H;html+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="drawStroke"/>`;}
      if(d.type==='trend'){html+=`<line x1="${d.a.x*W}" y1="${d.a.y*H}" x2="${d.b.x*W}" y2="${d.b.y*H}" class="drawStroke"/>`;}
      if(d.type==='fib'){const x1=Math.min(d.a.x,d.b.x)*W,x2=Math.max(d.a.x,d.b.x)*W,lo=Math.min(d.a.y,d.b.y)*H,hi=Math.max(d.a.y,d.b.y)*H;[0,.236,.382,.5,.618,1].forEach(q=>{const y=lo+(hi-lo)*q;html+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="drawFib"/><text x="${x1+5}" y="${y-4}" class="drawText">${q}</text>`;});}
    }
    if(draw.pts.length){const p=draw.pts[0];html+=`<circle cx="${p.x*W}" cy="${p.y*H}" r="4" class="drawStroke"/>`;}
    svg.innerHTML=html; svg.classList.toggle('drawing',!!draw.mode);
  }
  function setDrawMode(mode){
    if(mode==='clear'){draw.items=[];draw.pts=[];draw.mode='';renderDraw();syncDrawBtns();toastSafe('已清除繪圖');return;}
    draw.mode=draw.mode===mode?'':mode; draw.pts=[]; renderDraw(); syncDrawBtns();
    if(draw.mode) toastSafe(draw.mode==='horizontal'?'請在圖上點一下加入水平線':'請在圖上選兩個點');
  }
  function syncDrawBtns(){ $$('#drawTools button').forEach(b=>{const on=b.dataset.draw===draw.mode;b.classList.toggle('active',on);b.dataset.v66Active=on?'1':'0';}); }
  function ensureDrawTools(){
    const svg=$('#drawLayer'), tools=$('#drawTools'); if(!svg||!tools)return;
    if(!svg.dataset.v66Draw){
      svg.dataset.v66Draw='1';
      svg.addEventListener('pointerdown',e=>{
        if(!draw.mode)return; e.preventDefault(); e.stopPropagation();
        const p=normPoint(e,svg);
        if(draw.mode==='horizontal'){draw.items.push({type:'horizontal',p});draw.mode='';renderDraw();syncDrawBtns();toastSafe('水平線已加入');return;}
        draw.pts.push(p);
        if(draw.pts.length<2){renderDraw();toastSafe('已選第一點，請再點第二點');return;}
        draw.items.push({type:draw.mode,a:draw.pts[0],b:draw.pts[1]}); draw.pts=[]; draw.mode=''; renderDraw(); syncDrawBtns(); toastSafe('繪圖已加入');
      },true);
    }
    $$('#drawTools button').forEach(b=>{ if(b.dataset.v66Bind)return; b.dataset.v66Bind='1'; b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();setDrawMode(b.dataset.draw);},true); });
    renderDraw();
  }
  function toastSafe(s){try{if(typeof window.toast==='function')window.toast(s);else toast(s)}catch{console.log(s)}}

  function patchRenderMain(){
    if(typeof window.renderMain==='function'&&!window.renderMain.__v66){
      const old=window.renderMain; const fn=function(d){const r=old(d);setTimeout(()=>{patchStockPage(d);regroupChartControls();patchModeButtons();ensureDrawTools();},360);return r;}; fn.__v66=true; window.renderMain=fn;
    }
  }
  function boot(){
    document.body.dataset.theme=document.body.dataset.theme||'dark';
    patchBottomNav();patchDesktopNav();bindServiceDock();wrapShowScreen();patchRenderMain();
    setTimeout(()=>{regroupChartControls();patchModeButtons();ensureDrawTools();setActiveNav('market');},800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('resize',()=>setTimeout(renderDraw,120));
  setTimeout(()=>{patchBottomNav();patchDesktopNav();bindServiceDock();regroupChartControls();patchModeButtons();ensureDrawTools();},1800);
})();

/* Sector heatmap is live-only. Historical playback module intentionally removed. */
(()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const STORAGE='clarinavi-kol-embed-custom-v69';
  const presets=[
    {id:'musk-x',name:'Elon Musk',platform:'X',handle:'elonmusk',url:'https://x.com/elonmusk',embed:'x'},
    {id:'huang-nvidia',name:'Jensen Huang / NVIDIA',platform:'Official Newsroom',url:'https://blogs.nvidia.com/blog/author/jen-hsun-huang/',embed:'link'},
    {id:'trump-truth',name:'Donald Trump',platform:'Truth Social',handle:'realDonaldTrump',url:'https://truthsocial.com/@realDonaldTrump',embed:'truth'},
    {id:'banini-fb',name:'吃土鋁繩-巴逆逆',platform:'Facebook',handle:'diewithoutbang',url:'https://www.facebook.com/diewithoutbang',embed:'facebook'}
  ];
  function getCustom(){try{const a=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(a)?a.slice(0,8):[]}catch{return[]}}
  function setCustom(a){localStorage.setItem(STORAGE,JSON.stringify(a.slice(0,8)))}
  function normalize(platform,raw){const p=String(platform||'x').toLowerCase();let h=String(raw||'').trim().replace(/^@/,''); if(!h)return null;
    if(p==='x'&&!/^[A-Za-z0-9_]{1,15}$/.test(h))return null;
    if((p==='facebook'||p==='truth')&&!/^[A-Za-z0-9_.-]{1,80}$/.test(h))return null;
    const base=p==='x'?'https://x.com/':p==='facebook'?'https://www.facebook.com/':'https://truthsocial.com/@';
    return {id:`custom-${p}-${h.toLowerCase()}`,name:'@'+h,platform:p==='x'?'X':p==='facebook'?'Facebook':'Truth Social',handle:h,url:base+h,embed:p};
  }
  function loadXScript(){ if(window.twttr?.widgets){window.twttr.widgets.load();return;} if($('#x-wjs'))return; const s=document.createElement('script');s.id='x-wjs';s.async=true;s.charset='utf-8';s.src='https://platform.twitter.com/widgets.js';document.head.appendChild(s); }
  function loadFBScript(){ if($('#fb-root')){}else{const root=document.createElement('div');root.id='fb-root';document.body.appendChild(root);} if($('#facebook-jssdk'))return; const s=document.createElement('script');s.id='facebook-jssdk';s.async=true;s.defer=true;s.crossOrigin='anonymous';s.src='https://connect.facebook.net/zh_TW/sdk.js#xfbml=1&version=v22.0';document.body.appendChild(s); }
  function xCard(src){return `<div class="kolEmbedCard" data-kol-embed-card="${esc(src.id)}"><div class="kolEmbedCardHead"><b>${esc(src.name)}</b><span>${esc(src.platform)}</span></div><div class="kolEmbedFrame"><a class="twitter-timeline" data-height="520" data-theme="dark" data-chrome="nofooter noborders" href="${esc(src.url)}">${esc(src.name)} 的 X 最新貼文</a></div></div>`}
  function fbCard(src){const href=src.url;return `<div class="kolEmbedCard" data-kol-embed-card="${esc(src.id)}"><div class="kolEmbedCardHead"><b>${esc(src.name)}</b><span>Facebook 公開頁面</span></div><div class="kolEmbedFrame"><div class="fb-page" data-href="${esc(href)}" data-tabs="timeline" data-width="500" data-height="520" data-small-header="false" data-adapt-container-width="true" data-hide-cover="false" data-show-facepile="false"><blockquote cite="${esc(href)}" class="fb-xfbml-parse-ignore"><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(src.name)}</a></blockquote></div></div></div>`}
  function linkCard(src,msg){return `<div class="kolEmbedCard"><div class="kolEmbedCardHead"><b>${esc(src.name)}</b><span>${esc(src.platform)}</span></div><div class="kolEmbedFallback"><strong>此平台沒有穩定官方時間軸嵌入</strong><span>${esc(msg||'可前往官方公開頁查看最新內容。')}</span><a class="kolEmbedOpen" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">開啟原始公開頁</a></div></div>`}
  function render(mode='embed'){
    const host=$('#kolEmbedHost'); if(!host)return;
    const sources=[...presets,...getCustom()];
    const cards=sources.map(src=>{
      if(mode==='links')return linkCard(src,'以原始入口模式顯示，避免第三方嵌入被瀏覽器或平台擋下。');
      if(src.embed==='x')return xCard(src);
      if(src.embed==='facebook')return fbCard(src);
      if(src.embed==='truth')return linkCard(src,'Truth Social 目前官方公開的 publisher 工具偏向分享按鈕，未提供像 X timeline 這種穩定帳號時間軸嵌入；仍保留原始公開頁入口與原本後端公開介面讀取。');
      return linkCard(src,'此來源以官方網站或新聞室為主，保留原文入口，不偽裝成社群貼文。');
    }).join('');
    host.innerHTML=`<div class="kolEmbedGrid">${cards}</div>`;
    if(mode==='embed'){loadXScript();loadFBScript();setTimeout(()=>{try{window.twttr?.widgets?.load(host);window.FB?.XFBML?.parse(host)}catch{}},700)}
  }
  function inject(){
    const screen=$('#screen-kol'); if(!screen||$('#v69KolEmbedPanel'))return;
    const panel=document.createElement('div'); panel.id='v69KolEmbedPanel'; panel.className='kolEmbedPanel';
    panel.innerHTML=`<div class="kolEmbedHead"><div><h3>官方嵌入貼文牆</h3><p>用平台官方嵌入元件顯示公開帳號內容；不寫爬蟲、不繞過登入，也不把第三方內容複製進資料庫。</p></div><div class="kolEmbedToggle"><button type="button" class="active" data-kol-embed-mode="embed">官方嵌入</button><button type="button" data-kol-embed-mode="links">原始入口</button></div></div><div id="kolEmbedHost"><div class="skeleton" style="height:220px"></div></div><form id="kolEmbedForm" class="kolEmbedForm"><select id="kolEmbedPlatform" aria-label="平台"><option value="x">X</option><option value="facebook">Facebook</option><option value="truth">Truth Social</option></select><input id="kolEmbedHandle" placeholder="輸入公開帳號，例如 satyanadella" autocomplete="off"><button type="submit">加入嵌入</button></form><div id="kolEmbedStatus" class="kolEmbedStatus"></div><p class="kolEmbedNote">公開帳號不代表一定允許被任何網站完整抓取。X timeline 與 Facebook Page 使用官方嵌入元件；Truth Social 目前保留原始公開頁與後端公開介面讀取。若瀏覽器阻擋第三方 Cookie 或平台限制地區，嵌入可能只顯示登入或入口。</p>`;
    const feed=$('#kolFeed',screen); (feed?.parentNode||screen).insertBefore(panel,feed||null);
    $$('[data-kol-embed-mode]',panel).forEach(btn=>btn.addEventListener('click',()=>{$$('[data-kol-embed-mode]',panel).forEach(b=>b.classList.toggle('active',b===btn));render(btn.dataset.kolEmbedMode)}));
    $('#kolEmbedForm',panel).addEventListener('submit',e=>{e.preventDefault();const src=normalize($('#kolEmbedPlatform',panel).value,$('#kolEmbedHandle',panel).value);const status=$('#kolEmbedStatus',panel);if(!src){status.textContent='帳號格式不正確，請只輸入帳號名稱，不要貼整段網址。';return;}const a=getCustom();if(!a.some(x=>x.id===src.id)){a.push(src);setCustom(a)}$('#kolEmbedHandle',panel).value='';status.textContent=`已加入 ${src.name}，設定只保存在此瀏覽器。`;render($('.kolEmbedToggle .active',panel)?.dataset.kolEmbedMode||'embed')});
    render('embed');
  }
  const old=window.loadKolFeed;
  window.loadKolFeed=function(force){const ret=typeof old==='function'?old(force):undefined;setTimeout(inject,150);return ret};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else setTimeout(inject,100);
})();

(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[，。,.、：:；;！!？?]/g,'').trim();
  const KEY='clarinavi-v81-stock-dict';
  const COMMON={
    '台積電':'2330','台積':'2330','tsmc':'2330','鴻海':'2317','富士康':'2317','聯發科':'2454','發哥':'2454','台達電':'2308','台達':'2308','廣達':'2382','緯創':'3231','緯穎':'6669','技嘉':'2376','華碩':'2357','宏碁':'2353','仁寶':'2324','英業達':'2356','和碩':'4938','大立光':'3008','聯電':'2303','日月光':'3711','日月光投控':'3711','聯詠':'3034','瑞昱':'2379','創意':'3443','世芯':'3661','矽力':'6415','南亞科':'2408','南亞科技':'2408','華邦電':'2344','群聯':'8299','力積電':'6770','國巨':'2327','台光電':'2383','金像電':'2368','欣興':'3037','景碩':'3189','南電':'8046','臻鼎':'4958','嘉澤':'3533','信驊':'5274','台泥':'1101','亞泥':'1102','中鋼':'2002','台塑':'1301','南亞':'1303','長榮':'2603','陽明':'2609','萬海':'2615','中華電':'2412','遠傳':'4904','台灣大':'3045','中信金':'2891','富邦金':'2881','國泰金':'2882','玉山金':'2884','兆豐金':'2886','第一金':'2892','合庫金':'5880','元大金':'2885','永豐金':'2890','台新金':'2887','上海商銀':'5876','0050':'0050','元大台灣五十':'0050','元大台灣50':'0050','台灣五十':'0050','台灣50':'0050','0056':'0056','元大高股息':'0056','00878':'00878','國泰永續高股息':'00878','00919':'00919','群益台灣精選高息':'00919','006208':'006208','富邦台五十':'006208','富邦台50':'006208','00929':'00929','復華台灣科技優息':'00929'
  };
  let dict=null,dictLoading=null,pendingSpeak=false,lastMatch=null;
  function SpeechRecognition(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function toast(msg){try{if(typeof window.toast==='function')return window.toast(msg)}catch{} const st=$('#status'); if(st)st.textContent=msg;}
  function currentMarket(){return $('.marketBtn.active')?.dataset.market||'TW'}
  async function loadDict(){
    if(dict)return dict;
    try{const cached=JSON.parse(localStorage.getItem(KEY)||'null');if(cached&&Date.now()-cached.ts<86400000&&Array.isArray(cached.items)){dict=cached.items;return dict;}}catch{}
    if(dictLoading)return dictLoading;
    dictLoading=(async()=>{
      let items=Object.entries(COMMON).map(([name,code])=>({name,code,market:'TW',n:norm(name)}));
      try{
        const [tw,us]=await Promise.allSettled([fetch('/api/industry?market=TW').then(r=>r.json()),fetch('/api/industry?market=US').then(r=>r.json())]);
        for(const pack of [tw,us])if(pack.status==='fulfilled'){
          for(const x of (pack.value.items||[])){
            if(!x.code||!x.name)continue;
            items.push({code:String(x.code).toUpperCase(),name:String(x.name),market:x.market||pack.value.market||'TW',n:norm(String(x.name))});
          }
        }
      }catch{}
      const seen=new Set();
      items=items.filter(x=>{const k=x.market+'|'+x.code+'|'+x.n;if(seen.has(k))return false;seen.add(k);return true});
      dict=items;
      try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),items:items.slice(0,6500)}))}catch{}
      return dict;
    })();
    return dictLoading;
  }
  function parseSpoken(raw,items){
    const text=String(raw||'').trim();
    const compact=norm(text).replace(/[零〇]/g,'0').replace(/一/g,'1').replace(/二/g,'2').replace(/三/g,'3').replace(/四/g,'4').replace(/五/g,'5').replace(/六/g,'6').replace(/七/g,'7').replace(/八/g,'8').replace(/九/g,'9');
    const numeric=(text.match(/\b\d{4,6}\b/)||compact.match(/\d{4,6}/)||[])[0];
    if(numeric)return {code:numeric,market:'TW',name:numeric,confidence:1,raw:text,why:'辨識到股票代號'};
    const letters=(text.toUpperCase().match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/)||[])[0];
    if(letters)return {code:letters,market:'US',name:letters,confidence:.9,raw:text,why:'辨識到美股代號'};
    const q=compact;
    if(!q)return null;
    const commonCode=COMMON[q]||COMMON[text]||COMMON[text.replace(/股票|股價|查詢|請幫我查|我要查/g,'')];
    if(commonCode)return {code:commonCode,market:'TW',name:text,confidence:.96,raw:text,why:'常用名稱對照'};
    let best=null;
    for(const x of items||[]){
      const n=x.n||norm(x.name), c=String(x.code||'').toLowerCase();
      let score=0;
      if(n===q)score=100;
      else if(q.includes(n)&&n.length>=2)score=86+n.length;
      else if(n.includes(q)&&q.length>=2)score=76+q.length;
      else if(c===q)score=95;
      if(score&&( !best||score>best.score))best={...x,score};
    }
    return best?{code:best.code,market:best.market||'TW',name:best.name,confidence:best.score/100,raw:text,why:'依公司名稱比對'}:null;
  }
  function openAndSpeak(match){
    if(!match?.code)return;
    pendingSpeak=true; lastMatch=match;
    try{if(typeof window.openSymbol==='function')window.openSymbol(match.market||'TW',match.code);else{const q=$('#q'); if(q)q.value=match.code; $('#go')?.click();}}
    catch{const q=$('#q'); if(q)q.value=match.code; $('#go')?.click();}
    toast(`語音查詢：${match.name||match.code}，正在開啟個股頁並準備播報。`);
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const btn=$('#stockSpeakBtn'), result=$('#stockResult');
      const hasStock=result&&!result.classList.contains('hidden');
      if(btn&&hasStock){clearInterval(timer);setTimeout(()=>{try{btn.click()}catch{} pendingSpeak=false;},550)}
      if(tries>24){clearInterval(timer);pendingSpeak=false;}
    },400);
  }
  function panel(){
    let p=$('#voiceQueryPanel'); if(p)return p;
    p=document.createElement('div');p.id='voiceQueryPanel';p.className='voiceQueryPanel';p.innerHTML=`<div class="voiceQueryCard" role="dialog" aria-modal="true" aria-labelledby="voiceQueryTitle"><div class="voiceQueryTop"><div class="voiceOrb" aria-hidden="true"></div><div><h3 class="voiceQueryTitle" id="voiceQueryTitle">語音查詢股票</h3><p class="voiceQueryText">按開始後，直接說「台積電」、「台達電」或「二三三零」。查到後會自動進入個股頁並播放 Lumi 解讀。</p></div></div><div class="voiceQueryResult" id="voiceQueryResult" aria-live="polite">等待開始辨識。</div><div class="voiceFallbackRow"><input id="voiceFallbackInput" placeholder="也可手動輸入股號或股名"><button type="button" id="voiceFallbackGo">查詢</button></div><div class="voiceQueryActions"><button type="button" class="primary" id="voiceStartBtn">開始說話</button><button type="button" id="voiceCloseBtn">關閉</button></div></div>`;
    document.body.appendChild(p);
    $('#voiceCloseBtn',p).addEventListener('click',()=>p.classList.remove('show','listening','fallback'));
    $('#voiceFallbackGo',p).addEventListener('click',async()=>{const items=await loadDict();const m=parseSpoken($('#voiceFallbackInput',p).value,items); if(m){$('#voiceQueryResult',p).innerHTML=`已找到 <b>${esc(m.name)}</b> ${esc(m.code)}，即將開啟。`;setTimeout(()=>{p.classList.remove('show','listening','fallback');openAndSpeak(m)},250)}else $('#voiceQueryResult',p).textContent='找不到這個名稱，請改說股票代號或更完整的公司名稱。'});
    $('#voiceStartBtn',p).addEventListener('click',startListen);
    p.addEventListener('click',e=>{if(e.target===p)p.classList.remove('show','listening','fallback')});
    return p;
  }
  async function startListen(){
    const p=panel(),out=$('#voiceQueryResult',p),btn=$('#voiceStartBtn',p),Rec=SpeechRecognition();
    if(!Rec){p.classList.add('fallback');out.textContent='這個瀏覽器不支援語音辨識，請改用下方輸入框。';$('#voiceFallbackInput',p)?.focus();return;}
    await loadDict();
    const rec=new Rec(); rec.lang='zh-TW'; rec.interimResults=false; rec.maxAlternatives=4; rec.continuous=false;
    p.classList.add('listening'); btn.textContent='聆聽中…'; out.textContent='請說股票名稱或股號，例如「台積電」或「二三三零」。';
    rec.onresult=e=>{
      const phrases=[]; for(const res of e.results)for(const alt of res)phrases.push(alt.transcript);
      let match=null; for(const s of phrases){match=parseSpoken(s,dict); if(match)break;}
      p.classList.remove('listening'); btn.textContent='再說一次';
      if(match){out.innerHTML=`聽到「${esc(match.raw)}」，已找到 <b>${esc(match.name)}</b> ${esc(match.code)}。`;setTimeout(()=>{p.classList.remove('show','fallback');openAndSpeak(match)},450)}
      else{p.classList.add('fallback');out.innerHTML=`聽到「${esc(phrases[0]||'') }」，但找不到標的。請再說一次，或改用下方輸入。`;}
    };
    rec.onerror=e=>{p.classList.remove('listening');p.classList.add('fallback');btn.textContent='再說一次';out.textContent=e.error==='not-allowed'?'麥克風權限未開啟，請允許瀏覽器使用麥克風，或改用下方輸入。':'語音辨識暫時無法使用，請再試一次或改用下方輸入。'};
    rec.onend=()=>{p.classList.remove('listening');btn.textContent='開始說話'};
    try{rec.start()}catch{p.classList.add('fallback');out.textContent='語音辨識尚未準備好，請稍後再試或改用下方輸入。'}
  }
  function showPanel(){const p=panel();p.classList.add('show');p.classList.remove('fallback');$('#voiceQueryResult',p).textContent='按「開始說話」後，直接說股號或股名。';setTimeout(()=>$('#voiceStartBtn',p)?.focus(),30)}
  function inject(){
    if($('#voiceQueryBtn'))return;
    const row=$('.searchRow'); if(!row)return;
    const btn=document.createElement('button');btn.type='button';btn.id='voiceQueryBtn';btn.className='voiceQueryBtn';btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg><span class="voiceLabel">詢問</span>';btn.title='語音查詢股票';btn.setAttribute('aria-label','語音查詢股票');btn.addEventListener('click',showPanel);row.appendChild(btn);
  }
  const oldOpen=window.openSymbol;
  if(typeof oldOpen==='function')window.openSymbol=function(m,c){const r=oldOpen.apply(this,arguments); if(pendingSpeak&&lastMatch&&String(c).toUpperCase()===String(lastMatch.code).toUpperCase()){setTimeout(()=>$('#stockSpeakBtn')?.click(),1400)} return r;};
  function boot(){inject();loadDict().catch(()=>{});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

;(()=>{
  'use strict';
  const STORE='clarinavi-ai-settings-v82';
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const defaults={enabled:false,provider:'openai-compatible',endpoint:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini',apiKey:'',temperature:0.25};
  const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{return {...defaults}}};
  const save=x=>localStorage.setItem(STORE,JSON.stringify({...load(),...x}));
  const enabled=()=>!!load().enabled&&!!load().apiKey&&!!load().endpoint&&!!load().model;
  function text(el){return el?String(el.textContent||'').replace(/\s+/g,' ').trim():''}
  function stockContext(){
    const lines=[];
    const name=text($('#stockName')), meta=text($('#stockMeta')), price=text($('#price')), chg=text($('#chg'));
    if(name)lines.push(`標的：${name}`); if(meta)lines.push(`資料：${meta}`); if(price)lines.push(`現價：${price} ${chg}`);
    const stats=$$('#quoteStats .stat').map(x=>text(x)).filter(Boolean).join('；'); if(stats)lines.push(`行情數據：${stats}`);
    const advice=text($('#researchAdviceText')); if(advice)lines.push(`研究摘要：${advice}`);
    const tech=$$('#indicatorStrip .indicator').slice(0,18).map(x=>text(x)).filter(Boolean).join('；'); if(tech)lines.push(`技術指標：${tech}`);
    const costs=text($('#foreignCostPanel'))||text($('#foreignCostHome')); if(costs)lines.push(`外資歷史估算成本：${costs}`);
    const news=$$('#newsPreview .newsItem,#newsList .newsItem').slice(0,8).map(x=>text(x)).filter(Boolean).join('｜'); if(news)lines.push(`近期新聞：${news}`);
    return lines.join('\n').slice(0,8000);
  }
  function marketContext(){
    const lines=[];
    ['#globalPairs','#todayFocus','#sectorHeatmap','#contribList','#marketBroadcastText','#globalSource'].forEach(sel=>{const t=text($(sel));if(t)lines.push(t)});
    return lines.join('\n').slice(0,8000);
  }
  function ensureSettings(){
    const sheet=$('#settingsSheet'); if(!sheet||$('#aiSettingsBox'))return;
    const box=document.createElement('div'); box.className='aiSettingsBox'; box.id='aiSettingsBox';
    box.innerHTML=`<div class="aiToggleRow"><label for="aiEnable">進階 AI 對話</label><input class="aiCheck" id="aiEnable" type="checkbox"></div><p class="aiConfigHelp">預設關閉。啟用後，個股頁與大盤頁會出現 AI 對話。API Key 只存在此瀏覽器，送出問題時才隨請求傳送，不寫入資料庫。</p><div class="aiSettingsGrid"><div class="field"><label>AI 供應商</label><select id="aiProvider"><option value="openai-compatible">OpenAI 相容 API</option><option value="openrouter">OpenRouter / 相容聚合</option><option value="custom">自訂相容端點</option></select></div><div class="field"><label>模型名稱</label><input id="aiModel" placeholder="例如 gpt-4o-mini / claude / llama"></div><div class="field"><label>Chat Completions Endpoint</label><input id="aiEndpoint" placeholder="https://api.openai.com/v1/chat/completions"></div><div class="field"><label>你的 AI API Key</label><input id="aiKey" type="password" autocomplete="off" placeholder="貼上你自己訂閱的 Key"></div></div><div class="aiActions"><button class="primary" id="aiSave" type="button">儲存 AI 設定</button><button id="aiClear" type="button">清除 AI 設定</button><button id="aiTest" type="button">測試連線</button></div><p class="aiConfigHelp">僅支援 Chat Completions 相容格式。AI 回覆只供教學研究，不構成投資建議。</p>`;
    const tour=$('#tourReplay')?.closest('.field');
    if(tour) sheet.insertBefore(box,tour); else sheet.appendChild(box);
    function hydrate(){const s=load(); $('#aiEnable').checked=!!s.enabled; $('#aiProvider').value=s.provider||defaults.provider; $('#aiModel').value=s.model||''; $('#aiEndpoint').value=s.endpoint||''; $('#aiKey').value=s.apiKey||'';}
    hydrate();
    $('#aiProvider').addEventListener('change',e=>{const v=e.target.value; if(v==='openai-compatible'&&!$('#aiEndpoint').value)$('#aiEndpoint').value=defaults.endpoint;});
    $('#aiSave').addEventListener('click',()=>{save({enabled:$('#aiEnable').checked,provider:$('#aiProvider').value,model:$('#aiModel').value.trim()||defaults.model,endpoint:$('#aiEndpoint').value.trim()||defaults.endpoint,apiKey:$('#aiKey').value.trim()}); updatePanels(); toastSafe('AI 對話設定已儲存');});
    $('#aiClear').addEventListener('click',()=>{localStorage.removeItem(STORE); hydrate(); updatePanels(); toastSafe('已清除 AI 設定');});
    $('#aiTest').addEventListener('click',()=>askAI('market','請用一句話回覆：AI 連線測試成功。',true));
    document.addEventListener('click',e=>{ if(e.target&&e.target.id==='settingsBtn') setTimeout(hydrate,30); },true);
  }
  function toastSafe(s){try{if(typeof toast==='function')toast(s);else alert(s)}catch{alert(s)}}
  function panelHTML(kind){
    const isStock=kind==='stock';
    return `<section class="aiPanel aiDisabled" id="${kind}AiPanel"><div class="aiHead"><div><div class="aiTitle">AI 研究對話</div><div class="aiSub">${isStock?'針對目前個股的行情、技術、法人與新聞資料提問。':'針對目前大盤總覽、產業與權重股資料提問。'}</div></div><span class="aiBadge">進階功能</span></div><div class="aiMessages" id="${kind}AiMessages"><div class="aiMsg system">請先到右上角「設定」啟用自己的 AI。啟用後這裡會變成對話區。</div></div><div class="aiQuick"><button type="button" data-aiq="${isStock?'用三點整理這檔股票目前的重點。':'用三點整理目前市場重點。'}">重點整理</button><button type="button" data-aiq="${isStock?'目前有哪些風險需要留意？':'目前大盤有哪些風險需要留意？'}">風險提醒</button><button type="button" data-aiq="${isStock?'用新手聽得懂的方式解釋目前技術訊號。':'用新手聽得懂的方式解釋目前盤勢。'}">新手解釋</button></div><div class="aiAskRow"><textarea class="aiInput" id="${kind}AiInput" rows="1" placeholder="輸入想問 AI 的問題…"></textarea><button class="aiSend" type="button" id="${kind}AiSend">送出</button></div><div class="aiHint">AI 只會讀取本頁已顯示的摘要資料；交易前仍請以交易所、公司公告與券商資訊為準。</div></section>`;
  }
  function ensurePanels(){
    const mh=$('#marketHome');
    if(!enabled())$('#marketAiPanel')?.remove();
    if(mh&&enabled()&&!$('#marketAiPanel')){ const wrap=document.createElement('div'); wrap.innerHTML=panelHTML('market'); const node=wrap.firstElementChild; const after=$('#marketBroadcast'); after?after.insertAdjacentElement('afterend',node):mh.prepend(node); }
    const sr=$('#stockResult');
    if(sr&&!$('#stockAiPanel')){ const wrap=document.createElement('div'); wrap.innerHTML=panelHTML('stock'); const node=wrap.firstElementChild; const b=$('#stockBroadcast'); b?b.insertAdjacentElement('afterend',node):sr.prepend(node); }
    ['market','stock'].forEach(k=>{
      const send=$(`#${k}AiSend`); if(send&&!send.__ai){ send.__ai=true; send.addEventListener('click',()=>{const i=$(`#${k}AiInput`); const q=String(i.value||'').trim(); if(q){i.value=''; askAI(k,q);}}); }
      const inp=$(`#${k}AiInput`); if(inp&&!inp.__ai){ inp.__ai=true; inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); $(`#${k}AiSend`)?.click();}}); }
    });
    $$('.aiQuick button').forEach(b=>{ if(b.__ai)return; b.__ai=true; b.addEventListener('click',()=>askAI(b.closest('.aiPanel')?.id?.startsWith('stock')?'stock':'market',b.dataset.aiq||b.textContent)); });
    updatePanels();
  }
  function updatePanels(){
    const ok=enabled();
    ['market','stock'].forEach(k=>{const p=$(`#${k}AiPanel`); if(!p)return; p.classList.toggle('aiDisabled',!ok); const m=$(`#${k}AiMessages`); if(ok&&m&&m.children.length===1&&m.textContent.includes('請先'))m.innerHTML='<div class="aiMsg system">AI 已啟用。可以詢問本頁資料重點、風險與教學解釋。</div>';});
  }
  function addMsg(kind,who,txt){const box=$(`#${kind}AiMessages`); if(!box)return; const div=document.createElement('div'); div.className=`aiMsg ${who}`; div.textContent=txt; box.appendChild(div); box.scrollTop=box.scrollHeight; return div;}
  async function askAI(kind,question,silent){
    const s=load(); if(!enabled()){toastSafe('請先到設定啟用進階 AI'); ensureSettings(); try{openSheet('settingsSheet')}catch{} return;}
    if(!silent)addMsg(kind,'user',question);
    const wait=addMsg(kind,'assistant','AI 思考中…');
    try{
      const r=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:s.provider,endpoint:s.endpoint,model:s.model,apiKey:s.apiKey,temperature:s.temperature,question,page:kind==='stock'?'個股頁':'大盤頁',context:kind==='stock'?stockContext():marketContext()})});
      const j=await r.json().catch(()=>({})); if(!r.ok||!j.ok)throw new Error(j.error||'AI 回應失敗');
      wait.textContent=j.answer||'AI 沒有回傳內容。';
    }catch(e){wait.textContent='AI 無法回覆：'+(e.message||'連線失敗')+'\n請確認 API Key、模型名稱與 Endpoint 是否正確。';}
  }
  window.ClariNaviAI={ask:askAI,settings:load};
  const oldRender=typeof window.renderMain==='function'?window.renderMain:null;
  if(oldRender&&!oldRender.__ai82){window.renderMain=function(d){const r=oldRender(d); setTimeout(()=>{ensurePanels();updatePanels();},80); return r}; window.renderMain.__ai82=true;}
  const oldShow=typeof window.showScreen==='function'?window.showScreen:null;
  if(oldShow&&!oldShow.__ai82){window.showScreen=function(id){const r=oldShow(id); setTimeout(()=>{ensurePanels();updatePanels();},80); return r}; window.showScreen.__ai82=true;}
  ensureSettings(); ensurePanels();
})();

(function(){
  function clean(){document.querySelectorAll('.v83MouthDeck,.v58Mouth,.v61Mouth,.v65Aura,.v65Blink,.v65MouthDeck,.v65VoiceWave').forEach(x=>x.remove());document.querySelectorAll('.broadcastCard').forEach(c=>c.classList.remove('v83Talking','v65Talking','v61Talking','speaking'));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();
})();

/* Unified product behavior */
(()=>{
  'use strict';
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,'').replace(/[%＋]/g,'').trim());return Number.isFinite(x)?x:null};
  const number=(v,d=2)=>{const x=num(v);return x==null?'—':x.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const signed=v=>{const x=num(v);return x==null?'—':`${x>0?'+':''}${Math.abs(x)>=100?x.toFixed(0):x.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')}`};
  const colorClass=v=>{const x=num(v);return x>0?'up':x<0?'down':'muted'};
  const state={market:null,costHomeLoaded:false,costHomeLoadedAt:0,costStockCode:'',voiceDict:null};
  const COST_CACHE_KEY='clarinavi-home-costs-last-good-v13';
  function readCostCache(){try{return JSON.parse(localStorage.getItem(COST_CACHE_KEY)||'null')}catch{return null}}
  function saveCostCache(j){try{localStorage.setItem(COST_CACHE_KEY,JSON.stringify({...j,_savedAt:Date.now()}))}catch{}}

  function clearLegacyCaches(){
    if(localStorage.getItem('clarinavi-current-clean')==='1')return;
    localStorage.setItem('clarinavi-current-clean','1');
    try{navigator.serviceWorker?.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{})}catch{}
    try{caches?.keys?.().then(keys=>keys.filter(k=>/clarinavi/i.test(k)).forEach(k=>caches.delete(k))).catch(()=>{})}catch{}
  }

  function removeFontControls(){
    document.body.dataset.fontScale='standard';
    ['clarinavi-font-scale','clarinavi-v8-font','clarinavi-ui-scale-v68'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
    qa('#v8DisplayBtn,#v8DisplayPanel,#v68TextBtn,#v68A11y,#v108FontField,.v68TextButton,[data-v8-font],[data-v68-scale],[data-v108-font]').forEach(el=>el.remove());
  }

  function buildAvatar(box){
    if(!box)return;
    if(q('.avatarStage',box))return;
    box.innerHTML='<div class="avatarStage" data-avatar-mode="full-frame-sequence"><img class="avatarFrame" src="/avatar-frame-1.webp" alt="ClariNavi 市場助理"></div>';
  }
  function ensureAvatars(){qa('.broadcastAvatar').forEach(buildAvatar)}
  const AVATAR_FRAMES=['/avatar-frame-1.webp','/avatar-frame-2.webp','/avatar-frame-3.webp','/avatar-frame-4.webp','/avatar-frame-5.webp','/avatar-frame-6.webp'];
  const AVATAR_SEQ=[0,1,2,3,4,3,2,1],avatarTimers=new WeakMap();
  AVATAR_FRAMES.forEach(src=>{const im=new Image();im.src=src});
  function syncAvatarFrames(card){
    const img=q('.avatarFrame',card);if(!img)return;
    const running=card.classList.contains('speaking')&&!card.classList.contains('speechPaused');
    const old=avatarTimers.get(card);if(old){clearInterval(old);avatarTimers.delete(card)}
    if(!running){if(!card.classList.contains('speechPaused'))img.src=AVATAR_FRAMES[0];return}
    let i=0;img.src=AVATAR_FRAMES[AVATAR_SEQ[i]];
    const timer=setInterval(()=>{i=(i+1)%AVATAR_SEQ.length;img.src=AVATAR_FRAMES[AVATAR_SEQ[i]]},135);
    avatarTimers.set(card,timer);
  }
  function watchAvatar(card){
    if(!card||card.dataset.avatarWatch==='1')return;
    card.dataset.avatarWatch='1';buildAvatar(q('.broadcastAvatar',card));syncAvatarFrames(card);
    new MutationObserver(()=>{buildAvatar(q('.broadcastAvatar',card));syncAvatarFrames(card)}).observe(card,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }
  function initAvatars(){ensureAvatars();qa('.broadcastCard').forEach(watchAvatar)}

  function cnDigits(s){
    const map={'零':'0','〇':'0','一':'1','二':'2','兩':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'};
    return String(s||'').split('').map(c=>map[c]??c).join('');
  }
  async function loadVoiceDict(){
    if(state.voiceDict)return state.voiceDict;
    const map=new Map([
      ['台積電','2330'],['台灣積體電路','2330'],['聯發科','2454'],['台達電','2308'],['鴻海','2317'],['廣達','2382'],['緯創','3231'],['世芯','3661'],['元大台灣50','0050'],['富邦台50','006208'],
      ['nvidia','NVDA'],['輝達','NVDA'],['apple','AAPL'],['蘋果','AAPL'],['microsoft','MSFT'],['微軟','MSFT'],['tesla','TSLA'],['特斯拉','TSLA'],['amd','AMD']
    ]);
    try{
      const j=await fetch('/api/industry?market=TW',{cache:'default'}).then(r=>r.json());
      const rows=j?.items||j?.stocks||j?.data||[];
      for(const r of rows){const code=String(r.code||r.symbol||'').trim(),name=String(r.name||r.company||'').trim();if(code&&name)map.set(name.toLowerCase(),code)}
    }catch{}
    state.voiceDict=map;return map;
  }
  function resolveVoiceText(raw,dict){
    let t=cnDigits(String(raw||'').trim()).replace(/[，。！？、\s]+/g,' ');
    let targetMarket=/美股|美國/.test(t)?'US':/台股|臺股/.test(t)?'TW':null;
    t=t.replace(/(幫我|請|查詢|查|搜尋|看一下|股票|股價|台股|臺股|美股|美國)/g,'').trim();
    const direct=t.match(/\b[A-Za-z]{1,6}\b|\b\d{4,6}\b/); if(direct)return{market:targetMarket,code:direct[0].toUpperCase()};
    const low=t.toLowerCase();
    for(const [name,code] of dict.entries())if(low.includes(name.toLowerCase()))return{market:targetMarket||(/[A-Z]/.test(code)?'US':'TW'),code};
    return{market:targetMarket,code:t.toUpperCase()};
  }
  function injectVoiceSearch(){
    // Keep exactly one search voice trigger. Market/stock playback buttons are separate actions.
    qa('#voiceSearchBtn,.legacyVoiceBtn,[data-voice-search]').forEach(el=>el.remove());
    const seen=new Set();qa('#voiceQueryBtn').forEach((el,i)=>{if(i>0)el.remove();else seen.add(el)});
  }

  function modal(html,id='appModal'){
    q('#'+id)?.remove();
    const back=document.createElement('div');back.className='appModalBackdrop';back.id=id;
    back.innerHTML=`<div class="appModal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);document.body.classList.add('modal-open');
    const close=()=>{back.remove();if(!q('.appModalBackdrop'))document.body.classList.remove('modal-open')};
    back.addEventListener('click',e=>{if(e.target===back||e.target.closest('[data-modal-close]'))close()});
    const escKey=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',escKey)}};document.addEventListener('keydown',escKey);
    return{back,close};
  }

  const DEFAULT_MARKETS=['TAIEX','TX','SPX','NDX'];
  const FALLBACK_MARKETS=[
    {key:'TAIEX',name:'台灣加權指數',kind:'index',market:'TW'},{key:'TX',name:'台指期近月',kind:'future',market:'TW'},
    {key:'SPX',name:'S&P 500',kind:'index',market:'US'},{key:'NDX',name:'Nasdaq 100',kind:'index',market:'US'},
    {key:'DJI',name:'Dow Jones',kind:'index',market:'US'},{key:'SOX',name:'費半指數',kind:'index',market:'US'},
    {key:'N225',name:'日經 225',kind:'index',market:'JP'},{key:'HSI',name:'恒生指數',kind:'index',market:'HK'}
  ];
  function marketKeys(){try{const a=JSON.parse(localStorage.getItem('clarinavi-markets')||'null');if(Array.isArray(a)&&a.length)return a.slice(0,8)}catch{}return DEFAULT_MARKETS}
  function spark(series,positive=true,big=false){
    const rows=(series||[]).filter(x=>num(x.close)!=null).slice(big?-90:-60);if(rows.length<2)return '<div class="empty">線圖等待資料</div>';
    const W=big?900:300,H=big?270:64,P=5,vals=rows.map(x=>num(x.close)),lo=Math.min(...vals),hi=Math.max(...vals),sp=Math.max(1e-9,hi-lo);
    const pts=vals.map((v,i)=>`${P+(W-P*2)*i/(vals.length-1)},${H-P-(H-P*2)*(v-lo)/sp}`).join(' ');
    return `<svg class="market-spark ${positive?'up':'down'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`
  }
  function marketChart(c,positive=true,big=false){
    const useIntraday=Array.isArray(c?.intraday)&&c.intraday.filter(x=>num(x.close)!=null).length>=2;
    const rows=(useIntraday?c.intraday:c?.series||[]).filter(x=>num(x.close)!=null).slice(big?-120:-70);
    if(rows.length<2)return '<div class="empty">線圖等待資料</div>';
    const W=big?900:300,H=big?300:76,P=5,volH=useIntraday?(big?62:20):0,priceH=H-volH-(useIntraday?4:0),vals=rows.map(x=>num(x.close)),lo=Math.min(...vals),hi=Math.max(...vals),sp=Math.max(1e-9,hi-lo);
    const pts=vals.map((v,i)=>`${P+(W-P*2)*i/(vals.length-1)},${priceH-P-(priceH-P*2)*(v-lo)/sp}`).join(' ');
    let bars='';
    if(useIntraday){const vols=rows.map(x=>num(x.volume)||0),vm=Math.max(1,...vols),bw=Math.max(1,(W-P*2)/rows.length*.68);bars=vols.map((v,i)=>{const h=(volH-3)*v/vm,x=P+(W-P*2)*i/rows.length,y=H-h;return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx=".8"/>`}).join('')}
    return `<svg class="market-spark market-price-volume ${positive?'up':'down'} ${useIntraday?'intraday':''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars?`<g class="market-volume-bars">${bars}</g>`:''}<polyline points="${pts}"/></svg>`
  }
  function renderMarketCards(j){
    const box=q('#globalPairs');if(!box)return;state.market=j;
    const cards=(j?.cards||[]).filter(Boolean);box.className='globalPairs market-card-grid';
    box.innerHTML=cards.map(c=>{
      if(c.error)return `<div class="market-card"><b>${esc(c.name||c.key)}</b><div class="empty">資料暫無</div></div>`;
      const pct=num(c.changePct);return `<button type="button" class="market-card" data-market-key="${esc(c.key)}">
        <div class="market-card-head"><div><b>${esc(c.name||c.key)}</b><div class="market-card-meta">${esc(c.source||'公開行情')}</div></div><span class="market-card-type">${c.kind==='future'?'期貨':'指數'}</span></div>
        <div class="market-card-price"><strong>${number(c.price)}</strong><span class="${colorClass(pct)}">${signed(c.change)} · ${signed(pct)}%</span></div>
        ${marketChart(c,(pct||0)>=0)}${num(c.volume)!=null||num(c.turnover)!=null?`<div class="market-card-flow">${num(c.volume)!=null?`量 ${number(num(c.volume),0)}`:''}${num(c.volume)!=null&&num(c.turnover)!=null?' · ':''}${num(c.turnover)!=null?`額 ${number(num(c.turnover)/1e8,0)} 億`:''}</div>`:''}<div class="market-card-meta">${esc(c.date||'最近')} ${esc(c.time||'')}</div></button>`
    }).join('');
    qa('[data-market-key]',box).forEach(b=>b.onclick=()=>openIndexDetail(cards.find(c=>c.key===b.dataset.marketKey)));
    const src=q('#globalSource');if(src)src.textContent='加權指數：TWSE；台指期：TAIFEX；海外指數採公開延遲行情。紅漲綠跌。';
    const t=q('#globalTime');if(t){const d=new Date(j?.updatedAt||Date.now());t.textContent='更新 '+d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  }
  const MARKET_CARD_CACHE='clarinavi-market-cards-last-good-v13';
  function readMarketCardCache(){try{return JSON.parse(localStorage.getItem(MARKET_CARD_CACHE)||'null')}catch{return null}}
  function saveMarketCardCache(j){try{localStorage.setItem(MARKET_CARD_CACHE,JSON.stringify({...j,_savedAt:Date.now()}))}catch{}}
  function usableMarketCards(j){return !!(j?.cards||[]).some(c=>!c?.error&&num(c?.price)!=null)}
  async function loadMarketCards(force=false){
    const keys=marketKeys();
    try{
      const j=await fetch(`/api/market-home?mode=global&symbols=${encodeURIComponent(keys.join(','))}${force?'&_='+Date.now():''}`,{cache:'no-store'}).then(r=>r.json());
      if(usableMarketCards(j)){saveMarketCardCache(j);renderMarketCards(j);return}
      const cached=readMarketCardCache();
      if(usableMarketCards(cached)){renderMarketCards(cached);const t=q('#globalTime');if(t)t.textContent='最近成功 '+new Date(cached._savedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});return}
      renderMarketCards(j||{cards:[]});
    }catch{
      const cached=readMarketCardCache();
      if(usableMarketCards(cached)){renderMarketCards(cached);const t=q('#globalTime');if(t)t.textContent='最近成功 '+new Date(cached._savedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});}
      else renderMarketCards({cards:keys.map(key=>({key,name:(FALLBACK_MARKETS.find(x=>x.key===key)||{}).name||key,error:true}))});
    }
  }
  function ensureMarketEditor(){
    const actions=q('#marketHome .homeHero .headActions');if(!actions||q('#marketEditBtn'))return;
    const b=document.createElement('button');b.id='marketEditBtn';b.className='refreshBtn';b.type='button';b.textContent='編輯指數';b.onclick=openMarketEditor;actions.appendChild(b);
  }
  function openMarketEditor(){
    const available=state.market?.availableCards?.length?state.market.availableCards:FALLBACK_MARKETS,selected=new Set(marketKeys());
    const {back,close}=modal(`<div class="appModalHead"><div><h2>首頁指數</h2><p>最多 8 張；加權指數與台指期各自獨立。</p></div><button class="appModalClose" data-modal-close>×</button></div>
      <div class="marketChoiceGrid">${available.map(x=>`<label><input type="checkbox" value="${esc(x.key)}" ${selected.has(x.key)?'checked':''}><span><b>${esc(x.name)}</b><small>${esc(x.market)} · ${x.kind==='future'?'期貨':'指數'}</small></span></label>`).join('')}</div>
      <div class="sheetActions" style="margin-top:14px"><button class="secondary" id="marketDefault">預設</button><button class="primary" id="marketSave">套用</button></div>`,'marketEditorModal');
    q('#marketDefault',back).onclick=()=>qa('input[type=checkbox]',back).forEach(x=>x.checked=DEFAULT_MARKETS.includes(x.value));
    q('#marketSave',back).onclick=()=>{const a=qa('input:checked',back).map(x=>x.value).slice(0,8);localStorage.setItem('clarinavi-markets',JSON.stringify(a.length?a:DEFAULT_MARKETS));close();loadMarketCards(true)};
  }
  function openIndexDetail(c){
    if(!c)return;const pct=num(c.changePct),intraday=(c.intraday||[]).filter(x=>num(x.close)!=null),daily=(c.series||[]).filter(x=>num(x.close)!=null).slice(-90),useIntraday=intraday.length>=2,rows=useIntraday?intraday:daily;
    modal(`<div class="appModalHead"><div><h2>${esc(c.name||'市場指數')}</h2><p>${esc(c.source||'公開行情')} · ${useIntraday?'當日分時價量':'歷史價格'}</p></div><button class="appModalClose" data-modal-close>×</button></div>
      <div class="market-card-price"><strong>${number(c.price)}</strong><span class="${colorClass(pct)}">${signed(c.change)} · ${signed(pct)}%</span></div>
      ${(num(c.volume)!=null||num(c.turnover)!=null)?`<div class="indexFlowStats">${num(c.volume)!=null?`<span>成交量 <b>${number(c.volume,0)}</b></span>`:''}${num(c.turnover)!=null?`<span>成交額 <b>${number(num(c.turnover)/1e8,0)} 億</b></span>`:''}${num(c.trades)!=null?`<span>筆數 <b>${number(c.trades,0)}</b></span>`:''}</div>`:''}
      <div class="indexBigLine">${marketChart(c,(pct||0)>=0,true)}</div>
      <div class="tableWrap" style="margin-top:12px"><table class="dataTable"><thead><tr><th>${useIntraday?'時間':'日期'}</th><th>${useIntraday?'指數':'收盤'}</th>${useIntraday?'<th>成交量</th>':''}</tr></thead><tbody>${rows.slice(-24).reverse().map(x=>`<tr><td>${esc(useIntraday?x.time:x.date)}</td><td>${number(x.close)}</td>${useIntraday?`<td>${number(x.volume,0)}</td>`:''}</tr>`).join('')}</tbody></table></div>`,'indexDetailModal');
  }

  function treemap(items,x=0,y=0,w=100,h=100,depth=0,out=[]){
    if(!items.length)return out;if(items.length===1){out.push({...items[0],x,y,w,h});return out}
    const total=items.reduce((a,b)=>a+Math.max(1,num(b.turnover)||1),0);let acc=0,cut=1,best=Infinity;
    for(let i=1;i<items.length;i++){acc+=Math.max(1,num(items[i-1].turnover)||1);const d=Math.abs(total/2-acc);if(d<best){best=d;cut=i}}
    const a=items.slice(0,cut),b=items.slice(cut),ratio=a.reduce((s,i)=>s+Math.max(1,num(i.turnover)||1),0)/total;
    if(w>=h){const aw=w*ratio;treemap(a,x,y,aw,h,depth+1,out);treemap(b,x+aw,y,w-aw,h,depth+1,out)}
    else{const ah=h*ratio;treemap(a,x,y,w,ah,depth+1,out);treemap(b,x,y+ah,w,h-ah,depth+1,out)}
    return out;
  }
  function sectorControls(){q('#sectorReplay')?.remove();return null}
  function renderSector(){}
  function renderSectorFlow(){}
  function setSector(){}
  async function loadSector(){q('#sectorReplay')?.remove();return window.ClariNaviMarketHome?.load?.(false)}

  const COST_CODES='2330,2454,2308';
  function costCell(line,current,label){
    const cost=num(line?.cost),above=cost!=null&&current!=null?current>=cost:null;
    return `<div class="costLine"><b>${esc(label)} ${number(cost)}</b><span class="${above===true?'up':above===false?'down':'muted'}">${above===true?'現價在成本上方':above===false?'現價低於成本':'樣本不足'}</span><small>${esc(line?.firstDate||'—')} → ${esc(line?.lastDate||'—')} · ${number(line?.sampleDays,0)} 日</small></div>`
  }
  function costRows(items){
    return (items||[]).map(x=>{const lines=x.lines||{},cur=num(x.current);return `<div class="costRow"><div class="costIdentity"><b>${esc(x.name||x.code)} · ${esc(x.code)}</b><span>現價 ${number(cur)}</span><small>歷史最長可得區間：${esc(x.historyStart||'—')} → ${esc(x.historyEnd||'—')}</small></div>${costCell(lines.foreign,cur,'外資')}${costCell(lines.trust,cur,'投信')}${costCell(lines.dealer,cur,'自營商')}</div>`}).join('');
  }
  async function fetchCosts(codes){return fetch('/api/foreign-costs?codes='+encodeURIComponent(codes),{cache:'default'}).then(r=>r.json())}
  function ensureHomeCosts(){
    const home=q('#marketHome');if(!home)return null;qa('#v65HomeCosts').forEach(x=>x.remove());
    let panel=q('#institutionCostHome');if(panel)return panel;
    panel=document.createElement('section');panel.id='institutionCostHome';panel.className='homePanel costPanelUnified';
    panel.innerHTML=`<div class="costHeader"><div><h2>三大法人歷史成本（三線）</h2><p>外資／投信／自營商，各自使用資料源能取得的最早日期一路計算至最新。</p></div><div class="costTools"><input id="homeCostCodes" value="${COST_CODES}" aria-label="成本股票代號"><span class="pill" id="homeCostUpdated">自動載入</span></div></div><div class="costRows" id="homeCostRows"><div class="skeleton"></div></div><div class="homeSource">歷史成本為買超日淨買超股數加權收盤價之研究估算，不代表法人真實庫存成本；每條線標示實際起訖日。</div>`;
    const sectorSplit=q('#sectorHeatmap')?.closest('.homeSplit');
    if(sectorSplit&&sectorSplit.parentNode===home)home.insertBefore(panel,sectorSplit);else home.appendChild(panel);
    q('#homeCostCodes')?.addEventListener('change',()=>{state.costHomeLoaded=false;loadHomeCosts(true)});return panel;
  }
  async function loadHomeCosts(force=false){
    ensureHomeCosts();if(state.costHomeLoaded&&!force&&Date.now()-(state.costHomeLoadedAt||0)<60000)return;const codes=q('#homeCostCodes')?.value.trim()||COST_CODES;
    const host=q('#homeCostRows'),cached=readCostCache();if(host&&!cached?.items?.length)host.innerHTML='<div class="skeleton"></div>';
    const showCached=()=>{if(cached?.items?.length){if(host)host.innerHTML=costRows(cached.items);const u=q('#homeCostUpdated');if(u)u.textContent='最近成功 '+new Date(cached._savedAt||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});return true}return false};
    try{const j=await fetchCosts(codes);if(j?.items?.length){saveCostCache(j);if(host)host.innerHTML=costRows(j.items);state.costHomeLoaded=true;state.costHomeLoadedAt=Date.now();const u=q('#homeCostUpdated');if(u)u.textContent='更新 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});return}if(!showCached()&&host)host.innerHTML='<div class="empty">目前無可用的歷史成本資料</div>';state.costHomeLoaded=true;state.costHomeLoadedAt=Date.now();}catch{if(!showCached()&&host)host.innerHTML='<div class="empty">歷史成本來源暫時無法取得</div>'}
  }
  function ensureStockCosts(){
    const shell=q('#stockResult .stockShell');if(!shell)return null;qa('#v65StockCostPanel').forEach(x=>x.remove());
    let panel=q('#institutionCostStock');if(panel)return panel;
    panel=document.createElement('article');panel.id='institutionCostStock';panel.className='panelCard costPanelUnified';
    panel.innerHTML='<div class="costHeader"><div><h3>三大法人歷史成本（三線）</h3><p>使用該股票可取得的最長歷史區間。</p></div><span class="pill">歷史估算</span></div><div class="costRows" id="stockCostRows"><div class="empty">查詢股票後載入</div></div>';
    const chart=q('.chartCard',shell);chart?chart.after(panel):shell.appendChild(panel);return panel;
  }
  async function syncStockCosts(){
    ensureStockCosts();let code='';try{code=String(current||'').toUpperCase()}catch{}
    if(!/^\d{4,6}[A-Z]?$/.test(code)||market!=='TW')return;if(state.costStockCode===code)return;state.costStockCode=code;
    const host=q('#stockCostRows');if(host)host.innerHTML='<div class="skeleton"></div>';
    try{const j=await fetchCosts(code);if(host)host.innerHTML=j?.items?.length?costRows(j.items):'<div class="empty">歷史成本暫無資料</div>'}catch{if(host)host.innerHTML='<div class="empty">歷史成本暫時無法取得</div>'}
  }

  function stickyStockNav(){
    const shell=q('#stockResult .stockShell'),tabs=q('#subTabs');if(shell&&tabs&&shell.firstElementChild!==tabs)shell.insertBefore(tabs,shell.firstElementChild);
  }
  function modalSafety(){
    qa('.sheet,.popup,.v66MoreSheet,.voiceQueryPanel').forEach(el=>{if(getComputedStyle(el).position!=='fixed')el.style.position='fixed'});
  }
  function lazyCost(){
    const p=ensureHomeCosts();if(!p)return;
    if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();loadHomeCosts(false)}},{rootMargin:'300px'});io.observe(p)}else setTimeout(()=>loadHomeCosts(false),1200)
  }

  function onMarketHome(e){
    ensureMarketEditor();
    const fresh=e?.detail?.global||window.__clarinaviMarketHome?.global;
    if(usableMarketCards(fresh)){saveMarketCardCache(fresh);renderMarketCards(fresh)}else loadMarketCards(false);
    ensureHomeCosts();loadHomeCosts(false);initAvatars();
  }

  function boot(){
    clearLegacyCaches();removeFontControls();injectVoiceSearch();initAvatars();ensureMarketEditor();sectorControls();ensureHomeCosts();ensureStockCosts();stickyStockNav();modalSafety();lazyCost();
    window.addEventListener('clarinavi:market-home',onMarketHome);
    window.addEventListener('clarinavi:home-cost-refresh',()=>loadHomeCosts(false));
    q('#homeRefresh')?.addEventListener('click',()=>{state.costHomeLoaded=false;setTimeout(()=>{loadMarketCards(true);loadSector(true);loadHomeCosts(true)},80)});
    const stock=q('#stockResult');if(stock)new MutationObserver(()=>{stickyStockNav();ensureStockCosts();initAvatars();syncStockCosts()}).observe(stock,{childList:true,subtree:true});
    const home=q('#marketHome');if(home)new MutationObserver(()=>{ensureMarketEditor();ensureHomeCosts();q('#sectorReplay')?.remove();initAvatars();qa('#v65HomeCosts').forEach(x=>x.remove())}).observe(home,{childList:true,subtree:true});
    [100,500,1200].forEach(ms=>setTimeout(()=>{onMarketHome();syncStockCosts()},ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* Market discovery: official ETF directory + near-real-time TW stock rankings. */
(()=>{
  'use strict';
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(String(v??'').replace(/,/g,'').replace(/%/g,'').trim());return Number.isFinite(n)?n:null};
  const fmt=(v,d=2)=>{const n=num(v);return n==null?'—':n.toLocaleString('zh-TW',{maximumFractionDigits:d})};
  const sign=v=>{const n=num(v);return n==null?'—':`${n>0?'+':''}${n.toFixed(2)}%`};
  const cls=v=>num(v)>0?'up':num(v)<0?'down':'muted';
  const compact=v=>{const n=num(v);if(n==null)return'—';if(Math.abs(n)>=1e8)return`${(n/1e8).toFixed(n>=1e9?1:2)}億`;if(Math.abs(n)>=1e4)return`${(n/1e4).toFixed(n>=1e5?0:1)}萬`;return Math.round(n).toLocaleString('zh-TW')};
  const state={rankSort:'price',rankMarket:'all',etfSort:'volume',etfKind:'all',rankTimer:null,etfTimer:null,rankHomeSort:'price',etfHomeSort:'volume',rankReq:0,etfReq:0};

  function openStock(code){
    if(!code)return;
    try{if(typeof window.openSymbol==='function')return window.openSymbol('TW',code)}catch{}
    const inp=q('#q');if(inp){inp.value=code;q('#go')?.click();}
  }
  function go(screen){try{window.showScreen?.(screen)}catch{}}
  function timestamp(v){try{return new Date(v||Date.now()).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return'—'}}

  const DISCOVERY_CACHE_KEY='clarinavi-discovery-last-good-v13';
  function readDiscoveryCache(){try{const x=JSON.parse(localStorage.getItem(DISCOVERY_CACHE_KEY)||'null');return x&&typeof x==='object'?x:{}}catch{return {}}}
  function saveDiscoveryCache(){try{localStorage.setItem(DISCOVERY_CACHE_KEY,JSON.stringify({...discoveryLastGood,savedAt:Date.now()}))}catch{}}
  const dc=readDiscoveryCache();
  const discoveryLastGood={rank:dc.rank||null,etf:dc.etf||null};
  function renderCompact(host,items,kind){
    if(!host)return;
    if(!items?.length){host.innerHTML='<div class="empty">目前沒有可顯示資料。</div>';return}
    host.innerHTML=items.slice(0,8).map(x=>`<button type="button" class="compactRankRow" data-discovery-code="${esc(x.code)}"><span class="rankNo">${x.rank}</span><span class="compactRankName"><b>${esc(x.code)}</b><small>${esc(x.name||'')}</small></span><span class="compactRankPrice">${fmt(x.price)}</span><span class="${cls(x.changePct)}">${sign(x.changePct)}</span>${kind==='etf'&&num(x.regularAccounts)!=null?`<small>${compact(x.regularAccounts)} 戶</small>`:''}</button>`).join('');
    qa('[data-discovery-code]',host).forEach(b=>b.onclick=()=>openStock(b.dataset.discoveryCode));
  }

  async function loadRankHome(force=false){
    const host=q('#rankHomeList');if(!host)return;
    const req=++state.rankReq;if(force&&!discoveryLastGood.rank)host.innerHTML='<div class="skeleton"></div>';
    try{
      const j=await fetch(`/api/market-rankings?sort=${encodeURIComponent(state.rankHomeSort)}&limit=8${force?'&_='+Date.now():''}`,{cache:'no-store'}).then(r=>r.json());
      if(req!==state.rankReq)return;
      if(j?.items?.length){discoveryLastGood.rank=j;saveDiscoveryCache();}
      const use=(j?.items?.length?j:discoveryLastGood.rank);
      if(use){renderCompact(host,use.items,'stock');const src=q('#rankHomeSource');if(src)src.textContent=`${use.source||'TWSE / TPEx 官方公開資料'} · ${use.status==='near-realtime'?'盤中最佳努力近即時':'最近可得資料'} · ${timestamp(use.updatedAt)}`;}
      else host.innerHTML='<div class="empty">排行資料暫時無法取得。</div>';
    }catch{if(discoveryLastGood.rank)renderCompact(host,discoveryLastGood.rank.items,'stock');else host.innerHTML='<div class="empty">排行資料暫時無法取得。</div>'}
  }
  async function loadEtfHome(force=false){
    const host=q('#etfHomeList');if(!host)return;
    const req=++state.etfReq;if(force&&!discoveryLastGood.etf)host.innerHTML='<div class="skeleton"></div>';
    try{
      const j=await fetch(`/api/etf-market?sort=${encodeURIComponent(state.etfHomeSort)}&limit=8${force?'&_='+Date.now():''}`,{cache:'no-store'}).then(r=>r.json());
      if(req!==state.etfReq)return;
      if(j?.items?.length){discoveryLastGood.etf=j;saveDiscoveryCache();}
      const use=(j?.items?.length?j:discoveryLastGood.etf);
      if(use){renderCompact(host,use.items,'etf');const src=q('#etfHomeSource');if(src)src.textContent=`${use.source||'TWSE 官方 ETF 公開資料'} · ${timestamp(use.updatedAt)}`;}
      else host.innerHTML='<div class="empty">ETF 資料暫時無法取得。</div>';
    }catch{if(discoveryLastGood.etf)renderCompact(host,discoveryLastGood.etf.items,'etf');else host.innerHTML='<div class="empty">ETF 資料暫時無法取得。</div>'}
  }

  function renderRankTable(items){
    const body=q('#marketRankBody');if(!body)return;
    if(!items?.length){body.innerHTML='<tr><td colspan="7"><div class="empty">目前沒有可顯示資料。</div></td></tr>';return}
    body.innerHTML=items.map(x=>`<tr class="rankClickable" data-rank-code="${esc(x.code)}"><td><span class="rankBadge ${x.rank<=3?'top':''}">${x.rank}</span></td><td><b>${esc(x.name||x.code)}</b><small>${esc(x.code)}</small></td><td><strong>${fmt(x.price)}</strong></td><td><span class="${cls(x.changePct)}">${sign(x.changePct)}</span><small>${num(x.change)!=null?(num(x.change)>0?'+':'')+fmt(x.change):'—'}</small></td><td>${compact(x.volume)}<small>張</small></td><td>${compact(x.turnover)}</td><td><span class="marketTag">${esc(x.market==='TPEx'?'上櫃':'上市')}</span></td></tr>`).join('');
    qa('[data-rank-code]',body).forEach(r=>r.onclick=()=>openStock(r.dataset.rankCode));
  }
  async function loadMarketRank(force=false){
    const body=q('#marketRankBody');if(!body)return;
    if(force)body.innerHTML='<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
    try{const j=await fetch(`/api/market-rankings?sort=${encodeURIComponent(state.rankSort)}&market=${encodeURIComponent(state.rankMarket)}&limit=100${force?'&_='+Date.now():''}`,{cache:'no-store'}).then(r=>r.json());renderRankTable(j.items);q('#marketRankUpdated')&&(q('#marketRankUpdated').textContent=`更新 ${timestamp(j.updatedAt)}`);q('#marketRankState')&&(q('#marketRankState').textContent=`${j.refreshSeconds||15} 秒更新 · ${j.status==='near-realtime'?'近即時':'最新可得'}`);}catch{body.innerHTML='<tr><td colspan="6"><div class="empty">行情排行暫時無法取得。</div></td></tr>'}
  }

  function etfDetailText(x){
    if(state.etfSort==='regular'&&num(x.regularAccounts)!=null)return `定期定額 ${compact(x.regularAccounts)} 戶${x.regularMonth?' · '+esc(x.regularMonth):''}`;
    if(state.etfSort==='units'&&num(x.units)!=null)return `發行單位 ${compact(x.units)}`;
    return esc(x.benchmark||x.type||'ETF');
  }
  function renderEtfTable(items,total){
    const body=q('#etfMarketBody');if(!body)return;
    if(!items?.length){body.innerHTML='<tr><td colspan="7"><div class="empty">沒有符合條件的 ETF。</div></td></tr>';return}
    body.innerHTML=items.map(x=>`<tr class="rankClickable" data-etf-code="${esc(x.code)}"><td><span class="rankBadge ${x.rank<=3?'top':''}">${x.rank}</span></td><td><b>${esc(x.code)}</b><small>${esc(x.name||'')}</small></td><td><strong>${fmt(x.price)}</strong></td><td><span class="${cls(x.changePct)}">${sign(x.changePct)}</span></td><td>${compact(x.volume)}<small>張</small></td><td>${compact(x.turnover)}</td><td><span>${etfDetailText(x)}</span><small>${esc(x.type||'')}</small></td></tr>`).join('');
    qa('[data-etf-code]',body).forEach(r=>r.onclick=()=>openStock(r.dataset.etfCode));
    const count=q('#etfMarketCount');if(count)count.textContent=`${items.length} / ${total||items.length} 檔`;
  }
  async function loadEtfMarket(force=false){
    const body=q('#etfMarketBody');if(!body)return;
    if(force)body.innerHTML='<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
    const search=q('#etfMarketSearch')?.value.trim()||'';
    try{const j=await fetch(`/api/etf-market?sort=${encodeURIComponent(state.etfSort)}&kind=${encodeURIComponent(state.etfKind)}&limit=100${search?'&q='+encodeURIComponent(search):''}${force?'&_='+Date.now():''}`,{cache:'no-store'}).then(r=>r.json());renderEtfTable(j.items,j.total);q('#etfMarketUpdated')&&(q('#etfMarketUpdated').textContent=`更新 ${timestamp(j.updatedAt)}`);q('#etfMarketStatus')&&(q('#etfMarketStatus').textContent=`${j.note||'TWSE 官方公開資料'} · ${j.refreshSeconds||20} 秒快取`);}catch{body.innerHTML='<tr><td colspan="6"><div class="empty">ETF 資料暫時無法取得。</div></td></tr>'}
  }

  function stopTimers(){if(state.rankTimer){clearInterval(state.rankTimer);state.rankTimer=null}if(state.etfTimer){clearInterval(state.etfTimer);state.etfTimer=null}}
  function screenChanged(id){
    stopTimers();
    if(id==='rank'){loadMarketRank(false);state.rankTimer=setInterval(()=>{if(q('#screen-rank')?.classList.contains('active')&&twLivePollingAllowed())loadMarketRank(false)},DATA_REFRESH.rank)}
    if(id==='etf'){loadEtfMarket(false);state.etfTimer=setInterval(()=>{if(q('#screen-etf')?.classList.contains('active')&&twLivePollingAllowed())loadEtfMarket(false)},DATA_REFRESH.etf)}
  }
  function wrapScreen(){
    const old=window.showScreen;if(typeof old!=='function'||old.__discovery)return;
    const fn=function(id){const r=old.apply(this,arguments);screenChanged(id);return r};fn.__discovery=true;window.showScreen=fn;
  }
  function bind(){
    wrapScreen();
    qa('[data-rank-sort]').forEach(b=>b.onclick=()=>{state.rankSort=b.dataset.rankSort;qa('[data-rank-sort]').forEach(x=>x.classList.toggle('active',x===b));loadMarketRank(true)});
    qa('[data-rank-market]').forEach(b=>b.onclick=()=>{state.rankMarket=b.dataset.rankMarket;qa('[data-rank-market]').forEach(x=>x.classList.toggle('active',x===b));loadMarketRank(true)});
    qa('[data-etf-sort]').forEach(b=>b.onclick=()=>{state.etfSort=b.dataset.etfSort;qa('[data-etf-sort]').forEach(x=>x.classList.toggle('active',x===b));loadEtfMarket(true)});
    qa('[data-etf-kind]').forEach(b=>b.onclick=()=>{state.etfKind=b.dataset.etfKind;qa('[data-etf-kind]').forEach(x=>x.classList.toggle('active',x===b));loadEtfMarket(true)});
    qa('[data-rank-home]').forEach(b=>b.onclick=()=>{state.rankHomeSort=b.dataset.rankHome;qa('[data-rank-home]').forEach(x=>x.classList.toggle('active',x===b));loadRankHome(true)});
    qa('[data-etf-home]').forEach(b=>b.onclick=()=>{state.etfHomeSort=b.dataset.etfHome;qa('[data-etf-home]').forEach(x=>x.classList.toggle('active',x===b));loadEtfHome(true)});
    q('#marketRankRefresh')?.addEventListener('click',()=>loadMarketRank(true));q('#etfMarketRefresh')?.addEventListener('click',()=>loadEtfMarket(true));
    q('#rankHomeMore')?.addEventListener('click',()=>go('rank'));q('#etfHomeMore')?.addEventListener('click',()=>go('etf'));
    let searchTimer=null;q('#etfMarketSearch')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadEtfMarket(true),260)});
    q('#homeRefresh')?.addEventListener('click',()=>setTimeout(()=>{loadRankHome(true);loadEtfHome(true)},100));
    const lazy=(sel,fn)=>{const el=q(sel);if(!el)return;if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();fn(false)}},{rootMargin:'240px'});io.observe(el)}else setTimeout(()=>fn(false),1200)};
    loadRankHome(false);loadEtfHome(false);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();

  // Unified foreground refresh. One clock prevents competing timers from leaving some home cards stale.
  let activeAutoTimer=null,homeTick=0,refreshBusy=false;
  function homeFallbackGuard(){
    const fallbacks=[
      ['#globalPairs','市場資料載入中…'],['#todayFocus','今日焦點載入中…'],['#rankHomeList','排行資料載入中…'],
      ['#etfHomeList','ETF 資料載入中…'],['#sectorHeatmap','產業資料載入中…'],['#contribList','點數貢獻載入中…']
    ];
    for(const [sel,msg] of fallbacks){const el=q(sel);if(el&&el.querySelector('.skeleton,.homeSkeleton,.focusSkeleton')&&!el.dataset.guard){el.dataset.guard='1';setTimeout(()=>{if(el.querySelector('.skeleton,.homeSkeleton,.focusSkeleton'))el.innerHTML=`<div class="empty softEmpty">${msg}</div>`;el.dataset.guard=''},4500)}}
  }
  async function refreshVisibleScreen(){
    if(document.visibilityState!=='visible'||refreshBusy)return;
    const active=document.querySelector('.screen.active')?.id||'';
    if(active!=='screen-market')return;
    const homeVisible=!q('#marketHome')?.classList.contains('hidden');if(!homeVisible)return;
    refreshBusy=true;homeTick++;homeFallbackGuard();
    try{
      await Promise.resolve(window.ClariNaviMarketHome?.load?.(false));
      if(twLivePollingAllowed()||homeTick%2===0)await Promise.allSettled([loadRankHome(false),loadEtfHome(false)]);
      if(homeTick%3===0)await Promise.resolve(window.ClariNavi?.loadTodayFocus?.(false));
      if(homeTick%6===0){try{window.dispatchEvent(new CustomEvent('clarinavi:home-cost-refresh'))}catch{}}
    }finally{refreshBusy=false}
  }
  function startForegroundRefresh(){
    clearInterval(activeAutoTimer);refreshVisibleScreen();activeAutoTimer=setInterval(refreshVisibleScreen,5000);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')startForegroundRefresh();else clearInterval(activeAutoTimer)});
  window.addEventListener('focus',startForegroundRefresh,{passive:true});
  startForegroundRefresh();

  function hideManualRefreshControls(){
    ['homeRefresh','focusRefresh','marketRankRefresh','etfMarketRefresh','portfolioRefresh','alertsRefresh'].forEach(id=>q('#'+id)?.classList.add('manualRefreshHidden'));
  }
  hideManualRefreshControls();

})();
