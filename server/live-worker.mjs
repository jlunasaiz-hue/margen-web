import {createErpHandler} from './erp-api.mjs';
const RELEASE='20261012-matching-1';
const headers={'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(status,value,extra={})=>new Response(JSON.stringify(value),{status,headers:{...headers,'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
function validDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
async function boundedJson(response){const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('UPSTREAM_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
export function createLiveWorker(assets,{fetcher=fetch,now=()=>Date.now(),timeoutMs=12000,maxInflight=8,erpHandler=createErpHandler()}={}){
 const prices=new Map(),inflight=new Map();
 async function load(date){
  const cached=prices.get(date);if(cached&&cached.expires>now())return {...cached,cache:'HIT'};
  if(inflight.has(date))return inflight.get(date);
  if(inflight.size>=maxInflight)throw Error('BUSY');
  const promise=(async()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{
   const url=new URL('https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real');url.search=new URLSearchParams({start_date:date+'T00:00',end_date:date+'T23:59',time_trunc:'hour'});
   const response=await fetcher(url,{headers:{Accept:'application/json'},signal:controller.signal});if(!response.ok)throw Error('UPSTREAM_UNAVAILABLE');
   const payload=await boundedJson(response),series=payload?.included?.find(s=>s?.attributes?.title==='PVPC');
   if(!series?.attributes?.values?.length||series.attributes.values.some(v=>typeof v.value!=='number'||!Number.isFinite(v.value)||!v.datetime||Number.isNaN(Date.parse(v.datetime))))throw Error('UPSTREAM_INVALID');
   const value={payload,fetchedAt:new Date(now()).toISOString(),expires:now()+15*60*1000,cache:'MISS'};prices.delete(date);prices.set(date,value);while(prices.size>16)prices.delete(prices.keys().next().value);return value;
  }finally{clearTimeout(timer);}})();inflight.set(date,promise);try{return await promise;}finally{inflight.delete(date);}
 }
 return {async fetch(request){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health'&&request.method==='GET')return json(200,{status:'ok',release:RELEASE,contractingAvailable:false});
  if(path==='/api/switching/capabilities'&&request.method==='GET')return json(200,{contractingAvailable:false,mode:'not_connected'});
  if(path.startsWith('/api/switching/'))return json(503,{error:'CONTRACTING_UNAVAILABLE'});
  if(path==='/api/energy/prices'){
   if(request.method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'},{allow:'GET'});
   const date=url.searchParams.get('date')||'';
   if(!validDate(date)||[...url.searchParams.keys()].some(key=>key!=='date')||url.searchParams.getAll('date').length!==1)return json(400,{error:'INVALID_DATE'});
   try{const value=await load(date);return json(200,value.payload,{'cache-control':'public, max-age=60','x-margen-cache':value.cache,'x-margen-fetched-at':value.fetchedAt,'x-margen-source':'Red Electrica - REData'});}
   catch(error){return json(error.message==='BUSY'?503:error.name==='AbortError'?504:502,{error:error.message==='BUSY'?'TEMPORARILY_BUSY':'OFFICIAL_SOURCE_UNAVAILABLE'});}
  }
  if(path.startsWith('/api/erp/'))return erpHandler(request);
  if(path.startsWith('/api/'))return json(404,{error:'NOT_FOUND'});
  if(!['GET','HEAD'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'},{allow:'GET, HEAD'});
  const key=path==='/'?'index.html':path.slice(1);
  if(!Object.hasOwn(assets,key))return json(404,{error:'NOT_FOUND'});
  const asset=assets[key],cache=key==='sw.js'?'no-cache':key.endsWith('.html')?'public, max-age=0, must-revalidate':'public, max-age=3600';
  const responseHeaders={...headers,'content-type':asset.type,'cache-control':cache,etag:'"'+asset.hash+'"'};
  if(request.headers.get('if-none-match')===responseHeaders.etag)return new Response(null,{status:304,headers:responseHeaders});
  return new Response(request.method==='HEAD'?null:asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:responseHeaders});
 }};
}
