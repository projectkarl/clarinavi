const UA='Mozilla/5.0 (compatible; ClariNavi/Current; +https://vercel.app)';
const NAMES={AAPL:'Apple',MSFT:'Microsoft',NVDA:'NVIDIA',AMZN:'Amazon',GOOGL:'Alphabet',GOOG:'Alphabet',META:'Meta Platforms',TSLA:'Tesla',AVGO:'Broadcom',AMD:'AMD',NFLX:'Netflix',PLTR:'Palantir',MU:'Micron',TSM:'TSMC ADR',ASML:'ASML',QCOM:'Qualcomm',INTC:'Intel',ORCL:'Oracle',CRM:'Salesforce',JPM:'JPMorgan Chase',V:'Visa',MA:'Mastercard',COST:'Costco',WMT:'Walmart',SPY:'SPDR S&P 500 ETF',QQQ:'Invesco QQQ ETF',VOO:'Vanguard S&P 500 ETF',IWM:'iShares Russell 2000 ETF',SMH:'VanEck Semiconductor ETF'};
async function fetchJson(url,headers={},timeout=8500){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*',...headers}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
const num=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
function sma(a,n){const o=Array(a.length).fill(null);let s=0;for(let i=0;i<a.length;i++){s+=a[i];if(i>=n)s-=a[i-n];if(i>=n-1)o[i]=s/n}return o}
function ema(a,n){const o=Array(a.length).fill(null),k=2/(n+1);let p=null;for(let i=0;i<a.length;i++){const x=a[i];if(!Number.isFinite(x))continue;p=p==null?x:x*k+p*(1-k);o[i]=p}return o}
function rsi(a,n=14){const o=Array(a.length).fill(null);if(a.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){const d=a[i]-a[i-1];d>=0?g+=d:l-=d}let ag=g/n,al=l/n;o[n]=al===0?100:100-100/(1+ag/al);for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1];ag=(ag*(n-1)+Math.max(d,0))/n;al=(al*(n-1)+Math.max(-d,0))/n;o[i]=al===0?100:100-100/(1+ag/al)}return o}
function macd(a){const e12=ema(a,12),e26=ema(a,26),dif=a.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null),seed=dif.map(x=>x??0),dea=ema(seed,9).map((x,i)=>dif[i]==null?null:x),hist=dif.map((x,i)=>x!=null&&dea[i]!=null?(x-dea[i])*2:null);return{dif,dea,hist}}
function kd(rows,n=9){const K=Array(rows.length).fill(null),D=Array(rows.length).fill(null);let k=50,d=50;for(let i=n-1;i<rows.length;i++){const w=rows.slice(i-n+1,i+1),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low)),rv=hi===lo?50:(rows[i].close-lo)/(hi-lo)*100;k=k*2/3+rv/3;d=d*2/3+k/3;K[i]=k;D[i]=d}return{k:K,d:D}}
function boll(a,n=20){const mid=sma(a,n),up=Array(a.length).fill(null),lo=Array(a.length).fill(null);for(let i=n-1;i<a.length;i++){const w=a.slice(i-n+1,i+1),m=mid[i],sd=Math.sqrt(w.reduce((s,x)=>s+(x-m)**2,0)/n);up[i]=m+2*sd;lo[i]=m-2*sd}return{mid,upper:up,lower:lo}}
function last(a){for(let i=a.length-1;i>=0;i--)if(Number.isFinite(a[i]))return a[i];return null}
function build(rows){const c=rows.map(x=>x.close),ma5=sma(c,5),ma10=sma(c,10),ma20=sma(c,20),ma60=sma(c,60),rs=rsi(c),mc=macd(c),st=kd(rows),bb=boll(c),dated=a=>rows.map((r,i)=>Number.isFinite(a[i])?{time:r.date,value:a[i]}:null).filter(Boolean);return{current:{ma5:last(ma5),ma10:last(ma10),ma20:last(ma20),ma60:last(ma60),rsi14:last(rs),macd:{dif:last(mc.dif),dea:last(mc.dea),hist:last(mc.hist)},kd:{k:last(st.k),d:last(st.d)},boll:{mid:last(bb.mid),upper:last(bb.upper),lower:last(bb.lower)}},series:{ma5:dated(ma5),ma10:dated(ma10),ma20:dated(ma20),ma60:dated(ma60),rsi:dated(rs),macdDif:dated(mc.dif),macdDea:dated(mc.dea),macdHist:dated(mc.hist),kdK:dated(st.k),kdD:dated(st.d),bollMid:dated(bb.mid),bollUpper:dated(bb.upper),bollLower:dated(bb.lower)}}}
function analyze(rows,s,ind){const p=s.close,c=ind.current,r20=rows.slice(-20),v=rows.map(x=>x.volume||0),v5=sma(v,5).at(-1),v20=sma(v,20).at(-1),vr=v5&&v20?v5/v20:null;let score=50,why=[];if(p>c.ma20){score+=12;why.push('股價站上 MA20')}else score-=10;if(c.ma5>c.ma20){score+=10;why.push('MA5 高於 MA20')}if(c.ma20>c.ma60){score+=8;why.push('MA20 高於 MA60')}if(c.rsi14>=50&&c.rsi14<=70){score+=8;why.push('RSI 位於多方但未過熱')}else if(c.rsi14>75){score-=8;why.push('RSI 偏熱')}if(c.macd.hist>0){score+=8;why.push('MACD 動能為正')}else score-=7;if(c.kd.k>c.kd.d&&c.kd.k<85)score+=5;if(vr>1.2&&s.change>0){score+=5;why.push('量價同步升溫')}score=Math.max(0,Math.min(100,Math.round(score)));let label=score>=72?'偏多觀察':score<=38?'風險偏高':'中性觀察',level=score>=72?'positive':score<=38?'negative':'neutral';if(c.rsi14>80){label='過熱警示';level='warning'}return{...c,volumeRatio:vr,support20:r20.length?Math.min(...r20.map(x=>x.low)):null,resistance20:r20.length?Math.max(...r20.map(x=>x.high)):null,score,label,level,reasons:why.slice(0,6)}}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-AV-Key');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method==='OPTIONS')return res.status(204).end();
 const symbol=String(req.query?.symbol||'').trim().toUpperCase(),mode=String(req.query?.mode||'quote').trim().toLowerCase();
 if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol))return res.status(400).json({error:'美股代號格式錯誤'});
 const key=String(req.headers['x-av-key']||req.query?.key||'').trim();
 if(!key)return res.status(200).json({needsKey:true,symbol,note:'美股免費合法模式需要使用者自己的 Alpha Vantage API Key；Key 只由本次請求轉接，不寫入伺服器。免費層為日線 / EOD，不宣稱即時。'});
 try{

  if(mode==='intraday'){
   const interval=String(req.query?.interval||'1min').trim();
   const allowed=new Set(['1min','5min','15min','30min','60min']);
   const iv=allowed.has(interval)?interval:'1min';
   const url=`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(iv)}&outputsize=compact&extended_hours=false&apikey=${encodeURIComponent(key)}`;
   const j=await fetchJson(url);
   if(j.Note||j.Information||j['Error Message'])return res.status(200).json({symbol,needsKey:true,error:j.Note||j.Information||j['Error Message']});
   const keyName=Object.keys(j).find(k=>/^Time Series \(/.test(k));
   const ts=keyName?j[keyName]:null;
   if(!ts)return res.status(200).json({symbol,error:'Alpha Vantage 未回傳盤中資料',rawMeta:j['Meta Data']||null});
   const rows=Object.entries(ts).map(([dt,x])=>{
     const time=Math.floor(Date.parse(dt.replace(' ','T')+'-05:00')/1000);
     return {datetime:dt,time,open:num(x['1. open']),high:num(x['2. high']),low:num(x['3. low']),close:num(x['4. close']),volume:num(x['5. volume'])};
   }).filter(x=>Number.isFinite(x.time)&&[x.open,x.high,x.low,x.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
   const lastDate=rows.at(-1)?.datetime?.slice(0,10);
   const dayRows=lastDate?rows.filter(x=>x.datetime.startsWith(lastDate)).slice(-390):rows.slice(-390);
   return res.status(200).json({symbol,name:NAMES[symbol]||symbol,interval:iv,sessionDate:lastDate,rows:dayRows,source:'Alpha Vantage TIME_SERIES_INTRADAY',note:'使用者自己的 Alpha Vantage API Key 讀取美股盤中線；更新頻率、延遲、可用額度與授權依資料源規則，公開商用前應確認市場資料展示授權。'});
  }

  if(mode==='profile'){
   const j=await fetchJson(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`);
   if(j.Note||j.Information||j['Error Message'])return res.status(200).json({symbol,error:j.Note||j.Information||j['Error Message']});
   if(!j.Symbol)return res.status(200).json({symbol,error:'Alpha Vantage 未回傳公司基本資料'});
   return res.status(200).json({symbol,profile:{
    name:j.Name||symbol,description:j.Description||'',exchange:j.Exchange||'',currency:j.Currency||'',country:j.Country||'',
    sector:j.Sector||'',industry:j.Industry||'',address:j.Address||'',fiscalYearEnd:j.FiscalYearEnd||'',
    marketCap:num(j.MarketCapitalization),pe:num(j.PERatio),peg:num(j.PEGRatio),bookValue:num(j.BookValue),eps:num(j.EPS),
    dividendPerShare:num(j.DividendPerShare),dividendYield:num(j.DividendYield),profitMargin:num(j.ProfitMargin),
    operatingMargin:num(j.OperatingMarginTTM),roe:num(j.ReturnOnEquityTTM),revenueTTM:num(j.RevenueTTM),
    week52High:num(j['52WeekHigh']),week52Low:num(j['52WeekLow']),analystTarget:num(j.AnalystTargetPrice)
   },source:'Alpha Vantage OVERVIEW（使用者自己的免費 API Key，按需載入）'});
  }
  const j=await fetchJson(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(key)}`);
  if(j.Note||j.Information||j['Error Message'])return res.status(200).json({needsKey:true,symbol,error:j.Note||j.Information||j['Error Message']});
  const ts=j['Time Series (Daily)'];if(!ts)return res.status(200).json({symbol,error:'Alpha Vantage 未回傳日線資料'});
  const rows=Object.entries(ts).map(([date,x])=>({date,open:num(x['1. open']),high:num(x['2. high']),low:num(x['3. low']),close:num(x['4. close']),volume:num(x['5. volume'])})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).sort((a,b)=>a.date.localeCompare(b.date));
  const cur=rows.at(-1),prev=rows.at(-2),snapshot={market:'US',code:symbol,name:NAMES[symbol]||j['Meta Data']?.['2. Symbol']||symbol,date:cur?.date,open:cur?.open,high:cur?.high,low:cur?.low,close:cur?.close,volume:cur?.volume,prevClose:prev?.close,change:cur&&prev?cur.close-prev.close:null,changePct:cur&&prev&&prev.close?(cur.close-prev.close)/prev.close*100:null,isRealtimePrice:false,source:'Alpha Vantage free EOD / daily',assetHint:/^(SPY|QQQ|VOO|IWM|SMH|DIA|VTI|ARKK|XLK|XLF|XLV|XLE)$/.test(symbol)?'ETF':'STOCK'};
  const ind=build(rows),analysis=analyze(rows,snapshot,ind);
  return res.status(200).json({snapshot,analysis,experts:[],history:rows,series:ind.series,meta:{generatedAt:new Date().toISOString(),tradingDays:rows.length,latencyType:'免費日線 / EOD（非即時）',disclaimer:'美股即時與 15 分鐘延遲行情受交易所授權規範。此免費模式僅使用使用者自身 API Key 取得日線資料，不提供公開即時轉播。'}});
 }catch(e){return res.status(502).json({symbol,error:e.message||'美股資料讀取失敗'})}
};
