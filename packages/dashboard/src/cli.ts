#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const HELP = `pulse-dashboard — the Pulse dashboard (UI + API) in one command

Usage
  pulse-dashboard [options]       start the dashboard
  pulse-dashboard token           print the admin token you sign in with

Options
  --port <n>        port to listen on                    (default 4500, or PORT)
  --host <addr>     address to listen on                 (default 127.0.0.1; use 0.0.0.0 on a server or in Docker)
  --data-dir <dir>  where config and the database live   (default ~/.pulse, or PULSE_DATA_DIR)
  --open            open the dashboard in your browser
  -h, --help        show this help
  -v, --version     show the version

Settings are kept in <data-dir>/config.json (admin token and encryption key are made on first run).
Environment variables win over it: PULSE_ADMIN_TOKEN, PULSE_MASTER_KEY, PULSE_DB_PATH, PULSE_POLL_INTERVAL_MS,
PULSE_RETENTION_DAYS.`;

const MIN_NODE = [22, 13];

interface StoredConfig {
  adminToken: string;
  masterKey: string;
}

function fail(message: string): never {
  console.error(`pulse-dashboard: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const out: { command: "start" | "token"; port?: string; host?: string; dataDir?: string; open: boolean; help: boolean; version: boolean } = {
    command: "start",
    open: false,
    help: false,
    version: false,
  };
  const args = [...argv];
  const value = (flag: string) => {
    const next = args.shift();
    if (!next || next.startsWith("-")) fail(`${flag} needs a value`);
    return next;
  };
  while (args.length > 0) {
    const arg = args.shift() as string;
    if (arg === "token") out.command = "token";
    else if (arg === "start") out.command = "start";
    else if (arg === "--port") out.port = value(arg);
    else if (arg === "--host") out.host = value(arg);
    else if (arg === "--data-dir") out.dataDir = value(arg);
    else if (arg === "--open") out.open = true;
    else if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-v" || arg === "--version") out.version = true;
    else fail(`unknown option "${arg}". Run with --help.`);
  }
  return out;
}

/** The admin token and master key survive restarts in <data-dir>/config.json; the first run creates them. */
function loadConfig(dataDir: string): { config: StoredConfig; created: boolean; file: string } {
  const file = path.join(dataDir, "config.json");
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(file)) {
    const stored = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<StoredConfig>;
    if (stored.adminToken && stored.masterKey) {
      return { config: { adminToken: stored.adminToken, masterKey: stored.masterKey }, created: false, file };
    }
  }

  const config: StoredConfig = {
    adminToken: `pulse_admin_${crypto.randomBytes(24).toString("hex")}`,
    masterKey: crypto.randomBytes(32).toString("hex"),
  };
  fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return { config, created: true, file };
}

function openBrowser(url: string) {
  const [command, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return;
  }
  if (options.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")) as { version: string };
    console.log(pkg.version);
    return;
  }

  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major < MIN_NODE[0]! || (major === MIN_NODE[0] && minor < MIN_NODE[1]!)) {
    fail(`Node ${MIN_NODE.join(".")} or newer is required (this is ${process.versions.node}); the dashboard uses the built-in node:sqlite.`);
  }

  const dataDir = path.resolve(options.dataDir ?? process.env.PULSE_DATA_DIR ?? path.join(os.homedir(), ".pulse"));
  const { config, created, file } = loadConfig(dataDir);

  if (options.command === "token") {
    console.log(process.env.PULSE_ADMIN_TOKEN ?? config.adminToken);
    return;
  }

  const port = Number(options.port ?? process.env.PORT ?? 4500);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`invalid port "${options.port ?? process.env.PORT}"`);
  const host = options.host ?? process.env.PULSE_HOST ?? "127.0.0.1";

  // db.ts and auth.ts read these when they load, so they are set before the server module is imported.
  process.env.PORT = String(port);
  process.env.PULSE_HOST = host;
  process.env.PULSE_ADMIN_TOKEN ??= config.adminToken;
  process.env.PULSE_MASTER_KEY ??= config.masterKey;
  process.env.PULSE_DB_PATH ??= path.join(dataDir, "pulse.sqlite");
  process.env.PULSE_LOG_LEVEL ??= "warn";

  const shownHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${shownHost}:${port}`;

  await import("./index.js");

  console.log(`\nPulse dashboard is running at ${url}`);
  if (process.env.PULSE_ADMIN_TOKEN === config.adminToken) {
    if (created) {
      console.log(`\nAdmin token (sign in with it; saved in ${file}):\n  ${config.adminToken}`);
    } else {
      console.log(`Admin token: run "pulse-dashboard token" to show it (kept in ${file}).`);
    }
  }
  console.log(`Data: ${process.env.PULSE_DB_PATH}\n`);

  if (options.open) openBrowser(url);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
