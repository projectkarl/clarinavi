const CACHE_TTL_MS = 15_000;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();
const sourceCache = new Map();

const TWSE_BASE = 'https://openapi.twse.com.tw/v1';
const TPEX_BASE = 'https://www.tpex.org.tw/openapi/v1';
const MIS_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';

function cleanNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/,/g, '').replace(/--/g, '').replace(/^[＋+]/, '').trim();
  if (!s || s === '-' || s === 'N/A' || s === '除權息') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function rocDateToISO(v) {
  const raw = String(v || '').trim();
  const s = raw.replace(/[\/\-]/g, '');
  if (/^\d{7}$/.test(s)) return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return raw;
}

async function fetchJson(url, timeout = 4500, extraHeaders = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClariNavi/Current)',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.6',
        ...extraHeaders,
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('資料源逾時');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCachedJson(url, ttl = 60_000, timeout = 4500, extraHeaders = {}) {
  const hit = sourceCache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  const data = await fetchJson(url, timeout, extraHeaders);
  sourceCache.set(url, { time: Date.now(), data });
  return data;
}

function monthAnchors(count = 6) {
  const out = [];
  const now = new Date();
  const d = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  for (let i = 0; i < count; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = x.getFullYear();
    const m = String(x.getMonth()+1).padStart(2,'0');
    out.push({ ymd: `${y}${m}01`, slash: `${y}/${m}/01` });
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function uniqSort(rows) {
  const seen = new Map();
  for (const r of rows) if (r.date && Number.isFinite(r.close)) seen.set(r.date, r);
  return [...seen.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function splitNums(v) {
  return String(v || '').split('_').map(cleanNum).filter(Number.isFinite);
}

async function getMisQuote(code) {
  const channels = `tse_${code}.tw|otc_${code}.tw`;
  const url = `${MIS_URL}?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Math.floor(Date.now()/5000)}`;
  const j = await fetchJson(url, 3500, {
    Referer: 'https://mis.twse.com.tw/stock/fibest.jsp',
  });
  const arr = Array.isArray(j?.msgArray) ? j.msgArray : [];
  const matches = arr.filter(x => String(x.c || '').trim().toUpperCase() === code && ['tse','otc'].includes(String(x.ex || '').toLowerCase()));
  if (!matches.length) return null;
  const q = matches.find(x => cleanNum(x.z) != null) || matches.find(x => x.n && x.n !== '-') || matches[0];
  const market = String(q.ex).toLowerCase() === 'tse' ? 'TWSE' : 'TPEx';
  const last = cleanNum(q.z);
  const prevClose = cleanNum(q.y);
  const price = last ?? prevClose;
  const change = last != null && prevClose != null ? last - prevClose : null;
  const changePct = change != null && prevClose ? change / prevClose * 100 : null;
  return {
    market, code,
    name: q.n || q.nf || code,
    date: rocDateToISO(q.d),
    time: String(q.t || ''),
    open: cleanNum(q.o), high: cleanNum(q.h), low: cleanNum(q.l), close: price,
    prevClose, change, changePct,
    volume: cleanNum(q.v), tradeVolume: cleanNum(q.tv),
    upperLimit: cleanNum(q.u), lowerLimit: cleanNum(q.w),
    bidPrices: splitNums(q.b), bidVolumes: splitNums(q.g),
    askPrices: splitNums(q.a), askVolumes: splitNums(q.f),
    isRealtimePrice: last != null,
    source: 'TWSE MIS 公開市況',
  };
}

async function getTwseSnapshot(code) {
  const quotes = await fetchCachedJson(`${TWSE_BASE}/exchangeReport/STOCK_DAY_ALL`, 60_000, 5000);
  if (!Array.isArray(quotes)) throw new Error('TWSE 行情格式異常');
  const q = quotes.find(x => String(x.Code || '').trim().toUpperCase() === code);
  if (!q) return null;
  return {
    market: 'TWSE', code, name: q.Name || code, date: rocDateToISO(q.Date),
    open: cleanNum(q.OpeningPrice), high: cleanNum(q.HighestPrice), low: cleanNum(q.LowestPrice), close: cleanNum(q.ClosingPrice),
    change: cleanNum(q.Change), volume: cleanNum(q.TradeVolume), amount: cleanNum(q.TradeValue), transactions: cleanNum(q.Transaction),
    source: 'TWSE OpenAPI', isRealtimePrice: false,
  };
}

async function getTpexSnapshot(code) {
  const quotes = await fetchCachedJson(`${TPEX_BASE}/tpex_mainboard_quotes`, 60_000, 4500);
  if (!Array.isArray(quotes)) throw new Error('TPEx 行情格式異常');
  const q = quotes.find(x => String(x.SecuritiesCompanyCode || x.Code || '').trim().toUpperCase() === code);
  if (!q) return null;
  return {
    market: 'TPEx', code, name: q.CompanyName || q.Name || code, date: rocDateToISO(q.Date),
    open: cleanNum(q.Open), high: cleanNum(q.High), low: cleanNum(q.Low), close: cleanNum(q.Close),
    change: cleanNum(q.Change), volume: cleanNum(q.TradingShares), amount: cleanNum(q.TransactionAmount), transactions: cleanNum(q.TransactionNumber),
    source: 'TPEx OpenAPI', isRealtimePrice: false,
  };
}

async function getYahooTw(code, preferredMarket = '') {
  const suffixes = preferredMarket === 'TPEx' ? ['TWO','TW'] : preferredMarket === 'TWSE' ? ['TW','TWO'] : ['TW','TWO'];
  let lastError = null;
  for (const suffix of suffixes) {
    try {
      const symbol = `${code}.${suffix}`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y&events=div%2Csplits`;
      const j = await fetchJson(url, 5000);
      const r = j?.chart?.result?.[0]; if (!r) continue;
      const ts = Array.isArray(r.timestamp) ? r.timestamp : [], q = r.indicators?.quote?.[0] || {}, adj = r.indicators?.adjclose?.[0]?.adjclose || [];
      const rows=[];
      for(let i=0;i<ts.length;i++){const close=cleanNum(q.close?.[i] ?? adj[i]);if(!Number.isFinite(close))continue;rows.push({date:new Date(ts[i]*1000).toISOString().slice(0,10),open:cleanNum(q.open?.[i]),high:cleanNum(q.high?.[i]),low:cleanNum(q.low?.[i]),close,volume:cleanNum(q.volume?.[i])});}
      if(!rows.length)continue;
      const last=rows.at(-1),prev=rows.at(-2),meta=r.meta||{},live=cleanNum(meta.regularMarketPrice),prevClose=cleanNum(meta.chartPreviousClose ?? meta.previousClose ?? prev?.close),close=live ?? last.close,change=Number.isFinite(close)&&Number.isFinite(prevClose)?close-prevClose:null;
      return {snapshot:{market:suffix==='TW'?'TWSE':'TPEx',code,name:meta.longName||meta.shortName||code,date:last.date,open:last.open,high:last.high,low:last.low,close,prevClose,change,changePct:change!=null&&prevClose?change/prevClose*100:null,volume:last.volume,isRealtimePrice:false,source:'Yahoo Finance 延遲行情（官方來源無法連線時備援）'},history:rows};
    } catch(e){lastError=e;}
  }
  if(lastError)throw lastError; return null;
}

async function getValuation(code, market) {
  try {
    if (market === 'TWSE') {
      const vals = await fetchCachedJson(`${TWSE_BASE}/exchangeReport/BWIBBU_ALL`, 300_000, 3500);
      const v = Array.isArray(vals) ? vals.find(x => String(x.Code || '').trim().toUpperCase() === code) : null;
      return v ? { pe: cleanNum(v.PEratio), yield: cleanNum(v.DividendYield), pb: cleanNum(v.PBratio) } : {};
    }
    const vals = await fetchCachedJson(`${TPEX_BASE}/tpex_mainboard_peratio_analysis`, 300_000, 3500);
    const v = Array.isArray(vals) ? vals.find(x => String(x.SecuritiesCompanyCode || x.Code || '').trim().toUpperCase() === code) : null;
    return v ? { pe: cleanNum(v.PriceEarningRatio || v.PEratio), yield: cleanNum(v.DividendYield || v.YieldRatio), pb: cleanNum(v.PriceBookRatio || v.PBratio) } : {};
  } catch (_) { return {}; }
}

async function getTwseHistory(code, months) {
  const chunks = await mapLimit(monthAnchors(months), 6, async m => {
    try {
      const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${m.ymd}&stockNo=${encodeURIComponent(code)}&response=json`;
      const j = await fetchCachedJson(url, HISTORY_TTL_MS, 4000);
      if (!(j && j.stat === 'OK' && Array.isArray(j.data))) return [];
      return j.data.map(r => ({ date: rocDateToISO(r[0]), volume: cleanNum(r[1]), amount: cleanNum(r[2]), open: cleanNum(r[3]), high: cleanNum(r[4]), low: cleanNum(r[5]), close: cleanNum(r[6]) }));
    } catch (_) { return []; }
  });
  return uniqSort(chunks.flat());
}

async function getTpexHistory(code, months) {
  const chunks = await mapLimit(monthAnchors(months), 6, async m => {
    try {
      const url = `https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?date=${encodeURIComponent(m.slash)}&code=${encodeURIComponent(code)}&response=json`;
      const j = await fetchCachedJson(url, HISTORY_TTL_MS, 4000);
      const t = j?.tables?.[0];
      if (!Array.isArray(t?.data)) return [];
      return t.data.map(r => ({ date: rocDateToISO(r[0]), volume: cleanNum(r[1]) == null ? null : cleanNum(r[1]) * 1000, amount: cleanNum(r[2]) == null ? null : cleanNum(r[2]) * 1000, open: cleanNum(r[3]), high: cleanNum(r[4]), low: cleanNum(r[5]), close: cleanNum(r[6]) }));
    } catch (_) { return []; }
  });
  return uniqSort(chunks.flat());
}

function smaSeries(a,n){
  const out=new Array(a.length).fill(null); let sum=0,valid=0;
  for(let i=0;i<a.length;i++){
    const x=a[i]; if(Number.isFinite(x)){sum+=x;valid++;}
    if(i>=n){const old=a[i-n];if(Number.isFinite(old)){sum-=old;valid--;}}
    if(i>=n-1&&valid===n)out[i]=sum/n;
  }
  return out;
}
function emaSeries(a,n){
  const out=new Array(a.length).fill(null); const k=2/(n+1); let prev=null;
  for(let i=0;i<a.length;i++){const x=a[i]; if(!Number.isFinite(x))continue; prev=prev==null?x:x*k+prev*(1-k); out[i]=prev;}
  return out;
}
function rsiSeries(a,n=14){
  const out=new Array(a.length).fill(null); if(a.length<=n)return out;
  let gain=0,loss=0;
  for(let i=1;i<=n;i++){const d=a[i]-a[i-1];if(d>=0)gain+=d;else loss-=d;}
  let ag=gain/n,al=loss/n;out[n]=al===0?100:100-(100/(1+ag/al));
  for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1],g=Math.max(d,0),l=Math.max(-d,0);ag=(ag*(n-1)+g)/n;al=(al*(n-1)+l)/n;out[i]=al===0?100:100-(100/(1+ag/al));}
  return out;
}
function macdSeries(a){
  const e12=emaSeries(a,12),e26=emaSeries(a,26),dif=a.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null);
  const dea=emaSeries(dif.map(x=>x==null?0:x),9).map((x,i)=>dif[i]==null?null:x);
  const hist=dif.map((x,i)=>x!=null&&dea[i]!=null?(x-dea[i])*2:null);
  return{dif,dea,hist};
}
function kdSeries(rows,n=9){
  const K=new Array(rows.length).fill(null),D=new Array(rows.length).fill(null);let k=50,d=50;
  for(let i=n-1;i<rows.length;i++){
    const win=rows.slice(i-n+1,i+1),hi=Math.max(...win.map(x=>x.high??x.close)),lo=Math.min(...win.map(x=>x.low??x.close));
    const rsv=hi===lo?50:((rows[i].close-lo)/(hi-lo))*100;k=(2/3)*k+(1/3)*rsv;d=(2/3)*d+(1/3)*k;K[i]=k;D[i]=d;
  }return{k:K,d:D};
}
function bollingerSeries(a,n=20,mult=2){
  const mid=smaSeries(a,n),upper=new Array(a.length).fill(null),lower=new Array(a.length).fill(null);
  for(let i=n-1;i<a.length;i++){
    if(mid[i]==null)continue;const win=a.slice(i-n+1,i+1);if(win.some(x=>!Number.isFinite(x)))continue;
    const variance=win.reduce((s,x)=>s+(x-mid[i])**2,0)/n,sd=Math.sqrt(variance);upper[i]=mid[i]+mult*sd;lower[i]=mid[i]-mult*sd;
  }return{mid,upper,lower};
}
function obvSeries(rows){
  const out=new Array(rows.length).fill(0);let obv=0;
  for(let i=1;i<rows.length;i++){const v=Number.isFinite(rows[i].volume)?rows[i].volume:0;if(rows[i].close>rows[i-1].close)obv+=v;else if(rows[i].close<rows[i-1].close)obv-=v;out[i]=obv;}return out;
}
function slope(arr,lookback=10){
  const xs=arr.slice(-lookback).filter(Number.isFinite);if(xs.length<2)return null;return xs[xs.length-1]-xs[0];
}
function lastFinite(arr){for(let i=arr.length-1;i>=0;i--)if(Number.isFinite(arr[i]))return arr[i];return null;}
function prevFinite(arr){let found=0;for(let i=arr.length-1;i>=0;i--)if(Number.isFinite(arr[i])){found++;if(found===2)return arr[i];}return null;}

