import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import type { IClawClient, ImBotCloudRecordData, ImBotConnectionPreflightResult } from '@iclaw/sdk';
import {
  Activity,
  AlertCircle,
  Bot,
  BotMessageSquare,
  Building2,
  ChevronRight,
  Clock3,
  Link2,
  MessageCircle,
  MessageSquare,
  Power,
  Radio,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { PlatformCardShell } from '@/app/components/ui/PlatformCardShell';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import {
  buildRuntimeConfigWithManagedImBots,
  restoreManagedImBotsFromRuntimeConfig,
  type ManagedImBotRuntimeRecord,
} from '@/app/lib/im-bots-runtime';
import { cn } from '@/app/lib/cn';
import { readAuth } from '@/app/lib/auth-storage';
import {
  bootstrapDesktopConfigStore,
  readDesktopConfigSection,
  writeDesktopConfigSection,
} from '@/app/lib/persistence/config-store';
import { startSidecarWithTimeout } from '@/app/lib/sidecar-start-timeout';
import { pushAppNotification } from '@/app/lib/task-notifications';
import { loadRuntimeConfig, saveRuntimeConfig } from '@/app/lib/tauri-runtime-config';
import { isTauriRuntime, startSidecar, stopSidecar } from '@/app/lib/tauri-sidecar';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import dingtalkLogo from '@/app/assets/im-bots/dingtalk.png';
import feishuLogo from '@/app/assets/im-bots/feishu.png';
import qqLogo from '@/app/assets/im-bots/qq.png';
import wechatMpLogo from '@/app/assets/im-bots/wechat-mp.svg';
import wecomLogo from '@/app/assets/im-bots/wecom.png';
import { IMBotSetupModal, type IMBotDraft, type IMPlatformId, type IMPlatformMeta } from './IMBotSetupModal';

type IMBotHealthState =
  | 'healthy'
  | 'needs_setup'
  | 'connectivity_issue'
  | 'permission_issue'
  | 'callback_issue'
  | 'paused';
type SideTab = 'todo' | 'health' | 'audit';
type BotAuditTone = 'success' | 'warning' | 'info';
type BindingScope = 'organization' | 'group' | 'private';

interface AssistantProfile {
  id: string;
  name: string;
  summary: string;
  scope: string;
  persona: string;
}

interface AuditEntry {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: BotAuditTone;
  createdAt: number;
}

interface ManagedBot {
  id: string;
  platformId: IMPlatformId;
  name: string;
  company: string;
  assistantId: string | null;
  assistant: string;
  healthState: IMBotHealthState;
  enabled: boolean;
  lastActive: string;
  lastTestAt: string | null;
  healthSummary: string;
  triggerMode: IMBotDraft['triggerMode'];
  replyFormat: IMBotDraft['replyFormat'];
  bindingScope: BindingScope;
  offlineReply: string;
  welcomeTemplate: string;
  unavailableTemplate: string;
  credentials: Record<string, string>;
  lastPreflightResult: ImBotConnectionPreflightResult | null;
  auditLogs: AuditEntry[];
}

type PlatformCardMeta = IMPlatformMeta & {
  capabilities: string[];
  pluginId: string;
  advantageLabel: string;
  rolloutNote: string;
};

const DEFAULT_PLATFORM_ID: IMPlatformId = 'dingtalk';
const IM_BOTS_CONFIG_SECTION = 'im-bots';
const IM_BOT_SIDECAR_ARGS = ((import.meta.env.VITE_SIDE_CAR_ARGS as string) || '--port 2126')
  .split(' ')
  .map((value) => value.trim())
  .filter(Boolean);
const IM_BOT_SIDECAR_RESTART_TIMEOUT_MS = 45_000;

const DETAIL_INPUT_CLASS =
  'min-h-[46px] w-full rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]';
const DETAIL_TEXTAREA_CLASS =
  'min-h-[108px] w-full rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-[14px] leading-7 text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]';

const assistantProfiles: AssistantProfile[] = [
  {
    id: 'knowledge',
    name: '企业知识助手',
    summary: '回答制度、流程、项目资料和内部知识库问题。',
    scope: '适合组织内员工私聊与群聊问答',
    persona: '稳健、正式、偏知识检索',
  },
  {
    id: 'ops',
    name: '运维通知助手',
    summary: '适合系统通知、异常播报和值班流转。',
    scope: '适合群聊、频道与通知推送',
    persona: '简短、明确、以结果为先',
  },
  {
    id: 'sales',
    name: '销售协同助手',
    summary: '适合客户跟进摘要、纪要整理和内部协同。',
    scope: '适合外部客户群与销售团队群',
    persona: '偏业务协同、强调行动项',
  },
  {
    id: 'service',
    name: '服务台助手',
    summary: '适合收集问题、给出初步答复并路由人工。',
    scope: '适合私聊入口与跨部门问答',
    persona: '友好、耐心、带分流意识',
  },
];

const bindingScopeOptions: Array<{ value: BindingScope; label: string; description: string; icon: ComponentType<{ className?: string }> }> = [
  {
    value: 'organization',
    label: '组织统一入口',
    description: '作为组织级机器人统一服务多个部门与群聊。',
    icon: Building2,
  },
  {
    value: 'group',
    label: '指定群聊 / 频道',
    description: '限制在固定群或频道内服务，更适合试点。',
    icon: Users,
  },
  {
    value: 'private',
    label: '私聊助手',
    description: '只在一对一私聊里响应，适合员工助手。',
    icon: MessageCircle,
  },
];

const platformMetaList: PlatformCardMeta[] = [
  {
    id: 'dingtalk',
    label: '钉钉',
    pluginId: 'dingtalk',
    advantageLabel: '企业办公主战场',
    rolloutNote: '已打包 Stream 模式插件，适合先做组织内试点。',
    logo: dingtalkLogo,
    intro: '适合组织内办公对话、通知流和群聊助手。',
    difficulty: '中',
    eta: '12 分钟',
    admin: '需要',
    guideUrl: 'https://open-dev.dingtalk.com/',
    capabilities: ['群聊', '通知', '组织内'],
    credentialFields: [
      { key: 'client_id', label: 'Client ID / AppKey', placeholder: '请输入钉钉 Client ID' },
      { key: 'client_secret', label: 'Client Secret / AppSecret', placeholder: '请输入钉钉 Client Secret' },
    ],
    introSteps: [
      '进入钉钉开放平台，创建企业内部应用。',
      '开通机器人相关权限，并完成企业管理员审批。',
      '确认 Stream 模式入口和事件订阅权限。',
      '回到 iClaw 完成凭据录入和连通测试。',
    ],
    testHints: [
      '钉钉更适合企业内部办公场景，建议先从小范围试点开始。',
      '如果后续要做多机器人，系统内部会继续映射为独立机器人实例。',
      '当前已内置中国版 DingTalk channel plugin，可直接进入配置阶段。',
    ],
  },
  {
    id: 'feishu-china',
    label: '飞书中国版',
    pluginId: 'feishu-china',
    advantageLabel: '长连接 + 文档生态',
    rolloutNote: '走中国版飞书渠道插件，适合企业内部群聊与文档协同。',
    logo: feishuLogo,
    logoClassName: 'scale-[1.55]',
    intro: '适合企业群聊、私聊与组织内 AI 助手。',
    difficulty: '中',
    eta: '10 分钟',
    admin: '需要',
    guideUrl: 'https://open.feishu.cn/app',
    capabilities: ['群聊', '私聊', '长连接'],
    credentialFields: [
      { key: 'app_id', label: 'App ID', placeholder: '请输入飞书 App ID' },
      { key: 'app_secret', label: 'App Secret', placeholder: '请输入飞书 App Secret' },
    ],
    introSteps: [
      '登录飞书开放平台，创建企业自建应用。',
      '开启机器人能力，并在权限管理中开通消息收发权限。',
      '默认使用长连接模式接入，不需要额外配置公网回调地址。',
      '回到 iClaw 继续完成凭据填写与测试。',
    ],
    testHints: [
      '飞书默认走 websocket / 长连接模式，不依赖 webhook 回调地址。',
      '飞书官方原生支持 iClaw，多账号场景可通过 accountId 建模。',
      '如企业使用国际版 Lark，后续可在高级配置里补充域名覆盖。',
    ],
  },
  {
    id: 'wecom',
    label: '企微机器人',
    pluginId: 'wecom',
    advantageLabel: '群机器人 / Bot 模式',
    rolloutNote: '适合快速把企业微信群通知、播报和问答先跑起来。',
    logo: wecomLogo,
    intro: '适合企微群机器人、组织内消息触达与轻量工作流。',
    difficulty: '中',
    eta: '10 分钟',
    admin: '管理员',
    guideUrl: 'https://developer.work.weixin.qq.com/',
    capabilities: ['群聊', 'Bot 模式', '工作流'],
    credentialFields: [
      { key: 'bot_id', label: 'Bot ID', placeholder: '请输入企微 Bot ID' },
      { key: 'secret', label: 'Secret', placeholder: '请输入应用 Secret' },
    ],
    introSteps: [
      '在企微开放平台创建机器人或 AI Bot。',
      '记录 Bot ID 与 Secret，并确认组织侧已开通消息能力。',
      '如需 webhook 模式，再补充 Token 与 AESKey 等高级参数。',
      '回到 iClaw 完成凭据录入并做一次连通测试。',
    ],
    testHints: [
      '企微机器人更适合快速试点，先跑通群内通知和问答。',
      '如果后续需要更复杂的组织回调，再升级到自建应用模式。',
      '当前已内置中国版企微机器人插件，可直接打包交付。',
    ],
  },
  {
    id: 'wecom-app',
    label: '企微自建应用',
    pluginId: 'wecom-app',
    advantageLabel: '企业应用 / 回调',
    rolloutNote: '覆盖组织内员工助手、自建应用和 API 回调场景。',
    logo: wecomLogo,
    intro: '适合组织内员工助手、企业消息与内部工作流。',
    difficulty: '高',
    eta: '15 分钟',
    admin: '企业管理员',
    guideUrl: 'https://developer.work.weixin.qq.com/',
    capabilities: ['组织内', '工作流', '回调'],
    credentialFields: [
      {
        key: 'corp_id',
        label: '企业 Corp ID（管理员填写）',
        placeholder: '请让企业管理员填写 Corp ID',
        helpText: 'Corp ID 通常只有企业管理员能在企微后台查看；普通员工一般无法获取。',
      },
      { key: 'agent_id', label: 'Agent ID', placeholder: '请输入应用 ID' },
      { key: 'secret', label: 'Secret', placeholder: '请输入应用 Secret' },
      { key: 'token', label: '回调 Token', placeholder: '请输入回调 Token' },
      { key: 'encoding_aes_key', label: 'EncodingAESKey', placeholder: '请输入 43 位消息加密密钥' },
      { key: 'callback_url', label: '回调地址', placeholder: '', readOnly: true },
    ],
    introSteps: [
      '由企业管理员在企业微信管理后台创建自建应用。',
      '由企业管理员记录 Corp ID、Agent ID 和应用 Secret。',
      '在回调设置里配置 URL、Token 和 EncodingAESKey。',
      '回到 iClaw 完成凭据录入并做一次回调连通测试。',
    ],
    testHints: [
      '企微接入默认按管理员流程设计，普通员工通常拿不到 Corp ID。',
      '企微对回调配置更敏感，建议先确保 URL 可访问。',
      '正式上线前，可以先在单个部门或应用内试运行。',
    ],
  },
  {
    id: 'wecom-kf',
    label: '企微客服',
    pluginId: 'wecom-kf',
    advantageLabel: '客服会话入口',
    rolloutNote: '适合把外部客户咨询导入 iClaw，会话体验更贴近客服中心。',
    logo: wecomLogo,
    intro: '适合企业微信客服、外部客户接待与问题分流。',
    difficulty: '高',
    eta: '18 分钟',
    admin: '企业管理员',
    guideUrl: 'https://developer.work.weixin.qq.com/',
    capabilities: ['客服', '外部会话', '回调'],
    credentialFields: [
      { key: 'corp_id', label: '企业 Corp ID', placeholder: '请输入企业 Corp ID' },
      { key: 'secret', label: 'Secret', placeholder: '请输入客服应用 Secret' },
      { key: 'open_kf_id', label: 'Open KF ID', placeholder: '请输入客服账号 ID' },
      { key: 'token', label: '回调 Token', placeholder: '请输入回调 Token' },
      { key: 'encoding_aes_key', label: 'EncodingAESKey', placeholder: '请输入 43 位消息加密密钥' },
      { key: 'callback_url', label: '回调地址', placeholder: '', readOnly: true },
    ],
    introSteps: [
      '在企微管理后台开通客服能力，并创建客服账号。',
      '记录 Corp ID、Secret 和 OpenKF ID。',
      '配置客服回调地址并做一次事件验证。',
      '回到 iClaw 完成配置，后续可继续绑定客服专属助手。',
    ],
    testHints: [
      '企微客服更适合对外服务，不建议和组织内员工助手混用。',
      '上线前请先验证回调白名单和客服账号可用性。',
      '这条渠道适合形成“企业内外统一 AI 服务”的差异化能力。',
    ],
  },
  {
    id: 'qqbot',
    label: 'QQ Bot',
    pluginId: 'qqbot',
    advantageLabel: '年轻用户 / 社群',
    rolloutNote: '适合 QQ 群、频道和社群陪伴型助手，是国内增量流量入口。',
    logo: qqLogo,
    intro: '适合 QQ 群、频道和轻量办公协作入口。',
    difficulty: '高',
    eta: '15 分钟',
    admin: '部分需要',
    guideUrl: 'https://q.qq.com/bot/',
    capabilities: ['群聊', '频道', '轻量协作'],
    credentialFields: [
      { key: 'app_id', label: 'App ID', placeholder: '请输入 QQ Bot App ID' },
      { key: 'app_secret', label: 'App Secret', placeholder: '请输入 QQ Bot App Secret' },
    ],
    introSteps: [
      '进入 QQ 开放平台，创建机器人应用。',
      '完成机器人资料、能力和测试环境配置。',
      '确认网关接入信息与事件订阅能力。',
      '回到 iClaw 继续完成连接配置。',
    ],
    testHints: [
      'QQ 更适合增量试点，建议先验证企业内部使用稳定性。',
      '如果后续接入频道和群聊，系统会继续按机器人实例统一管理。',
      'QQ 渠道插件已通过当前 iClaw 运行时版本验证，可纳入默认打包能力。',
    ],
  },
  {
    id: 'wechat-mp',
    label: '微信公众号',
    pluginId: 'wechat-mp',
    advantageLabel: '私域触达 / 订阅',
    rolloutNote: '适合公众号消息、菜单交互和私域内容服务，是品牌面向外部用户的强入口。',
    logo: wechatMpLogo,
    intro: '适合微信公众号问答、菜单交互与私域内容服务。',
    difficulty: '高',
    eta: '18 分钟',
    admin: '公众号管理员',
    guideUrl: 'https://mp.weixin.qq.com/',
    capabilities: ['私聊', '菜单', '订阅触达'],
    credentialFields: [
      { key: 'app_id', label: 'App ID', placeholder: '请输入公众号 App ID' },
      { key: 'app_secret', label: 'App Secret', placeholder: '请输入公众号 App Secret' },
      { key: 'token', label: '回调 Token', placeholder: '请输入服务器配置 Token' },
      { key: 'encoding_aes_key', label: 'EncodingAESKey', placeholder: '请输入 43 位消息加密密钥' },
      { key: 'callback_url', label: '回调地址', placeholder: '', readOnly: true },
    ],
    introSteps: [
      '登录微信公众平台，创建或选择服务号 / 订阅号应用。',
      '开启开发者模式，记录 App ID 与 App Secret。',
      '配置服务器地址、Token 和消息校验参数。',
      '回到 iClaw 完成接入配置并验证回调。',
    ],
    testHints: [
      '微信公众号适合做品牌对外 AI 服务和内容陪伴式触达。',
      '正式上线前请确认消息频控与菜单交互体验。',
      '这条渠道和 QQ/企微一起，能明显拉开国内渠道覆盖差距。',
    ],
  },
  {
    id: 'openclaw-weixin',
    label: '微信',
    pluginId: 'openclaw-weixin',
    advantageLabel: '官方插件 / 二维码登录',
    rolloutNote: '腾讯官方微信插件，适合个人微信入口与轻量私聊触达。',
    logo: wechatMpLogo,
    intro: '适合个人微信私聊入口，走官方插件与二维码登录流程。',
    difficulty: '简单',
    eta: '5 分钟',
    admin: '不需要',
    guideUrl: 'https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin',
    capabilities: ['私聊', '扫码登录', '轻量接入'],
    credentialFields: [],
    introSteps: [
      '确认当前 iClaw 运行时使用的是微信官方插件兼容线。',
      '安装后通过 `openclaw channels login --channel openclaw-weixin` 拉起二维码登录。',
      '使用手机微信扫码并确认授权，登录凭据会保存在本地。',
      '回到 iClaw 继续完成默认助手绑定和对话测试。',
    ],
    testHints: [
      '这条能力是个人微信入口，不等同于公众号或企业微信。',
      '当前对 iClaw 运行时 2026.3.13 需要锁定官方插件 legacy 版本线。',
      '更适合做高频私聊陪伴，而不是组织内群协作。',
    ],
  },
];

const initialBots: ManagedBot[] = [];

function toManagedImBotRuntimeRecord(bot: ManagedBot): ManagedImBotRuntimeRecord | null {
  return {
    platformId: bot.platformId,
    enabled: bot.enabled,
    name: bot.name,
    bindingScope: bot.bindingScope,
    triggerMode: bot.triggerMode,
    replyFormat: bot.replyFormat,
    credentials: bot.credentials,
  };
}

function createManagedBotFromRuntimeRecord(record: ManagedImBotRuntimeRecord): ManagedBot {
  const platformLabel =
    platformMetaList.find((item) => item.id === record.platformId)?.label || 'IM';
  const preflightResult: ImBotConnectionPreflightResult = {
    ok: true,
    supported: true,
    message: '已从本地 runtime 恢复机器人配置，建议重新做一次真实连接验证。',
    checks: [
      {
        id: 'runtime_restore',
        label: '读取本地 runtime 配置',
        status: 'warning',
        detail: '当前状态来自本地已保存配置，不代表最新平台联通性已重新验证。',
      },
    ],
  };
  const healthState = resolveBotHealthState(record.enabled, null, preflightResult);

  return {
    id: `${record.platformId}-bot`,
    platformId: record.platformId,
    name: record.name || `${platformLabel}办公助手`,
    company: '待完善',
    assistantId: null,
    assistant: '未绑定默认助手',
    healthState,
    enabled: record.enabled,
    lastActive: '已恢复',
    lastTestAt: null,
    healthSummary: resolveBotHealthSummary(healthState, preflightResult, null),
    triggerMode: record.triggerMode,
    replyFormat: record.replyFormat,
    bindingScope: record.bindingScope,
    offlineReply: '我现在暂时离线，稍后会继续处理你的消息。',
    welcomeTemplate: '你好，我是{{assistant}}，可以直接把问题发给我。',
    unavailableTemplate: '我暂时无法完成这次请求，已记录到日志，请稍后重试。',
    credentials: record.credentials,
    lastPreflightResult: preflightResult,
    auditLogs: [createAuditEntry('info', '已恢复本地配置', '本地 runtime 中已存在该渠道机器人配置。')],
  };
}

async function waitForImBotRuntimeHealth(client: IClawClient, timeoutMs = IM_BOT_SIDECAR_RESTART_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await client.health();
      return true;
    } catch {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 500);
      });
    }
  }
  return false;
}

