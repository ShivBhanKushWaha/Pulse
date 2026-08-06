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

/** Framework-agnostic core of the GET /_pulse/export route. Plugins wire this to their request/response shape. */
export function createExportHandler(config: PulseConfig) {
  return async (req: ExportRequest): Promise<ExportResponse> => {
    const expected = `Bearer ${config.apiKey}`;
    if (req.authorizationHeader !== expected) {
      return { status: 401, body: { error: "invalid api key" } };
    }
    const records = await config.storage.readSince(req.sinceTs, req.limit ?? 500);
    return { status: 200, body: { records } };
  };
}