function buildIndicators(rows){
  const closes=rows.map(x=>x.close),ma5=smaSeries(closes,5),ma10=smaSeries(closes,10),ma20=smaSeries(closes,20),ma60=smaSeries(closes,60);
  const rsi14=rsiSeries(closes,14),macd=macdSeries(closes),kd=kdSeries(rows,9),boll=bollingerSeries(closes,20,2),obv=obvSeries(rows);
  const dated=(arr,key='value')=>rows.map((r,i)=>Number.isFinite(arr[i])?{time:r.date,[key]:arr[i]}:null).filter(Boolean);
  return {
    current:{ma5:lastFinite(ma5),ma10:lastFinite(ma10),ma20:lastFinite(ma20),ma60:lastFinite(ma60),rsi14:lastFinite(rsi14),macd:{dif:lastFinite(macd.dif),dea:lastFinite(macd.dea),hist:lastFinite(macd.hist)},kd:{k:lastFinite(kd.k),d:lastFinite(kd.d)},boll:{mid:lastFinite(boll.mid),upper:lastFinite(boll.upper),lower:lastFinite(boll.lower)},obv:lastFinite(obv)},
    series:{
      ma5:dated(ma5),ma10:dated(ma10),ma20:dated(ma20),ma60:dated(ma60),
      rsi:dated(rsi14),macdDif:dated(macd.dif),macdDea:dated(macd.dea),macdHist:dated(macd.hist),
      kdK:dated(kd.k),kdD:dated(kd.d),bollMid:dated(boll.mid),bollUpper:dated(boll.upper),bollLower:dated(boll.lower),obv:dated(obv),
    },
    raw:{ma5,ma10,ma20,ma60,rsi14,macd,kd,boll,obv}
  };
}

