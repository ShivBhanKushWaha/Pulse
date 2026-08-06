import { fetchProjects } from "../lib/api";
import CodeBlock from "../components/CodeBlock";

const COLLECTED = [
  {
    title: "HTTP requests",
    status: "auto",
    desc: "Method, route pattern, status code, and duration for every request, captured by the framework middleware.",
  },
  {
    title: "Process metrics",
    status: "auto",
    desc: "Memory (RSS, heap), uptime, and load average — sampled every 15s in the background.",
  },
  {
    title: "Errors & auth events",
    status: "manual",
    desc: "Recordable today via instance.record({ kind: 'error' | 'auth_event', data }) — automatic capture ships with the error-handling plugin.",
  },
  {
    title: "DB / queue / cache metrics",
    status: "planned",
    desc: "Query timing, queue depth, cache hit rate — via opt-in plugins (Mongoose, Prisma, Redis, BullMQ) not built yet.",
  },
];

const STATUS_STYLE: Record<string, string> = {
  auto: "bg-good/15 text-good",
  manual: "bg-accent/15 text-accent",
  planned: "border border-border text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  auto: "collected automatically",
  manual: "available, manual call",
  planned: "not built yet",
};

export default async function HomePage() {
  const projects = await fetchProjects().catch(() => null);

  return (
    <div className="mx-auto max-w-3xl space-y-16">
      <section>
        <h1 className="text-3xl font-bold">Pulse</h1>
        <p className="mt-2 text-sm text-muted">
          A monitoring platform you own. Install the SDK in any Node backend, and it starts pushing metrics
          into <strong className="text-text">that project&apos;s own database</strong> — this dashboard only
          polls a small export endpoint you control, it never touches your data directly.
        </p>
        <p className="mt-4 text-sm">
          {projects === null
            ? "⚠ Can't reach the dashboard API right now — is pulse-dashboard running?"
            : projects.length === 0
              ? "No projects registered yet — hit “+ New” in the sidebar to get started."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} registered. Pick one from the sidebar to see live metrics.`}
        </p>
      </section>

      <section id="what-we-collect" className="scroll-mt-20">
        <h2 className="text-lg font-semibold">What data gets collected</h2>
        <p className="mt-1 text-sm text-muted">
          Only what&apos;s listed here — nothing else leaves your project&apos;s process.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {COLLECTED.map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{item.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="setup" className="scroll-mt-20">
        <h2 className="text-lg font-semibold">How to implement</h2>
        <p className="mt-1 text-sm text-muted">
          Four steps. No new database to run, no infrastructure to stand up in your project.
        </p>

        <div className="mt-4 space-y-5">
          <Step n={1} title="Install the SDK + a framework plugin">
            <CodeBlock
              label="shell"
              code={"pnpm add @shiv-kush/pulse-monitor-sdk @shiv-kush/pulse-monitor-plugin-express"}
            />
          </Step>

          <Step n={2} title="Register the project here to get credentials">
            <p className="mb-2 text-xs text-muted">
              Click “+ New” in the sidebar, or call the dashboard API directly:
            </p>
            <CodeBlock
              label="shell"
              code={`curl -X POST http://localhost:4500/api/projects \\
  -H "content-type: application/json" \\
  -d '{"name":"my-service","exportUrl":"http://localhost:5000/_pulse/export","environment":"production"}'`}
            />
          </Step>

          <Step n={3} title="Configure it in your app, using your own DB connection">
            <CodeBlock
              label="src/monitoring.ts"
              code={`import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseExpress } from "@shiv-kush/pulse-monitor-plugin-express";

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY!,
  projectId: process.env.PULSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "development",
  storage: myStorageAdapter, // writes into YOUR existing database
});

pulseExpress(app, monitoring);`}
            />
          </Step>

          <Step n={4} title="Add credentials to your project's .env and start the server">
            <CodeBlock label=".env" code={"PULSE_API_KEY=pulse_...\nPULSE_PROJECT_ID=..."} />
            <p className="mt-2 text-xs text-muted">
              That&apos;s it — the dashboard&apos;s poller picks up metrics automatically once your server is
              reachable at the export URL you registered.
            </p>
          </Step>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim text-xs font-bold text-white">
        {n}
      </div>
      <div className="flex-1">
        <div className="mb-2 text-sm font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}
