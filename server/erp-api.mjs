import contribution from '../margin-core.js';
const erpReply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie, Authorization'}});
export function createErpHandler({authenticate,connector,timeoutMs=10000,now=()=>new Date().toISOString()}={}){
 const configured=typeof authenticate==='function'&&typeof connector?.fetchCosts==='function';
 return async request=>{
  const url=new URL(request.url);
  if(request.method!=='GET')return erpReply(405,{error:'READ_ONLY'});
  if(url.pathname==='/api/erp/status')return erpReply(200,{configured,connected:false,mode:configured?'ready_to_sync':'not_configured'});
  if(url.pathname!=='/api/erp/catalog'||url.search)return erpReply(404,{error:'NOT_FOUND'});
  if(!configured)return erpReply(503,{error:'ERP_NOT_CONFIGURED'});
  let identity;try{identity=await authenticate(request);}catch{return erpReply(401,{error:'AUTH_REQUIRED'});}
  if(identity?.authenticated!==true||typeof identity.actorId!=='string'||!identity.actorId||typeof identity.workspaceId!=='string'||!identity.workspaceId)return erpReply(401,{error:'AUTH_REQUIRED'});
  const controller=new AbortController();let timer;
  try{const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},timeoutMs)});const raw=await Promise.race([connector.fetchCosts({workspaceId:identity.workspaceId,actorId:identity.actorId,signal:controller.signal}),timeout]);const feed=contribution.normalizeFeed(raw);return erpReply(200,{...feed,purchases:feed.purchases.map(({current,...row})=>({...row,unitPrice:current})),syncedAt:now()});}
  catch(error){return erpReply(error.message==='TIMEOUT'?504:502,{error:error.message==='TIMEOUT'?'ERP_TIMEOUT':'ERP_RESPONSE_INVALID_OR_UNAVAILABLE'});}
  finally{clearTimeout(timer);}
 };
}
