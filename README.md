# JIAWork · 嘉迪 AI 工作台

JIAWork 是面向嘉迪业务场景的桌面 AI 工作台，用来处理员工提供的表格、文档和工作记录，并保留任务过程与生成文件。应用基于 Electron、React 和 OpenClaw；嘉迪企业配置随应用打包，启动后直接进入中文工作台。

## 主要功能

| 功能 | 当前提供的能力 |
| --- | --- |
| 六个快捷任务 | 表格分析、文档编写、工作总结、库存核对、采购交期跟进、质量异常整理。快捷任务会选择对应专家和技能，并生成可补充的任务说明。 |
| 三位嘉迪预设专家 | 表格分析专家、文档专家、工作总结专家。每位专家有独立的系统提示词，用户在应用内修改过的提示词会保留。 |
| 文件与成果 | 处理本地文件，预览生成的文档、表格、图表、网页等成果；任务记录保存在本机。 |
| 设置 | 配置模型 API 地址和平台 Key，管理技能；企业版 IM 设置只展示企业微信。 |

库存、采购和质量任务以用户提供的文件和已确认口径为依据。当前工作台没有直连实时 CAC ERP、供应商或审批系统；涉及这些系统的数据需先导出或另行接入。

## 启动桌面应用

有安装包时，安装后直接打开 JIAWork。源码运行需要 Node.js `>=24.15.0 <25` 和 npm。在本仓库根目录首次执行：

```sh
npm ci
npm start
```

之后启动只需：

```sh
npm start
```

`npm start` 会准备 OpenClaw 运行时并打开 Electron 窗口；运行时已存在时会复用已有构建。开发服务器使用 `http://localhost:5175`，完整功能在 Electron 窗口中运行。

## 连接 JIAWork-Admin 模型平台

JIAWork 使用 **JIAWork-Admin 签发的平台 API Key** 请求模型。模型服务商提供的**上游 API Key** 只配置在管理平台的渠道里，不填入桌面应用。

1. 按 [JIAWork-Admin README](https://github.com/normastars/JIAWork-Admin) 启动管理平台。新安装时先在部署机器打开 `http://127.0.0.1:3001/`，登录 New API 后台创建上游渠道，填写服务商的 API 地址、Key 和可用模型。
2. 在 JIAWork-Admin 管理页选择渠道、设置允许的模型，并创建平台 API Key。
3. 打开 JIAWork 的「设置 → API 配置」，填写下表中的 API 地址和**平台签发的 Key**，保存后选择允许范围内的模型。
4. 在工作台发起一条简单任务；收到模型回复后，到 JIAWork-Admin 的「调用统计」检查这把 Key 的记录。

| App 与管理平台的位置 | JIAWork 中填写的 API 地址 |
| --- | --- |
| 同一台电脑 | `http://127.0.0.1:3000/v1` |
| 通过域名访问 | `https://你的域名/v1` |

App 会通过该 Key 获取可用模型。跨机器部署时，应填写管理平台可访问的域名；`127.0.0.1` 始终指向运行 App 的电脑。

调用链路：`JIAWork → 平台 Key 鉴权 → JIAWork-Admin → 上游渠道 → 模型服务商`。

## 嘉迪配置与提示词

- [企业配置](enterprise-configs/gardy/README.md)说明了首页快捷任务、员工侧界面、运行时扩展和数据兼容策略；默认值在 [manifest.json](enterprise-configs/gardy/manifest.json)。
- 三位专家的默认系统提示词分别位于 [表格分析](resources/gardy-prompts/spreadsheet-analyst.md)、[文档处理](resources/gardy-prompts/document-assistant.md)、[工作总结](resources/gardy-prompts/work-summary-assistant.md)。源文件使用英文指令，但要求专家向员工输出中文；修改源文件后需重新构建应用。
- 应用内自行修改的专家提示词不会被默认文件覆盖。正式 API Key、员工凭据和企业系统地址不要提交到仓库。

## 开发与打包

```sh
npm test                 # Vitest
npm run build            # Renderer 生产构建
npm run compile:electron # Electron 主进程与 preload 构建

npm run dist:mac         # macOS 安装包
npm run dist:win         # Windows 安装包
npm run dist:linux       # Linux 安装包
```

OpenClaw 是当前唯一的 Agent 运行时。应用会把模型、专家和技能配置同步给 OpenClaw；会话、设置和任务记录保存在本机。更多工程约定见 [AGENTS.md](AGENTS.md)。

## 项目目录

| 路径 | 内容 |
| --- | --- |
| `enterprise-configs/gardy/` | 嘉迪工作台的内置企业配置与六个快捷任务 |
| `resources/gardy-prompts/` | 三位预设专家的默认系统提示词 |
| `SKILLs/` | 随应用提供的技能 |
| `src/renderer/` | 工作台界面、设置和成果预览 |
| `src/main/` | Electron 主进程、数据存储与 OpenClaw 集成 |

本项目基于 [LobsterAI](https://github.com/netease-youdao/LobsterAI) 改造，沿用仓库中的 [MIT 许可证](LICENSE)。
