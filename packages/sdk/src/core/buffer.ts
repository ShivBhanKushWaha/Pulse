import type { MetricRecord, StorageAdapter } from "./types.js";

export class MetricBuffer {
  private queue: MetricRecord[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly flushIntervalMs: number,
    private readonly maxBufferSize: number,
  ) {}

  push(record: MetricRecord): void {
    this.queue.push(record);
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

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      await this.storage.write(batch);
    } catch {
      // Storage failures must never crash the host app; dropped batch is
      // preferable to taking down the monitored service over a metrics write.
    }
  }
}
