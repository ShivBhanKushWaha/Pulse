"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerProject, type RegisteredProject } from "../lib/api";
import CopyButton from "./CopyButton";

export default function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [exportUrl, setExportUrl] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisteredProject | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);

  if (!open) return null;

  function validateExportUrl(value: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return "Enter a full URL, e.g. http://localhost:5000/_pulse/export";
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "URL must use http:// or https://";
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      return "URL should include the export path, e.g. /_pulse/export";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urlError = validateExportUrl(exportUrl);
    if (urlError) {
      setUrlTouched(true);
      setError(urlError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await registerProject({ name, exportUrl, environment });
      setResult(project);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register project");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setName("");
    setExportUrl("");
    setEnvironment("development");
    setResult(null);
    setError(null);
    setRevealed(false);
    setUrlTouched(false);
    onClose();
  }

  function envContents(project: RegisteredProject): string {
    return `PORT=5000\nPULSE_API_KEY=${project.apiKey}\nPULSE_PROJECT_ID=${project.id}\n`;
  }

  function downloadEnv(project: RegisteredProject) {
    const blob = new Blob([envContents(project)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={reset}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!result ? (
          <>
            <h2 className="text-base font-semibold">Register a project</h2>
            <p className="mt-1 text-xs text-muted">
              This project keeps its own database. Pulse only stores an id, an api key, and its export URL.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Project name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Export URL</label>
                <input
                  type="url"
                  placeholder="http://localhost:5000/_pulse/export"
                  value={exportUrl}
                  onChange={(e) => setExportUrl(e.target.value)}
                  onBlur={() => setUrlTouched(true)}
                  required
                  className={`w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none ${
                    urlTouched && validateExportUrl(exportUrl)
                      ? "border-bad focus:border-bad"
                      : "border-border focus:border-accent"
                  }`}
                />
                {urlTouched && validateExportUrl(exportUrl) && (
                  <p className="mt-1 text-[11px] text-bad">{validateExportUrl(exportUrl)}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Environment</label>
                <input
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {error && <p className="text-xs text-bad">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Registering…" : "Register"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-good">Project registered</h2>
            <p className="mt-1 text-xs text-muted">Save this now — the api key will not be shown again.</p>

            <div className="mt-4 space-y-3 rounded-md border border-accent-dim bg-bg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted">project_id</div>
                  <div className="truncate font-mono text-xs">{result.id}</div>
                </div>
                <CopyButton value={result.id} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted">api_key</div>
                  <div className="truncate font-mono text-xs">
                    {revealed ? result.apiKey : "•".repeat(20)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                  <CopyButton value={result.apiKey} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => downloadEnv(result)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-panel-hover"
              >
                Download .env
              </button>
              <CopyButton
                value={envContents(result)}
                label="Copy as .env"
                copiedLabel="Copied ✓"
                className="px-3 py-1.5 text-sm"
              />
              <button
                onClick={reset}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
