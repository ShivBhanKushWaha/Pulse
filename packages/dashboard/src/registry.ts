import crypto from "node:crypto";
import { db, encryptApiKey } from "./db.js";

export interface RegisterProjectInput {
  name: string;
  exportUrl: string;
  environment: string;
}

export interface RegisteredProject {
  id: string;
  apiKey: string; // returned once, at registration time only
}

export function registerProject(input: RegisterProjectInput): RegisteredProject {
  const id = crypto.randomUUID();
  const apiKey = `pulse_${crypto.randomBytes(24).toString("hex")}`;
  db.prepare(
    `INSERT INTO projects (id, name, api_key_encrypted, export_url, environment, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, encryptApiKey(apiKey), input.exportUrl, input.environment, Date.now());
  db.prepare(`INSERT INTO poll_cursors (project_id, last_ts) VALUES (?, 0)`).run(id);
  return { id, apiKey };
}

export function listProjects() {
  return db.prepare(`SELECT id, name, export_url, environment, created_at FROM projects`).all();
}

export function getProject(id: string) {
  return db
    .prepare(`SELECT id, name, export_url, environment, created_at FROM projects WHERE id = ?`)
    .get(id);
}
