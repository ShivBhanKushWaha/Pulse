# Pulse — self-owned monitoring platform

Monorepo, pnpm workspaces.

```
pulse/
  packages/
    sdk/               @shiv-kush/pulse-monitor-sdk — core: config, buffer, storage-adapter interface, /_pulse/export handler
    plugin-express/     @shiv-kush/pulse-monitor-plugin-express — Express middleware + mounts the export route
    plugin-fastify/     @shiv-kush/pulse-monitor-plugin-fastify — Fastify hook + mounts the export route
    adapter-mongoose/   @shiv-kush/pulse-monitor-adapter-mongoose — StorageAdapter for MongoDB / Mongoose
    dashboard/          @shiv-kush/pulse-dashboard — run the dashboard with one command (UI + API); registry, poller, cache DB
    ui/                 pulse-ui — the Next.js UI (built as static files and shipped inside the dashboard package)
```

## How it fits together

1. A monitored project installs `@shiv-kush/pulse-monitor-sdk` + a framework plugin (`@shiv-kush/pulse-monitor-plugin-express` today; a Fastify plugin next).
2. It implements a `StorageAdapter` (three methods: `init`, `write`, `readSince`) backed by **its own existing DB connection** — Mongo, Postgres, whatever it already runs. Pulse never provisions or touches that DB directly.
3. `initMonitoring({ apiKey, projectId, environment, storage })` starts an in-memory buffer that batches writes into that adapter, and samples process metrics (memory, uptime, load).
4. `pulseExpress(app, instance)` adds request-timing middleware and mounts `GET /_pulse/export`, authenticated by `apiKey`.
5. You register the project once in `pulse-dashboard` (`POST /api/projects`) — it returns `{ id, apiKey }`. The `apiKey` is shown once; store it in the project's `.env` as `PULSE_API_KEY`.
6. `pulse-dashboard`'s poller calls each registered project's export URL every N seconds, pulling records since its last cursor, caching them in its own local SQLite DB for fast UI reads.

Nothing in the monitored project's DB credentials, connection string, or raw data ever reaches the dashboard — only the batched metric records it chooses to write via the adapter.

## Security

- **Dashboard API:** every `/api/*` call needs `Authorization: Bearer <PULSE_ADMIN_TOKEN>` (only `/health` is open). Compared in constant time; 20 failed attempts per client in 15 minutes returns 429. Production refuses to start without `PULSE_ADMIN_TOKEN` (24+ characters) and `PULSE_MASTER_KEY` (16+ characters). In development, if no token is set a temporary one is printed at startup. The UI shows a sign-in form and keeps the token in the browser's local storage.
- **Export route:** `GET /_pulse/export` needs the project's `apiKey` as a Bearer token, compared in constant time. The SDK refuses keys shorter than 32 characters (use the key the dashboard gave you, or `crypto.randomBytes(32).toString('hex')`), and 20 failed attempts per client IP in 15 minutes returns 429 (behind a proxy, make sure `req.ip` is the real client, e.g. Express `trust proxy`).
- **Routes:** requests that match no route are recorded under the fixed label `unmatched`, never with their raw path or query string.
- **Dashboard export URLs:** in production (`NODE_ENV=production`) `exportUrl` must be `https://` and must not resolve to a loopback, private or link-local address. `PULSE_ALLOW_HTTP=1` allows http, `PULSE_ALLOWED_HOSTS=host1,10.0.0.5` exempts trusted hosts. Redirects are not followed.
- Project API keys are encrypted at rest (AES-256-GCM, key from `PULSE_MASTER_KEY`).

## Delivery guarantees

- **SDK to your DB:** a failed write is retried with exponential backoff (queue bounded by `maxQueueSize`, oldest dropped first). Every record has a unique `id`, so a batch written twice is stored once.
- **Your DB to the dashboard:** the export is inclusive (`ts >= since`), the dashboard stores records with `INSERT OR IGNORE` on `(project, record id)`, so the cursor can never skip records that share a millisecond. If a whole page sits in one millisecond the page size grows (500 → 10,000) before the cursor moves on. Rounds never overlap, and each request has a 10 s timeout.
- **Retention:** the dashboard deletes cached metrics older than `PULSE_RETENTION_DAYS` (default 14) hourly. The Mongoose adapter expires records in your DB itself (TTL, `retentionDays`, default 7).

## Status

Implemented:

- `@shiv-kush/pulse-monitor-sdk` core (buffer with retry, process sampler, export handler, `initMonitoring`)
- `@shiv-kush/pulse-monitor-plugin-express` and `@shiv-kush/pulse-monitor-plugin-fastify` (HTTP timing + export route; the export route itself is not recorded)
- `@shiv-kush/pulse-monitor-adapter-mongoose` (any `mongoose.connection` or native `Db`)
- `@shiv-kush/pulse-dashboard` (`npx` CLI serving the UI and an authenticated REST API; SQLite registry, poller, retention) and `pulse-ui` (static export)

Not yet implemented: Postgres / Prisma adapters, error-handling plugin, alerting, per-user accounts (one admin token for now).

## Quick start (no clone needed)

```
npx @shiv-kush/pulse-dashboard --open
```

See [`packages/dashboard`](packages/dashboard) and the complete walk-through (local, production, Docker) in [`examples/full-setup`](examples/full-setup).

## Developing Pulse itself

```
pnpm install
cp packages/dashboard/.env.example packages/dashboard/.env   # set PULSE_ADMIN_TOKEN and PULSE_MASTER_KEY
pnpm --filter @shiv-kush/pulse-dashboard dev
```

Then register a project (or use “+ New” in the UI after signing in with the token):

```
curl -X POST http://localhost:4500/api/projects   -H "authorization: Bearer $PULSE_ADMIN_TOKEN"   -H "content-type: application/json"   -d '{"name":"SkStore Server","exportUrl":"http://localhost:5000/_pulse/export","environment":"development"}'
```

Save the returned `apiKey` — it will not be shown again.

## License

[MIT](LICENSE)
