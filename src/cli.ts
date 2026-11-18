#!/usr/bin/env node
// agentdiary — your agents keep a diary, in your own git repo.
// Design: docs at brainvault/agentdiary/design/DESIGN.md (contract §3, CLI §2).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { initDiary, defaultNode } from "./init.js";
import { appendEntry } from "./append.js";
import { syncMemory } from "./sync.js";
import { verifyContract, dayFilePath } from "./contract.js";
import { loadConfig } from "./config.js";
import { parseDay } from "./entry.js";

const HELP = `agentdiary — your agents keep a diary, in your own git repo

usage:
  agentdiary init [--node N] [--root DIR]      establish the directory contract + config
  agentdiary append --task T [--did D;D] [--result R] [--artifact A]
                 [--node N] [--window W] [--root DIR]
                                                append today's entry (interactive with TTY)
  agentdiary sync [--node N] [--root DIR]      snapshot memory source + commit + push (rebase ×3)
  agentdiary scan [--strict] [--root DIR]      scan the diary for credential shapes (exit 1 on hit)
  agentdiary verify [--root DIR]               validate the directory contract (CI-grade)
  agentdiary log [N] [--node X] [--root DIR]   show the last N entries (default 10)

defaults: --root = cwd · node/window from agentdiary.toml`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  const root = arg("root") ?? process.cwd();
  if (!cmd || has("help") || cmd === "help") { console.log(HELP); return 0; }
  if (cmd === "init") {
    const node = arg("node") ?? defaultNode();
    const created = initDiary(root, node, { force: has("force") });
    console.log(created.length ? created.map((c) => `created ${c}`).join("\n") : "already initialized — nothing to do");
    return 0;
  }
  const cfg = loadConfig(root);
  const node = arg("node") ?? cfg.node;
  if (!node) { console.error("no node name — run `agentdiary init` or pass --node"); return 2; }
  const window = arg("window") ?? cfg.window;

  if (cmd === "append") {
    const { file } = await appendEntry({
      root, node, window,
      task: arg("task"),
      did: arg("did")?.split(";").map((s) => s.trim()).filter(Boolean),
      result: arg("result"),
      artifact: arg("artifact"),
      scan: cfg.scan,
    });
    console.log(`appended → ${file}`);
    return 0;
  }
  if (cmd === "sync") {
    const source = (cfg as { memory?: { source?: string } }).memory?.source;
    if (!source) { console.error("no [memory] source in agentdiary.toml — nothing to sync"); return 2; }
    const r = syncMemory(root, node, source);
    for (const l of r.lines) console.log(l);
    return r.ok ? 0 : 1;
  }
  if (cmd === "scan") {
    const { scanLine, isExempt } = await import("./scan.js");
    const mode = has("strict") || cfg.scan === "strict" ? "strict" : "tier";
    let hits = 0;
    const sessionsDir = join(root, "sessions");
    try {
      for (const ym of readdirSync(sessionsDir)) {
        for (const f of readdirSync(join(sessionsDir, ym))) {
          const p = join(sessionsDir, ym, f);
          if (isExempt(p)) continue;
          readFileSync(p, "utf8").split("\n").forEach((line, i) => {
            for (const h of scanLine(line, mode)) { console.log(`${p}:${i + 1} [${h.pattern}]`); hits++; }
          });
        }
      }
    } catch { console.error("no sessions/ to scan — run from the diary root"); return 2; }
    console.log(hits === 0 ? `clean (${mode})` : `${hits} hit(s)`);
    return hits === 0 ? 0 : 1;
  }
  if (cmd === "verify") {
    const findings = verifyContract(root);
    for (const f of findings) console.log(`${f.level === "error" ? "✗" : "⚠"} ${f.path} — ${f.message}`);
    if (findings.length === 0) console.log("contract ok");
    return findings.some((f) => f.level === "error") ? 1 : 0;
  }
  if (cmd === "log") {
    const n = Number(process.argv[3] ?? 10) || 10;
    const filterNode = arg("node");
    const all: { file: string; body: string }[] = [];
    const sessionsDir = join(root, "sessions");
    for (const ym of readdirSync(sessionsDir).sort().reverse()) {
      for (const f of readdirSync(join(sessionsDir, ym)).sort().reverse()) {
        if (filterNode && !f.endsWith(`-${filterNode}.md`)) continue;
        all.push({ file: join(sessionsDir, ym, f), body: readFileSync(join(sessionsDir, ym, f), "utf8") });
      }
    }
    const entries = all.flatMap(({ file, body }) => parseDay(body).map((e) => ({ file, e }))).slice(0, n);
    if (entries.length === 0) { console.log("no entries yet"); return 0; }
    for (const { file, e } of entries) {
      console.log(`\n${e.hhmm} node=${e.node} window=${e.window}  (${file})`);
      console.log(`  task: ${e.task}`);
      console.log(`  result: ${e.result}`);
    }
    return 0;
  }
  if (cmd === "today") {
    const file = dayFilePath(root, node, new Date().toISOString().slice(0, 10));
    try { console.log(readFileSync(file, "utf8")); } catch { console.log(`no entries today (${file})`); }
    return 0;
  }
  console.error(`unknown command: ${cmd}\n\n${HELP}`);
  return 2;
}

main().then((code) => process.exit(code)).catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
