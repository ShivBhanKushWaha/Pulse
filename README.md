# Pulse — self-owned monitoring platform

Monorepo, pnpm workspaces.

```
pulse/
  packages/
    sdk/               @shiv-kush/pulse-monitor-sdk — core: config, buffer, storage-adapter interface, /_pulse/export handler
    plugin-express/     @shiv-kush/pulse-monitor-plugin-express — Express middleware + mounts the export route
    dashboard/           pulse-dashboard — the only service you host: registry, poller, cache DB, API
```

## How it fits together

1. A monitored project installs `@shiv-kush/pulse-monitor-sdk` + a framework plugin (`@shiv-kush/pulse-monitor-plugin-express` today; a Fastify plugin next).
2. It implements a `StorageAdapter` (three methods: `init`, `write`, `readSince`) backed by **its own existing DB connection** — Mongo, Postgres, whatever it already runs. Pulse never provisions or touches that DB directly.
3. `initMonitoring({ apiKey, projectId, environment, storage })` starts an in-memory buffer that batches writes into that adapter, and samples process metrics (memory, uptime, load).
4. `pulseExpress(app, instance)` adds request-timing middleware and mounts `GET /_pulse/export`, authenticated by `apiKey`.
5. You register the project once in `pulse-dashboard` (`POST /api/projects`) — it returns `{ id, apiKey }`. The `apiKey` is shown once; store it in the project's `.env` as `PULSE_API_KEY`.
6. `pulse-dashboard`'s poller calls each registered project's export URL every N seconds, pulling records since its last cursor, caching them in its own local SQLite DB for fast UI reads.

Nothing in the monitored project's DB credentials, connection string, or raw data ever reaches the dashboard — only the batched metric records it chooses to write via the adapter.

## Status: Phase 1 skeleton

Implemented:

- `@shiv-kush/pulse-monitor-sdk` core (buffer, process sampler, export handler, `initMonitoring`)
- `@shiv-kush/pulse-monitor-plugin-express` (HTTP timing + export route)
- `pulse-dashboard` (SQLite registry, poller, minimal REST API — no UI yet)

Not yet implemented (see architecture report for full phase plan):

- A `StorageAdapter` implementation for Mongoose (needed to wire into SkStore_Server, since that's Mongo-based)
- `pulse-plugin-fastify`
- Dashboard UI (Next.js), alerting, auth on the dashboard's own API

## Running the dashboard locally

```
pnpm install
pnpm --filter pulse-dashboard dev
```

Then:

```
curl -X POST http://localhost:4500/api/projects \
  -H "content-type: application/json" \
  -d '{"name":"SkStore Server","exportUrl":"http://localhost:5000/_pulse/export","environment":"development"}'
```

Save the returned `apiKey` — it will not be shown again.