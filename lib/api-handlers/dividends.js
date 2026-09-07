const UA='Mozilla/5.0 (compatible; ClariNavi/Current; +https://vercel.app)';
const TWSE='https://openapi.twse.com.tw/v1',TPEX='https://www.tpex.org.tw/openapi/v1';
async function fetchJson(url,timeout=8000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
const txt=v=>String(v??'').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
const num=v=>{const n=Number(txt(v).replace(/,/g,''));return Number.isFinite(n)?n:null};
const pick=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&txt(o[k])!=='')return o[k];return null};
function adDate(v){const s=txt(v).replace(/[^\d]/g,'');if(/^\d{7}$/.test(s)){const y=Number(s.slice(0,3))+1911;return `${y}-${s.slice(3,5)}-${s.slice(5,7)}`}if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;const m=txt(v).match(/(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})/);if(m){const y=Number(m[1])+(Number(m[1])<1900?1911:0);return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`}return null}
function normalize(x,market){
 const date=adDate(pick(x,['Date','除權除息日期','除權息日期','ExrightDate','ExDividendDate','ExDate','DateOfExright']));
 const code=txt(pick(x,['Code','股票代號','SecuritiesCompanyCode','SecuritiesCode','StockNo','SecurityCode']));
 const name=txt(pick(x,['Name','名稱','公司名稱','CompanyName','CompanyAbbreviation','SecurityName']))||code;
 const type=txt(pick(x,['Exdividend','除權息','除權除息','Type','ExRightDividend']))||'—';
 const cash=num(pick(x,['CashDividend','現金股利','CashDividendPerShare','CashDividendAmount','Dividend']));
 const stockRatio=num(pick(x,['StockDividendRatio','無償配股率','StockDividend','StockDividendRate']));
 return{date,code,name,market,type,cashDividend:cash,stockDividendRatio:stockRatio};
}
async function prices(){
 const m=new Map();
 try{const a=await fetchJson(`${TWSE}/exchangeReport/STOCK_DAY_ALL`,6000);for(const x of Array.isArray(a)?a:[]){const code=txt(x.Code),p=num(x.ClosingPrice);if(code&&Number.isFinite(p))m.set(code,p)}}catch{}
 try{const a=await fetchJson(`${TPEX}/tpex_mainboard_quotes`,6000);for(const x of Array.isArray(a)?a:[]){const code=txt(pick(x,['SecuritiesCompanyCode','Code'])),p=num(pick(x,['Close','ClosingPrice']));if(code&&Number.isFinite(p))m.set(code,p)}}catch{}
 return m;
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
 const ym=txt(req.query?.month),high=Number(req.query?.high)||5,events=[],errors=[];
 try{const a=await fetchJson(`${TWSE}/exchangeReport/TWT48U_ALL`);for(const x of Array.isArray(a)?a:[]){const n=normalize(x,'TWSE');if(n.date&&n.code)events.push(n)}}catch(e){errors.push('TWSE '+e.message)}
 try{const a=await fetchJson(`${TPEX}/tpex_exright_prepost`);for(const x of Array.isArray(a)?a:[]){const n=normalize(x,'TPEx');if(n.date&&n.code)events.push(n)}}catch(e){errors.push('TPEx '+e.message)}
 const pm=await prices();for(const e of events){e.price=pm.get(e.code)??null;e.eventYield=Number.isFinite(e.cashDividend)&&e.cashDividend>0&&Number.isFinite(e.price)&&e.price>0?e.cashDividend/e.price*100:null;e.highYield=Number.isFinite(e.eventYield)&&e.eventYield>=high;e.yieldLevel=Number.isFinite(e.eventYield)?(e.eventYield>=high?'very-high':e.eventYield>=3?'high':e.eventYield>=1.5?'mid':'normal'):'unknown'}
 let out=events;if(/^\d{4}-\d{2}$/.test(ym))out=out.filter(x=>x.date?.startsWith(ym));out.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.code.localeCompare(b.code));
 return res.status(200).json({month:ym||null,highThreshold:high,items:out,allCount:events.length,errors,source:'TWSE TWT48U_ALL + TPEx tpex_exright_prepost 官方除權息預告',priceSource:'交易所最近可得收盤行情',note:'殖利率欄位為「本次現金股利 ÷ 最近可得股價」的單次配息率，不等同年化殖利率；日期與金額仍以公司/MOPS最終公告為準。'});
};