function expertSignals(rows, ind){
  const closes=rows.map(x=>x.close),price=closes.at(-1),cur=ind.current,raw=ind.raw;
  const cards=[];
  const macdReady=[cur.macd.dif,cur.macd.dea,cur.macd.hist].every(Number.isFinite);
  if(macdReady){
    const pd=prevFinite(raw.macd.dif),ps=prevFinite(raw.macd.dea),macdCrossUp=Number.isFinite(pd)&&Number.isFinite(ps)&&pd<=ps&&cur.macd.dif>cur.macd.dea,macdCrossDn=Number.isFinite(pd)&&Number.isFinite(ps)&&pd>=ps&&cur.macd.dif<cur.macd.dea;
    cards.push({name:'MACD',expert:'Gerald Appel',state:macdCrossUp?'黃金交叉':macdCrossDn?'死亡交叉':cur.macd.hist>0?'多方動能':'空方動能',level:macdCrossUp||cur.macd.hist>0?'positive':'negative',value:`DIF ${fmtNum(cur.macd.dif)} / Signal ${fmtNum(cur.macd.dea)}`,note:'觀察趨勢與動能轉折，柱狀體翻正通常代表短期動能改善。'});
  }else cards.push({name:'MACD',expert:'Gerald Appel',state:'資料不足',level:'neutral',value:'—',note:'需要更多歷史交易日才能形成穩定的趨勢與動能判讀。'});
  const r=cur.rsi14;
  if(Number.isFinite(r))cards.push({name:'RSI 14',expert:'J. Welles Wilder',state:r>=70?'偏熱':r<=30?'超賣區':r>=50?'偏多':'偏弱',level:r>=70?'warning':r<=30?'warning':r>=50?'positive':'negative',value:fmtNum(r,1),note:'50 為多空中軸；70/30 常用作偏熱與超賣參考，不代表必然反轉。'});
  else cards.push({name:'RSI 14',expert:'J. Welles Wilder',state:'資料不足',level:'neutral',value:'—',note:'需要至少約 14 個交易日資料。'});
  const k=cur.kd.k,d=cur.kd.d;
  if(Number.isFinite(k)&&Number.isFinite(d))cards.push({name:'Stochastic KD',expert:'George Lane',state:k>80?'高檔區':k<20?'低檔區':k>d?'K>D 偏多':'K<D 偏弱',level:k>80||k<20?'warning':k>d?'positive':'negative',value:`K ${fmtNum(k,1)} / D ${fmtNum(d,1)}`,note:'用收盤價在近期高低區間的位置衡量短線動能。'});
  else cards.push({name:'Stochastic KD',expert:'George Lane',state:'資料不足',level:'neutral',value:'—',note:'需要更多高低價歷史資料。'});
  const b=cur.boll;
  if(Number.isFinite(price)&&[b.mid,b.upper,b.lower].every(Number.isFinite)){
    const bw=b.mid?((b.upper-b.lower)/b.mid*100):null;
    cards.push({name:'Bollinger Bands',expert:'John Bollinger',state:price>b.upper?'突破上軌':price<b.lower?'跌破下軌':price>b.mid?'中軌之上':'中軌之下',level:price>b.upper?'warning':price<b.lower?'negative':price>b.mid?'positive':'neutral',value:`BandWidth ${fmtNum(bw,1)}%`,note:'價格位置搭配帶寬，可觀察波動擴張、收斂與趨勢延伸。'});
  }else cards.push({name:'Bollinger Bands',expert:'John Bollinger',state:'資料不足',level:'neutral',value:'—',note:'通常需要至少 20 個交易日資料。'});
  const obv=raw.obv,obvSlope=slope(obv,10),pxSlope=slope(closes,10);let obvState='資料不足',obvLevel='neutral';if(Number.isFinite(obvSlope)&&Number.isFinite(pxSlope)){obvState='量價中性';if(obvSlope>0&&pxSlope>0){obvState='量價同步向上';obvLevel='positive';}else if(obvSlope<0&&pxSlope<0){obvState='量價同步向下';obvLevel='negative';}else if(obvSlope>0&&pxSlope<0){obvState='OBV 正背離觀察';obvLevel='warning';}else if(obvSlope<0&&pxSlope>0){obvState='OBV 負背離觀察';obvLevel='warning';}}cards.push({name:'OBV',expert:'Joseph Granville',state:obvState,level:obvLevel,value:`10日變化 ${compactNum(obvSlope)}`,note:'把上漲日成交量加總、下跌日扣除，用來檢查價格走勢是否獲量能確認。'});
  const prior20=rows.slice(-21,-1);const high20=prior20.length>=10?Math.max(...prior20.map(x=>x.high??x.close)):null,low20=prior20.length>=10?Math.min(...prior20.map(x=>x.low??x.close)):null;let dcState='資料不足',dcLevel='neutral';if(Number.isFinite(high20)&&Number.isFinite(low20)&&Number.isFinite(price)){dcState='通道內整理';if(price>=high20){dcState='20日向上突破';dcLevel='positive';}else if(price<=low20){dcState='20日向下跌破';dcLevel='negative';}}cards.push({name:'Donchian 20',expert:'Richard Donchian',state:dcState,level:dcLevel,value:`上 ${fmtNum(high20)} / 下 ${fmtNum(low20)}`,note:'以前 20 個交易日高低點形成突破通道，適合搭配量能過濾假突破。'});
  return cards;
}
function fmtNum(n,d=2){return Number.isFinite(n)?Number(n).toFixed(d).replace(/\.00$/,''):'—';}
function compactNum(n){if(!Number.isFinite(n))return'—';const a=Math.abs(n);if(a>=1e8)return`${(n/1e8).toFixed(1)}億`;if(a>=1e4)return`${(n/1e4).toFixed(1)}萬`;return Math.round(n).toString();}

