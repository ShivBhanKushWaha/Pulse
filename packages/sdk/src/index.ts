import { MetricBuffer } from "./core/buffer.js";
import { startProcessSampler } from "./core/processSampler.js";
import { createExportHandler } from "./core/exportHandler.js";
import type { MetricRecord, PulseConfig } from "./core/types.js";

export type { MetricRecord, PulseConfig, StorageAdapter, MetricKind } from "./core/types.js";
export type { ExportRequest, ExportResponse } from "./core/exportHandler.js";

export interface PulseInstance {
  config: PulseConfig;
  buffer: MetricBuffer;
  record(record: Omit<MetricRecord, "ts"> & { ts?: number }): void;
  exportHandler: ReturnType<typeof createExportHandler>;
  shutdown(): Promise<void>;
}

const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_PROCESS_SAMPLE_INTERVAL_MS = 15_000;
const DEFAULT_MAX_BUFFER_SIZE = 500;
const INIT_RETRY_MS = 5_000;

let activeInstance: PulseInstance | null = null;

export function initMonitoring(config: PulseConfig): PulseInstance {
  if (!config.apiKey || !config.projectId || !config.storage) {
    throw new Error("@shiv-kush/pulse-monitor-sdk: apiKey, projectId, and storage are required");
  }

  const buffer = new MetricBuffer(
    config.storage,
    config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
    config.maxQueueSize,
  );

  const stopSampler = startProcessSampler(buffer, DEFAULT_PROCESS_SAMPLE_INTERVAL_MS);

  const instance: PulseInstance = {
    config,
    buffer,
    record: (record) => buffer.push({ id: record.id, ts: record.ts ?? Date.now(), kind: record.kind, data: record.data }),
    exportHandler: createExportHandler(config),
    shutdown: async () => {
      stopped = true;
      if (initTimer) clearTimeout(initTimer);
      stopSampler();
      buffer.stop();
      await buffer.flush(true);
    },
  };

  // init() hits the host's database; if it is down at startup keep retrying instead of leaving the buffer idle
  // (and never let a rejection escape into the host app).
  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const initStorage = () => {
    config.storage.init().then(
      () => {
        if (!stopped) buffer.start();
      },
      () => {
        if (stopped) return;
        initTimer = setTimeout(initStorage, INIT_RETRY_MS);
        initTimer.unref?.();
      },
    );
  };
  initStorage();

  activeInstance = instance;
  return instance;
}

/** Framework/DB plugins call this to get the running instance without needing it passed explicitly. */
export function getPulseInstance(): PulseInstance {
  if (!activeInstance) {
    throw new Error("@shiv-kush/pulse-monitor-sdk: initMonitoring() must be called before using plugins");
  }
  return activeInstance;
}
