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
  'stock-expert': '/agent-avatars/pexels/portrait-16.jpg',
  'summary-expert': '/agent-avatars/pexels/portrait-01.jpg',
  'mail-assistant': '/agent-avatars/pexels/portrait-02.jpg',
  'wechat-writer': '/agent-avatars/pexels/portrait-05.jpg',
  'x-content-operator': '/agent-avatars/pexels/portrait-11.jpg',
  'cross-border-radar': '/agent-avatars/pexels/portrait-07.jpg',
};

const PORTRAIT_AVATAR_POOL = [
  '/agent-avatars/pexels/portrait-01.jpg',
  '/agent-avatars/pexels/portrait-02.jpg',
  '/agent-avatars/pexels/portrait-03.jpg',
  '/agent-avatars/pexels/portrait-04.jpg',
  '/agent-avatars/pexels/portrait-05.jpg',
  '/agent-avatars/pexels/portrait-06.jpg',
  '/agent-avatars/pexels/portrait-07.jpg',
  '/agent-avatars/pexels/portrait-08.jpg',
  '/agent-avatars/pexels/portrait-09.jpg',
  '/agent-avatars/pexels/portrait-10.jpg',
  '/agent-avatars/pexels/portrait-11.jpg',
  '/agent-avatars/pexels/portrait-12.jpg',
  '/agent-avatars/pexels/portrait-13.jpg',
  '/agent-avatars/pexels/portrait-14.jpg',
  '/agent-avatars/pexels/portrait-15.jpg',
  '/agent-avatars/pexels/portrait-16.jpg',
] as const;

const PORTRAIT_PROFILES = [
  {src: '/agent-avatars/pexels/portrait-01.jpg', roles: ['formal', 'advisor', 'finance']},
  {src: '/agent-avatars/pexels/portrait-02.jpg', roles: ['operator', 'advisor', 'support']},
  {src: '/agent-avatars/pexels/portrait-03.jpg', roles: ['creative', 'commerce', 'brand']},
  {src: '/agent-avatars/pexels/portrait-04.jpg', roles: ['finance', 'advisor', 'formal']},
  {src: '/agent-avatars/pexels/portrait-05.jpg', roles: ['commerce', 'operator', 'product']},
  {src: '/agent-avatars/pexels/portrait-06.jpg', roles: ['support', 'operator', 'creative']},
  {src: '/agent-avatars/pexels/portrait-07.jpg', roles: ['formal', 'finance', 'leadership']},
  {src: '/agent-avatars/pexels/portrait-08.jpg', roles: ['operator', 'technical', 'product']},
  {src: '/agent-avatars/pexels/portrait-09.jpg', roles: ['formal', 'leadership', 'commerce']},
  {src: '/agent-avatars/pexels/portrait-10.jpg', roles: ['technical', 'finance', 'operator']},
  {src: '/agent-avatars/pexels/portrait-11.jpg', roles: ['senior', 'formal', 'advisor']},
  {src: '/agent-avatars/pexels/portrait-12.jpg', roles: ['advisor', 'creative', 'general']},
  {src: '/agent-avatars/pexels/portrait-13.jpg', roles: ['commerce', 'creative', 'brand']},
  {src: '/agent-avatars/pexels/portrait-14.jpg', roles: ['general', 'operator', 'support']},
  {src: '/agent-avatars/pexels/portrait-15.jpg', roles: ['leadership', 'technical', 'finance']},
  {src: '/agent-avatars/pexels/portrait-16.jpg', roles: ['formal', 'finance', 'leadership']},
] as const;

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

function readAvatarSignalText(item: AgentCatalogEntryData): string {
  const description = String(item.description || '').trim();
  const division = readMetadataString(item.metadata, 'agency_division') || '';
  const divisionLabel = readMetadataString(item.metadata, 'agency_division_label') || '';
  return [
    item.slug,
    item.name,
    description,
    item.category,
    division,
    divisionLabel,
    ...(item.tags || []),
  ]
    .join(' ')
    .toLowerCase();
}

function inferPortraitRoles(item: AgentCatalogEntryData): string[] {
  const text = readAvatarSignalText(item);
  const roles = new Set<string>();

  if (
    /(finance|stock|invest|trading|risk|quant|research|analyst|market|portfolio|compliance|legal|wealth|fund|证券|股票|金融|投资|交易|风控|量化|研究|分析|基金|财富|法务|合规)/.test(
      text,
    )
  ) {
    roles.add('finance');
    roles.add('formal');
  }

  if (/(engineering|backend|frontend|fullstack|devops|security|database|data|ai | ai$|ml|cloud|sre|architect|code|开发|工程|架构|数据|安全|后端|前端|云|数据库|算法)/.test(text)) {
    roles.add('technical');
  }

  if (/(marketing|brand|content|copy|social|media|growth|design|visual|ux|ui|creative|story|营销|品牌|内容|增长|设计|视觉|文案|社媒|叙事)/.test(text)) {
    roles.add('creative');
    roles.add('brand');
  }

  if (/(sales|business development|commerce|customer|support|assistant|operation|ops|project|product|manager|销售|商务|客服|支持|助理|运营|项目|产品|管理)/.test(text)) {
    roles.add('operator');
  }

  if (/(anthropology|history|geography|psychology|academic|teacher|researcher|historian|advisor|学家|研究员|顾问|学术|心理)/.test(text)) {
    roles.add('advisor');
  }

  if (/(lead|leader|executive|ceo|founder|strategy|director|高管|总监|负责人|策略|领导)/.test(text)) {
    roles.add('leadership');
    roles.add('formal');
  }

  if (/(senior|资深|专家|顾问)/.test(text)) {
    roles.add('senior');
  }

  if (/(support|assistant|helper|customer|客服|支持|助理)/.test(text)) {
    roles.add('support');
  }

  if (/(product|project|manager|coordination|协同|项目|产品|管理)/.test(text)) {
    roles.add('product');
  }

  if (/(commerce|sales|growth|marketing|business|商业|增长|营销|销售)/.test(text)) {
    roles.add('commerce');
  }

  if (roles.size === 0) {
    if (item.category === 'finance') {
      roles.add('finance');
      roles.add('formal');
    } else if (item.category === 'content') {
      roles.add('creative');
    } else if (item.category === 'productivity') {
      roles.add('operator');
    } else if (item.category === 'commerce') {
      roles.add('commerce');
    } else {
      roles.add('general');
    }
  }

  return [...roles];
}

function pickPortraitAvatar(item: AgentCatalogEntryData): string {
  const roles = inferPortraitRoles(item);
  const candidates = PORTRAIT_PROFILES.filter((profile) => profile.roles.some((role) => roles.includes(role))).map((profile) => profile.src);
  const pool = candidates.length ? candidates : [...PORTRAIT_AVATAR_POOL];
  return pool[hashString(`${item.slug}:${item.name}:${roles.join('|')}`) % pool.length];
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
    pickPortraitAvatar(item) ||
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
