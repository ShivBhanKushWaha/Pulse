import crypto from "node:crypto";
import { db, decryptApiKey } from "./db.js";

interface ProjectRow {
  id: string;
  api_key_encrypted: string;
  export_url: string;
}

interface ExportRecord {
  id?: string;
  kind: string;
  ts: number;
  data: Record<string, unknown>;
}

const PAGE_LIMIT = 500;
/** When a full page all shares one millisecond the page size doubles up to this, then the cursor moves on. */
const MAX_PAGE_LIMIT = 10_000;
/** Pages fetched per project per round, so one busy project cannot hold the poller forever. */
const MAX_PAGES_PER_ROUND = 20;
const FETCH_TIMEOUT_MS = 10_000;

const inFlight = new Set<string>();

/** Stable id for records from an older SDK that does not send one. */
const fallbackRecordId = (record: ExportRecord): string =>
  `h-${crypto.createHash("sha256").update(`${record.kind}|${record.ts}|${JSON.stringify(record.data)}`).digest("hex").slice(0, 32)}`;

function savePage(projectId: string, records: ExportRecord[], cursorTs: number): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO metrics_cache (project_id, kind, ts, data, record_id) VALUES (?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    for (const r of records) {
      insert.run(projectId, r.kind, r.ts, JSON.stringify(r.data), r.id ?? fallbackRecordId(r));
    }
    db.prepare(`UPDATE poll_cursors SET last_ts = ? WHERE project_id = ?`).run(cursorTs, projectId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

async function pollProject(project: ProjectRow): Promise<void> {
  // One round per project at a time: a slow export must not let the next round start on top of it.
  if (inFlight.has(project.id)) return;
  inFlight.add(project.id);

  try {
    const cursor = db
      .prepare(`SELECT last_ts FROM poll_cursors WHERE project_id = ?`)
      .get(project.id) as unknown as { last_ts: number } | undefined;
    let sinceTs = cursor?.last_ts ?? 0;
    let limit = PAGE_LIMIT;
    const apiKey = decryptApiKey(project.api_key_encrypted);

    for (let page = 0; page < MAX_PAGES_PER_ROUND; page++) {
      const url = new URL(project.export_url);
      url.searchParams.set("since", String(sinceTs));
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[poller] ${project.id} export failed: ${res.status}`);
        return;
      }

      const body = (await res.json()) as { records?: ExportRecord[] };
      const records = body.records ?? [];
      const maxTs = records.reduce((max, r) => Math.max(max, r.ts), sinceTs);

      // The export is inclusive of `since`, so the last millisecond is re-read next time and the unique
      // record id drops what is already stored. The cursor therefore never skips a record.
      savePage(project.id, records, maxTs);

      if (records.length < limit) return;

      if (maxTs === sinceTs) {
        // The whole page sits in one millisecond: ask for more instead of looping on the same page.
        if (limit >= MAX_PAGE_LIMIT) {
          console.warn(`[poller] ${project.id}: over ${MAX_PAGE_LIMIT} records at ts ${sinceTs}, skipping the rest of that millisecond`);
          savePage(project.id, [], sinceTs + 1);
          sinceTs += 1;
          limit = PAGE_LIMIT;
        } else {
          limit = Math.min(limit * 2, MAX_PAGE_LIMIT);
        }
        continue;
      }

      sinceTs = maxTs;
    }
  } finally {
    inFlight.delete(project.id);
  }
}

async function pollAll(): Promise<void> {
  const projects = db
    .prepare(`SELECT id, api_key_encrypted, export_url FROM projects`)
    .all() as unknown as ProjectRow[];
  await Promise.all(
    projects.map((p) => pollProject(p).catch((err) => console.error(`[poller] ${p.id} error`, err))),
  );
}

/** Rounds run one after another: the next is scheduled only when the previous one has finished. */
export function startPoller(intervalMs = 20_000): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      await pollAll();
    } catch (err) {
      console.error("[poller] round failed", err);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  timer = setTimeout(tick, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
