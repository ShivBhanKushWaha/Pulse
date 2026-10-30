import { createHash, timingSafeEqual } from "node:crypto";
import type { PulseConfig } from "./types.js";

export interface ExportRequest {
  authorizationHeader: string | undefined;
  /** Client address, used to limit failed key attempts. Without it the limit is not applied. */
  clientId?: string;
  sinceTs: number;
  limit?: number;
}

export interface ExportResponse {
  status: number;
  body: { records?: unknown[]; error?: string };
}

const FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 20;
const MAX_TRACKED_CLIENTS = 10_000;

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 10_000;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares through fixed-length digests with timingSafeEqual, so neither the value nor its length leaks via timing. */
const sameSecret = (provided: string | undefined, expected: string): boolean =>
  provided !== undefined && timingSafeEqual(digest(provided), digest(expected));

/** Framework-agnostic core of the GET /_pulse/export route. Plugins wire this to their request/response shape. */
export function createExportHandler(config: PulseConfig) {
  const expected = `Bearer ${config.apiKey}`;
  const failures = new Map<string, { count: number; resetAt: number }>();

  /** Drops expired entries and, if still too large, the oldest ones, so the map cannot grow without bound. */
  const prune = (now: number) => {
    for (const [id, entry] of failures) if (now > entry.resetAt) failures.delete(id);
    while (failures.size >= MAX_TRACKED_CLIENTS) {
      const oldest = failures.keys().next().value;
      if (oldest === undefined) break;
      failures.delete(oldest);
    }
  };

  return async (req: ExportRequest): Promise<ExportResponse> => {
    const now = Date.now();
    const entry = req.clientId ? failures.get(req.clientId) : undefined;
    if (entry && now <= entry.resetAt && entry.count >= MAX_FAILURES) {
      return { status: 429, body: { error: "too many failed attempts" } };
    }

    if (!sameSecret(req.authorizationHeader, expected)) {
      if (req.clientId) {
        if (entry && now <= entry.resetAt) {
          entry.count += 1;
        } else {
          prune(now);
          failures.set(req.clientId, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
        }
      }
      return { status: 401, body: { error: "invalid api key" } };
    }

    const sinceTs = Number.isFinite(req.sinceTs) && req.sinceTs > 0 ? Math.floor(req.sinceTs) : 0;
    const limit = Math.min(Math.max(Math.floor(req.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    try {
      const records = await config.storage.readSince(sinceTs, limit);
      return { status: 200, body: { records } };
    } catch {
      return { status: 500, body: { error: "could not read records" } };
    }
  };
}