function isAuditEntryRecord(value: unknown): value is AuditEntry {
  return Boolean(value) && typeof value === 'object';
}

function isManagedBotRecord(value: unknown): value is ManagedBot {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.platformId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.assistant === 'string' &&
    typeof record.healthState === 'string' &&
    typeof record.enabled === 'boolean' &&
    typeof record.healthSummary === 'string' &&
    typeof record.triggerMode === 'string' &&
    typeof record.replyFormat === 'string' &&
    typeof record.bindingScope === 'string' &&
    Boolean(record.credentials) &&
    typeof record.credentials === 'object' &&
    Array.isArray(record.auditLogs) &&
    record.auditLogs.every((entry) => isAuditEntryRecord(entry))
  );
}

function normalizePersistedBots(value: unknown): ManagedBot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ManagedBot => isManagedBotRecord(item));
}

async function loadPersistedManagedBots(): Promise<ManagedBot[]> {
  await bootstrapDesktopConfigStore();
  return normalizePersistedBots(readDesktopConfigSection(IM_BOTS_CONFIG_SECTION));
}

async function persistManagedBots(nextBots: ManagedBot[]): Promise<void> {
  await bootstrapDesktopConfigStore();
  await writeDesktopConfigSection(IM_BOTS_CONFIG_SECTION, nextBots);
}

