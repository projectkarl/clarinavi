const UA='Mozilla/5.0 (compatible; ClariNavi/Current; public company news index)';
async function fetchText(url,timeout=4300){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':UA,'Accept':'application/json,application/rss+xml,text/xml,text/plain,*/*','Accept-Language':'zh-TW,zh;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
async function fetchJson(url,timeout=4300){const txt=await fetchText(url,timeout);try{return JSON.parse(txt)}catch(e){throw new Error('JSON parse failed')}}
function send(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
function clean(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function dateFmt(s){const x=String(s||'');if(/^\d{14}$/.test(x))return `${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)} ${x.slice(8,10)}:${x.slice(10,12)}`;return x}
function ts(s){const x=String(s||'');if(/^\d{14}$/.test(x))return Date.parse(`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}T${x.slice(8,10)}:${x.slice(10,12)}:00Z`)||0;const d=Date.parse(x);return Number.isFinite(d)?d:0}
function dedupePush(out,item,seen){const u=clean(item.url),title=clean(item.title);if(!title)return;const key=(u||title).replace(/^https?:\/\/(www\.)?/,'').slice(0,180);if(seen.has(key))return;seen.add(key);out.push({...item,title,url:u})}
async function gdelt(query,days){const span=days<=2?`${days}d`:days<=7?'1week':days<=30?'1month':'3months';const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=50&format=json&sort=datedesc&timespan=${encodeURIComponent(span)}`;const j=await fetchJson(url);return (Array.isArray(j?.articles)?j.articles:[]).map(a=>({title:a.title,url:a.url,source:clean(a.domain)||'GDELT',date:dateFmt(a.seendate),seenAt:ts(a.seendate),language:clean(a.language),country:clean(a.sourcecountry),via:'GDELT'}))}
function parseGoogleRss(xml){const items=[];const re=/<item\b[\s\S]*?<\/item>/gi;let m;while((m=re.exec(xml))&&items.length<40){const block=m[0];const val=tag=>{const x=block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return clean(x?.[1]||'')};const title=val('title'),link=val('link'),pub=val('pubDate'),source=val('source')||'Google News';if(title)items.push({title,url:link,source,date:pub,seenAt:ts(pub),via:'Google News RSS'});}return items}
async function googleNews(query,market){const hl=market==='US'?'en-US':'zh-TW',gl=market==='US'?'US':'TW',ceid=market==='US'?'US:en':'TW:zh-Hant';const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;const xml=await fetchText(url,4300);return parseGoogleRss(xml)}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');res.setHeader('Access-Control-Allow-Origin','*');
 const symbol=clean(req.query?.symbol||req.query?.code).toUpperCase(),name=clean(req.query?.name),market=clean(req.query?.market||'TW').toUpperCase(),days=Math.max(1,Math.min(90,Number(req.query?.days)||14));
 if(!symbol&&!name)return send(res,400,{error:'缺少股票名稱或代號'});
 const safeName=name.replace(/\d{4,6}[A-Z]?/g,'').trim();
 const queries=market==='US'?
   [`${safeName||symbol} ${symbol} stock earnings shares`, `${safeName||symbol} ${symbol} analyst revenue`, `${symbol} stock news`]:
   [safeName?`${safeName} 股票 股價 財報 法說`:`${symbol} 股票 股價 財報 法說`, safeName?`${safeName} ${symbol} 新聞`:`${symbol} 台股 新聞`, `${safeName||symbol} 外資 投信 營收`];
 const out=[],seen=new Set(),errors=[];
 for(const query of queries){
   if(out.length>=10)break;
   try{for(const x of await gdelt(query,days))dedupePush(out,x,seen)}catch(e){errors.push('GDELT: '+e.message)}
   if(out.length>=10)break;
   try{for(const x of await googleNews(query,market))dedupePush(out,x,seen)}catch(e){errors.push('Google News RSS: '+e.message)}
 }
 const cut=Date.now()-days*86400000;const sorted=out.sort((a,b)=>(b.seenAt||0)-(a.seenAt||0));const recent=sorted.filter(x=>!x.seenAt||x.seenAt>=cut);const chosen=(recent.length>=3?recent:sorted).slice(0,10).map(({seenAt,...x})=>x);
 return send(res,200,{symbol,name,market,items:chosen,requestedDays:days,usedFallback:chosen.some(x=>x.via==='Google News RSS'),errors,source:'GDELT DOC 2.0 + Google News RSS public index',note:`依「${safeName||symbol}」與股票、股價、財報、法說、外資等關鍵字查詢最多 10 則公開新聞索引；只列標題、來源、日期與原文連結，不重製新聞全文。`});
};
