import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseExpress } from "@shiv-kush/pulse-monitor-plugin-express";
import { createSqliteStorage } from "./sqliteStorage.js";

const apiKey = process.env.PULSE_API_KEY;
const projectId = process.env.PULSE_PROJECT_ID;
if (!apiKey || !projectId) {
  console.error("Set PULSE_API_KEY and PULSE_PROJECT_ID (copy .env.example to .env). Register the project in the dashboard to get them.");
  process.exit(1);
}

// 1. Start monitoring. `storage` is where YOUR app keeps Pulse's records.
const monitoring = initMonitoring({
  apiKey,
  projectId,
  environment: process.env.NODE_ENV ?? "development",
  storage: createSqliteStorage(process.env.PULSE_RECORDS_DB ?? "pulse-records.sqlite"),
});

const app = express();

// 2. Add the plugin BEFORE your routes: it times every request and serves GET /_pulse/export for the dashboard.
pulseExpress(app, monitoring);

app.get("/", (_req, res) => {
  res.json({ message: "pulse full-setup example" });
});

app.get("/slow", async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));
  res.json({ message: "that took a while" });
});

app.get("/broken", (_req, res) => {
  res.status(500).json({ error: "simulated failure" });
});

app.get("/crash", () => {
  throw new Error("simulated crash");
});

// 3. Optional: record your own events (errors, business metrics) next to the automatic ones.
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  monitoring.record({ kind: "error", data: { message: error.message, route: req.path, method: req.method } });
  res.status(500).json({ error: "internal error" });
});

const port = Number(process.env.PORT ?? 5000);
const server = app.listen(port, () => {
  console.log(`app:               http://localhost:${port}   (try /, /slow, /broken, /crash)`);
  console.log(`pulse export URL:  http://localhost:${port}/_pulse/export`);
});

// 4. On shutdown, write what is still buffered.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    void monitoring.shutdown().then(() => process.exit(0));
  });
}
