// week — the 7-day cross-node aggregation (agentdiary week). Unit-level against src/,
// no build needed: the window math, the collection (only days inside the window), the
// node-grouped rendering, and the clock default (trailing 7 days) are all pure functions.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectWeek, renderWeek, weekWindow } from "../src/week.js";

let dir: string;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const day = (date: string, node: string, hhmm: string, task: string) => ({
  date, node, body: [
    `# ${date} · ${node}`,
    "",
    `### ${hhmm} | node=${node} | window=x(zcode) | task=${task}`,
    "- 做了什么：",
    "  - something",
    "- 结果：ok",
    "- 产物：none",
    "",
  ].join("\n"),
});

function writeDays(days: { date: string; node: string; body: string }[]): void {
  dir = mkdtempSync(join(tmpdir(), "agentdiary-week-"));
  for (const d of days) {
    const ym = d.date.slice(0, 7);
    mkdirSync(join(dir, "sessions", ym), { recursive: true });
    writeFileSync(join(dir, "sessions", ym, `${d.date}-${d.node}.md`), d.body); // one file per node-day, like the CLI
  }
}

describe("weekWindow", () => {
  it("spans exactly 7 UTC days from the anchor", () => {
    expect(weekWindow("2026-11-18")).toEqual([
      "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24",
    ]);
  });
});

describe("collectWeek", () => {
  it("gathers entries across nodes inside the window, drops days outside, sorts by date+time", () => {
    writeDays([
      { ...day("2026-11-17", "sg", "09:00", "before the window") },
      { ...day("2026-11-18", "sg", "23:00", "first day late entry") },
      { ...day("2026-11-18", "wsl2", "08:00", "first day early entry") },
      { ...day("2026-11-24", "sg", "10:00", "last day of the window") },
      { ...day("2026-11-25", "sg", "10:00", "day after the window") },
    ]);
    const entries = collectWeek(dir, "2026-11-18");
    expect(entries.map((e) => `${e.date} ${e.hhmm} ${e.node}`)).toEqual([
      "2026-11-18 08:00 wsl2",
      "2026-11-18 23:00 sg",
      "2026-11-24 10:00 sg",
    ]);
    expect(entries.every((e) => e.task && e.result === "ok")).toBe(true);
  });

  it("an empty diary (or no sessions dir) is an empty week, never an error", () => {
    dir = mkdtempSync(join(tmpdir(), "agentdiary-week-"));
    expect(collectWeek(dir, "2026-11-18")).toEqual([]);
  });
});

describe("renderWeek", () => {
  it("counts nodes and groups by node with per-entry task lines", () => {
    const out = renderWeek([
      { date: "2026-11-18", node: "sg", hhmm: "09:00", task: "a", result: "done", window: "x" },
      { date: "2026-11-19", node: "wsl2", hhmm: "10:00", task: "b", result: "", window: "x" },
    ], "2026-11-18");
    expect(out).toContain("2 entries across 2 node(s)");
    expect(out).toContain("[sg] 1 entries");
    expect(out).toContain("2026-11-18 09:00 · a → done");
    expect(out).toContain("2026-11-19 10:00 · b"); // no result → no dangling arrow
  });
});
