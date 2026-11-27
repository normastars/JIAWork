import gardyManifest from '../../../enterprise-configs/gardy/manifest.json';
import type { EnterpriseManifest } from './enterpriseConfigSync';

const bundledManifest = gardyManifest as EnterpriseManifest;

export function getGardyEnterpriseConfig(override?: Partial<EnterpriseManifest> | null): EnterpriseManifest {
  return {
    ...bundledManifest,
    ...override,
    ui: { ...bundledManifest.ui, ...override?.ui },
    workbench: override?.workbench ?? bundledManifest.workbench,
  };
}
