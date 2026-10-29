const API_URL = process.env.NEXT_PUBLIC_PULSE_API_URL ?? "http://localhost:4500";

const TOKEN_KEY = "pulse.adminToken";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

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

/** The admin token (PULSE_ADMIN_TOKEN of the dashboard API) kept in this browser after sign-in. */
export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Every dashboard API call goes through here so the token is always attached and a 401 sends the user back to sign-in. */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("pulse:unauthorized"));
    throw new UnauthorizedError();
  }
  return res;
}

/** Checks a token without storing it; true when the API accepts it. */
export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/projects`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 429) return false;
  return res.ok;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiFetch("/api/projects");
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
  return res.json();
}

export async function fetchProject(id: string): Promise<Project | null> {
  const res = await apiFetch(`/api/projects/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
  return res.json();
}

export async function fetchMetrics(id: string, since = 0, limit = 500): Promise<MetricRow[]> {
  const res = await apiFetch(`/api/projects/${id}/metrics?since=${since}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to load metrics (${res.status})`);
  return res.json();
}

export async function registerProject(input: {
  name: string;
  exportUrl: string;
  environment: string;
}): Promise<RegisteredProject> {
  const res = await apiFetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to register project (${res.status})`);
  return res.json();
}
