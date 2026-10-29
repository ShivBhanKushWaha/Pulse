# Full setup example

A complete, working Pulse setup you can copy: **an Express app with the SDK** that keeps its metrics in its own
SQLite file, and **the dashboard** that shows them. Everything uses the published npm packages, so you can copy this
folder out of the repository and it still works.

```
src/index.ts          the app: initMonitoring + pulseExpress + a custom error record
src/sqliteStorage.ts  a durable StorageAdapter (the three methods every adapter implements)
.env.example          PULSE_API_KEY / PULSE_PROJECT_ID come from the dashboard
Dockerfile, dashboard.Dockerfile, docker-compose.yml   run both in containers
```

Needs Node 22.13+ (the dashboard and this example's storage use the built-in `node:sqlite`).

## A. Run it locally

**1. Start the dashboard** (terminal 1):

```
npx @shiv-kush/pulse-dashboard --open
```

It prints the address (<http://localhost:4500>) and, on the first run, an **admin token**. Sign in with it.
(`npx @shiv-kush/pulse-dashboard token` prints it again later.)

**2. Register the app as a project.** In the UI click **+ New**:

| Field | Value |
|---|---|
| Project name | `my-app` |
| Export URL | `http://localhost:5000/_pulse/export` |
| Environment | `development` |

It shows an **`apiKey`** and an **`id`** once. Copy them.

**3. Configure and start the app** (terminal 2):

```
cp .env.example .env        # then paste PULSE_API_KEY and PULSE_PROJECT_ID
npm install
npm run dev
```

**4. Make some traffic:**

```
curl localhost:5000/
curl localhost:5000/slow
curl localhost:5000/broken      # 500
curl localhost:5000/crash       # recorded as an "error" event
```

Open the project in the dashboard. Requests show up within ~20 seconds (the SDK flushes every 5 s, the dashboard polls
every 20 s), plus process metrics (memory, uptime, load) every 15 s.

## B. Run it in production

The pieces are the same; what changes is **where they run**:

1. **Your app** runs wherever it already does, with the SDK, and exposes `/_pulse/export` over HTTPS. Keep
   `PULSE_RECORDS_DB` (or your own database) on a persistent disk.
2. **The dashboard** runs on a machine that stays on and can reach that export URL:

   ```
   npx @shiv-kush/pulse-dashboard --host 0.0.0.0 --data-dir /var/lib/pulse
   ```

   or with Docker (below). Put HTTPS in front (Caddy, nginx, your platform's proxy) and set a long random
   `PULSE_ADMIN_TOKEN`.
3. **Register the production URL** in the dashboard: export URL `https://api.your-company.com/_pulse/export`,
   environment `production`. Put the new `apiKey` / `id` in the production app's environment.
4. Open the dashboard URL in a browser and sign in with the admin token.

If the app and dashboard share a private network, register the internal URL and never expose `/_pulse/export`
publicly. The export route is protected by the project's `apiKey`; the dashboard by the admin token.

### With Docker

```
cp .env.example .env
docker compose up --build dashboard      # open http://localhost:4500, sign in (token: docker compose logs dashboard)
```

Register the project with export URL `http://app:5000/_pulse/export`, put the `apiKey`/`id` in `.env`, then:

```
docker compose up --build -d app
```

## Using your own database

`src/sqliteStorage.ts` is only the stand-in for "the database your app already uses". Use a ready-made adapter or write
one (three methods, rules in the file's comment):

- MongoDB / Mongoose: `@shiv-kush/pulse-monitor-adapter-mongoose`

  ```ts
  import { createMongooseStorage } from "@shiv-kush/pulse-monitor-adapter-mongoose";
  storage: createMongooseStorage({ connection: mongoose.connection })
  ```

- Fastify instead of Express: `@shiv-kush/pulse-monitor-plugin-fastify` (`pulseFastify(app, monitoring)`).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Project shows no data | Dashboard cannot reach the export URL (check it from the dashboard's machine), or the app's `PULSE_API_KEY` does not match the one issued for that project. |
| `401` in the dashboard log for a project | Wrong `PULSE_API_KEY` in the app. Register the project again to get a new key. |
| Sign-in says the token is not accepted | Use `pulse-dashboard token`, or the `PULSE_ADMIN_TOKEN` you set. After 20 wrong attempts the client is blocked for 15 minutes. |
| `Node 22.13 or newer is required` | Upgrade Node (the dashboard uses the built-in `node:sqlite`). |
