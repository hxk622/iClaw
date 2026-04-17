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
    packageName: '3000 积分',
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
      eyebrow_label: '轻量续航',
      highlight: '到账 3,000 积分',
      promo_text: '轻松补能，适合日常对话、试用和临时续航',
      feature_list: ['基础到账 3,000 积分', '适合轻中度日常使用', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_7000',
    packageName: '7000 积分',
    credits: 7000,
    bonusCredits: 0,
    amountCnyFen: 5990,
    sortOrder: 20,
    recommended: false,
    default: true,
    active: true,
    metadata: {
      description: '主力充值包，适合高频使用。',
      badge_label: '超值推荐',
      highlight: '到账 7,000 积分',
      feature_list: ['基础到账 7,000 积分', '更适合连续多轮对话与工具执行', '一次性充值，不会自动续费'],
    },
  },
  {
    packageId: 'topup_13000',
    packageName: '13000 积分',
    credits: 13000,
    bonusCredits: 0,
    amountCnyFen: 9990,
    sortOrder: 30,
    recommended: false,
    default: false,
    active: true,
    metadata: {
      description: '重度使用优选，适合长期储备。',
      badge_label: '',
      eyebrow_label: '长期储备',
      highlight: '到账 13,000 积分',
      promo_text: '单价更优，适合重度用户长期储备和使用',
      feature_list: ['基础到账 13,000 积分', '单价更优，适合重度用户长期使用', '一次性充值，不会自动续费'],
    },
  },
];
