import { PlatformRegistry } from '@shared/platform';
import type { Platform } from '@shared/platform';

const OEM_ALLOWED_PLATFORMS: readonly Platform[] = ['weixin', 'wecom', 'dingtalk', 'feishu', 'qq', 'email'];

export const getVisibleIMPlatforms = (_language: 'zh' | 'en'): readonly string[] => {
  return PlatformRegistry.platforms.filter((p) =>
    OEM_ALLOWED_PLATFORMS.includes(p as Platform)
  );
};
