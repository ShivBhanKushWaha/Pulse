// Copies the statically exported UI (packages/ui/out) into this package as ./ui, which is what the published
// package serves.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "../../ui/out");
const target = join(here, "../ui");

if (!existsSync(join(source, "index.html"))) {
  console.error("UI build not found at packages/ui/out. Run `pnpm --filter pulse-ui build:static` first.");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log("UI copied to packages/dashboard/ui");
