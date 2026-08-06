const API_URL = process.env.NEXT_PUBLIC_PULSE_API_URL ?? "http://localhost:4500";

export interface Project {
  id: string;
  name: string;
  export_url: string;
  environment: string;
  created_at: number;
}

export interface RegisteredProject {
  id: string;
  apiKey: string;
}

export interface MetricRow {
  kind: string;
  ts: number;
  data: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/api/projects`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
  return res.json();
}

export async function fetchProject(id: string): Promise<Project | null> {
  const res = await fetch(`${API_URL}/api/projects/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
  return res.json();
}

export async function fetchMetrics(id: string, since = 0, limit = 500): Promise<MetricRow[]> {
  const res = await fetch(`${API_URL}/api/projects/${id}/metrics?since=${since}&limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load metrics (${res.status})`);
  return res.json();
}

export async function registerProject(input: {
  name: string;
  exportUrl: string;
  environment: string;
}): Promise<RegisteredProject> {
  const res = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to register project (${res.status})`);
  return res.json();
}
