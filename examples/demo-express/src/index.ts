import "dotenv/config";
import express from "express";
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseExpress } from "@shiv-kush/pulse-monitor-plugin-express";
import { createMemoryStorage } from "./memoryStorage.js";

const app = express();

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY ?? "",
  projectId: process.env.PULSE_PROJECT_ID ?? "",
  environment: "development",
  storage: createMemoryStorage(),
});

pulseExpress(app, monitoring);

app.get("/", (_req, res) => {
  res.json({ message: "pulse demo app" });
});

app.get("/slow", async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));
  res.json({ message: "that took a while" });
});

app.get("/broken", (_req, res) => {
  res.status(500).json({ error: "simulated failure" });
});

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => {
  console.log(`pulse-demo-express listening on http://localhost:${port}`);
  console.log(`export route: http://localhost:${port}/_pulse/export`);
});
