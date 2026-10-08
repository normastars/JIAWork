# OEM 定制：套餐模型弹窗跳转改为 DeepSeek

## 任务背景

当用户点击需要订阅的服务端模型时，会弹出"套餐模型"提示框，按钮原本跳转到有道 Portal 订阅页。OEM 版本无有道账号体系，改为跳转 DeepSeek 平台（供用户获取 API Key 自行配置）。

---

## 现状分析

### 弹窗组件

**文件：** `src/renderer/components/ModelSelector.tsx`，第 86 行 `ModelAccessPromptModal`

- `Subscribe` 类型弹窗：标题 `modelSelectorSubscribeTitle`，描述 `modelSelectorSubscribeDesc`，按钮调用 `openSubscriptionPage()`
- `openSubscriptionPage()` 调用 `getPortalPricingUrl()` → `https://lobsterai.youdao.com/portal#/pricing`

### URL 来源

**文件：** `src/renderer/services/endpoints.ts`，第 43/55 行

```typescript
const PORTAL_BASE_PROD = 'https://lobsterai.youdao.com/portal#';
export const getPortalPricingUrl = () => `${getPortalBase()}/pricing...`
```

---

## 改动方案

### 改动 1：`src/renderer/services/endpoints.ts`

新增 DeepSeek 平台 URL 常量，供弹窗跳转使用。

```typescript
export const DEEPSEEK_PLATFORM_URL = 'https://platform.deepseek.com';
```

### 改动 2：`src/renderer/components/ModelSelector.tsx`

`openSubscriptionPage` 中，把 `getPortalPricingUrl()` 替换为 `DEEPSEEK_PLATFORM_URL`：

**改动前：**
```typescript
const openSubscriptionPage = async () => {
  onClose();
  const { getPortalPricingUrl } = await import('../services/endpoints');
  await window.electron.shell.openExternal(getPortalPricingUrl());
};
```

**改动后：**
```typescript
const openSubscriptionPage = async () => {
  onClose();
  const { DEEPSEEK_PLATFORM_URL } = await import('../services/endpoints');
  await window.electron.shell.openExternal(DEEPSEEK_PLATFORM_URL);
};
```

### 改动 3：i18n 文案（`src/renderer/services/i18n.ts`）

将 Subscribe 弹窗的描述文案从"订阅套餐/购买加油包"改为引导用户配置 DeepSeek API Key：

| key | zh（原） | zh（新） | en（原） | en（新） |
|-----|---------|---------|---------|---------|
| `modelSelectorSubscribeTitle` | 套餐模型 | 配置模型 | Plan Models | Configure Model |
| `modelSelectorSubscribeDesc` | 订阅套餐或购买加油包后即可使用更多模型 | 前往 DeepSeek 获取 API Key，在设置中配置后即可使用 | Subscribe... | Get an API Key from DeepSeek and configure it in Settings to use this model |
| `modelSelectorSubscribeBtn` | 去订阅 | 前往 DeepSeek | Go to subscribe | Go to DeepSeek |

---

## 影响范围

- 仅影响 `Subscribe` 类型弹窗的跳转目标和文案
- `Login` 类型弹窗不受影响（已通过登录屏蔽不会出现）
- `AgenticNotReady` 类型弹窗不受影响

---

## 验证步骤

1. 启动应用，在模型选择器里点击一个标注了"套餐"的服务端模型
2. 确认弹窗标题/描述文案已更新
3. 点击主按钮，确认浏览器打开 `https://platform.deepseek.com`

---

## 变更历史

| 日期 | 内容 |
|------|------|
| 2026-08-09 | 初版：Subscribe 弹窗跳转改为 DeepSeek，文案更新 |
