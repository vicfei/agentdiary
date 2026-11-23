// week — aggregate the diary across nodes over a 7-day window (agentdiary week).
// Feeds fleet weekly reports as a fact layer alongside sessionlog/worklog.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "./entry.js";

export interface WeekEntry {
  date: string;
  node: string;
  hhmm: string;
  task: string;
  result: string;
  window: string;
}

export function weekWindow(from: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** All entries whose day file falls inside the 7-day window starting `from` (YYYY-MM-DD). */
export function collectWeek(root: string, from: string): WeekEntry[] {
  const days = new Set(weekWindow(from));
  const sessionsDir = join(root, "sessions");
  if (!existsSync(sessionsDir)) return [];
  const out: WeekEntry[] = [];
  for (const ym of readdirSync(sessionsDir).sort()) {
    for (const f of readdirSync(join(sessionsDir, ym)).sort()) {
      const m = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(f);
      if (!m || !days.has(m[1])) continue;
      const body = readFileSync(join(sessionsDir, ym, f), "utf8");
      for (const e of parseDay(body)) {
        out.push({ date: m[1], node: e.node, hhmm: e.hhmm, task: e.task, result: e.result, window: e.window });
      }
    }
  }
  return out.sort((a, b) => (a.date + a.hhmm).localeCompare(b.date + b.hhmm));
}

export function renderWeek(entries: WeekEntry[], from: string): string {
  const lines: string[] = [`week ${from} ~ +6d — ${entries.length} entries across ${new Set(entries.map((e) => e.node)).size} node(s)`];
  const byNode = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    const list = byNode.get(e.node) ?? [];
    list.push(e);
    byNode.set(e.node, list);
  }
  for (const [node, list] of [...byNode.entries()].sort()) {
    lines.push(`\n[${node}] ${list.length} entries`);
    for (const e of list) lines.push(`  ${e.date} ${e.hhmm} · ${e.task}${e.result ? ` → ${e.result}` : ""}`);
  }
  return lines.join("\n");
}
