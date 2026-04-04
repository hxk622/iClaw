export type RechargePackageCatalogRecord = {
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  sortOrder: number;
  recommended: boolean;
  default: boolean;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppRechargePackageBindingRecord = {
  appName: string;
  packageId: string;
  enabled: boolean;
  sortOrder: number;
  recommended: boolean;
  default: boolean;
  config: Record<string, unknown>;
};

export type ResolvedRechargePackageRecord = RechargePackageCatalogRecord & {
  sourceLayer: 'platform_catalog' | 'oem_binding';
  bindingConfig: Record<string, unknown>;
};

export type DefaultRechargePackageSeed = Omit<
  RechargePackageCatalogRecord,
  'createdAt' | 'updatedAt'
>;

export const DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS: DefaultRechargePackageSeed[] = [
  {
    packageId: 'topup_1000',
    packageName: '1000 龙虾币',
    credits: 1000,
    bonusCredits: 100,
    amountCnyFen: 1000,
    sortOrder: 10,
    recommended: false,
    default: false,
    active: true,
    metadata: {
      description: '轻量补充，适合临时续航。',
      badge_label: '入门',
      highlight: '实得 1,100 龙虾币',
      feature_list: ['基础到账 1,000 龙虾币', '额外赠送 100 龙虾币', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_3000',
    packageName: '3000 龙虾币',
    credits: 3000,
    bonusCredits: 400,
    amountCnyFen: 3000,
    sortOrder: 20,
    recommended: true,
    default: true,
    active: true,
    metadata: {
      description: '主力充值包，覆盖日常高频使用。',
      badge_label: '最常用',
      highlight: '实得 3,400 龙虾币',
      feature_list: ['基础到账 3,000 龙虾币', '额外赠送 400 龙虾币', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_5000',
    packageName: '5000 龙虾币',
    credits: 5000,
    bonusCredits: 800,
    amountCnyFen: 5000,
    sortOrder: 30,
    recommended: false,
    default: false,
    active: true,
    metadata: {
      description: '高频工作流补能，适合持续重度使用。',
      badge_label: '高配',
      highlight: '实得 5,800 龙虾币',
      feature_list: ['基础到账 5,000 龙虾币', '额外赠送 800 龙虾币', '一次性充值，不会自动续费'],
    },
  },
];
