import {createHoldedConnector} from './holded-adapter.mjs';
import contribution from '../margin-core.js';
const erpReply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie, Authorization'}});
export function createErpHandler({authenticate,connector,timeoutMs=10000,now=()=>new Date().toISOString()}={}){
 const configured=typeof authenticate==='function'&&typeof connector?.fetchCosts==='function';
 return async request=>{
  const url=new URL(request.url);
  if(request.method!=='GET')return erpReply(405,{error:'READ_ONLY'});
  if(url.pathname==='/api/erp/status')return erpReply(200,{configured,connected:false,mode:configured?'ready_to_sync':'not_configured',supportedProviders:['holded'],provider:connector?.provider==='holded'?'holded':null});
  if(url.pathname!=='/api/erp/catalog'||url.search)return erpReply(404,{error:'NOT_FOUND'});
  if(!configured)return erpReply(503,{error:'ERP_NOT_CONFIGURED'});
  let identity;try{identity=await authenticate(request);}catch{return erpReply(401,{error:'AUTH_REQUIRED'});}
  if(identity?.authenticated!==true||typeof identity.actorId!=='string'||!identity.actorId||typeof identity.workspaceId!=='string'||!identity.workspaceId)return erpReply(401,{error:'AUTH_REQUIRED'});
  const controller=new AbortController();let timer;
  try{const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},timeoutMs)});const raw=await Promise.race([connector.fetchCosts({workspaceId:identity.workspaceId,actorId:identity.actorId,signal:controller.signal}),timeout]);const feed=contribution.normalizeFeed(raw);let metadata={};if(raw.provider==='holded'){const snap=raw.snapshot;if(!snap||snap.source!=='holded'||!/^\d{4}-\d{2}-\d{2}$/.test(snap.from)||!/^\d{4}-\d{2}-\d{2}$/.test(snap.to)||feed.purchases.some(row=>!row.id.startsWith('holded:'))||!Number.isFinite(Date.parse(raw.fetchedAt))||!Number.isInteger(raw.pollAfterSeconds)||raw.pollAfterSeconds<60||raw.pollAfterSeconds>2592000)throw Error('INVALID_METADATA');metadata={provider:'holded',snapshot:{source:'holded',from:snap.from,to:snap.to},fetchedAt:raw.fetchedAt,pollAfterSeconds:raw.pollAfterSeconds,cached:raw.cached===true};}return erpReply(200,{...feed,purchases:feed.purchases.map(({current,...row})=>({...row,unitPrice:current})),...metadata,syncedAt:now()});}
  catch(error){if(error.code==='ERP_RATE_LIMITED'&&Number.isInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>=1&&error.retryAfterSeconds<=31536000){const response=erpReply(429,{error:'ERP_RATE_LIMITED',retryAfterSeconds:error.retryAfterSeconds});response.headers.set('retry-after',String(error.retryAfterSeconds));return response;}if(error.code==='ERP_BUSY')return erpReply(503,{error:'ERP_BUSY'});return erpReply(error.message==='TIMEOUT'?504:502,{error:error.message==='TIMEOUT'?'ERP_TIMEOUT':'ERP_RESPONSE_INVALID_OR_UNAVAILABLE'});}
  finally{clearTimeout(timer);}
 };
}

export function createHoldedErpHandler({authenticate,getConnection,fetcher,now,refreshSeconds=21600,timeoutMs=10000}={}){return createErpHandler({authenticate,timeoutMs,connector:createHoldedConnector({getConnection,fetcher,now,refreshSeconds})});}
