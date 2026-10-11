import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
const json=row=>row?JSON.parse(row.record):null;
const pending=['queued','dispatching','submitted','accepted','reconciliation_required'];
const record=row=>row?{id:row.id,actorId:row.actor_id,supplyId:row.supply_id,offerId:row.offer_id,consentId:row.consent_id,providerId:row.provider_id,status:row.status,externalId:row.external_id,createdAt:row.created_at,updatedAt:row.updated_at}:null;
export class RepositoryBusy extends Error{}
export class SqliteSwitchRepository{
 constructor(file,{now=()=>Date.now(),leaseMs=120000}={}){this.db=new DatabaseSync(file,{timeout:1000});this.now=now;this.leaseMs=leaseMs;this.tail=Promise.resolve();this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');}
 migrate(){this.db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));}
 close(){this.db.close();}
 // Admission has one atomic transaction; operations with network waits use leases.
 async serial(work){const promise=this.tail.then(work);this.tail=promise.catch(()=>{});return promise;}
 async withSupplyLock(_supplyId,work){return this.serial(async()=>{this.db.exec('BEGIN IMMEDIATE');try{const result=await work(this.context());this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}});}
 async withRequestLock(id,work){
  const token=randomUUID(),now=this.now();
  const result=await this.serial(()=>this.db.prepare('UPDATE switch_requests SET lease_token=?,lease_until=? WHERE id=? AND lease_until<=?').run(token,now+this.leaseMs,id,now));
  if(!result.changes)throw new RepositoryBusy('Solicitud ocupada o desconocida.');
  try{return await work(this.context(token));}finally{await this.serial(()=>this.db.prepare('UPDATE switch_requests SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?').run(id,token));}
 }
 async withExternalRequestLock(providerId,externalId,work){const row=this.db.prepare('SELECT id FROM switch_requests WHERE provider_id=? AND external_id=?').get(providerId,externalId);if(!row)throw Error('Evento sin solicitud asociada.');return this.withRequestLock(row.id,work);}
 context(token=null){const db=this.db,stamp=()=>new Date(this.now()).toISOString(),owner=this;let pendingEvent=null;return {
  findByConsent:async id=>record(db.prepare('SELECT * FROM switch_requests WHERE consent_id=?').get(id)),
  findActive:async supply=>record(db.prepare("SELECT * FROM switch_requests WHERE supply_id=? AND status IN ('queued','dispatching','submitted','accepted','reconciliation_required')").get(supply)),
  getAuthority:async(actor,supply)=>json(db.prepare('SELECT record FROM authorities WHERE actor_id=? AND supply_id=?').get(actor,supply)),
  getOffer:async id=>json(db.prepare('SELECT record FROM offers WHERE id=?').get(id)),
  getConsent:async id=>json(db.prepare('SELECT record FROM consents WHERE id=?').get(id)),
  getConnection:async id=>json(db.prepare('SELECT record FROM connections WHERE id=?').get(id)),
  getRequest:async id=>record(db.prepare('SELECT * FROM switch_requests WHERE id=?').get(id)),
  findExternal:async(provider,id)=>record(db.prepare('SELECT * FROM switch_requests WHERE provider_id=? AND external_id=?').get(provider,id)),
  insert:async value=>{const id=randomUUID(),at=stamp();db.prepare('INSERT INTO switch_requests(id,actor_id,supply_id,offer_id,consent_id,provider_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,value.actorId,value.supplyId,value.offerId,value.consentId,value.providerId,value.status,at,at);db.prepare('INSERT INTO switch_audit(request_id,status,created_at) VALUES(?,?,?)').run(id,value.status,at);return record(db.prepare('SELECT * FROM switch_requests WHERE id=?').get(id));},
  update:async(id,patch)=>owner.serial(async()=>{
   const at=stamp();db.exec('BEGIN IMMEDIATE');
   try{
    const current=db.prepare('SELECT * FROM switch_requests WHERE id=?').get(id);
    if(!current||token&&(current.lease_token!==token||current.lease_until<=owner.now()))throw new RepositoryBusy('El bloqueo de solicitud ha caducado.');
    if(!pending.includes(patch.status)&&!['activated','rejected','blocked'].includes(patch.status))throw Error('Estado desconocido.');
    if(pendingEvent)db.prepare('INSERT INTO provider_events(id,received_at) VALUES(?,?)').run(pendingEvent,at);
    db.prepare('UPDATE switch_requests SET status=?,external_id=?,updated_at=? WHERE id=?').run(patch.status,patch.externalId??current.external_id,at,id);
    db.prepare('INSERT INTO switch_audit(request_id,status,created_at) VALUES(?,?,?)').run(id,patch.status,at);db.exec('COMMIT');pendingEvent=null;
    return record(db.prepare('SELECT * FROM switch_requests WHERE id=?').get(id));
   }catch(error){db.exec('ROLLBACK');throw error;}
  }),
  recordEventOnce:async id=>{if(db.prepare('SELECT id FROM provider_events WHERE id=?').get(id))return false;pendingEvent=id;return true;},
  validateForDispatch:async request=>{
   const authority=json(db.prepare('SELECT record FROM authorities WHERE actor_id=? AND supply_id=?').get(request.actorId,request.supplyId));
   const offer=json(db.prepare('SELECT record FROM offers WHERE id=?').get(request.offerId));
   const consent=json(db.prepare('SELECT record FROM consents WHERE id=?').get(request.consentId));
   const connection=json(db.prepare('SELECT record FROM connections WHERE id=?').get(request.providerId));
   return authority?.status==='verified'&&offer?.status==='verified'&&offer.supplyId===request.supplyId&&Number.isFinite(Date.parse(offer.expiresAt))&&Date.parse(offer.expiresAt)>owner.now()&&consent?.status==='verified'&&!consent.revokedAt&&consent.actorId===request.actorId&&consent.supplyId===request.supplyId&&consent.offerId===request.offerId&&Boolean(consent.signatureEvidenceId)&&Boolean(offer.contractHash)&&consent.contractHash===offer.contractHash&&offer.costsReviewed===true&&offer.exitPenaltyReviewed===true&&offer.eligibilityVerified===true&&Number.isFinite(offer.currentAnnualTotal)&&Number.isFinite(offer.newAnnualTotal)&&offer.newAnnualTotal>=0&&offer.currentAnnualTotal>offer.newAnnualTotal&&connection?.status==='live'&&connection.contractingEnabled===true;
  }
 };}
 getOwnedRequest(id,actor){return record(this.db.prepare('SELECT * FROM switch_requests WHERE id=? AND actor_id=?').get(id,actor));}
 listOwnedRequests(actor,limit=50){return this.db.prepare('SELECT * FROM switch_requests WHERE actor_id=? ORDER BY created_at DESC LIMIT ?').all(actor,limit).map(record);}
 getOwnedTimeline(id,actor){return this.db.prepare('SELECT a.status,a.created_at AS createdAt FROM switch_audit a JOIN switch_requests r ON r.id=a.request_id WHERE r.id=? AND r.actor_id=? ORDER BY a.id').all(id,actor).map(row=>({...row}));}
 listWork(limit=20){return this.db.prepare("SELECT * FROM switch_requests WHERE status IN ('queued','dispatching','submitted','accepted','reconciliation_required') AND lease_until<=? ORDER BY created_at LIMIT ?").all(this.now(),limit).map(record);}
 // Internal import for records verified outside the public API; never expose as a route.
 putVerifiedRecord(table,id,value){if(!['offers','consents','connections'].includes(table))throw Error('Tabla no permitida.');this.db.prepare(`INSERT INTO ${table}(id,record) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record`).run(id,JSON.stringify(value));}
 putAuthority(actor,supply,value){this.db.prepare('INSERT INTO authorities(actor_id,supply_id,record) VALUES(?,?,?) ON CONFLICT(actor_id,supply_id) DO UPDATE SET record=excluded.record').run(actor,supply,JSON.stringify(value));}
}
