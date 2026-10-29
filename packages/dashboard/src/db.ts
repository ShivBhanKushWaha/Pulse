import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";

export const db = new DatabaseSync(process.env.PULSE_DB_PATH ?? "pulse-dashboard.sqlite");

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    export_url TEXT NOT NULL,
    environment TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metrics_cache (
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ts INTEGER NOT NULL,
    data TEXT NOT NULL,
    record_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_cache_project_ts ON metrics_cache (project_id, ts);

  CREATE TABLE IF NOT EXISTS poll_cursors (
    project_id TEXT PRIMARY KEY,
    last_ts INTEGER NOT NULL
  );
`);

// Databases created before record ids existed: add the column, give old rows a stable id, then enforce uniqueness
// so a record exported twice (a retry, or a re-read at the cursor's millisecond) is stored once.
const columns = db.prepare(`PRAGMA table_info(metrics_cache)`).all() as unknown as { name: string }[];
if (!columns.some((column) => column.name === "record_id")) {
  db.exec(`ALTER TABLE metrics_cache ADD COLUMN record_id TEXT`);
}
db.exec(`UPDATE metrics_cache SET record_id = 'legacy-' || rowid WHERE record_id IS NULL`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_cache_record ON metrics_cache (project_id, record_id)`);

// Project API keys must be encrypted, not hashed: the poller needs the
// plaintext value to present as a Bearer token when it calls out to each
// project's own export endpoint, so a one-way hash isn't usable here.
const INSECURE_DEFAULT_KEY = "dev-only-insecure-key";
const configuredMasterKey = process.env.PULSE_MASTER_KEY;

if (isProduction && (!configuredMasterKey || configuredMasterKey.length < 16 || configuredMasterKey.startsWith("change-me"))) {
  throw new Error("PULSE_MASTER_KEY must be set to a random secret (16+ characters) in production.");
}

if (!configuredMasterKey) {
  console.warn("[pulse] PULSE_MASTER_KEY is not set: using an insecure development key. Set it before storing real project keys.");
}

const masterKey = crypto
  .createHash("sha256")
  .update(configuredMasterKey ?? INSECURE_DEFAULT_KEY)
  .digest();

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptApiKey(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
