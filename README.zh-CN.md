# agentdiary

**你的 agent 写日记——写在你自己的 git 仓里。**

你在多个窗口、多台机器上跑 Claude Code / Codex / OpenCode / zcode。活干得不错，但「谁在何时做了什么、结果如何」的记录散落在没人重读的聊天记录里。agentdiary 修的是记录，不是聊天：

```text
sessions/2026-11/2026-11-18-laptop.md   # 追加式；每节点每日一文件
memory/<node>/<project>/…               # 快照式（rsync + 溯源）
agentdiary.toml                          # 节点名 / 扫描档位 / memory 源
```

- **git 原生**——无服务器、无云、无锁定；仓是你的（GitHub/Gitea/本地 bare 均可）。
- **工具无关**——任意 CLI agent 都能追加；DSH 插件（[dsh-agentdiary-plugin](https://www.npmjs.com/package/dsh-agentdiary-plugin)）以同一格式从 DeepSeek Harness 会话落笔。
- **高频路径离线可用**—— `append` 与 `sync` 亚秒完成、无需联网；可选的报告层（P2）是唯一会用到模型的地方。
- **CI 级契约**—— `verify` 校验目录 schema、文件命名与时间序；可接进任何流水线。

## 安装

```sh
npm i -g @vicfei/agentdiary
```

## 快速开始

```sh
mkdir my-diary && cd my-diary && git init
agentdiary init --node laptop
agentdiary append --task "fixed the parser" --did "read 3 files;patched src/parse.ts" --result "12/12 green" --artifact abc1234
agentdiary log 5
agentdiary verify
```

有 TTY 时 `append` 交互补缺；无 TTY（agent 窗口脚本化调用）只认 flags。

## 命令

| 命令 | 作用 |
|---|---|
| `init` | 建立目录契约 + `agentdiary.toml`（幂等） |
| `append` | 追加当日条目（模板；有 TTY 交互补缺；先过 `scan` 门） |
| `sync` | 把 memory 源 rsync 进 `memory/<node>/`（带 `_synced_at`/`_source` 溯源），commit + push（rebase 重试 ×3） |
| `scan [--strict]` | 全日记凭据形态扫描；命中 `exit 1`——可装 pre-commit |
| `verify` | 校验契约（schema、命名、时间序）——CI 友好 |
| `log [N]` / `today` | 回读最近条目 / 今日文件 |

## 扫描档位

`off`（默认）/ `tier`（常见凭据形态：AWS key、PAT、npm token、私钥…）/ `strict`（tier + 高熵块）。默认 `off` 是有意的：日记是*记录*，记什么由主人决定；仓要共享时再开档。

## 状态

P0（本版）：目录契约 + append/sync/scan/verify/log，条目格式与 DSH 插件同一拼写。P1：适配器自动发现 Claude Code / Codex 会话存储。P2：`report daily/weekly` 聚合。

MIT.
