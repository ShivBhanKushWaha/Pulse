import type { MetricRecord, StorageAdapter } from "@shiv-kush/pulse-monitor-sdk";

/**
 * Stand-in for "your project's own DB". A real integration implements this
 * against Mongoose/Prisma/pg/etc. and persists to disk; this one is
 * in-memory on purpose, purely to demo the SDK -> export -> dashboard
 * flow without needing any real database running.
 */
export function createMemoryStorage(): StorageAdapter {
  const records: MetricRecord[] = [];

  return {
    async init() {
      // no schema to create for an in-memory store
    },
    async write(batch) {
      // A batch can arrive twice (retry after a failed write): ignore ids already stored.
      for (const record of batch) {
        if (!record.id || !records.some((r) => r.id === record.id)) records.push(record);
      }
    },
    async readSince(sinceTs, limit) {
      // Inclusive (ts >= sinceTs): the dashboard drops records it already has by id.
      return records.filter((r) => r.ts >= sinceTs).slice(0, limit);
    },
  };
}
