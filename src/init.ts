// init — establish the directory contract + config. Idempotent: never overwrites.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

export function initDiary(root: string, node: string, opts: { force?: boolean } = {}): string[] {
  const created: string[] = [];
  for (const dir of ["sessions", "memory"]) {
    const d = join(root, dir);
    if (!existsSync(d)) { mkdirSync(d, { recursive: true }); created.push(d); }
  }
  const cfg = join(root, "agentdiary.toml");
  if (!existsSync(cfg) || opts.force) {
    writeFileSync(cfg, [
      `# agentdiary — your agents' diary, in your git repo`,
      `node = "${node}"`,
      `window = "shell"`,
      `# scan = "off" | "tier" | "strict" — credential-shape scanning before entries land`,
      `scan = "off"`,
      ``,
      `[memory]`,
      `# source = "/absolute/path/to/snapshot"   # agentdiary sync rsyncs this into memory/<node>/`,
      ``,
    ].join("\n"));
    created.push(cfg);
  }
  return created;
}

export function defaultNode(): string {
  return hostname().split(".")[0] || "node";
}
