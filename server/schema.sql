PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS authorities(actor_id TEXT NOT NULL,supply_id TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(actor_id,supply_id));
CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY,record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS switch_requests(
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, supply_id TEXT NOT NULL,
 offer_id TEXT NOT NULL, consent_id TEXT NOT NULL UNIQUE, provider_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','dispatching','submitted','accepted','activated','rejected','blocked','reconciliation_required')),
 external_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(offer_id) REFERENCES offers(id), FOREIGN KEY(consent_id) REFERENCES consents(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_switch_per_supply ON switch_requests(supply_id) WHERE status IN ('queued','dispatching','submitted','accepted','reconciliation_required');
CREATE UNIQUE INDEX IF NOT EXISTS provider_external_id ON switch_requests(provider_id,external_id) WHERE external_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS provider_events(id TEXT PRIMARY KEY,received_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS switch_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
