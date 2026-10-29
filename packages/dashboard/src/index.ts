import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { db } from "./db.js";
import { isAuthorized, isBlocked, recordFailure } from "./auth.js";
import { registerProject, listProjects, getProject } from "./registry.js";
import { startPoller } from "./poller.js";
import { startRetention } from "./retention.js";

const MAX_METRICS_LIMIT = 5_000;

const clampInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), min), max) : fallback;
};

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.PULSE_UI_ORIGIN ?? "http://localhost:3000" });

  // Everything under /api needs the admin token; only /health is open (for uptime checks).
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS" || req.url === "/health") return;

    if (isBlocked(req.ip)) {
      return reply.status(429).header("retry-after", "900").send({ error: "too many failed attempts" });
    }

    if (!isAuthorized(req.headers.authorization)) {
      recordFailure(req.ip);
      return reply.status(401).header("www-authenticate", "Bearer").send({ error: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/projects", async (req, reply) => {
    const body = req.body as { name?: string; exportUrl?: string; environment?: string };
    if (!body?.name || !body?.exportUrl || !body?.environment) {
      return reply.status(400).send({ error: "name, exportUrl, environment are required" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.exportUrl);
    } catch {
      return reply.status(400).send({ error: "exportUrl must be a full, valid URL" });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return reply.status(400).send({ error: "exportUrl must use http:// or https://" });
    }

    const project = registerProject({
      name: body.name,
      exportUrl: body.exportUrl,
      environment: body.environment,
    });
    return reply.status(201).send(project); // apiKey returned once here — client must store it now
  });

  app.get("/api/projects", async () => listProjects());

  app.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.status(404).send({ error: "not found" });
    return project;
  });

  // The newest `limit` metrics after `since`, oldest first (so a long-running project shows its latest data,
  // not its first 500 rows).
  app.get("/api/projects/:id/metrics", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!getProject(id)) return reply.status(404).send({ error: "not found" });

    const query = req.query as { since?: string; limit?: string };
    const since = clampInt(query.since, 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = clampInt(query.limit, 500, 1, MAX_METRICS_LIMIT);

    return db
      .prepare(
        `SELECT kind, ts, data FROM (
           SELECT kind, ts, data FROM metrics_cache WHERE project_id = ? AND ts > ? ORDER BY ts DESC LIMIT ?
         ) ORDER BY ts ASC`,
      )
      .all(id, since, limit);
  });

  const stopPoller = startPoller(Number(process.env.PULSE_POLL_INTERVAL_MS ?? 20_000));
  const stopRetention = startRetention(Number(process.env.PULSE_RETENTION_DAYS ?? 14));

  const port = Number(process.env.PORT ?? 4500);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopPoller();
      stopRetention();
      void app.close().then(() => process.exit(0));
    });
  }
}

void main();