function analyze(rows, snapshot, indicators){
  const closes=rows.map(x=>x.close).filter(Number.isFinite),vols=rows.map(x=>x.volume).filter(Number.isFinite),price=snapshot.close??closes.at(-1)??null;
  const cur=indicators.current, v5=smaSeries(vols,5).at(-1),v20=smaSeries(vols,20).at(-1),vr=v5&&v20?v5/v20:null,r20=rows.slice(-20);
  const support=r20.length?Math.min(...r20.map(x=>x.low??x.close).filter(Number.isFinite)):null,resistance=r20.length?Math.max(...r20.map(x=>x.high??x.close).filter(Number.isFinite)):null;
  let score=50;const reasons=[];
  if(price!=null&&cur.ma20!=null){if(price>cur.ma20){score+=10;reasons.push('股價站上20日均線');}else{score-=10;reasons.push('股價低於20日均線');}}
  if(cur.ma5!=null&&cur.ma20!=null){if(cur.ma5>cur.ma20){score+=10;reasons.push('MA5 高於 MA20');}else score-=8;}
  if(cur.ma20!=null&&cur.ma60!=null){if(cur.ma20>cur.ma60){score+=8;reasons.push('MA20 高於 MA60，中期結構偏多');}else score-=8;}
  if(cur.rsi14!=null){if(cur.rsi14>=50&&cur.rsi14<=68){score+=8;reasons.push('RSI 偏多且未進入高檔區');}else if(cur.rsi14>75){score-=8;reasons.push('RSI 高檔，留意追價風險');}else if(cur.rsi14<45)score-=5;}
  if(cur.macd.hist!=null){if(cur.macd.hist>0){score+=8;reasons.push('MACD 柱狀體為正');}else score-=8;}
  if(cur.kd.k!=null&&cur.kd.d!=null){if(cur.kd.k>cur.kd.d&&cur.kd.k<85){score+=5;reasons.push('KD K值高於D值');}else if(cur.kd.k>90)score-=5;}
  if(vr!=null&&vr>1.2&&snapshot.change>0){score+=5;reasons.push('短期量能升溫且價格上漲');}
  score=Math.max(0,Math.min(100,Math.round(score)));
  let label='中性觀察',level='neutral';if(score>=72){label='偏多觀察';level='positive';}else if(score<=38){label='風險偏高';level='negative';}if(cur.rsi14>80){label='過熱警示';level='warning';}
  return{...cur,volumeRatio:vr,support20:support,resistance20:resistance,score,label,level,reasons:reasons.slice(0,6)};
}