function listConfiguredSecretKeys(credentials: Record<string, string>): string[] {
  return Object.entries(credentials)
    .filter(([, value]) => String(value || '').trim().length > 0)
    .map(([key]) => key)
    .sort();
}

function toImBotCloudRecordInput(bot: ManagedBot, token: string) {
  return {
    token,
    botId: bot.id,
    platformId: bot.platformId,
    name: bot.name,
    company: bot.company,
    assistantId: bot.assistantId,
    assistant: bot.assistant,
    enabled: bot.enabled,
    triggerMode: bot.triggerMode,
    replyFormat: bot.replyFormat,
    bindingScope: bot.bindingScope,
    offlineReply: bot.offlineReply,
    welcomeTemplate: bot.welcomeTemplate,
    unavailableTemplate: bot.unavailableTemplate,
    configuredSecretKeys: listConfiguredSecretKeys(bot.credentials),
    secretValues: bot.credentials,
  } as const;
}

function createManagedBotFromCloudRecord(
  record: ImBotCloudRecordData,
  localBot: ManagedBot | null,
): ManagedBot {
  const healthState = resolveBotHealthState(record.enabled, record.assistant_id, localBot?.lastPreflightResult ?? null);
  return {
    id: record.bot_id,
    platformId: record.platform_id,
    name: record.name || localBot?.name || `${platformMetaList.find((item) => item.id === record.platform_id)?.label || 'IM'}办公助手`,
    company: record.company || localBot?.company || '待完善',
    assistantId: record.assistant_id,
    assistant: record.assistant || localBot?.assistant || '未绑定默认助手',
    healthState,
    enabled: record.enabled,
    lastActive: localBot?.lastActive || '已同步',
    lastTestAt: localBot?.lastTestAt ?? null,
    healthSummary: localBot?.lastPreflightResult
      ? resolveBotHealthSummary(healthState, localBot.lastPreflightResult, record.assistant_id)
      : record.configured_secret_keys.length > 0
        ? '云端记录已同步，本机可继续完成真实连接验证。'
        : '云端记录已同步，但本机尚未配置该平台凭据。',
    triggerMode: record.trigger_mode,
    replyFormat: record.reply_format,
    bindingScope: record.binding_scope,
    offlineReply: record.offline_reply,
    welcomeTemplate: record.welcome_template,
    unavailableTemplate: record.unavailable_template,
    credentials: localBot?.credentials || {},
    lastPreflightResult: localBot?.lastPreflightResult ?? null,
    auditLogs:
      localBot?.auditLogs.length
        ? localBot.auditLogs
        : [createAuditEntry('info', '已同步云端记录', '机器人主记录已从控制平面恢复。')],
  };
}

function mergeManagedBots(localBots: ManagedBot[], cloudRecords: ImBotCloudRecordData[]): ManagedBot[] {
  const localById = new Map(localBots.map((bot) => [bot.id, bot]));
  const merged: ManagedBot[] = cloudRecords.map((record) =>
    createManagedBotFromCloudRecord(record, localById.get(record.bot_id) ?? null),
  );
  const seen = new Set(merged.map((bot) => bot.id));
  for (const localBot of localBots) {
    if (!seen.has(localBot.id)) {
      merged.push(localBot);
    }
  }
  return merged;
}

async function syncManagedBotsToCloud(client: IClawClient, token: string | null, bots: ManagedBot[]): Promise<void> {
  if (!token) {
    return;
  }
  await Promise.all(
    bots.map((bot) => client.upsertImBotCloudRecord(toImBotCloudRecordInput(bot, token))),
  );
}

async function hydrateCloudBotSecrets(client: IClawClient, token: string, bots: ManagedBot[]): Promise<ManagedBot[]> {
  const secrets = await Promise.all(
    bots.map(async (bot) => ({
      botId: bot.id,
      payload: await client.getImBotCloudSecretConfig(token, bot.id),
    })),
  );
  const secretMap = new Map(secrets.map((item) => [item.botId, item.payload]));
  return bots.map((bot) => {
    const payload = secretMap.get(bot.id);
    if (!payload?.secret_values || Object.keys(payload.secret_values).length === 0) {
      return bot;
    }
    return {
      ...bot,
      credentials: {
        ...payload.secret_values,
      },
    };
  });
}

async function syncManagedBotsToRuntimeConfig(bots: ManagedBot[]): Promise<boolean> {
  const currentConfig = await loadRuntimeConfig();
  const runtimeBots = bots
    .map((bot) => toManagedImBotRuntimeRecord(bot))
    .filter((bot): bot is ManagedImBotRuntimeRecord => Boolean(bot));
  const nextConfig = buildRuntimeConfigWithManagedImBots(currentConfig, runtimeBots);
  if (JSON.stringify(currentConfig || {}) === JSON.stringify(nextConfig)) {
    return false;
  }
  await saveRuntimeConfig(nextConfig);
  return true;
}

