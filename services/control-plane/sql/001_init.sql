create table if not exists users (
  id uuid primary key,
  username text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists avatar_url text;
alter table users add column if not exists role text not null default 'user';

create table if not exists user_emails (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  email text not null unique,
  is_primary boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_oauth_accounts (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists user_password_credentials (
  user_id uuid primary key references users(id) on delete cascade,
  password_hash text not null,
  password_algo text not null default 'scrypt',
  password_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_id text not null,
  client_type text not null,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists access_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid not null references device_sessions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid not null references device_sessions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists credit_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  balance bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  delta bigint not null,
  balance_after bigint not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists run_grants (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid references device_sessions(id) on delete set null,
  status text not null default 'issued',
  nonce text not null unique,
  max_input_tokens integer,
  max_output_tokens integer,
  credit_limit bigint,
  expires_at timestamptz not null,
  used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key,
  event_id text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  run_grant_id uuid references run_grants(id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  credit_cost bigint not null default 0,
  provider text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_workspace_backups (
  user_id uuid primary key references users(id) on delete cascade,
  identity_md text not null,
  user_md text not null,
  soul_md text not null,
  agents_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_catalog_entries (
  slug text primary key,
  name text not null,
  description text not null,
  category text not null,
  publisher text not null default 'iClaw',
  featured boolean not null default false,
  official boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  use_cases jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_agent_library (
  user_id uuid not null references users(id) on delete cascade,
  agent_slug text not null references agent_catalog_entries(slug) on delete cascade,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_slug)
);

create table if not exists skill_catalog_entries (
  slug text primary key,
  name text not null,
  description text not null,
  visibility text not null default 'showcase',
  market text,
  category text,
  skill_type text,
  publisher text not null default 'iClaw',
  distribution text not null default 'cloud',
  tags jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skill_releases (
  skill_slug text not null references skill_catalog_entries(slug) on delete cascade,
  version text not null,
  artifact_format text not null,
  artifact_url text,
  artifact_sha256 text,
  artifact_source_path text,
  status text not null default 'published',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (skill_slug, version)
);

create table if not exists user_private_skills (
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  market text,
  category text,
  skill_type text,
  publisher text not null default '个人导入',
  tags jsonb not null default '[]'::jsonb,
  source_kind text not null,
  source_url text,
  version text not null,
  artifact_format text not null,
  artifact_key text not null,
  artifact_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists user_skill_library (
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  source text not null default 'cloud',
  installed_version text not null,
  enabled boolean not null default true,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_slug)
);

alter table user_skill_library add column if not exists source text not null default 'cloud';

create table if not exists oem_brand_profiles (
  brand_id text primary key,
  tenant_key text not null,
  display_name text not null,
  product_name text not null,
  status text not null default 'draft',
  draft_config jsonb not null default '{}'::jsonb,
  published_config jsonb,
  published_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oem_brand_versions (
  id uuid primary key,
  brand_id text not null references oem_brand_profiles(brand_id) on delete cascade,
  version_no integer not null,
  config jsonb not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  unique (brand_id, version_no)
);

create table if not exists oem_asset_registry (
  id uuid primary key,
  brand_id text not null references oem_brand_profiles(brand_id) on delete cascade,
  asset_key text not null,
  kind text not null,
  storage_provider text not null default 'minio',
  object_key text not null,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, asset_key)
);

create table if not exists oem_audit_events (
  id uuid primary key,
  brand_id text not null,
  action text not null,
  actor_user_id uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_skill_library_skill_slug_fkey'
  ) then
    alter table user_skill_library drop constraint user_skill_library_skill_slug_fkey;
  end if;
exception
  when undefined_object then null;
end $$;

insert into agent_catalog_entries (
  slug,
  name,
  description,
  category,
  publisher,
  featured,
  official,
  tags,
  capabilities,
  use_cases,
  sort_order,
  active
) values
  (
    'stock-expert',
    '股票专家',
    '专业 AI 助手，专注于 A 股公告追踪、全球市场分析和交易复盘，提供数据驱动的投资决策参考。',
    'finance',
    'iClaw',
    true,
    true,
    '["金融","股票","研究"]'::jsonb,
    '["A 股公告追踪","全球股票分析","交易绩效复盘"]'::jsonb,
    '["没时间看盘时，让我持续追踪 A 股重大事件。","希望快速获得全球市场技术指标和走势摘要。","导入交割单后定位交易中的执行问题。"]'::jsonb,
    10,
    true
  ),
  (
    'summary-expert',
    '全能总结专家',
    '将音频、视频、网页链接、文档、文字和图片整理成结构化摘要、重点结论与行动清单。',
    'productivity',
    'iClaw',
    true,
    true,
    '["总结","效率","多模态"]'::jsonb,
    '["多模态内容摘要","会议纪要整理","行动项提炼"]'::jsonb,
    '["把冗长会议录音整理成纪要和待办。","快速读懂长文档、网页和视频重点。","把素材归纳成便于分享的结构化摘要。"]'::jsonb,
    20,
    true
  ),
  (
    'mail-assistant',
    '邮件助手',
    '跨账号智能邮件管家，帮助整理收件箱、草拟回复、提炼待办并减少遗漏。',
    'productivity',
    'iClaw',
    false,
    true,
    '["邮件","办公","效率"]'::jsonb,
    '["收件箱分诊","回复草拟与润色","跟进提醒提取"]'::jsonb,
    '["批量归类需要回复和可归档的邮件。","根据历史语气快速生成专业回复。","从长邮件线程里提炼明确待办和截止时间。"]'::jsonb,
    30,
    true
  ),
  (
    'wechat-writer',
    '微信公众号写作专家',
    '提供选题、标题、结构和长文润色，帮助稳定产出高质量的公众号内容。',
    'content',
    'iClaw',
    false,
    true,
    '["公众号","写作","内容"]'::jsonb,
    '["选题策划","标题与结构生成","成稿改写润色"]'::jsonb,
    '["围绕热点快速产出公众号选题和提纲。","把口语素材整理成长文表达。","优化标题、开头和结尾，提高完读率。"]'::jsonb,
    40,
    true
  ),
  (
    'x-content-operator',
    'X 平台内容运营专家',
    '一站式 X 平台内容创作与运营助手，支持选题、写推、线程编排与复盘。',
    'content',
    'iClaw',
    true,
    true,
    '["X","运营","内容增长"]'::jsonb,
    '["热点选题发现","推文与线程生成","发布节奏复盘"]'::jsonb,
    '["持续输出品牌化、专业感强的短内容。","把长内容拆解成可发布线程。","复盘哪些内容更容易带来互动和转化。"]'::jsonb,
    50,
    true
  ),
  (
    'cross-border-radar',
    '跨境电商选品雷达',
    '集成多平台数据，辅助竞争分析、选品判断与需求机会发现，适合跨境业务调研。',
    'commerce',
    'iClaw',
    false,
    true,
    '["跨境电商","选品","调研"]'::jsonb,
    '["平台竞品监控","选品机会分析","评论痛点提炼"]'::jsonb,
    '["比较多个平台的热门品类和价格带。","从用户评论中提炼产品优化方向。","快速发现高需求低竞争的选品机会。"]'::jsonb,
    60,
    true
  )
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  publisher = excluded.publisher,
  featured = excluded.featured,
  official = excluded.official,
  tags = excluded.tags,
  capabilities = excluded.capabilities,
  use_cases = excluded.use_cases,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

insert into skill_catalog_entries (
  slug,
  name,
  description,
  visibility,
  market,
  category,
  skill_type,
  publisher,
  distribution,
  tags,
  active
) values
  (
    'a-share-esg',
    'A股ESG筛选分析',
    '从ESG角度筛选A股上市公司，评估可持续发展实践与争议风险。',
    'showcase',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","ESG","筛选"]'::jsonb,
    true
  ),
  (
    'a-share-factor-screener',
    'A股量化因子筛选',
    '使用多因子框架筛选A股，识别价值、动量、质量等因子暴露有利的股票。',
    'showcase',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","量化","因子"]'::jsonb,
    true
  ),
  (
    'a-share-industry-rotation',
    'A股行业轮动检测',
    '通过宏观经济指标与经济周期定位，识别未来可能跑赢或跑输的A股行业。',
    'showcase',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","行业","轮动"]'::jsonb,
    true
  ),
  (
    'a-share-data-toolkit',
    'A股金融数据工具包',
    '提供A股实时行情、财务指标、董监高增减持和宏观数据抓取能力。',
    'showcase',
    'A股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["A股","数据","工具包"]'::jsonb,
    true
  ),
  (
    'a-share-low-valuation',
    'A股低估值股票筛选',
    '扫描A股低估值机会，筛选基本面稳健但被市场低估的公司。',
    'showcase',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","低估值","价值投资"]'::jsonb,
    true
  ),
  (
    'a-share-insider',
    'A股内部交易分析',
    '分析董监高与重要股东增减持行为，识别管理层信心信号与潜在机会。',
    'showcase',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","内部人交易","管理层"]'::jsonb,
    true
  ),
  (
    'a-share-small-cap-growth',
    'A股小盘成长股筛选',
    '识别A股被忽视的小市值高成长公司，适合寻找高弹性成长机会。',
    'showcase',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","小盘成长","高增长"]'::jsonb,
    true
  ),
  (
    'a-share-tech-valuation',
    'A股科技股估值分析',
    '对比分析A股科技公司的估值泡沫与基本面，识别高估与低估标的。',
    'showcase',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","科技估值","估值"]'::jsonb,
    true
  ),
  (
    'a-share-dividend',
    'A股高股息策略分析',
    '评估A股高股息与红利策略的收益可持续性、分红质量与长期回报。',
    'showcase',
    'A股',
    'portfolio',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","红利","股息"]'::jsonb,
    true
  ),
  (
    'us-esg',
    '美股ESG筛选分析',
    '从ESG角度筛选美股公司，评估可持续发展实践、争议风险与治理质量。',
    'showcase',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","ESG","筛选"]'::jsonb,
    true
  ),
  (
    'us-factor-screener',
    '美股量化因子筛选',
    '使用正式因子模型进行系统性多因子股票筛选，识别因子暴露有利的股票。',
    'showcase',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","量化","因子"]'::jsonb,
    true
  ),
  (
    'us-industry-rotation',
    '美股行业轮动检测',
    '通过宏观经济指标和商业周期定位，识别未来可能表现优异或落后的美股行业。',
    'showcase',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","行业","轮动"]'::jsonb,
    true
  ),
  (
    'us-data-toolkit',
    '美股金融数据工具包',
    '提供实时股票数据、SEC 文件、财务计算器和宏观指标抓取能力。',
    'showcase',
    '美股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["美股","数据","工具包"]'::jsonb,
    true
  ),
  (
    'us-low-valuation',
    '美股低估值股票筛选',
    '筛选基本面扎实但估值偏低的美股公司，适合价值投资与安全边际场景。',
    'showcase',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","低估值","价值投资"]'::jsonb,
    true
  ),
  (
    'us-insider',
    '美股内部人交易分析',
    '分析内部人交易模式与表格披露，识别管理层增持与看涨信号。',
    'showcase',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","内部人交易","管理层"]'::jsonb,
    true
  ),
  (
    'us-small-cap-growth',
    '美股小盘成长股筛选',
    '筛选小市值高成长、机构覆盖少但基本面强劲的美股成长机会。',
    'showcase',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","小盘成长","高增长"]'::jsonb,
    true
  ),
  (
    'us-tech-valuation',
    '美股科技股估值分析',
    '对比头部科技公司增长与估值，区分合理定价与高估泡沫。',
    'showcase',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","科技估值","估值"]'::jsonb,
    true
  ),
  (
    'us-dividend-aristocrats',
    '美股股息贵族分析',
    '分析连续提高分红的美股公司，评估股息可持续性与长期总回报。',
    'showcase',
    '美股',
    'portfolio',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","股息","红利"]'::jsonb,
    true
  )
on conflict (slug) do nothing;

insert into skill_releases (
  skill_slug,
  version,
  artifact_format,
  artifact_url,
  artifact_sha256,
  artifact_source_path,
  status,
  published_at
) values
  ('a-share-esg', '1.0.0', 'tar.gz', null, null, 'A股ESG筛选器', 'published', now()),
  ('a-share-factor-screener', '1.0.0', 'tar.gz', null, null, 'A股量化因子筛选器', 'published', now()),
  ('a-share-industry-rotation', '1.0.0', 'tar.gz', null, null, 'A股行业轮动探测器', 'published', now()),
  ('a-share-data-toolkit', '1.0.0', 'tar.gz', null, null, 'A股数据工具包', 'published', now()),
  ('a-share-low-valuation', '1.0.0', 'tar.gz', null, null, 'A股低估值股票筛选器', 'published', now()),
  ('a-share-insider', '1.0.0', 'tar.gz', null, null, 'A股内部交易分析师', 'published', now()),
  ('a-share-small-cap-growth', '1.0.0', 'tar.gz', null, null, 'A股小盘成长股识别器', 'published', now()),
  ('a-share-tech-valuation', '1.0.0', 'tar.gz', null, null, 'A股科技股估值分析师', 'published', now()),
  ('a-share-dividend', '1.0.0', 'tar.gz', null, null, 'A股高股息策略分析器', 'published', now()),
  ('us-esg', '1.0.0', 'tar.gz', null, null, '美股ESG筛选器', 'published', now()),
  ('us-factor-screener', '1.0.0', 'tar.gz', null, null, '美股量化因子扫描器', 'published', now()),
  ('us-industry-rotation', '1.0.0', 'tar.gz', null, null, '美股行业轮动探测器', 'published', now()),
  ('us-data-toolkit', '1.0.0', 'tar.gz', null, null, '美股数据工具包', 'published', now()),
  ('us-low-valuation', '1.0.0', 'tar.gz', null, null, '美股低估值股票扫描器', 'published', now()),
  ('us-insider', '1.0.0', 'tar.gz', null, null, '美股内部交易分析师', 'published', now()),
  ('us-small-cap-growth', '1.0.0', 'tar.gz', null, null, '美股小盘成长股扫描器', 'published', now()),
  ('us-tech-valuation', '1.0.0', 'tar.gz', null, null, '美股科技股估值分析师', 'published', now()),
  ('us-dividend-aristocrats', '1.0.0', 'tar.gz', null, null, '美股高股息策略分析器', 'published', now())
on conflict (skill_slug, version) do nothing;

insert into skill_catalog_entries (
  slug,
  name,
  description,
  visibility,
  market,
  category,
  skill_type,
  publisher,
  distribution,
  tags,
  active
) values
  (
    'admapix',
    'AdMapix',
    '广告素材检索、App 排名、下载收入追踪与市场洞察助手，适合增长运营与竞品研究。',
    'showcase',
    '通用',
    'data',
    '工具包',
    'ClawHub · fly0pants',
    'cloud',
    '["运营增长","广告投放","市场洞察"]'::jsonb,
    true
  ),
  (
    'marketing-strategy-pmm',
    'Marketing Strategy Pmm',
    '围绕定位、GTM、竞品洞察与产品发布制定产品营销策略，适合产品营销与增长规划。',
    'showcase',
    '通用',
    'general',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","GTM","产品营销"]'::jsonb,
    true
  ),
  (
    'marketing-demand-acquisition',
    'Marketing Demand Acquisition',
    '设计获客投放、SEO 与渠道增长方案，适合增长运营、需求获取与渠道扩张场景。',
    'showcase',
    '通用',
    'general',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","增长获客","SEO"]'::jsonb,
    true
  ),
  (
    'revenue-operations',
    'Revenue Operations',
    '分析销售漏斗、收入预测与 GTM 效率，适合营收运营和销售流程优化。',
    'showcase',
    '通用',
    'data',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","营收运营","销售漏斗"]'::jsonb,
    true
  ),
  (
    'x-publisher',
    'X tweet publisher',
    '发布 X/Twitter 文本、图片和视频内容，适合账号运营与社交分发。',
    'showcase',
    '通用',
    'general',
    '工具包',
    'ClawHub · AlphaFactor',
    'cloud',
    '["自媒体","社交分发","X"]'::jsonb,
    true
  ),
  (
    'ghost',
    'ghost cms',
    '管理 Ghost CMS 博客文章的创建、更新、删除与列表，适合内容发布与博客运维。',
    'showcase',
    '通用',
    'report',
    '工具包',
    'ClawHub · AlphaFactor',
    'cloud',
    '["自媒体","博客","内容管理"]'::jsonb,
    true
  ),
  (
    'video-transcript-downloader',
    'Video Transcript Downloader',
    '下载视频、音频、字幕并生成清洗后的 transcript，适合内容二创与素材整理。',
    'showcase',
    '通用',
    'data',
    '工具包',
    'ClawHub · steipete',
    'cloud',
    '["自媒体","视频","转录"]'::jsonb,
    true
  ),
  (
    'video-summary',
    'Video Summary',
    '总结 B 站、小红书、抖音与 YouTube 视频内容，提炼结构化洞察和重点摘要。',
    'showcase',
    '通用',
    'report',
    '生成器',
    'ClawHub · lifei68801',
    'cloud',
    '["自媒体","视频总结","内容创作"]'::jsonb,
    true
  ),
  (
    'xiaohongshu-search-summarizer',
    'Xiaohongshu Search Summarizer',
    '搜索小红书关键词，提取笔记、图片与评论并生成总结，适合选题与内容洞察。',
    'showcase',
    '通用',
    'report',
    '扫描器',
    'ClawHub · piekill',
    'cloud',
    '["自媒体","小红书","内容洞察"]'::jsonb,
    true
  ),
  (
    'productivity',
    'Productivity',
    '围绕时间块、目标、项目、习惯和复盘提升个人执行效率，适合超级个体日常工作流。',
    'showcase',
    '通用',
    'general',
    '分析师',
    'ClawHub · ivangdavila',
    'cloud',
    '["超级个体","效率","任务管理"]'::jsonb,
    true
  ),
  (
    'notion-sync',
    'Notion Sync',
    '双向同步和管理 Notion 页面与数据库，适合个人知识库与项目协作。',
    'showcase',
    '通用',
    'data',
    '工具包',
    'ClawHub · robansuini',
    'cloud',
    '["超级个体","Notion","知识库"]'::jsonb,
    true
  ),
  (
    'todo',
    'Todo',
    '管理任务、项目、提醒、承诺与 follow-up，帮助个人形成执行闭环。',
    'showcase',
    '通用',
    'general',
    '工具包',
    'ClawHub · agenticio',
    'cloud',
    '["超级个体","待办","任务管理"]'::jsonb,
    true
  ),
  (
    'cron',
    'Cron',
    '本地优先的周期计划与重复提醒引擎，适合 recurring task 与定时执行场景。',
    'showcase',
    '通用',
    'general',
    '工具包',
    'ClawHub · qclawbot',
    'cloud',
    '["超级个体","定时","自动化"]'::jsonb,
    true
  ),
  (
    'temporal-cortex',
    'temporal-cortex',
    '管理 Google、Outlook 与 CalDAV 日历、会议和可用时间，适合个人日程协同。',
    'showcase',
    '通用',
    'general',
    '工具包',
    'ClawHub · billylui',
    'cloud',
    '["超级个体","日程","日历"]'::jsonb,
    true
  ),
  (
    'word-docx',
    'Word / DOCX',
    '创建、检查和编辑 Word 文档，支持样式、编号、修订、表格与兼容性检查。',
    'showcase',
    '通用',
    'report',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","文档","Word"]'::jsonb,
    true
  ),
  (
    'excel-xlsx',
    'Excel / XLSX',
    '创建、检查和编辑 Excel 工作簿，支持公式、格式、数据类型与重算。',
    'showcase',
    '通用',
    'data',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","表格","Excel"]'::jsonb,
    true
  ),
  (
    'powerpoint-pptx',
    'Powerpoint / PPTX',
    '创建、检查和编辑 PowerPoint 演示文稿，支持模板、布局、备注与图表。',
    'showcase',
    '通用',
    'report',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","演示","PPT"]'::jsonb,
    true
  ),
  (
    'paddleocr-doc-parsing',
    'PaddleOCR Document Parsing',
    '将复杂 PDF 与文档图片解析为保留结构的 Markdown 和 JSON，适合文档数字化。',
    'showcase',
    '通用',
    'data',
    '工具包',
    'ClawHub · Bobholamovic',
    'cloud',
    '["办公效率","OCR","文档解析"]'::jsonb,
    true
  ),
  (
    'feishu-send-file',
    'feishu-send-file',
    '通过飞书发送附件与文件，适合办公协同、结果交付与自动化通知。',
    'showcase',
    '通用',
    'general',
    '工具包',
    'ClawHub · dadaniya99',
    'cloud',
    '["办公效率","飞书","协同"]'::jsonb,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  market = excluded.market,
  category = excluded.category,
  skill_type = excluded.skill_type,
  publisher = excluded.publisher,
  distribution = excluded.distribution,
  tags = excluded.tags,
  active = excluded.active,
  updated_at = now();

insert into skill_releases (
  skill_slug,
  version,
  artifact_format,
  artifact_url,
  artifact_sha256,
  artifact_source_path,
  status,
  published_at
) values
  ('admapix', '1.0.14', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=admapix&version=1.0.14', null, null, 'published', now()),
  ('marketing-strategy-pmm', '2.1.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-strategy-pmm&version=2.1.1', null, null, 'published', now()),
  ('marketing-demand-acquisition', '2.1.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-demand-acquisition&version=2.1.1', null, null, 'published', now()),
  ('revenue-operations', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=revenue-operations&version=1.0.0', null, null, 'published', now()),
  ('x-publisher', '1.0.6', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=x-publisher&version=1.0.6', null, null, 'published', now()),
  ('ghost', '1.0.5', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=ghost&version=1.0.5', null, null, 'published', now()),
  ('video-transcript-downloader', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=video-transcript-downloader&version=1.0.0', null, null, 'published', now()),
  ('video-summary', '1.6.4', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=video-summary&version=1.6.4', null, null, 'published', now()),
  ('xiaohongshu-search-summarizer', '1.0.3', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=xiaohongshu-search-summarizer&version=1.0.3', null, null, 'published', now()),
  ('productivity', '1.0.4', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=productivity&version=1.0.4', null, null, 'published', now()),
  ('notion-sync', '2.5.3', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=notion-sync&version=2.5.3', null, null, 'published', now()),
  ('todo', '3.0.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=todo&version=3.0.1', null, null, 'published', now()),
  ('cron', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=cron&version=1.0.0', null, null, 'published', now()),
  ('temporal-cortex', '0.9.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=temporal-cortex&version=0.9.1', null, null, 'published', now()),
  ('word-docx', '1.0.2', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=word-docx&version=1.0.2', null, null, 'published', now()),
  ('excel-xlsx', '1.0.2', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=excel-xlsx&version=1.0.2', null, null, 'published', now()),
  ('powerpoint-pptx', '1.0.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=powerpoint-pptx&version=1.0.1', null, null, 'published', now()),
  ('paddleocr-doc-parsing', '2.0.8', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=paddleocr-doc-parsing&version=2.0.8', null, null, 'published', now()),
  ('feishu-send-file', '1.2.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=feishu-send-file&version=1.2.1', null, null, 'published', now())
on conflict (skill_slug, version) do update set
  artifact_format = excluded.artifact_format,
  artifact_url = excluded.artifact_url,
  artifact_sha256 = excluded.artifact_sha256,
  artifact_source_path = excluded.artifact_source_path,
  status = excluded.status,
  published_at = excluded.published_at;

update skill_catalog_entries
set active = false,
    updated_at = now()
where slug in ('github', 'gog', 'ontology', 'skill-vetter', 'summarize');

create index if not exists idx_device_sessions_user_id on device_sessions(user_id);
create index if not exists idx_access_tokens_user_id on access_tokens(user_id);
create index if not exists idx_access_tokens_device_session_id on access_tokens(device_session_id);
create index if not exists idx_user_emails_user_id on user_emails(user_id);
create index if not exists idx_user_oauth_accounts_user_id on user_oauth_accounts(user_id);
create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_device_session_id on refresh_tokens(device_session_id);
create index if not exists idx_run_grants_nonce on run_grants(nonce);
create index if not exists idx_usage_events_event_id on usage_events(event_id);
create index if not exists idx_credit_ledger_user_id_created_at on credit_ledger(user_id, created_at desc);
create index if not exists idx_run_grants_user_id_created_at on run_grants(user_id, created_at desc);
create index if not exists idx_usage_events_user_id_created_at on usage_events(user_id, created_at desc);
create index if not exists idx_user_workspace_backups_updated_at on user_workspace_backups(updated_at desc);
create index if not exists idx_agent_catalog_entries_active_sort
  on agent_catalog_entries(active, sort_order, name);
create index if not exists idx_user_agent_library_user_id_installed_at
  on user_agent_library(user_id, installed_at desc);
create index if not exists idx_skill_catalog_entries_distribution_active
  on skill_catalog_entries(distribution, active, name);
create index if not exists idx_skill_releases_skill_slug_published_at
  on skill_releases(skill_slug, published_at desc, created_at desc);
create index if not exists idx_user_skill_library_user_id_installed_at
  on user_skill_library(user_id, installed_at desc);