function mergeSnapshotIntoHistory(history, snapshot) {
  if (!snapshot?.date || !Number.isFinite(snapshot.close)) return history;
  const row={date:snapshot.date,open:snapshot.open??snapshot.close,high:snapshot.high??snapshot.close,low:snapshot.low??snapshot.close,close:snapshot.close,volume:snapshot.volume,amount:snapshot.amount};
  return uniqSort([...history,row]);
}

async function build(code, months){
  const sourceErrors=[];
  let snapshot=null;
  try{snapshot=await getMisQuote(code);}catch(e){sourceErrors.push(`MIS: ${e.message}`);}
  if(!snapshot){
    try{snapshot=await getTwseSnapshot(code);}catch(e){sourceErrors.push(`TWSE: ${e.message}`);}
  }
  if(!snapshot){
    try{snapshot=await getTpexSnapshot(code);}catch(e){sourceErrors.push(`TPEx: ${e.message}`);}
  }
  let yahooFallback=null;
  if(!snapshot){
    try{yahooFallback=await getYahooTw(code);snapshot=yahooFallback?.snapshot||null;if(snapshot)sourceErrors.push('官方即時來源無法連線，已切換延遲備援');}
    catch(e){sourceErrors.push(`備援: ${e.message}`);}
  }
  if(!snapshot)throw new Error(`找不到股票代號，或所有行情來源暫時無法連線${sourceErrors.length?`（${sourceErrors.join('；')}）`:''}`);

  const [valuation, officialHistory] = await Promise.all([
    getValuation(code,snapshot.market),
    yahooFallback?.history ? Promise.resolve([]) : (snapshot.market==='TWSE'?getTwseHistory(code,months):getTpexHistory(code,months)),
  ]);
  let historyRaw=officialHistory;
  if(!historyRaw.length){
    try{if(!yahooFallback)yahooFallback=await getYahooTw(code,snapshot.market);if(yahooFallback?.history?.length){historyRaw=yahooFallback.history;sourceErrors.push('官方歷史資料暫時無法連線，圖表使用延遲備援');}}catch(e){sourceErrors.push(`歷史備援: ${e.message}`);}
  }
  Object.assign(snapshot,valuation);
  let history=mergeSnapshotIntoHistory(historyRaw,snapshot);
  if(!history.length&&snapshot.close!=null)history=[{date:snapshot.date,open:snapshot.open,high:snapshot.high,low:snapshot.low,close:snapshot.close,volume:snapshot.volume}];
  if(snapshot.change==null&&history.length>1){const prev=history.at(-2).close;snapshot.change=snapshot.close-prev;snapshot.changePct=prev?((snapshot.close-prev)/prev)*100:null;}
  const indicators=buildIndicators(history),analysis=analyze(history,snapshot,indicators),experts=expertSignals(history,indicators);
  return{snapshot:{...snapshot,assetHint:/^(00|006|007|008|009)/.test(code)?'ETF':'STOCK'},analysis,experts,history,series:indicators.series,meta:{generatedAt:new Date().toISOString(),months,tradingDays:history.length,sourceErrors,latencyType:snapshot.isRealtimePrice?'盤中公開市況／最佳努力近即時':'公開盤後／最近交易資料',disclaimer:'技術指標與綜合分數僅供研究教育參考，不構成投資建議。盤中公開市況不等同授權行情，公開轉載或商用前請確認資料使用條款。'}};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=10, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const code=String(req.query?.code||'').trim().toUpperCase();
  const months=Math.max(1,Math.min(36,Number(req.query?.months)||6));
  if(!/^\d{4,6}[A-Z]?$/.test(code))return res.status(400).json({error:'請輸入台股代號，例如 2330、2454、6488'});
  const key=`${code}:${months}`;const hit=cache.get(key);if(hit&&Date.now()-hit.time<CACHE_TTL_MS)return res.status(200).json(hit.data);
  try{const data=await build(code,months);cache.set(key,{time:Date.now(),data});return res.status(200).json(data);}catch(e){
    if(hit?.data){const stale={...hit.data,meta:{...(hit.data.meta||{}),stale:true,latencyType:'最近成功資料（來源暫時中斷）',sourceErrors:[...((hit.data.meta||{}).sourceErrors||[]),e.message||'更新失敗']}};return res.status(200).json(stale)}
    return res.status(502).json({error:e.message||'資料讀取失敗'});
  }
};
