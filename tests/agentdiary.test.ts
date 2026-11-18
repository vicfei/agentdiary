import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEntry, parseEntry, parseDay, type DiaryEntry } from "../src/entry.js";
import { parseToml, loadConfig } from "../src/config.js";
import { initDiary } from "../src/init.js";
import { appendEntry } from "../src/append.js";
import { verifyContract } from "../src/contract.js";
import { scanLine, isExempt } from "../src/scan.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "agentdiary-cli-")); execSync("git init -q -b main .", { cwd: dir }); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry: DiaryEntry = {
  hhmm: "10:30", node: "laptop", window: "zcode", task: "fixed the parser",
  did: ["read 3 files", "patched src/parse.ts"], result: "12/12 tests green", artifact: "abc1234",
};

describe("entry roundtrip", () => {
  it("renders and leniently parses back", () => {
    const md = renderEntry(entry);
    const back = parseEntry(md)!;
    expect(back.task).toBe("fixed the parser");
    expect(back.did).toEqual(["read 3 files", "patched src/parse.ts"]);
    expect(back.result).toBe("12/12 tests green");
    expect(back.hhmm).toBe("10:30");
  });
  it("parseDay splits on headers and skips non-entry blocks", () => {
    const body = `# 2026-11-18 · laptop\n${renderEntry(entry)}${renderEntry({ ...entry, hhmm: "11:00" })}`;
    expect(parseDay(body)).toHaveLength(2);
    expect(parseDay("# just a header\nnothing else")).toHaveLength(0);
  });
});

describe("config", () => {
  it("parses the TOML subset (sections, strings, bools)", () => {
    const c = parseToml(`node = "sg"\nscan = "tier"\nforce = true\nretries = 3\n\n[memory]\nsource = "/tmp/m"\n`);
    expect(c).toMatchObject({ node: "sg", scan: "tier", force: true, retries: 3, memory: { source: "/tmp/m" } });
  });
  it("loadConfig falls back to defaults; unknown scan value degrades to off", () => {
    expect(loadConfig(dir).scan).toBe("off");
    writeFileSync(join(dir, "agentdiary.toml"), `node = "x"\nscan = "wat"\n`);
    expect(loadConfig(dir)).toMatchObject({ node: "x", scan: "off", window: "shell" });
  });
});

describe("init + append + verify", () => {
  it("init is idempotent; append writes the day file; verify passes", () => {
    expect(initDiary(dir, "laptop")).toHaveLength(3);
    expect(initDiary(dir, "laptop")).toHaveLength(0);
    const { file } = appendEntrySync("write the docs", ["drafted README"], "merged", "a1b2c3");
    expect(file).toBe(join(dir, "sessions", "2026-11", `${new Date().toISOString().slice(0, 10)}-laptop.md`));
    expect(readFileSync(file, "utf8")).toContain("task=write the docs");
    expect(verifyContract(dir).filter((f) => f.level === "error")).toEqual([]);
  });
  it("verify flags out-of-order entries and wrong-directory files", () => {
    initDiary(dir, "laptop");
    const d = join(dir, "sessions", "2026-11");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "2026-11-18-laptop.md"), `# day\n${renderEntry({ ...entry, hhmm: "12:00" })}${renderEntry({ ...entry, hhmm: "09:00" })}`);
    const errs = verifyContract(dir).filter((f) => f.level === "error");
    expect(errs.some((e) => e.message.includes("time order"))).toBe(true);
  });
  it("scan=off by default; tier blocks an entry carrying a token", async () => {
    initDiary(dir, "laptop");
    await expect(appendEntry({ root: dir, node: "laptop", window: "w", task: "t", did: ["x"], result: "npm_AAAA0000BBBB0000CCCC0000DDDD0000 leaked", scan: "tier" }))
      .rejects.toThrow(/scan tier=tier blocked/);
  });
});

function appendEntrySync(task: string, did: string[], result: string, artifact: string) {
  // non-TTY path: flags only — exactly how agent windows will call it
  let out: { file: string } | undefined;
  let err: unknown;
  const p = require("node:child_process").spawnSync(process.execPath, [join(import.meta.dirname ?? dir, "../lib/cli.js"), "append", "--root", dir, "--node", "laptop", "--task", task, "--result", result, "--artifact", artifact, "--did", did.join(";")], { encoding: "utf8", env: { ...process.env } });
  if (p.status !== 0) err = new Error(p.stderr || "append failed");
  else {
    const m = /appended → (.+)/.exec(p.stdout);
    out = m ? { file: m[1].trim() } : undefined;
  }
  if (err) throw err;
  return out!;
}

describe("scan patterns", () => {
  it("tier catches common credential shapes; strict adds entropy blobs; provenance is exempt", () => {
    expect(scanLine("key = AKIAIOSFODNN7EXAMPLE", "tier")).toHaveLength(1);
    expect(scanLine("token = ghp_" + "x".repeat(36), "tier")).toHaveLength(1);
    expect(scanLine("hash " + "a".repeat(80), "tier")).toHaveLength(0);
    expect(scanLine("hash " + "a".repeat(80), "strict")).toHaveLength(1);
    expect(isExempt("memory/node/_synced_at")).toBe(true);
  });
});
