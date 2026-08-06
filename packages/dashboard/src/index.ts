import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { db } from "./db.js";
import { registerProject, listProjects, getProject } from "./registry.js";
import { startPoller } from "./poller.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.PULSE_UI_ORIGIN ?? "http://localhost:3000" });

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

  app.get("/api/projects/:id/metrics", async (req) => {
    const { id } = req.params as { id: string };
    const { since = "0", limit = "500" } = req.query as { since?: string; limit?: string };
    return db
      .prepare(
        `SELECT kind, ts, data FROM metrics_cache WHERE project_id = ? AND ts > ? ORDER BY ts ASC LIMIT ?`,
      )
      .all(id, Number(since), Number(limit));
  });

  const stopPoller = startPoller(Number(process.env.PULSE_POLL_INTERVAL_MS ?? 20_000));

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
      void app.close().then(() => process.exit(0));
    });
  }
}

void main();
