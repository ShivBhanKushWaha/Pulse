# @shiv-kush/pulse-dashboard

The Pulse dashboard (UI + API) in one command. It reads the metrics your apps collect with
[`@shiv-kush/pulse-monitor-sdk`](https://www.npmjs.com/package/@shiv-kush/pulse-monitor-sdk) and shows them in a web UI.
Nothing is hosted for you: you run it on your laptop or on your own server, and your data stays in your own databases.

```
npx @shiv-kush/pulse-dashboard
```

Open the address it prints (default <http://localhost:4500>) and sign in with the admin token it shows on the first run.

Needs **Node 22.13 or newer** (it uses the built-in `node:sqlite`).

## How it works

Your app (with the SDK) keeps its metrics in **its own database** and exposes `GET /_pulse/export`. The dashboard
calls that URL every 20 seconds with the project's API key, copies new records into a small local SQLite cache, and
the UI reads from that cache.

```
your app + SDK  ──(its own DB)──►  /_pulse/export  ◄──poll (API key)──  pulse-dashboard  ◄──  your browser
```

## Quick start (local)

1. Start the dashboard: `npx @shiv-kush/pulse-dashboard --open`
2. In the UI click **+ New**, give the project a name and its export URL (for a local app:
   `http://localhost:5000/_pulse/export`). Copy the `apiKey` it shows (shown once).
3. Put the key and project id in your app's `.env` as `PULSE_API_KEY` and `PULSE_PROJECT_ID`, and add the SDK
   and a plugin (see the full example in the repository: `examples/full-setup`).
4. Start your app, make a few requests, and watch them appear.

## Running it on a server (production)

Run the same command on any machine that stays on and can reach your app's export URL:

```
npx @shiv-kush/pulse-dashboard --host 0.0.0.0 --port 4500 --data-dir /var/lib/pulse
```

- Put **HTTPS** in front of it (Caddy, nginx, or your platform's proxy). The admin token travels in every request.
- Keep `--data-dir` on a disk that survives restarts (it holds the database and the encryption key).
- Docker: see `examples/full-setup/dashboard.Dockerfile` and `docker-compose.yml`.
- If your app lives in a private network, run the dashboard in the same network and register the internal URL.

## Options

| Option | Default | |
|---|---|---|
| `--port <n>` | `4500` (or `PORT`) | Port to listen on. |
| `--host <addr>` | `127.0.0.1` | Use `0.0.0.0` on a server or in Docker. |
| `--data-dir <dir>` | `~/.pulse` (or `PULSE_DATA_DIR`) | Holds `config.json` and `pulse.sqlite`. |
| `--open` | off | Open the dashboard in your browser. |
| `pulse-dashboard token` | | Print the admin token. |

`config.json` is created on the first run with a random **admin token** and **encryption key** (file mode 600).
Environment variables win over it:

| Variable | |
|---|---|
| `PULSE_ADMIN_TOKEN` | Token to sign in with (24+ characters). |
| `PULSE_MASTER_KEY` | Encrypts the project API keys at rest (16+ characters). Do not change it later or stored keys become unreadable. |
| `PULSE_DB_PATH` | SQLite file. |
| `PULSE_POLL_INTERVAL_MS` | How often projects are polled (default 20000). |
| `PULSE_RETENTION_DAYS` | Cached metrics older than this are deleted hourly (default 14, `0` keeps all). |

## Security

- Every `/api/*` call needs `Authorization: Bearer <admin token>` (constant-time check, 20 failed attempts per 15 minutes returns 429). The UI files are public, but they only show a sign-in form until a valid token is entered.
- It listens on `127.0.0.1` by default, so it is not reachable from the network unless you choose `--host 0.0.0.0`.
- One admin token means everyone with it sees **all** registered projects. It is meant for one team.

## API

`GET/POST /api/projects`, `GET /api/projects/:id`, `GET /api/projects/:id/metrics?since=&limit=`, `GET /health` (open).
