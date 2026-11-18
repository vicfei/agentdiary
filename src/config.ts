// agentdiary.toml — minimal TOML subset (sections + string/bool/int keys). Zero deps:
// the config surface is small on purpose; grow it only when a feature needs it.

import { existsSync, readFileSync } from "node:fs";

export interface DiaryConfig {
  node: string;
  window: string;
  scan: "off" | "tier" | "strict";
  [key: string]: unknown;
}

export const DEFAULT_CONFIG: DiaryConfig = { node: "", window: "shell", scan: "off" };

export function parseToml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let section = out;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const sec = /^\[([A-Za-z0-9_-]+)\]$/.exec(line);
    if (sec) { section = out[sec[1]] = {}; continue; }
    const kv = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const rawVal = kv[2].trim();
    section[kv[1]] =
      rawVal === "true" ? true :
      rawVal === "false" ? false :
      /^-?\d+$/.test(rawVal) ? Number(rawVal) :
      /^".*"$/.test(rawVal) ? rawVal.slice(1, -1) :
      rawVal;
  }
  return out;
}

export function loadConfig(root: string): DiaryConfig {
  const file = `${root}/agentdiary.toml`;
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  const parsed = parseToml(readFileSync(file, "utf8"));
  const top = parsed as { node?: unknown; window?: unknown; scan?: unknown };
  const scan = top.scan === "tier" || top.scan === "strict" ? top.scan : "off";
  return { ...DEFAULT_CONFIG, ...parsed, node: String(top.node ?? ""), window: String(top.window ?? "shell"), scan };
}
