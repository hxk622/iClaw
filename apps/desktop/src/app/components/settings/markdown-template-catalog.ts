import buySideAnalystContent from './templates/identity/role/buy-side-analyst.md?raw';
import founderStrategyContent from './templates/identity/role/founder-strategy.md?raw';
import familyOfficeContent from './templates/identity/role/family-office.md?raw';
import identityTechContent from './templates/identity/industry/tech.md?raw';
import identityConsumerContent from './templates/identity/industry/consumer.md?raw';
import identityIndustrialContent from './templates/identity/industry/industrial.md?raw';
import fundManagerContent from './templates/user-profile/role/fund-manager.md?raw';
import founderUserContent from './templates/user-profile/role/founder.md?raw';
import irStrategyContent from './templates/user-profile/role/ir-strategy.md?raw';
import techGrowthContent from './templates/user-profile/industry/tech-growth.md?raw';
import consumerBrandContent from './templates/user-profile/industry/consumer-brand.md?raw';
import industrialExportContent from './templates/user-profile/industry/industrial-export.md?raw';
import healthcareContent from './templates/user-profile/industry/healthcare.md?raw';
import committeeAnalystContent from './templates/soul/style/committee-analyst.md?raw';
import calmRiskContent from './templates/soul/style/calm-risk.md?raw';
import denseContent from './templates/soul/style/dense.md?raw';
import explainerContent from './templates/soul/style/explainer.md?raw';
import secondaryMarketContent from './templates/soul/scenario/secondary-market.md?raw';
import primaryDdContent from './templates/soul/scenario/primary-dd.md?raw';
import managementBriefContent from './templates/soul/scenario/management-brief.md?raw';

export type SettingsMarkdownTemplate = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export type SettingsMarkdownTemplateGroup = {
  id: string;
  label: string;
  templates: SettingsMarkdownTemplate[];
};

export const identityTemplateGroups: SettingsMarkdownTemplateGroup[] = [
  {
    id: 'role',
    label: '角色模板',
    templates: [
      {
        id: 'identity-buy-side-analyst',
        title: '买方研究搭档',
        description: '适合基金经理、研究总监、行业研究员协作场景。',
        content: buySideAnalystContent.trim(),
      },
      {
        id: 'identity-founder-strategy',
        title: '创始人战略参谋',
        description: '适合创始人、CEO、业务负责人做战略拆解。',
        content: founderStrategyContent.trim(),
      },
      {
        id: 'identity-family-office',
        title: '家办投顾助手',
        description: '适合家族办公室、财富管理、长期配置场景。',
        content: familyOfficeContent.trim(),
      },
    ],
  },
  {
    id: 'industry',
    label: '行业模板',
    templates: [
      {
        id: 'identity-tech',
        title: 'TMT / AI 行业',
        description: '强调技术路线、商业化节奏、竞争壁垒。',
        content: identityTechContent.trim(),
      },
      {
        id: 'identity-consumer',
        title: '消费零售',
        description: '强调品牌力、渠道效率、复购和利润弹性。',
        content: identityConsumerContent.trim(),
      },
      {
        id: 'identity-industrial',
        title: '制造出海',
        description: '强调产能、订单、供应链、海外扩张质量。',
        content: identityIndustrialContent.trim(),
      },
    ],
  },
];

export const userProfileTemplateGroups: SettingsMarkdownTemplateGroup[] = [
  {
    id: 'role',
    label: '角色模板',
    templates: [
      {
        id: 'user-fund-manager',
        title: '基金经理 / 研究员',
        description: '适合专业投资用户，偏好高信息密度和结论前置。',
        content: fundManagerContent.trim(),
      },
      {
        id: 'user-founder',
        title: '创始人 / CEO',
        description: '适合经营决策用户，关注增长、组织和优先级。',
        content: founderUserContent.trim(),
      },
      {
        id: 'user-ir-strategy',
        title: 'IR / 战略负责人',
        description: '适合对内对外表达都很重要的场景。',
        content: irStrategyContent.trim(),
      },
    ],
  },
  {
    id: 'industry',
    label: '行业模板',
    templates: [
      {
        id: 'user-tech-growth',
        title: '科技成长',
        description: '关注创新速度、渗透率、产品周期和估值。',
        content: techGrowthContent.trim(),
      },
      {
        id: 'user-consumer-brand',
        title: '消费品牌',
        description: '关注渠道、复购、品牌势能和盈利质量。',
        content: consumerBrandContent.trim(),
      },
      {
        id: 'user-industrial-export',
        title: '制造出海',
        description: '关注订单、产能、客户结构和海外风险。',
        content: industrialExportContent.trim(),
      },
      {
        id: 'user-healthcare',
        title: '医疗健康',
        description: '关注产品进展、监管、支付体系和商业化。',
        content: healthcareContent.trim(),
      },
    ],
  },
];

export const soulTemplateGroups: SettingsMarkdownTemplateGroup[] = [
  {
    id: 'style',
    label: '风格模板',
    templates: [
      {
        id: 'soul-committee-analyst',
        title: '投委会分析型',
        description: '适合专业投资与高质量讨论场景。',
        content: committeeAnalystContent.trim(),
      },
      {
        id: 'soul-calm-risk',
        title: '冷静风控型',
        description: '适合高风险决策与保守风格用户。',
        content: calmRiskContent.trim(),
      },
      {
        id: 'soul-dense',
        title: '高信息密度型',
        description: '适合熟练用户，需要快节奏高压缩输出。',
        content: denseContent.trim(),
      },
      {
        id: 'soul-explainer',
        title: '陪伴解释型',
        description: '适合非专业用户或需要逐步理解的场景。',
        content: explainerContent.trim(),
      },
    ],
  },
  {
    id: 'scenario',
    label: '场景模板',
    templates: [
      {
        id: 'soul-secondary-market',
        title: '二级投资决策',
        description: '适合研究、跟踪、交易讨论。',
        content: secondaryMarketContent.trim(),
      },
      {
        id: 'soul-primary-dd',
        title: '一级尽调评估',
        description: '适合项目评估、赛道判断、投委材料。',
        content: primaryDdContent.trim(),
      },
      {
        id: 'soul-management-brief',
        title: '管理层简报',
        description: '适合 CEO/CXO 快速阅读场景。',
        content: managementBriefContent.trim(),
      },
    ],
  },
];
