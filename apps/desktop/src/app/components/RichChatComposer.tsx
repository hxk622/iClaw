import {
  AtSign,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Film,
  FileText,
  Globe,
  Image as ImageIcon,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Square,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from 'react';
import { ComposerModelLogo } from './ComposerModelLogo';
import { findComposerModelOption, type ComposerModelOption } from '../lib/model-catalog';
import type { ResolvedInputComposerConfig } from '../lib/oem-runtime';
import { Chip } from './ui/Chip';
import sendSwishAigeiUrl from '@/app/assets/send-sounds/send-swish-aigei.mp3';
import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';

export type OpenClawImageAttachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
};

export type ComposerSendPayload = {
  prompt: string;
  imageAttachments: OpenClawImageAttachment[];
  selectedAgentSlug: string | null;
  selectedAgentName: string | null;
  selectedAgentSystemPrompt: string | null;
  selectedSkillSlug: string | null;
  selectedSkillName: string | null;
  selectedMode: string | null;
  selectedModeLabel: string | null;
  selectedMarketScope: string | null;
  selectedMarketScopeLabel: string | null;
  selectedStockContext: ComposerStockContext | null;
  selectedStockContextLabel: string | null;
  selectedWatchlist: string | null;
  selectedWatchlistLabel: string | null;
  selectedOutput: string | null;
  selectedOutputLabel: string | null;
};

export type ComposerInstrumentKind = 'stock' | 'fund' | 'etf' | 'qdii';

export type ComposerInstrumentContext = {
  id: string;
  symbol: string;
  companyName: string;
  exchange: 'sh' | 'sz' | 'bj' | 'otc';
  board: string | null;
  instrumentKind?: ComposerInstrumentKind;
  instrumentLabel?: string | null;
};

export type ComposerStockContext = ComposerInstrumentContext;
export type ComposerStockOption = ComposerInstrumentContext;
export type ComposerInstrumentSearchPage = {
  items: ComposerStockOption[];
  hasMore: boolean;
  nextOffset: number | null;
};

export type ComposerDraftAttachment = {
  type: 'image' | 'pdf' | 'video' | 'file';
};

export type ComposerDraftPayload = {
  prompt: string;
  hasContent: boolean;
  attachments: ComposerDraftAttachment[];
};

type ComposerDraftSnapshot = {
  nodes: Node[];
  tokens: ComposerTokenMeta[];
  selectedAgentSlug: string | null;
  selectedSkillSlug: string | null;
  selectedMode: string | null;
  selectedMarketScope: string | null;
  selectedStockContext: ComposerStockContext | null;
  selectedWatchlist: string | null;
  selectedOutput: string | null;
  activeQuickQueryId: string | null;
};

export type RichChatComposerHandle = {
  focus: () => void;
  replacePrompt: (text: string) => void;
  addFiles: (files: File[]) => Promise<number>;
  insertReference: (
    text: string,
    options?: {
      label?: string;
      trailingText?: string;
    },
  ) => void;
};

export type ComposerSkillOption = {
  slug: string;
  name: string;
  market: string;
  skillType: string;
  categoryLabel: string;
};

export type ComposerAgentOption = {
  slug: string;
  name: string;
  avatarSrc: string;
  installed: boolean;
  systemPrompt?: string | null;
};

type ComposerStaticOption = {
  value: string;
  label: string;
  detail: string;
};

type RecentSelectionBucket = 'agents' | 'skills' | 'modes' | 'markets' | 'watchlists' | 'outputs';

type RecentSelectionState = Record<RecentSelectionBucket, string[]>;

type SelectorRecentMenuKey = 'expert' | 'skill' | 'mode' | 'market' | 'watchlist' | 'output';

type SelectorRecentView = 'recent' | 'all';

type SelectorRecentViewState = Record<SelectorRecentMenuKey, SelectorRecentView>;

type ComposerMenuSource = 'toolbar' | 'typing';

type ComposerFloatingMenuPosition = {
  left: number;
  top: number;
};

type ComposerInstrumentMenuKind = 'stock' | 'fund';

type ComposerTokenMeta = {
  id: string;
  kind: 'reference' | 'attachment' | 'agent' | 'stock';
  label: string;
  value: string;
  slug?: string;
  avatarSrc?: string;
  mimeType?: string;
  dataUrl?: string | null;
  stockContext?: ComposerStockContext | null;
};

type RichChatComposerProps = {
  authBaseUrl: string;
  connected: boolean;
  busy: boolean;
  sendDisabledReason?: string | null;
  sessionTransitioning?: boolean;
  queueWhileConnecting?: boolean;
  lobsterAgents: ComposerAgentOption[];
  skillOptions: ComposerSkillOption[];
  modelOptions: ComposerModelOption[];
  selectedModelId: string | null;
  modelsLoading: boolean;
  modelSwitching: boolean;
  onModelChange: (modelId: string) => Promise<void> | void;
  onAbort: () => Promise<void> | void;
  onSend: (payload: ComposerSendPayload) => Promise<boolean> | boolean;
  onDraftChange?: (payload: ComposerDraftPayload) => void;
  creditEstimate?: {
    loading: boolean;
    low: number | null;
    high: number | null;
    error?: string | null;
  } | null;
  dropActive?: boolean;
  skillSelectionScopeKey?: string | null;
  initialSelectedAgentSlug?: string | null;
  initialSelectedSkillSeedKey?: string | null;
  initialSelectedSkillSlug?: string | null;
  initialSelectedSkillOption?: ComposerSkillOption | null;
  initialSelectedStock?: ComposerStockContext | null;
  searchStocks?: (query: string, options?: {limit?: number; offset?: number}) => Promise<ComposerInstrumentSearchPage>;
  searchFunds?: (query: string, options?: {limit?: number; offset?: number}) => Promise<ComposerInstrumentSearchPage>;
  composerConfig?: ResolvedInputComposerConfig | null;
};

const STOCK_MENU_PAGE_SIZE = 8;
const STOCK_MENU_SCROLL_THRESHOLD = 40;

const SUPPORTED_ATTACHMENT_TYPES = ['image/', 'video/', 'application/pdf'];
const DEFAULT_PLACEHOLDER = '输入研究问题，@专家，或选择下方财经快捷模板...';
const QUICK_QUERY_OPTIONS = [
  {
    id: 'earnings',
    label: '财报解读',
    tone: 'gold',
    template: '请解读 #标的 最新财报，重点看收入增速、利润率、经营现金流、管理层指引和预期差。',
  },
  {
    id: 'valuation',
    label: '估值分析',
    tone: 'blue',
    template: '请对 #标的 做估值分析，结合增长、盈利质量、可比公司估值和主要风险给出判断。',
  },
  {
    id: 'compare',
    label: '公司对比',
    tone: 'green',
    template: '请对比 #标的1 和 #标的2 的商业模式、增长质量、估值水平和关键风险。',
  },
  {
    id: 'sector',
    label: '行业点评',
    tone: 'amber',
    template: '请从行业格局、政策驱动、盈利周期和估值水平出发，点评 #行业 的当前机会与风险。',
  },
  {
    id: 'market',
    label: '市场复盘',
    tone: 'rose',
    template: '请复盘今天市场，说明主要指数表现、领涨领跌板块、资金风格和背后驱动。',
  },
  {
    id: 'fund',
    label: '基金分析',
    tone: 'slate',
    template: '请分析 #基金 的投资范围、持仓风格、业绩表现、回撤风险、基金经理特征和适合的配置场景。',
  },
] as const;

const MODE_OPTIONS: ComposerStaticOption[] = [
  { value: 'quick', label: '快速问答', detail: '更直接地给出结论和判断' },
  { value: 'deep-research', label: '深度研究', detail: '更完整地展开分析与推演' },
  { value: 'report', label: '生成报告', detail: '按结构化报告方式组织答案' },
];

const MARKET_SCOPE_OPTIONS: ComposerStaticOption[] = [
  { value: 'cn', label: 'A股', detail: '聚焦中国 A 股市场与标的' },
  { value: 'us', label: '美股', detail: '聚焦美国市场与上市公司' },
  { value: 'hk', label: '港股', detail: '聚焦港股市场与港股通标的' },
  { value: 'macro', label: '宏观', detail: '聚焦宏观数据、利率与政策' },
  { value: 'crypto', label: '加密', detail: '聚焦加密资产与链上市场' },
];

const OUTPUT_OPTIONS: ComposerStaticOption[] = [
  { value: 'summary', label: '结论摘要', detail: '优先输出简洁摘要与核心判断' },
  { value: 'table', label: '表格', detail: '优先使用表格整理关键信息' },
  { value: 'minutes', label: '纪要', detail: '按纪要结构汇总重点与行动项' },
  { value: 'report', label: '报告', detail: '输出更完整的研究报告体例' },
];

const WATCHLIST_OPTIONS: ComposerStaticOption[] = [
  { value: 'all', label: '全部自选', detail: '优先围绕整组自选标的理解和回答' },
  { value: 'core', label: '核心关注', detail: '优先围绕长期重点关注的核心标的' },
  { value: 'swing', label: '短线观察', detail: '优先围绕交易观察和短期跟踪标的' },
  { value: 'long-term', label: '长期配置', detail: '优先围绕长期配置与组合持有标的' },
];

const DEFAULT_TOP_BAR_CONTROLS = [
  { controlKey: 'expert', displayName: '选择专家', controlType: 'expert', sortOrder: 10, options: [] },
  { controlKey: 'skill', displayName: '选择技能', controlType: 'skill', sortOrder: 20, options: [] },
  { controlKey: 'mode', displayName: '选择模式', controlType: 'static', sortOrder: 30, options: MODE_OPTIONS },
  { controlKey: 'market-scope', displayName: '选择市场', controlType: 'static', sortOrder: 40, options: MARKET_SCOPE_OPTIONS },
  { controlKey: 'stock-context', displayName: '选择股票', controlType: 'stock', sortOrder: 50, options: [] },
  { controlKey: 'fund-context', displayName: '选择基金/ETF', controlType: 'fund', sortOrder: 60, options: [] },
  { controlKey: 'watchlist', displayName: '选择自选组', controlType: 'static', sortOrder: 70, options: WATCHLIST_OPTIONS },
  { controlKey: 'output-format', displayName: '输出模版', controlType: 'static', sortOrder: 80, options: OUTPUT_OPTIONS },
] as const;

const DEFAULT_FOOTER_SHORTCUTS = QUICK_QUERY_OPTIONS.map((item, index) => ({
  shortcutKey: item.id,
  displayName: item.label,
  description: '',
  template: item.template,
  tone: item.tone,
  sortOrder: (index + 1) * 10,
}));

const RECENT_SELECTIONS_STORAGE_KEY = 'iclaw.composer.recent-selections.v1';
const MAX_RECENT_SELECTIONS = 4;
const EMPTY_RECENT_SELECTIONS: RecentSelectionState = {
  agents: [],
  skills: [],
  modes: [],
  markets: [],
  watchlists: [],
  outputs: [],
};

const DEFAULT_SELECTOR_RECENT_VIEWS: SelectorRecentViewState = {
  expert: 'all',
  skill: 'all',
  mode: 'all',
  market: 'all',
  watchlist: 'all',
  output: 'all',
};

function createComposerId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatStockContextLabel(stock: ComposerStockContext | null | undefined): string | null {
  if (!stock) return null;
  return `${stock.companyName} ${stock.symbol}`;
}

function findDefaultTopBarControl(controlKey: string) {
  return DEFAULT_TOP_BAR_CONTROLS.find((item) => item.controlKey === controlKey) ?? null;
}

function resolveInstrumentContextTypeLabel(stock: ComposerStockContext | null | undefined): string {
  const explicitLabel = stock?.instrumentLabel?.trim();
  if (explicitLabel) return explicitLabel;
  switch (stock?.instrumentKind) {
    case 'etf':
      return 'ETF';
    case 'qdii':
      return 'QDII';
    case 'fund':
      return '基金';
    default:
      return '股票';
  }
}

function formatStockExchangeLabel(exchange: ComposerStockContext['exchange']): string {
  if (exchange === 'sh') return '上交所';
  if (exchange === 'sz') return '深交所';
  if (exchange === 'otc') return '场外';
  return '北交所';
}

function formatInstrumentOptionDetail(stock: ComposerStockContext): string {
  const segments = [
    resolveInstrumentContextTypeLabel(stock),
    stock.symbol,
    formatStockExchangeLabel(stock.exchange),
  ];
  if (stock.board) {
    segments.push(stock.board);
  }
  return segments.join(' · ');
}

function isSupportedAttachment(file: File): boolean {
  return SUPPORTED_ATTACHMENT_TYPES.some((type) => file.type.startsWith(type));
}

function isImageAttachment(mimeType?: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isVideoAttachment(mimeType?: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/');
}

function isPdfAttachment(mimeType?: string): boolean {
  return mimeType === 'application/pdf';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('failed to read file')));
    reader.readAsDataURL(file);
  });
}

function normalizeRecentSelectionState(value: unknown): RecentSelectionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_RECENT_SELECTIONS;
  }

  const record = value as Record<string, unknown>;
  return {
    agents: Array.isArray(record.agents) ? record.agents.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
    skills: Array.isArray(record.skills) ? record.skills.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
    modes: Array.isArray(record.modes) ? record.modes.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
    markets: Array.isArray(record.markets) ? record.markets.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
    watchlists: Array.isArray(record.watchlists) ? record.watchlists.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
    outputs: Array.isArray(record.outputs) ? record.outputs.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SELECTIONS) : [],
  };
}

function readRecentSelections(): RecentSelectionState {
  try {
    const raw = readCacheJson<unknown>(RECENT_SELECTIONS_STORAGE_KEY);
    if (!raw) {
      return EMPTY_RECENT_SELECTIONS;
    }
    return normalizeRecentSelectionState(raw);
  } catch {
    return EMPTY_RECENT_SELECTIONS;
  }
}

function writeRecentSelections(value: RecentSelectionState): void {
  try {
    writeCacheJson(RECENT_SELECTIONS_STORAGE_KEY, value);
  } catch {
    // Ignore local storage write failures.
  }
}

function withRecentSelection(
  state: RecentSelectionState,
  bucket: RecentSelectionBucket,
  value: string,
): RecentSelectionState {
  const next = {
    ...state,
    [bucket]: [value, ...state[bucket].filter((item) => item !== value)].slice(0, MAX_RECENT_SELECTIONS),
  };
  return next;
}

function resolveSelectorRecentView(hasRecent: boolean): SelectorRecentView {
  return hasRecent ? 'recent' : 'all';
}

