# AGENTS.md — 工作区强制约定

> 本文件对本工作区内的所有 AI 代理（含 DSH / Claude Code / Cursor / Codex 等）**强制生效**。
> 与仓库内 `文件整理规范.md`（项目内文件落位）互补：本文件只管**盘符与临时文件**。

---

## 0. 最高优先级规则：C 盘只读不写

**禁止在 `C:\` 下创建、写入、追加任何文件或目录。**

完整规范见：`D:\AI-FILE-POLICY.md`（机器可读，含路径真值表与自检命令）

---

## 1. 路径真值表

| 用途 | 唯一允许位置 | 环境变量 |
| --- | --- | --- |
| 进程临时目录 | `D:\dsh-temp` | `TMP` / `TEMP` |
| DSH 主目录（会话/附件） | `D:\dsh-home` | `DSH_HOME` |
| 包管理器缓存 | `D:\dsh-cache\<tool>` | `npm_config_cache` / `PNPM_HOME` / `PIP_CACHE_DIR` |
| 本工作区 | `D:\Download\scholar-agent-main` | — |
| 临时脚本与产物 | 本工作区 `_scratch/` | — |

## 2. 行为规则

1. 需要临时目录时，用 `$env:TEMP` / `os.tmpdir()` / Python `tempfile`；**绝不硬编码** `C:\Users\...`。
2. 新建缓存、日志、会话、构建产物目录时，根路径必须来自环境变量或配置，**不得写死 C 盘**。
3. 写 PowerShell / Node / Python 脚本时，禁止出现字面量 `C:\` 路径（读取系统依赖除外）。
4. 发现某工具默认写 C 盘：先改环境变量改道；改不动才改源码，并在提交信息里记录原因。
5. 任务收尾时清理自己产生的临时文件。

## 3. 违规检测

```powershell
pwsh -File D:\dsh-tools\check-c-writes.ps1
```

该脚本检查：环境变量是否指向 D 盘、C 盘是否有 `dsh-*` 残留、已知缓存是否仍在 C 盘。
**退出码 0 = 通过。**

## 4. 背景

2026-09-20 审计：DSH 的 6 处临时目录创建全部经 `os.tmpdir()` 解析，在 Windows 上落到
`C:\Users\<用户>\AppData\Local\Temp`，累积 110 个目录 / **741.6 MB**。
治理方式为改环境变量（`TMP`/`TEMP`/`DSH_HOME` → D 盘），**未改任何源码**。
详见 `D:\AI-FILE-POLICY.md` §8。
