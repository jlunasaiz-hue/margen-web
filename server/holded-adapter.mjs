// Holded API v2. Credentials and company membership are resolved only by server code.
const HOLD_ENDPOINT='https://api.holded.com/api/v2/purchases';
const error=(code,retryAfterSeconds)=>Object.assign(Error(code),{code,retryAfterSeconds});
const decimal=(value,label)=>{if(typeof value!=='string'&&typeof value!=='number')throw error('HOLDED_INVALID_'+label);if(typeof value==='string'&&!/^\d+(\.\d+)?$/.test(value))throw error('HOLDED_INVALID_'+label);const n=typeof value==='number'?value:Number(value);if(value===null||value===undefined||typeof value==='boolean'||!Number.isFinite(n)||n<0||n>1e12)throw error('HOLDED_INVALID_'+label);return n;};
const required=(value,label,max=120)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw error('HOLDED_INVALID_'+label);return value.trim();};
function day(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||Number.isNaN(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw error('HOLDED_INVALID_DATE');return value;}
export function normalizeHoldedPurchase(doc){
 const id=required(doc?.id,'DOCUMENT_ID',50);if(['cancelled','failed'].includes(doc.status)||doc.draft===true)return [];
 if(!['completed','pending','partial'].includes(doc.status))throw error('HOLDED_UNKNOWN_STATUS');
 if(doc.currency!=='EUR')throw error('HOLDED_UNSUPPORTED_CURRENCY');
 const supplier=required(doc.contact_name,'SUPPLIER'),date=day(doc.date),invoice=doc.document_number==null?'':required(doc.document_number,'INVOICE');
 if(!Array.isArray(doc.lines)||doc.lines.length>5000)throw error('HOLDED_INVALID_LINES');
 const subtotal=decimal(doc.subtotal,'SUBTOTAL'),discount=decimal(doc.discount,'DISCOUNT'),tax=decimal(doc.tax,'TAX'),total=decimal(doc.total,'TOTAL');
 const seen=new Set();let before=0,afterLineDiscount=0;
 const lines=doc.lines.map(line=>{const lid=required(line.line_id,'LINE_ID',50);if(seen.has(lid))throw error('HOLDED_DUPLICATE_LINE');seen.add(lid);const price=decimal(line.price,'PRICE'),quantity=decimal(line.units,'UNITS'),pct=decimal(line.discount,'LINE_DISCOUNT');if(pct>100)throw error('HOLDED_INVALID_LINE_DISCOUNT');const discounted=price*(1-pct/100);before+=price*quantity;afterLineDiscount+=discounted*quantity;return {id:'holded:'+id+':'+lid,supplier,item:required(line.name,'ITEM'),unit:line.unit_type==null?'unidad sin especificar':required(line.unit_type,'UNIT',40),unitPrice:discounted,quantity,date,invoice,supplied:line.supplied===true};});
 if(Math.abs(before-subtotal)>0.02||discount>subtotal+0.01||Math.abs(total-tax-(subtotal-discount))>0.02)throw error('HOLDED_TOTALS_REQUIRE_REVIEW');
 const net=subtotal-discount;if(net>afterLineDiscount+0.02||net< -0.01)throw error('HOLDED_DISCOUNT_REQUIRES_REVIEW');
 // A residual document discount is allocated proportionally after each line discount.
 const factor=afterLineDiscount>0?Math.max(0,net)/afterLineDiscount:1;
 return lines.filter(line=>!line.supplied&&line.quantity>0).map(({supplied,...line})=>({...line,unitPrice:line.unitPrice*factor}));
}
async function boundedHoldedJson(response){const reader=response.body?.getReader();if(!reader)throw error('HOLDED_EMPTY_RESPONSE');let size=0,text='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw error('HOLDED_RESPONSE_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}try{return JSON.parse(text+decoder.decode());}catch{throw error('HOLDED_INVALID_JSON');}}
export function createHoldedConnector({getConnection,fetcher=fetch,now=()=>Date.now(),refreshSeconds=21600,maxPages=20,maxLines=5000}={}){
 if(typeof getConnection!=='function'||!Number.isInteger(refreshSeconds)||refreshSeconds<60||refreshSeconds>2592000||!Number.isInteger(maxPages)||maxPages<1||maxPages>100||!Number.isInteger(maxLines)||maxLines<1||maxLines>5000)throw error('HOLDED_INVALID_CONFIGURATION');
 const cache=new Map(),pending=new Map(),cooldown=new Map();
 async function cacheKey(workspaceId,connection){const bytes=new TextEncoder().encode(connection.apiKey),digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');return workspaceId+':'+hash+':'+connection.startDate+':'+connection.endDate;}
 return {provider:'holded',syncIntervalSeconds:refreshSeconds,async fetchCosts({workspaceId,actorId,signal}){
  if(signal?.aborted)throw error('HOLDED_ABORTED');
  const connection=await getConnection({workspaceId,actorId});
  if(!connection||connection.authorized!==true||connection.workspaceId!==workspaceId||typeof connection.apiKey!=='string'||!connection.apiKey.trim()||/[\r\n]/.test(connection.apiKey)||connection.apiKey.length>4096)throw error('HOLDED_ACCESS_DENIED');
  day(connection.startDate);day(connection.endDate);const span=Date.parse(connection.endDate)-Date.parse(connection.startDate);if(span<0||span>366*86400000)throw error('HOLDED_INVALID_RANGE');
  const key=await cacheKey(workspaceId,connection),retryAt=cooldown.get(key)||0;
  if(retryAt>now())throw error('ERP_RATE_LIMITED',Math.ceil((retryAt-now())/1000));
  const existing=cache.get(key);if(existing&&existing.expires>now())return {...structuredClone(existing.feed),cached:true};
  // A separate caller never shares another caller's cancellation signal.
  if(pending.has(key)||pending.size>=2)throw error('ERP_BUSY');
  pending.set(key,true);
  try{let cursor=null,finished=false;const cursors=new Set(),documents=new Set(),purchases=[];
   for(let page=0;page<maxPages;page++){
    if(signal?.aborted)throw error('HOLDED_ABORTED');
    const url=new URL(HOLD_ENDPOINT);url.searchParams.set('limit','200');url.searchParams.set('approval_status','approved');url.searchParams.set('start_date',connection.startDate);url.searchParams.set('end_date',connection.endDate);if(cursor)url.searchParams.set('cursor',cursor);
    const response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+connection.apiKey,Accept:'application/json'},redirect:'error',signal});
    if(response.status===429){const raw=response.headers.get('retry-after'),seconds=raw&&/^\d+$/.test(raw)?Math.max(1,Math.min(31536000,Number(raw))):60;cooldown.delete(key);cooldown.set(key,now()+seconds*1000);while(cooldown.size>20)cooldown.delete(cooldown.keys().next().value);throw error('ERP_RATE_LIMITED',seconds);}
    if(!response.ok)throw error(response.status===401||response.status===403?'HOLDED_ACCESS_DENIED':'HOLDED_UNAVAILABLE');
    const body=await boundedHoldedJson(response);if(!body||!Array.isArray(body.items)||body.items.length>200||typeof body.has_more!=='boolean')throw error('HOLDED_INVALID_PAGE');
    for(const doc of body.items){const id=required(doc?.id,'DOCUMENT_ID',50);if(documents.has(id))throw error('HOLDED_DUPLICATE_DOCUMENT');documents.add(id);if(!['cancelled','failed'].includes(doc.status)&&doc.draft!==true){day(doc.date);if(doc.date<connection.startDate||doc.date>connection.endDate)throw error('HOLDED_DATE_OUTSIDE_RANGE');}purchases.push(...normalizeHoldedPurchase(doc));if(purchases.length>maxLines)throw error('HOLDED_TOO_MANY_LINES');}
    if(!body.has_more){finished=true;break;}cursor=required(body.cursor,'CURSOR',2000);if(cursors.has(cursor))throw error('HOLDED_CURSOR_REPEATED');cursors.add(cursor);
   }
   if(!finished)throw error('HOLDED_INCOMPLETE_PAGINATION');
   const feed={version:1,currency:'EUR',priceBasis:'net',purchases,provider:'holded',snapshot:{source:'holded',from:connection.startDate,to:connection.endDate},fetchedAt:new Date(now()).toISOString(),pollAfterSeconds:refreshSeconds,cached:false};cache.delete(key);cache.set(key,{feed:structuredClone(feed),expires:now()+refreshSeconds*1000});while(cache.size>20)cache.delete(cache.keys().next().value);cooldown.delete(key);return feed;
  }finally{pending.delete(key);}
 }};
}
