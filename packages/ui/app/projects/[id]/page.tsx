"use client";

import { useParams } from "next/navigation";
import ProjectDashboard from "../../../components/ProjectDashboard";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  return <ProjectDashboard id={params.id} />;
}
