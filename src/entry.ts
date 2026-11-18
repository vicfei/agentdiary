// The diary entry: human-readable markdown, machine-lenient parse (DESIGN.md §3).
// One spelling shared with the DSH plugin so a fleet can mix both writers.

export interface DiaryEntry {
  hhmm: string;
  node: string;
  window: string;
  task: string;
  did: string[];
  result: string;
  artifact: string;
}

const HEADER = /^### (\d{2}:\d{2}) \| node=(\S+) \| window=(\S+) \| task=(.*)$/;

export function renderEntry(e: DiaryEntry): string {
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  return [
    "",
    `### ${e.hhmm} | node=${e.node} | window=${e.window} | task=${one(e.task)}`,
    `- 做了什么：`,
    ...e.did.map((l) => `  - ${one(l)}`),
    `- 结果：${one(e.result)}`,
    `- 产物：${one(e.artifact)}`,
    "",
  ].join("\n");
}

/** Lenient parse of one entry block; null when the block isn't an entry header at all. */
export function parseEntry(block: string): DiaryEntry | null {
  const lines = block.split("\n");
  const m = HEADER.exec(lines.find((l) => HEADER.test(l)) ?? "");
  if (!m) return null;
  const did: string[] = [];
  let result = "";
  let artifact = "";
  let section: "did" | "result" | "artifact" | null = null;
  for (const line of lines) {
    if (line.startsWith("- 做了什么：")) { section = "did"; continue; }
    if (line.startsWith("- 结果：")) { result = line.slice(line.indexOf("：") + 1).trim(); section = "result"; continue; }
    if (line.startsWith("- 产物：")) { artifact = line.slice(line.indexOf("：") + 1).trim(); section = "artifact"; continue; }
    if (section === "did" && /^\s*-\s+/.test(line)) did.push(line.replace(/^\s*-\s+/, "").trim());
  }
  return { hhmm: m[1], node: m[2], window: m[3], task: m[4].trim(), did, result, artifact };
}

/** Split a day file into raw entry blocks (blank-line separated, header-led). */
export function parseDay(body: string): DiaryEntry[] {
  return body.split(/\n(?=### )/).map((b) => b.trim()).filter(Boolean).map(parseEntry).filter((e): e is DiaryEntry => e !== null);
}