async function restartImBotRuntime(client: IClawClient): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  await stopSidecar();
  await startSidecarWithTimeout(
    startSidecar,
    IM_BOT_SIDECAR_ARGS,
    IM_BOT_SIDECAR_RESTART_TIMEOUT_MS,
    `本地服务启动超时：启动命令在 ${Math.max(1, Math.round(IM_BOT_SIDECAR_RESTART_TIMEOUT_MS / 1000))}s 内未返回。`,
  );
  return waitForImBotRuntimeHealth(client);
}

export function IMBotsView({
  title,
  client,
}: {
  title: string;
  client: IClawClient;
}) {
  const [bots, setBots] = useState<ManagedBot[]>(initialBots);
  const [activeSideTab, setActiveSideTab] = useState<SideTab>('todo');
  const [selectedPlatformId, setSelectedPlatformId] = useState<IMPlatformId | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [testingBotId, setTestingBotId] = useState<string | null>(null);

  const selectedPlatform = useMemo(
    () => platformMetaList.find((item) => item.id === selectedPlatformId) ?? null,
    [selectedPlatformId],
  );

  const selectedBot = useMemo(
    () => bots.find((item) => item.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        let nextBots = await loadPersistedManagedBots();

        if (nextBots.length === 0 && isTauriRuntime()) {
          const runtimeConfig = await loadRuntimeConfig();
          nextBots = restoreManagedImBotsFromRuntimeConfig(runtimeConfig).map((record) =>
            createManagedBotFromRuntimeRecord(record),
          );
          if (nextBots.length > 0) {
            await persistManagedBots(nextBots);
          }
        }

        const token = await resolveAccessToken();
        if (token) {
          const cloudRecords = await client.listImBotCloudRecords(token);
          if (cloudRecords.length > 0) {
            nextBots = mergeManagedBots(nextBots, cloudRecords);
            nextBots = await hydrateCloudBotSecrets(client, token, nextBots);
            await persistManagedBots(nextBots);
          } else if (nextBots.length > 0) {
            await syncManagedBotsToCloud(client, token, nextBots);
          }
        }

        if (isTauriRuntime() && nextBots.length > 0) {
          const changed = await syncManagedBotsToRuntimeConfig(nextBots);
          if (changed) {
            await restartImBotRuntime(client);
          }
        }

        if (!cancelled && nextBots.length > 0) {
          setBots((current) => (current.length > 0 ? current : nextBots));
        }
      } catch (error) {
        console.warn('[desktop] failed to restore IM bot runtime config', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const configuredPlatforms = useMemo(
    () => new Set(bots.map((item) => item.platformId)),
    [bots],
  );

  const runningCount = useMemo(
    () => bots.filter((item) => item.enabled && item.healthState === 'healthy').length,
    [bots],
  );

  const actionRequiredCount = useMemo(
    () =>
      bots.filter((item) =>
        ['needs_setup', 'connectivity_issue', 'permission_issue', 'callback_issue'].includes(item.healthState),
      ).length,
    [bots],
  );

  const summaryCards = useMemo<Array<{
    label: string;
    value: string;
    note: string;
    icon: ComponentType<{ className?: string }>;
    tone: 'brand' | 'success' | 'warning' | 'neutral';
  }>>(
    () => [
      {
        label: '已创建机器人',
        value: String(bots.length),
        note: bots.length > 0 ? '总机器人数量' : '当前还没有机器人',
        icon: Bot,
        tone: 'brand',
      },
      {
        label: '当前运行中',
        value: String(runningCount),
        note: runningCount > 0 ? '正常响应服务' : '暂无运行中机器人',
        icon: Power,
        tone: runningCount > 0 ? 'success' : 'neutral',
      },
      {
        label: '已接入平台',
        value: String(configuredPlatforms.size),
        note:
          configuredPlatforms.size > 0
            ? Array.from(configuredPlatforms)
                .map((id) => platformMetaList.find((item) => item.id === id)?.label)
                .filter(Boolean)
                .join('、')
            : '暂无已接入平台',
        icon: Link2,
        tone: configuredPlatforms.size > 0 ? 'success' : 'neutral',
      },
      {
        label: '待处理项',
        value: String(actionRequiredCount),
        note: actionRequiredCount > 0 ? '需要您关注' : '当前无需处理',
        icon: AlertCircle,
        tone: actionRequiredCount > 0 ? 'warning' : 'neutral',
      },
    ],
    [actionRequiredCount, bots.length, configuredPlatforms.size, runningCount],
  );

  const todoItems = useMemo(
    () =>
      bots
        .filter((bot) => bot.healthState !== 'healthy' && bot.healthState !== 'paused')
        .map((bot) => ({
          botId: bot.id,
          botName: bot.name,
          label: getHealthMeta(bot.healthState).label,
          detail: getHealthMeta(bot.healthState).description,
        })),
    [bots],
  );

  const healthItems = useMemo(
    () =>
      bots.map((bot) => ({
        botId: bot.id,
        botName: bot.name,
        detail: bot.healthSummary,
        tone: getHealthMeta(bot.healthState).panelTone,
      })),
    [bots],
  );

  const auditItems = useMemo(
    () =>
      bots
        .flatMap((bot) =>
          bot.auditLogs.map((log) => ({
            ...log,
            botId: bot.id,
            botName: bot.name,
          })),
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8),
    [bots],
  );

  const resolveAccessToken = async (): Promise<string | null> => {
    const storedAuth = await readAuth();
    return storedAuth?.accessToken?.trim() || null;
  };

  const validateConnection = async (
    platformId: IMPlatformId,
    credentials: Record<string, string>,
  ): Promise<ImBotConnectionPreflightResult> => {
    const token = await resolveAccessToken();
    if (!token) {
      throw new Error('当前未获取到登录态，无法发起真实平台连接测试。');
    }
    return client.preflightImBotConnection({
      token,
      platformId,
      credentials,
      callbackUrl: credentials.callback_url || undefined,
    });
  };

  const applyRuntimeConfigChanges = async (nextBots: ManagedBot[]) => {
    try {
      await persistManagedBots(nextBots);
      await syncManagedBotsToCloud(client, await resolveAccessToken(), nextBots);
      const changed = await syncManagedBotsToRuntimeConfig(nextBots);
      if (!changed || !isTauriRuntime()) {
        return;
      }
      const healthy = await restartImBotRuntime(client);
      pushAppNotification({
        tone: healthy ? 'success' : 'info',
        source: 'system',
        title: healthy ? '机器人配置已生效' : '机器人配置已保存',
        text: healthy
          ? '本地服务已刷新，IM 渠道配置已写入 runtime。'
          : '本地服务尚未恢复健康，IM 渠道配置已写入，下次重启后仍会生效。',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '写入机器人 runtime 配置失败';
      pushAppNotification({
        tone: 'error',
        source: 'system',
        title: '机器人配置未完全生效',
        text: message,
      });
    }
  };

  const applyManagedBotMetadataChanges = async (nextBots: ManagedBot[]) => {
    try {
      await persistManagedBots(nextBots);
      await syncManagedBotsToCloud(client, await resolveAccessToken(), nextBots);
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步机器人云端记录失败';
      pushAppNotification({
        tone: 'error',
        source: 'system',
        title: '机器人记录未完全保存',
        text: message,
      });
    }
  };

  const handleCompleteSetup = (draft: IMBotDraft) => {
    const meta = platformMetaList.find((item) => item.id === draft.platformId);
    if (!meta) return;

    const nextId = `${draft.platformId}-bot`;
    const existing = bots.find((item) => item.id === nextId);
    const nextBots = existing
      ? bots.map((item) => {
          if (item.id !== nextId) return item;
          const nextHealthState = resolveBotHealthState(true, existing.assistantId, draft.preflightResult);
          return {
            ...item,
            enabled: true,
            healthState: nextHealthState,
            lastActive: '刚刚',
            lastTestAt: '刚刚',
            healthSummary: resolveBotHealthSummary(nextHealthState, draft.preflightResult, existing.assistantId),
            triggerMode: draft.triggerMode,
            replyFormat: draft.replyFormat,
            credentials: draft.credentials,
            lastPreflightResult: draft.preflightResult,
            auditLogs: [
              createAuditEntry(
                draft.preflightResult?.ok ? 'success' : 'warning',
                '平台接入已更新',
                draft.preflightResult?.message || `${meta.label} 的连接配置已重新保存。`,
              ),
              ...item.auditLogs,
            ],
          };
        })
      : [
          ...bots,
          (() => {
            const nextHealthState = resolveBotHealthState(true, null, draft.preflightResult);
            return {
              id: nextId,
              platformId: draft.platformId,
              name: `${meta.label}办公助手`,
              company: '待完善',
              assistantId: null,
              assistant: '未绑定默认助手',
              healthState: nextHealthState,
              enabled: true,
              lastActive: '刚刚',
              lastTestAt: '刚刚',
              healthSummary: resolveBotHealthSummary(nextHealthState, draft.preflightResult, null),
              triggerMode: draft.triggerMode,
              replyFormat: draft.replyFormat,
              bindingScope: 'organization' as const,
              offlineReply: '我现在暂时离线，稍后会继续处理你的消息。',
              welcomeTemplate: '你好，我是{{assistant}}，可以直接把问题发给我。',
              unavailableTemplate: '我暂时无法完成这次请求，已记录到日志，请稍后重试。',
              credentials: draft.credentials,
              lastPreflightResult: draft.preflightResult,
              auditLogs: [
                createAuditEntry('warning', '待完成默认助手绑定', '接入成功后，建议先绑定默认助手，再进行一次真实重测。'),
                createAuditEntry(
                  draft.preflightResult?.ok ? 'success' : 'warning',
                  '平台接入完成',
                  draft.preflightResult?.message || `${meta.label} 连接配置已建立。`,
                ),
              ],
            };
          })(),
        ];

    setBots(nextBots);
    setSelectedBotId(nextId);
    void applyRuntimeConfigChanges(nextBots);
  };

  const handleUpdateBot = (
    botId: string,
    updates: Pick<ManagedBot, 'name' | 'company' | 'assistantId' | 'assistant' | 'bindingScope' | 'offlineReply'>,
  ) => {
    const nextBots = bots.map((bot) => {
      if (bot.id !== botId) return bot;
      const nextHealthState = resolveBotHealthState(bot.enabled, updates.assistantId, bot.lastPreflightResult);
      return {
        ...bot,
        ...updates,
        healthState: nextHealthState,
        healthSummary: resolveBotHealthSummary(nextHealthState, bot.lastPreflightResult, updates.assistantId),
        lastActive: '刚刚',
        auditLogs: [
          createAuditEntry(
            'info',
            '机器人配置已更新',
            updates.assistantId
              ? `已绑定默认助手“${updates.assistant}”，并更新了基础信息。`
              : '已更新机器人信息，但默认助手仍未绑定。',
          ),
          ...bot.auditLogs,
        ],
      };
    });
    setBots(nextBots);
    void applyRuntimeConfigChanges(nextBots);
  };

  const handleUpdateBotTemplates = (
    botId: string,
    updates: Pick<ManagedBot, 'welcomeTemplate' | 'unavailableTemplate'>,
  ) => {
    const nextBots = bots.map((bot) =>
      bot.id === botId
        ? {
            ...bot,
            ...updates,
            auditLogs: [
              createAuditEntry('info', '消息模板已更新', '欢迎语和异常提示模板已保存，后续可作为机器人默认回复语义。'),
              ...bot.auditLogs,
            ],
          }
        : bot,
    );
    setBots(nextBots);
    void applyManagedBotMetadataChanges(nextBots);
  };

  const handleToggleBot = (botId: string) => {
    const nextBots = bots.map((bot) => {
      if (bot.id !== botId) return bot;
      const nextEnabled = !bot.enabled;
      const nextHealthState = resolveBotHealthState(nextEnabled, bot.assistantId, bot.lastPreflightResult);
      return {
        ...bot,
        enabled: nextEnabled,
        healthState: nextHealthState,
        healthSummary: resolveBotHealthSummary(nextHealthState, bot.lastPreflightResult, bot.assistantId),
        lastActive: '刚刚',
        auditLogs: [
          createAuditEntry(
            nextEnabled ? 'success' : 'info',
            nextEnabled ? '机器人已启用' : '机器人已停用',
            nextEnabled ? '该机器人已重新开始接收新消息。' : '该机器人已暂停，后续不会再向 IM 回复消息。',
          ),
          ...bot.auditLogs,
        ],
      };
    });
    setBots(nextBots);
    void applyRuntimeConfigChanges(nextBots);
  };

  const handleRunConnectionTest = async (botId: string) => {
    const targetBot = bots.find((bot) => bot.id === botId) ?? null;
    if (!targetBot) return;
    if (!isRealPreflightSupported(targetBot.platformId)) {
      pushAppNotification({
        tone: 'error',
        source: 'system',
        title: '当前平台暂不支持真实测试',
        text: '这个平台还没有接上官方预检链路，当前不开放重测。',
      });
      return;
    }

    setTestingBotId(botId);
    setBots((prev) =>
      prev.map((bot) =>
        bot.id === botId
          ? {
              ...bot,
              auditLogs: [
                createAuditEntry('info', '开始实链路验证', '已触发一次真实平台预检，正在校验官方接口返回。'),
                ...bot.auditLogs,
              ],
            }
          : bot,
      ),
    );
    pushAppNotification({
      tone: 'info',
      source: 'system',
      title: '已开始真实连接测试',
      text: `正在校验「${targetBot.name}」的平台应用凭据。`,
    });

    try {
      const result = await validateConnection(targetBot.platformId, targetBot.credentials);
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          const nextHealthState = resolveBotHealthState(bot.enabled, bot.assistantId, result);
          return {
            ...bot,
            healthState: nextHealthState,
            lastTestAt: '刚刚',
            lastActive: '刚刚',
            lastPreflightResult: result,
            healthSummary: resolveBotHealthSummary(nextHealthState, result, bot.assistantId),
            auditLogs: [
              createAuditEntry(
                result.ok ? 'success' : 'warning',
                result.ok ? '实链路验证通过' : '实链路验证失败',
                result.message,
              ),
              ...bot.auditLogs,
            ],
          };
        }),
      );
      pushAppNotification({
        tone: result.ok ? 'success' : 'error',
        source: 'system',
        title: result.ok ? '真实连接测试通过' : '真实连接测试未通过',
        text: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '真实平台预检请求失败';
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId
            ? {
                ...bot,
                healthState: 'connectivity_issue',
                lastActive: '刚刚',
                healthSummary: '真实平台预检请求失败，当前无法确认外部 IM 平台链路状态。',
                auditLogs: [
                  createAuditEntry('warning', '实链路验证失败', message),
                  ...bot.auditLogs,
                ],
              }
            : bot,
        ),
      );
      pushAppNotification({
        tone: 'error',
        source: 'system',
        title: '真实连接测试失败',
        text: targetBot ? `「${targetBot.name}」测试失败：${message}` : message,
      });
    } finally {
      setTestingBotId((current) => (current === botId ? null : current));
    }
  };

  return (
    <PageSurface as="div" className="bg-[var(--bg-page)]">
      <PageContent className="py-5">
        <PageHeader
          className="mb-4 gap-2.5"
          title={title}
          description="将 iClaw 接入企业常用办公 IM，并统一管理机器人状态。这个视图区现在不只是接入入口，也包含机器人详情、测试与默认助手绑定。"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em]"
          descriptionClassName="mt-0 text-[12px] leading-5"
          actionsClassName="gap-2"
          actions={
            <>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<AlertCircle className="h-4 w-4" />}
              disabled={todoItems.length === 0}
              className="px-3.5 py-1.5 text-[12px]"
              onClick={() => {
                if (todoItems[0]) {
                  setSelectedBotId(todoItems[0].botId);
                }
              }}
            >
              查看待处理
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Link2 className="h-4 w-4" />}
              className="px-3.5 py-1.5 text-[12px]"
              onClick={() => setSelectedPlatformId(DEFAULT_PLATFORM_ID)}
            >
              新建机器人
            </Button>
            </>
          }
        />

        <SummaryBar cards={summaryCards} />

        {bots.length > 0 ? (
          <div className="mb-6 mt-4 grid grid-cols-[minmax(0,1fr)_308px] gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">已创建机器人</div>
                <span className="text-[13px] text-[var(--text-secondary)]">{bots.length} 个</span>
              </div>
              {bots.map((bot) => {
                const meta = platformMetaList.find((item) => item.id === bot.platformId)!;
                return (
                  <ManagedBotCard
                    key={bot.id}
                    bot={bot}
                    meta={meta}
                    onOpenDetails={() => setSelectedBotId(bot.id)}
                    onToggleEnabled={() => handleToggleBot(bot.id)}
                    onRunConnectionTest={() => {
                      void handleRunConnectionTest(bot.id);
                    }}
                    isTesting={testingBotId === bot.id}
                  />
                );
              })}
            </div>

            <ActivityPanel
              activeTab={activeSideTab}
              onTabChange={setActiveSideTab}
              todoItems={todoItems}
              healthItems={healthItems}
              auditItems={auditItems}
              onOpenBot={(botId) => setSelectedBotId(botId)}
            />
          </div>
        ) : null}

        <div className="mt-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">平台接入</div>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                选择您企业使用的 IM 平台，快速创建并配置机器人
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {platformMetaList.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                configured={configuredPlatforms.has(platform.id)}
                onClick={() => setSelectedPlatformId(platform.id)}
              />
            ))}
          </div>
        </div>
      </PageContent>

      <IMBotSetupModal
        platform={selectedPlatform}
        open={Boolean(selectedPlatform)}
        onClose={() => setSelectedPlatformId(null)}
        onValidateConnection={validateConnection}
        onComplete={handleCompleteSetup}
      />

      <IMBotDetailSheet
        open={Boolean(selectedBot)}
        bot={selectedBot}
        platform={selectedBot ? platformMetaList.find((item) => item.id === selectedBot.platformId) ?? null : null}
        assistantOptions={assistantProfiles}
        onClose={() => setSelectedBotId(null)}
        onSave={handleUpdateBot}
        onSaveTemplates={handleUpdateBotTemplates}
        onToggleEnabled={handleToggleBot}
        onRunConnectionTest={handleRunConnectionTest}
        isTesting={selectedBot ? testingBotId === selectedBot.id : false}
      />
    </PageSurface>
  );
}

