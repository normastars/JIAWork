# OEM 定制：IM 平台显示过滤

## 任务背景

嘉迪 OEM 版本只需要对内部用户开放以下 6 个 IM 平台：
- 微信（weixin）
- 企业微信（wecom）
- 钉钉（dingtalk）
- 飞书/Lark（feishu）
- QQ（qq）
- 邮件（email）

其余平台（Telegram、Discord、网易云信 NIM、网易小蜜蜂 netease-bee、POPO）暂不在 UI 中显示。

---

## 现状分析

### 平台列表来源

**文件：** `src/shared/platform/constants.ts`

DEFINITIONS 数组中共定义了 11 个平台，通过 `PlatformRegistry` 统一管理。

### 可见性控制入口

**文件：** `src/renderer/utils/regionFilter.ts`

```typescript
export const getVisibleIMPlatforms = (language: 'zh' | 'en'): readonly string[] => {
  if (language === 'zh') {
    return PlatformRegistry.platformsByRegion('china');  // china 区所有平台
  }
  return PlatformRegistry.platforms;  // 所有平台
};
```

当前逻辑：
- 中文语言 → 返回 china region 的 9 个平台（包含 nim、netease-bee、popo、email）
- 英文语言 → 返回全部 11 个平台（含 telegram、discord）

### UI 渲染位置

**文件：** `src/renderer/components/im/IMSettings.tsx` 第 1045 行

```typescript
const platforms = useMemo<Platform[]>(() => {
  return getVisibleIMPlatforms(language) as Platform[];
}, [language]);
```

平台列表完全由 `getVisibleIMPlatforms()` 决定，UI 层不做任何过滤。

---

## 改动方案

### 改动文件：`src/renderer/utils/regionFilter.ts`

在 `getVisibleIMPlatforms` 中加入 OEM 白名单，无论语言，只返回允许的 5 个平台。

**改动前：**
```typescript
export const getVisibleIMPlatforms = (language: 'zh' | 'en'): readonly string[] => {
  if (language === 'zh') {
    return PlatformRegistry.platformsByRegion('china');
  }
  return PlatformRegistry.platforms;
};
```

**改动后：**
```typescript
const OEM_ALLOWED_PLATFORMS = ['weixin', 'wecom', 'dingtalk', 'feishu', 'qq', 'email'] as const;

export const getVisibleIMPlatforms = (language: 'zh' | 'en'): readonly string[] => {
  if (language === 'zh') {
    return PlatformRegistry.platformsByRegion('china').filter(
      (p) => OEM_ALLOWED_PLATFORMS.includes(p as (typeof OEM_ALLOWED_PLATFORMS)[number])
    );
  }
  return PlatformRegistry.platforms.filter(
    (p) => OEM_ALLOWED_PLATFORMS.includes(p as (typeof OEM_ALLOWED_PLATFORMS)[number])
  );
};
```

### 为什么不改 DEFINITIONS 数组？

`DEFINITIONS` 在 shared 层，被 main 和 renderer 双端共用。修改它会影响：
- IM 配置的持久化 schema
- main 进程的 IM 网关初始化逻辑
- 数据迁移和兼容性

只改 UI 层的 `getVisibleIMPlatforms` 是最小侵入的方式：**后端逻辑不变，只是 UI 不展示**。未来如需恢复平台，删除白名单过滤即可。

---

## 影响范围

| 层 | 是否受影响 | 说明 |
|----|-----------|------|
| UI 展示 | 是 | 只显示 5 个平台入口 |
| 后端/main 进程 | 否 | IM 网关、配置 schema 不变 |
| 已有 IM 配置数据 | 否 | 仅过滤展示，不删除数据 |
| 国际化/i18n | 否 | 不涉及文案 |

---

## 验证步骤

1. `npm run electron:dev` 启动应用
2. 进入「设置 → IM 远程控制」
3. 确认左侧平台列表仅出现：微信、企业微信、钉钉、飞书、QQ
4. 切换语言到英文，确认同样只显示这 5 个平台

---

## 变更历史

| 日期 | 内容 |
|------|------|
| 2026-08-09 | 初版：通过 getVisibleIMPlatforms 白名单过滤，隐藏 5 个平台（Telegram、Discord、NIM、小蜜蜂、POPO），保留邮件 |
