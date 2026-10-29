import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { MetricRecord, StorageAdapter } from "@shiv-kush/pulse-monitor-sdk";

const DAY_MS = 24 * 60 * 60_000;

/**
 * A durable StorageAdapter on a local SQLite file (Node's built-in node:sqlite), so the example needs no database
 * server. A real project would write to the database it already runs (MongoDB: use
 * @shiv-kush/pulse-monitor-adapter-mongoose). The three rules every adapter follows:
 *
 *  - records have a unique id, and a batch written twice must not fail or duplicate -> INSERT OR IGNORE
 *  - readSince is inclusive (ts >= sinceTs), ordered by ts then id
 *  - keep Pulse's data in its own table, away from your app's tables
 */
export function createSqliteStorage(file = "pulse-records.sqlite", retentionDays = 7): StorageAdapter {
  const db = new DatabaseSync(file);

  return {
    async init() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pulse_records (
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          kind TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pulse_records_ts ON pulse_records (ts, id);
      `);
      db.prepare(`DELETE FROM pulse_records WHERE ts < ?`).run(Date.now() - retentionDays * DAY_MS);
    },

    async write(records) {
      const insert = db.prepare(`INSERT OR IGNORE INTO pulse_records (id, ts, kind, data) VALUES (?, ?, ?, ?)`);
      db.exec("BEGIN");
      try {
        for (const record of records) {
          insert.run(record.id ?? randomUUID(), record.ts, record.kind, JSON.stringify(record.data));
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async readSince(sinceTs, limit) {
      const rows = db
        .prepare(`SELECT id, ts, kind, data FROM pulse_records WHERE ts >= ? ORDER BY ts ASC, id ASC LIMIT ?`)
        .all(sinceTs, limit) as unknown as { id: string; ts: number; kind: MetricRecord["kind"]; data: string }[];
      return rows.map((row) => ({ id: row.id, ts: row.ts, kind: row.kind, data: JSON.parse(row.data) as Record<string, unknown> }));
    },
  };
}
