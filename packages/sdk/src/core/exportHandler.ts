import { createHash, timingSafeEqual } from "node:crypto";
import type { PulseConfig } from "./types.js";

export interface ExportRequest {
  authorizationHeader: string | undefined;
  sinceTs: number;
  limit?: number;
}

export interface ExportResponse {
  status: number;
  body: { records?: unknown[]; error?: string };
}

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 10_000;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares through fixed-length digests with timingSafeEqual, so neither the value nor its length leaks via timing. */
const sameSecret = (provided: string | undefined, expected: string): boolean =>
  provided !== undefined && timingSafeEqual(digest(provided), digest(expected));

/** Framework-agnostic core of the GET /_pulse/export route. Plugins wire this to their request/response shape. */
export function createExportHandler(config: PulseConfig) {
  const expected = `Bearer ${config.apiKey}`;

  return async (req: ExportRequest): Promise<ExportResponse> => {
    if (!sameSecret(req.authorizationHeader, expected)) {
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
