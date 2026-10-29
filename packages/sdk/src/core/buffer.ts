import { randomUUID } from "node:crypto";
import type { MetricRecord, StorageAdapter } from "./types.js";

const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;

/**
 * Batches records into the host's storage. A failed write is not lost: the batch goes back to the front of the
 * queue and is retried with exponential backoff, bounded by `maxQueueSize` (oldest dropped first). Writes never
 * overlap, and a storage failure never reaches the host app.
 */
export class MetricBuffer {
  private queue: MetricRecord[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private failures = 0;
  private nextAttemptAt = 0;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly flushIntervalMs: number,
    private readonly maxBufferSize: number,
    private readonly maxQueueSize: number = 5_000,
  ) {}

  /** Records waiting to be written. */
  get pending(): number {
    return this.queue.length;
  }

  push(record: MetricRecord): void {
    this.queue.push({ ...record, id: record.id ?? randomUUID() });
    if (this.queue.length > this.maxQueueSize) {
      this.queue.splice(0, this.queue.length - this.maxQueueSize);
    }
    if (this.queue.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Writes what is queued. Concurrent calls share one run; while backing off it waits unless `force` is set. */
  flush(force = false): Promise<void> {
    this.flushing ??= this.drain(force).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async drain(force: boolean): Promise<void> {
    while (this.queue.length > 0) {
      if (!force && Date.now() < this.nextAttemptAt) return;

      const batch = this.queue.splice(0, this.maxBufferSize);
      try {
        await this.storage.write(batch);
        this.failures = 0;
        this.nextAttemptAt = 0;
      } catch {
        // Put the batch back in front of whatever arrived meanwhile, then back off. Dropping a batch is the
        // last resort (queue full), never the first reaction to one failed write.
        this.queue = [...batch, ...this.queue].slice(-this.maxQueueSize);
        this.failures += 1;
        const delay = Math.min(BASE_RETRY_MS * 2 ** (this.failures - 1), MAX_RETRY_MS);
        this.nextAttemptAt = Date.now() + delay * (0.5 + Math.random() / 2);
        return;
      }
    }
  }
}
