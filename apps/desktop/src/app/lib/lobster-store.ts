import type { AgentCatalogEntryData, IClawClient, UserAgentLibraryItemData } from '@iclaw/sdk';

export type LobsterStoreTab = 'shop' | 'my-lobster';
export type LobsterStoreCategory = AgentCatalogEntryData['category'];

export type LobsterAgent = AgentCatalogEntryData & {
  avatarSrc: string;
  categoryLabel: string;
  divisionSlug: string | null;
  divisionLabel: string | null;
  installed: boolean;
  installedAt: string | null;
};

export type LobsterAgentMetadataValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

const AVATAR_BY_SLUG: Record<string, string> = {
  'stock-expert':
    'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMGF2YXRhciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzgzMDgyOHww&ixlib=rb-4.1.0&q=80&w=1080',
  'summary-expert':
    'https://images.unsplash.com/photo-1615177393114-bd2917a4f74a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXRhJTIwc2NpZW50aXN0JTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3R8ZW58MXx8fHwxNzczODMwODMwfDA&ixlib=rb-4.1.0&q=80&w=1080',
  'mail-assistant':
    'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHdvbWFuJTIwcHJvZmVzc2lvbmFsJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczODE2NDUxfDA&ixlib=rb-4.1.0&q=80&w=1080',
  'wechat-writer':
    'https://images.unsplash.com/photo-1762968274962-20c12e6e8ecd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBleHBlcnQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzczODMwODMwfDA&ixlib=rb-4.1.0&q=80&w=1080',
  'x-content-operator':
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwY29uc3VsdGFudCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzM4MzA4Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  'cross-border-radar':
    'https://images.unsplash.com/photo-1579540830482-659e7518c895?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwYW5hbHlzdCUyMHByb2Zlc3Npb25hbCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzgzMDgyOXww&ixlib=rb-4.1.0&q=80&w=1080',
};

const CATEGORY_LABELS: Record<LobsterStoreCategory, string> = {
  finance: '金融研究',
  content: '内容与品牌',
  productivity: '协同管理',
  commerce: '商业增长',
  general: '专业助手',
};

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function semanticAvatarPalette(category: LobsterStoreCategory): {start: string; end: string; badge: string} {
  switch (category) {
    case 'finance':
      return {start: '#1f2937', end: '#8e7650', badge: '#d6c19a'};
    case 'content':
      return {start: '#7c2d12', end: '#d97706', badge: '#fde68a'};
    case 'productivity':
      return {start: '#0f172a', end: '#2563eb', badge: '#bfdbfe'};
    case 'commerce':
      return {start: '#14532d', end: '#0891b2', badge: '#a7f3d0'};
    default:
      return {start: '#1f2937', end: '#475569', badge: '#e2e8f0'};
  }
}

function semanticAvatarText(name: string): string {
  const compact = name.replace(/\s+/g, '');
  return compact.slice(0, compact.length >= 2 ? 2 : 1) || 'AI';
}

function buildSemanticAvatar(item: AgentCatalogEntryData): string {
  const emoji = readMetadataString(item.metadata, 'avatar_emoji');
  const divisionLabel = readMetadataString(item.metadata, 'agency_division_label') || CATEGORY_LABELS[item.category];
  const palette = semanticAvatarPalette(item.category);
  const displayText = emoji || semanticAvatarText(item.name);
  const badgeText = divisionLabel.slice(0, 4);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
      <defs>
        <linearGradient id="bg" x1="20" y1="18" x2="142" y2="144" gradientUnits="userSpaceOnUse">
          <stop stop-color="${palette.start}" />
          <stop offset="1" stop-color="${palette.end}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="40" fill="url(#bg)" />
      <circle cx="80" cy="72" r="38" fill="rgba(255,255,255,0.12)" />
      <text x="80" y="88" text-anchor="middle" font-size="${emoji ? 42 : 24}" font-family="Apple Color Emoji, Segoe UI Emoji, PingFang SC, sans-serif" fill="#ffffff">${displayText}</text>
      <rect x="24" y="116" width="112" height="24" rx="12" fill="rgba(255,255,255,0.14)" />
      <text x="80" y="132" text-anchor="middle" font-size="11" font-family="Inter, PingFang SC, sans-serif" fill="${palette.badge}">${badgeText}</text>
    </svg>
  `;

  return encodeSvg(svg);
}

function resolveAvatar(item: AgentCatalogEntryData): string {
  return (
    readMetadataString(item.metadata, 'avatar_url') ||
    AVATAR_BY_SLUG[item.slug] ||
    buildSemanticAvatar(item) ||
    AVATAR_BY_SLUG['summary-expert']
  );
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
      avatarSrc: resolveAvatar(item),
      categoryLabel: CATEGORY_LABELS[item.category] || CATEGORY_LABELS.general,
      divisionSlug: readMetadataString(item.metadata, 'agency_division'),
      divisionLabel: readMetadataString(item.metadata, 'agency_division_label'),
      installed: Boolean(installed),
      installedAt: installed?.installed_at || null,
    };
  });
}

export function resolveLobsterAgentSurface(agent: Pick<AgentCatalogEntryData, 'metadata'>): string {
  return readMetadataString(agent.metadata, 'surface') || 'lobster-store';
}

export function isInvestmentExpertAgent(agent: Pick<AgentCatalogEntryData, 'metadata'>): boolean {
  const surface = resolveLobsterAgentSurface(agent);
  return surface === 'investment-experts' || surface === 'both';
}

export function isLobsterStoreAgent(agent: Pick<AgentCatalogEntryData, 'metadata'>): boolean {
  const surface = resolveLobsterAgentSurface(agent);
  return surface === 'lobster-store' || surface === 'both';
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

export function buildLobsterConversationPrompt(agent: LobsterAgent): string {
  const capabilityLines = agent.capabilities.slice(0, 3).map((item) => `- ${item}`).join('\n');
  const useCaseLines = agent.use_cases.slice(0, 3).map((item) => `- ${item}`).join('\n');

  return `请以「${agent.name}」的工作模式与我协作。

角色定位：${agent.description}

你当前应重点覆盖：
${capabilityLines}

适用场景参考：
${useCaseLines}

先用 3 行以内告诉我你能怎么帮我，然后等我给出具体任务。`;
}
