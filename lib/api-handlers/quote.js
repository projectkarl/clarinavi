const MIS_URL='https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
function n(v){const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:null;}
function list(v){return String(v||'').split('_').map(n).filter(Number.isFinite);}
async function get(code){
  const channels=`tse_${code}.tw|otc_${code}.tw`;
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),3500);
  try{
    const r=await fetch(`${MIS_URL}?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ClariNavi/Current)','Accept':'application/json,text/plain,*/*','Referer':'https://mis.twse.com.tw/stock/fibest.jsp'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();const arr=Array.isArray(j?.msgArray)?j.msgArray:[];
    const matches=arr.filter(x=>String(x.c||'').trim()===code&&['tse','otc'].includes(String(x.ex||'').toLowerCase()));if(!matches.length)return null;
    const q=matches.find(x=>n(x.z)!=null)||matches.find(x=>x.n&&x.n!=='-')||matches[0];const price=n(q.z),prev=n(q.y),change=price!=null&&prev!=null?price-prev:null;
    return{available:true,code,name:q.n||code,market:String(q.ex).toLowerCase()==='tse'?'TWSE':'TPEx',date:String(q.d||''),time:String(q.t||''),timestamp:n(q.tlong),price,prevClose:prev,change,changePct:change!=null&&prev?change/prev*100:null,open:n(q.o),high:n(q.h),low:n(q.l),volume:n(q.v),tradeVolume:n(q.tv),upperLimit:n(q.u),lowerLimit:n(q.w),bidPrices:list(q.b),bidVolumes:list(q.g),askPrices:list(q.a),askVolumes:list(q.f),source:'TWSE MIS 公開市況'};
  }finally{clearTimeout(timer);}
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=10');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
  const code=String(req.query?.code||'').trim().toUpperCase();if(!/^\d{4,6}[A-Z]?$/.test(code))return res.status(400).json({error:'股票代號格式錯誤'});
  try{const q=await get(code);return res.status(200).json(q||{available:false,code});}catch(e){return res.status(200).json({available:false,code,error:e?.name==='AbortError'?'即時來源逾時':e.message});}
};
