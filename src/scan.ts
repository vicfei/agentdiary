// Optional secret scanning (DESIGN.md: off / tier / strict — default off; the fleet's own
// zero-redaction philosophy made `off` the product default too). tier = common credential
// shapes; strict = tier + any long high-entropy token. Exit 1 on hit when run as a command.

export interface ScanHit { file: string; line: number; tier: "tier" | "strict"; pattern: string }

const TIER_PATTERNS: [string, RegExp][] = [
  ["aws-access-key", /AKIA[0-9A-Z]{16}/],
  ["github-pat", /gh[pousr]_[A-Za-z0-9]{36,}/],
  ["npm-token", /npm_[A-Za-z0-9]{30,}/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["sk-api-key", /sk-[A-Za-z0-9]{20,}/],
];

const STRICT_PATTERNS: [string, RegExp][] = [
  ["high-entropy-blob", /[A-Za-z0-9+\/=_-]{64,}/],
];

export function scanLine(line: string, mode: "tier" | "strict"): ScanHit[] {
  const hits: ScanHit[] = [];
  for (const [name, re] of TIER_PATTERNS) if (re.test(line)) hits.push({ tier: "tier", pattern: name } as ScanHit);
  if (mode === "strict") for (const [name, re] of STRICT_PATTERNS) if (re.test(line)) hits.push({ tier: "strict", pattern: name } as ScanHit);
  return hits;
}

export function isExempt(path: string): boolean {
  // provenance + vendor paths never count; a diary ABOUT credentials (docs) is the author's call
  return /(^|\/)_synced_at$|(^|\/)_source(\.txt)?$|(^|\/)node_modules\//.test(path);
}
