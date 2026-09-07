const UA='Mozilla/5.0 (compatible; ClariNavi/Current; institutional public data)';
const TWSE_T86='https://www.twse.com.tw/rwd/zh/fund/T86';
const TPEX='https://www.tpex.org.tw/openapi/v1';
const cache=new Map();
function send(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
function txt(v){return String(v??'').replace(/\s+/g,' ').trim();}
function num(v){if(v==null)return null;const s=String(v).replace(/,/g,'').replace(/--|－|—/g,'').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function cleanKey(v){return txt(v).replace(/\s/g,'');}
function iso(d){const s=String(d||'').replace(/\D/g,'');if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;if(/^\d{7}$/.test(s))return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;return txt(d);}
function ymdToIso(d){return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;}
async function fetchJson(url,timeout=6500){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*','Accept-Language':'zh-TW,zh;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(t)}}
async function cached(key,ttl,fn){const h=cache.get(key);if(h&&Date.now()-h.t<ttl)return h.v;const v=await fn();cache.set(key,{t:Date.now(),v});return v;}
async function mapLimit(items,limit,fn){let i=0;const out=new Array(items.length);async function w(){while(i<items.length){const j=i++;try{out[j]=await fn(items[j],j)}catch(e){out[j]=null}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out;}
function weekdays(n=36){const out=[],d=new Date();for(let i=1;out.length<n&&i<90;i++){const x=new Date(d);x.setDate(d.getDate()-i);if(x.getDay()===0||x.getDay()===6)continue;out.push(`${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}${String(x.getDate()).padStart(2,'0')}`);}return out;}
function valByTerms(fields,row,terms){for(let i=0;i<fields.length;i++){const k=cleanKey(fields[i]);if(terms.some(t=>k.includes(t)))return num(row[i]);}return null;}
function t86Row(fields,row){const code=txt(row[0]),name=txt(row[1]);if(!/^\d{4,6}[A-Z]?$/.test(code))return null;
 const fb=valByTerms(fields,row,['外陸資買進股數(不含外資自營商)','外陸資買進股數']);
 const fs=valByTerms(fields,row,['外陸資賣出股數(不含外資自營商)','外陸資賣出股數']);
 const fn=valByTerms(fields,row,['外陸資買賣超股數(不含外資自營商)','外陸資買賣超股數']);
 const fdb=valByTerms(fields,row,['外資自營商買進股數'])||0;
 const fds=valByTerms(fields,row,['外資自營商賣出股數'])||0;
 const fdn=valByTerms(fields,row,['外資自營商買賣超股數'])||0;
 const tb=valByTerms(fields,row,['投信買進股數']),ts=valByTerms(fields,row,['投信賣出股數']),tn=valByTerms(fields,row,['投信買賣超股數']);
 const dsb=valByTerms(fields,row,['自營商(自行買賣)買進股數','自營商自行買賣買進股數']);
 const dss=valByTerms(fields,row,['自營商(自行買賣)賣出股數','自營商自行買賣賣出股數']);
 const dsn=valByTerms(fields,row,['自營商(自行買賣)買賣超股數','自營商自行買賣買賣超股數']);
 const dhb=valByTerms(fields,row,['自營商(避險)買進股數','自營商避險買進股數']);
 const dhs=valByTerms(fields,row,['自營商(避險)賣出股數','自營商避險賣出股數']);
 const dhn=valByTerms(fields,row,['自營商(避險)買賣超股數','自營商避險買賣超股數']);
 const dealerNet=valByTerms(fields,row,['自營商買賣超股數']) ?? ((dsn||0)+(dhn||0));
 const dealerBuy=(dsb||0)+(dhb||0),dealerSell=(dss||0)+(dhs||0);
 const foreignNet=(fn==null?null:fn+fdn),foreignBuy=(fb==null?null:fb+fdb),foreignSell=(fs==null?null:fs+fds);
 const total=valByTerms(fields,row,['三大法人買賣超股數']) ?? ((foreignNet||0)+(tn||0)+(dealerNet||0));
 return {code,name,foreign:{buy:foreignBuy,sell:foreignSell,net:foreignNet},trust:{buy:tb,sell:ts,net:tn},dealer:{buy:dealerBuy||null,sell:dealerSell||null,net:dealerNet,selfNet:dsn,hedgeNet:dhn},total:{net:total,buy:(foreignBuy||0)+(tb||0)+dealerBuy||null,sell:(foreignSell||0)+(ts||0)+dealerSell||null}};
}
async function twseByDate(d){return await cached(`t86:${d}`,10*60*1000,async()=>{const j=await fetchJson(`${TWSE_T86}?date=${d}&selectType=ALLBUT0999&response=json`,7000);if(j?.stat!=='OK'||!Array.isArray(j.data))return [];const fields=j.fields||[];return j.data.map(r=>t86Row(fields,r)).filter(Boolean).map(x=>({...x,date:ymdToIso(d)}));});}
function tpexCodeOf(o){return txt(o.SecuritiesCompanyCode||o.Code||o['證券代號']||o['股票代號']);}
function tpexVal(o,terms){for(const [k,v] of Object.entries(o||{})){const kk=k.replace(/\s/g,'').toLowerCase();if(terms.some(t=>kk.includes(t.toLowerCase())))return num(v);}return null;}
async function tpexLatest(code){const a=await cached('tpex-3insti',10*60*1000,()=>fetchJson(`${TPEX}/tpex_3insti_daily_trading`,7000));const r=Array.isArray(a)?a.find(x=>tpexCodeOf(x)===code):null;if(!r)return [];
 const foreign=tpexVal(r,['foreigninvestorsincludemainlandareainvestors-difference','foreigninvestors-difference','外資及陸資買賣超股數']);
 const trust=tpexVal(r,['securitiesinvestmenttrustcompanies-difference','投信買賣超股數']);
 const dealer=tpexVal(r,['dealers-difference','自營商買賣超股數']);
 const total=tpexVal(r,['totaldifference','三大法人買賣超股數合計']);
 return [{date:iso(r.Date||r['日期']),code,name:txt(r.CompanyName||r.Name||r['證券名稱']||code),foreign:{buy:null,sell:null,net:foreign},trust:{buy:null,sell:null,net:trust},dealer:{buy:null,sell:null,net:dealer},total:{buy:null,sell:null,net:total??(foreign||0)+(trust||0)+(dealer||0)}}];}
function sumRows(rows,key,count){const a=rows.slice(-count),s=a.reduce((m,x)=>m+(num(x[key]?.net)||0),0),buy=a.reduce((m,x)=>m+(num(x[key]?.buy)||0),0),sell=a.reduce((m,x)=>m+(num(x[key]?.sell)||0),0);return {days:count,net:s,buy,sell,sampleDays:a.length};}
function streak(rows,key){let dir=0,n=0;for(let i=rows.length-1;i>=0;i--){const v=num(rows[i]?.[key]?.net)||0;if(!v)break;const d=v>0?1:-1;if(!dir)dir=d;if(d!==dir)break;n++;}return {days:n,direction:dir>0?'buy':dir<0?'sell':'flat',label:n?`${dir>0?'連買':'連賣'} ${n} 日`:'無連續買賣'};}
function buildSummary(rows){const keys=['foreign','trust','dealer','total'];const out={latest:rows.at(-1)||null};keys.forEach(k=>{out[k]={streak:streak(rows,k),sum5:sumRows(rows,k,5),sum10:sumRows(rows,k,10),sum20:sumRows(rows,k,20)};});return out;}
function rankRows(rows,type='foreign',side='buy',limit=30){const key=['foreign','trust','dealer','total'].includes(type)?type:'foreign';return rows.filter(x=>num(x[key]?.net)!=null).sort((a,b)=>side==='sell'?(num(a[key].net)-num(b[key].net)):(num(b[key].net)-num(a[key].net))).slice(0,limit).map(x=>({date:x.date,code:x.code,name:x.name,type:key,net:x[key].net,buy:x[key].buy,sell:x[key].sell}));}
async function codeMode(code,market,days){if(market==='TPEX'||market==='TPEx'){const rows=await tpexLatest(code);return {ok:true,mode:'stock',code,market:'TPEx',rows,summary:buildSummary(rows),source:'TPEx OpenAPI 三大法人買賣明細資訊',note:'上櫃目前採 TPEx 公開最新日資料；歷史日序列若資料源未提供，即不補造。'};}
 const ds=weekdays(Math.max(10,Math.min(40,days+10)));const packs=await mapLimit(ds,5,d=>twseByDate(d));const rows=packs.flat().filter(x=>x&&x.code===code).sort((a,b)=>a.date.localeCompare(b.date)).slice(-Math.max(5,Math.min(30,days)));
 return {ok:true,mode:'stock',code,market:'TWSE',rows,summary:buildSummary(rows),source:'TWSE T86 三大法人買賣超日報',note:'欄位包含外資及陸資、投信、自營商與三大法人買賣超；此處只使用交易所公開資料，不抓取或重製 Yahoo 頁面。'};}
async function listMode(type,side,limit){let used=null,rows=[];for(const d of weekdays(10)){const r=await twseByDate(d).catch(()=>[]);if(r.length){used=d;rows=r;break;}}return {ok:true,mode:'list',date:used?ymdToIso(used):null,type,side,items:rankRows(rows,type,side,Math.max(5,Math.min(50,limit))),source:'TWSE T86 三大法人買賣超日報',note:'排行榜依最近可得交易日公開盤後資料排序；不是盤中即時法人下單，也不是券商分點主力資料。'};}
module.exports=async function handler(req,res){res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=3600');res.setHeader('Access-Control-Allow-Origin','*');try{const mode=txt(req.query?.mode||'stock').toLowerCase();if(mode==='list'){return send(res,200,await listMode(txt(req.query?.type||'foreign').toLowerCase(),txt(req.query?.side||'buy').toLowerCase(),Number(req.query?.limit)||25));}const code=txt(req.query?.code).toUpperCase();if(!/^\d{4,6}[A-Z]?$/.test(code))return send(res,400,{ok:false,error:'代號格式錯誤'});const market=/tpex|otc/i.test(txt(req.query?.market))?'TPEx':'TWSE';return send(res,200,await codeMode(code,market,Number(req.query?.days)||20));}catch(e){return send(res,200,{ok:false,error:e?.message||'資料來源暫時無法使用',source:'TWSE / TPEx public data',note:'法人資料僅使用官方公開資訊；不抓取 Yahoo HTML，也不使用未授權分點資料。'});}};
