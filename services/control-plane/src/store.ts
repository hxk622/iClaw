import { randomUUID } from 'node:crypto';

import type {
  CreateUserInput,
  CreditLedgerRecord,
  ImportUserPrivateSkillInput,
  InstallSkillInput,
  OAuthAccountRecord,
  OAuthProvider,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillReleaseRecord,
  UpsertSkillCatalogEntryInput,
  UsageEventInput,
  UsageEventResult,
  UserPrivateSkillRecord,
  UserRole,
  UserSkillLibraryRecord,
  UpdateSkillLibraryItemInput,
  UserRecord,
  WorkspaceBackupInput,
  WorkspaceBackupRecord,
} from './domain.ts';

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
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
  getCreditBalance(userId: string): Promise<number>;
  getCreditLedger(userId: string): Promise<CreditLedgerRecord[]>;
  getRunGrantById(grantId: string): Promise<RunGrantRecord | null>;
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
  listSkillCatalog(): Promise<SkillCatalogEntryRecord[]>;
  listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]>;
  getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null>;
  upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord>;
  deleteSkillCatalogEntry(slug: string): Promise<boolean>;
  getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null>;
  listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]>;
  getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null>;
  upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord>;
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
  private readonly creditBalanceByUserId = new Map<string, number>();
  private readonly creditLedgerByUserId = new Map<string, CreditLedgerRecord[]>();
  private readonly runGrantsById = new Map<string, RunGrantRecord>();
  private readonly usageEventsByEventId = new Map<string, UsageEventResult>();
  private readonly workspaceBackupsByUserId = new Map<string, WorkspaceBackupRecord>();
  private readonly skillCatalog = new Map<string, SkillCatalogEntryRecord>();
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
      distribution: 'cloud',
      tags: [...seed.tags],
      active: true,
      createdAt: now,
      updatedAt: now,
      latestRelease: {
        slug: seed.slug,
        version: seed.version || '1.0.0',
        artifactFormat: seed.artifactFormat || 'tar.gz',
        artifactUrl: seed.artifactUrl || null,
        artifactSha256: null,
        artifactSourcePath: seed.artifactSourcePath || null,
        publishedAt: now,
        createdAt: now,
      },
    }));

    for (const entry of cloudSkills) {
      this.skillCatalog.set(entry.slug, entry);
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
    this.creditBalanceByUserId.set(user.id, input.initialCreditBalance);
    this.creditLedgerByUserId.set(user.id, [
      {
        id: randomUUID(),
        userId: user.id,
        eventType: 'signup_grant',
        delta: input.initialCreditBalance,
        balanceAfter: input.initialCreditBalance,
        createdAt: now,
      },
    ]);

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

  async getCreditBalance(userId: string): Promise<number> {
    return this.creditBalanceByUserId.get(userId) || 0;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    return this.creditLedgerByUserId.get(userId) || [];
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.runGrantsById.get(grantId) || null;
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
      nonce: input.nonce,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      creditLimit: input.creditLimit,
      expiresAt: input.expiresAt,
      signature: input.signature,
      createdAt: new Date().toISOString(),
    };
    this.runGrantsById.set(grant.id, grant);
    return grant;
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const existing = this.usageEventsByEventId.get(input.event_id);
    if (existing) return existing;

    const currentBalance = this.creditBalanceByUserId.get(userId) || 0;
    const nextBalance = currentBalance - Math.max(0, input.credit_cost);
    this.creditBalanceByUserId.set(userId, nextBalance);

    const ledger = this.creditLedgerByUserId.get(userId) || [];
    ledger.unshift({
      id: randomUUID(),
      userId,
      eventType: 'usage_debit',
      delta: -Math.max(0, input.credit_cost),
      balanceAfter: nextBalance,
      createdAt: new Date().toISOString(),
    });
    this.creditLedgerByUserId.set(userId, ledger);

    const result: UsageEventResult = {
      accepted: true,
      balanceAfter: nextBalance,
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

  async listSkillCatalog(): Promise<SkillCatalogEntryRecord[]> {
    return Array.from(this.skillCatalog.values()).filter((item) => item.distribution === 'cloud' && item.active);
  }

  async listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]> {
    return Array.from(this.skillCatalog.values()).sort((left, right) => left.name.localeCompare(right.name));
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
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      latestRelease: existing?.latestRelease || null,
    };
    this.skillCatalog.set(input.slug, next);
    return next;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    return this.skillCatalog.delete(slug);
  }

  async getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null> {
    const entry = this.skillCatalog.get(slug);
    if (!entry?.latestRelease) return null;
    if (version && entry.latestRelease.version !== version) return null;
    return entry.latestRelease;
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
}
