// sync — snapshot a memory source into memory/<node>/ with provenance, then commit + push
// with the fleet's rebase discipline (retry ×3). rsync --delete keeps the snapshot honest.

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function run(cmd: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

export interface SyncResult { lines: string[]; ok: boolean }

export function syncMemory(root: string, node: string, source: string, opts: { push?: boolean } = {}): SyncResult {
  const lines: string[] = [];
  if (!existsSync(source)) return { lines: [`sync: memory source ${source} does not exist — nothing to do`], ok: false };
  const dest = join(root, "memory", node);
  const rs = run("rsync", ["-a", "--delete", "--exclude", "_synced_at", "--exclude", "_source.txt", `${source}/`, `${dest}/`]);
  if (rs.code !== 0) return { lines: [`sync: rsync failed: ${rs.out.trim()}`], ok: false };
  writeFileSync(join(dest, "_synced_at"), `${new Date().toISOString()}\n`);
  writeFileSync(join(dest, "_source.txt"), `${source}\n`);
  lines.push(`sync: ${dest} ← ${source}`);

  run("git", ["-C", root, "add", "-A"]);
  if (run("git", ["-C", root, "status", "--porcelain"]).out.trim() === "") {
    lines.push("sync: nothing to commit");
    return { lines, ok: true };
  }
  run("git", ["-C", root, "-c", "user.name=agentdiary", "-c", "user.email=agentdiary@localhost", "commit", "-q", "-m", `diary sync: memory/${node}`]);
  lines.push("sync: committed");
  if (opts.push === false) return { lines, ok: true };
  for (let i = 1; i <= 3; i++) {
    const pull = run("git", ["-C", root, "pull", "--rebase", "-q"]);
    if (pull.code !== 0) { lines.push(`sync: pull/rebase attempt ${i} failed: ${pull.out.trim().split("\n").slice(-1)[0]}`); continue; }
    const push = run("git", ["-C", root, "push", "-q"]);
    if (push.code === 0) { lines.push("sync: pushed"); return { lines, ok: true }; }
    lines.push(`sync: push attempt ${i} failed`);
  }
  return { lines, ok: false };
}
