export type MetricKind = "http_request" | "process_sample" | "error" | "auth_event" | "custom";

export interface MetricRecord {
  kind: MetricKind;
  ts: number;
  data: Record<string, unknown>;
}

export interface StorageAdapter {
  /** Create/ensure the pulse-owned tables/collections exist in the host's own DB. */
  init(): Promise<void>;
  /** Append a batch of records. Must be namespaced so it never collides with app data. */
  write(records: MetricRecord[]): Promise<void>;
  /** Return records with ts > sinceTs, ordered ascending, capped at limit. */
  readSince(sinceTs: number, limit: number): Promise<MetricRecord[]>;
}

export interface PulseConfig {
  apiKey: string;
  projectId: string;
  projectName?: string;
  environment: string;
  storage: StorageAdapter;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}
