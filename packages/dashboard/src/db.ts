import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

export const db = new DatabaseSync(process.env.PULSE_DB_PATH ?? "pulse-dashboard.sqlite");

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
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_cache_project_ts ON metrics_cache (project_id, ts);

  CREATE TABLE IF NOT EXISTS poll_cursors (
    project_id TEXT PRIMARY KEY,
    last_ts INTEGER NOT NULL
  );
`);

// Project API keys must be encrypted, not hashed: the poller needs the
// plaintext value to present as a Bearer token when it calls out to each
// project's own export endpoint, so a one-way hash isn't usable here.
const masterKey = crypto
  .createHash("sha256")
  .update(process.env.PULSE_MASTER_KEY ?? "dev-only-insecure-key")
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
