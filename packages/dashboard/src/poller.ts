import { db, decryptApiKey } from "./db.js";

interface ProjectRow {
  id: string;
  api_key_encrypted: string;
  export_url: string;
}

interface ExportRecord {
  kind: string;
  ts: number;
  data: Record<string, unknown>;
}

async function pollProject(project: ProjectRow): Promise<void> {
  const cursor = db
    .prepare(`SELECT last_ts FROM poll_cursors WHERE project_id = ?`)
    .get(project.id) as unknown as { last_ts: number } | undefined;
  const sinceTs = cursor?.last_ts ?? 0;
  const apiKey = decryptApiKey(project.api_key_encrypted);

  const url = new URL(project.export_url);
  url.searchParams.set("since", String(sinceTs));

  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    console.error(`[poller] ${project.id} export failed: ${res.status}`);
    return;
  }

  const body = (await res.json()) as { records?: ExportRecord[] };
  const records = body.records ?? [];
  if (records.length === 0) return;

  const insert = db.prepare(`INSERT INTO metrics_cache (project_id, kind, ts, data) VALUES (?, ?, ?, ?)`);
  const maxTs = records.reduce((max, r) => Math.max(max, r.ts), sinceTs);

  db.exec("BEGIN");
  try {
    for (const r of records) insert.run(project.id, r.kind, r.ts, JSON.stringify(r.data));
    db.prepare(`UPDATE poll_cursors SET last_ts = ? WHERE project_id = ?`).run(maxTs, project.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function startPoller(intervalMs = 20_000): () => void {
  const timer = setInterval(async () => {
    const projects = db
      .prepare(`SELECT id, api_key_encrypted, export_url FROM projects`)
      .all() as unknown as ProjectRow[];
    await Promise.all(
      projects.map((p) => pollProject(p).catch((err) => console.error(`[poller] ${p.id} error`, err))),
    );
  }, intervalMs);
  return () => clearInterval(timer);
}
