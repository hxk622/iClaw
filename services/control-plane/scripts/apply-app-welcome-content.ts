import { config } from '../src/config.ts';
import { PgPortalStore } from '../src/portal-store.ts';
import { buildPortalPublicConfig } from '../src/portal-runtime.ts';

type WelcomePresetInput = {
  appName: string;
  entryLabel: string;
  kolName: string;
  expertName: string;
  slogan: string;
  avatarUrl: string;
  backgroundImageUrl: string;
  primaryColor: string;
  description: string;
  expertiseAreas: string[];
  targetAudience: string;
  disclaimer: string;
  quickActions: Array<{
    label: string;
    prompt: string;
    iconKey: string;
  }>;
};

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function createLicaiclawWelcomePreset(baseUrl: string): WelcomePresetInput {
  return {
    appName: 'licaiclaw',
    entryLabel: '',
    kolName: '理财客',
    expertName: '我是一只会赚钱的小龙虾',
    slogan: '干活是我核心能力，理财是我唯一使命，安全是我的责任底线',
    avatarUrl: '/brand/favicon.png',
    backgroundImageUrl: '/brand/installer-hero.webp',
    primaryColor: '#C4975F',
    description: '理财客欢迎页内容已切换为品牌默认龙虾人格，后续界面会进一步极简化。',
    expertiseAreas: ['理财', '干活', '安全'],
    targetAudience: '需要财经执行与安全保障的用户。',
    disclaimer: '欢迎页内容已切换为品牌龙虾人格展示。',
    quickActions: [
      {
        label: '开始对话',
        prompt: '你好，介绍一下你能帮我做什么。',
        iconKey: 'MessageCircle',
      },
    ],
  };
}

function mergeWelcomeConfig(appConfig: Record<string, unknown>, preset: WelcomePresetInput): Record<string, unknown> {
  const nextConfig = JSON.parse(JSON.stringify(appConfig || {})) as Record<string, unknown>;
  const surfaces = asObject(nextConfig.surfaces);
  const welcome = asObject(surfaces.welcome);
  const welcomeConfig = asObject(welcome.config);

  nextConfig.surfaces = {
    ...surfaces,
    welcome: {
      ...welcome,
      enabled: true,
      config: {
        ...welcomeConfig,
        entry_label: preset.entryLabel,
        kol_name: preset.kolName,
        expert_name: preset.expertName,
        slogan: preset.slogan,
        avatar_url: preset.avatarUrl,
        background_image_url: preset.backgroundImageUrl,
        primary_color: preset.primaryColor,
        description: preset.description,
        expertise_areas: preset.expertiseAreas,
        target_audience: preset.targetAudience,
        disclaimer: preset.disclaimer,
        quick_actions: preset.quickActions.map((item) => ({
          label: item.label,
          prompt: item.prompt,
          icon_key: item.iconKey,
        })),
      },
    },
  };

  return nextConfig;
}

async function main() {
  const appName = asString(readArg('--app') || process.env.APP_NAME);
  const publicBaseUrl = asString(readArg('--base-url') || process.env.API_URL || process.env.VITE_AUTH_BASE_URL);
  if (!appName) {
    throw new Error('app name is required (--app or APP_NAME)');
  }
  if (!publicBaseUrl) {
    throw new Error('base url is required (--base-url or API_URL/VITE_AUTH_BASE_URL)');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const store = new PgPortalStore(config.databaseUrl);
  try {
    const detail = await store.getAppDetail(appName);
    if (!detail) {
      throw new Error(`portal app not found: ${appName}`);
    }

    const preset =
      appName === 'licaiclaw'
        ? createLicaiclawWelcomePreset(publicBaseUrl)
        : (() => {
            throw new Error(`unsupported welcome preset app: ${appName}`);
          })();

    const nextConfig = mergeWelcomeConfig(detail.app.config, preset);
    await store.upsertApp({
      appName: detail.app.appName,
      displayName: detail.app.displayName,
      description: detail.app.description,
      status: detail.app.status,
      defaultLocale: detail.app.defaultLocale,
      config: nextConfig,
    }, null);

    const refreshed = await store.getAppDetail(appName);
    if (!refreshed) {
      throw new Error(`portal app missing after save: ${appName}`);
    }
    const menuCatalog = await store.listMenus();
    const publicConfig = buildPortalPublicConfig(refreshed, { menuCatalog });
    const welcomeSurface = asObject(asObject(asObject(publicConfig.config).surfaces).welcome);
    const welcomeConfig = asObject(welcomeSurface.config);

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          appName,
          persistedWelcome: {
            enabled: welcomeSurface.enabled !== false,
            entryLabel: asString(welcomeConfig.entry_label || welcomeConfig.entryLabel),
            kolName: asString(welcomeConfig.kol_name || welcomeConfig.kolName),
            expertName: asString(welcomeConfig.expert_name || welcomeConfig.expertName),
            slogan: asString(welcomeConfig.slogan),
            avatarUrl: asString(welcomeConfig.avatar_url || welcomeConfig.avatarUrl),
            backgroundImageUrl: asString(welcomeConfig.background_image_url || welcomeConfig.backgroundImageUrl),
            description: asString(welcomeConfig.description),
            expertiseAreas: Array.isArray(welcomeConfig.expertise_areas) ? welcomeConfig.expertise_areas : [],
            targetAudience: asString(welcomeConfig.target_audience || welcomeConfig.targetAudience),
            disclaimer: asString(welcomeConfig.disclaimer),
            quickActionCount: Array.isArray(welcomeConfig.quick_actions) ? welcomeConfig.quick_actions.length : 0,
          },
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await store.close();
  }
}

await main();
