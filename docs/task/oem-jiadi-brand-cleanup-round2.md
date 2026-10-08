# OEM 定制：品牌清理第二轮（小写 lobsterai 遗漏修复）

## 任务背景

第一轮品牌替换只处理了大写 `LobsterAI`，遗漏了源码中硬编码的小写 `lobsterai` 字符串。本次修复用户可见的 30 处遗漏，内部 OpenClaw 标识符（lobsterai-server、sk-lobsterai-local 等）不动。

---

## 改动清单

### 1. 用户主目录路径（高优先级）

| 文件 | 行 | 改动 |
|------|-----|------|
| `src/main/coworkStore.ts` | 43 | `~/lobsterai/project` → `~/jiadi/project` |
| `src/main/coworkStore.ts` | 46 | `.lobsterai-tasks` → `.jiadi-tasks` |
| `src/main/main.ts` | 12042 | `~/lobsterai/project` → `~/jiadi/project` |
| `src/main/im/nimGateway.ts` | 106 | `~/.lobsterai` → `~/.jiadi` |

### 2. Deep Link 协议（高优先级）

| 文件 | 行 | 改动 |
|------|-----|------|
| `src/main/main.ts` | 4022/4026 | `setAsDefaultProtocolClient('lobsterai')` → `jiadi` |
| `src/main/main.ts` | 4110/12460 | `lobsterai://` 命令行解析 → `jiadi://` |

### 3. 用户下载/导出文件名（高优先级）

| 文件 | 行 | 改动 |
|------|-----|------|
| `src/renderer/components/cowork/ProposedPlanBlock.tsx` | 64 | `lobsterai-plan-*.md` → `jiadi-plan-*.md` |
| `src/main/main.ts` | 1487 | `lobsterai-logs-*.zip` → `jiadi-logs-*.zip` |
| `src/main/sessionDiagnostics/archive.ts` | 91/141 | `lobsterai-diagnostics-*.zip` → `jiadi-diagnostics-*.zip` |

### 4. 设置页/欢迎页外链（中优先级）

| 文件 | 行 | 改动 |
|------|-----|------|
| `src/renderer/components/Settings.tsx` | 958-961 | 邮件、用户手册、社区、服务条款 URL 替换 |
| `src/renderer/components/WelcomeDialog.tsx` | 5 | 服务条款 URL |
| `src/shared/platform/constants.ts` | 42/52/62/72/81/119/129 | 各 IM 平台配置指南 URL（暂替换为 `#`）|

### 5. i18n 中的 portal 链接（中优先级）

| 文件 | 改动 |
|------|------|
| `src/renderer/services/i18n.ts` | 额度用尽提示中的 portal/pricing URL |
| `src/main/i18n.ts` | 同上 |

### 6. 导出格式标识（低优先级）

| 文件 | 行 | 改动 |
|------|-----|------|
| `src/renderer/constants/app.ts` | 3 | `lobsterai.providers` → `jiadi.providers` |
| `src/renderer/constants/app.ts` | 4 | `lobsterai-APP` → `jiadi-APP` |

---

## 不改动

- `lobsterai-server` / `lobsterai-copilot`：OpenClaw provider ID
- `sk-lobsterai-local`：API key 占位符
- `lobsterai_image_generate` 等工具名：OpenClaw tool ID
- `lobsterai:` 会话前缀：OpenClaw 会话协议
- 所有 temp 目录前缀、数据迁移内部文件名

---

## 变更历史

| 日期 | 内容 |
|------|------|
| 2026-08-09 | 初版：修复第一轮遗漏的 30 处小写 lobsterai |