function buildTokenMarker(token: ComposerTokenMeta): string {
  if (token.kind === 'agent') {
    return `@${token.value}`;
  }
  if (token.kind === 'stock') {
    return `#${token.value}`;
  }
  if (token.kind === 'reference') {
    return `[[引用:${token.value}]]`;
  }
  if (isImageAttachment(token.mimeType)) {
    return `[[图片:${token.label}]]`;
  }
  if (isPdfAttachment(token.mimeType)) {
    return `[[PDF:${token.label}]]`;
  }
  if (isVideoAttachment(token.mimeType)) {
    return `[[视频:${token.label}]]`;
  }
  return `[[附件:${token.label}]]`;
}

function buildTokenTone(token: ComposerTokenMeta): string {
  if (token.kind === 'agent') return 'agent';
  if (token.kind === 'stock') return 'stock';
  if (token.kind === 'reference') return 'reference';
  if (isImageAttachment(token.mimeType)) return 'image';
  if (isPdfAttachment(token.mimeType)) return 'pdf';
  if (isVideoAttachment(token.mimeType)) return 'video';
  return 'file';
}

function buildTokenBadge(token: ComposerTokenMeta): string {
  if (token.kind === 'agent') return '@';
  if (token.kind === 'stock') {
    if (token.stockContext?.instrumentKind === 'etf') return 'ETF';
    if (token.stockContext?.instrumentKind === 'fund') return '基';
    if (token.stockContext?.instrumentKind === 'qdii') return 'Q';
    return '股';
  }
  if (token.kind === 'reference') return '引';
  if (isImageAttachment(token.mimeType)) return '图';
  if (isPdfAttachment(token.mimeType)) return 'PDF';
  if (isVideoAttachment(token.mimeType)) return '影';
  return '附';
}

function resolveDraftAttachmentType(token: ComposerTokenMeta): ComposerDraftAttachment['type'] {
  if (isImageAttachment(token.mimeType)) return 'image';
  if (isPdfAttachment(token.mimeType)) return 'pdf';
  if (isVideoAttachment(token.mimeType)) return 'video';
  return 'file';
}

function createTokenElement(token: ComposerTokenMeta): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'iclaw-inline-token';
  element.dataset.tokenId = token.id;
  element.dataset.tokenKind = token.kind;
  element.dataset.tokenTone = buildTokenTone(token);
  element.contentEditable = 'false';

  if (token.kind === 'agent') {
    const avatar = document.createElement('span');
    avatar.className = 'iclaw-inline-token__avatar';

    const image = document.createElement('img');
    image.className = 'iclaw-inline-token__avatar-image';
    image.src = token.avatarSrc ?? '';
    image.alt = token.label;

    const label = document.createElement('span');
    label.className = 'iclaw-inline-token__label';
    label.textContent = token.label;

    avatar.append(image);
    element.append(avatar, label);
  } else {
    const badge = document.createElement('span');
    badge.className = 'iclaw-inline-token__badge';
    badge.textContent = buildTokenBadge(token);

    const label = document.createElement('span');
    label.className = 'iclaw-inline-token__label';
    label.textContent = token.label;

    element.append(badge, label);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'iclaw-inline-token__remove';
  remove.dataset.tokenRemove = 'true';
  remove.setAttribute(
    'aria-label',
    token.kind === 'agent'
      ? '移除 Agent'
      : token.kind === 'stock'
        ? '移除股票'
        : '移除引用块',
  );
  remove.textContent = '×';

  element.append(remove);
  return element;
}

function normalizePrompt(prompt: string): string {
  return prompt
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createRangeAtEnd(root: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function serializeEditor(
  root: HTMLDivElement,
  tokenStore: Map<string, ComposerTokenMeta>,
): {
  prompt: string;
  imageAttachments: OpenClawImageAttachment[];
  attachments: ComposerDraftAttachment[];
  hasContent: boolean;
} {
  const imageAttachments: OpenClawImageAttachment[] = [];
  const attachments: ComposerDraftAttachment[] = [];
  let prompt = '';

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      prompt += node.textContent ?? '';
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.dataset.tokenId) {
      const token = tokenStore.get(node.dataset.tokenId);
      if (!token) {
        return;
      }
      prompt += buildTokenMarker(token);
      if (token.kind === 'attachment' && isImageAttachment(token.mimeType) && token.dataUrl) {
        imageAttachments.push({
          id: token.id,
          dataUrl: token.dataUrl,
          mimeType: token.mimeType ?? 'image/png',
        });
      }
      if (token.kind === 'attachment') {
        attachments.push({
          type: resolveDraftAttachmentType(token),
        });
      }
      return;
    }

    if (node.tagName === 'BR') {
      prompt += '\n';
      return;
    }

    node.childNodes.forEach(visit);
  };

  root.childNodes.forEach(visit);

  const normalizedPrompt = normalizePrompt(prompt);
  return {
    prompt: normalizedPrompt,
    imageAttachments,
    attachments,
    hasContent: normalizedPrompt.length > 0 || imageAttachments.length > 0,
  };
}

function buildReferenceLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 34) {
    return collapsed;
  }
  return `${collapsed.slice(0, 33)}...`;
}

function findStaticOption(
  options: ComposerStaticOption[],
  value: string | null,
): ComposerStaticOption | null {
  if (!value) {
    return null;
  }
  return options.find((option) => option.value === value) ?? null;
}

function groupSkillOptions(skillOptions: ComposerSkillOption[]): Array<{
  label: string;
  items: ComposerSkillOption[];
}> {
  const grouped = new Map<string, ComposerSkillOption[]>();

  for (const skill of skillOptions) {
    const key = skill.categoryLabel?.trim() || skill.market?.trim() || '可用技能';
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(skill);
      continue;
    }
    grouped.set(key, [skill]);
  }

  return Array.from(grouped.entries()).map(([label, items]) => ({
    label,
    items: [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
  }));
}

