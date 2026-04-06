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
    packageId: 'topup_3000',
    packageName: '3000 龙虾币',
    credits: 3000,
    bonusCredits: 0,
    amountCnyFen: 2990,
    sortOrder: 10,
    recommended: false,
    default: false,
    active: true,
    metadata: {
      description: '轻量补充，适合日常续航。',
      badge_label: '',
      highlight: '到账 3,000 龙虾币',
      feature_list: ['基础到账 3,000 龙虾币', '适合轻中度日常使用', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_7000',
    packageName: '7000 龙虾币',
    credits: 7000,
    bonusCredits: 0,
    amountCnyFen: 5990,
    sortOrder: 20,
    recommended: true,
    default: true,
    active: true,
    metadata: {
      description: '主力充值包，适合高频使用。',
      badge_label: '推荐',
      highlight: '到账 7,000 龙虾币',
      feature_list: ['基础到账 7,000 龙虾币', '更适合连续多轮对话与工具执行', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_13000',
    packageName: '13000 龙虾币',
    credits: 13000,
    bonusCredits: 0,
    amountCnyFen: 9990,
    sortOrder: 30,
    recommended: false,
    default: false,
    active: true,
    metadata: {
      description: '重度使用优选，适合长期储备。',
      badge_label: '最划算',
      highlight: '到账 13,000 龙虾币',
      feature_list: ['基础到账 13,000 龙虾币', '单价更优，适合重度用户囤币', '一次性充值，不会自动续费'],
    },
  },
];
