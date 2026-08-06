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
      records.push(...batch);
    },
    async readSince(sinceTs, limit) {
      return records.filter((r) => r.ts > sinceTs).slice(0, limit);
    },
  };
}
