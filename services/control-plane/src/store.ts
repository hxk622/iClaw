import { randomUUID } from 'node:crypto';

import {config} from './config.ts';
import type {
  AgentCatalogEntryRecord,
  CreatePaymentOrderInput,
  CreateUserInput,
  CreditAccountRecord,
  CreditLedgerRecord,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallSkillInput,
  OAuthAccountRecord,
  OAuthProvider,
  PaymentOrderRecord,
  PaymentProvider,
  PaymentWebhookInput,
  RunBillingSummaryRecord,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UsageEventInput,
  UsageEventResult,
  UserAgentLibraryRecord,
  UserPrivateSkillRecord,
  UserRole,
  UserSkillLibraryRecord,
  UpdateSkillLibraryItemInput,
  UserRecord,
  WorkspaceBackupInput,
  WorkspaceBackupRecord,
} from './domain.ts';
import { DEFAULT_CLAWHUB_SYNC_SOURCE } from './skill-sync-defaults.ts';
import {buildPlaceholderPaymentUrl} from './payment-placeholders.ts';

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function startOfNextShanghaiDayIso(from = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(from);
  const year = Number(parts.find((item) => item.type === 'year')?.value || '1970');
  const month = Number(parts.find((item) => item.type === 'month')?.value || '01');
  const day = Number(parts.find((item) => item.type === 'day')?.value || '01');
  const nextUtc = Date.UTC(year, month - 1, day, 16, 0, 0, 0) + 24 * 60 * 60 * 1000;
  return new Date(nextUtc).toISOString();
}

function expirePaymentOrderIfNeeded(order: PaymentOrderRecord): PaymentOrderRecord {
  if (order.status !== 'pending' || !order.expiredAt) {
    return order;
  }
  if (new Date(order.expiredAt).getTime() > Date.now()) {
    return order;
  }
  return {
    ...order,
    status: 'expired',
    updatedAt: new Date().toISOString(),
  };
}

export interface ControlPlaneStore {
  readonly storageLabel: string;
  getUserByIdentifier(identifier: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null>;
  linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord>;
  unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean>;
  getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]>;
  updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null>;
  updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord>;
  replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null>;
  touchSession(sessionId: string, expiresAt: {
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }): Promise<SessionRecord | null>;
  getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null>;
  getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getCreditAccount(userId: string): Promise<CreditAccountRecord>;
  getCreditBalance(userId: string): Promise<number>;
  getCreditLedger(userId: string): Promise<CreditLedgerRecord[]>;
  createPaymentOrder(userId: string, input: Required<CreatePaymentOrderInput> & {packageName: string; credits: number; bonusCredits: number; amountCnyFen: number;}): Promise<PaymentOrderRecord>;
  getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null>;
  applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null>;
  getRunGrantById(grantId: string): Promise<RunGrantRecord | null>;
  getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null>;
  createRunGrant(input: {
    userId: string;
    sessionKey: string;
    client: string;
    nonce: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    creditLimit: number;
    expiresAt: string;
    signature: string;
  }): Promise<RunGrantRecord>;
  recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult>;
  getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null>;
  saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord>;
  listAgentCatalog(): Promise<AgentCatalogEntryRecord[]>;
  getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null>;
  listSkillCatalog(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalog(): Promise<number>;
  listSkillCatalogAdmin(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalogAdmin(): Promise<number>;
  getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null>;
  upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord>;
  deleteSkillCatalogEntry(slug: string): Promise<boolean>;
  listSkillSyncSources(): Promise<SkillSyncSourceRecord[]>;
  getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null>;
  upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord>;
  deleteSkillSyncSource(id: string): Promise<boolean>;
  listSkillSyncRuns(limit?: number): Promise<SkillSyncRunRecord[]>;
  createSkillSyncRun(input: {
    sourceId: string;
    sourceKey: string;
    sourceType: SkillSyncSourceRecord['sourceType'];
    displayName: string;
    status: SkillSyncRunRecord['status'];
    summary: Record<string, unknown>;
    items: SkillSyncRunRecord['items'];
    startedAt: string;
    finishedAt?: string | null;
  }): Promise<SkillSyncRunRecord>;
  listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]>;
  installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord>;
  removeUserAgent(userId: string, slug: string): Promise<boolean>;
  listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]>;
  getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null>;
  upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord>;
  deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean>;
  listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]>;
  installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord>;
  updateUserSkill(userId: string, input: Required<UpdateSkillLibraryItemInput>): Promise<UserSkillLibraryRecord | null>;
  removeUserSkill(userId: string, slug: string): Promise<boolean>;
}

