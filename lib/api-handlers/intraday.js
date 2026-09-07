/* ClariNavi v10.3 — official/lightweight intraday.
   Tries TWSE MIS chart OHLC first. If the public endpoint is unavailable,
   returns a clear unavailable response instead of fabricating a line. */
const MIS='https://mis.twse.com.tw/stock/api';
const UA='Mozilla/5.0 (compatible; ClariNavi/Current; public intraday chart)';
function send(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
function num(v){if(v==null)return null;const n=Number(String(v).replace(/,/g,'').trim());return Number.isFinite(n)?n:null;}
function pad(n){return String(n).padStart(2,'0')}
function today(){const d=new Date();return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`}
async function getJson(url,ms=4200){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*','Referer':'https://mis.twse.com.tw/stock/fibest.jsp'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function parseRows(j){
  const arr=Array.isArray(j?.ohlcArray)?j.ohlcArray:Array.isArray(j?.data)?j.data:Array.isArray(j?.msgArray)?j.msgArray:[];
  const rows=[];
  for(const r of arr){
    if(Array.isArray(r)){
      const t=String(r[0]||'').replace(/:/g,'');
      if(!/^\d{4,6}$/.test(t))continue;
      const hh=+t.slice(0,2),mm=+t.slice(2,4),ss=+(t.slice(4,6)||0);
      rows.push({time:hh*3600+mm*60+ss,open:num(r[1]),high:num(r[2]),low:num(r[3]),close:num(r[4]),volume:num(r[5])});
    }else if(r&&typeof r==='object'){
      const raw=String(r.t||r.time||r.T||'').replace(/:/g,'');
      if(!/^\d{4,6}$/.test(raw))continue;
      const hh=+raw.slice(0,2),mm=+raw.slice(2,4),ss=+(raw.slice(4,6)||0);
      rows.push({time:hh*3600+mm*60+ss,open:num(r.o||r.open),high:num(r.h||r.high),low:num(r.l||r.low),close:num(r.c||r.close||r.z),volume:num(r.v||r.volume)});
    }
  }
  const m=new Map();
  for(const x of rows.filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.close)))m.set(x.time,x);
  return [...m.values()].sort((a,b)=>a.time-b.time);
}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=8');
  const code=String(req.query?.code||'').trim().toUpperCase(), market=String(req.query?.market||'TWSE').toUpperCase();
  if(!/^\d{4,6}[A-Z]?$/.test(code))return send(res,400,{available:false,error:'台股代號格式錯誤'});
  const ex=market.includes('TPEX')||market.includes('OTC')?'otc':'tse';
  const ch=`${ex}_${code}.tw`, date=String(req.query?.date||today()).replace(/[^0-9]/g,'').slice(0,8);
  const urls=[`${MIS}/getChartOhlcStatis.jsp?ex=${encodeURIComponent(ch)}&ch=${encodeURIComponent(ch)}&fqy=1&_=${Date.now()}`,`${MIS}/getChartOhlcStatis.jsp?ex=${encodeURIComponent(ch)}&ch=${encodeURIComponent(ch)}&date=${date}&_=${Date.now()}`];
  const errors=[];
  for(const url of urls){
    try{const j=await getJson(url);const rows=parseRows(j);if(rows.length>=2)return send(res,200,{available:true,code,market,rows,source:'TWSE MIS 公開分時 OHLC',date:j?.date||date,note:'分時圖使用交易所公開 MIS 圖表資料；收盤後通常呈現最近一個可得交易日。'});}catch(e){errors.push(e.message)}
  }
  return send(res,200,{available:false,code,market,rows:[],source:'TWSE MIS 公開市況快照',errors:errors.slice(0,2),note:'目前官方公開分時 OHLC 來源未回傳完整資料；不使用非官方爬蟲補造，改以頁面開啟後取得的公開快照累積。'});
};
