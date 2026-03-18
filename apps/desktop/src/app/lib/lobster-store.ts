import type { AgentCatalogEntryData, IClawClient, UserAgentLibraryItemData } from '@iclaw/sdk';

import crossBorderRadarAvatar from '@/app/assets/lobster-store/cross-border-radar.svg';
import mailAssistantAvatar from '@/app/assets/lobster-store/mail-assistant.svg';
import stockExpertAvatar from '@/app/assets/lobster-store/stock-expert.svg';
import summaryExpertAvatar from '@/app/assets/lobster-store/summary-expert.svg';
import wechatWriterAvatar from '@/app/assets/lobster-store/wechat-writer.svg';
import xContentOperatorAvatar from '@/app/assets/lobster-store/x-content-operator.svg';

export type LobsterStoreTab = 'shop' | 'my-lobster';
export type LobsterStoreCategory = AgentCatalogEntryData['category'];

export type LobsterAgent = AgentCatalogEntryData & {
  avatarSrc: string;
  categoryLabel: string;
  installed: boolean;
  installedAt: string | null;
};

const AVATAR_BY_SLUG: Record<string, string> = {
  'cross-border-radar': crossBorderRadarAvatar,
  'mail-assistant': mailAssistantAvatar,
  'stock-expert': stockExpertAvatar,
  'summary-expert': summaryExpertAvatar,
  'wechat-writer': wechatWriterAvatar,
  'x-content-operator': xContentOperatorAvatar,
};

const CATEGORY_LABELS: Record<LobsterStoreCategory, string> = {
  finance: '金融研究',
  content: '内容增长',
  productivity: '效率办公',
  commerce: '跨境电商',
  general: '通用助手',
};

function resolveAvatar(slug: string): string {
  return AVATAR_BY_SLUG[slug] || summaryExpertAvatar;
}

function toLibraryIndex(items: UserAgentLibraryItemData[]): Map<string, UserAgentLibraryItemData> {
  return new Map(items.map((item) => [item.slug, item]));
}

export function hydrateLobsterAgents(
  catalog: AgentCatalogEntryData[],
  library: UserAgentLibraryItemData[],
): LobsterAgent[] {
  const installedIndex = toLibraryIndex(library);
  return catalog.map((item) => {
    const installed = installedIndex.get(item.slug);
    return {
      ...item,
      avatarSrc: resolveAvatar(item.slug),
      categoryLabel: CATEGORY_LABELS[item.category] || CATEGORY_LABELS.general,
      installed: Boolean(installed),
      installedAt: installed?.installed_at || null,
    };
  });
}

export async function loadLobsterAgents(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<LobsterAgent[]> {
  const [catalog, library] = await Promise.all([
    input.client.listAgentsCatalog(),
    input.accessToken ? input.client.getAgentLibrary(input.accessToken).catch(() => []) : Promise.resolve([]),
  ]);
  return hydrateLobsterAgents(catalog, library);
}

export async function installLobsterAgent(input: {
  client: IClawClient;
  accessToken: string;
  slug: string;
}): Promise<UserAgentLibraryItemData> {
  return input.client.installAgent(input.accessToken, input.slug);
}

export async function uninstallLobsterAgent(input: {
  client: IClawClient;
  accessToken: string;
  slug: string;
}): Promise<{ removed: boolean }> {
  return input.client.removeAgentFromLibrary(input.accessToken, input.slug);
}
