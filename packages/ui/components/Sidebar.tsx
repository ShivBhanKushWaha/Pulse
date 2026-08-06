"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchProjects, type Project } from "../lib/api";
import NewProjectModal from "./NewProjectModal";

const POLL_MS = 8000;

export default function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchProjects();
        if (!cancelled) {
          setProjects(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-panel">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <span className="h-2 w-2 rounded-full bg-accent live-dot" />
          <Link href="/" className="text-lg font-bold tracking-tight">
            Pulse
          </Link>
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Projects</span>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-accent-dim px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent"
          >
            + New
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {error && <p className="px-2 py-2 text-xs text-bad">API unreachable</p>}
          {projects === null && !error && (
            <div className="space-y-2 px-2 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-panel-hover" />
              ))}
            </div>
          )}
          {projects?.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted">No projects yet — register one.</p>
          )}
          {projects?.map((p) => {
            const href = `/projects/${p.id}`;
            const active = pathname === href;
            return (
              <Link
                key={p.id}
                href={href}
                className={`mb-1 flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent-dim text-white" : "text-text hover:bg-panel-hover"
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-2 shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                  {p.environment}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
