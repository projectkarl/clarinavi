const UA='Mozilla/5.0 (compatible; ClariNavi/Current; +https://vercel.app)';
const TWSE='https://openapi.twse.com.tw/v1';
const TPEX='https://www.tpex.org.tw/openapi/v1';
const INDUSTRIES={
'01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜',
'08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造',
'15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他',
'21':'化學工業','22':'生技醫療業','23':'油電燃氣業','24':'半導體業','25':'電腦及週邊設備業',
'26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業',
'31':'其他電子業','32':'文化創意業','33':'農業科技業','35':'綠能環保','36':'數位雲端',
'37':'運動休閒','38':'居家生活','80':'管理股票'
};
const US_SECTORS=[
{id:'semiconductor',name:'半導體',items:[['NVDA','NVIDIA'],['AVGO','Broadcom'],['AMD','AMD'],['MU','Micron'],['QCOM','Qualcomm'],['INTC','Intel'],['TSM','TSMC ADR'],['ASML','ASML'],['AMAT','Applied Materials'],['LRCX','Lam Research']]},
{id:'software',name:'軟體 / 雲端',items:[['MSFT','Microsoft'],['ORCL','Oracle'],['CRM','Salesforce'],['NOW','ServiceNow'],['PLTR','Palantir'],['SNOW','Snowflake'],['ADBE','Adobe']]},
{id:'internet',name:'網路 / 平台',items:[['GOOGL','Alphabet'],['META','Meta Platforms'],['AMZN','Amazon'],['NFLX','Netflix'],['UBER','Uber'],['ABNB','Airbnb']]},
{id:'finance',name:'金融',items:[['JPM','JPMorgan'],['BAC','Bank of America'],['GS','Goldman Sachs'],['MS','Morgan Stanley'],['V','Visa'],['MA','Mastercard']]},
{id:'health',name:'醫療保健',items:[['LLY','Eli Lilly'],['UNH','UnitedHealth'],['JNJ','Johnson & Johnson'],['ABBV','AbbVie'],['MRK','Merck'],['TMO','Thermo Fisher']]},
{id:'consumer',name:'消費',items:[['COST','Costco'],['WMT','Walmart'],['MCD',"McDonald's"],['NKE','Nike'],['SBUX','Starbucks'],['HD','Home Depot']]},
{id:'energy',name:'能源',items:[['XOM','Exxon Mobil'],['CVX','Chevron'],['COP','ConocoPhillips'],['SLB','SLB'],['OXY','Occidental']]},
{id:'defense',name:'航太 / 國防',items:[['RTX','RTX'],['LMT','Lockheed Martin'],['NOC','Northrop Grumman'],['GD','General Dynamics'],['BA','Boeing']]},
{id:'etf',name:'大型 ETF',items:[['SPY','SPDR S&P 500 ETF'],['QQQ','Invesco QQQ ETF'],['VOO','Vanguard S&P 500 ETF'],['IWM','iShares Russell 2000 ETF'],['SMH','VanEck Semiconductor ETF'],['XLK','Technology Select Sector SPDR']]}
];
async function fetchJson(url,timeout=7000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
const clean=v=>String(v??'').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
const num=v=>{const n=Number(String(v??'').replace(/,/g,'').replace(/%/g,'').trim());return Number.isFinite(n)?n:null};
const pick=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&clean(o[k])!=='')return o[k];return null};
function norm(row,market){
 const code=clean(pick(row,['公司代號','公司代碼','SecuritiesCompanyCode','Code','SecuritiesCode']));
 const name=clean(pick(row,['公司簡稱','公司名稱','CompanyAbbreviation','CompanyName','Name']))||code;
 let ind=clean(pick(row,['產業別','產業別代碼','SecuritiesIndustryCode','IndustryCode','Industry']));
 if(/^\d+$/.test(ind))ind=ind.padStart(2,'0');
 const industry=INDUSTRIES[ind]||clean(pick(row,['產業類別','IndustryName']))||(`產業 ${ind||'未分類'}`);
 const shares=num(pick(row,['已發行普通股數或TDR原發行股數','已發行普通股數','IssuedCommonShares','SharesOutstanding','普通股數']));
 return{code,name,market,industryCode:ind||'00',industry,shares};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
 const market=clean(req.query?.market||'TW').toUpperCase(),industry=clean(req.query?.industry),q=clean(req.query?.q).toUpperCase();
 if(market==='US'){
   let items=[];for(const s of US_SECTORS)for(const [code,name] of s.items)items.push({code,name,market:'US',industryCode:s.id,industry:s.name});
   if(industry)items=items.filter(x=>x.industryCode===industry);
   if(q)items=items.filter(x=>x.code.includes(q)||x.name.toUpperCase().includes(q));
   return res.status(200).json({market:'US',sectors:US_SECTORS.map(s=>({id:s.id,name:s.name,count:s.items.length})),items,source:'內建高流動性美股產業快選',note:'美股產業瀏覽為輕量精選清單，不宣稱涵蓋全市場；個股資料仍由使用者自己的 Alpha Vantage Key 按需查詢。'});
 }
 const out=[],errors=[];
 const [twCompanies,tpCompanies,twQuotes,tpQuotes,twVal,tpVal]=await Promise.allSettled([
   fetchJson(`${TWSE}/opendata/t187ap03_L`),fetchJson(`${TPEX}/mopsfin_t187ap03_O`),
   fetchJson(`${TWSE}/exchangeReport/STOCK_DAY_ALL`,6500),fetchJson(`${TPEX}/tpex_mainboard_quotes`,6500),
   fetchJson(`${TWSE}/exchangeReport/BWIBBU_ALL`,6500),fetchJson(`${TPEX}/tpex_mainboard_peratio_analysis`,6500)
 ]);
 if(twCompanies.status==='fulfilled'){for(const x of Array.isArray(twCompanies.value)?twCompanies.value:[]){const n=norm(x,'TWSE');if(/^\d{4}$/.test(n.code))out.push(n)}}else errors.push('TWSE 公司主檔 '+twCompanies.reason?.message);
 if(tpCompanies.status==='fulfilled'){for(const x of Array.isArray(tpCompanies.value)?tpCompanies.value:[]){const n=norm(x,'TPEx');if(/^\d{4}$/.test(n.code))out.push(n)}}else errors.push('TPEx 公司主檔 '+tpCompanies.reason?.message);
 const qmap=new Map(),vmap=new Map();
 if(twQuotes.status==='fulfilled')for(const x of Array.isArray(twQuotes.value)?twQuotes.value:[]){const code=clean(x.Code);if(code)qmap.set(code,{price:num(x.ClosingPrice),change:num(x.Change),market:'TWSE'})}
 if(tpQuotes.status==='fulfilled')for(const x of Array.isArray(tpQuotes.value)?tpQuotes.value:[]){const code=clean(x.SecuritiesCompanyCode||x.Code);if(code)qmap.set(code,{price:num(x.Close),change:num(x.Change),market:'TPEx'})}
 if(twVal.status==='fulfilled')for(const x of Array.isArray(twVal.value)?twVal.value:[]){const code=clean(x.Code);if(code)vmap.set(code,{pe:num(x.PEratio),yield:num(x.DividendYield),pb:num(x.PBratio)})}
 if(tpVal.status==='fulfilled')for(const x of Array.isArray(tpVal.value)?tpVal.value:[]){const code=clean(x.SecuritiesCompanyCode||x.Code);if(code)vmap.set(code,{pe:num(x.PriceEarningRatio||x.PEratio),yield:num(x.DividendYield||x.YieldRatio),pb:num(x.PriceBookRatio||x.PBratio)})}
 const dedup=[...new Map(out.map(x=>[x.code,x])).values()].map(x=>{const q=qmap.get(x.code)||{},v=vmap.get(x.code)||{};const price=q.price,prev=Number.isFinite(price)&&Number.isFinite(q.change)?price-q.change:null,changePct=Number.isFinite(q.change)&&prev?100*q.change/prev:null;let marketCap=null;if(Number.isFinite(x.shares)&&Number.isFinite(price))marketCap=x.shares*price;return{...x,price,changePct,pe:v.pe,yield:v.yield,pb:v.pb,marketCap}}).sort((a,b)=>a.code.localeCompare(b.code));
 const counts=new Map();for(const x of dedup){const k=x.industryCode+'|'+x.industry;counts.set(k,(counts.get(k)||0)+1)}
 const sectors=[...counts.entries()].map(([k,count])=>{const [id,name]=k.split('|');return{id,name,count}}).sort((a,b)=>a.id.localeCompare(b.id));
 let items=dedup;if(industry)items=items.filter(x=>x.industryCode===industry);if(q)items=items.filter(x=>x.code.includes(q)||x.name.toUpperCase().includes(q)||x.industry.includes(q));
 return res.status(200).json({market:'TW',sectors,items,source:'TWSE / TPEx 官方公司主檔、行情與估值 OpenAPI',errors,note:'產業分類依交易所公司主檔；價格、估值與殖利率以最近可得官方公開資料為準。市值僅在公司主檔有可解析發行股數時估算。'});
};
