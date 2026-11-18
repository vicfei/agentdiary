// append — the high-frequency path: must be <1s, offline, and scriptable.
// TTY → interactive template fill; no TTY (agent windows) → flags only.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { renderEntry, type DiaryEntry } from "./entry.js";
import { dayFilePath } from "./contract.js";
import { scanLine } from "./scan.js";

export interface AppendOptions {
  root: string;
  node: string;
  window: string;
  task?: string;
  did?: string[];
  result?: string;
  artifact?: string;
  scan: "off" | "tier" | "strict";
  now?: Date;
}

async function ask(rl: InterfaceLike, prompt: string, fallback = ""): Promise<string> {
  const a = (await rl.question(`${prompt}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return a || fallback;
}
type InterfaceLike = { question(q: string): Promise<string> };

function nowHHMM(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export async function appendEntry(opts: AppendOptions): Promise<{ file: string; entry: DiaryEntry }> {
  let { task, did, result, artifact } = opts;
  if (process.stdin.isTTY && (task === undefined || result === undefined)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      task = task ?? (await ask(rl, "task (one line)"));
      const didRaw: string = did?.join(";") ?? (await ask(rl, "did (one line, ';' splits)"));
      result = result ?? (await ask(rl, "result (one line)"));
      artifact = artifact ?? (await ask(rl, "artifact (commit/path/link)", "—"));
      did = didRaw.split(";").map((s: string) => s.trim()).filter(Boolean);
    } finally {
      rl.close();
    }
  }
  if (!task || !result) throw new Error("task and result are required (no TTY — pass --task/--did/--result)");
  const now = opts.now ?? new Date();
  const entry: DiaryEntry = {
    hhmm: nowHHMM(now),
    node: opts.node,
    window: opts.window,
    task,
    did: did && did.length > 0 ? did : ["(see result)"],
    result,
    artifact: artifact || "—",
  };
  if (opts.scan !== "off") {
    const text = [entry.task, ...entry.did, entry.result, entry.artifact].join("\n");
    const hits = scanLine(text, opts.scan);
    if (hits.length > 0) {
      throw new Error(`scan tier=${opts.scan} blocked the entry: ${hits.map((h) => h.pattern).join(", ")} — fix or set scan="off" in agentdiary.toml`);
    }
  }
  const file = dayFilePath(opts.root, opts.node, now.toISOString().slice(0, 10));
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, `# ${now.toISOString().slice(0, 10)} · ${opts.node}\n`);
  appendFileSync(file, renderEntry(entry));
  return { file, entry };
}