function SummaryBar({
  cards,
}: {
  cards: Array<{
    label: string;
    value: string;
    note: string;
    icon: ComponentType<{ className?: string }>;
    tone: 'brand' | 'success' | 'warning' | 'neutral';
  }>;
}) {
  return (
    <PressableCard className="overflow-hidden rounded-[18px] border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-2 shadow-[var(--pressable-card-rest-shadow)]">
      <div className="grid grid-cols-4 gap-1">
        {cards.map((card, index) => (
          <SummaryBarItem key={card.label} {...card} first={index === 0} className="px-2 py-1" />
        ))}
      </div>
    </PressableCard>
  );
}

function SummaryBarItem({
  label,
  value,
  note,
  icon: Icon,
  tone,
  first,
  className,
}: {
  label: string;
  value: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'neutral';
  first: boolean;
  className?: string;
}) {
  return <SummaryMetricItem label={label} value={value} note={note} icon={Icon} tone={tone} first={first} className={className} />;
}

function ManagedBotCard({
  bot,
  meta,
  onOpenDetails,
  onToggleEnabled,
  onRunConnectionTest,
  isTesting,
}: {
  bot: ManagedBot;
  meta: PlatformCardMeta;
  onOpenDetails: () => void;
  onToggleEnabled: () => void;
  onRunConnectionTest: () => void;
  isTesting: boolean;
}) {
  const healthMeta = getHealthMeta(bot.healthState);

  return (
    <PressableCard className="group relative rounded-[20px] border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3.5 shadow-[var(--pressable-card-rest-shadow)]">
      <div className="flex items-center gap-3.5">
        <div className="flex min-w-[248px] items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-[var(--pressable-card-rest-shadow)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={meta.logo} alt={meta.label} className={cn('h-full w-full object-cover', meta.logoClassName)} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">{bot.name}</h4>
              <Chip tone={healthMeta.chipTone} className="px-2 py-0.5 text-[11px] font-medium">
                {healthMeta.label}
              </Chip>
              <Chip tone="outline" className="px-2 py-0.5 text-[11px]">
                {formatBindingScope(bot.bindingScope)}
              </Chip>
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-4 gap-x-4 text-[12px]">
          <DetailCell label="平台" value={meta.label} />
          <DetailCell label="公司" value={bot.company} />
          <DetailCell label="默认助手" value={bot.assistant} />
          <DetailCell
            label="健康摘要"
            value={
              bot.healthState === 'healthy'
                ? '正常运行'
                : bot.healthState === 'needs_setup'
                  ? '待完成配置'
                  : bot.healthState === 'paused'
                    ? '已停用'
                    : '需要关注'
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Clock3 className="h-3.5 w-3.5" />}
            onClick={onRunConnectionTest}
            disabled={isTesting}
            className="px-3 py-1.5 text-[12px]"
          >
            {isTesting ? '测试中' : '重测连接'}
          </Button>
          <Button
            variant={bot.enabled ? 'success' : 'secondary'}
            size="sm"
            leadingIcon={<Power className="h-3.5 w-3.5" />}
            onClick={onToggleEnabled}
            className="px-3 py-1.5 text-[12px]"
          >
            {bot.enabled ? '已启用' : '已停用'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDetails}
            className="h-8 w-8 rounded-[10px] px-0 py-0"
            aria-label={`查看${bot.name}详情`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-5 border-t border-[var(--border-default)] pt-2.5 text-[12px] text-[var(--text-secondary)]">
        <InlineMetaItem label="最近活跃" value={bot.lastActive} />
        <InlineMetaItem label="触发方式" value={formatTriggerMode(bot.triggerMode)} />
        <InlineMetaItem label="回复格式" value={formatReplyFormat(bot.replyFormat)} />
        <InlineMetaItem label="最近测试" value={bot.lastTestAt ?? '还未执行'} />
      </div>
    </PressableCard>
  );
}

function DetailCell({ label, value }: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-0.5 text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function InlineMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="opacity-70">{label}:</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function ActivityPanel({
  activeTab,
  onTabChange,
  todoItems,
  healthItems,
  auditItems,
  onOpenBot,
}: {
  activeTab: SideTab;
  onTabChange: (tab: SideTab) => void;
  todoItems: Array<{ botId: string; botName: string; label: string; detail: string }>;
  healthItems: Array<{ botId: string; botName: string; detail: string; tone: 'success' | 'warning' | 'neutral' }>;
  auditItems: Array<AuditEntry & { botId: string; botName: string }>;
  onOpenBot: (botId: string) => void;
}) {
  const tabs: Array<{ id: SideTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'todo', label: '待处理', icon: AlertCircle },
    { id: 'health', label: '连接健康', icon: Activity },
    { id: 'audit', label: '审计日志', icon: ShieldCheck },
  ];

  return (
    <PressableCard className="w-[308px] overflow-hidden rounded-[22px] border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--pressable-card-rest-shadow)]">
      <div className="border-b border-[var(--border-default)] px-3.5 py-3">
        <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] px-2.5 py-2 text-[12px] font-medium',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  active
                    ? 'border border-[var(--surface-active-border)] bg-[var(--surface-active-bg)] text-[var(--surface-active-text)] shadow-[var(--surface-active-shadow)]'
                    : 'border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto px-3.5 py-3">
        {activeTab === 'todo'
          ? todoItems.length > 0
            ? todoItems.map((item) => (
                <ActivityListItem
                  key={item.botId}
                  title={item.botName}
                  description={item.detail}
                  time={item.label}
                  severity="high"
                  onClick={() => onOpenBot(item.botId)}
                />
              ))
            : (
                <EmptyPanelState
                  title="当前没有待处理项"
                  description="当机器人还没绑定默认助手，或后续出现链路异常时，这里会集中展示要处理的项目。"
                  className="border-none bg-transparent px-1 py-2"
                />
              )
          : null}
        {activeTab === 'health'
          ? healthItems.length > 0
            ? healthItems.map((item) => (
                <ActivityListItem
                  key={item.botId}
                  title={item.botName}
                  description={item.detail}
                  time={item.tone === 'success' ? '健康' : item.tone === 'warning' ? '需关注' : '一般'}
                  severity={item.tone === 'success' ? 'low' : item.tone === 'warning' ? 'medium' : undefined}
                  onClick={() => onOpenBot(item.botId)}
                />
              ))
            : (
                <EmptyPanelState
                  title="还没有连接健康信息"
                  description="完成平台接入并创建机器人后，这里会显示真实的连接状态和健康摘要。"
                  className="border-none bg-transparent px-1 py-2"
                />
              )
          : null}
        {activeTab === 'audit'
          ? auditItems.length > 0
            ? auditItems.map((item) => (
                <ActivityListItem
                  key={item.id}
                  title={item.title}
                  description={`${item.botName} · ${item.detail}`}
                  time={item.time}
                  severity={item.tone === 'success' ? 'low' : item.tone === 'warning' ? 'medium' : undefined}
                  onClick={() => onOpenBot(item.botId)}
                />
              ))
            : (
                <EmptyPanelState
                  title="当前没有审计日志"
                  description="当你进行接入、测试、启停或更新助手绑定后，这里会展示真实操作记录。"
                  className="border-none bg-transparent px-1 py-2"
                />
              )
          : null}
      </div>

      <div className="border-t border-[var(--border-default)] px-3.5 py-3">
        <button
          type="button"
          className={cn(
            'w-full rounded-[12px] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            SPRING_PRESSABLE,
            INTERACTIVE_FOCUS_RING,
          )}
        >
          查看全部历史
        </button>
      </div>
    </PressableCard>
  );
}


