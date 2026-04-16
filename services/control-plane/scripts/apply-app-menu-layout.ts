import { config } from '../src/config.ts';
import { PgPortalStore } from '../src/portal-store.ts';
import { buildPortalPublicConfig } from '../src/portal-runtime.ts';

type MenuLayoutItem = {
  menuKey: string;
  displayName: string;
  groupLabel: string;
};

const LICAICLAW_MENU_LAYOUT: MenuLayoutItem[] = [
  { menuKey: 'chat', displayName: '智能投资对话', groupLabel: '工作台' },
  { menuKey: 'investment-experts', displayName: '智能投资专家', groupLabel: '工作台' },
  { menuKey: 'finance-skills', displayName: '财经技能', groupLabel: '工作台' },
  { menuKey: 'foundation-skills', displayName: '基础技能', groupLabel: '工作台' },
  { menuKey: 'cron', displayName: '定时任务', groupLabel: '工作台' },
  { menuKey: 'knowledge-library', displayName: '知识库', groupLabel: '工作台' },
  { menuKey: 'stock-market', displayName: '股票市场', groupLabel: '市场' },
  { menuKey: 'fund-market', displayName: '基金市场', groupLabel: '市场' },
  { menuKey: 'data-connections', displayName: '财经MCP', groupLabel: '通用' },
  { menuKey: 'im-bots', displayName: 'IM机器人', groupLabel: '通用' },
  { menuKey: 'memory', displayName: '记忆管理', groupLabel: '通用' },
  { menuKey: 'security', displayName: '安全中心', groupLabel: '通用' },
];

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveMenuLayout(layoutName: string): MenuLayoutItem[] {
  const normalized = layoutName.trim().toLowerCase();
  if (!normalized || normalized === 'licaiclaw-default' || normalized === 'licaiclaw-left-nav') {
    return LICAICLAW_MENU_LAYOUT;
  }
  throw new Error(`unsupported layout preset: ${layoutName}`);
}

function assertMenuLayout(detailMenus: Array<{ menuKey: string; sortOrder: number; config: Record<string, unknown> }>, expected: MenuLayoutItem[]) {
  const normalized = detailMenus
    .filter((item) => item.menuKey)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'))
    .map((item) => ({
      menuKey: item.menuKey,
      displayName: asString(item.config.display_name || item.config.displayName),
      groupLabel: asString(item.config.group_label || item.config.groupLabel || item.config.group),
    }));

  const expectedNormalized = expected.map((item) => ({
    menuKey: item.menuKey,
    displayName: item.displayName,
    groupLabel: item.groupLabel,
  }));

  const actualJson = JSON.stringify(normalized);
  const expectedJson = JSON.stringify(expectedNormalized);
  if (actualJson !== expectedJson) {
    throw new Error(`persisted menu bindings mismatch\nexpected=${expectedJson}\nactual=${actualJson}`);
  }
}

async function main() {
  const appName = asString(readArg('--app') || process.env.APP_NAME);
  const layoutName = asString(readArg('--layout') || 'licaiclaw-left-nav');

  if (!appName) {
    throw new Error('app name is required (--app or APP_NAME)');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const layout = resolveMenuLayout(layoutName);
  const store = new PgPortalStore(config.databaseUrl);
  try {
    const bindingsInput = layout.map((item, index) => ({
      menuKey: item.menuKey,
      enabled: true,
      sortOrder: (index + 1) * 10,
      config: {
        display_name: item.displayName,
        group_label: item.groupLabel,
      },
    }));

    await store.replaceAppMenuBindings(appName, bindingsInput, null);

    const detail = await store.getAppDetail(appName);
    if (!detail) {
      throw new Error(`portal app not found after update: ${appName}`);
    }

    assertMenuLayout(
      detail.menuBindings.map((item) => ({
        menuKey: item.menuKey,
        sortOrder: item.sortOrder,
        config: item.config,
      })),
      layout,
    );

    const menuCatalog = await store.listMenus();
    const publicConfig = buildPortalPublicConfig(detail, {
      menuCatalog,
    });
    const runtimeBindings = Array.isArray(publicConfig.config.menu_bindings)
      ? publicConfig.config.menu_bindings
      : [];
    const runtimeCatalog = Array.isArray(publicConfig.config.menu_catalog)
      ? publicConfig.config.menu_catalog
      : [];

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          appName,
          layout: layoutName,
          persistedMenuBindings: detail.menuBindings.map((item) => ({
            menuKey: item.menuKey,
            enabled: item.enabled,
            sortOrder: item.sortOrder,
            displayName: asString(item.config.display_name || item.config.displayName),
            groupLabel: asString(item.config.group_label || item.config.groupLabel || item.config.group),
          })),
          runtimeMenuBindings: runtimeBindings.map((item) => {
            const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            return {
              menuKey: asString(entry.menu_key || entry.menuKey),
              sortOrder: Number(entry.sort_order || entry.sortOrder || 0),
              displayName: asString((entry.config as Record<string, unknown> | undefined)?.display_name),
              groupLabel: asString((entry.config as Record<string, unknown> | undefined)?.group_label),
            };
          }),
          runtimeMenuCatalog: runtimeCatalog.map((item) => {
            const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            const metadata = entry.metadata && typeof entry.metadata === 'object' ? (entry.metadata as Record<string, unknown>) : {};
            return {
              menuKey: asString(entry.menu_key || entry.menuKey),
              displayName: asString(entry.display_name || entry.displayName),
              groupLabel: asString(metadata.group_label || metadata.groupLabel || metadata.group),
            };
          }),
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
