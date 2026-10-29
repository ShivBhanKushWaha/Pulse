import type { MetricRecord, StorageAdapter } from "@shiv-kush/pulse-monitor-sdk";

/** The few collection methods the adapter needs; satisfied by `mongoose.connection`, a native `Db`, and similar. */
interface MongoCollectionLike {
  createIndex(spec: Record<string, 1 | -1>, options?: Record<string, unknown>): Promise<unknown>;
  insertMany(docs: Record<string, unknown>[], options?: Record<string, unknown>): Promise<unknown>;
  find(filter: Record<string, unknown>): {
    sort(spec: Record<string, 1 | -1>): { limit(n: number): { toArray(): Promise<Record<string, unknown>[]> } };
  };
}

export interface MongoConnectionLike {
  collection(name: string): MongoCollectionLike;
}

export interface MongooseStorageOptions {
  /** Your existing connection: `mongoose.connection` (or a native `Db`). Pulse opens no connection of its own. */
  connection: MongoConnectionLike;
  /** Collection Pulse writes to; keep the prefix so it can never clash with app data. Default `pulse_records`. */
  collectionName?: string;
  /** Records older than this are deleted by MongoDB itself (TTL index). 0 keeps them forever. Default 7. */
  retentionDays?: number;
}

const DUPLICATE_KEY = 11000;

const isOnlyDuplicates = (error: unknown): boolean => {
  const e = error as { code?: number; writeErrors?: { code?: number; err?: { code?: number } }[] };
  if (e?.code === DUPLICATE_KEY) return true;
  return !!e?.writeErrors?.length && e.writeErrors.every((w) => (w.code ?? w.err?.code) === DUPLICATE_KEY);
};

/**
 * Stores Pulse records in one collection of your own MongoDB. The record id is the document `_id`, so a batch
 * that is written twice (a retry after a failed attempt) is deduplicated by the database itself.
 */
export function createMongooseStorage(options: MongooseStorageOptions): StorageAdapter {
  const { connection, collectionName = "pulse_records", retentionDays = 7 } = options;
  const collection = () => connection.collection(collectionName);

  return {
    async init() {
      await collection().createIndex({ ts: 1, _id: 1 });
      if (retentionDays > 0) {
        await collection().createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
      }
    },

    async write(records) {
      if (records.length === 0) return;
      const docs = records.map((record) => ({
        _id: record.id as unknown,
        ts: record.ts,
        kind: record.kind,
        data: record.data,
        ...(retentionDays > 0 ? { expireAt: new Date(record.ts + retentionDays * 86_400_000) } : {}),
      }));
      try {
        // ordered:false keeps going past duplicates, so only genuinely new records are added.
        await collection().insertMany(docs, { ordered: false });
      } catch (error) {
        if (!isOnlyDuplicates(error)) throw error;
      }
    },

    async readSince(sinceTs, limit) {
      const rows = await collection()
        .find({ ts: { $gte: sinceTs } })
        .sort({ ts: 1, _id: 1 })
        .limit(limit)
        .toArray();
      return rows.map(
        (row): MetricRecord => ({
          id: String(row._id),
          kind: row.kind as MetricRecord["kind"],
          ts: row.ts as number,
          data: (row.data ?? {}) as Record<string, unknown>,
        }),
      );
    },
  };
}
