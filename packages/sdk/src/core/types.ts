export type MetricKind = "http_request" | "process_sample" | "error" | "auth_event" | "custom";

export interface MetricRecord {
  /**
   * Unique id of the record, assigned by the SDK when it is captured. Adapters must store it and return it,
   * so a record that is written or exported twice (a retry, a re-read at the same timestamp) is recognised
   * and counted once.
   */
  id?: string;
  kind: MetricKind;
  ts: number;
  data: Record<string, unknown>;
}

export interface StorageAdapter {
  /** Create/ensure the pulse-owned tables/collections exist in the host's own DB. */
  init(): Promise<void>;
  /**
   * Append a batch of records. Must be namespaced so it never collides with app data. A batch may be
   * written more than once (after a failed attempt), so duplicates by `id` must be ignored, not fail.
   */
  write(records: MetricRecord[]): Promise<void>;
  /**
   * Return records with ts >= sinceTs (inclusive, so records that share the cursor's millisecond are never
   * skipped; the dashboard drops the ones it already has by `id`), ordered by ts then id ascending,
   * capped at limit.
   */
  readSince(sinceTs: number, limit: number): Promise<MetricRecord[]>;
}

export interface PulseConfig {
  apiKey: string;
  projectId: string;
  projectName?: string;
  environment: string;
  storage: StorageAdapter;
  flushIntervalMs?: number;
  /** Records per write; a full queue of this size flushes immediately. Default 500. */
  maxBufferSize?: number;
  /**
   * Records kept in memory while the storage is failing (the oldest are dropped past this). Failed writes are
   * retried with backoff instead of being thrown away. Default 5000.
   */
  maxQueueSize?: number;
}
