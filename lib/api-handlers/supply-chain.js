const TWSE='https://openapi.twse.com.tw/v1';
const TPEX='https://www.tpex.org.tw/openapi/v1';
const UA='Mozilla/5.0 (compatible; ClariNavi/Current; public-market-research)';
const cache=new Map();
const INDUSTRIES={
'01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造','15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他','21':'化學工業','22':'生技醫療業','23':'油電燃氣業','24':'半導體業','25':'電腦及週邊設備業','26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業','31':'其他電子業','32':'文化創意業','33':'農業科技業','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'};
// 產業鏈規則只描述「產業關聯」，不是實際供應商/客戶名單。
const LINKS={
'01':{up:['10','21','23'],down:['14']},'02':{up:['33','21'],down:['18','16']},'03':{up:['21','23'],down:['28','12','38']},
'04':{up:['21'],down:['37','18']},'05':{up:['10','28'],down:['31','12','35']},'06':{up:['10','21'],down:['14','23','35']},
'08':{up:['21','23'],down:['14','26']},'09':{up:['21','23'],down:['18','38']},'10':{up:['23','21'],down:['05','06','12','14']},
'11':{up:['21','23'],down:['12','37']},'12':{up:['10','24','25','28','31'],down:['18','37']},'14':{up:['01','06','08','10'],down:['17','18']},
'15':{up:['23','05'],down:['18','29']},'16':{up:['02','18'],down:['37']},'17':{up:[],down:['14','18','36']},'18':{up:['02','29','38'],down:['16','37']},
'21':{up:['23'],down:['03','04','22','24','26','28']},'22':{up:['21','31'],down:['18']},'23':{up:[],down:['01','03','05','06','10','15','21','35']},
'24':{up:['21','31','28'],down:['25','26','27','28','12','36']},'25':{up:['24','28','31'],down:['29','30','36','12']},'26':{up:['21','24','28'],down:['25','27','12']},
'27':{up:['24','25','28'],down:['29','30','36']},'28':{up:['03','10','21','24'],down:['24','25','26','27','12']},'29':{up:['24','25','28'],down:['18','30','36']},
'30':{up:['25','27'],down:['17','18','36']},'31':{up:['05','10','24','28'],down:['24','25','26','35']},'35':{up:['05','06','10','23','28'],down:['14','12']},
'36':{up:['25','27','30'],down:['17','18','29']},'37':{up:['04','11','25'],down:['18']},'38':{up:['03','09','28'],down:['18']}
};
function clean(v){return String(v??'').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim()}
function num(v){const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:null}
function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&clean(o[k]))return o[k]}return null}
async function fetchJson(url,timeout=6500){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
async function cached(key,ttl,fn){const x=cache.get(key);if(x&&Date.now()-x.t<ttl)return x.v;const v=await fn();cache.set(key,{t:Date.now(),v});return v}
function norm(r,market){const code=clean(pick(r,['公司代號','公司代碼','SecuritiesCompanyCode','Code','SecuritiesCode']));let industryCode=clean(pick(r,['產業別','產業別代碼','SecuritiesIndustryCode','IndustryCode','Industry']));if(/^\d+$/.test(industryCode))industryCode=industryCode.padStart(2,'0');return{code,name:clean(pick(r,['公司簡稱','公司名稱','CompanyAbbreviation','CompanyName','Name']))||code,market,industryCode,industry:INDUSTRIES[industryCode]||`產業 ${industryCode||'未分類'}`,shares:num(pick(r,['已發行普通股數或TDR原發行股數','已發行普通股數','IssueShares','SharesOutstanding']))}}
function choose(rows,codes,exclude,limit=8){const set=new Set(codes||[]);return rows.filter(x=>set.has(x.industryCode)&&x.code!==exclude).sort((a,b)=>(b.shares||0)-(a.shares||0)||a.code.localeCompare(b.code)).slice(0,limit)}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=21600');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');
 const code=clean(req.query?.code).toUpperCase();if(!/^\d{4}$/.test(code))return res.status(400).json({ok:false,error:'目前供應鏈功能支援台股四碼股票'});
 try{
  const [tw,tp]=await Promise.all([cached('tw-master',3600_000,()=>fetchJson(`${TWSE}/opendata/t187ap03_L`)).catch(()=>[]),cached('tp-master',3600_000,()=>fetchJson(`${TPEX}/mopsfin_t187ap03_O`)).catch(()=>[])]);
  const rows=[...(Array.isArray(tw)?tw:[]).map(x=>norm(x,'TWSE')),...(Array.isArray(tp)?tp:[]).map(x=>norm(x,'TPEx'))].filter(x=>/^\d{4}$/.test(x.code));
  const current=rows.find(x=>x.code===code);if(!current)return res.status(200).json({ok:false,error:'找不到公司產業分類',items:[]});
  const rel=LINKS[current.industryCode]||{up:[],down:[]};
  const peers=rows.filter(x=>x.industryCode===current.industryCode&&x.code!==code).sort((a,b)=>(b.shares||0)-(a.shares||0)).slice(0,8);
  const upstream=choose(rows,rel.up,code),downstream=choose(rows,rel.down,code);
  return res.status(200).json({ok:true,current,upstream,peers,downstream,source:'TWSE / TPEx 官方公司主檔與產業分類 OpenAPI',method:'依交易所產業分類＋ClariNavi 產業鏈規則建立關聯',note:'此區是產業鏈研究導覽，不代表公司公告的實際供應商、客戶、採購或營收往來。直接供應關係仍應以公司年報、法說會與重大訊息核對。'});
 }catch(e){return res.status(200).json({ok:false,error:e.message||'供應鏈資料暫時無法取得',source:'TWSE / TPEx OpenAPI'});}
};
