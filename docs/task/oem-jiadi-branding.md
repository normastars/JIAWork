# OEM 定制：嘉迪（JiaDi）品牌替换

## 任务背景

在 `featrue/oem_jiadi` 分支上对 LobsterAI 进行品牌定制，将产品重命名为 JiaDi（英文）/ 嘉迪（中文），并替换产品 Logo。

---

## 改动范围

### 1. 产品名称替换

| 文件 | 字段 | 原值 | 新值 | 状态 |
|------|------|------|------|------|
| `package.json` | `name` | `lobsterai` | `jiadi` | ✅ 已完成 |
| `package.json` | `author.name` | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `electron-builder.json` | `productName` | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `electron-builder.json` | `executableName` | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `electron-builder.json` | `appId` | `com.lobsterai.app` | `com.jiadi.app` | ✅ 已完成 |
| `electron-builder.json` | `protocols[0].name` | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `electron-builder.json` | `protocols[0].schemes` | `lobsterai` | `jiadi` | ✅ 已完成 |
| `electron-builder.json` | `linux.desktop.Name` | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `electron-builder.json` | macOS 权限描述文案 | LobsterAI … | 嘉迪… | ✅ 已完成 |
| `src/main/appConstants.ts` | `APP_NAME` | `'LobsterAI'` | `'JiaDi'` | ✅ 已完成 |
| `src/main/appConstants.ts` | `APP_ID` | `'lobsterai'` | `'jiadi'` | ✅ 已完成 |
| `src/main/appConstants.ts` | `APP_USER_MODEL_ID` | `'com.lobsterai.app'` | `'com.jiadi.app'` | ✅ 已完成 |
| `src/main/appConstants.ts` | `DB_FILENAME` | `'lobsterai.sqlite'` | 暂不修改 | ⏭️ 跳过（用户决策） |
| `src/renderer/services/i18n.ts` | 所有 LobsterAI 文案（84处） | LobsterAI | JiaDi / 嘉迪 | ✅ 已完成 |
| `src/main/i18n.ts` | 所有 LobsterAI 文案（19处） | LobsterAI | JiaDi / 嘉迪 | ✅ 已完成 |
| `src/renderer/constants/app.ts` | `APP_NAME` / `APP_ID` | `LobsterAI` / `lobsterai` | `JiaDi` / `jiadi` | ✅ 已完成 |
| `src/renderer/components/Settings.tsx` | alt 属性 + 关于页标题 | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `src/renderer/components/WelcomeDialog.tsx` | img alt 属性 | `LobsterAI` | `JiaDi` | ✅ 已完成 |
| `src/renderer/components/cowork/EngineStartupOverlay.tsx` | img alt 属性 | `LobsterAI` | `JiaDi` | ✅ 已完成 |

### 2. Logo 替换

**素材来源**：用户提供 `/Users/yulibaozi/Downloads/JIAWork_logo_1024x1024.png`（1024×1024 RGBA PNG）

| 输出文件 | 用途 | 尺寸 | 状态 |
|----------|------|------|------|
| `public/logo.png` | UI 主 Logo（欢迎页、设置等） | 1024×1024 | ✅ 已完成 |
| `build/icons/png/{N}x{N}.png` | Linux 应用图标（9 个尺寸） | 16/24/32/48/64/128/256/512/1024 | ✅ 已完成 |
| `build/icons/mac/icon.icns` | macOS 应用图标 | 多尺寸 ICNS | ✅ 已完成 |
| `build/icons/win/icon.ico` | Windows 应用图标 | 多尺寸 ICO | ✅ 已完成 |
| `resources/tray/tray-icon.png` | Windows/Linux 托盘图标 | 48×48 | ✅ 已完成 |
| `resources/tray/tray-icon.ico` | Windows 托盘图标 | 16/32 ICO | ✅ 已完成 |
| `resources/tray/tray-icon-mac.png` | macOS 托盘图标 | 22×22 | ✅ 已完成 |
| `resources/tray/tray-icon-mac@2x.png` | macOS Retina 托盘图标 | 44×44 | ✅ 已完成 |

---

## 技术说明

### 图标生成工具链
- PNG 多尺寸缩放：macOS 系统内置 `sips`
- macOS .icns：`iconutil`（标准 iconset 流程）
- Windows .ico：Node.js 原生拼包（嵌入 PNG 的现代 ICO 格式，兼容 Windows Vista+）

### 名称替换策略
- `APP_NAME` 作为代码运行时的产品名来源，renderer 和 main 的 i18n 均引用字面量替换
- 中文界面统一使用"嘉迪"，英文界面统一使用"JiaDi"
- `appId` 变更为 `com.jiadi.app`，macOS 重新安装后视为新应用（userData 路径变更），已知影响，用户已知情
- `DB_FILENAME` 保持 `lobsterai.sqlite` 不变，避免存量数据丢失

### 不在本次范围内
- 数据库文件名迁移（用户决策跳过）
- 代码签名证书（需客户提供）
- 安装包定制（NSIS 安装界面文案）

---

## 验证步骤

1. `npm run compile:electron` — 确认 TypeScript 无报错
2. `npm run electron:dev` — 启动应用，检查窗口标题、托盘图标、关于页 Logo 是否正确
3. 打包验证：`npm run dist:mac` — 检查 .dmg 中的 app 名称和图标

---

## 变更历史

| 日期 | 内容 |
|------|------|
| 2026-08-09 | 初版：完成 Logo 替换 + 所有产品名称替换 |
