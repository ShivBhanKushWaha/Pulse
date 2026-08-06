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

let activeInstance: PulseInstance | null = null;

export function initMonitoring(config: PulseConfig): PulseInstance {
  if (!config.apiKey || !config.projectId || !config.storage) {
    throw new Error("@shiv-kush/pulse-monitor-sdk: apiKey, projectId, and storage are required");
  }

  const buffer = new MetricBuffer(
    config.storage,
    config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
  );

  const stopSampler = startProcessSampler(buffer, DEFAULT_PROCESS_SAMPLE_INTERVAL_MS);

  const instance: PulseInstance = {
    config,
    buffer,
    record: (record) => buffer.push({ ts: record.ts ?? Date.now(), kind: record.kind, data: record.data }),
    exportHandler: createExportHandler(config),
    shutdown: async () => {
      stopSampler();
      buffer.stop();
      await buffer.flush();
    },
  };

  void config.storage.init().then(() => buffer.start());

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
