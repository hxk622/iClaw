import {buildCloudSkillArtifactObjectKey, CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD} from './cloud-skill-artifacts.ts';

export type ExternalCloudSkillSeed = {
  slug: string;
  name: string;
  description: string;
  market: string;
  category: string;
  skillType: string;
  tags: string[];
  publisher: string;
  distribution: 'cloud';
  artifactFormat: 'zip' | 'tar.gz';
  version: string;
  originType: 'manual' | 'clawhub' | 'github_repo';
  sourceUrl?: string;
  metadata: Record<string, unknown>;
};

export const XIAOHONGSHU_CLOUD_SKILL_SLUG = 'xiaohongshu-skills';
export const XIAOHONGSHU_CLOUD_SKILL_VERSION = '1.0.3';
export const XIAOHONGSHU_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;
export const REMOTION_CLOUD_SKILL_SLUG = 'remotion-skill';
export const REMOTION_CLOUD_SKILL_VERSION = '1.0.0';
export const REMOTION_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;
export const FRONTEND_SLIDES_CLOUD_SKILL_SLUG = 'frontend-slides';
export const FRONTEND_SLIDES_CLOUD_SKILL_VERSION = '1.0.0';
export const FRONTEND_SLIDES_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;
export const WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_SLUG = 'web-crawl-for-toutiao';
export const WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_VERSION = '1.0.0';
export const WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;
export const WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_SLUG = 'web-crawl-for-wechat-artical';
export const WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_VERSION = '1.0.0';
export const WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;

