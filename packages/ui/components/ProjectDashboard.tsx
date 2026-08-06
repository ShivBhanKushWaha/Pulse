"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProject, fetchMetrics, type Project, type MetricRow } from "../lib/api";

const POLL_MS = 5000;

type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "2xx", label: "2xx" },
  { key: "3xx", label: "3xx" },
  { key: "4xx", label: "4xx" },
  { key: "5xx", label: "5xx" },
];

interface HttpData {
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
}

function matchesStatusFilter(status: number | undefined, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  const s = status ?? 0;
  if (filter === "2xx") return s >= 200 && s < 300;
  if (filter === "3xx") return s >= 300 && s < 400;
  if (filter === "4xx") return s >= 400 && s < 500;
  return s >= 500;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ProjectDashboard({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [lastPolled, setLastPolled] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [p, m] = await Promise.all([
        fetchProject(id).catch(() => null),
        fetchMetrics(id, 0, 500).catch(() => []),
      ]);
      if (!cancelled) {
        setProject(p);
        setMetrics(m);
        setLastPolled(Date.now());
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  const httpRows = useMemo(
    () =>
      metrics
        .filter((m) => m.kind === "http_request")
        .map((m) => ({ ...m, parsed: JSON.parse(m.data) as HttpData }))
        .reverse(),
    [metrics],
  );

  const methods = useMemo(
    () => Array.from(new Set(httpRows.map((r) => r.parsed.method).filter(Boolean))) as string[],
    [httpRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return httpRows.filter((r) => {
      if (!matchesStatusFilter(r.parsed.statusCode, statusFilter)) return false;
      if (methodFilter !== "all" && r.parsed.method !== methodFilter) return false;
      if (q && !(r.parsed.route ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [httpRows, search, statusFilter, methodFilter]);

  const stats = useMemo(() => {
    if (httpRows.length === 0) return null;
    const total = httpRows.length;
    const errors = httpRows.filter((r) => (r.parsed.statusCode ?? 0) >= 500).length;
    const avgLatency = httpRows.reduce((sum, r) => sum + (r.parsed.durationMs ?? 0), 0) / total;
    return {
      total,
      errorRate: ((errors / total) * 100).toFixed(1),
      avgLatency: avgLatency.toFixed(1),
    };
  }, [httpRows]);

  if (project === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-panel-hover" />
        <div className="h-24 animate-pulse rounded-lg bg-panel-hover" />
      </div>
    );
  }

  if (project === null) {
    return <p className="text-sm text-bad">Project not found.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{project.export_url}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-good live-dot" />
          {lastPolled ? `updated ${timeAgo(lastPolled)}` : "connecting…"}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Requests" value={stats?.total ?? "—"} />
        <StatCard label="Avg latency" value={stats ? `${stats.avgLatency}ms` : "—"} />
        <StatCard
          label="Error rate"
          value={stats ? `${stats.errorRate}%` : "—"}
          tone={stats && Number(stats.errorRate) > 0 ? "bad" : "good"}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Recent requests</span>

          {httpRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by route…"
                className="w-40 rounded-md border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-accent"
              />

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-accent"
              >
                <option value="all">All methods</option>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      statusFilter === f.key
                        ? "border-accent bg-accent-dim text-white"
                        : "border-border text-muted hover:text-text"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {httpRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No requests recorded yet. Wire <code>@shiv-kush/pulse-monitor-plugin-express</code> into this
            project and traffic will show up here within {POLL_MS / 1000}s of the next poll.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No requests match the current filters.</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Route</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2 text-muted">{timeAgo(r.ts)}</td>
                    <td className="px-4 py-2 font-mono">{r.parsed.method}</td>
                    <td className="px-4 py-2 font-mono">{r.parsed.route}</td>
                    <td
                      className={`px-4 py-2 font-mono ${
                        (r.parsed.statusCode ?? 0) >= 500
                          ? "text-bad"
                          : (r.parsed.statusCode ?? 0) >= 400
                            ? "text-yellow-400"
                            : (r.parsed.statusCode ?? 0) >= 300
                              ? "text-accent"
                              : "text-good"
                      }`}
                    >
                      {r.parsed.statusCode}
                    </td>
                    <td className="px-4 py-2 font-mono">{r.parsed.durationMs?.toFixed(1)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : "text-text"}`}
      >
        {value}
      </div>
    </div>
  );
}
