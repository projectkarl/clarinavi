const TWSE='https://openapi.twse.com.tw/v1';
const TPEX='https://www.tpex.org.tw/openapi/v1';
const MOPS='https://mops.twse.com.tw/mops/web';
const UA='Mozilla/5.0 (compatible; ClariNavi/Current; +https://vercel.app)';
const cache=new Map();

function num(v){ if(v==null)return null; const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').replace(/－|--/g,'').trim()); return Number.isFinite(x)?x:null; }
function txt(v){ return String(v??'').replace(/\s+/g,' ').replace(/&nbsp;/g,' ').trim(); }
function isoDate(v){ const s=String(v||'').replace(/\D/g,''); if(s.length===8){const y=+s.slice(0,4); if(y>1900)return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; return `${y+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;} if(s.length===7){return `${+s.slice(0,3)+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;} return String(v||''); }
function setHeaders(res, ttl=600){res.setHeader('Cache-Control',`s-maxage=${ttl}, stale-while-revalidate=${ttl*4}`);res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');}
async function fetchText(url, timeout=7000, options={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{...options,signal:c.signal,headers:{'User-Agent':UA,'Accept':'*/*',...(options.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text();}finally{clearTimeout(t);}}
async function fetchJson(url, timeout=7000, options={}){const s=await fetchText(url,timeout,{...options,headers:{Accept:'application/json,text/plain,*/*',...(options.headers||{})}});return JSON.parse(s);}
async function cached(key,ttl,fn){const h=cache.get(key);if(h&&Date.now()-h.t<ttl)return h.v;const v=await fn();cache.set(key,{t:Date.now(),v});return v;}
function pick(o, keys){for(const k of keys)if(o&&o[k]!=null&&txt(o[k])&&!['－','--'].includes(txt(o[k])))return o[k];return null;}
function codeOf(o){return txt(pick(o,['公司代號','SecuritiesCompanyCode','Code','證券代號','股票代號']));}
function stripHtml(s){return txt(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/t[rdh]>/gi,'\t').replace(/<\/tr>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));}
function parseTables(html){const tables=[];for(const tm of String(html).matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)){const rows=[];for(const rm of tm[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[];for(const cm of rm[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi))cells.push(stripHtml(cm[1]));if(cells.length)rows.push(cells);}if(rows.length)tables.push(rows);}return tables;}
function monthKeys(n=24){const out=[],d=new Date();d.setDate(1);for(let i=1;i<=n;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,1);out.push({y:x.getFullYear(),roc:x.getFullYear()-1911,m:x.getMonth()+1,key:`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`});}return out;}
async function mapLimit(items,limit,fn){let i=0;const out=[];async function w(){while(i<items.length){const j=i++;try{out[j]=await fn(items[j],j)}catch{out[j]=null}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out;}

async function profile(code,market){
 const listed=market==='TWSE'; const url=listed?`${TWSE}/opendata/t187ap03_L`:`${TPEX}/mopsfin_t187ap03_O`;
 const arr=await cached(`profile:${market}`,3600_000,()=>fetchJson(url)); const r=Array.isArray(arr)?arr.find(x=>codeOf(x)===code):null; if(!r)return null;
 return {code,name:txt(pick(r,['公司名稱','CompanyName'])),shortName:txt(pick(r,['公司簡稱','CompanyAbbreviation'])),industry:txt(pick(r,['產業別','SecuritiesIndustryCode'])),chairman:txt(pick(r,['董事長','Chairman'])),manager:txt(pick(r,['總經理','GeneralManager'])),spokesman:txt(pick(r,['發言人','Spokesman'])),capital:num(pick(r,['實收資本額(元)','Paidin.Capital.NTDollars'])),shares:num(pick(r,['已發行普通股數或TDR原發行股數','IssueShares'])),listedDate:isoDate(pick(r,['上市日期','DateOfListing'])),foundedDate:isoDate(pick(r,['成立日期','DateOfIncorporation'])),website:txt(pick(r,['網址','WebAddress'])),address:txt(pick(r,['住址','Address'])),phone:txt(pick(r,['總機電話','Telephone'])),businessNo:txt(pick(r,['營利事業統一編號','UnifiedBusinessNo.','UnifiedBusinessNo'])),source:listed?'TWSE OpenAPI':'TPEx OpenAPI'};
}

function decodeBig5(buf){try{return new TextDecoder('big5').decode(buf)}catch{return new TextDecoder('utf-8').decode(buf)}}
async function fetchDecoded(url,encoding='big5',timeout=6000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'text/html,text/csv,*/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.arrayBuffer();try{return new TextDecoder(encoding).decode(b)}catch{return new TextDecoder('utf-8').decode(b)}}finally{clearTimeout(t)}}
function parseCsvLine(line){const a=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===','&&!q){a.push(s.trim());s='';}else s+=c;}a.push(s.trim());return a;}
function revObj(month,rev,prev,lastYear,mom,yoy,cum,cumYoy){return {month,revenue:rev!=null?rev*1000:null,prevMonth:prev!=null?prev*1000:null,lastYear:lastYear!=null?lastYear*1000:null,mom,yoy,cumRevenue:cum!=null?cum*1000:null,cumYoy};}
function revenueFromHtml(html,code,m){for(const rows of parseTables(html)){let hi=-1;for(let i=0;i<Math.min(10,rows.length);i++){const joined=rows[i].join('|').replace(/\s/g,'');if(joined.includes('公司代號')&&joined.includes('當月營收')){hi=i;break;}}if(hi<0)continue;const header=rows[hi].map(x=>txt(x).replace(/\s/g,''));const row=rows.slice(hi+1).find(r=>r.some(c=>txt(c)===code));if(!row)continue;const get=(terms)=>{for(let i=0;i<header.length;i++)if(terms.some(t=>header[i].includes(t)))return row[i];return null};const rev=num(get(['當月營收'])),prev=num(get(['上月營收'])),lastYear=num(get(['去年當月營收','去年同月營收'])),mom=num(get(['上月比較增減','月增減'])),yoy=num(get(['去年同月增減','年增減'])),cum=num(get(['當月累計營收','累計營收'])),cumYoy=num(get(['前期比較增減','累計年增減']));if(Number.isFinite(rev))return revObj(m.key,rev,prev,lastYear,mom,yoy,cum,cumYoy);}return null;}
async function revenueOne(code,market,m){
 const kind=market==='TWSE'?'sii':'otc';
 // MOPS 舊資料有 CSV 與 Big5 HTML 兩種公開格式；依序嘗試，任何一條失效都不拖垮整頁。
 const csv=`https://mopsov.twse.com.tw/nas/t21/${kind}/t21sc03_${m.roc}_${m.m}.csv`;
 try{const text=await fetchDecoded(csv,'big5',5000);for(const line of text.split(/\r?\n/)){if(!line.includes(code))continue;const c=parseCsvLine(line).map(txt),ix=c.findIndex(x=>x===code);if(ix<0)continue;const z=ix,rev=num(c[z+3]??c[z+2]),prev=num(c[z+4]),lastYear=num(c[z+5]),mom=num(c[z+6]),yoy=num(c[z+7]),cum=num(c[z+8]),cumYoy=num(c[z+10]??c[z+9]);if(Number.isFinite(rev))return revObj(m.key,rev,prev,lastYear,mom,yoy,cum,cumYoy);}}catch{}
 for(const suffix of [0,1]){try{const url=`https://mopsov.twse.com.tw/nas/t21/${kind}/t21sc03_${m.roc}_${m.m}_${suffix}.html`,x=revenueFromHtml(await fetchDecoded(url,'big5',5500),code,m);if(x)return x;}catch{}}
 return null;
}
async function latestRevenue(code,market){const url=market==='TWSE'?`${TWSE}/opendata/t187ap05_L`:`${TPEX}/mopsfin_t187ap05_O`;try{const arr=await cached(`revlatest:${market}`,1800_000,()=>fetchJson(url));const r=Array.isArray(arr)?arr.find(x=>codeOf(x)===code):null;if(!r)return null;const ym=txt(pick(r,['資料年月','DataYearMonth']));const y=ym.length>=5?+ym.slice(0,-2)+1911:null,mo=ym.slice(-2);return {month:y?`${y}-${mo}`:ym,revenue:(num(pick(r,['營業收入-當月營收','CurrentMonthRevenue']))??0)*1000,mom:num(pick(r,['營業收入-上月比較增減(%)','CurrentMonthRevenue-MonthlyChangeRate'])),yoy:num(pick(r,['營業收入-去年同月增減(%)','CurrentMonthRevenue-YearlyChangeRate'])),cumRevenue:(num(pick(r,['累計營業收入-當月累計營收','CurrentAccumulateRevenue']))??0)*1000,cumYoy:num(pick(r,['累計營業收入-前期比較增減(%)','CurrentAccumulateRevenue-ChangeRate']))};}catch{return null}}
async function revenueHistory(code,market,months=24){const keys=monthKeys(Math.max(6,Math.min(36,months)));const rows=(await mapLimit(keys,5,m=>revenueOne(code,market,m))).filter(Boolean).sort((a,b)=>a.month.localeCompare(b.month));const latest=await latestRevenue(code,market);if(latest&&!rows.some(x=>x.month===latest.month))rows.push(latest);rows.sort((a,b)=>a.month.localeCompare(b.month));return {rows,source:'MOPS 公開資訊觀測站／TWSE・TPEx OpenAPI',unit:'元',note:'歷史月營收以 MOPS 公開申報檔為主，並以交易所最新月營收 OpenAPI 補齊最近一期。'};}

function findTableRow(tables,code,needWords=[]){for(const rows of tables){let h=-1;for(let i=0;i<Math.min(rows.length,8);i++){const t=rows[i].join('|');if((t.includes('公司代號')||t.includes('公司名稱'))&&needWords.every(w=>t.includes(w))){h=i;break;}}if(h<0)continue;const header=rows[h];const row=rows.slice(h+1).find(r=>r.some(c=>txt(c)===code));if(row)return {header,row};}return null;}
function col(obj,patterns){for(let i=0;i<obj.header.length;i++){const h=txt(obj.header[i]);if(patterns.some(p=>h.includes(p)))return obj.row[i];}return null;}
async function mopsQuarter(code,market,y,q){
 const form=new URLSearchParams({encodeURIComponent:'1',step:'1',firstin:'1',off:'1',isQuery:'Y',TYPEK:market==='TWSE'?'sii':'otc',year:String(y-1911),season:String(q).padStart(2,'0')});
 const opt={method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':'https://mops.twse.com.tw','Referer':'https://mops.twse.com.tw/'},body:form};
 try{
  const [ih,bh,ch]=await Promise.all([
   fetchText(`${MOPS}/ajax_t163sb04`,9000,opt),
   fetchText(`${MOPS}/ajax_t163sb05`,9000,opt),
   fetchText(`${MOPS}/ajax_t163sb20`,9000,opt).catch(()=>null)
  ]);
  const io=findTableRow(parseTables(ih),code,['營業收入']);
  const bo=findTableRow(parseTables(bh),code,['資產']);
  let co=null;if(ch)co=findTableRow(parseTables(ch),code,[]);
  if(!io&&!bo&&!co)return null;
  const cf=(patterns)=>num(co&&col(co,patterns));
  return {quarter:`${y}Q${q}`,
   revenue:num(io&&col(io,['營業收入'])),grossProfit:num(io&&col(io,['營業毛利'])),operatingIncome:num(io&&col(io,['營業利益'])),netIncome:num(io&&col(io,['本期淨利','本期稅後淨利'])),eps:num(io&&col(io,['基本每股盈餘'])),
   assets:num(bo&&col(bo,['資產總計'])),liabilities:num(bo&&col(bo,['負債總計'])),equity:num(bo&&col(bo,['權益總計'])),bookValue:num(bo&&col(bo,['每股參考淨值','每股淨值'])),
   operatingCashFlow:cf(['營業活動之淨現金流入','營業活動之淨現金流出','營業活動之淨現金流量','營業活動現金流量']),
   investingCashFlow:cf(['投資活動之淨現金流入','投資活動之淨現金流出','投資活動之淨現金流量','投資活動現金流量']),
   financingCashFlow:cf(['籌資活動之淨現金流入','籌資活動之淨現金流出','籌資活動之淨現金流量','籌資活動現金流量'])
  };
 }catch{return null}
}
async function quarterlyHistory(code,market,count=12){const now=new Date();let y=now.getFullYear(),q=Math.ceil((now.getMonth()+1)/3);const keys=[];for(let i=0;i<count+1;i++){q--;if(q===0){q=4;y--;}keys.push({y,q});}const rows=(await mapLimit(keys,3,x=>mopsQuarter(code,market,x.y,x.q))).filter(Boolean).sort((a,b)=>a.quarter.localeCompare(b.quarter));return {rows,source:'MOPS 季度財務彙總表',note:'季報欄位為官方彙總表口徑；不同產業報表欄位可能不同，無法對應時顯示空值。'};}

function dateKeys(days=18){const a=[];const d=new Date();for(let i=1;i<=days;i++){const x=new Date(d);x.setDate(d.getDate()-i);a.push(`${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}${String(x.getDate()).padStart(2,'0')}`);}return a;}
function rowFromFields(fields,row,code){const o={};fields.forEach((f,i)=>o[txt(f)]=row[i]);const c=txt(row[0]);if(c!==code)return null;const f=(name)=>{const k=Object.keys(o).find(x=>x.includes(name));return k?num(o[k]):null};const foreignBase=f('外陸資買賣超股數(不含外資自營商)')??f('外陸資買賣超股數');const foreignDealer=f('外資自營商買賣超股數')??0;return {foreign:foreignBase==null?null:foreignBase+foreignDealer,trust:f('投信買賣超股數'),dealer:f('自營商買賣超股數'),total:f('三大法人買賣超股數')};}
async function twseInstitutional(code){const ds=dateKeys(18);const got=await mapLimit(ds,5,async d=>{try{const j=await fetchJson(`https://www.twse.com.tw/rwd/zh/fund/T86?date=${d}&selectType=ALLBUT0999&response=json`,5500);if(j?.stat!=='OK'||!Array.isArray(j.data))return null;const r=j.data.map(x=>rowFromFields(j.fields||[],x,code)).find(Boolean);return r?{date:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,...r}:null}catch{return null}});return got.filter(Boolean).slice(0,10).sort((a,b)=>a.date.localeCompare(b.date));}
function valByKeys(r,terms){for(const [k,v] of Object.entries(r||{})){const n=k.replace(/\s/g,'').toLowerCase();if(terms.some(t=>n.includes(t.toLowerCase()))) {const x=num(v);if(x!=null)return x;}}return null;}
async function tpexInstitutional(code){try{const a=await fetchJson(`${TPEX}/tpex_3insti_daily_trading`,6000);const r=Array.isArray(a)?a.find(x=>codeOf(x)===code):null;if(!r)return [];return [{date:isoDate(pick(r,['Date','日期'])),foreign:valByKeys(r,['foreigninvestorsincludemainlandareainvestors-difference','foreigninvestors-difference']),trust:valByKeys(r,['securitiesinvestmenttrustcompanies-difference']),dealer:valByKeys(r,['dealers-difference']),total:valByKeys(r,['totaldifference'])}];}catch{return []}}
async function margin(code,market){try{const url=market==='TWSE'?`${TWSE}/exchangeReport/MI_MARGN`:`${TPEX}/tpex_mainboard_margin_balance`;const a=await cached(`margin:${market}`,120_000,()=>fetchJson(url));const r=Array.isArray(a)?a.find(x=>codeOf(x)===code):null;if(!r)return null;return {date:isoDate(pick(r,['Date','日期'])),marginBalance:valByKeys(r,['融資今日餘額','marginbalance','marginbalancecurrent']),shortBalance:valByKeys(r,['融券今日餘額','shortbalance','shortbalancecurrent']),marginBuy:valByKeys(r,['融資買進','marginpurchase']),marginSell:valByKeys(r,['融資賣出','marginsale']),shortSell:valByKeys(r,['融券賣出','shortsale']),shortBuy:valByKeys(r,['融券買進','shortpurchase'])};}catch{return null}}
async function tdcc(code){try{const r=await fetch('https://openapi.tdcc.com.tw/v1/opendata/1-5',{headers:{'User-Agent':UA,'Accept':'application/json,text/csv,*/*'}});if(!r.ok)throw new Error('TDCC');const body=await r.text();let arr=[];try{arr=JSON.parse(body)}catch{const lines=body.split(/\r?\n/);const head=parseCsvLine(lines[0]);arr=lines.slice(1).map(l=>{const c=parseCsvLine(l),o={};head.forEach((h,i)=>o[h]=c[i]);return o})}const rows=(Array.isArray(arr)?arr:[]).filter(x=>codeOf(x)===code);if(!rows.length)return null;const levels=rows.map(x=>({level:Number(pick(x,['持股分級','HoldingLevel'])),holders:num(pick(x,['人數','NumberOfPeople'])),shares:num(pick(x,['股數','NumberOfShares'])),pct:num(pick(x,['占集保庫存數比例%','占集保庫存數比例','Percentage'])),date:isoDate(pick(x,['資料日期','Date']))})).filter(x=>Number.isFinite(x.level));const sum=(from,to)=>levels.filter(x=>x.level>=from&&x.level<=to).reduce((s,x)=>s+(x.pct||0),0);const total=levels.find(x=>x.level===17);return {date:levels[0]?.date,big1000:sum(15,15),big400:sum(12,15),retail10:sum(1,3),holders:total?.holders??null,avgShares:total?.holders&&total?.shares?Math.round(total.shares/total.holders):null,levels};}catch{return null}}

function tdccFridayDates(weeks=4){const out=[],now=new Date();for(let w=0;w<weeks+2&&out.length<weeks;w++){const d=new Date(now);d.setDate(d.getDate()-w*7);const back=(d.getDay()-5+7)%7;d.setDate(d.getDate()-back);const ds=d.toISOString().slice(0,10);if(!out.includes(ds))out.push(ds)}return out;}
function parseTdccHistorySnapshot(body,code,date){const lines=String(body||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return null;const head=parseCsvLine(lines[0]),ixCode=head.findIndex(x=>x.includes('證券代號')),ixLv=head.findIndex(x=>x.includes('持股分級')),ixPct=head.findIndex(x=>x.includes('比例')),ixPeople=head.findIndex(x=>x.includes('人數'));if(ixCode<0||ixLv<0||ixPct<0)return null;const rows=[];for(let i=1;i<lines.length;i++){const r=parseCsvLine(lines[i]);if(txt(r[ixCode])!==code)continue;const lv=Number(r[ixLv]),pct=num(r[ixPct]),holders=ixPeople>=0?num(r[ixPeople]):null;if(Number.isFinite(lv)&&Number.isFinite(pct))rows.push({lv,pct,holders})}if(!rows.length)return null;const sum=(lo,hi)=>rows.filter(x=>x.lv>=lo&&x.lv<=hi).reduce((a,x)=>a+x.pct,0),total=rows.find(x=>x.lv===17);return {date,big400:sum(12,15),big1000:sum(15,15),retail10:sum(1,3),holders:total?.holders??null};}
async function tdccHistory(code,current){return current?.date?[{date:current.date,big400:current.big400,big1000:current.big1000,retail10:current.retail10,holders:current.holders}]:[];}

async function majorHolders(code,market){try{const url=market==='TWSE'?`${TWSE}/opendata/t187ap02_L`:`${TPEX}/mopsfin_t187ap02_O`;const a=await cached(`major:${market}`,3600_000,()=>fetchJson(url));const rows=(Array.isArray(a)?a:[]).filter(x=>codeOf(x)===code).slice(0,12);return rows.map(r=>({name:txt(pick(r,['大股東名稱','ShareholderName','姓名或名稱','Name'])),shares:num(pick(r,['持有股數','SharesHeld','持股數'])),pct:num(pick(r,['持股比率','ShareholdingRatio','持股比例']))})).filter(x=>x.name);}catch{return []}}
async function chips(code,market){const [institutional,mg,td,mh]=await Promise.all([market==='TWSE'?twseInstitutional(code):tpexInstitutional(code),margin(code,market),tdcc(code),majorHolders(code,market)]);const hist=td?await tdccHistory(code,td):[];return {institutional,margin:mg,tdcc:td,tdccHistory:hist,majorHolders:mh,source:'TWSE / TPEx / TDCC 官方公開資料',note:'持股結構只使用 TDCC 官方目前可取得的公開資料；沒有可驗證的官方歷史序列時，不繪製大戶/散戶歷史趨勢。券商分點主力屬授權資料，本站不以代理值冒充。'};}

async function insiders(code,market){
 try{
  const holdUrl=market==='TWSE'?`${TWSE}/opendata/t187ap11_L`:`${TPEX}/mopsfin_t187ap11_O`;
  const transUrl=market==='TWSE'?`${TWSE}/opendata/t187ap12_L`:`${TPEX}/mopsfin_t187ap12_O`;
  const [ha,ta]=await Promise.all([cached(`insiderHold:${market}`,1800_000,()=>fetchJson(holdUrl)).catch(()=>[]),cached(`insiderTrans:${market}`,300_000,()=>fetchJson(transUrl)).catch(()=>[])]);
  const holdings=(Array.isArray(ha)?ha:[]).filter(x=>codeOf(x)===code).slice(0,30).map(r=>({
   name:txt(pick(r,['姓名','Name','董監事姓名','內部人姓名'])),title:txt(pick(r,['職稱','Title','身分別'])),shares:num(pick(r,['目前持股','持有股數','SharesHeld','持股餘額'])),pledged:num(pick(r,['設質股數','PledgedShares'])),pct:num(pick(r,['持股比率','ShareholdingRatio']))
  })).filter(x=>x.name);
  const transfers=(Array.isArray(ta)?ta:[]).filter(x=>codeOf(x)===code).slice(0,30).map(r=>({
   date:isoDate(pick(r,['申報日期','Date','申報轉讓日期'])),name:txt(pick(r,['姓名','Name','申報人姓名'])),title:txt(pick(r,['職稱','Title','身分別'])),method:txt(pick(r,['轉讓方式','TransferMethod'])),shares:num(pick(r,['申報轉讓股數','TransferShares','預定轉讓總股數'])),reason:txt(pick(r,['轉讓原因','Reason']))
  })).filter(x=>x.name||x.date);
  return {holdings,transfers,source:'TWSE / TPEx OpenAPI 內部人公開申報',note:'內部人申報為盤後公開資訊，不代表未來交易方向。'};
 }catch{return {holdings:[],transfers:[],source:'TWSE / TPEx',note:'內部人資料暫時無法取得。'}}
}

async function events(code,market){try{const url=market==='TWSE'?`${TWSE}/opendata/t187ap04_L`:`${TPEX}/mopsfin_t187ap04_O`;const a=await cached(`events:${market}`,300_000,()=>fetchJson(url));const rows=(Array.isArray(a)?a:[]).filter(x=>codeOf(x)===code).slice(0,8);return rows.map(r=>({date:isoDate(pick(r,['發言日期','Date','出表日期'])),time:txt(pick(r,['發言時間','Time'])),title:txt(pick(r,['主旨','Subject','重大訊息主旨'])),content:txt(pick(r,['說明','Explanation','內容']))}));}catch{return []}}

module.exports=async function handler(req,res){setHeaders(res,300);const code=String(req.query?.code||'').trim().toUpperCase(),market=String(req.query?.market||'TWSE').toUpperCase()==='TPEX'?'TPEx':'TWSE',section=String(req.query?.section||'profile'),months=Math.max(6,Math.min(36,Number(req.query?.months)||24));if(!/^\d{4,6}[A-Z]?$/.test(code))return res.status(400).json({error:'代號格式錯誤'});try{let data;if(section==='profile')data=await profile(code,market);else if(section==='revenue')data=await revenueHistory(code,market,months);else if(section==='financials')data=await quarterlyHistory(code,market,12);else if(section==='chips')data=await chips(code,market);else if(section==='insiders')data=await insiders(code,market);else if(section==='events')data=await events(code,market);else return res.status(400).json({error:'未知 section'});return res.status(200).json({code,market,section,data,generatedAt:new Date().toISOString()});}catch(e){return res.status(200).json({code,market,section,data:null,error:e?.message||'資料來源暫時無法使用'});}}
