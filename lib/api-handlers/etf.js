const TWSE='https://openapi.twse.com.tw/v1';
const MIS='https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const UA='Mozilla/5.0 (compatible; ClariNavi/Current; +https://vercel.app)';
const cache=new Map();
function txt(v){return String(v??'').replace(/\s+/g,' ').trim()}
function num(v){const x=Number(String(v??'').replace(/,/g,'').replace(/%/g,'').trim());return Number.isFinite(x)?x:null}
function pick(o,ks){for(const k of ks)if(o&&o[k]!=null&&txt(o[k]))return o[k];return null}
async function fetchText(url,timeout=7500){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'text/html,application/json,text/plain,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
async function fetchJson(url,timeout=7500){return JSON.parse(await fetchText(url,timeout))}
async function cached(k,ttl,fn){const h=cache.get(k);if(h&&Date.now()-h.t<ttl)return h.v;const v=await fn();cache.set(k,{t:Date.now(),v});return v}
function cleanHtml(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,' ').replace(/<\/tr>/gi,' \n ').replace(/<\/t[dh]>/gi,' \t ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s+/g,'\n').trim()}
function uniqHoldings(a){const m=new Map();for(const x of a){const code=txt(x.code).toUpperCase(),weight=num(x.weight);if(!/^\d{4,6}[A-Z]?$/.test(code)||!Number.isFinite(weight)||weight<=0||weight>100)continue;const row={code,name:txt(x.name)||code,weight,shares:num(x.shares)};const old=m.get(code);if(!old||row.weight>old.weight)m.set(code,row)}return [...m.values()].sort((a,b)=>b.weight-a.weight)}
function parseByTokens(text){const flat=String(text||'').replace(/\s+/g,' ').trim(),out=[];let m;
  // 元大：商品代碼 / 商品名稱 / 商品數量 / 商品權重
  const yuanta=/商品代碼\s*(\d{4,6}[A-Z]?)\s*商品名稱\s*(.{1,40}?)\s*商品數量\s*([\d,]+)\s*商品權重\s*([\d.]+)/g;
  while((m=yuanta.exec(flat)))out.push({code:m[1],name:m[2],shares:m[3],weight:m[4]});
  // 群益：代碼 名稱 權重% 股數
  const capital=/(\d{4,6}[A-Z]?)\s+(.{1,35}?)\s+([\d.]+)\s*%\s+([\d,]+)/g;
  while((m=capital.exec(flat)))out.push({code:m[1],name:m[2],weight:m[3],shares:m[4]});
  // 富邦：代碼 名稱 股數 金額 權重
  const fubon=/(\d{4,6}[A-Z]?)\s+(.{1,35}?)\s+([\d,]+)\s+([\d,]+)\s+([\d.]{1,10})(?=\s|$)/g;
  while((m=fubon.exec(flat)))out.push({code:m[1],name:m[2],shares:m[3],weight:m[5]});
  // 備援：代碼 名稱 股數 金額 權重(%) 常見表格文字
  const generic=/(\d{4,6}[A-Z]?)\s+([^\d\s][^\d]{0,24}?)\s+[\d,]+\s+[\d,]+\s+([\d.]{1,8})/g;
  while((m=generic.exec(flat)))out.push({code:m[1],name:m[2],weight:m[3]});
  return uniqHoldings(out)
}
async function meta(code){try{const arr=await cached('fundmeta',3600_000,()=>fetchJson(`${TWSE}/opendata/t187ap47_L`));const r=Array.isArray(arr)?arr.find(x=>txt(pick(x,['基金代號','證券代號','Code','基金證券代號']))===code):null;if(!r)return null;return {code,name:txt(pick(r,['基金名稱','證券簡稱','Name'])),issuer:txt(pick(r,['基金管理機構','投信公司','發行人','Issuer'])),type:txt(pick(r,['基金類型','Type'])),benchmark:txt(pick(r,['標的指數','追蹤指數','Benchmark'])),listingDate:txt(pick(r,['上市日期','掛牌日期','ListingDate']))}}catch{return null}}

const REFERENCE_HOLDINGS={
 '0050':[
  ['2330','台積電'],['2317','鴻海'],['2454','聯發科'],['2308','台達電'],['2412','中華電'],['2881','富邦金'],['2882','國泰金'],['2891','中信金'],['2892','第一金'],['2886','兆豐金'],
  ['2303','聯電'],['3711','日月光投控'],['2382','廣達'],['2301','光寶科'],['3008','大立光'],['3034','聯詠'],['2327','國巨'],['2379','瑞昱'],['2395','研華'],['2357','華碩'],
  ['6669','緯穎'],['3231','緯創'],['3661','世芯-KY'],['3443','創意'],['3017','奇鋐'],['4938','和碩'],['2408','南亞科'],['2383','台光電'],['8046','南電'],['3037','欣興'],
  ['6505','台塑化'],['1301','台塑'],['1303','南亞'],['2002','中鋼'],['1216','統一'],['2207','和泰車'],['5871','中租-KY'],['5876','上海商銀'],['5880','合庫金'],['2912','統一超'],
  ['2603','長榮'],['2609','陽明'],['2615','萬海'],['1101','台泥'],['1102','亞泥'],['1402','遠東新'],['1590','亞德客-KY'],['2884','玉山金'],['2885','元大金'],['9910','豐泰']
 ],
 '006208':'0050'
};
function referenceHoldings(code){
 const key=REFERENCE_HOLDINGS[code];
 const rows=Array.isArray(key)?key:(REFERENCE_HOLDINGS[key]||null);
 if(!rows)return null;
 return {holdings:rows.map((r,i)=>({code:r[0],name:r[1],weight:null,shares:null,reference:true,rank:i+1})),asOf:null,source:'指數主要成分參考清單（官方持股解析失敗時的備援）',sourceUrl:null,official:false,reference:true};
}

const providers={
 '0050':{url:'https://www.yuantaetfs.com/product/detail/0050/ratio',name:'元大投信'},
 '0056':{url:'https://www.yuantaetfs.com/product/detail/0056/ratio',name:'元大投信'},
 '006208':{url:'https://websys.fsit.com.tw/FubonETF/Trade/Assets.aspx?lan=TW&stkId=006208',name:'富邦投信'},
 '0052':{url:'https://websys.fsit.com.tw/FubonETF/Trade/Assets.aspx?lan=TW&stkId=0052',name:'富邦投信'},
 '00919':{url:'https://www.capitalfund.com.tw/etf/product/detail/195/portfolio',name:'群益投信'},
};
async function issuerHoldings(code){const p=providers[code];if(!p)return null;try{const raw=await fetchText(p.url,2600),clean=cleanHtml(raw),h=parseByTokens(clean);const dm=clean.match(/(?:交易日期|資料日期|最新日期)[：:]?\s*(20\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2})/);if(h.length)return {holdings:h,asOf:dm?.[1]||null,source:`${p.name}官方公開持股`,sourceUrl:p.url,official:true}}catch{}return null}
async function fallbackHoldings(code){try{const url=`https://www.etfinfo.tw/etf/${encodeURIComponent(code)}/holdings`,raw=await fetchText(url,3200),flat=cleanHtml(raw),out=[];for(const m of flat.matchAll(/([\u4e00-\u9fffA-Za-z0-9\-]{2,18})\s*\(?((?:\d{4,6}[A-Z]?))\)?(?:\.TW)?[\s\S]{0,40}?([\d.]{1,6})\s*%/g))out.push({name:m[1],code:m[2],weight:num(m[3])});const h=uniqHoldings(out);if(h.length)return {holdings:h,asOf:null,source:'公開 ETF 資訊頁備援（非官方）',sourceUrl:url,official:false}}catch{}return null}
async function quoteChunk(codes){if(!codes.length)return{};const ex=[];for(const c of codes)ex.push(`tse_${c}.tw`,`otc_${c}.tw`);try{const j=await fetchJson(`${MIS}?ex_ch=${encodeURIComponent(ex.join('|'))}&json=1&delay=0&_=${Date.now()}`,3200),out={};for(const q of Array.isArray(j?.msgArray)?j.msgArray:[]){const c=txt(q.c);if(!codes.includes(c))continue;const last=num(q.z),prev=num(q.y),price=last??prev;if(price==null)continue;const old=out[c];if(!old||last!=null)out[c]={price,prevClose:prev,change:last!=null&&prev!=null?last-prev:null,changePct:last!=null&&prev?((last-prev)/prev*100):null,name:q.n||c,market:String(q.ex).toLowerCase()==='otc'?'TPEx':'TWSE',time:q.t||'',isRealtime:last!=null,open:num(q.o),high:num(q.h),low:num(q.l),volume:num(q.v)};}return out}catch{return{}}}
async function batchQuotes(codes){const all=[...new Set(codes.filter(Boolean))],chunks=[];for(let i=0;i<all.length;i+=32)chunks.push(all.slice(i,i+32));const parts=await Promise.all(chunks.map(x=>quoteChunk(x)));return Object.assign({},...parts)}
module.exports=async function handler(req,res){res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=600');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');const code=String(req.query?.code||'').trim().toUpperCase();if(!/^\d{4,6}[A-Z]?$/.test(code))return res.status(400).json({error:'ETF 代號格式錯誤'});try{const [m,rawHold]=await Promise.all([meta(code),issuerHoldings(code).then(x=>x||fallbackHoldings(code))]);const hold=rawHold||referenceHoldings(code);const h=hold?.holdings||[],quotes=await batchQuotes(h.map(x=>x.code)),holdings=h.map(x=>({...x,quote:quotes[x.code]||null})),priced=holdings.filter(x=>x.quote?.price!=null).length;const refNote=hold?.reference?'目前未取得投信即時完整持股，改列指數主要成分參考清單；權重不顯示，請以發行投信公告為準。':`完整呈現目前成功解析的 ${holdings.length} 檔持股；股價分批使用 TWSE MIS 公開市況最佳努力近即時，無盤中成交時退回昨收。`;return res.status(200).json({code,isEtf:Boolean(m||/^00/.test(code)),meta:m,holdings,count:holdings.length,priced,asOf:hold?.asOf||null,source:hold?.source||'尚無可解析持股來源',sourceUrl:hold?.sourceUrl||null,official:hold?.official??null,reference:!!hold?.reference,note:hold?refNote:'此 ETF 可正常查行情與歷史 K 線，但尚未加入通用持股來源轉接器。'});}catch(e){return res.status(200).json({code,isEtf:true,meta:null,holdings:[],count:0,priced:0,error:e.message});}}
