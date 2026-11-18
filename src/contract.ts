// The directory contract (DESIGN.md §3): sessions/ append-only, memory/ snapshot,
// agentdiary.toml config. `verify` is CI-grade: exit code carries the verdict.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "./entry.js";

export interface VerifyFinding { level: "error" | "warn"; path: string; message: string }

export function dayFilePath(root: string, node: string, isoDay: string): string {
  const ym = isoDay.slice(0, 7);
  return join(root, "sessions", ym, `${isoDay}-${node}.md`);
}

export function verifyContract(root: string): VerifyFinding[] {
  const out: VerifyFinding[] = [];
  if (!existsSync(join(root, "sessions"))) out.push({ level: "error", path: "sessions/", message: "missing — run `agentdiary init`" });
  if (!existsSync(join(root, "agentdiary.toml"))) out.push({ level: "warn", path: "agentdiary.toml", message: "missing — defaults in effect (node name unknown)" });
  const sessionsDir = join(root, "sessions");
  if (!existsSync(sessionsDir)) return out;
  // file names must match the contract; entries must be time-ordered within a file
  for (const ym of readdirSync(sessionsDir).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort()) {
    for (const f of readdirSync(join(sessionsDir, ym))) {
      const p = join(sessionsDir, ym, f);
      if (!/^\d{4}-\d{2}-\d{2}-[^/]+\.md$/.test(f)) {
        out.push({ level: "error", path: p, message: "file name outside the contract (YYYY-MM-DD-<node>.md)" });
        continue;
      }
      const entries = parseDay(readFileSync(p, "utf8"));
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].hhmm < entries[i - 1].hhmm) {
          out.push({ level: "error", path: p, message: `entries out of time order at ${entries[i].hhmm} (after ${entries[i - 1].hhmm})` });
          break;
        }
      }
      const day = f.slice(0, 10);
      const ymOk = `${day.slice(0, 7)}` === ym;
      if (!ymOk) out.push({ level: "error", path: p, message: "file sits in the wrong YYYY-MM directory" });
    }
  }
  // memory snapshots must carry provenance
  const memDir = join(root, "memory");
  if (existsSync(memDir)) {
    for (const node of readdirSync(memDir)) {
      const nd = join(memDir, node);
      if (!statSync(nd).isDirectory()) continue;
      if (!existsSync(join(nd, "_synced_at"))) out.push({ level: "warn", path: join(nd, "_synced_at"), message: "snapshot lacks provenance (_synced_at)" });
    }
  }
  return out;
}
