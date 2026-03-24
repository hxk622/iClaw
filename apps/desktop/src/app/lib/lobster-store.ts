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

function avatarPalette(category: LobsterStoreCategory): {
  start: string;
  end: string;
  jacket: string;
  shirt: string;
  accent: string;
} {
  switch (category) {
    case 'finance':
      return {start: '#111827', end: '#8e7650', jacket: '#1f2937', shirt: '#f7f2e8', accent: '#cfb07a'};
    case 'content':
      return {start: '#7c2d12', end: '#d97706', jacket: '#7c2d12', shirt: '#fff3e8', accent: '#f2c078'};
    case 'productivity':
      return {start: '#0f172a', end: '#2563eb', jacket: '#1d3557', shirt: '#eef4ff', accent: '#8fb3e8'};
    case 'commerce':
      return {start: '#14532d', end: '#0891b2', jacket: '#14532d', shirt: '#edfdf6', accent: '#8fd0b2'};
    default:
      return {start: '#1f2937', end: '#475569', jacket: '#334155', shirt: '#f8fafc', accent: '#cfd7e3'};
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function pickByHash<T>(seed: number, values: T[]): T {
  return values[seed % values.length];
}

function buildPortraitAvatar(item: AgentCatalogEntryData): string {
  const seed = hashString(`${item.slug}:${item.name}`);
  const palette = avatarPalette(item.category);
  const skin = pickByHash(seed, ['#F4C7A1', '#E6B18E', '#D99A73', '#C7865F', '#B8734E']);
  const hair = pickByHash(seed >> 1, ['#1F2937', '#312E2B', '#5B4636', '#6B4F3A', '#8A5A44']);
  const hairStyle = seed % 4;
  const jacketTone = pickByHash(seed >> 2, [palette.jacket, '#2B3445', '#5A4630', '#31473B', '#4A5568']);
  const shirtTone = pickByHash(seed >> 3, [palette.shirt, '#FFF8F1', '#EEF2F7']);
  const accentTone = pickByHash(seed >> 4, [palette.accent, '#D6C19A', '#A5B8D8', '#8DBFA7']);
  const faceX = 80 + ((seed % 5) - 2);
  const faceY = 66 + (((seed >> 3) % 5) - 2);
  const eyeY = faceY + 4;
  const mouthY = faceY + 18;

  const hairMarkup = [
    `<path d="M42 64C42 39 58 24 80 24C102 24 118 39 118 64C112 51 98 42 80 42C62 42 48 51 42 64Z" fill="${hair}" />`,
    `<path d="M44 70C44 37 61 21 82 21C101 21 118 36 118 67C111 57 101 52 91 51C83 50 75 45 67 46C56 47 48 56 44 70Z" fill="${hair}" />`,
    `<path d="M41 68C44 39 60 22 83 22C102 22 117 37 119 62C112 51 97 44 81 44C66 44 50 51 41 68Z" fill="${hair}" /><path d="M109 52C114 58 117 67 116 76C110 70 106 66 101 64Z" fill="${hair}" />`,
    `<path d="M43 66C45 38 64 23 85 23C101 23 115 35 118 53C111 47 101 45 94 45C86 45 80 39 71 39C58 39 48 48 43 66Z" fill="${hair}" />`,
  ][hairStyle];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
      <defs>
        <linearGradient id="bg" x1="20" y1="18" x2="142" y2="144" gradientUnits="userSpaceOnUse">
          <stop stop-color="${palette.start}" />
          <stop offset="1" stop-color="${palette.end}" />
        </linearGradient>
        <linearGradient id="coat" x1="48" y1="92" x2="116" y2="140" gradientUnits="userSpaceOnUse">
          <stop stop-color="${jacketTone}" />
          <stop offset="1" stop-color="${accentTone}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="40" fill="url(#bg)" />
      <circle cx="80" cy="80" r="54" fill="rgba(255,255,255,0.08)" />
      <path d="M34 142C36 116 53 100 80 100C107 100 124 116 126 142Z" fill="url(#coat)" />
      <path d="M62 102C66 114 73 122 80 122C87 122 94 114 98 102L88 97H72Z" fill="${shirtTone}" />
      <circle cx="${faceX}" cy="${faceY}" r="25" fill="${skin}" />
      ${hairMarkup}
      <circle cx="${faceX - 9}" cy="${eyeY}" r="2.4" fill="#2B2118" />
      <circle cx="${faceX + 9}" cy="${eyeY}" r="2.4" fill="#2B2118" />
      <path d="M${faceX - 8} ${mouthY}C${faceX - 3} ${mouthY + 6} ${faceX + 3} ${mouthY + 6} ${faceX + 8} ${mouthY}" stroke="#8A4F46" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="122" cy="122" r="11" fill="rgba(255,255,255,0.14)" />
      <circle cx="122" cy="122" r="4" fill="${accentTone}" />
    </svg>
  `;

  return encodeSvg(svg);
}

function resolveAvatar(item: AgentCatalogEntryData): string {
  return (
    readMetadataString(item.metadata, 'avatar_url') ||
    AVATAR_BY_SLUG[item.slug] ||
    buildPortraitAvatar(item) ||
    AVATAR_BY_SLUG['summary-expert']
  );
}

export function resolveLobsterAgentSourceRepo(agent: Pick<AgentCatalogEntryData, 'metadata'>): string | null {
  return readMetadataString(agent.metadata, 'source_repo');
}

export function resolveLobsterAgentSourceLabel(agent: Pick<AgentCatalogEntryData, 'metadata'>): string | null {
  const sourceRepo = resolveLobsterAgentSourceRepo(agent);
  if (!sourceRepo) {
    return null;
  }
  if (sourceRepo === 'msitarzewski/agency-agents') {
    return 'Agency Agents';
  }
  return sourceRepo;
}

export function isAgencyAgentsImported(agent: Pick<AgentCatalogEntryData, 'metadata'>): boolean {
  return resolveLobsterAgentSourceRepo(agent) === 'msitarzewski/agency-agents';
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
