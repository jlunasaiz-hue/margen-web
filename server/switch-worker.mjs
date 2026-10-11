import {dispatchSwitch} from './switching.mjs';
import {RepositoryBusy} from './sqlite-repository.mjs';
export async function reconcileSwitch(requestId,{repository,adapter}){
 return repository.withRequestLock(requestId,async tx=>{
  const request=await tx.getRequest(requestId);
  if(!request||!['dispatching','submitted','accepted','reconciliation_required'].includes(request.status))return request;
  if(adapter?.status!=='live'||adapter.providerId!==request.providerId||typeof adapter.lookupByKey!=='function')return request;
  try{
   const result=await adapter.lookupByKey(request.id);
   if(['received','accepted','activated','rejected'].includes(result?.status)&&typeof result.externalId==='string'&&result.externalId.trim()){
    if(request.externalId&&request.externalId!==result.externalId)return tx.update(request.id,{status:'reconciliation_required'});
    const status=result.status==='received'?'submitted':result.status;
    if(request.status===status&&request.externalId===result.externalId||request.status==='accepted'&&status==='submitted')return request;
    return tx.update(request.id,{status,externalId:result.externalId});
   }
  }catch{/* Leave an ambiguous order for reconciliation, never duplicate it. */}
  if(['submitted','accepted'].includes(request.status))return request;
  return tx.update(request.id,{status:'reconciliation_required'});
 });
}
export async function runQueueOnce({repository,adapters=new Map(),limit=20}){
 const results=[];
 for(const request of repository.listWork(limit)){
  const adapter=adapters.get(request.providerId);if(adapter?.status!=='live'){results.push({id:request.id,outcome:'provider_unavailable'});continue;}
  try{const result=request.status==='queued'?await dispatchSwitch(request.id,{repository,adapter}):await reconcileSwitch(request.id,{repository,adapter});results.push({id:request.id,outcome:result.status});}
  catch(error){results.push({id:request.id,outcome:error instanceof RepositoryBusy?'busy':'failed'});}
 }
 return results;
}