export const XIAOHONGSHU_CLOUD_SKILL_SEED: ExternalCloudSkillSeed = {
  slug: XIAOHONGSHU_CLOUD_SKILL_SLUG,
  name: '小红书自动化',
  description: '使用本地 Chrome CDP 自动化完成小红书登录、搜索、详情查看、图文/视频发布和互动操作。',
  market: '通用',
  category: 'automation',
  skillType: '自动化助手',
  tags: ['小红书', '自动化', '发布', '搜索', '互动'],
  publisher: 'iClaw',
  distribution: 'cloud' as const,
  artifactFormat: XIAOHONGSHU_CLOUD_SKILL_ARTIFACT_FORMAT,
  version: XIAOHONGSHU_CLOUD_SKILL_VERSION,
  originType: 'manual' as const,
  metadata: {
    execution_surface: 'desktop-local',
    requires_login: true,
    has_side_effects: true,
    confirmation_required_actions: ['publish', 'comment', 'reply-comment', 'like', 'favorite', 'delete-cookies'],
    [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: buildCloudSkillArtifactObjectKey({
      slug: XIAOHONGSHU_CLOUD_SKILL_SLUG,
      version: XIAOHONGSHU_CLOUD_SKILL_VERSION,
      artifactFormat: XIAOHONGSHU_CLOUD_SKILL_ARTIFACT_FORMAT,
    }),
  },
};

export const REMOTION_CLOUD_SKILL_SEED: ExternalCloudSkillSeed = {
  slug: REMOTION_CLOUD_SKILL_SLUG,
  name: 'Remotion 视频生成',
  description: '使用 Remotion + React 生成动画视频、图表视频、字幕动效和数据驱动视频内容。',
  market: '通用',
  category: 'content',
  skillType: '视频生成',
  tags: ['Remotion', '视频', 'React', '动画', '字幕', '数据可视化'],
  publisher: 'iClaw',
  distribution: 'cloud' as const,
  artifactFormat: REMOTION_CLOUD_SKILL_ARTIFACT_FORMAT,
  version: REMOTION_CLOUD_SKILL_VERSION,
  originType: 'manual' as const,
  metadata: {
    execution_surface: 'desktop-local',
    has_side_effects: false,
    [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: buildCloudSkillArtifactObjectKey({
      slug: REMOTION_CLOUD_SKILL_SLUG,
      version: REMOTION_CLOUD_SKILL_VERSION,
      artifactFormat: REMOTION_CLOUD_SKILL_ARTIFACT_FORMAT,
    }),
  },
};

export const FRONTEND_SLIDES_CLOUD_SKILL_SEED: ExternalCloudSkillSeed = {
  slug: FRONTEND_SLIDES_CLOUD_SKILL_SLUG,
  name: 'Frontend Slides',
  description: '创建高设计感、强动效、零依赖的 HTML 演示文稿，也支持将 PPT/PPTX 转为 Web Slides。',
  market: '通用',
  category: 'content',
  skillType: '演示生成',
  tags: ['演示', 'Slides', 'PPT', 'HTML', '前端设计'],
  publisher: 'zarazhangrui · iClaw',
  distribution: 'cloud' as const,
  artifactFormat: FRONTEND_SLIDES_CLOUD_SKILL_ARTIFACT_FORMAT,
  version: FRONTEND_SLIDES_CLOUD_SKILL_VERSION,
  originType: 'github_repo' as const,
  sourceUrl: 'https://github.com/zarazhangrui/frontend-slides',
  metadata: {
    execution_surface: 'desktop-local',
    has_side_effects: false,
    source_label: 'GitHub',
    source_repo: 'zarazhangrui/frontend-slides',
    [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: buildCloudSkillArtifactObjectKey({
      slug: FRONTEND_SLIDES_CLOUD_SKILL_SLUG,
      version: FRONTEND_SLIDES_CLOUD_SKILL_VERSION,
      artifactFormat: FRONTEND_SLIDES_CLOUD_SKILL_ARTIFACT_FORMAT,
    }),
  },
};

export const WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_SEED: ExternalCloudSkillSeed = {
  slug: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_SLUG,
  name: 'Toutiao 文章抓取',
  description: '使用本机 Chrome Headless 执行页面 JavaScript，抓取今日头条文章正文、标题、作者、发布时间与摘要。',
  market: '通用',
  category: 'content',
  skillType: '网页阅读',
  tags: ['今日头条', '网页抓取', '文章提取', 'Chrome', 'Headless'],
  publisher: 'iClaw',
  distribution: 'cloud' as const,
  artifactFormat: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_ARTIFACT_FORMAT,
  version: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_VERSION,
  originType: 'manual' as const,
  metadata: {
    execution_surface: 'desktop-local',
    requires_local_chrome: true,
    target_sites: ['toutiao.com', 'm.toutiao.com'],
    has_side_effects: false,
    [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: buildCloudSkillArtifactObjectKey({
      slug: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_SLUG,
      version: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_VERSION,
      artifactFormat: WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_ARTIFACT_FORMAT,
    }),
  },
};

export const WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_SEED: ExternalCloudSkillSeed = {
  slug: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_SLUG,
  name: '微信公众号文章抓取',
  description: '使用本机 Chrome Headless 执行微信公众号文章页面 JavaScript，抓取标题、作者、公众号名、发布时间、摘要与正文。',
  market: '通用',
  category: 'content',
  skillType: '网页阅读',
  tags: ['微信公众号', '微信文章', '网页抓取', '文章提取', 'Chrome', 'Headless'],
  publisher: 'iClaw',
  distribution: 'cloud' as const,
  artifactFormat: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_ARTIFACT_FORMAT,
  version: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_VERSION,
  originType: 'manual' as const,
  metadata: {
    execution_surface: 'desktop-local',
    requires_local_chrome: true,
    target_sites: ['mp.weixin.qq.com'],
    has_side_effects: false,
    [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: buildCloudSkillArtifactObjectKey({
      slug: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_SLUG,
      version: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_VERSION,
      artifactFormat: WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_ARTIFACT_FORMAT,
    }),
  },
};

export const EXTERNAL_CLOUD_SKILL_SEEDS: ExternalCloudSkillSeed[] = [
  XIAOHONGSHU_CLOUD_SKILL_SEED,
  REMOTION_CLOUD_SKILL_SEED,
  FRONTEND_SLIDES_CLOUD_SKILL_SEED,
  WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_SEED,
  WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_SEED,
];

export const XIAOHONGSHU_CLOUD_SKILL_REQUIRED_PATHS = ['scripts', 'skills'];

export const XIAOHONGSHU_CLOUD_SKILL_OPTIONAL_PATHS = ['requirements.txt'];

export const REMOTION_CLOUD_SKILL_REQUIRED_PATHS = ['rules'];
export const FRONTEND_SLIDES_CLOUD_SKILL_REQUIRED_PATHS = [
  'LICENSE',
  'README.md',
  'SKILL.md',
  'STYLE_PRESETS.md',
  'animation-patterns.md',
  'html-template.md',
  'viewport-base.css',
  'scripts',
] as const;
export const WEB_CRAWL_FOR_TOUTIAO_CLOUD_SKILL_REQUIRED_PATHS = ['scripts'] as const;
export const WEB_CRAWL_FOR_WECHAT_ARTICAL_CLOUD_SKILL_REQUIRED_PATHS = ['scripts'] as const;

export const XIAOHONGSHU_CLOUD_SKILL_REQUIREMENTS = `requests>=2.31,<3
websockets>=11,<16
`;

export function buildXiaohongshuSkillMarkdown(): string {
  return `---
name: 小红书自动化
slug: xiaohongshu-skills
tags: 小红书, 自动化, 登录, 发布, 搜索, 互动
description: 使用本地 Chrome CDP 自动化完成小红书登录、搜索、详情查看、图文/视频发布、评论、点赞和收藏。
market: 通用
category: automation
skill_type: 自动化助手
publisher: iClaw
metadata: {"openclaw":{"emoji":"📕","os":["darwin","linux"],"requires":{"bins":["python3","uv"]},"skillKey":"xiaohongshu-skills"}}
---

# 小红书自动化

你在使用一个带真实副作用的本地自动化 skill。它依赖本机 Chrome 登录态和本地 Python 环境，只适合在桌面 / 本地 runtime 场景使用。

## 强制边界

- 所有小红书操作只能通过 \`python3 {baseDir}/scripts/cli.py <子命令>\` 完成。
- 不要改用其他小红书 MCP、Go 工具、第三方自动化项目或远端服务。
- 发布、评论、回复、点赞、收藏、删除 cookies 这类有副作用的动作，必须先得到用户明确确认。
- 文件路径必须使用绝对路径。
- 任务完成后直接返回结果，不要继续做额外动作。

## 首次使用前检查

先检查运行依赖：

\`\`\`bash
python3 -c "import requests, websockets"
\`\`\`

如果缺依赖，再安装：

\`\`\`bash
python3 -m pip install -r {baseDir}/requirements.txt
\`\`\`

然后检查 Chrome 是否可启动，并确认本机已有小红书登录能力。

## 账号规则

先运行：

\`\`\`bash
python3 {baseDir}/scripts/cli.py list-accounts
\`\`\`

- 没有命名账号：直接使用默认账号，不加 \`--account\`
- 只有一个命名账号：本轮固定使用该账号
- 多个命名账号：先让用户指定一个，再在后续命令里统一加 \`--account <name>\`

## 常用命令

登录状态：

\`\`\`bash
python3 {baseDir}/scripts/cli.py check-login
python3 {baseDir}/scripts/cli.py login
python3 {baseDir}/scripts/cli.py get-qrcode
python3 {baseDir}/scripts/cli.py wait-login
python3 {baseDir}/scripts/cli.py send-code --phone 13800000000
python3 {baseDir}/scripts/cli.py verify-code --code 123456
\`\`\`

搜索和浏览：

\`\`\`bash
python3 {baseDir}/scripts/cli.py list-feeds
python3 {baseDir}/scripts/cli.py search-feeds --keyword "基金"
python3 {baseDir}/scripts/cli.py get-feed-detail --feed-id FEED_ID --xsec-token XSEC_TOKEN
python3 {baseDir}/scripts/cli.py user-profile --user-id USER_ID --xsec-token XSEC_TOKEN
\`\`\`

互动：

\`\`\`bash
python3 {baseDir}/scripts/cli.py post-comment --feed-id FEED_ID --xsec-token XSEC_TOKEN --content "评论内容"
python3 {baseDir}/scripts/cli.py reply-comment --feed-id FEED_ID --xsec-token XSEC_TOKEN --comment-id COMMENT_ID --content "回复内容"
python3 {baseDir}/scripts/cli.py like-feed --feed-id FEED_ID --xsec-token XSEC_TOKEN
python3 {baseDir}/scripts/cli.py favorite-feed --feed-id FEED_ID --xsec-token XSEC_TOKEN
\`\`\`

发布：

\`\`\`bash
python3 {baseDir}/scripts/cli.py publish \\
  --title-file /abs/title.txt \\
  --content-file /abs/content.txt \\
  --images /abs/pic1.jpg /abs/pic2.jpg

python3 {baseDir}/scripts/cli.py publish-video \\
  --title-file /abs/title.txt \\
  --content-file /abs/content.txt \\
  --video /abs/video.mp4
\`\`\`

更稳妥的发布流程是先填表单，再确认发布：

\`\`\`bash
python3 {baseDir}/scripts/cli.py fill-publish \\
  --title-file /abs/title.txt \\
  --content-file /abs/content.txt \\
  --images /abs/pic1.jpg

python3 {baseDir}/scripts/cli.py click-publish
\`\`\`

如果用户取消发布，优先保存草稿：

\`\`\`bash
python3 {baseDir}/scripts/cli.py save-draft
\`\`\`

## 工作流

1. 先检查账号和登录状态。
2. 读取用户意图，选择认证 / 搜索 / 详情 / 发布 / 互动命令。
3. 对所有副作用动作先二次确认。
4. 执行命令后，按 JSON 结果结构化总结给用户。
5. 如果返回未登录、频率限制或 Chrome 不可用，先停下来处理环境问题，不要盲目重试。

## 补充资料

- 认证细节见 \`skills/xhs-auth/SKILL.md\`
- 发布流程见 \`skills/xhs-publish/SKILL.md\`
- 搜索浏览见 \`skills/xhs-explore/SKILL.md\`
- 社交互动见 \`skills/xhs-interact/SKILL.md\`
- 复合运营见 \`skills/xhs-content-ops/SKILL.md\`
`;
}

export function buildRemotionSkillMarkdown(): string {
  return `---
name: Remotion 视频生成
slug: remotion-skill
tags: remotion, 视频, react, 动画, composition, 字幕, 数据可视化
description: 使用 Remotion + React 生成动画视频、图表视频、字幕动效和数据驱动视频内容。
market: 通用
category: content
skill_type: 视频生成
publisher: iClaw
metadata: {"openclaw":{"emoji":"🎬","os":["darwin","linux"],"skillKey":"remotion-skill"}}
---

# Remotion 视频生成

这个 skill 适合把内容、数据和视觉动画组合成可导出的视频，适用于 MP4 / WebM / GIF 等输出。

## 适用场景

- 生成宣传片、产品介绍、片头片尾、字幕动效
- 生成图表视频、数据可视化视频、市场复盘视频
- 生成股票走势、组合表现、财报摘要等金融视频
- 需要用 React 组件、时间轴、参数化模板来编排视频内容

## 使用原则

- 默认用 Remotion 的 React 组合方式组织视频，而不是临时拼接 ffmpeg 命令。
- 先确定视频目标、画幅比例、时长、分镜，再设计 Composition。
- 有字幕、转场、图表、素材导入等需求时，按需读取对应规则文件，不要一次性加载全部规则。
- 如果用户目标是做网页或静态图，不要误用这个 skill。

## 推荐工作流

1. 明确输出格式、时长、分辨率和目标平台。
2. 拆成一个或多个 Composition，确认每段内容的时间轴。
3. 需要图表、字幕、转场、音频、素材导入时，再加载对应规则文件。
4. 最后整理 props、参数和渲染方式，保证可复用。

## 规则索引

- \`rules/animations.md\`：基础动画、spring、easing、插值
- \`rules/compositions.md\`：Composition、Folder、默认 props、动态元数据
- \`rules/timing.md\`：时间轴和插值曲线
- \`rules/transitions.md\`：场景切换和转场
- \`rules/text-animations.md\`：标题、字幕、文本动画
- \`rules/subtitles.md\`：字幕工作流
- \`rules/audio.md\`：音频导入、裁剪、音量、速度
- \`rules/videos.md\`：视频素材导入、裁剪、循环、倍速
- \`rules/images.md\`：图片素材导入
- \`rules/charts.md\`：图表和数据可视化视频
- \`rules/parameters.md\`：参数化模板和输入 schema
- \`rules/tailwind.md\`：Tailwind 在 Remotion 中的使用
- \`rules/fonts.md\`：字体加载与排版
- \`rules/3d.md\`：Three.js / React Three Fiber 3D 场景
- \`rules/maps.md\`：地图动画

## 补充规则

- 字幕导入：\`rules/import-srt-captions.md\`
- 字幕转写：\`rules/transcribe-captions.md\`
- DOM / 文本尺寸测量：\`rules/measuring-dom-nodes.md\`、\`rules/measuring-text.md\`
- 素材能力：\`rules/assets.md\`、\`rules/gifs.md\`、\`rules/light-leaks.md\`、\`rules/lottie.md\`
- 视频信息提取：\`rules/get-video-duration.md\`、\`rules/get-video-dimensions.md\`、\`rules/extract-frames.md\`

## 输出要求

- 回答时优先给出可直接落地的 Composition 结构、组件建议和关键代码骨架。
- 如果用户场景里包含金融图表或经营数据，要把数据结构、时间轴和视觉编码一起说明。
- 如果需要导出视频，再补充渲染命令和参数，而不是只停留在概念描述。
`;
}

export function buildWebCrawlForToutiaoSkillMarkdown(): string {
  return `---
name: Web Crawl for Toutiao
slug: web-crawl-for-toutiao
tags: 今日头条, 网页抓取, 文章提取, Chrome, Headless
description: 使用本机 Chrome Headless 执行页面 JavaScript，抓取今日头条文章正文、标题、作者、发布时间与摘要。
market: 通用
category: content
skill_type: 网页阅读
publisher: iClaw
metadata: {"openclaw":{"emoji":"📰","os":["darwin","linux"],"requires":{"bins":["node"]},"skillKey":"web-crawl-for-toutiao"}}
---

# Web Crawl for Toutiao

当用户给出今日头条文章链接，并要求读取正文、提取摘要、结构化信息、时间、作者或标题时使用。

## 适用范围

- \`https://www.toutiao.com/article/<id>/...\`
- \`https://m.toutiao.com/article/<id>/...\`

## 工作方式

1. 使用脚本通过本机 Chrome Headless 打开页面并执行前端 JavaScript。
2. 从渲染后的 DOM 中提取 \`RENDER_DATA\`。
3. 解析文章标题、摘要、发布时间、作者、正文 HTML 与纯文本。
4. 输出时区分：
   - 页面原始字段
   - 结构化抽取结果
   - 你的归纳总结

## 运行方式

\`\`\`bash
node {baseDir}/scripts/fetch_toutiao_article.mjs "<url>" --json
\`\`\`

或输出纯文本：

\`\`\`bash
node {baseDir}/scripts/fetch_toutiao_article.mjs "<url>"
\`\`\`

## 输出要求

- 默认先给摘要，再给关键证据点。
- 抽取：
  - 标题
  - 摘要
  - 作者
  - 发布时间
  - 正文纯文本
- 若抓取失败，必须说明：
  - 是 Chrome 缺失
  - 页面渲染失败
  - 结构化数据缺失
  - 还是正文抽取失败

## 注意事项

- 当前实现依赖本机 Chrome/Chromium。
- 这是今日头条专用抓取器，不保证适用于其他站点。
- 如果用户给的不是头条文章链接，应明确说明不适用。
`;
}

export function buildWebCrawlForWechatArticalSkillMarkdown(): string {
  return `---
name: Web Crawl for WeChat Artical
slug: web-crawl-for-wechat-artical
tags: 微信公众号, 微信文章, 网页抓取, 文章提取, Chrome, Headless
description: 使用本机 Chrome Headless 执行微信公众号文章页面 JavaScript，抓取标题、作者、公众号名、发布时间、摘要与正文。
market: 通用
category: content
skill_type: 网页阅读
publisher: iClaw
metadata: {"openclaw":{"emoji":"📖","os":["darwin","linux"],"requires":{"bins":["node"]},"skillKey":"web-crawl-for-wechat-artical"}}
---

# Web Crawl for WeChat Artical

当用户给出微信公众号文章链接，并要求读取正文、提取摘要、结构化信息、时间、作者、公众号名或标题时使用。

## 适用范围

- \`https://mp.weixin.qq.com/s/...\`

## 工作方式

1. 使用脚本通过本机 Chrome Headless 打开页面并执行前端 JavaScript。
2. 从渲染后的 DOM 中提取：
   - 标题
   - 作者
   - 公众号名
   - 发布时间
   - \`#js_content\` 正文
3. 将正文 HTML 清洗为纯文本并输出摘要。
4. 输出时区分：
   - 页面原始字段
   - 结构化抽取结果
   - 你的归纳总结

## 运行方式

\`\`\`bash
node {baseDir}/scripts/fetch_wechat_article.mjs "<url>" --json
\`\`\`

或输出纯文本：

\`\`\`bash
node {baseDir}/scripts/fetch_wechat_article.mjs "<url>"
\`\`\`

## 输出要求

- 默认先给摘要，再给关键证据点。
- 抽取：
  - 标题
  - 作者
  - 公众号名
  - 发布时间
  - 正文纯文本
- 若抓取失败，必须说明：
  - 是 Chrome 缺失
  - 页面渲染失败
  - DOM 中找不到 \`#js_content\`
  - 还是正文抽取失败

## 注意事项

- 当前实现依赖本机 Chrome/Chromium。
- 仅用于微信公众号文章页，不保证适用于小程序页或其他微信域名页面。
- 有些公众号文章在更强风控/登录态场景下可能需要浏览器 Cookie 才更稳定。
`;
}

export function getExternalCloudSkillSeed(slug: string) {
  return EXTERNAL_CLOUD_SKILL_SEEDS.find((item) => item.slug === slug) || null;
}
