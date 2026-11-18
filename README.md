# agentdiary

**Your agents keep a diary — in your own git repo.**

You run Claude Code, Codex, OpenCode, zcode — several windows, several machines. The work is good; the *record* of who did what, when, and how it ended lives scattered across chat scrolls nobody re-reads. agentdiary fixes the record, not the chat:

```text
sessions/2026-11/2026-11-18-laptop.md   # append-only entries, one file per node per day
memory/<node>/<project>/…               # snapshot memory (rsync + provenance)
agentdiary.toml                          # node name, scan tier, memory source
```

- **Git-native** — no server, no cloud, no lock-in. The repo is yours (GitHub/Gitea/bare, anything).
- **Tool-agnostic** — any CLI agent can append; the DSH plugin ([dsh-agentdiary-plugin](https://www.npmjs.com/package/dsh-agentdiary-plugin)) writes the same format from DeepSeek Harness sessions.
- **Fast paths are offline** — `append` and `sync` are sub-second, no network needed; the optional report layer (P2) is the only place a model gets involved.
- **CI-grade contract** — `verify` checks the directory schema, file naming, and time ordering; wire it into any pipeline.

## Install

```sh
npm i -g @vicfei/agentdiary
```

## Quick start

```sh
mkdir my-diary && cd my-diary && git init
agentdiary init --node laptop
agentdiary append --task "fixed the parser" --did "read 3 files;patched src/parse.ts" --result "12/12 green" --artifact abc1234
agentdiary log 5
agentdiary verify
```

With a TTY, `append` asks interactively. Without one (agent windows scripting the CLI), flags only.

## Commands

| Command | What it does |
|---|---|
| `init` | establish the directory contract + `agentdiary.toml` (idempotent) |
| `append` | append today's entry (template, interactive with TTY; `scan` gate applies first) |
| `sync` | rsync a memory source into `memory/<node>/` with `_synced_at`/`_source`, commit + push (rebase retry ×3) |
| `scan [--strict]` | credential-shape scan over the diary; `exit 1` on hit — pre-commit friendly |
| `verify` | validate the contract (schema, naming, time order) — CI-friendly |
| `log [N]` / `today` | read back recent entries / today's file |

## Scan tiers

`off` (default) / `tier` (common credential shapes: AWS keys, PATs, npm tokens, private keys…) / `strict` (tier + high-entropy blobs). The default is `off` on purpose: a diary is a *record*, and its owner decides what may be recorded. Turn a tier on when the repo is shared.

## Name note

The unscoped `agentdiary` name is blocked by npm's typo-similarity rule — an unrelated `agent-diary` exists (conversation-log *analysis*, a different product in an adjacent space). This package ships scoped; the binary is plain `agentdiary`.

## Status

P0 (this release): the contract, append/sync/scan/verify/log, and the same entry format the DSH plugin writes. P1: adapters that discover entries from Claude Code / Codex session stores automatically. P2: `report daily/weekly` aggregation.

MIT.
