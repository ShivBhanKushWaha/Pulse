import type { Application, NextFunction, Request, Response } from "express";
import type { PulseInstance } from "@shiv-kush/pulse-monitor-sdk";

const UNMATCHED_ROUTE = "unmatched";

export interface PulseExpressOptions {
  exportPath?: string;
}

export function pulseExpress(
  app: Application,
  instance: PulseInstance,
  options: PulseExpressOptions = {},
): void {
  const exportPath = options.exportPath ?? "/_pulse/export";

  app.use((req: Request, res: Response, next: NextFunction) => {
    // The dashboard polls the export route; recording those requests would make every poll create the next
    // record to export. Only real traffic is measured.
    if (req.path === exportPath) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      instance.record({
        kind: "http_request",
        data: {
          method: req.method,
          // Unmatched requests (404 scans, tokens in paths) share one label so they cannot fill the store.
          route: req.route?.path ?? UNMATCHED_ROUTE,
          statusCode: res.statusCode,
          durationMs,
          userId: (req as unknown as { user?: { id?: string } }).user?.id ?? null,
        },
      });
    });
    next();
  });

  app.get(exportPath, async (req: Request, res: Response) => {
    const sinceTs = Number(req.query.since ?? 0);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await instance.exportHandler({
      authorizationHeader: req.header("authorization"),
      clientId: req.ip,
      sinceTs: Number.isFinite(sinceTs) ? sinceTs : 0,
      limit,
    });
    res.status(result.status).json(result.body);
  });
}
