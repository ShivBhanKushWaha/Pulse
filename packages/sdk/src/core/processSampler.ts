import os from "node:os";
import type { MetricBuffer } from "./buffer.js";

export function startProcessSampler(buffer: MetricBuffer, intervalMs: number): () => void {
  const timer = setInterval(() => {
    const mem = process.memoryUsage();
    const load = os.loadavg();
    buffer.push({
      kind: "process_sample",
      ts: Date.now(),
      data: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        uptimeSec: process.uptime(),
        loadavg1: load[0],
      },
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