export class InMemoryControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel = 'in-memory';

  private readonly users = new Map<string, UserRecord>();
  private readonly userIdsByUsername = new Map<string, string>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly oauthAccountsByProviderKey = new Map<string, OAuthAccountRecord>();
  private readonly sessionsById = new Map<string, SessionRecord>();
  private readonly sessionsByAccessToken = new Map<string, SessionRecord>();
  private readonly sessionsByRefreshToken = new Map<string, SessionRecord>();
  private readonly creditAccountsByUserId = new Map<string, CreditAccountRecord>();
  private readonly creditLedgerByUserId = new Map<string, CreditLedgerRecord[]>();
  private readonly paymentOrdersById = new Map<string, PaymentOrderRecord>();
  private readonly runGrantsById = new Map<string, RunGrantRecord>();
  private readonly usageEventsByEventId = new Map<string, UsageEventResult>();
  private readonly runBillingSummaryByGrantId = new Map<string, RunBillingSummaryRecord>();
  private readonly workspaceBackupsByUserId = new Map<string, WorkspaceBackupRecord>();
  private readonly agentCatalog = new Map<string, AgentCatalogEntryRecord>();
  private readonly userAgentLibrary = new Map<string, UserAgentLibraryRecord>();
  private readonly skillCatalog = new Map<string, SkillCatalogEntryRecord>();
  private readonly skillSyncSources = new Map<string, SkillSyncSourceRecord>();
  private readonly skillSyncRuns = new Map<string, SkillSyncRunRecord>();
  private readonly userSkillLibrary = new Map<string, UserSkillLibraryRecord>();
  private readonly userPrivateSkills = new Map<string, UserPrivateSkillRecord>();

  constructor() {
    const now = new Date().toISOString();
    const cloudSkillSeeds: Array<{
      slug: string;
      name: string;
      description: string;
      market: string;
      category: string;
      skillType: string;
      tags: string[];
      publisher?: string;
      version?: string;
      artifactFormat?: 'tar.gz' | 'zip';
      artifactUrl?: string;
      artifactSourcePath?: string;
    }> = [
      {
        slug: 'docx',
        name: 'DOCX 文档工具',
        description: '创建、编辑和分析 Word 文档，支持修订、批注、格式保留与文本提取。',
        market: '通用',
        category: 'report',
        skillType: '工具包',
        tags: ['文档', 'Word', '办公'],
        artifactSourcePath: 'docx',
      },
      {
        slug: 'xlsx',
        name: 'XLSX 表格工具',
        description: '创建、编辑和分析电子表格，支持公式、格式、数据处理与可视化。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        tags: ['表格', 'Excel', '数据'],
        artifactSourcePath: 'xlsx',
      },
      {
        slug: 'pdf',
        name: 'PDF 工具包',
        description: '提取文本和表格、合并拆分 PDF、处理表单并生成新的 PDF 文档。',
        market: '通用',
        category: 'report',
        skillType: '工具包',
        tags: ['PDF', '文档', '办公'],
        artifactSourcePath: 'pdf',
      },
      {
        slug: 'a-share-esg',
        name: 'A股ESG筛选分析',
        description: '从ESG角度筛选A股上市公司，评估可持续发展实践与争议风险。',
        market: 'A股',
        category: 'research',
        skillType: '分析师',
        tags: ['A股', 'ESG', '筛选'],
        artifactSourcePath: 'A股ESG筛选器',
      },
      {
        slug: 'a-share-data-toolkit',
        name: 'A股金融数据工具包',
        description: '提供A股实时行情、财务指标、董监高增减持和宏观数据抓取能力。',
        market: 'A股',
        category: 'data',
        skillType: '工具包',
        tags: ['A股', '数据', '工具包'],
        artifactSourcePath: 'A股数据工具包',
      },
      {
        slug: 'a-share-factor-screener',
        name: 'A股量化因子筛选',
        description: '使用多因子框架筛选A股，识别价值、动量、质量等因子暴露有利的股票。',
        market: 'A股',
        category: 'research',
        skillType: '扫描器',
        tags: ['A股', '量化', '因子'],
        artifactSourcePath: 'A股量化因子筛选器',
      },
      {
        slug: 'a-share-industry-rotation',
        name: 'A股行业轮动检测',
        description: '通过宏观经济指标与经济周期定位，识别未来可能跑赢或跑输的A股行业。',
        market: 'A股',
        category: 'research',
        skillType: '扫描器',
        tags: ['A股', '行业', '轮动'],
        artifactSourcePath: 'A股行业轮动探测器',
      },
      {
        slug: 'a-share-low-valuation',
        name: 'A股低估值股票筛选',
        description: '扫描A股低估值机会，筛选基本面稳健但被市场低估的公司。',
        market: 'A股',
        category: 'research',
        skillType: '扫描器',
        tags: ['A股', '低估值', '价值投资'],
        artifactSourcePath: 'A股低估值股票筛选器',
      },
      {
        slug: 'a-share-insider',
        name: 'A股内部交易分析',
        description: '分析董监高与重要股东增减持行为，识别管理层信心信号与潜在机会。',
        market: 'A股',
        category: 'research',
        skillType: '分析师',
        tags: ['A股', '内部人交易', '管理层'],
        artifactSourcePath: 'A股内部交易分析师',
      },
      {
        slug: 'a-share-small-cap-growth',
        name: 'A股小盘成长股筛选',
        description: '识别A股被忽视的小市值高成长公司，适合寻找高弹性成长机会。',
        market: 'A股',
        category: 'research',
        skillType: '扫描器',
        tags: ['A股', '小盘成长', '高增长'],
        artifactSourcePath: 'A股小盘成长股识别器',
      },
      {
        slug: 'a-share-tech-valuation',
        name: 'A股科技股估值分析',
        description: '对比分析A股科技公司的估值泡沫与基本面，识别高估与低估标的。',
        market: 'A股',
        category: 'research',
        skillType: '分析师',
        tags: ['A股', '科技估值', '估值'],
        artifactSourcePath: 'A股科技股估值分析师',
      },
      {
        slug: 'a-share-dividend',
        name: 'A股高股息策略分析',
        description: '评估A股高股息与红利策略的收益可持续性、分红质量与长期回报。',
        market: 'A股',
        category: 'portfolio',
        skillType: '分析师',
        tags: ['A股', '红利', '股息'],
        artifactSourcePath: 'A股高股息策略分析器',
      },
      {
        slug: 'us-esg',
        name: '美股ESG筛选分析',
        description: '从ESG角度筛选美股公司，评估可持续发展实践、争议风险与治理质量。',
        market: '美股',
        category: 'research',
        skillType: '分析师',
        tags: ['美股', 'ESG', '筛选'],
        artifactSourcePath: '美股ESG筛选器',
      },
      {
        slug: 'us-data-toolkit',
        name: '美股金融数据工具包',
        description: '提供实时股票数据、SEC 文件、财务计算器和宏观指标抓取能力。',
        market: '美股',
        category: 'data',
        skillType: '工具包',
        tags: ['美股', '数据', '工具包'],
        artifactSourcePath: '美股数据工具包',
      },
      {
        slug: 'us-factor-screener',
        name: '美股量化因子筛选',
        description: '使用正式因子模型进行系统性多因子股票筛选，识别因子暴露有利的股票。',
        market: '美股',
        category: 'research',
        skillType: '扫描器',
        tags: ['美股', '量化', '因子'],
        artifactSourcePath: '美股量化因子扫描器',
      },
      {
        slug: 'us-industry-rotation',
        name: '美股行业轮动检测',
        description: '通过宏观经济指标和商业周期定位，识别未来可能表现优异或落后的美股行业。',
        market: '美股',
        category: 'research',
        skillType: '扫描器',
        tags: ['美股', '行业', '轮动'],
        artifactSourcePath: '美股行业轮动探测器',
      },
      {
        slug: 'us-low-valuation',
        name: '美股低估值股票筛选',
        description: '筛选基本面扎实但估值偏低的美股公司，适合价值投资与安全边际场景。',
        market: '美股',
        category: 'research',
        skillType: '扫描器',
        tags: ['美股', '低估值', '价值投资'],
        artifactSourcePath: '美股低估值股票扫描器',
      },
      {
        slug: 'us-insider',
        name: '美股内部人交易分析',
        description: '分析内部人交易模式与表格披露，识别管理层增持与看涨信号。',
        market: '美股',
        category: 'research',
        skillType: '分析师',
        tags: ['美股', '内部人交易', '管理层'],
        artifactSourcePath: '美股内部交易分析师',
      },
      {
        slug: 'us-small-cap-growth',
        name: '美股小盘成长股筛选',
        description: '筛选小市值高成长、机构覆盖少但基本面强劲的美股成长机会。',
        market: '美股',
        category: 'research',
        skillType: '扫描器',
        tags: ['美股', '小盘成长', '高增长'],
        artifactSourcePath: '美股小盘成长股扫描器',
      },
      {
        slug: 'us-tech-valuation',
        name: '美股科技股估值分析',
        description: '对比头部科技公司增长与估值，区分合理定价与高估泡沫。',
        market: '美股',
        category: 'research',
        skillType: '分析师',
        tags: ['美股', '科技估值', '估值'],
        artifactSourcePath: '美股科技股估值分析师',
      },
      {
        slug: 'us-dividend-aristocrats',
        name: '美股股息贵族分析',
        description: '分析连续提高分红的美股公司，评估股息可持续性与长期总回报。',
        market: '美股',
        category: 'portfolio',
        skillType: '分析师',
        tags: ['美股', '股息', '红利'],
        artifactSourcePath: '美股高股息策略分析器',
      },
      {
        slug: 'admapix',
        name: 'AdMapix',
        description: '广告素材检索、App 排名、下载收入追踪与市场洞察助手，适合增长运营与竞品研究。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        publisher: 'ClawHub · fly0pants',
        tags: ['运营增长', '广告投放', '市场洞察'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=admapix&version=1.0.14',
        artifactFormat: 'zip',
        version: '1.0.14',
      },
      {
        slug: 'marketing-strategy-pmm',
        name: 'Marketing Strategy Pmm',
        description: '围绕定位、GTM、竞品洞察与产品发布制定产品营销策略，适合产品营销与增长规划。',
        market: '通用',
        category: 'general',
        skillType: '分析师',
        publisher: 'ClawHub · alirezarezvani',
        tags: ['运营增长', 'GTM', '产品营销'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-strategy-pmm&version=2.1.1',
        artifactFormat: 'zip',
        version: '2.1.1',
      },
      {
        slug: 'marketing-demand-acquisition',
        name: 'Marketing Demand Acquisition',
        description: '设计获客投放、SEO 与渠道增长方案，适合增长运营、需求获取与渠道扩张场景。',
        market: '通用',
        category: 'general',
        skillType: '分析师',
        publisher: 'ClawHub · alirezarezvani',
        tags: ['运营增长', '增长获客', 'SEO'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-demand-acquisition&version=2.1.1',
        artifactFormat: 'zip',
        version: '2.1.1',
      },
      {
        slug: 'revenue-operations',
        name: 'Revenue Operations',
        description: '分析销售漏斗、收入预测与 GTM 效率，适合营收运营和销售流程优化。',
        market: '通用',
        category: 'data',
        skillType: '分析师',
        publisher: 'ClawHub · alirezarezvani',
        tags: ['运营增长', '营收运营', '销售漏斗'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=revenue-operations&version=1.0.0',
        artifactFormat: 'zip',
        version: '1.0.0',
      },
      {
        slug: 'x-publisher',
        name: 'X tweet publisher',
        description: '发布 X/Twitter 文本、图片和视频内容，适合账号运营与社交分发。',
        market: '通用',
        category: 'general',
        skillType: '工具包',
        publisher: 'ClawHub · AlphaFactor',
        tags: ['自媒体', '社交分发', 'X'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=x-publisher&version=1.0.6',
        artifactFormat: 'zip',
        version: '1.0.6',
      },
      {
        slug: 'ghost',
        name: 'ghost cms',
        description: '管理 Ghost CMS 博客文章的创建、更新、删除与列表，适合内容发布与博客运维。',
        market: '通用',
        category: 'report',
        skillType: '工具包',
        publisher: 'ClawHub · AlphaFactor',
        tags: ['自媒体', '博客', '内容管理'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=ghost&version=1.0.5',
        artifactFormat: 'zip',
        version: '1.0.5',
      },
      {
        slug: 'video-transcript-downloader',
        name: 'Video Transcript Downloader',
        description: '下载视频、音频、字幕并生成清洗后的 transcript，适合内容二创与素材整理。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        publisher: 'ClawHub · steipete',
        tags: ['自媒体', '视频', '转录'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=video-transcript-downloader&version=1.0.0',
        artifactFormat: 'zip',
        version: '1.0.0',
      },
      {
        slug: 'video-summary',
        name: 'Video Summary',
        description: '总结 B 站、小红书、抖音与 YouTube 视频内容，提炼结构化洞察和重点摘要。',
        market: '通用',
        category: 'report',
        skillType: '生成器',
        publisher: 'ClawHub · lifei68801',
        tags: ['自媒体', '视频总结', '内容创作'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=video-summary&version=1.6.4',
        artifactFormat: 'zip',
        version: '1.6.4',
      },
      {
        slug: 'xiaohongshu-search-summarizer',
        name: 'Xiaohongshu Search Summarizer',
        description: '搜索小红书关键词，提取笔记、图片与评论并生成总结，适合选题与内容洞察。',
        market: '通用',
        category: 'report',
        skillType: '扫描器',
        publisher: 'ClawHub · piekill',
        tags: ['自媒体', '小红书', '内容洞察'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=xiaohongshu-search-summarizer&version=1.0.3',
        artifactFormat: 'zip',
        version: '1.0.3',
      },
      {
        slug: 'productivity',
        name: 'Productivity',
        description: '围绕时间块、目标、项目、习惯和复盘提升个人执行效率，适合超级个体日常工作流。',
        market: '通用',
        category: 'general',
        skillType: '分析师',
        publisher: 'ClawHub · ivangdavila',
        tags: ['超级个体', '效率', '任务管理'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=productivity&version=1.0.4',
        artifactFormat: 'zip',
        version: '1.0.4',
      },
      {
        slug: 'notion-sync',
        name: 'Notion Sync',
        description: '双向同步和管理 Notion 页面与数据库，适合个人知识库与项目协作。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        publisher: 'ClawHub · robansuini',
        tags: ['超级个体', 'Notion', '知识库'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=notion-sync&version=2.5.3',
        artifactFormat: 'zip',
        version: '2.5.3',
      },
      {
        slug: 'todo',
        name: 'Todo',
        description: '管理任务、项目、提醒、承诺与 follow-up，帮助个人形成执行闭环。',
        market: '通用',
        category: 'general',
        skillType: '工具包',
        publisher: 'ClawHub · agenticio',
        tags: ['超级个体', '待办', '任务管理'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=todo&version=3.0.1',
        artifactFormat: 'zip',
        version: '3.0.1',
      },
      {
        slug: 'cron',
        name: 'Cron',
        description: '本地优先的周期计划与重复提醒引擎，适合 recurring task 与定时执行场景。',
        market: '通用',
        category: 'general',
        skillType: '工具包',
        publisher: 'ClawHub · qclawbot',
        tags: ['超级个体', '定时', '自动化'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=cron&version=1.0.0',
        artifactFormat: 'zip',
        version: '1.0.0',
      },
      {
        slug: 'temporal-cortex',
        name: 'temporal-cortex',
        description: '管理 Google、Outlook 与 CalDAV 日历、会议和可用时间，适合个人日程协同。',
        market: '通用',
        category: 'general',
        skillType: '工具包',
        publisher: 'ClawHub · billylui',
        tags: ['超级个体', '日程', '日历'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=temporal-cortex&version=0.9.1',
        artifactFormat: 'zip',
        version: '0.9.1',
      },
      {
        slug: 'word-docx',
        name: 'Word / DOCX',
        description: '创建、检查和编辑 Word 文档，支持样式、编号、修订、表格与兼容性检查。',
        market: '通用',
        category: 'report',
        skillType: '工具包',
        publisher: 'ClawHub · ivangdavila',
        tags: ['办公效率', '文档', 'Word'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=word-docx&version=1.0.2',
        artifactFormat: 'zip',
        version: '1.0.2',
      },
      {
        slug: 'excel-xlsx',
        name: 'Excel / XLSX',
        description: '创建、检查和编辑 Excel 工作簿，支持公式、格式、数据类型与重算。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        publisher: 'ClawHub · ivangdavila',
        tags: ['办公效率', '表格', 'Excel'],
        artifactUrl: 'https://wry-manatee-359.convex.site/api/v1/download?slug=excel-xlsx&version=1.0.2',
        artifactFormat: 'zip',
        version: '1.0.2',
      },
      {
        slug: 'powerpoint-pptx',
        name: 'Powerpoint / PPTX',
        description: '创建、检查和编辑 PowerPoint 演示文稿，支持模板、布局、备注与图表。',
        market: '通用',
        category: 'report',
        skillType: '工具包',
        publisher: 'ClawHub · ivangdavila',
        tags: ['办公效率', '演示', 'PPT'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=powerpoint-pptx&version=1.0.1',
        artifactFormat: 'zip',
        version: '1.0.1',
      },
      {
        slug: 'paddleocr-doc-parsing',
        name: 'PaddleOCR Document Parsing',
        description: '将复杂 PDF 与文档图片解析为保留结构的 Markdown 和 JSON，适合文档数字化。',
        market: '通用',
        category: 'data',
        skillType: '工具包',
        publisher: 'ClawHub · Bobholamovic',
        tags: ['办公效率', 'OCR', '文档解析'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=paddleocr-doc-parsing&version=2.0.8',
        artifactFormat: 'zip',
        version: '2.0.8',
      },
      {
        slug: 'feishu-send-file',
        name: 'feishu-send-file',
        description: '通过飞书发送附件与文件，适合办公协同、结果交付与自动化通知。',
        market: '通用',
        category: 'general',
        skillType: '工具包',
        publisher: 'ClawHub · dadaniya99',
        tags: ['办公效率', '飞书', '协同'],
        artifactUrl:
          'https://wry-manatee-359.convex.site/api/v1/download?slug=feishu-send-file&version=1.2.1',
        artifactFormat: 'zip',
        version: '1.2.1',
      },
    ];

    const cloudSkills: SkillCatalogEntryRecord[] = cloudSkillSeeds.map((seed) => ({
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      visibility: 'showcase',
      market: seed.market,
      category: seed.category,
      skillType: seed.skillType,
      publisher: seed.publisher || 'iClaw',
      distribution: seed.artifactSourcePath ? 'bundled' : 'cloud',
      tags: [...seed.tags],
      version: seed.version || '1.0.0',
      artifactFormat: seed.artifactFormat || 'tar.gz',
      artifactUrl: seed.artifactUrl || null,
      artifactSha256: null,
      artifactSourcePath: seed.artifactSourcePath || null,
      originType: seed.artifactSourcePath ? 'bundled' : 'clawhub',
      sourceUrl: seed.artifactUrl || null,
      metadata: {},
      active: true,
      createdAt: now,
      updatedAt: now,
    }));

    for (const entry of cloudSkills) {
      this.skillCatalog.set(entry.slug, entry);
    }

    const defaultSource: SkillSyncSourceRecord = {
      id: DEFAULT_CLAWHUB_SYNC_SOURCE.id,
      sourceType: DEFAULT_CLAWHUB_SYNC_SOURCE.source_type,
      sourceKey: DEFAULT_CLAWHUB_SYNC_SOURCE.source_key,
      displayName: DEFAULT_CLAWHUB_SYNC_SOURCE.display_name,
      sourceUrl: DEFAULT_CLAWHUB_SYNC_SOURCE.source_url,
      config: DEFAULT_CLAWHUB_SYNC_SOURCE.config,
      active: DEFAULT_CLAWHUB_SYNC_SOURCE.active,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.skillSyncSources.set(defaultSource.id, defaultSource);

    const buildInvestmentExpertMetadata = (input: {
      subtitle: string;
      investmentCategory: string;
      avatarUrl: string;
      usageCount: number;
      taskCount: number;
      rating: number;
      online?: boolean;
      recommended?: boolean;
      hot?: boolean;
      primarySkillSlug: string;
      skillSlugs: string[];
      skillHighlights: Array<{title: string; description: string}>;
      taskExamples: string[];
      conversationPreview: Array<{role: 'user' | 'expert'; content: string}>;
      systemPrompt: string;
      mcpPresetKeys?: string[];
    }): Record<string, unknown> => ({
      surface: 'investment-experts',
      subtitle: input.subtitle,
      investment_category: input.investmentCategory,
      avatar_url: input.avatarUrl,
      usage_count: input.usageCount,
      task_count: input.taskCount,
      rating: input.rating,
      is_online: input.online ?? true,
      is_recommended: input.recommended ?? false,
      is_hot: input.hot ?? false,
      primary_skill_slug: input.primarySkillSlug,
      skill_slugs: input.skillSlugs,
      skill_highlights: input.skillHighlights,
      task_examples: input.taskExamples,
      conversation_preview: input.conversationPreview,
      system_prompt: input.systemPrompt,
      mcp_preset_keys: input.mcpPresetKeys ?? ['browser', 'tavily', 'serper', 'yahoo-finance'],
    });

    const cloudAgents: AgentCatalogEntryRecord[] = [
      {
        slug: 'stock-expert',
        name: '股票专家',
        description: '专业 AI 助手，专注于 A 股公告追踪、全球市场分析和交易复盘，提供数据驱动的投资决策参考。',
        category: 'finance',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['金融', '股票', '研究'],
        capabilities: ['A 股公告追踪', '全球股票分析', '交易绩效复盘'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '没时间看盘时，让我持续追踪 A 股重大事件。',
          '希望快速获得全球市场技术指标和走势摘要。',
          '导入交割单后定位交易中的执行问题。',
        ],
        sortOrder: 10,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'summary-expert',
        name: '全能总结专家',
        description: '将音频、视频、网页链接、文档、文字和图片整理成结构化摘要、重点结论与行动清单。',
        category: 'productivity',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['总结', '效率', '多模态'],
        capabilities: ['多模态内容摘要', '会议纪要整理', '行动项提炼'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '把冗长会议录音整理成纪要和待办。',
          '快速读懂长文档、网页和视频重点。',
          '把素材归纳成便于分享的结构化摘要。',
        ],
        sortOrder: 20,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'mail-assistant',
        name: '邮件助手',
        description: '跨账号智能邮件管家，帮助整理收件箱、草拟回复、提炼待办并减少遗漏。',
        category: 'productivity',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['邮件', '办公', '效率'],
        capabilities: ['收件箱分诊', '回复草拟与润色', '跟进提醒提取'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '批量归类需要回复和可归档的邮件。',
          '根据历史语气快速生成专业回复。',
          '从长邮件线程里提炼明确待办和截止时间。',
        ],
        sortOrder: 30,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'wechat-writer',
        name: '微信公众号写作专家',
        description: '提供选题、标题、结构和长文润色，帮助稳定产出高质量的公众号内容。',
        category: 'content',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['公众号', '写作', '内容'],
        capabilities: ['选题策划', '标题与结构生成', '成稿改写润色'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '围绕热点快速产出公众号选题和提纲。',
          '把口语素材整理成长文表达。',
          '优化标题、开头和结尾，提高完读率。',
        ],
        sortOrder: 40,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'x-content-operator',
        name: 'X 平台内容运营专家',
        description: '一站式 X 平台内容创作与运营助手，支持选题、写推、线程编排与复盘。',
        category: 'content',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['X', '运营', '内容增长'],
        capabilities: ['热点选题发现', '推文与线程生成', '发布节奏复盘'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '持续输出品牌化、专业感强的短内容。',
          '把长内容拆解成可发布线程。',
          '复盘哪些内容更容易带来互动和转化。',
        ],
        sortOrder: 50,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'cross-border-radar',
        name: '跨境电商选品雷达',
        description: '集成多平台数据，辅助竞争分析、选品判断与需求机会发现，适合跨境业务调研。',
        category: 'commerce',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['跨境电商', '选品', '调研'],
        capabilities: ['平台竞品监控', '选品机会分析', '评论痛点提炼'],
        metadata: {surface: 'lobster-store'},
        useCases: [
          '比较多个平台的热门品类和价格带。',
          '从用户评论中提炼产品优化方向。',
          '快速发现高需求低竞争的选品机会。',
        ],
        sortOrder: 60,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'a-share-value-hunter',
        name: 'A股价值投资专家',
        description: '聚焦低估值、现金流和分红质量，帮助你从安全边际出发筛选A股长期配置机会。',
        category: 'finance',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['A股', '价值投资', '低估值'],
        capabilities: ['低估值筛选', '分红质量评估', '价值股比较'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '低估值筛选 · 红利质量 · 长线配置',
          investmentCategory: 'stock',
          avatarUrl: 'https://images.unsplash.com/photo-1738566061505-556830f8b8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 12543,
          taskCount: 8932,
          rating: 4.9,
          recommended: true,
          primarySkillSlug: 'a-share-low-valuation',
          skillSlugs: ['a-share-low-valuation', 'a-share-dividend', 'a-share-data-toolkit'],
          skillHighlights: [
            {title: '低估值机会扫描', description: '筛选估值偏低但基本面稳健的A股公司。'},
            {title: '红利与现金流核查', description: '判断分红是否可持续，避免高股息陷阱。'},
            {title: '价值股对比', description: '横向比较ROE、现金流、估值与安全边际。'},
          ],
          taskExamples: [
            '筛选当前A股里低估值且现金流健康的公司',
            '对比中国神华和长江电力的红利质量',
            '找出适合长期配置的高股息价值股',
          ],
          conversationPreview: [
            {role: 'user', content: '帮我找3只适合长期持有的A股价值股。'},
            {role: 'expert', content: '我会先按低估值、自由现金流、分红覆盖率和行业稳定性筛选，再给你逐只拆解投资逻辑与主要风险。'},
          ],
          systemPrompt: '你是一名克制、审慎的A股价值投资专家。优先从估值、安全边际、现金流、分红质量和周期位置来回答问题，避免追逐情绪化题材。',
        }),
        useCases: [
          '快速筛选A股价值型机会池。',
          '判断高股息是否可持续。',
          '为长期配置构建更稳健的候选名单。',
        ],
        sortOrder: 110,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'a-share-quant-pilot',
        name: 'A股量化因子专家',
        description: '基于多因子框架分析A股，适合做系统选股、风格暴露识别和规则化研究。',
        category: 'finance',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['A股', '量化', '因子'],
        capabilities: ['多因子筛选', '风格暴露分析', '量化选股'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '多因子模型 · 系统选股 · 风格暴露',
          investmentCategory: 'quant',
          avatarUrl: 'https://images.unsplash.com/photo-1739300293504-234817eead52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 9876,
          taskCount: 6543,
          rating: 4.8,
          hot: true,
          primarySkillSlug: 'a-share-factor-screener',
          skillSlugs: ['a-share-factor-screener', 'a-share-data-toolkit'],
          skillHighlights: [
            {title: '多因子打分', description: '从价值、动量、质量等维度给出量化排序。'},
            {title: '风格暴露识别', description: '分析当前组合偏向大盘、成长还是红利。'},
            {title: '规则化选股', description: '把主观筛选变成可复用的量化框架。'},
          ],
          taskExamples: [
            '筛出A股质量因子排名前20的股票',
            '做一个偏价值加低波的A股候选池',
            '看看我当前持仓有哪些风格暴露过重',
          ],
          conversationPreview: [
            {role: 'user', content: '帮我做一个A股多因子候选池。'},
            {role: 'expert', content: '我会先明确因子框架，再用数据工具包拉取指标，最后输出排序名单、因子解释和风险约束。'},
          ],
          systemPrompt: '你是一名量化投资专家。回答时优先使用清晰的筛选条件、因子框架和可复核的指标，不要只给模糊观点。',
        }),
        useCases: [
          '建立规则化的A股股票池。',
          '分析组合风格偏移。',
          '把量化思路转成可执行筛选条件。',
        ],
        sortOrder: 120,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'a-share-rotation-strategist',
        name: 'A股行业轮动专家',
        description: '结合宏观与产业周期分析A股板块轮动，适合做中期配置与景气度判断。',
        category: 'finance',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['A股', '行业轮动', '宏观'],
        capabilities: ['行业景气判断', '轮动节奏识别', '中期配置建议'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '宏观周期 · 板块轮动 · 中期配置',
          investmentCategory: 'macro',
          avatarUrl: 'https://images.unsplash.com/photo-1758599543154-76ec1c4257df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 8421,
          taskCount: 6028,
          rating: 4.8,
          primarySkillSlug: 'a-share-industry-rotation',
          skillSlugs: ['a-share-industry-rotation', 'a-share-data-toolkit'],
          skillHighlights: [
            {title: '行业景气监测', description: '识别景气上行和盈利改善的细分板块。'},
            {title: '轮动线索梳理', description: '从政策、利率和库存周期看板块切换。'},
            {title: '配置路径建议', description: '给出超配、低配和观察名单。'},
          ],
          taskExamples: [
            '未来6个月A股哪些行业更值得超配',
            '利率下行环境下A股板块如何轮动',
            '当前市场更偏成长还是红利',
          ],
          conversationPreview: [
            {role: 'user', content: '接下来A股轮动更看好哪些方向？'},
            {role: 'expert', content: '我会先判断宏观环境，再映射到行业盈利和估值，给你超配、低配和观察三层结论。'},
          ],
          systemPrompt: '你是一名宏观与行业轮动专家。回答时要把宏观变量、产业逻辑、估值位置和时间维度说清楚，避免只给结论不给链路。',
          mcpPresetKeys: ['browser', 'tavily', 'serper', 'yahoo-finance', 'fred'],
        }),
        useCases: [
          '判断当前市场偏向哪类行业风格。',
          '构建中期轮动配置框架。',
          '把宏观变量映射到A股行业机会。',
        ],
        sortOrder: 130,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'a-share-signal-scout',
        name: 'A股信号侦察专家',
        description: '围绕内部交易、小盘成长和数据线索寻找被市场忽视的A股机会，更适合做机会发现。',
        category: 'finance',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['A股', '内部人交易', '小盘成长'],
        capabilities: ['内部交易线索', '小盘成长发现', '机会清单输出'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '内部人信号 · 小盘成长 · 机会发现',
          investmentCategory: 'comprehensive',
          avatarUrl: 'https://images.unsplash.com/photo-1772987057599-2f1088c1e993?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 7654,
          taskCount: 5432,
          rating: 4.7,
          primarySkillSlug: 'a-share-insider',
          skillSlugs: ['a-share-insider', 'a-share-small-cap-growth', 'a-share-data-toolkit'],
          skillHighlights: [
            {title: '内部人信号识别', description: '跟踪董监高和大股东增减持动向。'},
            {title: '小盘成长机会', description: '挖掘关注度不足但成长快的小市值公司。'},
            {title: '线索式机会池', description: '把零散异动整理成可追踪清单。'},
          ],
          taskExamples: [
            '最近A股有哪些管理层增持比较值得跟踪',
            '帮我找几个小盘成长方向的候选标的',
            '把近期的内部交易和小盘成长信号整合成清单',
          ],
          conversationPreview: [
            {role: 'user', content: '最近有哪些A股内部人交易信号值得看？'},
            {role: 'expert', content: '我会从增持强度、历史行为、一致性和基本面承接能力四个层面筛掉噪音，给你更可信的信号名单。'},
          ],
          systemPrompt: '你是一名机会发现型研究专家。善于从内部交易、小盘成长和异动数据里挖线索，但必须强调噪音过滤和风险甄别。',
        }),
        useCases: [
          '快速发现被忽视的A股机会。',
          '跟踪管理层信心与资金行为。',
          '搭建高弹性股票观察名单。',
        ],
        sortOrder: 140,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'us-value-compass',
        name: '美股价值配置专家',
        description: '围绕美股低估值、分红和财务稳健性做组合候选筛选，适合中长期配置研究。',
        category: 'finance',
        publisher: 'iClaw',
        featured: true,
        official: true,
        tags: ['美股', '价值投资', '股息'],
        capabilities: ['低估值筛选', '股息质量分析', '美股长期配置'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '低估值筛选 · 股息质量 · 长期配置',
          investmentCategory: 'global',
          avatarUrl: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 9321,
          taskCount: 6880,
          rating: 4.9,
          recommended: true,
          primarySkillSlug: 'us-low-valuation',
          skillSlugs: ['us-low-valuation', 'us-dividend-aristocrats', 'us-data-toolkit'],
          skillHighlights: [
            {title: '美股低估值筛选', description: '从估值、现金流和财务稳健性找便宜货。'},
            {title: '股息贵族分析', description: '识别分红历史稳定、质量较高的公司。'},
            {title: '海外长期配置', description: '为美股价值配置提供候选池和比较框架。'},
          ],
          taskExamples: [
            '帮我筛几只美股低估值高现金流公司',
            '对比几只美股股息贵族的分红质量',
            '做一个偏价值风格的美股候选组合',
          ],
          conversationPreview: [
            {role: 'user', content: '现在有哪些美股价值股值得重点看？'},
            {role: 'expert', content: '我会先排除价值陷阱，再按估值、现金流、分红和行业位置给你分层候选池。'},
          ],
          systemPrompt: '你是一名美股价值配置专家。优先从估值、自由现金流、资本回报和分红持续性来分析，避免仅凭题材热度做判断。',
        }),
        useCases: [
          '筛选适合长期持有的美股价值公司。',
          '比较不同红利型公司质量。',
          '构建偏稳健的海外配置候选池。',
        ],
        sortOrder: 150,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: 'us-sector-rotation-expert',
        name: '美股行业轮动专家',
        description: '从宏观周期、行业景气和风格切换出发，帮助判断美股板块轮动与阶段性配置机会。',
        category: 'finance',
        publisher: 'iClaw',
        featured: false,
        official: true,
        tags: ['美股', '行业轮动', '宏观'],
        capabilities: ['行业轮动判断', '宏观变量映射', '风格切换分析'],
        metadata: buildInvestmentExpertMetadata({
          subtitle: '宏观周期 · 板块轮动 · 全球视角',
          investmentCategory: 'macro',
          avatarUrl: 'https://images.unsplash.com/photo-1579540830482-659e7518c895?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
          usageCount: 8543,
          taskCount: 6021,
          rating: 4.8,
          primarySkillSlug: 'us-industry-rotation',
          skillSlugs: ['us-industry-rotation', 'us-factor-screener', 'us-data-toolkit'],
          skillHighlights: [
            {title: '行业轮动识别', description: '识别未来 6 到 12 个月可能占优的板块。'},
            {title: '宏观变量映射', description: '把利率、通胀、美元等变量映射到行业表现。'},
            {title: '风格切换跟踪', description: '判断成长、价值、防御之间的切换节奏。'},
          ],
          taskExamples: [
            '降息预期下美股哪些行业更受益',
            '当前美股更适合成长还是价值',
            '给我一份未来半年美股行业轮动框架',
          ],
          conversationPreview: [
            {role: 'user', content: '接下来美股应该重点看哪些行业？'},
            {role: 'expert', content: '我会先判断宏观阶段，再给出受益行业、受压行业和需要观察的领先指标。'},
          ],
          systemPrompt: '你是一名美股行业轮动专家。请用全球资产和宏观变量视角来解释行业切换，明确时间框架、催化和风险。',
          mcpPresetKeys: ['browser', 'tavily', 'serper', 'yahoo-finance', 'fred'],
        }),
        useCases: [
          '构建美股行业轮动框架。',
          '把宏观环境映射到行业配置。',
          '跟踪成长与价值风格切换。',
        ],
        sortOrder: 160,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const entry of cloudAgents) {
      this.agentCatalog.set(entry.slug, entry);
    }
  }

  async getUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const normalized = normalizeUsernameLookup(identifier);
    const userId = this.userIdsByUsername.get(normalized) || this.userIdsByEmail.get(normalized);
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.userIdsByEmail.get(email.trim().toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null> {
    const account = this.oauthAccountsByProviderKey.get(this.oauthKey(provider, providerId));
    return account ? this.users.get(account.userId) || null : null;
  }

  async linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord> {
    const record: OAuthAccountRecord = {
      userId,
      provider,
      providerId,
      createdAt: new Date().toISOString(),
    };
    this.oauthAccountsByProviderKey.set(this.oauthKey(provider, providerId), record);
    return record;
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    for (const [key, value] of this.oauthAccountsByProviderKey.entries()) {
      if (value.userId === userId && value.provider === provider) {
        this.oauthAccountsByProviderKey.delete(key);
        return true;
      }
    }
    return false;
  }

  async getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]> {
    return Array.from(this.oauthAccountsByProviderKey.values()).filter((item) => item.userId === userId);
  }

  async updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    const next: UserRecord = {
      ...current,
      displayName: input.displayName?.trim() ? input.displayName.trim() : current.displayName,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : current.avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, next);
    return next;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    if (current.role === role) {
      return current;
    }
    const next: UserRecord = {
      ...current,
      role,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, next);
    return next;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    const next: UserRecord = {
      ...current,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, next);
    return next;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const normalizedUsername = normalizeUsernameLookup(input.username);
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.userIdsByUsername.has(normalizedUsername)) {
      throw new Error('USERNAME_TAKEN');
    }
    if (this.userIdsByEmail.has(normalizedEmail)) {
      throw new Error('EMAIL_TAKEN');
    }

    const now = new Date().toISOString();
    const user: UserRecord = {
      id: randomUUID(),
      username: input.username.trim().replace(/\s+/g, ' '),
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      avatarUrl: input.avatarUrl?.trim() || null,
      passwordHash: input.passwordHash?.trim() || null,
      role: input.role || 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.userIdsByUsername.set(normalizedUsername, user.id);
    this.userIdsByEmail.set(normalizedEmail, user.id);
    const account: CreditAccountRecord = {
      userId: user.id,
      dailyFreeBalance: config.dailyFreeCredits,
      topupBalance: Math.max(0, input.initialCreditBalance),
      dailyFreeQuota: config.dailyFreeCredits,
      totalAvailableBalance: config.dailyFreeCredits + Math.max(0, input.initialCreditBalance),
      dailyFreeGrantedAt: now,
      dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const ledger: CreditLedgerRecord[] = [
      {
        id: randomUUID(),
        userId: user.id,
        bucket: 'daily_free',
        direction: 'grant',
        amount: config.dailyFreeCredits,
        balanceAfter: config.dailyFreeCredits,
        referenceType: 'daily_reset',
        referenceId: user.id,
        eventType: 'daily_reset',
        delta: config.dailyFreeCredits,
        createdAt: now,
      },
    ];
    if (account.topupBalance > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId: user.id,
        bucket: 'topup',
        direction: 'grant',
        amount: account.topupBalance,
        balanceAfter: account.topupBalance,
        referenceType: 'trial_grant',
        referenceId: user.id,
        eventType: 'signup_grant',
        delta: account.topupBalance,
        createdAt: now,
      });
    }
    this.creditAccountsByUserId.set(user.id, account);
    this.creditLedgerByUserId.set(user.id, ledger);

    return user;
  }

  async createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: randomUUID(),
      userId,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      createdAt: new Date().toISOString(),
    };
    this.sessionsById.set(session.id, session);
    this.sessionsByAccessToken.set(session.accessTokenHash, session);
    this.sessionsByRefreshToken.set(session.refreshTokenHash, session);
    return session;
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const current = this.sessionsByRefreshToken.get(refreshTokenHash);
    if (!current) return null;
    this.sessionsByAccessToken.delete(current.accessTokenHash);
    this.sessionsByRefreshToken.delete(current.refreshTokenHash);
    const next: SessionRecord = {
      ...current,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
    this.sessionsById.set(next.id, next);
    this.sessionsByAccessToken.set(next.accessTokenHash, next);
    this.sessionsByRefreshToken.set(next.refreshTokenHash, next);
    return next;
  }

  async touchSession(
    sessionId: string,
    expiresAt: {
      accessTokenExpiresAt: number;
      refreshTokenExpiresAt: number;
    },
  ): Promise<SessionRecord | null> {
    const current = this.sessionsById.get(sessionId);
    if (!current) {
      return null;
    }
    const next: SessionRecord = {
      ...current,
      accessTokenExpiresAt: expiresAt.accessTokenExpiresAt,
      refreshTokenExpiresAt: expiresAt.refreshTokenExpiresAt,
    };
    this.sessionsById.set(next.id, next);
    this.sessionsByAccessToken.set(next.accessTokenHash, next);
    this.sessionsByRefreshToken.set(next.refreshTokenHash, next);
    return next;
  }

  async getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null> {
    return this.sessionsByAccessToken.get(accessTokenHash) || null;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null> {
    return this.sessionsByRefreshToken.get(refreshTokenHash) || null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) || null;
  }

  async getCreditAccount(userId: string): Promise<CreditAccountRecord> {
    const current = this.creditAccountsByUserId.get(userId);
    if (!current) {
      const now = new Date().toISOString();
      const next: CreditAccountRecord = {
        userId,
        dailyFreeBalance: config.dailyFreeCredits,
        topupBalance: 0,
        dailyFreeQuota: config.dailyFreeCredits,
        totalAvailableBalance: config.dailyFreeCredits,
        dailyFreeGrantedAt: now,
        dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.creditAccountsByUserId.set(userId, next);
      return next;
    }
    if (new Date(current.dailyFreeExpiresAt).getTime() > Date.now()) {
      return current;
    }
    const now = new Date().toISOString();
    const next: CreditAccountRecord = {
      ...current,
      dailyFreeBalance: config.dailyFreeCredits,
      dailyFreeQuota: config.dailyFreeCredits,
      totalAvailableBalance: config.dailyFreeCredits + current.topupBalance,
      dailyFreeGrantedAt: now,
      dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
      updatedAt: now,
    };
    this.creditAccountsByUserId.set(userId, next);
    const ledger = this.creditLedgerByUserId.get(userId) || [];
    ledger.unshift({
      id: randomUUID(),
      userId,
      bucket: 'daily_free',
      direction: 'grant',
      amount: config.dailyFreeCredits,
      balanceAfter: config.dailyFreeCredits,
      referenceType: 'daily_reset',
      referenceId: next.dailyFreeGrantedAt,
      eventType: 'daily_reset',
      delta: config.dailyFreeCredits,
      createdAt: now,
    });
    this.creditLedgerByUserId.set(userId, ledger);
    return next;
  }

  async getCreditBalance(userId: string): Promise<number> {
    const account = await this.getCreditAccount(userId);
    return account.totalAvailableBalance;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    await this.getCreditAccount(userId);
    return this.creditLedgerByUserId.get(userId) || [];
  }

  async createPaymentOrder(
    userId: string,
    input: Required<CreatePaymentOrderInput> & {packageName: string; credits: number; bonusCredits: number; amountCnyFen: number},
  ): Promise<PaymentOrderRecord> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const orderId = randomUUID();
    const order: PaymentOrderRecord = {
      id: orderId,
      userId,
      provider: input.provider as PaymentProvider,
      packageId: input.package_id,
      packageName: input.packageName,
      credits: input.credits,
      bonusCredits: input.bonusCredits,
      amountCnyFen: input.amountCnyFen,
      currency: 'cny',
      status: 'pending',
      providerOrderId: null,
      providerPrepayId: null,
      paymentUrl: buildPlaceholderPaymentUrl({
        provider: input.provider as PaymentProvider,
        orderId,
        packageName: input.packageName,
        amountCnyFen: input.amountCnyFen,
        expiresAt,
      }),
      paidAt: null,
      expiredAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.paymentOrdersById.set(order.id, order);
    return order;
  }

  async getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null> {
    const order = this.paymentOrdersById.get(orderId) || null;
    if (!order || order.userId !== userId) {
      return null;
    }
    const normalized = expirePaymentOrderIfNeeded(order);
    if (normalized !== order) {
      this.paymentOrdersById.set(order.id, normalized);
    }
    return normalized;
  }

  async applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null> {
    const order = this.paymentOrdersById.get(input.order_id || '');
    if (!order || order.provider !== provider) {
      return null;
    }
    if (order.status === 'paid') {
      return order;
    }
    const now = input.paid_at?.trim() || new Date().toISOString();
    const paidOrder: PaymentOrderRecord = {
      ...order,
      providerOrderId: input.provider_order_id || order.providerOrderId,
      status:
        input.status === 'paid' || input.status === 'failed' || input.status === 'expired' || input.status === 'refunded'
          ? input.status
          : order.status,
      paidAt: input.status === 'paid' ? now : order.paidAt,
      updatedAt: new Date().toISOString(),
    };
    this.paymentOrdersById.set(order.id, paidOrder);
    if (paidOrder.status === 'paid') {
      const account = await this.getCreditAccount(order.userId);
      const nextTopup = account.topupBalance + paidOrder.credits + paidOrder.bonusCredits;
      const nextAccount: CreditAccountRecord = {
        ...account,
        topupBalance: nextTopup,
        totalAvailableBalance: account.dailyFreeBalance + nextTopup,
        updatedAt: paidOrder.updatedAt,
      };
      this.creditAccountsByUserId.set(order.userId, nextAccount);
      const ledger = this.creditLedgerByUserId.get(order.userId) || [];
      ledger.unshift({
        id: randomUUID(),
        userId: order.userId,
        bucket: 'topup',
        direction: 'topup',
        amount: paidOrder.credits + paidOrder.bonusCredits,
        balanceAfter: nextTopup,
        referenceType: 'topup_order',
        referenceId: order.id,
        eventType: 'topup',
        delta: paidOrder.credits + paidOrder.bonusCredits,
        createdAt: paidOrder.updatedAt,
      });
      this.creditLedgerByUserId.set(order.userId, ledger);
    }
    return paidOrder;
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.runGrantsById.get(grantId) || null;
  }

  async getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null> {
    return this.runBillingSummaryByGrantId.get(grantId) || null;
  }

  async createRunGrant(input: {
    userId: string;
    sessionKey: string;
    client: string;
    nonce: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    creditLimit: number;
    expiresAt: string;
    signature: string;
  }): Promise<RunGrantRecord> {
    const grant: RunGrantRecord = {
      id: randomUUID(),
      userId: input.userId,
      sessionKey: input.sessionKey,
      client: input.client,
      status: 'issued',
      nonce: input.nonce,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      creditLimit: input.creditLimit,
      expiresAt: input.expiresAt,
      usedAt: null,
      signature: input.signature,
      billingSummary: null,
      createdAt: new Date().toISOString(),
    };
    this.runGrantsById.set(grant.id, grant);
    return grant;
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const existing = this.usageEventsByEventId.get(input.event_id);
    if (existing) return existing;

    const currentAccount = await this.getCreditAccount(userId);
    const requestedCost = Math.max(0, input.credit_cost);
    const dailyDebit = Math.min(currentAccount.dailyFreeBalance, requestedCost);
    const topupDebit = requestedCost - dailyDebit;
    if (topupDebit > currentAccount.topupBalance) {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    const nextAccount: CreditAccountRecord = {
      ...currentAccount,
      dailyFreeBalance: currentAccount.dailyFreeBalance - dailyDebit,
      topupBalance: currentAccount.topupBalance - topupDebit,
      totalAvailableBalance: currentAccount.totalAvailableBalance - requestedCost,
      updatedAt: new Date().toISOString(),
    };
    this.creditAccountsByUserId.set(userId, nextAccount);

    const ledger = this.creditLedgerByUserId.get(userId) || [];
    const createdAt = new Date().toISOString();
    if (topupDebit > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId,
        bucket: 'topup',
        direction: 'consume',
        amount: -topupDebit,
        balanceAfter: nextAccount.topupBalance,
        referenceType: 'chat_run',
        referenceId: input.event_id,
        eventType: 'usage_debit',
        delta: -topupDebit,
        createdAt,
      });
    }
    if (dailyDebit > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId,
        bucket: 'daily_free',
        direction: 'consume',
        amount: -dailyDebit,
        balanceAfter: nextAccount.dailyFreeBalance,
        referenceType: 'chat_run',
        referenceId: input.event_id,
        eventType: 'usage_debit',
        delta: -dailyDebit,
        createdAt,
      });
    }
    this.creditLedgerByUserId.set(userId, ledger);

    const grant = input.grant_id ? this.runGrantsById.get(input.grant_id) || null : null;
    const settledAt = createdAt;
    const summary: RunBillingSummaryRecord = {
      grantId: input.grant_id,
      eventId: input.event_id,
      sessionKey: grant?.sessionKey || 'main',
      client: grant?.client || 'desktop',
      status: 'settled',
      inputTokens: Math.max(0, input.input_tokens),
      outputTokens: Math.max(0, input.output_tokens),
      creditCost: Math.max(0, input.credit_cost),
      provider: input.provider || null,
      model: input.model || null,
      balanceAfter: nextAccount.totalAvailableBalance,
      settledAt,
    };

    if (grant) {
      this.runGrantsById.set(grant.id, {
        ...grant,
        status: 'settled',
        usedAt: settledAt,
        billingSummary: summary,
      });
      this.runBillingSummaryByGrantId.set(grant.id, summary);
    }

    const result: UsageEventResult = {
      accepted: true,
      balanceAfter: nextAccount,
      debits: [
        ...(dailyDebit > 0 ? [{bucket: 'daily_free' as const, amount: dailyDebit}] : []),
        ...(topupDebit > 0 ? [{bucket: 'topup' as const, amount: topupDebit}] : []),
      ],
      summary,
    };
    this.usageEventsByEventId.set(input.event_id, result);
    return result;
  }

  async getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null> {
    return this.workspaceBackupsByUserId.get(userId) || null;
  }

  async saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord> {
    const now = new Date().toISOString();
    const existing = this.workspaceBackupsByUserId.get(userId);
    const record: WorkspaceBackupRecord = {
      userId,
      identityMd: input.identity_md,
      userMd: input.user_md,
      soulMd: input.soul_md,
      agentsMd: input.agents_md,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.workspaceBackupsByUserId.set(userId, record);
    return record;
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    return Array.from(this.agentCatalog.values())
      .filter((item) => item.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'));
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    return this.agentCatalog.get(slug) || null;
  }

  async listSkillCatalog(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]> {
    const items = Array.from(this.skillCatalog.values())
      .filter((item) => item.distribution === 'cloud' && item.active)
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countSkillCatalog(): Promise<number> {
    return Array.from(this.skillCatalog.values()).filter((item) => item.distribution === 'cloud' && item.active).length;
  }

  async listSkillCatalogAdmin(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]> {
    const items = Array.from(this.skillCatalog.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countSkillCatalogAdmin(): Promise<number> {
    return this.skillCatalog.size;
  }

  async getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null> {
    return this.skillCatalog.get(slug) || null;
  }

  async upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord> {
    const now = new Date().toISOString();
    const existing = this.skillCatalog.get(input.slug);
    const next: SkillCatalogEntryRecord = {
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      market: input.market,
      category: input.category,
      skillType: input.skill_type,
      publisher: input.publisher,
      distribution: input.distribution,
      tags: input.tags,
      version: input.version,
      artifactFormat: input.artifact_format,
      artifactUrl: input.artifact_url,
      artifactSha256: input.artifact_sha256,
      artifactSourcePath: input.artifact_source_path,
      originType: input.origin_type,
      sourceUrl: input.source_url,
      metadata: input.metadata,
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.skillCatalog.set(input.slug, next);
    for (const [key, item] of this.userSkillLibrary.entries()) {
      if (item.slug !== input.slug || item.source !== 'cloud') continue;
      this.userSkillLibrary.set(key, {
        ...item,
        version: input.version,
        updatedAt: now,
      });
    }
    return next;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    return this.skillCatalog.delete(slug);
  }

  async listSkillSyncSources(): Promise<SkillSyncSourceRecord[]> {
    return Array.from(this.skillSyncSources.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName, 'zh-CN'),
    );
  }

  async getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null> {
    return this.skillSyncSources.get(id) || null;
  }

  async upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord> {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    const existing = this.skillSyncSources.get(id);
    const record: SkillSyncSourceRecord = {
      id,
      sourceType: input.source_type,
      sourceKey: input.source_key,
      displayName: input.display_name,
      sourceUrl: input.source_url,
      config: input.config,
      active: input.active,
      lastRunAt: existing?.lastRunAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.skillSyncSources.set(id, record);
    return record;
  }

  async deleteSkillSyncSource(id: string): Promise<boolean> {
    return this.skillSyncSources.delete(id);
  }

  async listSkillSyncRuns(limit = 20): Promise<SkillSyncRunRecord[]> {
    return Array.from(this.skillSyncRuns.values())
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }

  async createSkillSyncRun(input: {
    sourceId: string;
    sourceKey: string;
    sourceType: SkillSyncSourceRecord['sourceType'];
    displayName: string;
    status: SkillSyncRunRecord['status'];
    summary: Record<string, unknown>;
    items: SkillSyncRunRecord['items'];
    startedAt: string;
    finishedAt?: string | null;
  }): Promise<SkillSyncRunRecord> {
    const record: SkillSyncRunRecord = {
      id: randomUUID(),
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      sourceType: input.sourceType,
      displayName: input.displayName,
      status: input.status,
      summary: input.summary,
      items: input.items,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt || null,
    };
    this.skillSyncRuns.set(record.id, record);
    const source = this.skillSyncSources.get(record.sourceId);
    if (source) {
      this.skillSyncSources.set(source.id, {
        ...source,
        lastRunAt: record.finishedAt || record.startedAt,
        updatedAt: new Date().toISOString(),
      });
    }
    return record;
  }

  async listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]> {
    return Array.from(this.userPrivateSkills.values()).filter((item) => item.userId === userId);
  }

  async getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null> {
    return this.userPrivateSkills.get(`${userId}:${slug}`) || null;
  }

  async upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userPrivateSkills.get(key);
    const record: UserPrivateSkillRecord = {
      userId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      market: input.market,
      category: input.category,
      skillType: input.skill_type,
      publisher: input.publisher,
      tags: input.tags,
      sourceKind: input.source_kind,
      sourceUrl: input.source_url,
      version: input.version,
      artifactFormat: input.artifact_format,
      artifactKey: input.artifactKey,
      artifactSha256: input.artifact_sha256,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.userPrivateSkills.set(key, record);
    return record;
  }

  async deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean> {
    return this.userPrivateSkills.delete(`${userId}:${slug}`);
  }

  async listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]> {
    return Array.from(this.userAgentLibrary.values())
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.installedAt.localeCompare(left.installedAt));
  }

  async installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userAgentLibrary.get(key);
    const record: UserAgentLibraryRecord = {
      userId,
      slug: input.slug,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
    };
    this.userAgentLibrary.set(key, record);
    return record;
  }

  async removeUserAgent(userId: string, slug: string): Promise<boolean> {
    return this.userAgentLibrary.delete(`${userId}:${slug}`);
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    return Array.from(this.userSkillLibrary.values()).filter((item) => item.userId === userId);
  }

  async installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userSkillLibrary.get(key);
    const record: UserSkillLibraryRecord = {
      userId,
      slug: input.slug,
      version: input.version,
      source: input.source || existing?.source || 'cloud',
      enabled: true,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
    };
    this.userSkillLibrary.set(key, record);
    return record;
  }

  async updateUserSkill(
    userId: string,
    input: Required<UpdateSkillLibraryItemInput>,
  ): Promise<UserSkillLibraryRecord | null> {
    const key = `${userId}:${input.slug}`;
    const existing = this.userSkillLibrary.get(key);
    if (!existing) return null;
    const record: UserSkillLibraryRecord = {
      ...existing,
      enabled: input.enabled,
      updatedAt: new Date().toISOString(),
    };
    this.userSkillLibrary.set(key, record);
    return record;
  }

  async removeUserSkill(userId: string, slug: string): Promise<boolean> {
    return this.userSkillLibrary.delete(`${userId}:${slug}`);
  }

  private oauthKey(provider: OAuthProvider, providerId: string): string {
    return `${provider}:${providerId}`;
  }

  private paginateSkillCatalog(
    items: SkillCatalogEntryRecord[],
    limit?: number,
    offset?: number,
  ): SkillCatalogEntryRecord[] {
    const normalizedOffset =
      typeof offset === 'number' && Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      return items.slice(normalizedOffset);
    }
    return items.slice(normalizedOffset, normalizedOffset + Math.floor(limit));
  }
}
