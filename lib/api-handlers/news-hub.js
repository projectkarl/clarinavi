const UA='Mozilla/5.0 (compatible; ClariNavi/Current; financial news hub)';
const STOCKS=[
  ['2330','台積電','TW'],['2317','鴻海','TW'],['2454','聯發科','TW'],['2308','台達電','TW'],['2382','廣達','TW'],['3231','緯創','TW'],['6669','緯穎','TW'],['3661','世芯-KY','TW'],['3443','創意','TW'],['3034','聯詠','TW'],['2379','瑞昱','TW'],['3711','日月光投控','TW'],['2303','聯電','TW'],['2408','南亞科','TW'],['2344','華邦電','TW'],['2357','華碩','TW'],['2356','英業達','TW'],['3017','奇鋐','TW'],['3324','雙鴻','TW'],['2059','川湖','TW'],['3008','大立光','TW'],['2412','中華電','TW'],['2881','富邦金','TW'],['2882','國泰金','TW'],['2891','中信金','TW'],['2603','長榮','TW'],['2609','陽明','TW'],['2615','萬海','TW'],['2002','中鋼','TW'],['1301','台塑','TW'],['1303','南亞','TW'],['5871','中租-KY','TW'],['6446','藥華藥','TW'],['1519','華城','TW'],
  ['AAPL','Apple','US'],['MSFT','Microsoft','US'],['NVDA','NVIDIA','US'],['TSLA','Tesla','US'],['META','Meta','US'],['AMZN','Amazon','US'],['GOOGL','Alphabet','US'],['AMD','AMD','US'],['AVGO','Broadcom','US'],['SMCI','Super Micro','US']
];
function clean(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function send(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
async function fetchText(url,timeout=4800){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,application/rss+xml,text/xml,text/plain,*/*','Accept-Language':'zh-TW,zh;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
async function fetchJson(url,timeout=4800){const txt=await fetchText(url,timeout);try{return JSON.parse(txt)}catch{throw new Error('JSON parse failed')}}
function ts(s){const x=String(s||'');if(/^\d{14}$/.test(x))return Date.parse(`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}T${x.slice(8,10)}:${x.slice(10,12)}:00Z`)||0;const d=Date.parse(x);return Number.isFinite(d)?d:0}
function dateFmt(s){const x=String(s||'');if(/^\d{14}$/.test(x))return `${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)} ${x.slice(8,10)}:${x.slice(10,12)}`;return x}
function parseGoogleRss(xml){const items=[];const re=/<item\b[\s\S]*?<\/item>/gi;let m;while((m=re.exec(xml))&&items.length<80){const block=m[0];const val=tag=>{const x=block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return clean(x?.[1]||'')};const title=val('title'),link=val('link'),pub=val('pubDate'),source=val('source')||'Google News';if(title)items.push({title,url:link,source,date:pub,seenAt:ts(pub),via:'Google News RSS'});}return items}
async function gdelt(query,days,limit){const span=days<=2?`${days}d`:days<=7?'1week':days<=30?'1month':'3months';const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${Math.min(75,Math.max(10,limit*3))}&format=json&sort=datedesc&timespan=${encodeURIComponent(span)}`;const j=await fetchJson(url,4800);return (Array.isArray(j?.articles)?j.articles:[]).map(a=>({title:a.title,url:a.url,source:clean(a.domain)||'GDELT',date:dateFmt(a.seendate),seenAt:ts(a.seendate),language:clean(a.language),country:clean(a.sourcecountry),via:'GDELT'}));}
async function google(query){const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;return parseGoogleRss(await fetchText(url,4800));}
function tag(title){const text=String(title||'').toUpperCase();const out=[];for(const [code,name,market] of STOCKS){const codeHit=new RegExp(`(^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Z0-9]|$)`,'i').test(text);const nameHit=text.includes(String(name).toUpperCase());if(codeHit||nameHit)out.push({code,name,market});if(out.length>=6)break;}return out;}
function topic(title){const t=String(title||'');if(/AI|人工智慧|伺服器|NVIDIA|輝達|GB200|半導體|晶片|台積電|聯發科/i.test(t))return 'AI / 半導體';if(/台股|加權|台指|大盤|上市|上櫃/.test(t))return '台股大盤';if(/美股|NASDAQ|那斯達克|S&P|Fed|降息|美元|科技股/i.test(t))return '美股 / 總經';if(/金融|銀行|保險|金控|中信金|富邦金|國泰金/.test(t))return '金融';if(/航運|長榮|陽明|萬海|貨櫃|散裝/.test(t))return '航運';if(/記憶體|DRAM|NAND|南亞科|華邦電/i.test(t))return '記憶體';return '財經新聞';}
function dedupePush(out,item,seen){const title=clean(item.title),url=clean(item.url);if(!title)return;const key=(url||title).replace(/^https?:\/\/(www\.)?/,'').slice(0,180);if(seen.has(key))return;seen.add(key);const tags=tag(title);out.push({...item,title,url,tags,topic:topic(title)});}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');res.setHeader('Access-Control-Allow-Origin','*');
 const days=Math.max(1,Math.min(30,Number(req.query?.days)||3));const limit=Math.max(10,Math.min(24,Number(req.query?.limit)||14));
 const raw=clean(req.query?.q);const base=raw||'台股 OR 台積電 OR 聯發科 OR 台達電 OR 鴻海 OR AI伺服器 OR 半導體 OR 美股科技股 OR 金融股 OR 航運股 OR 記憶體';
 const queries=[base, raw?`${raw} 股票 財經`:'台股 財經新聞 股票 半導體 AI', 'site:money.udn.com 台股 OR 財經 OR 股票'];
 const out=[],seen=new Set(),errors=[];
 for(const query of queries){
   if(out.length>=limit)break;
   try{for(const x of await gdelt(query,days,limit))dedupePush(out,x,seen)}catch(e){errors.push(`GDELT ${query.slice(0,18)}: ${e.message}`)}
   if(out.length>=limit)break;
   try{for(const x of await google(query))dedupePush(out,x,seen)}catch(e){errors.push(`Google News ${query.slice(0,18)}: ${e.message}`)}
 }
 const cut=Date.now()-days*86400000;const sorted=out.sort((a,b)=>(b.seenAt||0)-(a.seenAt||0));const recent=sorted.filter(x=>!x.seenAt||x.seenAt>=cut);const chosen=(recent.length>=6?recent:sorted).slice(0,limit).map(({seenAt,...x})=>x);
 const tagCount=chosen.reduce((a,x)=>a+(x.tags?.length||0),0);
 return send(res,200,{ok:true,items:chosen,tagCount,days,limit,query:raw||null,errors,source:'GDELT DOC 2.0 + Google News RSS public index',note:'新聞專區只顯示標題、來源、日期與原文連結；股票標籤由標題關鍵字比對產生，供快速跳到個股頁研究，不代表新聞一定只影響該公司。'});
};
