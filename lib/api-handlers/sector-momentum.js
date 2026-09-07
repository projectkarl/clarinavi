const UA='Mozilla/5.0 (compatible; ClariNavi/Current; public-data-research)';
const TWSE='https://openapi.twse.com.tw/v1';

function clean(v){return String(v??'').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim()}
function num(v){
  if(v===null||v===undefined)return null;
  const s=String(v).replace(/,/g,'').replace(/＋/g,'+').replace(/%/g,'').trim();
  if(!s||s==='-'||s==='--'||s==='X'||s==='除權息'||s==='N/A')return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&clean(o[k])!=='')return o[k]}return null}
async function fetchJson(url,timeout=6500){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}
function taipeiDate(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,p)=>(a[p.type]=p.value,a),{});
  return `${parts.year}${parts.month}${parts.day}`;
}
function isoFromYmd(ymd){return `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`}
function normalizeDate(v,fallback=''){const s=clean(v);if(/^\d{8}$/.test(s))return isoFromYmd(s);const roc=s.match(/^(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);if(roc)return `${Number(roc[1])+1911}-${String(Number(roc[2])).padStart(2,'0')}-${String(Number(roc[3])).padStart(2,'0')}`;return s||fallback}
function ymdOffset(baseYmd,delta){const d=new Date(Date.UTC(+baseYmd.slice(0,4),+baseYmd.slice(4,6)-1,+baseYmd.slice(6,8)));d.setUTCDate(d.getUTCDate()+delta);return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`}
function rocTitleDate(s){
  const m=String(s||'').match(/(\d{2,3})年\s*(\d{1,2})月\s*(\d{1,2})日/); if(!m)return null;
  return `${+m[1]+1911}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
}

const INDUSTRIES={
'01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造','15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他','21':'化學工業','22':'生技醫療業','23':'油電燃氣業','24':'半導體業','25':'電腦及週邊設備業','26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業','31':'其他電子業','32':'文化創意業','33':'農業科技業','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活','80':'管理股票'};
async function companyMap(){
  const out=new Map();
  try{
    const rows=await fetchJson(`${TWSE}/opendata/t187ap03_L`,7500);
    for(const r of Array.isArray(rows)?rows:[]){
      const code=clean(pick(r,['公司代號','公司代碼','SecuritiesCompanyCode','Code','SecuritiesCode']));
      if(!/^\d{4}$/.test(code))continue;
      let ind=clean(pick(r,['產業別','產業別代碼','SecuritiesIndustryCode','IndustryCode','Industry']));
      if(/^\d+$/.test(ind))ind=ind.padStart(2,'0');
      const industry=INDUSTRIES[ind]||clean(pick(r,['產業類別','IndustryName']))||'未分類';
      out.set(code,{industryCode:ind||'00',industry,name:clean(pick(r,['公司簡稱','公司名稱','CompanyAbbreviation','CompanyName','Name']))||code});
    }
  }catch(e){}
  return out;
}
function normaliseRowsFromRwd(j,requestedYmd){
  const fields=Array.isArray(j?.fields)?j.fields.map(clean):[];
  const data=Array.isArray(j?.data)?j.data:[];
  if(!fields.length||!data.length)return null;
  const idx=(names)=>{for(const n of names){const i=fields.findIndex(f=>f===n||f.includes(n));if(i>=0)return i}return -1};
  const iCode=idx(['證券代號','Code']),iName=idx(['證券名稱','Name']),iValue=idx(['成交金額','TradeValue']),iClose=idx(['收盤價','ClosingPrice']),iChange=idx(['漲跌價差','Change']),iVolume=idx(['成交股數','TradeVolume']);
  if(iCode<0||iValue<0)return null;
  const date=rocTitleDate(j?.title)||isoFromYmd(requestedYmd);
  const rows=[];
  for(const a of data){
    const code=clean(a[iCode]); if(!/^\d{4}$/.test(code))continue;
    rows.push({code,name:clean(a[iName]),tradeValue:num(a[iValue]),close:num(a[iClose]),change:num(a[iChange]),volume:num(a[iVolume])});
  }
  return {date,rows};
}
function normaliseRowsFromOpenApi(rows){
  const out=[];let date='';
  for(const r of Array.isArray(rows)?rows:[]){
    const code=clean(pick(r,['Code','證券代號','SecuritiesCode'])); if(!/^\d{4}$/.test(code))continue;
    out.push({code,name:clean(pick(r,['Name','證券名稱','SecuritiesName'])),tradeValue:num(pick(r,['TradeValue','成交金額'])),close:num(pick(r,['ClosingPrice','收盤價'])),change:num(pick(r,['Change','漲跌價差'])),volume:num(pick(r,['TradeVolume','成交股數']))});
    const d=clean(pick(r,['Date','日期'])); if(d)date=d;
  }
  return {date:normalizeDate(date,isoFromYmd(taipeiDate())),rows:out};
}
async function dayRows(ymd,latest=false){
  if(latest){
    try{
      const j=await fetchJson(`${TWSE}/exchangeReport/STOCK_DAY_ALL`,6500);
      const x=normaliseRowsFromOpenApi(j); if(x.rows.length)return x;
    }catch(e){}
  }
  const url=`https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?date=${ymd}&response=json&_=${ymd}`;
  const j=await fetchJson(url,6500);
  return normaliseRowsFromRwd(j,ymd);
}
function aggregate(day,map){
  const bucket=new Map();
  for(const r of day.rows||[]){
    const m=map.get(r.code); if(!m)continue;
    const tv=num(r.tradeValue),chg=num(r.change),close=num(r.close);
    if(!(tv>0))continue;
    const key=m.industryCode+'|'+m.industry;
    let b=bucket.get(key); if(!b)bucket.set(key,b={industryCode:m.industryCode,industry:m.industry,flowIn:0,flowOut:0,neutral:0,netFlow:0,turnover:0,advancers:0,decliners:0,unchanged:0,weightedChange:0,weightBase:0,leaders:[]});
    if(chg>0){b.flowIn+=tv;b.netFlow+=tv;b.advancers++}
    else if(chg<0){b.flowOut+=tv;b.netFlow-=tv;b.decliners++}
    else{b.neutral+=tv;b.unchanged++}
    b.turnover+=tv;
    if(close&&chg!=null){const prev=close-chg;if(prev>0){b.weightedChange+=(chg/prev*100)*tv;b.weightBase+=tv}}
    b.leaders.push({code:r.code,name:r.name||m.name,tradeValue:tv,change:chg,close});
  }
  return [...bucket.values()].map(b=>{b.changePct=b.weightBase?b.weightedChange/b.weightBase:null;b.leaders=b.leaders.sort((a,b)=>b.tradeValue-a.tradeValue).slice(0,5);return b}).sort((a,b)=>b.turnover-a.turnover);
}

module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
  try{
    const days=Math.max(1,Math.min(5,Number(req.query?.days)||5));
    const base=clean(req.query?.date).replace(/-/g,'')||taipeiDate();
    const cmap=await companyMap();
    const frames=[];const seen=new Set();const maxDate=isoFromYmd(base);
    for(let back=0;back<32&&frames.length<days;back++){
      const y=ymdOffset(base,-back);
      try{
        const d=await dayRows(y,back===0);
        if(!d||!Array.isArray(d.rows)||!d.rows.length)continue;
        const date=normalizeDate(d.date,isoFromYmd(y));
        if(date>maxDate||seen.has(date))continue;seen.add(date);
        const sectors=aggregate(d,cmap);if(!sectors.length)continue;
        frames.push({date,sectors});
      }catch(e){}
    }
    frames.sort((a,b)=>a.date.localeCompare(b.date));
    const latest=frames.at(-1)||null;
    const total={flowIn:0,flowOut:0,neutral:0,netFlow:0,turnover:0};
    if(latest){for(const s of latest.sectors){total.flowIn+=s.flowIn;total.flowOut+=s.flowOut;total.neutral+=s.neutral;total.netFlow+=s.netFlow;total.turnover+=s.turnover}}
    return res.status(200).json({ok:true,days:frames.length,requestedDays:days,frames,latest,total,source:'TWSE 官方公開日成交金額與上市公司產業分類',definition:'量價動能金額 = 上漲股票成交金額 - 下跌股票成交金額；用於教學觀察，不等於實際資金流或法人買賣。',note:'目前採上市公司公開資料聚合，為維持輕量與合規，未抓取第三方網頁，也不宣稱為券商即時資金流。'});
  }catch(e){
    return res.status(200).json({ok:false,error:e?.name==='AbortError'?'資料來源逾時':e.message||'板塊動能暫時無法取得',frames:[]});
  }
};
