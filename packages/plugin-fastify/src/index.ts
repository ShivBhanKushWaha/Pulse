import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PulseInstance } from "@shiv-kush/pulse-monitor-sdk";

export interface PulseFastifyOptions {
  exportPath?: string;
}

/**
 * Adds request timing and the `/_pulse/export` route to a Fastify app. Call it on the root instance before
 * registering your routes, so the timing hook covers them (hooks only reach routes added after them).
 */
export function pulseFastify(app: FastifyInstance, instance: PulseInstance, options: PulseFastifyOptions = {}): void {
  const exportPath = options.exportPath ?? "/_pulse/export";

  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const route = (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split("?")[0];
    if (route === exportPath) return; // the dashboard's own polling is not traffic worth recording

    // Fastify 5 exposes reply.elapsedTime; Fastify 4 has getResponseTime().
    const timing = reply as unknown as { elapsedTime?: number; getResponseTime?: () => number };
    const durationMs = timing.elapsedTime ?? timing.getResponseTime?.() ?? 0;

    instance.record({
      kind: "http_request",
      data: {
        method: req.method,
        route,
        statusCode: reply.statusCode,
        durationMs,
        userId: (req as unknown as { user?: { id?: string } }).user?.id ?? null,
      },
    });
  });

  app.get(exportPath, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { since?: string; limit?: string };
    const sinceTs = Number(query.since ?? 0);
    const result = await instance.exportHandler({
      authorizationHeader: req.headers.authorization,
      sinceTs: Number.isFinite(sinceTs) ? sinceTs : 0,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.status(result.status).send(result.body);
  });
}
