const MIS='https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
function n(v){const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:null}
async function pull(codes){
  const channels=codes.flatMap(c=>[`tse_${c}.tw`,`otc_${c}.tw`]).join('|');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4000);
  try{
    const r=await fetch(`${MIS}?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ClariNavi/Current)','Accept':'application/json,text/plain,*/*','Referer':'https://mis.twse.com.tw/stock/fibest.jsp'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json(),arr=Array.isArray(j?.msgArray)?j.msgArray:[];
    const out=new Map();
    for(const q of arr){const code=String(q.c||'').trim();if(!codes.includes(code))continue;const px=n(q.z),prev=n(q.y),price=px??prev,change=px!=null&&prev!=null?px-prev:null,market=String(q.ex||'').toLowerCase()==='tse'?'TWSE':'TPEx';const cur=out.get(code);if(!cur||px!=null)out.set(code,{code,name:q.n||code,market,price,prevClose:prev,change,changePct:change!=null&&prev?change/prev*100:null,date:String(q.d||''),time:String(q.t||''),isRealtime:px!=null,source:'TWSE MIS 公開市況'});}
    return [...out.values()];
  }finally{clearTimeout(timer)}
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=8');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
  const codes=[...new Set(String(req.query?.codes||'').split(',').map(x=>x.trim().toUpperCase()).filter(x=>/^\d{4,6}[A-Z]?$/.test(x)))].slice(0,80);
  if(!codes.length)return res.status(400).json({error:'請提供股票代號'});
  try{let items=[];for(let i=0;i<codes.length;i+=30){const part=await pull(codes.slice(i,i+30));items.push(...part)}return res.status(200).json({items,updatedAt:new Date().toISOString(),source:'TWSE MIS 公開市況',note:'盤中公開行情為快照；非交易所逐筆授權行情。'});}catch(e){return res.status(200).json({items:[],updatedAt:new Date().toISOString(),error:e?.name==='AbortError'?'行情來源逾時':e.message});}
};

module.exports.pull=pull;
