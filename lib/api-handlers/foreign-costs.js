const UA='Mozilla/5.0 (compatible; ClariNavi/Current; institutional historical cost estimate)';
const DEFAULT_CODES=['2330','2454','2308','2317','2382','3231','6669','3661'];
const FINMIND='https://api.finmindtrade.com/api/v4/data';
const EARLIEST_REQUEST='2004-10-01';
function send(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
function txt(v){return String(v??'').replace(/\s+/g,' ').trim()}
function num(v){if(v==null||v==='')return null;const n=Number(String(v).replace(/,/g,'').replace(/--|－/g,'').trim());return Number.isFinite(n)?n:null}
async function fetchJson(url,timeout=12000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*','Accept-Language':'zh-TW,zh;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function qs(dataset,code){const u=new URL(FINMIND);u.searchParams.set('dataset',dataset);u.searchParams.set('data_id',code);u.searchParams.set('start_date',EARLIEST_REQUEST);return u.toString()}
function institutionBucket(name){const s=txt(name).toLowerCase().replace(/[\s-]+/g,'_');if(s.includes('foreign'))return 'foreign';if(s.includes('investment_trust')||s.includes('trust'))return 'trust';if(s.includes('dealer'))return 'dealer';return null}
function normalizeInstitutionRows(data){
  const daily=new Map();
  for(const r of Array.isArray(data)?data:[]){
    const date=txt(r.date||r.Date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    let item=daily.get(date);if(!item){item={date,foreign:0,trust:0,dealer:0,name:txt(r.stock_name||r.name||'')};daily.set(date,item)}
    // Long-format FinMind dataset: name + buy + sell.
    const bucket=institutionBucket(r.name||r.institutional_investors||r.institution);
    if(bucket){const buy=num(r.buy)??0,sell=num(r.sell)??0;item[bucket]+=buy-sell;continue;}
    // Wide-format compatibility if the API changes or a cached wide result is supplied.
    const pairs={
      foreign:['Foreign_Investor','Foreign_Dealer_Self'],
      trust:['Investment_Trust'],
      dealer:['Dealer','Dealer_self','Dealer_Hedging']
    };
    for(const [kind,names] of Object.entries(pairs)){
      let net=0,seen=false;
      for(const k of names){const b=num(r[`${k}_buy`]),s=num(r[`${k}_sell`]);if(b!=null||s!=null){net+=(b||0)-(s||0);seen=true}}
      if(seen)item[kind]+=net;
    }
  }
  return [...daily.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function normalizePrices(data){const map=new Map();for(const r of Array.isArray(data)?data:[]){const date=txt(r.date||r.Date),close=num(r.close??r.Close);if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&close!=null)map.set(date,close)}return map}
function calcLine(rows,priceMap,key){const matched=rows.map(r=>({date:r.date,net:num(r[key])||0,close:priceMap.get(r.date)})).filter(r=>r.close!=null);const buys=matched.filter(r=>r.net>0);const buyShares=buys.reduce((a,r)=>a+r.net,0);const cost=buyShares>0?buys.reduce((a,r)=>a+r.net*r.close,0)/buyShares:null;const netShares=matched.reduce((a,r)=>a+r.net,0);return {cost,netShares,buyShares,sampleDays:matched.length,firstDate:matched[0]?.date||null,lastDate:matched.at(-1)?.date||null,method:'歷史買超日淨買超股數加權收盤價'};}
function signal(current,line,label){if(current==null||!line?.sampleDays)return `${label}樣本不足`;if(line.cost==null)return `${label}歷史買超樣本不足`;return current>=line.cost?`現價在${label}歷史估算成本上方`:`現價低於${label}歷史估算成本`;}
async function fetchCode(code){
  const [instJ,priceJ]=await Promise.all([fetchJson(qs('TaiwanStockInstitutionalInvestorsBuySell',code),15000),fetchJson(qs('TaiwanStockPrice',code),15000)]);
  if(instJ?.status!==200&&instJ?.status!==undefined)throw new Error(`法人資料 ${instJ?.msg||instJ?.status}`);
  if(priceJ?.status!==200&&priceJ?.status!==undefined)throw new Error(`價格資料 ${priceJ?.msg||priceJ?.status}`);
  const inst=normalizeInstitutionRows(instJ?.data),priceMap=normalizePrices(priceJ?.data),prices=[...priceMap.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const foreign=calcLine(inst,priceMap,'foreign'),trust=calcLine(inst,priceMap,'trust'),dealer=calcLine(inst,priceMap,'dealer');
  const starts=[foreign.firstDate,trust.firstDate,dealer.firstDate].filter(Boolean).sort();const ends=[foreign.lastDate,trust.lastDate,dealer.lastDate].filter(Boolean).sort();
  const current=prices.at(-1)?.[1]??null,name=inst.find(r=>r.name)?.name||code;
  return {code,name,current,lines:{foreign,trust,dealer},foreign,trust,dealer,accumulated:foreign,historyStart:starts[0]||null,historyEnd:ends.at(-1)||null,lastDate:prices.at(-1)?.[0]||ends.at(-1)||null,signal:signal(current,foreign,'外資'),signals:{foreign:signal(current,foreign,'外資'),trust:signal(current,trust,'投信'),dealer:signal(current,dealer,'自營商')}};
}
async function mapLimit(items,limit,fn){let i=0;const out=new Array(items.length);async function worker(){while(i<items.length){const j=i++;try{out[j]=await fn(items[j])}catch(e){out[j]={code:items[j],error:e.message}}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');res.setHeader('Access-Control-Allow-Origin','*');
  let codes=txt(req.query?.codes).split(/[ ,，、\n\t]+/).map(x=>x.trim().toUpperCase()).filter(x=>/^\d{4,6}[A-Z]?$/.test(x));if(!codes.length)codes=DEFAULT_CODES;codes=[...new Set(codes)].slice(0,12);
  try{
    const raw=await mapLimit(codes,codes.length===1?1:3,fetchCode),items=raw.filter(x=>x&&!x.error),errors=raw.filter(x=>x?.error).map(x=>`${x.code}: ${x.error}`);
    const starts=items.map(x=>x.historyStart).filter(Boolean).sort(),ends=items.map(x=>x.historyEnd).filter(Boolean).sort();
    return send(res,200,{ok:items.length>0,items,errors,requestedStart:EARLIEST_REQUEST,historyStart:starts[0]||null,historyEnd:ends.at(-1)||null,source:'FinMind TaiwanStockInstitutionalInvestorsBuySell + TaiwanStockPrice（公開資料彙整）',officialReference:'TWSE T86 網頁可查資料自 2012-05-02 起；TWSE Data E-Shop 的法人明細產品標示起始日 2004-10-01。',note:'三線為外資、投信、自營商的歷史成本估算。每條線從資料源實際可取得且能對齊收盤價的最早日期開始，以「淨買超為正的交易日」按淨買超股數加權收盤價。這是研究估算，不代表法人真實庫存成本；賣出、借券、避險、跨帳戶與盤中成交均可能使真實成本不同。'});
  }catch(e){return send(res,200,{ok:false,items:[],errors:[e.message],requestedStart:EARLIEST_REQUEST,source:'FinMind + TWSE reference',note:'歷史法人成本資料暫時無法取得。'});}
};
