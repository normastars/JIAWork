# OEM 定制：屏蔽登录模块

## 任务背景

嘉迪 OEM 版本暂不需要登录，直接进入主界面使用，相关登录限制一并解除。

---

## 现状分析

### 登录门禁

**文件：** `src/renderer/App.tsx` 第 1352 行

```tsx
if (privacyAgreed === false) {
  return <WelcomeDialog ... />;  // 显示登录界面
}
return <主应用 />;
```

`privacyAgreed` 来自 SQLite KV 存储，首次启动为 `false`，登录成功后设为 `true`。

### 功能级限制点

以下功能通过 `state.auth.isLoggedIn` 做限制：

| 功能 | 文件 | 行号 |
|------|------|------|
| 语音输入按钮禁用 | `VoiceInputButton.tsx` | 27-30 |
| 模型访问弹窗 | `ModelSelector.tsx` | 119-122 |
| Artifact 共享/部署 | `artifactSubscriptionGate.ts` | 67-92 |
| 侧栏每日签到 | `SidebarExperienceSlot.tsx` | 97-100 |

### LoginButton 组件

`src/renderer/components/LoginButton.tsx`：顶部/侧栏的登录入口按钮，未登录时显示"登录"，登录后显示头像菜单。

---

## 改动方案

### 策略：在 Redux 初始状态注入已登录态

不修改 App.tsx 的门禁逻辑，而是让 `authSlice` 的初始状态直接为"已登录"状态，同时让 `privacyAgreed` 默认为 `true`，绕过首次启动门禁。

具体两处改动：

#### 改动 1：`src/renderer/store/slices/authSlice.ts`

两处修改：

**① 初始状态**：`isLoggedIn` 改为 `true`，`sessionStatus` 改为 `Authenticated`，`isLoading` 改为 `false`。

**② 注销/过期相关 reducers**：`setLoggedOut`、`setAuthExpired`、`setAuthTemporarilyUnavailable` 均不再修改 `isLoggedIn`，保持永久已登录态。

> 原因：`authService.init()` 在启动时会调用 `refreshAuthState({ clearOnFailure: true })`，无 token 时会 dispatch `setLoggedOut()` 将 `isLoggedIn` 重置为 `false`。仅改初始状态不够，必须同时让这三个 reducer 成为 no-op（对 isLoggedIn 而言）。

#### 改动 2：`src/renderer/App.tsx`

让 `privacyAgreed` 检查永远不触发登录门禁。找到 `privacyAgreed === false` 的条件渲染，直接跳过（返回主应用）。

**改动前（约第 1352 行）：**
```tsx
if (privacyAgreed === false) {
  return (
    <WelcomeDialog ... />
  );
}
```

**改动后：**
```tsx
// OEM: 屏蔽登录门禁，直接进入主应用
if (false && privacyAgreed === false) {
  return (
    <WelcomeDialog ... />
  );
}
```

> 用 `false &&` 而非删除代码，保留原始结构，方便后续恢复。

#### 改动 3：`src/renderer/components/LoginButton.tsx`

LoginButton 在主界面顶部/侧栏展示登录状态。由于 `isLoggedIn` 已为 `true`，它会尝试显示用户头像菜单，但 `user` 为 null 可能有异常。需要将 LoginButton 的渲染直接返回 `null`（隐藏该按钮）。

---

## 不改动的部分

- `src/shared/auth/constants.ts`：类型定义，不动
- `src/main/main.ts` 中的 auth IPC handlers：不动（不影响运行）
- `src/renderer/services/auth.ts`：不动（init 会被调用但无副作用）
- `artifactSubscriptionGate.ts`：`isLoggedIn` 为 `true` 后自动解除，不需单独改

---

## 验证步骤

1. `npm run electron:dev` 启动
2. 确认启动后直接进入主界面，不出现 WelcomeDialog
3. 确认语音输入按钮可用（不灰显）
4. 确认顶部/侧栏不显示登录按钮
5. 确认 Artifact 共享/部署按钮不被登录拦截

---

## 变更历史

| 日期 | 内容 |
|------|------|
| 2026-08-09 | 初版：注入已登录初始态 + 绕过门禁条件 + 隐藏 LoginButton |
