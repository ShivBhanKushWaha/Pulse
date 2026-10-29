"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectDashboard from "../../components/ProjectDashboard";

function ProjectView() {
  const id = useSearchParams().get("id");
  if (!id) return <p className="text-sm text-muted">Pick a project from the sidebar.</p>;
  return <ProjectDashboard id={id} />;
}

// useSearchParams needs a Suspense boundary in a statically exported page.
export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectView />
    </Suspense>
  );
}
