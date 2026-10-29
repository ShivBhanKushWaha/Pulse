"use client";

import { useEffect, useState } from "react";
import { fetchProjects, type Project } from "../lib/api";

/** One line on the overview page: how many projects are registered (read in the browser, with the admin token). */
export default function ProjectsSummary() {
  const [projects, setProjects] = useState<Project[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchProjects()
      .then((data) => !cancelled && setProjects(data))
      .catch(() => !cancelled && setProjects(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (projects === undefined) return <p className="mt-4 text-sm text-muted">Loading projects…</p>;

  return (
    <p className="mt-4 text-sm">
      {projects === null
        ? "⚠ Can't reach the dashboard API right now — is pulse-dashboard running?"
        : projects.length === 0
          ? "No projects registered yet — hit “+ New” in the sidebar to get started."
          : `${projects.length} project${projects.length === 1 ? "" : "s"} registered. Pick one from the sidebar to see live metrics.`}
    </p>
  );
}
