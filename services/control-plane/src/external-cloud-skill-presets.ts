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
  originType: 'manual' | 'bundled' | 'clawhub' | 'github_repo';
  sourceUrl?: string;
  metadata: Record<string, unknown>;
};

export const XIAOHONGSHU_CLOUD_SKILL_SLUG = 'xiaohongshu-skills';
export const XIAOHONGSHU_CLOUD_SKILL_VERSION = '1.0.3';
export const XIAOHONGSHU_CLOUD_SKILL_ARTIFACT_FORMAT = 'zip' as const;

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

export const EXTERNAL_CLOUD_SKILL_SEEDS: ExternalCloudSkillSeed[] = [XIAOHONGSHU_CLOUD_SKILL_SEED];

export const XIAOHONGSHU_CLOUD_SKILL_REQUIRED_PATHS = ['scripts', 'skills'];

export const XIAOHONGSHU_CLOUD_SKILL_OPTIONAL_PATHS = ['requirements.txt'];

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

export function getExternalCloudSkillSeed(slug: string) {
  return EXTERNAL_CLOUD_SKILL_SEEDS.find((item) => item.slug === slug) || null;
}
