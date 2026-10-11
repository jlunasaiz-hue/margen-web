// Server-only coordinator. Supply an authenticated route, transactional persistent
// repository, signature verifier and contracted provider adapter before enabling it.
const active=new Set(['queued','dispatching','submitted','accepted','reconciliation_required']);
function fail(message){throw new Error(message);}
export async function authorizeAndQueue(input,{repository,now=()=>Date.now()}){
  if(!input.actorId||!input.supplyId||!input.offerId||!input.consentId)fail('Faltan identificadores verificados.');
  return repository.withSupplyLock(input.supplyId,async tx=>{
    const prior=await tx.findByConsent(input.consentId);
    if(prior){if(prior.actorId!==input.actorId||prior.supplyId!==input.supplyId||prior.offerId!==input.offerId)fail('La autorización pertenece a otra solicitud.');return prior;}
    if(await tx.findActive(input.supplyId,[...active]))fail('Ya existe un cambio pendiente para este suministro.');
    const [authority,offer,consent]=await Promise.all([tx.getAuthority(input.actorId,input.supplyId),tx.getOffer(input.offerId),tx.getConsent(input.consentId)]);
    if(authority?.status!=='verified')fail('Titularidad o representación sin verificar.');
    if(!offer||offer.status!=='verified'||offer.supplyId!==input.supplyId||!Number.isFinite(Date.parse(offer.expiresAt))||Date.parse(offer.expiresAt)<=now())fail('Oferta no verificada, ajena al suministro o caducada.');
    if(consent?.status!=='verified'||consent.actorId!==input.actorId||consent.supplyId!==input.supplyId||consent.offerId!==offer.id||!offer.contractHash||consent.contractHash!==offer.contractHash||consent.revokedAt||!consent.signatureEvidenceId)fail('Se necesita consentimiento verificado para este contrato concreto.');
    if(!Number.isFinite(offer.currentAnnualTotal)||!Number.isFinite(offer.newAnnualTotal)||offer.costsReviewed!==true||offer.exitPenaltyReviewed!==true||offer.eligibilityVerified!==true||offer.newAnnualTotal>=offer.currentAnnualTotal)fail('La comparación completa no acredita ahorro estimado.');
    const connection=await tx.getConnection(offer.providerId);
    if(connection?.status!=='live'||connection.contractingEnabled!==true)fail('No hay conexión de contratación habilitada.');
    // Unique consent and supply locking must be enforced by persistent storage.
    return tx.insert({actorId:input.actorId,supplyId:input.supplyId,offerId:offer.id,consentId:consent.id,providerId:offer.providerId,status:'queued',createdAt:new Date(now()).toISOString()});
  });
}
export async function dispatchSwitch(requestId,{repository,adapter}){
  return repository.withRequestLock(requestId,async tx=>{
    const request=await tx.getRequest(requestId);
    if(!request)fail('Solicitud desconocida.');
    if(request.status!=='queued')return request;
    if(adapter?.status!=='live'||adapter.providerId!==request.providerId)fail('Adaptador de contratación no disponible.');
    // Revalidate consent/quote/eligibility immediately before contracting.
    if(await tx.validateForDispatch(request)!==true) return tx.update(request.id,{status:'blocked'});
    await tx.update(request.id,{status:'dispatching'});
    try{
      const result=await adapter.submit({requestId:request.id,offerId:request.offerId,consentId:request.consentId,idempotencyKey:request.id});
      if(result?.status==='rejected')return tx.update(request.id,{status:'rejected'});
      if(result?.status==='received'&&typeof result.externalId==='string'&&result.externalId.trim())return tx.update(request.id,{status:'submitted',externalId:result.externalId});
      return tx.update(request.id,{status:'reconciliation_required'});
    }catch{
      // A timeout may occur AFTER the provider receives the order. Never resend
      // blindly: query the provider by the same key before any further dispatch.
      return tx.update(request.id,{status:'reconciliation_required'});
    }
  });
}
export async function applyProviderEvent(raw,{repository,verifyProviderEvent}){
  const event=await verifyProviderEvent(raw);
  if(!event||!event.id||!event.providerId||!event.externalId||!['accepted','activated','rejected'].includes(event.status))fail('Evento de compañía no verificado.');
  return repository.withExternalRequestLock(event.providerId,event.externalId,async tx=>{
    const request=await tx.findExternal(event.providerId,event.externalId);
    if(!request)fail('Evento sin solicitud asociada.');
    if(['activated','rejected'].includes(request.status))return request;
    if(!['submitted','accepted','reconciliation_required'].includes(request.status))fail('Estado incompatible con la respuesta.');
    if(!await tx.recordEventOnce(event.id))return request;
    return tx.update(request.id,{status:event.status});
  });
}
