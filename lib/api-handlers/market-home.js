const MIS='https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const TWSE='https://openapi.twse.com.tw/v1';
const TAIFEX='https://openapi.taifex.com.tw/v1';

function num(v){
  if(v===null||v===undefined)return null;
  const s=String(v).replace(/,/g,'').replace(/[%＋+]/g,'').trim();
  if(!s||s==='-'||s==='--'||s==='N/A')return null;
  const n=Number(s); return Number.isFinite(n)?n:null;
}
function txt(v){return String(v??'').trim()}
function normalizeDate(v){
  const s=txt(v);
  if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  const roc=s.match(/^(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if(roc)return `${Number(roc[1])+1911}-${String(Number(roc[2])).padStart(2,'0')}-${String(Number(roc[3])).padStart(2,'0')}`;
  return s;
}
function pick(o,keys){for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k];return null}
function timeoutSignal(ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return{signal:c.signal,done:()=>clearTimeout(t)}}
async function json(url,ms=5000,headers={}){
  const c=timeoutSignal(ms);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ClariNavi/Current)','Accept':'application/json,text/plain,*/*',...headers}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{c.done()}
}
async function text(url,ms=5000){
  const c=timeoutSignal(ms);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ClariNavi/Current)','Accept':'text/csv,text/plain,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{c.done()}
}
function csvRows(raw){
  const lines=String(raw||'').trim().split(/\r?\n/).filter(Boolean); if(lines.length<2)return[];
  const parse=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};
  const h=parse(lines[0]);return lines.slice(1).map(l=>{const a=parse(l),o={};h.forEach((k,i)=>o[k.trim()]=a[i]);return o});
}
async function mis(channels){
  const u=`${MIS}?ex_ch=${encodeURIComponent(channels.join('|'))}&json=1&delay=0&_=${Math.floor(Date.now()/5000)}`;
  const j=await json(u,4200,{Referer:'https://mis.twse.com.tw/stock/fibest.jsp'});return Array.isArray(j?.msgArray)?j.msgArray:[];
}
function misQuote(q){
  const price=num(q.z)??num(q.y),prev=num(q.y),chg=price!=null&&prev!=null?price-prev:null;
  return{code:txt(q.c),name:txt(q.n||q.nf||q.c),price,prev,change:chg,changePct:chg!=null&&prev?chg/prev*100:null,time:txt(q.t),date:normalizeDate(q.d)};
}
async function stooqQuote(symbol){
  const u=`https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
  const rows=csvRows(await text(u,4500)); const r=rows[0]||{};
  const close=num(r.Close),open=num(r.Open);
  if(close==null)throw new Error('no quote');
  return{symbol,date:txt(r.Date),time:txt(r.Time),open,high:num(r.High),low:num(r.Low),price:close,volume:num(r.Volume)};
}
function ymd(d){return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`}
async function stooqPrev(symbol,quote){
  try{
    const d2=new Date(),d1=new Date(Date.now()-15*864e5);
    const u=`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&d1=${ymd(d1)}&d2=${ymd(d2)}&i=d`;
    const rows=csvRows(await text(u,4800)).filter(x=>num(x.Close)!=null).sort((a,b)=>String(a.Date).localeCompare(String(b.Date)));
    if(!rows.length)return null;
    let idx=rows.findIndex(x=>String(x.Date)===quote.date);
    if(idx>0)return num(rows[idx-1].Close);
    if(idx===0)return null;
    return num(rows[rows.length-1].Close);
  }catch{return null}
}
async function stooqAsset(symbol,name){
  const q=await stooqQuote(symbol),prev=await stooqPrev(symbol,q);const change=prev!=null?q.price-prev:null;
  return{name,symbol,price:q.price,change,changePct:change!=null&&prev?change/prev*100:null,date:q.date,time:q.time,source:'Stooq 公開行情'};
}
async function stooqFuture(symbol,name){
  const q=await stooqQuote(symbol);const ch=q.open!=null?q.price-q.open:null;
  return{name,symbol,price:q.price,change:ch,changePct:ch!=null&&q.open?ch/q.open*100:null,changeBasis:'較開盤',date:q.date,time:q.time,source:'Stooq 公開行情'};
}
async function txFuture(){
  try{
    const a=await json(`${TAIFEX}/DailyMarketReportFut`,5500);const rows=(Array.isArray(a)?a:[]).filter(x=>txt(x.Contract)==='TX'&&/^\d{6}$/.test(txt(x['ContractMonth(Week)'])));
    if(!rows.length)return null;
    rows.sort((a,b)=>{const dd=txt(b.Date).localeCompare(txt(a.Date));if(dd)return dd;const ma=txt(a['ContractMonth(Week)']).localeCompare(txt(b['ContractMonth(Week)']));if(ma)return ma;return (txt(b.TradingSession).includes('盤後')?1:0)-(txt(a.TradingSession).includes('盤後')?1:0)});
    const r=rows[0],price=num(r.Last)??num(r.SettlementPrice),change=num(r.Change),pct=num(r['%']);
    return{name:'台指期',symbol:'TX',price,change,changePct:pct,changeBasis:'前一交易基準',date:txt(r.Date),time:txt(r.TradingSession),contract:txt(r['ContractMonth(Week)']),source:'TAIFEX OpenAPI'};
  }catch{return null}
}
async function stooqDaily(symbol,days=90){
  try{
    const d2=new Date(), d1=new Date(Date.now()-Math.max(days*2,120)*864e5);
    const u=`https://stooq.com/q/d/l/?s=${encodeURIComponent(String(symbol).toLowerCase())}&d1=${ymd(d1)}&d2=${ymd(d2)}&i=d`;
    const rows=csvRows(await text(u,5200)).filter(x=>num(x.Close)!=null).sort((a,b)=>String(a.Date).localeCompare(String(b.Date))).slice(-days);
    return rows.map(x=>({date:txt(x.Date),close:num(x.Close)}));
  }catch{return[]}
}

async function twseTaiexIntraday(){
  try{
    const ch='tse_t00.tw';
    const j=await json(`https://mis.twse.com.tw/stock/api/getChartOhlcStatis.jsp?ex=${encodeURIComponent(ch)}&ch=${encodeURIComponent(ch)}&fqy=1&_=${Date.now()}`,4200,{Referer:'https://mis.twse.com.tw/stock/fibest.jsp'});
    const arr=Array.isArray(j?.ohlcArray)?j.ohlcArray:Array.isArray(j?.data)?j.data:[];
    const rows=[];
    for(const r of arr){
      if(Array.isArray(r)){const raw=txt(r[0]).replace(/:/g,'');if(!/^\d{4,6}$/.test(raw))continue;rows.push({time:`${raw.slice(0,2)}:${raw.slice(2,4)}`,close:num(r[4]??r[1]),volume:num(r[5])});}
      else if(r&&typeof r==='object'){const raw=txt(r.t||r.time||r.T).replace(/:/g,'');if(!/^\d{4,6}$/.test(raw))continue;rows.push({time:`${raw.slice(0,2)}:${raw.slice(2,4)}`,close:num(r.c??r.close??r.z),volume:num(r.v??r.volume)});}
    }
    const m=new Map();for(const x of rows.filter(x=>x.time&&x.close!=null))m.set(x.time,x);return [...m.values()].sort((a,b)=>a.time.localeCompare(b.time));
  }catch{return[]}
}

async function twseMarketStat(){
  try{
    const a=await json(`${TWSE}/exchangeReport/MI_5MINS`,4200);
    const rows=Array.isArray(a)?a:[]; const r=rows.at(-1)||{};
    const volume=num(pick(r,['成交股數','TradeVolume','TradingShares','成交量']));
    const turnover=num(pick(r,['成交金額','TradeValue','TransactionAmount','成交值']));
    const trades=num(pick(r,['成交筆數','Transaction','Trades','成交筆數合計']));
    const time=txt(pick(r,['時間','Time','Date','日期']));
    return {volume,turnover,trades,time,source:'TWSE MI_5MINS'};
  }catch{return null}
}

async function twseTaiexDaily(days=60){
  try{
    const now=new Date();
    const months=[];
    for(let i=0;i<5;i++){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));months.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}01`)}
    const packs=await Promise.allSettled(months.map(m=>json(`https://www.twse.com.tw/indicesReport/MI_5MINS_HIST?date=${m}&response=json&_=${m}`,5200)));
    const map=new Map();
    for(const pack of packs){
      if(pack.status!=='fulfilled')continue;
      const j=pack.value,fields=(j?.fields||[]).map(txt),rows=Array.isArray(j?.data)?j.data:[];
      const dateIdx=Math.max(0,fields.findIndex(x=>/日期/.test(x)));
      let closeIdx=fields.findIndex(x=>/收盤指數|收盤/.test(x)); if(closeIdx<0)closeIdx=4;
      for(const r of rows){const date=normalizeDate(r?.[dateIdx]),close=num(r?.[closeIdx]);if(date&&close!=null)map.set(date,{date,close})}
    }
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-days);
  }catch{return[]}
}
const CARD_DEFS={
  TAIEX:{key:'TAIEX',name:'台灣加權指數',kind:'index',symbol:'^twii',channel:'tse_t00.tw',market:'TW'},
  TX:{key:'TX',name:'台指期近月',kind:'future',symbol:'tx.f',market:'TW'},
  SPX:{key:'SPX',name:'S&P 500',kind:'index',symbol:'^spx',market:'US'},
  ES:{key:'ES',name:'E-mini S&P',kind:'future',symbol:'es.f',market:'US'},
  NDX:{key:'NDX',name:'Nasdaq 100',kind:'index',symbol:'^ndx',market:'US'},
  NQ:{key:'NQ',name:'E-mini Nasdaq',kind:'future',symbol:'nq.f',market:'US'},
  DJI:{key:'DJI',name:'Dow Jones',kind:'index',symbol:'^dji',market:'US'},
  YM:{key:'YM',name:'Dow 期貨',kind:'future',symbol:'ym.f',market:'US'},
  SOX:{key:'SOX',name:'費半指數',kind:'index',symbol:'^sox',market:'US'},
  N225:{key:'N225',name:'日經 225',kind:'index',symbol:'^nkx',market:'JP'},
  HSI:{key:'HSI',name:'恒生指數',kind:'index',symbol:'^hsi',market:'HK'}
};
function cardQuery(req){
  const raw=String(req?.query?.symbols||req?.query?.cards||'TAIEX,TX,SPX,NDX').toUpperCase();
  const keys=[...new Set(raw.split(/[\s,|]+/).map(x=>x.trim()).filter(Boolean))].filter(k=>CARD_DEFS[k]).slice(0,8);
  return keys.length?keys:['TAIEX','TX','SPX','NDX'];
}
async function quoteCard(def){
  let q=null;
  if(def.key==='TAIEX'){
    try{const a=await mis([def.channel]);q=a[0]?misQuote(a[0]):null;if(q){q.name=def.name;q.symbol=def.key;q.source='TWSE MIS 公開市況';}}
    catch{}
    if(!q)try{q=await stooqAsset(def.symbol,def.name);q.symbol=def.key;}catch{}
  }else if(def.key==='TX'){
    q=await txFuture(); if(q)q.symbol='TX';
  }else{
    q=def.kind==='future'?await stooqFuture(def.symbol,def.name):await stooqAsset(def.symbol,def.name);
    q.symbol=def.key;
  }
  if(!q)throw new Error('quote unavailable');
  let marketStat=null,intraday=[],series=[];
  if(def.key==='TAIEX'){const packs=await Promise.all([twseTaiexDaily(60),twseMarketStat(),twseTaiexIntraday()]);series=packs[0];marketStat=packs[1];intraday=packs[2];}
  else series=await stooqDaily(def.symbol,60);
  if(def.key==='TAIEX'&&q.price!=null&&q.date){
    const d=normalizeDate(q.date);const i=series.findIndex(x=>x.date===d);
    if(i>=0)series[i]={date:d,close:q.price};else if(d)series=[...series,{date:d,close:q.price}].sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
  }
  return{key:def.key,name:def.name,kind:def.kind,market:def.market,symbol:def.symbol,price:q.price,change:q.change,changePct:q.changePct,date:q.date,time:q.time,source:q.source||'Stooq 公開行情',series,intraday,volume:marketStat?.volume??q.volume??null,turnover:marketStat?.turnover??null,trades:marketStat?.trades??null,marketStatSource:marketStat?.source||null,seriesSource:def.key==='TAIEX'?'TWSE MI_5MINS_HIST':(def.key==='TX'?'Stooq 公開日線（期貨報價仍採 TAIFEX）':'Stooq 公開日線'),changeBasis:q.changeBasis||'前收'};
}
async function globalMode(req){
  const keys=cardQuery(req);const results=await Promise.allSettled(keys.map(k=>quoteCard(CARD_DEFS[k])));
  const cards=results.map((r,i)=>r.status==='fulfilled'?r.value:{key:keys[i],name:CARD_DEFS[keys[i]]?.name||keys[i],error:true}).filter(Boolean);
  // Keep legacy pairs for older renderers.
  const by={}; for(const c of cards)by[c.key]=c;
  const pairs=[];
  if(by.TAIEX||by.TX)pairs.push({spot:by.TAIEX,future:by.TX});
  if(by.SPX||by.ES)pairs.push({spot:by.SPX,future:by.ES});
  if(by.NDX||by.NQ)pairs.push({spot:by.NDX,future:by.NQ});
  if(by.DJI||by.YM)pairs.push({spot:by.DJI,future:by.YM});
  for(const c of cards){ if(!pairs.some(p=>p.spot===c||p.future===c)) pairs.push({spot:c}); }
  return{cards,pairs:pairs.filter(x=>x.spot||x.future),availableCards:Object.values(CARD_DEFS).map(({key,name,kind,market})=>({key,name,kind,market})),selected:keys,updatedAt:new Date().toISOString(),note:'市場指數與期貨採公開資料來源，可能延遲；首頁最多顯示 8 檔，可自由加入或刪減；台灣加權指數與台指期預設為獨立卡片。'};
}
async function sectorMode(){
  const channels=[];for(let i=1;i<=31;i++)channels.push(`tse_t${String(i).padStart(2,'0')}.tw`);
  const arr=await mis(channels);const sectors=[];
  for(const q of arr){const x=misQuote(q);if(x.price==null||x.prev==null||!x.name||x.name==='-')continue;sectors.push(x)}
  sectors.sort((a,b)=>(b.changePct??-999)-(a.changePct??-999));
  return{sectors,updatedAt:new Date().toISOString(),source:'TWSE MIS 公開市況'};
}
async function contribMode(){
  const [master,day,idxA]=await Promise.all([
    json(`${TWSE}/opendata/t187ap03_L`,6500),
    json(`${TWSE}/exchangeReport/STOCK_DAY_ALL`,6500),
    mis(['tse_t00.tw']).catch(()=>[])
  ]);
  const mm=new Map();for(const r of Array.isArray(master)?master:[]){const code=txt(pick(r,['公司代號','Code']));const shares=num(pick(r,['已發行普通股數或TDR原發行股數','已發行普通股數或TDR原股發行股數','IssueShares','IssuedShares']));if(/^\d{4}$/.test(code)&&shares>0)mm.set(code,{shares,name:txt(pick(r,['公司簡稱','CompanyAbbreviation','公司名稱']))||code})}
  const all=[];let priorCap=0;
  for(const r of Array.isArray(day)?day:[]){const code=txt(r.Code),m=mm.get(code);if(!m)continue;const close=num(r.ClosingPrice),chg=num(r.Change);if(close==null)continue;const prev=chg!=null?close-chg:close;if(!(prev>0))continue;const cap=prev*m.shares;priorCap+=cap;all.push({code,name:r.Name||m.name,shares:m.shares,close,prev,change:chg,cap})}
  all.sort((a,b)=>b.cap-a.cap);const top=all.slice(0,45);
  let live=[];try{live=await mis(top.map(x=>`tse_${x.code}.tw`))}catch{}
  const lm=new Map(live.map(q=>[txt(q.c),misQuote(q)]));
  const idx=idxA[0]?misQuote(idxA[0]):null;const prevIndex=idx?.prev||null;const base=priorCap>0&&prevIndex>0?priorCap/prevIndex:null;
  const rows=top.map(x=>{const l=lm.get(x.code);const cur=l?.price??x.close;const delta=cur-x.prev;return{code:x.code,name:x.name,price:cur,prev:x.prev,change:delta,changePct:x.prev?delta/x.prev*100:null,points:base?delta*x.shares/base:null,cap:x.cap}}).filter(x=>Number.isFinite(x.points));
  const positive=rows.filter(x=>x.points>0).sort((a,b)=>b.points-a.points).slice(0,6);const negative=rows.filter(x=>x.points<0).sort((a,b)=>a.points-b.points).slice(0,6);
  return{index:idx,positive,negative,updatedAt:new Date().toISOString(),source:'TWSE MIS + TWSE OpenAPI',estimated:true,note:'點數貢獻依公開股本、價格與加權指數市值法近似估算，非交易所正式貢獻值。'};
}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
  const mode=String(req.query?.mode||'global');res.setHeader('Cache-Control',mode==='contrib'?'s-maxage=15, stale-while-revalidate=20':'s-maxage=5, stale-while-revalidate=5');
  try{
    if(mode==='global')return res.status(200).json(await globalMode(req));
    if(mode==='sectors')return res.status(200).json(await sectorMode());
    if(mode==='contrib')return res.status(200).json(await contribMode());
    return res.status(400).json({error:'mode 不支援'});
  }catch(e){return res.status(200).json({error:e?.name==='AbortError'?'資料來源逾時':e.message||'市場總覽暫時無法取得',mode})}
};
