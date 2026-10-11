import {authorizeAndQueue} from './switching.mjs';
import {RepositoryBusy} from './sqlite-repository.mjs';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function smallJson(request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('JSON_REQUIRED');
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_JSON');let size=0,text='';const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('TOO_LARGE');}text+=decoder.decode(value,{stream:true});}
 text+=decoder.decode();try{return JSON.parse(text);}catch{throw Error('INVALID_JSON');}
}
export function createSwitchHandler({repository,authenticate,origin,contractingEnabled=false}){
 return async request=>{
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/switching/capabilities'&&request.method==='GET')return reply(200,{contractingAvailable:contractingEnabled===true&&typeof authenticate==='function',mode:contractingEnabled===true&&typeof authenticate==='function'?'configured':'not_connected'});
  if(!path.startsWith('/api/switching/requests'))return reply(404,{error:'NOT_FOUND'});
  if(request.method!=='GET'&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  // Readiness checks never accept a browser-supplied "verified" flag.
  if(typeof authenticate!=='function'||request.method==='POST'&&contractingEnabled!==true)return reply(503,{error:'CONTRACTING_UNAVAILABLE'});
  if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply(403,{error:'ORIGIN_REJECTED'});
  let session;try{session=await authenticate(request);}catch{return reply(401,{error:'AUTH_REQUIRED'});}
  if(!session?.actorId||session.authenticated!==true)return reply(401,{error:'AUTH_REQUIRED'});
  if(request.method==='GET'){
   if(path==='/api/switching/requests')return reply(200,{requests:repository.listOwnedRequests(session.actorId).map(row=>({id:row.id,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt}))});
   const match=path.match(/^\/api\/switching\/requests\/([a-zA-Z0-9-]{1,128})$/);if(!match)return reply(404,{error:'NOT_FOUND'});
   const row=repository.getOwnedRequest(match[1],session.actorId);if(!row)return reply(404,{error:'NOT_FOUND'});
   // Keep internal identifiers and evidence out of status responses.
   return reply(200,{id:row.id,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt,history:repository.getOwnedTimeline(row.id,session.actorId)});
  }
  if(path!=='/api/switching/requests')return reply(404,{error:'NOT_FOUND'});
  let input;try{input=await smallJson(request);}catch(error){return reply(error.message==='TOO_LARGE'?413:400,{error:error.message});}
  const fields=['supplyId','offerId','consentId'];
  if(!input||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key))||fields.some(key=>typeof input[key]!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(input[key])))return reply(400,{error:'INVALID_REQUEST'});
  try{const row=await authorizeAndQueue({...input,actorId:session.actorId},{repository});return reply(202,{id:row.id,status:row.status});}
  catch(error){if(error instanceof RepositoryBusy)return reply(409,{error:'REQUEST_BUSY'});return reply(409,{error:'REQUEST_NOT_ELIGIBLE'});}
 };
}