function ActivityListItem({
  title,
  description,
  time,
  severity,
  onClick,
}: {
  title: string;
  description: string;
  time: string;
  severity?: 'high' | 'medium' | 'low';
  onClick: () => void;
}) {
  const severityClassName =
    severity === 'high'
      ? 'border-[rgba(239,68,68,0.20)]'
      : severity === 'medium'
        ? 'border-[rgba(245,158,11,0.20)]'
        : severity === 'low'
          ? 'border-[rgba(34,197,94,0.20)]'
          : 'border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group mb-2 w-full cursor-pointer rounded-[14px] border border-[var(--border-default)] border-l-2 bg-[var(--bg-elevated)] px-3 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-page)]/50 last:mb-0',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        severityClassName,
      )}
    >
      <div className="flex items-start gap-2">
        {severity ? (
          <div
            className={cn(
              'mt-1.5 h-1.5 w-1.5 rounded-full',
              severity === 'high'
                ? 'bg-[rgb(220,38,38)]'
                : severity === 'medium'
                  ? 'bg-[rgb(217,119,6)]'
                  : 'bg-[rgb(22,163,74)]',
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h5 className="mb-1 text-[14px] font-medium leading-snug text-[var(--text-primary)]">{title}</h5>
          <p className="mb-2 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</p>
          <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
            <Clock3 className="h-3 w-3" />
            <span>{time}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyPanelState({ title, description, className }: { title: string; description: string; className?: string }) {
  return <EmptyStatePanel compact title={title} description={description} className={className} />;
}

function PlatformCard({
  platform,
  configured,
  onClick,
}: {
  platform: PlatformCardMeta;
  configured: boolean;
  onClick: () => void;
}) {
  return (
    <PlatformCardShell
      onClick={onClick}
      logo={platform.logo}
      logoAlt={platform.label}
      logoClassName={platform.logoClassName}
      title={platform.label}
      description={platform.intro}
      badge={
        configured ? (
          <Chip tone="success" className="px-2.5 py-1 text-[11px] font-medium">
            已配置
          </Chip>
        ) : null
      }
      footer={
        <Button variant={configured ? 'secondary' : 'primary'} size="sm" block leadingIcon={<Link2 className="h-4 w-4" />}>
          {configured ? '继续完善配置' : '开始接入'}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {platform.capabilities.map((item) => (
          <Chip key={item} tone="outline" className="px-2.5 py-1 text-[11px]">
            {item}
          </Chip>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5 text-[12px]">
        <MetaPill label="接入难度" value={platform.difficulty} />
        <MetaPill label="预计耗时" value={platform.eta} />
        <MetaPill label="管理员权限" value={platform.admin} />
      </div>
    </PlatformCardShell>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[58px] rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function IMBotDetailSheet({
  open,
  bot,
  platform,
  assistantOptions,
  onClose,
  onSave,
  onSaveTemplates,
  onToggleEnabled,
  onRunConnectionTest,
  isTesting,
}: {
  open: boolean;
  bot: ManagedBot | null;
  platform: PlatformCardMeta | null;
  assistantOptions: AssistantProfile[];
  onClose: () => void;
  onSave: (
    botId: string,
    updates: Pick<ManagedBot, 'name' | 'company' | 'assistantId' | 'assistant' | 'bindingScope' | 'offlineReply'>,
  ) => void;
  onSaveTemplates: (
    botId: string,
    updates: Pick<ManagedBot, 'welcomeTemplate' | 'unavailableTemplate'>,
  ) => void;
  onToggleEnabled: (botId: string) => void;
  onRunConnectionTest: (botId: string) => void;
  isTesting: boolean;
}) {
  const [draftName, setDraftName] = useState('');
  const [draftCompany, setDraftCompany] = useState('');
  const [draftAssistantId, setDraftAssistantId] = useState<string | null>(null);
  const [draftBindingScope, setDraftBindingScope] = useState<BindingScope>('organization');
  const [draftOfflineReply, setDraftOfflineReply] = useState('');
  const [draftWelcomeTemplate, setDraftWelcomeTemplate] = useState('');
  const [draftUnavailableTemplate, setDraftUnavailableTemplate] = useState('');

  useEffect(() => {
    if (!bot) return;
    setDraftName(bot.name);
    setDraftCompany(bot.company);
    setDraftAssistantId(bot.assistantId);
    setDraftBindingScope(bot.bindingScope);
    setDraftOfflineReply(bot.offlineReply);
    setDraftWelcomeTemplate(bot.welcomeTemplate);
    setDraftUnavailableTemplate(bot.unavailableTemplate);
  }, [bot]);

  if (!open || !bot || !platform) {
    return null;
  }

  const healthMeta = getHealthMeta(bot.healthState);
  const selectedAssistant = assistantOptions.find((item) => item.id === draftAssistantId) ?? null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[620px] flex-col border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_90px_rgba(26,22,18,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.98),rgba(17,16,15,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/72 px-3 py-1 text-[11px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                <span className="shrink-0">
                  <Settings2 className="h-3.5 w-3.5" />
                </span>
                机器人详情
              </div>
              <div className="mt-3.5 flex items-start gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-white shadow-[var(--pressable-card-rest-shadow)] dark:bg-[rgba(255,255,255,0.04)]">
                  <img src={platform.logo} alt={platform.label} className={cn('h-full w-full object-cover', platform.logoClassName)} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{bot.name}</h2>
                    <Chip tone={healthMeta.chipTone} className="px-2.5 py-1 text-[11px] font-medium">
                      {healthMeta.label}
                    </Chip>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {platform.label} · {bot.company} · 默认助手：{bot.assistant}
                  </p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <DrawerSection
            className="bg-white/78 backdrop-blur-[10px] dark:shadow-[0_20px_36px_rgba(0,0,0,0.26)]"
            title="当前健康状态"
            icon={
              healthMeta.panelTone === 'warning' ? (
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              )
            }
            description={bot.healthSummary}
            headerAccessory={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Clock3 className="h-4 w-4" />}
                  onClick={() => onRunConnectionTest(bot.id)}
                  disabled={isTesting}
                >
                  {isTesting ? '测试中' : '重测连接'}
                </Button>
                <Button
                  variant={bot.enabled ? 'ghost' : 'success'}
                  size="sm"
                  leadingIcon={<Power className="h-4 w-4" />}
                  onClick={() => onToggleEnabled(bot.id)}
                >
                  {bot.enabled ? '停用机器人' : '启用机器人'}
                </Button>
              </>
            }
          >
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(['healthy', 'needs_setup', 'connectivity_issue', 'permission_issue', 'callback_issue', 'paused'] as IMBotHealthState[]).map((state) => {
                const meta = getHealthMeta(state);
                return (
                  <SelectionCard
                    as="div"
                    key={state}
                    selected={state === bot.healthState}
                    className="rounded-[18px] px-3 py-2.5"
                  >
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{meta.label}</div>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{meta.description}</p>
                  </SelectionCard>
                );
              })}
            </div>
          </DrawerSection>

          <section className="grid gap-3 sm:grid-cols-2">
            <InfoTile
              label="平台"
              value={platform.label}
              description={`已接入能力：${platform.capabilities.join(' / ')}`}
              className="bg-white/76 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]"
            />
            <InfoTile
              label="实链路测试"
              value={
                bot.lastPreflightResult
                  ? bot.lastPreflightResult.ok
                    ? '已通过'
                    : '未通过'
                  : '未验证'
              }
              description={bot.lastPreflightResult?.message || '尚未获得最近一次真实平台预检结果。'}
              tone={bot.lastPreflightResult ? (bot.lastPreflightResult.ok ? 'success' : 'warning') : 'neutral'}
              className="dark:border-[rgba(255,255,255,0.08)]"
            />
          </section>

          {bot.lastPreflightResult?.checks.length ? (
            <DrawerSection title="最近实链路验证" icon={<Link2 className="h-5 w-5" />}>
              <div className="mt-4 space-y-3">
                {bot.lastPreflightResult.checks.map((check) => (
                  <InfoTile
                    key={check.id}
                    label={check.label}
                    value={check.status === 'success' ? '通过' : check.status === 'warning' ? '注意' : '失败'}
                    description={check.detail}
                    tone={check.status === 'success' ? 'success' : 'warning'}
                  />
                ))}
              </div>
            </DrawerSection>
          ) : null}

          <DrawerSection title="基础信息与默认助手" icon={<BotMessageSquare className="h-5 w-5" />}>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">机器人名称</div>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className={DETAIL_INPUT_CLASS}
                />
              </label>
              <label className="space-y-2">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">归属团队 / 企业</div>
                <input
                  value={draftCompany}
                  onChange={(event) => setDraftCompany(event.target.value)}
                  className={DETAIL_INPUT_CLASS}
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">默认助手绑定</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {assistantOptions.map((assistant) => (
                  <SelectionCard
                    as="button"
                    key={assistant.id}
                    onClick={() => setDraftAssistantId(assistant.id)}
                    selected={draftAssistantId === assistant.id}
                  >
                    <div className="text-[15px] font-medium text-[var(--text-primary)]">{assistant.name}</div>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{assistant.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
                        {assistant.scope}
                      </Chip>
                      <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
                        {assistant.persona}
                      </Chip>
                    </div>
                  </SelectionCard>
                ))}
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="会话绑定与回复策略" icon={<Radio className="h-5 w-5" />}>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {bindingScopeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectionCard
                    as="button"
                    key={option.value}
                    onClick={() => setDraftBindingScope(option.value)}
                    selected={draftBindingScope === option.value}
                  >
                    <div className="flex items-center gap-2 text-[15px] font-medium text-[var(--text-primary)]">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{option.description}</p>
                  </SelectionCard>
                );
              })}
            </div>
            <label className="mt-4 block space-y-2">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">离线自动回复</div>
              <input
                value={draftOfflineReply}
                onChange={(event) => setDraftOfflineReply(event.target.value)}
                className={DETAIL_INPUT_CLASS}
              />
            </label>
          </DrawerSection>

          <DrawerSection
            title="消息模板"
            icon={<MessageSquare className="h-5 w-5" />}
            description="这里放默认欢迎语和异常回复语义。当前先作为机器人级模板配置，后续可继续细分到不同平台或群组。"
          >
            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">欢迎模板</div>
                <textarea
                  value={draftWelcomeTemplate}
                  onChange={(event) => setDraftWelcomeTemplate(event.target.value)}
                  className={DETAIL_TEXTAREA_CLASS}
                />
              </label>
              <label className="space-y-2">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">异常 / 不可用模板</div>
                <textarea
                  value={draftUnavailableTemplate}
                  onChange={(event) => setDraftUnavailableTemplate(event.target.value)}
                  className={DETAIL_TEXTAREA_CLASS}
                />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile
                label="预览 · 欢迎语"
                value={renderTemplatePreview(draftWelcomeTemplate, selectedAssistant?.name ?? bot.assistant)}
                className="min-h-[142px]"
              />
              <InfoTile
                label="预览 · 异常提示"
                value={renderTemplatePreview(draftUnavailableTemplate, selectedAssistant?.name ?? bot.assistant)}
                className="min-h-[142px]"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onSaveTemplates(bot.id, {
                    welcomeTemplate: draftWelcomeTemplate.trim() || bot.welcomeTemplate,
                    unavailableTemplate: draftUnavailableTemplate.trim() || bot.unavailableTemplate,
                  })
                }
              >
                保存消息模板
              </Button>
            </div>
          </DrawerSection>

          <DrawerSection title="最近审计日志" icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="mt-4 space-y-3">
              {bot.auditLogs.slice(0, 6).map((item) => (
                <InfoTile
                  key={item.id}
                  label={item.time}
                  value={item.title}
                  description={item.detail}
                  tone={item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : 'neutral'}
                />
              ))}
            </div>
          </DrawerSection>
        </div>

        <div className="border-t border-[var(--border-default)] bg-white/82 px-6 py-[18px] backdrop-blur-[10px] dark:border-t-[rgba(255,255,255,0.08)] dark:bg-[rgba(12,12,12,0.86)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-[13px] text-[var(--text-secondary)]">
              {selectedAssistant
                ? `当前准备绑定默认助手“${selectedAssistant.name}”。保存后，机器人状态会重新计算。`
                : '如果不绑定默认助手，机器人会保持“待完成配置”状态。'}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="md" onClick={onClose}>
                稍后再配
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() =>
                  onSave(bot.id, {
                    name: draftName.trim() || bot.name,
                    company: draftCompany.trim() || '待完善',
                    assistantId: draftAssistantId,
                    assistant: selectedAssistant?.name ?? '未绑定默认助手',
                    bindingScope: draftBindingScope,
                    offlineReply: draftOfflineReply.trim() || bot.offlineReply,
                  })
                }
              >
                保存配置
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function isRealPreflightSupported(platformId: IMPlatformId): boolean {
  return (
    platformId === 'dingtalk' ||
    platformId === 'feishu-china' ||
    platformId === 'wecom-app' ||
    platformId === 'wechat-mp'
  );
}

function resolveBotHealthState(
  enabled: boolean,
  assistantId: string | null,
  preflightResult: ImBotConnectionPreflightResult | null,
): IMBotHealthState {
  if (!enabled) {
    return 'paused';
  }
  if (!preflightResult) {
    return 'needs_setup';
  }
  if (!preflightResult?.ok) {
    if (preflightResult?.checks.some((check) => check.id === 'callback_url' && check.status === 'failure')) {
      return 'callback_issue';
    }
    if (preflightResult?.checks.some((check) => check.id.includes('permission') && check.status === 'failure')) {
      return 'permission_issue';
    }
    return 'connectivity_issue';
  }
  return assistantId ? 'healthy' : 'needs_setup';
}

function resolveBotHealthSummary(
  healthState: IMBotHealthState,
  preflightResult: ImBotConnectionPreflightResult | null,
  assistantId: string | null,
): string {
  if (healthState === 'paused') {
    return '机器人已停用，不再接收新消息。';
  }
  if (!preflightResult) {
    return '还没有真实平台预检结果，请先完成一次连接测试。';
  }
  if (!preflightResult.ok) {
    return preflightResult.message;
  }
  if (!assistantId) {
    return `${preflightResult.message} 但默认助手还没有绑定完成。`;
  }
  return `${preflightResult.message} 默认助手也已绑定完成。`;
}

function getHealthMeta(state: IMBotHealthState): {
  label: string;
  description: string;
  chipTone: 'success' | 'warning' | 'outline' | 'danger';
  panelTone: 'success' | 'warning' | 'neutral';
} {
  switch (state) {
    case 'healthy':
      return {
        label: '运行正常',
        description: '连接、默认助手和最近一次测试都已经通过，可以稳定服务。',
        chipTone: 'success',
        panelTone: 'success',
      };
    case 'needs_setup':
      return {
        label: '待完成配置',
        description: '真实平台预检已通过，但默认助手或会话范围还没有配置完成。',
        chipTone: 'warning',
        panelTone: 'warning',
      };
    case 'connectivity_issue':
      return {
        label: '连接异常',
        description: '平台网关、长连接或回调链路当前不可用，需要重新检查。',
        chipTone: 'danger',
        panelTone: 'warning',
      };
    case 'permission_issue':
      return {
        label: '权限异常',
        description: '平台应用权限不足，机器人可能无法收发消息。',
        chipTone: 'danger',
        panelTone: 'warning',
      };
    case 'callback_issue':
      return {
        label: '回调异常',
        description: '平台回调验证失败，常见于企微或需要 webhook 的平台。',
        chipTone: 'danger',
        panelTone: 'warning',
      };
    case 'paused':
      return {
        label: '已停用',
        description: '机器人处于暂停状态，不会再接收新消息。',
        chipTone: 'outline',
        panelTone: 'neutral',
      };
  }
}

function createAuditEntry(tone: BotAuditTone, title: string, detail: string): AuditEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    detail,
    time: '刚刚',
    tone,
    createdAt: Date.now(),
  };
}

function formatTriggerMode(value: IMBotDraft['triggerMode']): string {
  return value === 'mention' ? '@提及时响应' : value === 'keyword' ? '关键词触发' : '全部消息';
}

function formatReplyFormat(value: IMBotDraft['replyFormat']): string {
  return value === 'card' ? '卡片/富文本' : value === 'markdown' ? 'Markdown' : '纯文本';
}

function formatBindingScope(value: BindingScope): string {
  return value === 'organization' ? '组织统一入口' : value === 'group' ? '指定群聊 / 频道' : '私聊助手';
}

function renderTemplatePreview(template: string, assistantName: string): string {
  return template.replaceAll('{{assistant}}', assistantName || '默认助手');
}
