import { db } from "./db.js";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Deletes cached metrics older than `retentionDays` now and every hour; 0 keeps everything. Returns a stop function. */
export function startRetention(retentionDays: number): () => void {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return () => undefined;

  const prune = () => {
    try {
      const result = db.prepare(`DELETE FROM metrics_cache WHERE ts < ?`).run(Date.now() - retentionDays * DAY_MS);
      if (Number(result.changes) > 0) {
        console.log(`[retention] removed ${result.changes} metric(s) older than ${retentionDays} day(s)`);
      }
    } catch (err) {
      console.error("[retention] cleanup failed", err);
    }
  };

  prune();
  const timer = setInterval(prune, HOUR_MS);
  timer.unref?.();

  return () => clearInterval(timer);
}