export const RichChatComposer = forwardRef<RichChatComposerHandle, RichChatComposerProps>(
  function RichChatComposer(
    {
      authBaseUrl,
      connected,
      busy,
      sendDisabledReason = null,
      sessionTransitioning = false,
      queueWhileConnecting = false,
      lobsterAgents,
      skillOptions,
      modelOptions,
      selectedModelId,
      modelsLoading,
      modelSwitching,
      onModelChange,
      onAbort,
      onSend,
      onDraftChange,
      creditEstimate,
      dropActive = false,
      skillSelectionScopeKey = null,
      initialSelectedAgentSlug = null,
      initialSelectedSkillSeedKey = null,
      initialSelectedSkillSlug = null,
      initialSelectedSkillOption = null,
      initialSelectedStock = null,
      searchStocks,
      searchFunds,
      composerConfig = null,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const inputShellRef = useRef<HTMLDivElement | null>(null);
    const activeControlsRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const modelMenuRef = useRef<HTMLDivElement | null>(null);
    const mentionToolbarRef = useRef<HTMLDivElement | null>(null);
    const mentionFloatingMenuRef = useRef<HTMLDivElement | null>(null);
    const stockToolbarRef = useRef<HTMLDivElement | null>(null);
    const fundToolbarRef = useRef<HTMLDivElement | null>(null);
    const stockFloatingMenuRef = useRef<HTMLDivElement | null>(null);
    const stockToolbarSearchInputRef = useRef<HTMLInputElement | null>(null);
    const stockListRef = useRef<HTMLDivElement | null>(null);
    const skillMenuRef = useRef<HTMLDivElement | null>(null);
    const modeMenuRef = useRef<HTMLDivElement | null>(null);
    const marketMenuRef = useRef<HTMLDivElement | null>(null);
    const watchlistMenuRef = useRef<HTMLDivElement | null>(null);
    const outputMenuRef = useRef<HTMLDivElement | null>(null);
    const tokenStoreRef = useRef<Map<string, ComposerTokenMeta>>(new Map());
    const savedRangeRef = useRef<Range | null>(null);
    const pendingMentionTriggerRef = useRef(false);
    const pendingStockTriggerRef = useRef(false);
    const stockSearchSeqRef = useRef(0);
    const [hasContent, setHasContent] = useState(false);
    const [tokenCount, setTokenCount] = useState(0);
    const [modelMenuOpen, setModelMenuOpen] = useState(false);
    const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
    const [mentionMenuSource, setMentionMenuSource] = useState<ComposerMenuSource | null>(null);
    const [mentionMenuPosition, setMentionMenuPosition] = useState<ComposerFloatingMenuPosition | null>(null);
    const [stockMenuOpen, setStockMenuOpen] = useState(false);
    const [stockMenuSource, setStockMenuSource] = useState<ComposerMenuSource | null>(null);
    const [stockMenuPosition, setStockMenuPosition] = useState<ComposerFloatingMenuPosition | null>(null);
    const [stockMenuKind, setStockMenuKind] = useState<ComposerInstrumentMenuKind>('stock');
    const [skillMenuOpen, setSkillMenuOpen] = useState(false);
    const [modeMenuOpen, setModeMenuOpen] = useState(false);
    const [marketMenuOpen, setMarketMenuOpen] = useState(false);
    const [watchlistMenuOpen, setWatchlistMenuOpen] = useState(false);
    const [outputMenuOpen, setOutputMenuOpen] = useState(false);
    const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(null);
    const [selectedSkillSlug, setSelectedSkillSlug] = useState<string | null>(null);
    const [selectedMode, setSelectedMode] = useState<string | null>(null);
    const [selectedMarketScope, setSelectedMarketScope] = useState<string | null>(null);
    const [selectedStockContext, setSelectedStockContext] = useState<ComposerStockContext | null>(null);
    const [selectedWatchlist, setSelectedWatchlist] = useState<string | null>(null);
    const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
    const [stockQuery, setStockQuery] = useState('');
    const [stockResults, setStockResults] = useState<ComposerStockOption[]>([]);
    const [stockLoading, setStockLoading] = useState(false);
    const [stockLoadingMore, setStockLoadingMore] = useState(false);
    const [stockError, setStockError] = useState<string | null>(null);
    const [stockLoadMoreError, setStockLoadMoreError] = useState<string | null>(null);
    const [stockHasMore, setStockHasMore] = useState(false);
    const [stockNextOffset, setStockNextOffset] = useState<number | null>(null);
    const [recentSelections, setRecentSelections] = useState<RecentSelectionState>(EMPTY_RECENT_SELECTIONS);
    const [selectorRecentViews, setSelectorRecentViews] = useState<SelectorRecentViewState>(DEFAULT_SELECTOR_RECENT_VIEWS);
    const [activeQuickQueryId, setActiveQuickQueryId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitInFlightRef = useRef(false);
    const sendAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const consumedInitialSkillSeedRef = useRef<string | null>(null);
    const lastSkillSelectionScopeKeyRef = useRef<string | null>(null);
    const topBarControls = composerConfig
      ? composerConfig.topBarControls
      : DEFAULT_TOP_BAR_CONTROLS.map((item) => ({
          controlKey: item.controlKey,
          displayName: item.displayName,
          controlType: item.controlType,
          iconKey: null,
          sortOrder: item.sortOrder,
          options: item.options.map((option) => ({
            value: option.value,
            label: option.label,
            description: option.detail,
          })),
          metadata: {},
          config: {},
        }));
    const footerShortcuts = composerConfig
      ? composerConfig.footerShortcuts
      : DEFAULT_FOOTER_SHORTCUTS.map((item) => ({
          shortcutKey: item.shortcutKey,
          displayName: item.displayName,
          description: item.description,
          template: item.template,
          iconKey: null,
          tone: item.tone,
          sortOrder: item.sortOrder,
          metadata: {},
          config: {},
        }));
    const composerPlaceholder = composerConfig?.placeholderText?.trim() || DEFAULT_PLACEHOLDER;
    const topBarControlMap = new Map(topBarControls.map((item) => [item.controlKey, {item, order: item.sortOrder}]));
    const visibleTopBarControlKeys = new Set(topBarControls.map((item) => item.controlKey));
    const modeOptions = (topBarControlMap.get('mode')?.item.options || []).map((option) => ({
      value: option.value,
      label: option.label,
      detail: option.description,
    }));
    const marketScopeOptions = (topBarControlMap.get('market-scope')?.item.options || []).map((option) => ({
      value: option.value,
      label: option.label,
      detail: option.description,
    }));
    const watchlistOptions = (topBarControlMap.get('watchlist')?.item.options || []).map((option) => ({
      value: option.value,
      label: option.label,
      detail: option.description,
    }));
    const outputOptions = (topBarControlMap.get('output-format')?.item.options || []).map((option) => ({
      value: option.value,
      label: option.label,
      detail: option.description,
    }));
    const groupedSkills = groupSkillOptions(skillOptions);
    const recentAgentOptions = recentSelections.agents
      .map((slug) => lobsterAgents.find((option) => option.slug === slug) ?? null)
      .filter((option): option is ComposerAgentOption => Boolean(option));
    const recentSkillOptions = recentSelections.skills
      .map((slug) => skillOptions.find((option) => option.slug === slug) ?? null)
      .filter((option): option is ComposerSkillOption => Boolean(option));
    const recentModeOptions = recentSelections.modes
      .map((value) => findStaticOption(modeOptions, value))
      .filter((option): option is ComposerStaticOption => Boolean(option));
    const recentMarketOptions = recentSelections.markets
      .map((value) => findStaticOption(marketScopeOptions, value))
      .filter((option): option is ComposerStaticOption => Boolean(option));
    const recentWatchlistOptions = recentSelections.watchlists
      .map((value) => findStaticOption(watchlistOptions, value))
      .filter((option): option is ComposerStaticOption => Boolean(option));
    const recentOutputOptions = recentSelections.outputs
      .map((value) => findStaticOption(outputOptions, value))
      .filter((option): option is ComposerStaticOption => Boolean(option));

    const refreshState = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const snapshot = serializeEditor(editor, tokenStoreRef.current);
      setHasContent(snapshot.hasContent);
      setTokenCount(tokenStoreRef.current.size);
      editor.dataset.empty = snapshot.hasContent ? 'false' : 'true';
      onDraftChange?.({
        prompt: snapshot.prompt,
        hasContent: snapshot.hasContent,
        attachments: snapshot.attachments,
      });
    }, [onDraftChange]);

    const restoreRange = useCallback((): Range | null => {
      const editor = editorRef.current;
      if (!editor) {
        return null;
      }
      editor.focus();
      const selection = window.getSelection();
      if (!selection) {
        return null;
      }
      const preferredRange = savedRangeRef.current?.cloneRange() ?? createRangeAtEnd(editor);
      selection.removeAllRanges();
      try {
        selection.addRange(preferredRange);
        return preferredRange;
      } catch {
        const fallbackRange = createRangeAtEnd(editor);
        selection.removeAllRanges();
        selection.addRange(fallbackRange);
        return fallbackRange;
      }
    }, []);

    const placeCaretAfter = useCallback((node: Node) => {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }, []);

    const insertFragmentAtCaret = useCallback(
      (fragment: DocumentFragment, lastNode: Node | null) => {
        const range = restoreRange();
        if (!range) {
          return;
        }
        range.deleteContents();
        range.insertNode(fragment);
        if (lastNode) {
          placeCaretAfter(lastNode);
        }
        refreshState();
      },
      [placeCaretAfter, refreshState, restoreRange],
    );

    const insertTextAtCaret = useCallback(
      (text: string) => {
        if (!text) {
          return;
        }
        const fragment = document.createDocumentFragment();
        let lastNode: Node | null = null;
        const segments = text.replace(/\r\n/g, '\n').split('\n');
        segments.forEach((segment, index) => {
          if (segment.length > 0) {
            lastNode = document.createTextNode(segment);
            fragment.append(lastNode);
          }
          if (index < segments.length - 1) {
            lastNode = document.createElement('br');
            fragment.append(lastNode);
          }
        });
        insertFragmentAtCaret(fragment, lastNode);
      },
      [insertFragmentAtCaret],
    );

    const insertTokenAtCaret = useCallback(
      (token: ComposerTokenMeta) => {
        const fragment = document.createDocumentFragment();
        const element = createTokenElement(token);
        tokenStoreRef.current.set(token.id, token);
        fragment.append(element);
        insertFragmentAtCaret(fragment, element);
        setTokenCount(tokenStoreRef.current.size);
      },
      [insertFragmentAtCaret],
    );

    const focus = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const range = restoreRange() ?? createRangeAtEnd(editor);
      const selection = window.getSelection();
      if (!selection) {
        editor.focus();
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
      editor.focus();
    }, [restoreRange]);

    const getCaretClientRect = useCallback((): DOMRect | null => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        return rects[rects.length - 1];
      }
      const fallbackRect = range.getBoundingClientRect();
      if (
        fallbackRect.width > 0 ||
        fallbackRect.height > 0 ||
        fallbackRect.left > 0 ||
        fallbackRect.top > 0
      ) {
        return fallbackRect;
      }
      if (range.startContainer instanceof Element) {
        return range.startContainer.getBoundingClientRect();
      }
      return range.startContainer.parentElement?.getBoundingClientRect() ?? null;
    }, []);

    const computeFloatingMenuPosition = useCallback(
      (kind: 'mention' | 'stock'): ComposerFloatingMenuPosition | null => {
        const shellRect = inputShellRef.current?.getBoundingClientRect();
        const caretRect = getCaretClientRect();
        if (!shellRect || !caretRect) {
          return null;
        }

        const estimatedWidth = kind === 'mention' ? 300 : 264;
        const estimatedHeight = kind === 'mention' ? 296 : 304;
        const horizontalInset = 8;
        const verticalGap = 12;
        const minLeft = horizontalInset;
        const maxLeft = Math.max(minLeft, shellRect.width - estimatedWidth - horizontalInset);
        const anchoredLeft =
          kind === 'mention'
            ? caretRect.left - shellRect.left
            : caretRect.left - shellRect.left - estimatedWidth / 2;
        const left = Math.min(maxLeft, Math.max(minLeft, anchoredLeft));
        const topAbove = caretRect.top - shellRect.top - estimatedHeight - verticalGap;
        const topBelow = caretRect.bottom - shellRect.top + verticalGap;
        const canPlaceAbove = topAbove >= 4;
        const top = canPlaceAbove
          ? topAbove
          : Math.min(Math.max(4, shellRect.height - estimatedHeight - 4), topBelow);

        return {left, top: Math.max(4, top)};
      },
      [getCaretClientRect],
    );

    const syncMentionMenuPosition = useCallback(() => {
      const nextPosition = computeFloatingMenuPosition('mention');
      if (nextPosition) {
        setMentionMenuPosition(nextPosition);
      }
    }, [computeFloatingMenuPosition]);

    const syncStockMenuPosition = useCallback(() => {
      const nextPosition = computeFloatingMenuPosition('stock');
      if (nextPosition) {
        setStockMenuPosition(nextPosition);
      }
    }, [computeFloatingMenuPosition]);

    const getTextNodeBeforeCaret = useCallback((): {node: Text; offset: number} | null => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const liveRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : savedRangeRef.current;
      const range =
        liveRange && editor?.contains(liveRange.startContainer) && editor.contains(liveRange.endContainer)
          ? liveRange.cloneRange()
          : savedRangeRef.current?.cloneRange() ?? null;
      if (!editor || !range || !range.collapsed) {
        return null;
      }

      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            return node.parentElement?.closest('[data-token-id]')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          },
        },
      );

      let fallback: {node: Text; offset: number} | null = null;
      let currentNode = walker.nextNode();
      while (currentNode) {
        const textNode = currentNode as Text;
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(textNode);
        if (range.startContainer === textNode) {
          return {node: textNode, offset: Math.min(range.startOffset, textNode.data.length)};
        }
        if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0) {
          fallback = {node: textNode, offset: textNode.data.length};
          currentNode = walker.nextNode();
          continue;
        }
        break;
      }
      return fallback;
    }, []);

    const findTriggerMatchBeforeCaret = useCallback((trigger: '@' | '#') => {
      const textCursor = getTextNodeBeforeCaret();
      if (!textCursor) {
        return null;
      }
      const beforeCaret = textCursor.node.data.slice(0, textCursor.offset);
      const triggerIndex = beforeCaret.lastIndexOf(trigger);
      if (triggerIndex < 0) {
        return null;
      }
      const query = beforeCaret.slice(triggerIndex + 1);
      if (/[\s]/.test(query)) {
        return null;
      }
      return {
        node: textCursor.node,
        start: triggerIndex,
        end: textCursor.offset,
        query,
      };
    }, [getTextNodeBeforeCaret]);

    const closeMentionMenu = useCallback(() => {
      setMentionMenuOpen(false);
      setMentionMenuSource(null);
      setMentionMenuPosition(null);
      pendingMentionTriggerRef.current = false;
    }, []);

    const closeStockMenu = useCallback(() => {
      setStockMenuOpen(false);
      setStockMenuSource(null);
      setStockMenuPosition(null);
      setStockMenuKind('stock');
      setStockQuery('');
      setStockResults([]);
      setStockHasMore(false);
      setStockNextOffset(null);
      setStockLoading(false);
      setStockLoadingMore(false);
      setStockError(null);
      setStockLoadMoreError(null);
      pendingStockTriggerRef.current = false;
    }, []);

    const closeSkillMenu = useCallback(() => {
      setSkillMenuOpen(false);
    }, []);

    const closeModeMenu = useCallback(() => {
      setModeMenuOpen(false);
    }, []);

    const closeMarketMenu = useCallback(() => {
      setMarketMenuOpen(false);
    }, []);

    const closeWatchlistMenu = useCallback(() => {
      setWatchlistMenuOpen(false);
    }, []);

    const closeOutputMenu = useCallback(() => {
      setOutputMenuOpen(false);
    }, []);

    const rememberRecentSelection = useCallback((bucket: RecentSelectionBucket, value: string) => {
      if (!value.trim()) {
        return;
      }
      setRecentSelections((current) => {
        const next = withRecentSelection(current, bucket, value);
        writeRecentSelections(next);
        return next;
      });
    }, []);

    const setSelectorRecentView = useCallback((menuKey: SelectorRecentMenuKey, view: SelectorRecentView) => {
      setSelectorRecentViews((current) => {
        if (current[menuKey] === view) {
          return current;
        }
        return {
          ...current,
          [menuKey]: view,
        };
      });
    }, []);

    const primeSelectorRecentView = useCallback((menuKey: SelectorRecentMenuKey, hasRecent: boolean) => {
      const nextView = resolveSelectorRecentView(hasRecent);
      setSelectorRecentViews((current) => {
        if (current[menuKey] === nextView) {
          return current;
        }
        return {
          ...current,
          [menuKey]: nextView,
        };
      });
    }, []);

    const replacePrompt = useCallback((text: string) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.replaceChildren();
      tokenStoreRef.current.clear();
      savedRangeRef.current = createRangeAtEnd(editor);

      if (text.trim()) {
        insertTextAtCaret(text);
      } else {
        refreshState();
        editor.focus();
      }
    }, [insertTextAtCaret, refreshState]);

    const insertReference = useCallback(
      (
        text: string,
        options?: {
          label?: string;
          trailingText?: string;
        },
      ) => {
        const value = text.replace(/\u00a0/g, ' ').trim();
        if (!value) {
          return;
        }

        const token: ComposerTokenMeta = {
          id: createComposerId('reference'),
          kind: 'reference',
          label: options?.label?.trim() || buildReferenceLabel(value),
          value,
        };
        insertTokenAtCaret(token);
        if (options?.trailingText?.trim()) {
          insertTextAtCaret(` ${options.trailingText.trim()}`);
        }
        focus();
      },
      [focus, insertTextAtCaret, insertTokenAtCaret],
    );

    const clearComposer = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.replaceChildren();
      tokenStoreRef.current.clear();
      savedRangeRef.current = createRangeAtEnd(editor);
      setActiveQuickQueryId(null);
      closeMentionMenu();
      closeStockMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      refreshState();
      editor.focus();
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, refreshState]);

    const captureDraftSnapshot = useCallback((): ComposerDraftSnapshot | null => {
      const editor = editorRef.current;
      if (!editor) {
        return null;
      }

      return {
        nodes: Array.from(editor.childNodes).map((node) => node.cloneNode(true)),
        tokens: Array.from(tokenStoreRef.current.values()),
        selectedAgentSlug,
        selectedSkillSlug,
        selectedMode,
        selectedMarketScope,
        selectedStockContext,
        selectedWatchlist,
        selectedOutput,
        activeQuickQueryId,
      };
    }, [
      activeQuickQueryId,
      selectedAgentSlug,
      selectedMarketScope,
      selectedMode,
      selectedOutput,
      selectedSkillSlug,
      selectedStockContext,
      selectedWatchlist,
    ]);

    const restoreDraftSnapshot = useCallback((snapshot: ComposerDraftSnapshot | null) => {
      const editor = editorRef.current;
      if (!editor || !snapshot) {
        return;
      }

      editor.replaceChildren(...snapshot.nodes.map((node) => node.cloneNode(true)));
      tokenStoreRef.current = new Map(snapshot.tokens.map((token) => [token.id, token]));
      savedRangeRef.current = createRangeAtEnd(editor);
      setSelectedAgentSlug(snapshot.selectedAgentSlug);
      setSelectedSkillSlug(snapshot.selectedSkillSlug);
      setSelectedMode(snapshot.selectedMode);
      setSelectedMarketScope(snapshot.selectedMarketScope);
      setSelectedStockContext(snapshot.selectedStockContext);
      setSelectedWatchlist(snapshot.selectedWatchlist);
      setSelectedOutput(snapshot.selectedOutput);
      setActiveQuickQueryId(snapshot.activeQuickQueryId);
      closeMentionMenu();
      closeStockMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      refreshState();
      editor.focus();
    }, [
      closeMarketMenu,
      closeMentionMenu,
      closeModeMenu,
      closeOutputMenu,
      closeSkillMenu,
      closeStockMenu,
      closeWatchlistMenu,
      refreshState,
    ]);

    const removeAgentTokens = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const agentNodes = Array.from(editor.querySelectorAll<HTMLElement>('[data-token-kind="agent"]'));
      if (agentNodes.length === 0) {
        return false;
      }

      agentNodes.forEach((node) => {
        const tokenId = node.dataset.tokenId;
        if (tokenId) {
          tokenStoreRef.current.delete(tokenId);
        }
        node.remove();
      });

      savedRangeRef.current = createRangeAtEnd(editor);
      return true;
    }, []);

    const removeStockTokens = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const stockNodes = Array.from(editor.querySelectorAll<HTMLElement>('[data-token-kind="stock"]'));
      if (stockNodes.length === 0) {
        return false;
      }

      stockNodes.forEach((node) => {
        const tokenId = node.dataset.tokenId;
        if (tokenId) {
          tokenStoreRef.current.delete(tokenId);
        }
        node.remove();
      });

      savedRangeRef.current = createRangeAtEnd(editor);
      return true;
    }, []);

    const clearAgentMentions = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      setSelectedAgentSlug(null);
      if (!removeAgentTokens()) {
        closeMentionMenu();
        focus();
        return;
      }
      closeMentionMenu();
      refreshState();
      focus();
    }, [closeMentionMenu, focus, refreshState, removeAgentTokens]);

    const clearStockSelection = useCallback(() => {
      setSelectedStockContext(null);
      const removed = removeStockTokens();
      closeStockMenu();
      if (removed) {
        refreshState();
      }
      focus();
    }, [closeStockMenu, focus, refreshState, removeStockTokens]);

    const removeMentionTriggerBeforeCaret = useCallback(() => {
      const editor = editorRef.current;
      const range = restoreRange();
      if (!editor || !range || !range.collapsed) {
        return;
      }

      const updateSelection = (node: Text, offset: number) => {
        const nextRange = document.createRange();
        nextRange.setStart(node, offset);
        nextRange.collapse(true);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(nextRange);
        }
        savedRangeRef.current = nextRange.cloneRange();
        refreshState();
      };

      const container = range.startContainer;
      const offset = range.startOffset;
      if (container.nodeType === Node.TEXT_NODE) {
        const textNode = container as Text;
        const value = textNode.data;
        if (offset > 0 && value[offset - 1] === '@') {
          textNode.deleteData(offset - 1, 1);
          updateSelection(textNode, offset - 1);
          return;
        }
      }

      if (!(container instanceof HTMLElement)) {
        return;
      }

      const previousNode = container.childNodes[offset - 1] ?? null;
      if (!(previousNode instanceof Text) || !previousNode.data.endsWith('@')) {
        return;
      }
      previousNode.deleteData(previousNode.data.length - 1, 1);
      updateSelection(previousNode, previousNode.data.length);
    }, [refreshState, restoreRange]);

    const insertAgentMention = useCallback((agent: ComposerAgentOption) => {
      if (pendingMentionTriggerRef.current) {
        removeMentionTriggerBeforeCaret();
        removeAgentTokens();

        const token: ComposerTokenMeta = {
          id: createComposerId('agent'),
          kind: 'agent',
          label: agent.name,
          value: agent.name,
          slug: agent.slug,
          avatarSrc: agent.avatarSrc,
        };
        insertTokenAtCaret(token);
        insertTextAtCaret(' ');
      } else {
        removeAgentTokens();
      }
      setSelectedAgentSlug(agent.slug);
      rememberRecentSelection('agents', agent.slug);
      closeMentionMenu();
      refreshState();
      focus();
    }, [closeMentionMenu, focus, insertTextAtCaret, insertTokenAtCaret, refreshState, rememberRecentSelection, removeAgentTokens, removeMentionTriggerBeforeCaret]);

    const removeStockTriggerBeforeCaret = useCallback(() => {
      const match = findTriggerMatchBeforeCaret('#');
      if (!match) {
        return;
      }

      match.node.deleteData(match.start, match.end - match.start);
      const nextRange = document.createRange();
      nextRange.setStart(match.node, match.start);
      nextRange.collapse(true);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(nextRange);
      }
      savedRangeRef.current = nextRange.cloneRange();
      refreshState();
    }, [findTriggerMatchBeforeCaret, refreshState]);

    const insertStockMention = useCallback((stock: ComposerStockOption) => {
      if (pendingStockTriggerRef.current) {
        removeStockTriggerBeforeCaret();
      }
      const preservedRange = savedRangeRef.current?.cloneRange() ?? null;
      removeStockTokens();
      if (preservedRange) {
        savedRangeRef.current = preservedRange;
      }

      const token: ComposerTokenMeta = {
        id: createComposerId('stock'),
        kind: 'stock',
        label: `${stock.companyName} ${stock.symbol}`,
        value: stock.symbol,
        stockContext: stock,
      };
      insertTokenAtCaret(token);
      insertTextAtCaret(' ');
      setSelectedStockContext(stock);
      closeStockMenu();
      refreshState();
      focus();
    }, [closeStockMenu, focus, insertTextAtCaret, insertTokenAtCaret, refreshState, removeStockTokens, removeStockTriggerBeforeCaret]);

    const openMentionMenu = useCallback((source: ComposerMenuSource) => {
      if (!connected) {
        return;
      }
      pendingMentionTriggerRef.current = source === 'typing';
      primeSelectorRecentView('expert', recentAgentOptions.length > 0);
      setMentionMenuSource(source);
      closeStockMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      setModelMenuOpen(false);
      setMentionMenuOpen(true);
      if (source === 'typing') {
        window.requestAnimationFrame(() => {
          syncMentionMenuPosition();
        });
      }
    }, [closeMarketMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, connected, primeSelectorRecentView, recentAgentOptions.length, syncMentionMenuPosition]);

    const openStockMenu = useCallback((source: ComposerMenuSource, kind: ComposerInstrumentMenuKind = 'stock') => {
      if (!connected) {
        return;
      }
      pendingStockTriggerRef.current = source === 'typing';
      setStockMenuKind(kind);
      setStockMenuSource(source);
      setStockQuery(source === 'typing' ? findTriggerMatchBeforeCaret('#')?.query ?? '' : '');
      setModelMenuOpen(false);
      closeMentionMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      setStockMenuOpen(true);
      if (source === 'typing') {
        window.requestAnimationFrame(() => {
          syncStockMenuPosition();
        });
      }
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeWatchlistMenu, connected, findTriggerMatchBeforeCaret, syncStockMenuPosition]);

    const openSkillMenu = useCallback(() => {
      if (!connected) {
        return;
      }
      primeSelectorRecentView('skill', recentSkillOptions.length > 0);
      setModelMenuOpen(false);
      closeMentionMenu();
      closeStockMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      setSkillMenuOpen(true);
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeOutputMenu, closeStockMenu, closeWatchlistMenu, connected, primeSelectorRecentView, recentSkillOptions.length]);

    const openModeMenu = useCallback(() => {
      if (!connected) {
        return;
      }
      primeSelectorRecentView('mode', recentModeOptions.length > 0);
      setModelMenuOpen(false);
      closeMentionMenu();
      closeSkillMenu();
      closeStockMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      setModeMenuOpen(true);
    }, [closeMarketMenu, closeMentionMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, connected, primeSelectorRecentView, recentModeOptions.length]);

    const openMarketMenu = useCallback(() => {
      if (!connected) {
        return;
      }
      primeSelectorRecentView('market', recentMarketOptions.length > 0);
      setModelMenuOpen(false);
      closeMentionMenu();
      closeSkillMenu();
      closeModeMenu();
      closeStockMenu();
      closeWatchlistMenu();
      closeOutputMenu();
      setMarketMenuOpen(true);
    }, [closeMentionMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, connected, primeSelectorRecentView, recentMarketOptions.length]);

    const openWatchlistMenu = useCallback(() => {
      if (!connected) {
        return;
      }
      primeSelectorRecentView('watchlist', recentWatchlistOptions.length > 0);
      setModelMenuOpen(false);
      closeMentionMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeStockMenu();
      closeOutputMenu();
      setWatchlistMenuOpen(true);
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, connected, primeSelectorRecentView, recentWatchlistOptions.length]);

    const openOutputMenu = useCallback(() => {
      if (!connected) {
        return;
      }
      primeSelectorRecentView('output', recentOutputOptions.length > 0);
      setModelMenuOpen(false);
      closeMentionMenu();
      closeSkillMenu();
      closeModeMenu();
      closeMarketMenu();
      closeWatchlistMenu();
      closeStockMenu();
      setOutputMenuOpen(true);
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, connected, primeSelectorRecentView, recentOutputOptions.length]);

    const selectSkill = useCallback((slug: string | null) => {
      setSelectedSkillSlug(slug);
      if (slug) {
        rememberRecentSelection('skills', slug);
      }
      closeSkillMenu();
    }, [closeSkillMenu, rememberRecentSelection]);

    const selectMode = useCallback((value: string | null) => {
      setSelectedMode(value);
      if (value) {
        rememberRecentSelection('modes', value);
      }
      closeModeMenu();
    }, [closeModeMenu, rememberRecentSelection]);

    const selectMarketScope = useCallback((value: string | null) => {
      setSelectedMarketScope(value);
      if (value) {
        rememberRecentSelection('markets', value);
      }
      closeMarketMenu();
    }, [closeMarketMenu, rememberRecentSelection]);

    const selectWatchlist = useCallback((value: string | null) => {
      setSelectedWatchlist(value);
      if (value) {
        rememberRecentSelection('watchlists', value);
      }
      closeWatchlistMenu();
    }, [closeWatchlistMenu, rememberRecentSelection]);

    const selectOutput = useCallback((value: string | null) => {
      setSelectedOutput(value);
      if (value) {
        rememberRecentSelection('outputs', value);
      }
      closeOutputMenu();
    }, [closeOutputMenu, rememberRecentSelection]);

    const insertQuickQueryTemplate = useCallback((query: (typeof footerShortcuts)[number]) => {
      if (!connected) {
        return;
      }

      replacePrompt(query.template);
      setActiveQuickQueryId(query.shortcutKey);
      focus();
    }, [connected, focus, footerShortcuts, replacePrompt]);

    const processFiles = useCallback(
      async (files: File[]): Promise<number> => {
        const supportedFiles = files.filter(isSupportedAttachment);
        if (supportedFiles.length === 0) {
          return 0;
        }

        for (const file of supportedFiles) {
          const token: ComposerTokenMeta = {
            id: createComposerId('attachment'),
            kind: 'attachment',
            label: file.name || '未命名附件',
            value: file.name || '未命名附件',
            mimeType: file.type || 'application/octet-stream',
            dataUrl: isImageAttachment(file.type) ? await readFileAsDataUrl(file) : null,
          };
          insertTokenAtCaret(token);
        }
        focus();
        return supportedFiles.length;
      },
      [focus, insertTokenAtCaret],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus,
        replacePrompt,
        addFiles: processFiles,
        insertReference,
      }),
      [focus, insertReference, processFiles, replacePrompt],
    );

    const playFallbackSendWhoosh = useCallback(() => {
      if (typeof window === 'undefined') {
        return;
      }
      const AudioContextCtor =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      try {
        const context = audioContextRef.current ?? new AudioContextCtor();
        audioContextRef.current = context;
        if (context.state === 'suspended') {
          void context.resume();
        }

        const now = context.currentTime;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.085, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        gain.connect(context.destination);

        const lead = context.createOscillator();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(1480, now);
        lead.frequency.exponentialRampToValueAtTime(620, now + 0.18);
        lead.connect(gain);
        lead.start(now);
        lead.stop(now + 0.22);

        const tail = context.createOscillator();
        tail.type = 'sine';
        tail.frequency.setValueAtTime(920, now + 0.01);
        tail.frequency.exponentialRampToValueAtTime(320, now + 0.2);
        tail.connect(gain);
        tail.start(now + 0.01);
        tail.stop(now + 0.22);
      } catch {
        // Ignore audio failures; send should still proceed.
      }
    }, []);

    const playSendWhoosh = useCallback(() => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        const audio = sendAudioRef.current ?? new Audio(sendSwishAigeiUrl);
        if (!sendAudioRef.current) {
          audio.preload = 'auto';
          audio.volume = 0.9;
          sendAudioRef.current = audio;
        }
        audio.pause();
        audio.currentTime = 0;
        void audio.play().catch(() => {
          playFallbackSendWhoosh();
        });
      } catch {
        playFallbackSendWhoosh();
      }
    }, [playFallbackSendWhoosh]);

    const handleSubmit = useCallback(async () => {
      if (submitInFlightRef.current) {
        return;
      }
      if (busy && !hasContent) {
        await onAbort();
        return;
      }
      if (sendDisabledReason) {
        return;
      }

      const editor = editorRef.current;
      if (!editor || (!connected && !queueWhileConnecting)) {
        return;
      }

      const payload = serializeEditor(editor, tokenStoreRef.current);
      if (!payload.hasContent) {
        return;
      }
      const tokenSelectedAgentSlug =
        Array.from(tokenStoreRef.current.values()).find((token) => token.kind === 'agent')?.slug ?? null;
      const resolvedAgent =
        lobsterAgents.find((option) => option.slug === (selectedAgentSlug || tokenSelectedAgentSlug)) ?? null;
      const draftSnapshot = captureDraftSnapshot();
      submitInFlightRef.current = true;
      setIsSubmitting(true);
      playSendWhoosh();
      clearComposer();
      try {
        const accepted = await onSend({
          ...payload,
          selectedAgentSlug: resolvedAgent?.slug ?? null,
          selectedAgentName: resolvedAgent?.name ?? null,
          selectedAgentSystemPrompt: resolvedAgent?.systemPrompt?.trim() || null,
          selectedSkillSlug: visibleTopBarControlKeys.has('skill') ? selectedSkillSlug : null,
          selectedSkillName:
            visibleTopBarControlKeys.has('skill')
              ? skillOptions.find((option) => option.slug === selectedSkillSlug)?.name ?? null
              : null,
          selectedMode: visibleTopBarControlKeys.has('mode') ? selectedMode : null,
          selectedModeLabel:
            visibleTopBarControlKeys.has('mode') ? findStaticOption(modeOptions, selectedMode)?.label ?? null : null,
          selectedMarketScope: visibleTopBarControlKeys.has('market-scope') ? selectedMarketScope : null,
          selectedMarketScopeLabel:
            visibleTopBarControlKeys.has('market-scope')
              ? findStaticOption(marketScopeOptions, selectedMarketScope)?.label ?? null
              : null,
          selectedStockContext,
          selectedStockContextLabel: formatStockContextLabel(selectedStockContext),
          selectedWatchlist: visibleTopBarControlKeys.has('watchlist') ? selectedWatchlist : null,
          selectedWatchlistLabel:
            visibleTopBarControlKeys.has('watchlist')
              ? findStaticOption(watchlistOptions, selectedWatchlist)?.label ?? null
              : null,
          selectedOutput: visibleTopBarControlKeys.has('output-format') ? selectedOutput : null,
          selectedOutputLabel:
            visibleTopBarControlKeys.has('output-format')
              ? findStaticOption(outputOptions, selectedOutput)?.label ?? null
              : null,
        });
        if (!accepted) {
          restoreDraftSnapshot(draftSnapshot);
        }
      } finally {
        submitInFlightRef.current = false;
        setIsSubmitting(false);
      }
    }, [
      busy,
      captureDraftSnapshot,
      clearComposer,
      connected,
      hasContent,
      onAbort,
      onSend,
      lobsterAgents,
      selectedMarketScope,
      selectedAgentSlug,
      selectedMode,
      selectedOutput,
      selectedStockContext,
      selectedWatchlist,
      modeOptions,
      marketScopeOptions,
      outputOptions,
      restoreDraftSnapshot,
      selectedSkillSlug,
      sendDisabledReason,
      skillOptions,
      visibleTopBarControlKeys,
      watchlistOptions,
      playSendWhoosh,
      queueWhileConnecting,
    ]);

    useEffect(() => {
      refreshState();
    }, [refreshState]);

    useEffect(() => {
      setRecentSelections(readRecentSelections());
    }, []);

    useEffect(() => {
      setSelectedAgentSlug(initialSelectedAgentSlug || null);
    }, [initialSelectedAgentSlug]);

    useEffect(() => {
      const scopeKey = skillSelectionScopeKey || '__default__';
      if (lastSkillSelectionScopeKeyRef.current === scopeKey) {
        return;
      }
      lastSkillSelectionScopeKeyRef.current = scopeKey;
      consumedInitialSkillSeedRef.current = null;
      setSelectedSkillSlug(null);
    }, [skillSelectionScopeKey]);

    useEffect(() => {
      if (!initialSelectedSkillSlug) {
        return;
      }
      const scopeKey = skillSelectionScopeKey || '__default__';
      const seedKey = `${scopeKey}:${initialSelectedSkillSeedKey?.trim() || initialSelectedSkillSlug}`;
      if (consumedInitialSkillSeedRef.current === seedKey) {
        return;
      }
      consumedInitialSkillSeedRef.current = seedKey;
      setSelectedSkillSlug(initialSelectedSkillSlug);
    }, [initialSelectedSkillSeedKey, initialSelectedSkillSlug, skillSelectionScopeKey]);

    useEffect(() => {
      if (!selectedAgentSlug) {
        return;
      }
      if (lobsterAgents.some((option) => option.slug === selectedAgentSlug)) {
        return;
      }
      setSelectedAgentSlug(null);
    }, [lobsterAgents, selectedAgentSlug]);

    useEffect(() => {
      if (!selectedSkillSlug) {
        return;
      }
      if (skillOptions.some((option) => option.slug === selectedSkillSlug)) {
        return;
      }
      setSelectedSkillSlug(null);
    }, [selectedSkillSlug, skillOptions]);

    useEffect(() => {
      setSelectedStockContext(initialSelectedStock || null);
    }, [initialSelectedStock]);

    const loadMoreStockResults = useCallback(() => {
      const activeSearch = stockMenuKind === 'stock' ? searchStocks : searchFunds;
      if (
        !stockMenuOpen ||
        !connected ||
        !activeSearch ||
        stockLoading ||
        stockLoadingMore ||
        !stockHasMore
      ) {
        return;
      }

      const offset = stockNextOffset ?? stockResults.length;
      const version = stockSearchSeqRef.current;
      setStockLoadingMore(true);
      setStockLoadMoreError(null);

      void activeSearch(stockQuery.trim(), {limit: STOCK_MENU_PAGE_SIZE, offset})
        .then((page) => {
          if (stockSearchSeqRef.current !== version) {
            return;
          }
          setStockResults((current) => {
            const seen = new Set(current.map((item) => item.id));
            const appended = page.items.filter((item) => !seen.has(item.id));
            return appended.length > 0 ? [...current, ...appended] : current;
          });
          setStockHasMore(page.hasMore);
          setStockNextOffset(page.nextOffset);
        })
        .catch(() => {
          if (stockSearchSeqRef.current !== version) {
            return;
          }
          setStockLoadMoreError('更多标的加载失败');
        })
        .finally(() => {
          if (stockSearchSeqRef.current !== version) {
            return;
          }
          setStockLoadingMore(false);
        });
    }, [
      connected,
      searchFunds,
      searchStocks,
      stockHasMore,
      stockLoading,
      stockLoadingMore,
      stockMenuKind,
      stockMenuOpen,
      stockNextOffset,
      stockQuery,
      stockResults.length,
    ]);

    useEffect(() => {
      const activeSearch = stockMenuKind === 'stock' ? searchStocks : searchFunds;
      if (!stockMenuOpen || !connected || !activeSearch) {
        setStockLoading(false);
        setStockLoadingMore(false);
        setStockHasMore(false);
        setStockNextOffset(null);
        setStockLoadMoreError(null);
        if (!stockMenuOpen || !activeSearch) {
          setStockResults([]);
        }
        return;
      }

      let cancelled = false;
      const sequence = stockSearchSeqRef.current + 1;
      stockSearchSeqRef.current = sequence;
      setStockLoading(true);
      setStockError(null);
      setStockLoadMoreError(null);
      setStockHasMore(false);
      setStockNextOffset(null);

      void activeSearch(stockQuery.trim(), {limit: STOCK_MENU_PAGE_SIZE, offset: 0})
        .then((page) => {
          if (cancelled || stockSearchSeqRef.current !== sequence) {
            return;
          }
          setStockResults(page.items);
          setStockHasMore(page.hasMore);
          setStockNextOffset(page.nextOffset);
        })
        .catch(() => {
          if (cancelled || stockSearchSeqRef.current !== sequence) {
            return;
          }
          setStockResults([]);
          setStockError('标的列表暂时不可用');
        })
        .finally(() => {
          if (cancelled || stockSearchSeqRef.current !== sequence) {
            return;
          }
          setStockLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [connected, searchFunds, searchStocks, stockMenuKind, stockMenuOpen, stockQuery]);

    useEffect(() => {
      if (!stockMenuOpen || stockMenuSource !== 'toolbar') {
        return;
      }
      const frame = window.requestAnimationFrame(() => {
        stockToolbarSearchInputRef.current?.focus();
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }, [stockMenuKind, stockMenuOpen, stockMenuSource]);

    useEffect(() => {
      stockListRef.current?.scrollTo({top: 0});
    }, [stockMenuKind, stockMenuOpen, stockQuery]);

    useEffect(() => {
      if (!visibleTopBarControlKeys.has('mode') || (selectedMode && !findStaticOption(modeOptions, selectedMode))) {
        setSelectedMode(null);
      }
    }, [modeOptions, selectedMode, visibleTopBarControlKeys]);

    useEffect(() => {
      if (
        !visibleTopBarControlKeys.has('market-scope') ||
        (selectedMarketScope && !findStaticOption(marketScopeOptions, selectedMarketScope))
      ) {
        setSelectedMarketScope(null);
      }
    }, [marketScopeOptions, selectedMarketScope, visibleTopBarControlKeys]);

    useEffect(() => {
      if (!visibleTopBarControlKeys.has('watchlist') || (selectedWatchlist && !findStaticOption(watchlistOptions, selectedWatchlist))) {
        setSelectedWatchlist(null);
      }
    }, [selectedWatchlist, visibleTopBarControlKeys, watchlistOptions]);

    useEffect(() => {
      if (!visibleTopBarControlKeys.has('output-format') || (selectedOutput && !findStaticOption(outputOptions, selectedOutput))) {
        setSelectedOutput(null);
      }
    }, [outputOptions, selectedOutput, visibleTopBarControlKeys]);

    useEffect(() => {
      const handleSelectionChange = () => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) {
          return;
        }
        const range = selection.getRangeAt(0);
        if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
          savedRangeRef.current = range.cloneRange();
          if (mentionMenuOpen && mentionMenuSource === 'typing') {
            const mentionMatch = findTriggerMatchBeforeCaret('@');
            if (!mentionMatch) {
              closeMentionMenu();
            } else {
              syncMentionMenuPosition();
            }
          }
          if (stockMenuOpen && pendingStockTriggerRef.current) {
            const match = findTriggerMatchBeforeCaret('#');
            if (!match) {
              closeStockMenu();
              return;
            }
            if (match.query !== stockQuery) {
              setStockQuery(match.query);
            }
            syncStockMenuPosition();
          }
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [closeMentionMenu, closeStockMenu, findTriggerMatchBeforeCaret, mentionMenuOpen, mentionMenuSource, stockMenuOpen, stockQuery, syncMentionMenuPosition, syncStockMenuPosition]);

    useEffect(() => {
      if (!modelMenuOpen && !mentionMenuOpen && !stockMenuOpen && !skillMenuOpen && !modeMenuOpen && !marketMenuOpen && !watchlistMenuOpen && !outputMenuOpen) {
        return;
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        if (
          modelMenuRef.current?.contains(target) ||
          mentionToolbarRef.current?.contains(target) ||
          mentionFloatingMenuRef.current?.contains(target) ||
          stockToolbarRef.current?.contains(target) ||
          fundToolbarRef.current?.contains(target) ||
          stockFloatingMenuRef.current?.contains(target) ||
          skillMenuRef.current?.contains(target) ||
          modeMenuRef.current?.contains(target) ||
          marketMenuRef.current?.contains(target) ||
          watchlistMenuRef.current?.contains(target) ||
          outputMenuRef.current?.contains(target)
        ) {
          return;
        }
        setModelMenuOpen(false);
        closeMentionMenu();
        closeStockMenu();
        closeSkillMenu();
        closeModeMenu();
        closeMarketMenu();
        closeWatchlistMenu();
        closeOutputMenu();
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setModelMenuOpen(false);
          closeMentionMenu();
          closeStockMenu();
          closeSkillMenu();
          closeModeMenu();
          closeMarketMenu();
          closeWatchlistMenu();
          closeOutputMenu();
        }
      };

      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [
      closeMarketMenu,
      closeMentionMenu,
      closeModeMenu,
      closeOutputMenu,
      closeSkillMenu,
      closeStockMenu,
      closeWatchlistMenu,
      marketMenuOpen,
      mentionMenuOpen,
      modeMenuOpen,
      modelMenuOpen,
      outputMenuOpen,
      skillMenuOpen,
      stockMenuOpen,
      watchlistMenuOpen,
    ]);

    useEffect(() => {
      if (!connected || sessionTransitioning) {
        setModelMenuOpen(false);
        closeMentionMenu();
        closeStockMenu();
        closeSkillMenu();
        closeModeMenu();
        closeMarketMenu();
        closeWatchlistMenu();
        closeOutputMenu();
      }
    }, [closeMarketMenu, closeMentionMenu, closeModeMenu, closeOutputMenu, closeSkillMenu, closeStockMenu, closeWatchlistMenu, connected, sessionTransitioning]);

    useEffect(() => {
      if (
        !(mentionMenuOpen && mentionMenuSource === 'typing') &&
        !(stockMenuOpen && stockMenuSource === 'typing')
      ) {
        return;
      }

      const handleViewportChange = () => {
        if (mentionMenuOpen && mentionMenuSource === 'typing') {
          syncMentionMenuPosition();
        }
        if (stockMenuOpen && stockMenuSource === 'typing') {
          syncStockMenuPosition();
        }
      };

      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, true);
      return () => {
        window.removeEventListener('resize', handleViewportChange);
        window.removeEventListener('scroll', handleViewportChange, true);
      };
    }, [mentionMenuOpen, mentionMenuSource, stockMenuOpen, stockMenuSource, syncMentionMenuPosition, syncStockMenuPosition]);

    const composerBusy = busy || isSubmitting;
    const showAbortAction = composerBusy && !hasContent;
    const submitLabel = showAbortAction ? '停止' : busy && hasContent ? '加入队列' : '发送';
    const sendState = showAbortAction ? 'busy' : hasContent ? 'ready' : 'empty';
    const submitDisabledReason =
      sendDisabledReason ||
      (!connected && !queueWhileConnecting
        ? '等待网关连接后才能发送'
        : !composerBusy && !hasContent
          ? '输入内容后才能发送'
          : null);
    const selectedModel =
      findComposerModelOption(modelOptions, selectedModelId) ?? modelOptions[0] ?? null;
    const modelTriggerLabel = (() => {
      if (!connected) {
        return '模型未连接';
      }
      if (selectedModel) {
        return selectedModel.label;
      }
      if (modelsLoading) {
        return '模型加载中';
      }
      return '选择模型';
    })();
    const modelTriggerDetail = (() => {
      if (!connected) {
        return '等待网关连接';
      }
      if (selectedModel) {
        return selectedModel.badge ? `${selectedModel.badge} · ${selectedModel.detail}` : selectedModel.detail;
      }
      return modelsLoading ? '同步可用模型中' : '当前暂无可用模型';
    })();
    const modelTriggerWidth = (() => {
      const minWidth = 188;
      const maxWidth = 312;
      const textWeight = Math.max(modelTriggerLabel.length, Math.ceil(modelTriggerDetail.length * 0.78));
      return `${Math.min(maxWidth, Math.max(minWidth, Math.round(108 + textWeight * 8.2)))}px`;
    })();
    const modelTriggerStyle = {
      '--iclaw-model-trigger-width': modelTriggerWidth,
    } as CSSProperties;
    const modelVisualLoading = sessionTransitioning || modelsLoading || modelSwitching;
    const modelDisabled =
      !connected || composerBusy || sessionTransitioning || modelSwitching || modelOptions.length === 0;
    const selectedAgent = lobsterAgents.find((option) => option.slug === selectedAgentSlug) ?? null;
    const selectedSkill =
      skillOptions.find((option) => option.slug === selectedSkillSlug) ??
      (selectedSkillSlug && initialSelectedSkillOption?.slug === selectedSkillSlug ? initialSelectedSkillOption : null);
    const selectedModeOption = findStaticOption(modeOptions, selectedMode);
    const selectedMarketScopeOption = findStaticOption(marketScopeOptions, selectedMarketScope);
    const selectedStockContextLabel = formatStockContextLabel(selectedStockContext);
    const selectedInstrumentTypeLabel = resolveInstrumentContextTypeLabel(selectedStockContext);
    const selectedWatchlistOption = findStaticOption(watchlistOptions, selectedWatchlist);
    const selectedOutputOption = findStaticOption(outputOptions, selectedOutput);
    const expertControl = topBarControlMap.get('expert')?.item || null;
    const skillControl = topBarControlMap.get('skill')?.item || null;
    const modeControl = topBarControlMap.get('mode')?.item || null;
    const marketScopeControl = topBarControlMap.get('market-scope')?.item || null;
    const stockControl =
      topBarControlMap.get('stock-context')?.item ||
      (searchStocks
        ? {
            controlKey: 'stock-context',
            displayName: findDefaultTopBarControl('stock-context')?.displayName || '选择股票',
            controlType: 'stock',
            iconKey: null,
            sortOrder: findDefaultTopBarControl('stock-context')?.sortOrder || 50,
            options: [],
            metadata: {},
            config: {},
          }
        : null);
    const fundControl =
      topBarControlMap.get('fund-context')?.item ||
      (searchFunds
        ? {
            controlKey: 'fund-context',
            displayName: findDefaultTopBarControl('fund-context')?.displayName || '选择基金/ETF',
            controlType: 'fund',
            iconKey: null,
            sortOrder: findDefaultTopBarControl('fund-context')?.sortOrder || 60,
            options: [],
            metadata: {},
            config: {},
          }
        : null);
    const watchlistControl = topBarControlMap.get('watchlist')?.item || null;
    const outputControl = topBarControlMap.get('output-format')?.item || null;
    const creditEstimateText = creditEstimate
      ? creditEstimate.loading
        ? '正在估算龙虾币...'
        : creditEstimate.error
          ? '龙虾币估算暂不可用'
          : typeof creditEstimate.low === 'number' && typeof creditEstimate.high === 'number'
            ? creditEstimate.low === creditEstimate.high
              ? `约 ${creditEstimate.low} 龙虾币`
              : `约 ${creditEstimate.low}-${creditEstimate.high} 龙虾币`
            : null
      : null;
    const creditEstimateState = creditEstimate?.error ? 'error' : creditEstimate?.loading ? 'loading' : 'ready';
    const expertTriggerLabel = selectedAgent?.name ?? expertControl?.displayName ?? '选择专家';
    const skillTriggerLabel = selectedSkill?.name ?? skillControl?.displayName ?? '选择技能';
    const modeTriggerLabel = selectedModeOption?.label ?? modeControl?.displayName ?? '选择模式';
    const marketTriggerLabel = selectedMarketScopeOption?.label ?? marketScopeControl?.displayName ?? '选择市场';
    const selectedContextKind: ComposerInstrumentMenuKind | null =
      selectedStockContext?.instrumentKind === 'fund' ||
      selectedStockContext?.instrumentKind === 'etf' ||
      selectedStockContext?.instrumentKind === 'qdii'
        ? 'fund'
        : selectedStockContext
          ? 'stock'
          : null;
    const stockTriggerLabel =
      selectedContextKind === 'stock' ? selectedStockContextLabel ?? stockControl?.displayName ?? '选择股票' : stockControl?.displayName ?? '选择股票';
    const fundTriggerLabel =
      selectedContextKind === 'fund'
        ? selectedStockContextLabel ?? fundControl?.displayName ?? '选择基金/ETF'
        : fundControl?.displayName ?? '选择基金/ETF';
    const stockMenuStatusLabel = stockLoading
      ? '搜索中'
      : stockQuery.trim()
        ? `匹配 ${stockResults.length}`
        : selectedStockContext
          ? selectedInstrumentTypeLabel
          : stockMenuKind === 'stock'
            ? '股票'
            : '基金/ETF';
    const watchlistTriggerLabel = selectedWatchlistOption?.label ?? watchlistControl?.displayName ?? '选择自选组';
    const outputTriggerLabel = selectedOutputOption?.label ?? outputControl?.displayName ?? '输出模版';
    const stockControlVisible = Boolean(searchStocks && stockControl);
    const fundControlVisible = Boolean(searchFunds && fundControl);
    const stockControlOrder =
      topBarControlMap.get('stock-context')?.order ??
      findDefaultTopBarControl('stock-context')?.sortOrder ??
      50;
    const fundControlOrder =
      topBarControlMap.get('fund-context')?.order ??
      findDefaultTopBarControl('fund-context')?.sortOrder ??
      60;
    const hasActiveSelections =
      (visibleTopBarControlKeys.has('expert') && Boolean(selectedAgent)) ||
      (visibleTopBarControlKeys.has('skill') && Boolean(selectedSkill)) ||
      (visibleTopBarControlKeys.has('mode') && Boolean(selectedModeOption)) ||
      (visibleTopBarControlKeys.has('market-scope') && Boolean(selectedMarketScopeOption)) ||
      Boolean(selectedStockContext) ||
      (visibleTopBarControlKeys.has('watchlist') && Boolean(selectedWatchlistOption)) ||
      (visibleTopBarControlKeys.has('output-format') && Boolean(selectedOutputOption));
    useEffect(() => {
      const shell = inputShellRef.current;
      if (!shell) {
        return;
      }

      const syncActiveControlsHeight = () => {
        const nextHeight = hasActiveSelections
          ? Math.ceil(activeControlsRef.current?.getBoundingClientRect().height ?? 0)
          : 0;
        shell.style.setProperty('--iclaw-composer-active-controls-height', `${nextHeight}px`);
      };

      syncActiveControlsHeight();

      if (!hasActiveSelections || typeof ResizeObserver === 'undefined' || !activeControlsRef.current) {
        return () => {
          shell.style.setProperty('--iclaw-composer-active-controls-height', '0px');
        };
      }

      const observer = new ResizeObserver(() => {
        syncActiveControlsHeight();
      });
      observer.observe(activeControlsRef.current);
      return () => {
        observer.disconnect();
        shell.style.setProperty('--iclaw-composer-active-controls-height', '0px');
      };
    }, [
      hasActiveSelections,
      selectedAgentSlug,
      selectedSkillSlug,
      selectedMode,
      selectedMarketScope,
      selectedStockContext?.id,
      selectedWatchlist,
      selectedOutput,
    ]);
    const stockSearchPlaceholder =
      stockMenuKind === 'stock' ? '搜索股票代码或名称' : '搜索基金、ETF 或代码';
    const stockMenuSearchVisible = stockMenuSource === 'toolbar';
    const expertMenuView = selectorRecentViews.expert;
    const skillMenuView = selectorRecentViews.skill;
    const modeMenuView = selectorRecentViews.mode;
    const marketMenuView = selectorRecentViews.market;
    const watchlistMenuView = selectorRecentViews.watchlist;
    const outputMenuView = selectorRecentViews.output;
    const renderSelectorViewSwitcher = (
      menuKey: SelectorRecentMenuKey,
      currentView: SelectorRecentView,
      label: string,
      hasRecent: boolean,
    ) => {
      if (!hasRecent) {
        return null;
      }
      return (
        <div className="iclaw-composer__selector-view-switcher" role="tablist" aria-label={`${label}视图`}>
          <button
            type="button"
            className="iclaw-composer__selector-view-tab"
            role="tab"
            aria-selected={currentView === 'recent'}
            data-active={currentView === 'recent' ? 'true' : 'false'}
            onClick={() => setSelectorRecentView(menuKey, 'recent')}
          >
            最近
          </button>
          <button
            type="button"
            className="iclaw-composer__selector-view-tab"
            role="tab"
            aria-selected={currentView === 'all'}
            data-active={currentView === 'all' ? 'true' : 'false'}
            onClick={() => setSelectorRecentView(menuKey, 'all')}
          >
            全部
          </button>
        </div>
      );
    };
    const handleStockListScroll = (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceToBottom <= STOCK_MENU_SCROLL_THRESHOLD) {
        loadMoreStockResults();
      }
    };

    const mentionMenuPanel = (
      <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--expert" role="dialog" aria-label="选择专家">
        <div className="iclaw-composer__selector-menu-header">
          <div className="iclaw-composer__selector-menu-header-copy">
            <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
            <span className="iclaw-composer__selector-menu-title">{expertControl?.displayName || '选择专家'}</span>
            <span className="iclaw-composer__selector-menu-subtitle">优先指定由哪位专家接管本次回答</span>
          </div>
          <span className="iclaw-composer__selector-menu-pill">{selectedAgent ? '已指定' : '默认'}</span>
        </div>
        <div className="iclaw-composer__selector-menu-body">
          {renderSelectorViewSwitcher('expert', expertMenuView, '专家', recentAgentOptions.length > 0)}
          <div className="iclaw-composer__selector-section-title">默认</div>
          <button
            type="button"
            className="iclaw-composer__skill-option"
            data-active={selectedAgent ? 'false' : 'true'}
            onClick={() => clearAgentMentions()}
          >
            <span className="iclaw-composer__skill-option-main">
              <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--expert iclaw-composer__selector-icon--menu">
                <AtSign className="h-3.5 w-3.5" />
              </span>
              <span className="iclaw-composer__skill-option-copy">
                <span className="iclaw-composer__skill-option-label">默认专家</span>
                <span className="iclaw-composer__skill-option-detail">系统自动匹配最合适的专家</span>
              </span>
            </span>
            {!selectedAgent ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
          </button>
          {expertMenuView === 'recent' ? (
            <>
              {recentAgentOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
              <div className="iclaw-composer__selector-recent-list">
                {recentAgentOptions.map((agent) => (
                  <button
                    key={agent.slug}
                    type="button"
                    className="iclaw-composer__skill-option"
                    data-active={selectedAgent?.slug === agent.slug ? 'true' : 'false'}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertAgentMention(agent)}
                  >
                    <span className="iclaw-composer__skill-option-main">
                      <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--expert iclaw-composer__selector-icon--menu">
                        <img src={agent.avatarSrc} alt={agent.name} className="iclaw-composer__selector-avatar-image" />
                      </span>
                      <span className="iclaw-composer__skill-option-copy">
                        <span className="iclaw-composer__skill-option-label">{agent.name}</span>
                        <span className="iclaw-composer__skill-option-detail">快速指定该专家接管本轮回答</span>
                      </span>
                    </span>
                    {selectedAgent?.slug === agent.slug ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
              {recentAgentOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的专家</div> : null}
            </>
          ) : null}
          {expertMenuView === 'all' && lobsterAgents.length > 0 ? <div className="iclaw-composer__selector-section-title">已安装专家</div> : null}
        </div>
        {expertMenuView === 'all' && lobsterAgents.length > 0 ? (
          <div className="iclaw-composer__mention-grid">
            {lobsterAgents.map((agent) => (
              <button
                key={agent.slug}
                type="button"
                className="iclaw-composer__mention-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertAgentMention(agent)}
              >
                <span className="iclaw-composer__mention-avatar">
                  <img src={agent.avatarSrc} alt={agent.name} className="iclaw-composer__mention-avatar-image" />
                </span>
                <span className="iclaw-composer__mention-name">{agent.name}</span>
              </button>
            ))}
          </div>
        ) : expertMenuView === 'all' ? (
          <div className="iclaw-composer__mention-empty">还没有已安装的龙虾专家</div>
        ) : null}
      </div>
    );

    const stockMenuControl = stockMenuKind === 'stock' ? stockControl : fundControl;
    const stockMenuPanelTitle = stockMenuControl?.displayName || (stockMenuKind === 'stock' ? '选择股票' : '选择基金/ETF');
    const stockMenuPanel = (
      <div
        className="iclaw-composer__selector-menu iclaw-composer__selector-menu--compact iclaw-composer__selector-menu--stock"
        role="menu"
        aria-label={stockMenuPanelTitle}
      >
        <div className="iclaw-composer__selector-menu-header">
          <div className="iclaw-composer__selector-menu-header-copy">
            <span className="iclaw-composer__selector-menu-kicker">标的上下文</span>
            <span className="iclaw-composer__selector-menu-title">{stockMenuPanelTitle}</span>
            <span className="iclaw-composer__selector-menu-subtitle">
              {stockQuery.trim()
                ? `正在匹配 “#${stockQuery.trim()}”`
                : selectedStockContext
                  ? stockMenuKind === 'stock'
                    ? `当前已绑定${selectedInstrumentTypeLabel}，也可以切换成其它股票`
                    : `当前已绑定${selectedInstrumentTypeLabel}，也可以切换成其它基金或 ETF`
                  : stockMenuKind === 'stock'
                    ? '当前支持搜索股票；从市场页进入时会自动带入对应标的'
                    : '当前支持搜索基金和 ETF；从市场页进入时会自动带入对应标的'}
            </span>
          </div>
          <span className="iclaw-composer__selector-menu-pill">{stockMenuStatusLabel}</span>
        </div>
        {stockMenuSearchVisible ? (
          <div className="iclaw-composer__selector-search">
            <span className="iclaw-composer__selector-search-icon" aria-hidden="true">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              ref={stockToolbarSearchInputRef}
              type="text"
              className="iclaw-composer__selector-search-input"
              value={stockQuery}
              onChange={(event) => setStockQuery(event.target.value)}
              placeholder={stockSearchPlaceholder}
              aria-label={stockSearchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        <div ref={stockListRef} className="iclaw-composer__skill-list iclaw-composer__skill-list--stock" onScroll={handleStockListScroll}>
          <div className="iclaw-composer__selector-section-title">默认</div>
          <button
            type="button"
            className="iclaw-composer__skill-option"
            data-active={selectedStockContext ? 'false' : 'true'}
            onClick={() => clearStockSelection()}
          >
            <span className="iclaw-composer__skill-option-main">
              <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--stock iclaw-composer__selector-icon--menu">
                <BarChart3 className="h-3.5 w-3.5" />
              </span>
              <span className="iclaw-composer__skill-option-copy">
                <span className="iclaw-composer__skill-option-label">默认标的</span>
                <span className="iclaw-composer__skill-option-detail">不绑定单一标的上下文</span>
              </span>
            </span>
            {!selectedStockContext ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
          </button>
          <div className="iclaw-composer__selector-section-title">
            {stockQuery.trim() ? '搜索结果' : stockMenuKind === 'stock' ? '热门股票' : '热门基金 / ETF'}
          </div>
          {stockLoading ? (
            <div className="iclaw-composer__mention-empty">正在加载标的列表...</div>
          ) : stockError ? (
            <div className="iclaw-composer__mention-empty">{stockError}</div>
          ) : stockResults.length > 0 ? (
            stockResults.map((stock) => {
              const active = selectedStockContext?.id === stock.id;
              return (
                <button
                  key={stock.id}
                  type="button"
                  className="iclaw-composer__skill-option"
                  data-active={active ? 'true' : 'false'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertStockMention(stock)}
                >
                  <span className="iclaw-composer__skill-option-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--stock iclaw-composer__selector-icon--menu">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__skill-option-copy">
                      <span className="iclaw-composer__skill-option-label">{stock.companyName}</span>
                      <span className="iclaw-composer__skill-option-detail">{formatInstrumentOptionDetail(stock)}</span>
                    </span>
                  </span>
                  {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                </button>
              );
            })
          ) : (
            <div className="iclaw-composer__mention-empty">
              {stockQuery.trim()
                ? stockMenuKind === 'stock'
                  ? '没有找到匹配股票，继续输入代码或名称试试。'
                  : '没有找到匹配基金或 ETF，继续输入代码或名称试试。'
                : stockMenuKind === 'stock'
                  ? '暂无可用股票'
                  : '暂无可用基金或 ETF'}
            </div>
          )}
          {stockLoadMoreError ? (
            <button
              type="button"
              className="iclaw-composer__selector-load-more"
              onClick={() => loadMoreStockResults()}
            >
              {stockLoadMoreError}，点击重试
            </button>
          ) : null}
          {stockLoadingMore ? <div className="iclaw-composer__selector-load-hint">正在加载更多...</div> : null}
          {!stockLoading && !stockLoadingMore && stockHasMore ? (
            <div className="iclaw-composer__selector-load-hint">继续下滑加载更多</div>
          ) : null}
        </div>
      </div>
    );

    return (
      <div
        className="iclaw-composer"
        data-drop-active={dropActive ? 'true' : 'false'}
        data-session-transitioning={sessionTransitioning ? 'true' : 'false'}
      >
        <div className="iclaw-composer__halo" aria-hidden="true" />
        <div className="iclaw-composer__panel" data-session-transitioning={sessionTransitioning ? 'true' : 'false'}>
          <div className="iclaw-composer__top">
            <div className="iclaw-composer__selectors">
              {visibleTopBarControlKeys.has('expert') ? (
              <div
                ref={mentionToolbarRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('expert')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="expert"
                  data-active={selectedAgent ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="dialog"
                  aria-expanded={mentionMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (mentionMenuOpen && mentionMenuSource === 'toolbar') {
                      closeMentionMenu();
                      return;
                    }
                    openMentionMenu('toolbar');
                  }}
                  title={selectedAgent ? `当前专家：${selectedAgent.name}，点击${expertControl?.displayName || '选择专家'}` : `点击${expertControl?.displayName || '选择专家'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--expert">
                      {selectedAgent ? (
                        <img
                          src={selectedAgent.avatarSrc}
                          alt={selectedAgent.name}
                          className="iclaw-composer__selector-avatar-image"
                        />
                      ) : (
                        <AtSign className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{expertTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={mentionMenuOpen && mentionMenuSource === 'toolbar' ? 'true' : 'false'} />
                </button>

                {mentionMenuOpen && mentionMenuSource === 'toolbar' ? mentionMenuPanel : null}
              </div>
              ) : null}

              {visibleTopBarControlKeys.has('skill') ? (
              <div
                ref={skillMenuRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('skill')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="skill"
                  data-active={selectedSkill ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={skillMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (skillMenuOpen) {
                      closeSkillMenu();
                      return;
                    }
                    openSkillMenu();
                  }}
                  title={selectedSkill ? `当前技能：${selectedSkill.name}，点击${skillControl?.displayName || '选择技能'}` : `点击${skillControl?.displayName || '选择技能'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--skill">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{skillTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={skillMenuOpen ? 'true' : 'false'} />
                </button>

                {skillMenuOpen ? (
                  <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--skill" role="menu" aria-label="选择技能">
                    <div className="iclaw-composer__selector-menu-header">
                      <div className="iclaw-composer__selector-menu-header-copy">
                        <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
                        <span className="iclaw-composer__selector-menu-title">{skillControl?.displayName || '选择技能'}</span>
                        <span className="iclaw-composer__selector-menu-subtitle">优先启用某个技能的工作方式与工具能力</span>
                      </div>
                      <span className="iclaw-composer__selector-menu-pill">
                        {selectedSkill ? selectedSkill.market : '默认'}
                      </span>
                    </div>
                    <div className="iclaw-composer__skill-list">
                      {renderSelectorViewSwitcher('skill', skillMenuView, '技能', recentSkillOptions.length > 0)}
                      <div className="iclaw-composer__selector-section-title">默认</div>
                      <button
                        type="button"
                        className="iclaw-composer__skill-option"
                        data-active={selectedSkillSlug ? 'false' : 'true'}
                        onClick={() => selectSkill(null)}
                      >
                        <span className="iclaw-composer__skill-option-main">
                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--skill iclaw-composer__selector-icon--menu">
                            <Sparkles className="h-3.5 w-3.5" />
                          </span>
                          <span className="iclaw-composer__skill-option-copy">
                            <span className="iclaw-composer__skill-option-label">默认技能</span>
                            <span className="iclaw-composer__skill-option-detail">系统自动匹配最合适的技能</span>
                          </span>
                        </span>
                        {!selectedSkillSlug ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                      </button>
                      {skillOptions.length > 0 ? (
                        <>
                          {skillMenuView === 'recent' ? (
                            <>
                              {recentSkillOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
                              <div className="iclaw-composer__selector-recent-list">
                                {recentSkillOptions.map((skill) => (
                                  <button
                                    key={skill.slug}
                                    type="button"
                                    className="iclaw-composer__skill-option"
                                    data-active={selectedSkillSlug === skill.slug ? 'true' : 'false'}
                                    onClick={() => selectSkill(skill.slug)}
                                  >
                                    <span className="iclaw-composer__skill-option-main">
                                      <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--skill iclaw-composer__selector-icon--menu">
                                        <Sparkles className="h-3.5 w-3.5" />
                                      </span>
                                      <span className="iclaw-composer__skill-option-copy">
                                        <span className="iclaw-composer__skill-option-label">{skill.name}</span>
                                        <span className="iclaw-composer__skill-option-detail">
                                          {skill.market} · {skill.skillType}
                                        </span>
                                      </span>
                                    </span>
                                    {selectedSkillSlug === skill.slug ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                                  </button>
                                ))}
                              </div>
                              {recentSkillOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的技能</div> : null}
                            </>
                          ) : null}
                          {skillMenuView === 'all'
                            ? groupedSkills.map((group) => (
                                <div key={group.label} className="iclaw-composer__selector-section-block">
                                  <div className="iclaw-composer__selector-section-title">{group.label}</div>
                                  {group.items.map((skill) => {
                                    const active = skill.slug === selectedSkillSlug;
                                    return (
                                      <button
                                        key={skill.slug}
                                        type="button"
                                        className="iclaw-composer__skill-option"
                                        data-active={active ? 'true' : 'false'}
                                        onClick={() => selectSkill(skill.slug)}
                                      >
                                        <span className="iclaw-composer__skill-option-main">
                                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--skill iclaw-composer__selector-icon--menu">
                                            <Sparkles className="h-3.5 w-3.5" />
                                          </span>
                                          <span className="iclaw-composer__skill-option-copy">
                                            <span className="iclaw-composer__skill-option-label">{skill.name}</span>
                                            <span className="iclaw-composer__skill-option-detail">
                                              {skill.market} · {skill.skillType}
                                            </span>
                                          </span>
                                        </span>
                                        {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))
                            : null}
                        </>
                      ) : (
                        <div className="iclaw-composer__mention-empty">还没有可用技能</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {visibleTopBarControlKeys.has('mode') ? (
              <div
                ref={modeMenuRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('mode')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="mode"
                  data-active={selectedModeOption ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={modeMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (modeMenuOpen) {
                      closeModeMenu();
                      return;
                    }
                    openModeMenu();
                  }}
                  title={selectedModeOption ? `当前模式：${selectedModeOption.label}，点击${modeControl?.displayName || '选择模式'}` : `点击${modeControl?.displayName || '选择模式'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--mode">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{modeTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={modeMenuOpen ? 'true' : 'false'} />
                </button>

                {modeMenuOpen ? (
                  <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--compact" role="menu" aria-label="选择模式">
                    <div className="iclaw-composer__selector-menu-header">
                      <div className="iclaw-composer__selector-menu-header-copy">
                        <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
                        <span className="iclaw-composer__selector-menu-title">{modeControl?.displayName || '选择模式'}</span>
                        <span className="iclaw-composer__selector-menu-subtitle">控制分析深度、展开程度与交付节奏</span>
                      </div>
                      <span className="iclaw-composer__selector-menu-pill">{selectedModeOption?.label ?? '默认'}</span>
                    </div>
                    <div className="iclaw-composer__skill-list">
                      {renderSelectorViewSwitcher('mode', modeMenuView, '模式', recentModeOptions.length > 0)}
                      <div className="iclaw-composer__selector-section-title">默认</div>
                      <button
                        type="button"
                        className="iclaw-composer__skill-option"
                        data-active={selectedMode ? 'false' : 'true'}
                        onClick={() => selectMode(null)}
                      >
                        <span className="iclaw-composer__skill-option-main">
                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--mode iclaw-composer__selector-icon--menu">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </span>
                          <span className="iclaw-composer__skill-option-copy">
                            <span className="iclaw-composer__skill-option-label">默认模式</span>
                            <span className="iclaw-composer__skill-option-detail">系统自动选择最合适的回答路径</span>
                          </span>
                        </span>
                        {!selectedMode ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                      </button>
                      {modeMenuView === 'recent' ? (
                        <>
                          {recentModeOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
                          <div className="iclaw-composer__selector-recent-list">
                            {recentModeOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={selectedMode === option.value ? 'true' : 'false'}
                                onClick={() => selectMode(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--mode iclaw-composer__selector-icon--menu">
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {selectedMode === option.value ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            ))}
                          </div>
                          {recentModeOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的模式</div> : null}
                        </>
                      ) : null}
                      {modeMenuView === 'all' ? <div className="iclaw-composer__selector-section-title">可选模式</div> : null}
                      {modeMenuView === 'all'
                        ? modeOptions.map((option) => {
                            const active = option.value === selectedMode;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={active ? 'true' : 'false'}
                                onClick={() => selectMode(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--mode iclaw-composer__selector-icon--menu">
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            );
                          })
                        : null}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {visibleTopBarControlKeys.has('market-scope') ? (
              <div
                ref={marketMenuRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('market-scope')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="market"
                  data-active={selectedMarketScopeOption ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={marketMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (marketMenuOpen) {
                      closeMarketMenu();
                      return;
                    }
                    openMarketMenu();
                  }}
                  title={selectedMarketScopeOption ? `当前市场范围：${selectedMarketScopeOption.label}，点击${marketScopeControl?.displayName || '选择市场'}` : `点击${marketScopeControl?.displayName || '选择市场'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--market">
                      <Globe className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{marketTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={marketMenuOpen ? 'true' : 'false'} />
                </button>

                {marketMenuOpen ? (
                  <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--compact" role="menu" aria-label="选择市场范围">
                    <div className="iclaw-composer__selector-menu-header">
                      <div className="iclaw-composer__selector-menu-header-copy">
                        <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
                        <span className="iclaw-composer__selector-menu-title">{marketScopeControl?.displayName || '选择市场'}</span>
                        <span className="iclaw-composer__selector-menu-subtitle">约束本次分析优先覆盖的市场范围</span>
                      </div>
                      <span className="iclaw-composer__selector-menu-pill">{selectedMarketScopeOption?.label ?? '默认'}</span>
                    </div>
                    <div className="iclaw-composer__skill-list">
                      {renderSelectorViewSwitcher('market', marketMenuView, '市场', recentMarketOptions.length > 0)}
                      <div className="iclaw-composer__selector-section-title">默认</div>
                      <button
                        type="button"
                        className="iclaw-composer__skill-option"
                        data-active={selectedMarketScope ? 'false' : 'true'}
                        onClick={() => selectMarketScope(null)}
                      >
                        <span className="iclaw-composer__skill-option-main">
                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--market iclaw-composer__selector-icon--menu">
                            <Globe className="h-3.5 w-3.5" />
                          </span>
                          <span className="iclaw-composer__skill-option-copy">
                            <span className="iclaw-composer__skill-option-label">默认范围</span>
                            <span className="iclaw-composer__skill-option-detail">系统自动识别问题对应的市场范围</span>
                          </span>
                        </span>
                        {!selectedMarketScope ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                      </button>
                      {marketMenuView === 'recent' ? (
                        <>
                          {recentMarketOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
                          <div className="iclaw-composer__selector-recent-list">
                            {recentMarketOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={selectedMarketScope === option.value ? 'true' : 'false'}
                                onClick={() => selectMarketScope(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--market iclaw-composer__selector-icon--menu">
                                    <Globe className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {selectedMarketScope === option.value ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            ))}
                          </div>
                          {recentMarketOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的市场范围</div> : null}
                        </>
                      ) : null}
                      {marketMenuView === 'all' ? <div className="iclaw-composer__selector-section-title">可选范围</div> : null}
                      {marketMenuView === 'all'
                        ? marketScopeOptions.map((option) => {
                            const active = option.value === selectedMarketScope;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={active ? 'true' : 'false'}
                                onClick={() => selectMarketScope(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--market iclaw-composer__selector-icon--menu">
                                    <Globe className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            );
                          })
                        : null}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {stockControlVisible ? (
              <div
                ref={stockToolbarRef}
                className="iclaw-composer__selector"
                style={{order: stockControlOrder}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="stock"
                  data-active={selectedContextKind === 'stock' ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={stockMenuOpen && stockMenuKind === 'stock'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'stock') {
                      closeStockMenu();
                      return;
                    }
                    openStockMenu('toolbar', 'stock');
                  }}
                  title={selectedContextKind === 'stock' ? `当前股票：${stockTriggerLabel}，点击切换股票` : `${stockControl?.displayName || '选择股票'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--stock">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{stockTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'stock' ? 'true' : 'false'} />
                </button>

                {stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'stock' ? stockMenuPanel : null}
              </div>
              ) : null}

              {fundControlVisible ? (
              <div
                ref={fundToolbarRef}
                className="iclaw-composer__selector"
                style={{order: fundControlOrder}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="stock"
                  data-active={selectedContextKind === 'fund' ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={stockMenuOpen && stockMenuKind === 'fund'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'fund') {
                      closeStockMenu();
                      return;
                    }
                    openStockMenu('toolbar', 'fund');
                  }}
                  title={selectedContextKind === 'fund' ? `当前基金：${fundTriggerLabel}，点击切换基金` : `${fundControl?.displayName || '选择基金/ETF'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--stock">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{fundTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'fund' ? 'true' : 'false'} />
                </button>

                {stockMenuOpen && stockMenuSource === 'toolbar' && stockMenuKind === 'fund' ? stockMenuPanel : null}
              </div>
              ) : null}

              {visibleTopBarControlKeys.has('watchlist') ? (
              <div
                ref={watchlistMenuRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('watchlist')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="watchlist"
                  data-active={selectedWatchlistOption ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={watchlistMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (watchlistMenuOpen) {
                      closeWatchlistMenu();
                      return;
                    }
                    openWatchlistMenu();
                  }}
                  title={selectedWatchlistOption ? `当前自选组：${selectedWatchlistOption.label}，点击${watchlistControl?.displayName || '选择自选组'}` : `点击${watchlistControl?.displayName || '选择自选组'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--watchlist">
                      <Star className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{watchlistTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={watchlistMenuOpen ? 'true' : 'false'} />
                </button>

                {watchlistMenuOpen ? (
                  <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--compact" role="menu" aria-label="选择自选组">
                    <div className="iclaw-composer__selector-menu-header">
                      <div className="iclaw-composer__selector-menu-header-copy">
                        <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
                        <span className="iclaw-composer__selector-menu-title">{watchlistControl?.displayName || '选择自选组'}</span>
                        <span className="iclaw-composer__selector-menu-subtitle">约束本次回答优先围绕哪组自选标的展开</span>
                      </div>
                      <span className="iclaw-composer__selector-menu-pill">{selectedWatchlistOption?.label ?? '默认'}</span>
                    </div>
                    <div className="iclaw-composer__skill-list">
                      {renderSelectorViewSwitcher('watchlist', watchlistMenuView, '自选组', recentWatchlistOptions.length > 0)}
                      <div className="iclaw-composer__selector-section-title">默认</div>
                      <button
                        type="button"
                        className="iclaw-composer__skill-option"
                        data-active={selectedWatchlist ? 'false' : 'true'}
                        onClick={() => selectWatchlist(null)}
                      >
                        <span className="iclaw-composer__skill-option-main">
                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--watchlist iclaw-composer__selector-icon--menu">
                            <Star className="h-3.5 w-3.5" />
                          </span>
                          <span className="iclaw-composer__skill-option-copy">
                            <span className="iclaw-composer__skill-option-label">默认自选组</span>
                            <span className="iclaw-composer__skill-option-detail">系统自动判断是否需要结合你的自选股上下文</span>
                          </span>
                        </span>
                        {!selectedWatchlist ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                      </button>
                      {watchlistMenuView === 'recent' ? (
                        <>
                          {recentWatchlistOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
                          <div className="iclaw-composer__selector-recent-list">
                            {recentWatchlistOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={selectedWatchlist === option.value ? 'true' : 'false'}
                                onClick={() => selectWatchlist(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--watchlist iclaw-composer__selector-icon--menu">
                                    <Star className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {selectedWatchlist === option.value ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            ))}
                          </div>
                          {recentWatchlistOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的自选组</div> : null}
                        </>
                      ) : null}
                      {watchlistMenuView === 'all' ? <div className="iclaw-composer__selector-section-title">可选分组</div> : null}
                      {watchlistMenuView === 'all'
                        ? watchlistOptions.map((option) => {
                            const active = option.value === selectedWatchlist;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={active ? 'true' : 'false'}
                                onClick={() => selectWatchlist(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--watchlist iclaw-composer__selector-icon--menu">
                                    <Star className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            );
                          })
                        : null}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {visibleTopBarControlKeys.has('output-format') ? (
              <div
                ref={outputMenuRef}
                className="iclaw-composer__selector"
                style={{order: topBarControlMap.get('output-format')?.order}}
              >
                <button
                  type="button"
                  className="iclaw-composer__selector-trigger"
                  data-tone="output"
                  data-active={selectedOutputOption ? 'true' : 'false'}
                  disabled={!connected}
                  aria-haspopup="menu"
                  aria-expanded={outputMenuOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (outputMenuOpen) {
                      closeOutputMenu();
                      return;
                    }
                    openOutputMenu();
                  }}
                  title={selectedOutputOption ? `当前输出模版：${selectedOutputOption.label}，点击${outputControl?.displayName || '输出模版'}` : `点击${outputControl?.displayName || '输出模版'}`}
                >
                  <span className="iclaw-composer__selector-trigger-main">
                    <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--output">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="iclaw-composer__selector-copy">
                      <span className="iclaw-composer__selector-label">{outputTriggerLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="iclaw-composer__selector-caret h-3.5 w-3.5" data-open={outputMenuOpen ? 'true' : 'false'} />
                </button>

                {outputMenuOpen ? (
                  <div className="iclaw-composer__selector-menu iclaw-composer__selector-menu--compact" role="menu" aria-label="选择输出模版">
                    <div className="iclaw-composer__selector-menu-header">
                      <div className="iclaw-composer__selector-menu-header-copy">
                        <span className="iclaw-composer__selector-menu-kicker">回答路径控制</span>
                        <span className="iclaw-composer__selector-menu-title">{outputControl?.displayName || '输出模版'}</span>
                        <span className="iclaw-composer__selector-menu-subtitle">控制答案的最终结构和呈现方式</span>
                      </div>
                      <span className="iclaw-composer__selector-menu-pill">{selectedOutputOption?.label ?? '默认'}</span>
                    </div>
                    <div className="iclaw-composer__skill-list">
                      {renderSelectorViewSwitcher('output', outputMenuView, '输出模版', recentOutputOptions.length > 0)}
                      <div className="iclaw-composer__selector-section-title">默认</div>
                      <button
                        type="button"
                        className="iclaw-composer__skill-option"
                        data-active={selectedOutput ? 'false' : 'true'}
                        onClick={() => selectOutput(null)}
                      >
                        <span className="iclaw-composer__skill-option-main">
                          <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--output iclaw-composer__selector-icon--menu">
                            <FileText className="h-3.5 w-3.5" />
                          </span>
                          <span className="iclaw-composer__skill-option-copy">
                            <span className="iclaw-composer__skill-option-label">默认输出</span>
                            <span className="iclaw-composer__skill-option-detail">系统自动选择最合适的输出结构</span>
                          </span>
                        </span>
                        {!selectedOutput ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                      </button>
                      {outputMenuView === 'recent' ? (
                        <>
                          {recentOutputOptions.length > 0 ? <div className="iclaw-composer__selector-section-title">最近使用</div> : null}
                          <div className="iclaw-composer__selector-recent-list">
                            {recentOutputOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={selectedOutput === option.value ? 'true' : 'false'}
                                onClick={() => selectOutput(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--output iclaw-composer__selector-icon--menu">
                                    <FileText className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {selectedOutput === option.value ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            ))}
                          </div>
                          {recentOutputOptions.length === 0 ? <div className="iclaw-composer__mention-empty">还没有最近使用的输出模版</div> : null}
                        </>
                      ) : null}
                      {outputMenuView === 'all' ? <div className="iclaw-composer__selector-section-title">可选输出</div> : null}
                      {outputMenuView === 'all'
                        ? outputOptions.map((option) => {
                            const active = option.value === selectedOutput;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className="iclaw-composer__skill-option"
                                data-active={active ? 'true' : 'false'}
                                onClick={() => selectOutput(option.value)}
                              >
                                <span className="iclaw-composer__skill-option-main">
                                  <span className="iclaw-composer__selector-icon iclaw-composer__selector-icon--output iclaw-composer__selector-icon--menu">
                                    <FileText className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="iclaw-composer__skill-option-copy">
                                    <span className="iclaw-composer__skill-option-label">{option.label}</span>
                                    <span className="iclaw-composer__skill-option-detail">{option.detail}</span>
                                  </span>
                                </span>
                                {active ? <Check className="iclaw-composer__skill-option-check h-4 w-4" /> : null}
                              </button>
                            );
                          })
                        : null}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}
            </div>
          </div>

          <div className="iclaw-composer__middle">
            <button
              type="button"
              className="iclaw-composer__add"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected}
              aria-label="添加附件"
              title="添加附件"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            <div
              ref={inputShellRef}
              className="iclaw-composer__input-shell"
              data-has-active-controls={hasActiveSelections ? 'true' : 'false'}
              onMouseDown={(event) => {
                const target = event.target as HTMLElement | null;
                if (
                  target?.closest(
                    'button, a, input, select, textarea, [role="button"], [role="menuitem"], [data-token-remove]',
                  )
                ) {
                  return;
                }
                window.requestAnimationFrame(() => {
                  editorRef.current?.focus();
                });
              }}
            >
              {hasActiveSelections ? (
                <div ref={activeControlsRef} className="iclaw-composer__active-controls" aria-label="当前已选控制项">
                  {visibleTopBarControlKeys.has('expert') && selectedAgent ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="expert"
                      onClick={() => clearAgentMentions()}
                      title={`移除专家：${selectedAgent.name}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon iclaw-composer__active-chip-icon--avatar">
                          <img src={selectedAgent.avatarSrc} alt={selectedAgent.name} className="iclaw-composer__active-chip-avatar" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">专家 · {selectedAgent.name}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {visibleTopBarControlKeys.has('skill') && selectedSkill ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="skill"
                      onClick={() => setSelectedSkillSlug(null)}
                      title={`移除 Skill：${selectedSkill.name}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">Skill · {selectedSkill.name}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {visibleTopBarControlKeys.has('mode') && selectedModeOption ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="mode"
                      onClick={() => setSelectedMode(null)}
                      title={`移除模式：${selectedModeOption.label}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">模式 · {selectedModeOption.label}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {visibleTopBarControlKeys.has('market-scope') && selectedMarketScopeOption ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="market"
                      onClick={() => setSelectedMarketScope(null)}
                      title={`移除市场范围：${selectedMarketScopeOption.label}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <Globe className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">市场范围 · {selectedMarketScopeOption.label}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {selectedStockContext ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="stock"
                      onClick={() => clearStockSelection()}
                      title={`移除标的：${stockTriggerLabel}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <BarChart3 className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">标的 · {stockTriggerLabel}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {visibleTopBarControlKeys.has('watchlist') && selectedWatchlistOption ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="watchlist"
                      onClick={() => setSelectedWatchlist(null)}
                      title={`移除自选股：${selectedWatchlistOption.label}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <Star className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">自选股 · {selectedWatchlistOption.label}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}

                  {visibleTopBarControlKeys.has('output-format') && selectedOutputOption ? (
                    <button
                      type="button"
                      className="iclaw-composer__active-chip"
                      data-tone="output"
                      onClick={() => setSelectedOutput(null)}
                      title={`移除输出：${selectedOutputOption.label}`}
                    >
                      <span className="iclaw-composer__active-chip-main">
                        <span className="iclaw-composer__active-chip-icon">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                        <span className="iclaw-composer__active-chip-text">输出 · {selectedOutputOption.label}</span>
                      </span>
                      <span className="iclaw-composer__active-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {mentionMenuOpen && mentionMenuSource === 'typing' && mentionMenuPosition ? (
                <div
                  ref={mentionFloatingMenuRef}
                  className="iclaw-composer__floating-menu"
                  style={{left: mentionMenuPosition.left, top: mentionMenuPosition.top}}
                >
                  {mentionMenuPanel}
                </div>
              ) : null}

              {stockMenuOpen && stockMenuSource === 'typing' && stockMenuPosition ? (
                <div
                  ref={stockFloatingMenuRef}
                  className="iclaw-composer__floating-menu"
                  style={{left: stockMenuPosition.left, top: stockMenuPosition.top}}
                >
                  {stockMenuPanel}
                </div>
              ) : null}

              {!hasContent ? (
                <div className="iclaw-composer__placeholder" aria-hidden="true">
                  {connected ? composerPlaceholder : '网关未连接，暂时无法发送'}
                </div>
              ) : null}
              <div
                ref={editorRef}
                className="iclaw-composer__editor"
                contentEditable={connected}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="聊天输入框"
                data-empty="true"
                onInput={() => {
                  refreshState();
                  if (mentionMenuOpen && mentionMenuSource === 'typing' && pendingMentionTriggerRef.current) {
                    const mentionMatch = findTriggerMatchBeforeCaret('@');
                    if (!mentionMatch) {
                      closeMentionMenu();
                    } else {
                      syncMentionMenuPosition();
                    }
                  }
                  if (stockMenuOpen && pendingStockTriggerRef.current) {
                    const match = findTriggerMatchBeforeCaret('#');
                    if (!match) {
                      closeStockMenu();
                      return;
                    }
                    if (match.query !== stockQuery) {
                      setStockQuery(match.query);
                    }
                    syncStockMenuPosition();
                  }
                }}
                onKeyDown={(event) => {
                  const nativeEvent = event.nativeEvent as KeyboardEvent;
                  if (event.key === '@' && !nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    window.requestAnimationFrame(() => {
                      openMentionMenu('typing');
                    });
                  }
                  if (event.key === '#' && !nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    window.requestAnimationFrame(() => {
                      openStockMenu('typing');
                    });
                  }
                  if (event.key === 'Enter' && !nativeEvent.isComposing && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                    return;
                  }
                  if (event.key === 'Enter' && event.shiftKey) {
                    event.preventDefault();
                    const br = document.createElement('br');
                    const fragment = document.createDocumentFragment();
                    fragment.append(br);
                    insertFragmentAtCaret(fragment, br);
                  }
                }}
                onPaste={(event) => {
                  const clipboardItems = Array.from(event.clipboardData?.items ?? []);
                  const files = clipboardItems
                    .map((item) => item.getAsFile())
                    .filter((file): file is File => Boolean(file) && isSupportedAttachment(file as File));

                  if (files.length > 0) {
                    event.preventDefault();
                    void processFiles(files);
                    return;
                  }

                  const text = event.clipboardData?.getData('text/plain') ?? '';
                  if (text) {
                    event.preventDefault();
                    insertTextAtCaret(text);
                  }
                }}
                onMouseDown={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (!target?.dataset.tokenRemove) {
                    return;
                  }
                  event.preventDefault();
                }}
                onClick={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (!target?.dataset.tokenRemove) {
                    const editor = editorRef.current;
                    if (!editor) {
                      return;
                    }
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) {
                      savedRangeRef.current = createRangeAtEnd(editor);
                    }
                    return;
                  }
                  event.preventDefault();
                  const tokenNode = target.closest<HTMLElement>('[data-token-id]');
                  const tokenId = tokenNode?.dataset.tokenId;
                  if (!tokenNode || !tokenId) {
                    return;
                  }
                  const token = tokenStoreRef.current.get(tokenId) ?? null;
                  tokenNode.remove();
                  tokenStoreRef.current.delete(tokenId);
                  if (token?.kind === 'stock') {
                    setSelectedStockContext(null);
                  }
                  if (token?.kind === 'agent') {
                    setSelectedAgentSlug(null);
                  }
                  refreshState();
                  editorRef.current?.focus();
                }}
              />
            </div>
          </div>

          <div className="iclaw-composer__footer">
            <div className="iclaw-composer__footer-main">
              <span className="iclaw-composer__footer-label">快捷方式</span>
              <div className="iclaw-composer__query-list">
                {footerShortcuts.map((query) => (
                  <Chip
                    key={query.shortcutKey}
                    clickable
                    tone="outline"
                    className="iclaw-composer__query-chip"
                    data-query-tone={query.tone}
                    data-active={activeQuickQueryId === query.shortcutKey ? 'true' : 'false'}
                    onClick={() => insertQuickQueryTemplate(query)}
                  >
                    {query.displayName}
                  </Chip>
                ))}
              </div>
              <div className="iclaw-composer__supports">
                <span className="iclaw-composer__credit-slot" aria-live="polite">
                  {creditEstimateText ? (
                    <span className="iclaw-composer__credit-estimate" data-state={creditEstimateState}>
                      {creditEstimateText}
                    </span>
                  ) : null}
                </span>
                <span className="iclaw-composer__support">
                  <ImageIcon className="h-3.5 w-3.5 iclaw-composer__support-icon iclaw-composer__support-icon--rose" />
                  图片
                </span>
                <span className="iclaw-composer__support">
                  <FileText className="h-3.5 w-3.5 iclaw-composer__support-icon iclaw-composer__support-icon--amber" />
                  PDF
                </span>
                <span className="iclaw-composer__support">
                  <Film className="h-3.5 w-3.5 iclaw-composer__support-icon iclaw-composer__support-icon--violet" />
                  视频
                </span>
                {tokenCount > 0 ? <span className="iclaw-composer__meta-count">{tokenCount}</span> : null}
              </div>

              <div className="iclaw-composer__actions">
                <div ref={modelMenuRef} className="iclaw-composer__model-picker">
                  <button
                    type="button"
                    className="iclaw-composer__model-trigger"
                    style={modelTriggerStyle}
                    data-loading={modelVisualLoading ? 'true' : 'false'}
                    disabled={modelDisabled}
                    aria-haspopup="menu"
                    aria-expanded={modelMenuOpen}
                    onClick={() => {
                      closeSkillMenu();
                      closeMentionMenu();
                      setModelMenuOpen((current) => !current);
                    }}
                  >
                    <span className="iclaw-composer__model-trigger-main">
                      <ComposerModelLogo
                        authBaseUrl={authBaseUrl}
                        family={selectedModel?.family ?? 'generic'}
                        logoPresetKey={selectedModel?.logoPresetKey ?? null}
                        className="iclaw-composer__model-logo"
                      />
                      <span className="iclaw-composer__model-copy">
                        <span className="iclaw-composer__model-label">{modelTriggerLabel}</span>
                        <span className="iclaw-composer__model-detail">{modelTriggerDetail}</span>
                      </span>
                    </span>
                    <ChevronDown
                      className="iclaw-composer__model-caret h-3.5 w-3.5"
                      data-open={modelMenuOpen ? 'true' : 'false'}
                    />
                  </button>

                  {modelMenuOpen ? (
                    <div className="iclaw-composer__model-menu" role="menu" aria-label="选择模型">
                      <div className="iclaw-composer__model-menu-header">
                        <span className="iclaw-composer__model-menu-title">选择模型</span>
                      </div>
                      <div className="iclaw-composer__model-section-body">
                        {modelOptions.map((option) => {
                          const active = option.id === selectedModel?.id;
                          const commitModelSelection = () => {
                            setModelMenuOpen(false);
                            void onModelChange(option.id);
                          };
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={active}
                              className="iclaw-composer__model-option"
                              data-active={active ? 'true' : 'false'}
                              onClick={() => {
                                commitModelSelection();
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                  return;
                                }
                                event.preventDefault();
                                commitModelSelection();
                              }}
                            >
                              <span className="iclaw-composer__model-option-main">
                                <ComposerModelLogo
                                  authBaseUrl={authBaseUrl}
                                  family={option.family}
                                  logoPresetKey={option.logoPresetKey}
                                  className="iclaw-composer__model-option-logo"
                                />
                                <span className="iclaw-composer__model-option-label">{option.label}</span>
                              </span>
                              <span className="iclaw-composer__model-option-meta">
                                {option.badge ? <span className="iclaw-composer__model-option-badge">{option.badge}</span> : null}
                                {active ? <Check className="iclaw-composer__model-option-check h-4 w-4" /> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="iclaw-composer__submit"
                  data-state={sendState}
                  disabled={Boolean(submitDisabledReason)}
                  onClick={() => void (showAbortAction ? onAbort() : handleSubmit())}
                  aria-label={submitLabel}
                  title={submitDisabledReason || submitLabel}
                >
                  {showAbortAction ? (
                    <>
                      <span className="iclaw-composer__submit-spinner" aria-hidden="true" />
                      <Square className="relative z-[1] h-[14px] w-[14px]" fill="currentColor" strokeWidth={0} />
                    </>
                  ) : (
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,application/pdf,video/*"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void processFiles(files);
            event.target.value = '';
          }}
        />
      </div>
    );
  },
);
