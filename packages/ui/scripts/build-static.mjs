// Builds the static UI into ./out. NEXT_PUBLIC_PULSE_API_URL is forced empty (same-origin API), even if a
// developer's .env.local points at localhost:4500.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("out", { recursive: true, force: true });

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NEXT_PUBLIC_PULSE_API_URL: "" },
});

process.exit(result.status ?? 1);
