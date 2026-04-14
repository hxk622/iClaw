import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  Activity,
  AlertCircle,
  Bot,
  BotMessageSquare,
  Building2,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Link2,
  MessageCircle,
  MessageSquare,
  Power,
  Radio,
  RefreshCw,
  SendHorizontal,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TestTube2,
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
import { cn } from '@/app/lib/cn';
import { pushAppNotification } from '@/app/lib/task-notifications';
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
type BotTestStatus = 'idle' | 'testing' | 'success';
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
  triggerMode: string;
  replyFormat: string;
  bindingScope: BindingScope;
  offlineReply: string;
  welcomeTemplate: string;
  unavailableTemplate: string;
  testStatus: BotTestStatus;
  lastTestMessage: string;
  lastTestResponse: string;
  auditLogs: AuditEntry[];
}

type PlatformCardMeta = IMPlatformMeta & {
  capabilities: string[];
  pluginId: string;
  advantageLabel: string;
  rolloutNote: string;
};

const DEFAULT_PLATFORM_ID: IMPlatformId = 'dingtalk';

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

export function IMBotsView({ title, client }: { title: string; client: IClawClient }) {
  const [bots, setBots] = useState<ManagedBot[]>(initialBots);
  const [activeSideTab, setActiveSideTab] = useState<SideTab>('todo');
  const [selectedPlatformId, setSelectedPlatformId] = useState<IMPlatformId | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const selectedPlatform = useMemo(
    () => platformMetaList.find((item) => item.id === selectedPlatformId) ?? null,
    [selectedPlatformId],
  );

  const selectedBot = useMemo(
    () => bots.find((item) => item.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

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

  const handleCompleteSetup = (draft: IMBotDraft) => {
    const meta = platformMetaList.find((item) => item.id === draft.platformId);
    if (!meta) return;

    const nextId = `${draft.platformId}-bot`;

    setBots((prev) => {
      const existing = prev.find((item) => item.id === nextId);
      if (existing) {
        return prev.map((item) =>
          item.id === nextId
            ? {
                ...item,
                enabled: true,
                healthState: item.assistantId ? 'healthy' : 'needs_setup',
                lastActive: '刚刚',
                lastTestAt: '刚刚',
                healthSummary: item.assistantId
                  ? '平台接入已更新完成，默认助手保留，最近一次测试通过。'
                  : '平台接入已更新完成，但还没有绑定默认助手与会话范围。',
                triggerMode: formatTriggerMode(draft.triggerMode),
                replyFormat: formatReplyFormat(draft.replyFormat),
                auditLogs: [
                  createAuditEntry('success', '平台接入已更新', `${meta.label} 的连接配置已重新保存并通过测试。`),
                  ...item.auditLogs,
                ],
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: nextId,
          platformId: draft.platformId,
          name: `${meta.label}办公助手`,
          company: '待完善',
          assistantId: null,
          assistant: '未绑定默认助手',
          healthState: 'needs_setup',
          enabled: true,
          lastActive: '刚刚',
          lastTestAt: '刚刚',
          healthSummary: '平台连接已建立，但默认助手、会话范围和首条测试消息还没有完成。',
          triggerMode: formatTriggerMode(draft.triggerMode),
          replyFormat: formatReplyFormat(draft.replyFormat),
          bindingScope: 'organization',
          offlineReply: '我现在暂时离线，稍后会继续处理你的消息。',
          welcomeTemplate: '你好，我是{{assistant}}，可以直接把问题发给我。',
          unavailableTemplate: '我暂时无法完成这次请求，已记录到日志，请稍后重试。',
          testStatus: 'idle',
          lastTestMessage: '',
          lastTestResponse: '',
          auditLogs: [
            createAuditEntry('warning', '待完成默认助手绑定', '接入成功后，建议先绑定默认助手，再进行第一条测试消息。'),
            createAuditEntry('success', '平台接入完成', `${meta.label} 连接配置已建立，最近一次接入测试通过。`),
          ],
        },
      ];
    });

    setSelectedBotId(nextId);
  };

  const handleUpdateBot = (
    botId: string,
    updates: Pick<ManagedBot, 'name' | 'company' | 'assistantId' | 'assistant' | 'bindingScope' | 'offlineReply'>,
  ) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const nextHealthState = bot.enabled
          ? updates.assistantId
            ? 'healthy'
            : 'needs_setup'
          : 'paused';
        return {
          ...bot,
          ...updates,
          healthState: nextHealthState,
          healthSummary:
            nextHealthState === 'healthy'
              ? '默认助手与会话范围已完成配置，最近一次连接检查正常。'
              : nextHealthState === 'paused'
                ? '机器人已停用，不再接收新消息。'
                : '连接已建立，但默认助手或会话绑定还没有完成。',
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
      }),
    );
  };

  const handleUpdateBotTemplates = (
    botId: string,
    updates: Pick<ManagedBot, 'welcomeTemplate' | 'unavailableTemplate'>,
  ) => {
    setBots((prev) =>
      prev.map((bot) =>
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
      ),
    );
  };

  const handleToggleBot = (botId: string) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        const nextEnabled = !bot.enabled;
        const nextHealthState = nextEnabled
          ? bot.assistantId
            ? 'healthy'
            : 'needs_setup'
          : 'paused';
        return {
          ...bot,
          enabled: nextEnabled,
          healthState: nextHealthState,
          healthSummary:
            nextHealthState === 'paused'
              ? '机器人已停用，不再接收新消息。'
              : nextHealthState === 'healthy'
                ? '机器人已启用，最近一次健康检查正常。'
                : '机器人已启用，但还没有绑定默认助手。',
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
      }),
    );
  };

  const handleRunConnectionTest = async (botId: string) => {
    const targetBot = bots.find((bot) => bot.id === botId) ?? null;

    setBots((prev) =>
      prev.map((bot) =>
        bot.id === botId
          ? {
              ...bot,
              testStatus: 'testing',
              auditLogs: [
                createAuditEntry('info', '开始连接测试', '已触发一次即时连通性检查，正在验证平台链路与回调状态。'),
                ...bot.auditLogs,
              ],
            }
          : bot,
      ),
    );
    pushAppNotification({
      tone: 'info',
      source: 'system',
      title: '已开始机器人测试',
      text: targetBot ? `正在检查「${targetBot.name}」的平台链路与 runtime 连接。` : '正在检查机器人平台链路与 runtime 连接。',
    });

    try {
      await client.health();
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.id !== botId) return bot;
          const nextHealthState = bot.enabled
            ? bot.assistantId
              ? 'healthy'
              : 'needs_setup'
            : 'paused';
          return {
            ...bot,
            testStatus: 'success',
            healthState: nextHealthState,
            lastTestAt: '刚刚',
            lastActive: '刚刚',
            healthSummary:
              nextHealthState === 'healthy'
                ? '本地 iClaw 运行时与 gateway 连接正常，默认助手配置也已就绪。'
                : nextHealthState === 'paused'
                  ? 'runtime 健康检查通过，但机器人当前处于停用状态。'
                  : 'runtime 健康检查通过，但默认助手还没有配置完成。',
            auditLogs: [
              createAuditEntry(
                'success',
                '连接测试通过',
                nextHealthState === 'healthy'
                  ? '本地 runtime、gateway 与默认助手检查均通过。'
                  : '本地 runtime 检查通过，但仍建议继续完成默认助手绑定。',
              ),
              ...bot.auditLogs,
            ],
          };
        }),
      );
      pushAppNotification({
        tone: 'success',
        source: 'system',
        title: '机器人测试通过',
        text: targetBot?.assistantId
          ? `「${targetBot.name}」连接正常，默认助手链路也已就绪。`
          : `「${targetBot?.name ?? '当前机器人'}」连接正常，但还没有绑定默认助手。`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地 runtime 健康检查失败';
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId
            ? {
                ...bot,
                testStatus: 'idle',
                healthState: 'connectivity_issue',
                lastActive: '刚刚',
                healthSummary: '本地 iClaw 运行时或 gateway 当前不可用，无法完成真实连接测试。',
                lastTestResponse: message,
                auditLogs: [
                  createAuditEntry('warning', '连接测试失败', message),
                  ...bot.auditLogs,
                ],
              }
          : bot,
        ),
      );
      pushAppNotification({
        tone: 'error',
        source: 'system',
        title: '机器人测试失败',
        text: targetBot ? `「${targetBot.name}」测试失败：${message}` : message,
      });
    }
  };

  const handleSendTestMessage = async (botId: string, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== botId) return bot;
        if (!bot.assistantId) {
          return {
            ...bot,
            lastTestMessage: trimmed,
            lastTestResponse: '未发送：请先绑定默认助手。',
            healthState: 'needs_setup',
            healthSummary: '连接可用，但默认助手尚未绑定，暂时不能做完整对话测试。',
            auditLogs: [
              createAuditEntry('warning', '测试消息未发送', '当前还没有绑定默认助手，无法完成完整会话测试。'),
              ...bot.auditLogs,
            ],
          };
        }
        return {
          ...bot,
          testStatus: 'testing',
          lastTestMessage: trimmed,
          auditLogs: [
            createAuditEntry('info', '发送测试消息', `已从管理台发起一条测试消息：“${trimmed}”`),
            ...bot.auditLogs,
          ],
        };
      }),
    );

    const responseChunks: string[] = [];

    try {
      await client.streamChat(
        {
          message: trimmed,
        },
        {
          onDelta: (text) => {
            responseChunks.push(text);
            setBots((prev) =>
              prev.map((bot) =>
                bot.id === botId
                  ? {
                      ...bot,
                      lastTestResponse: responseChunks.join(''),
                    }
                  : bot,
              ),
            );
          },
          onEnd: () => {
            setBots((prev) =>
              prev.map((bot) => {
                if (bot.id !== botId || !bot.assistantId) return bot;
                const nextResponse = responseChunks.join('').trim() || `已由${bot.assistant}返回一条测试回复。`;
                return {
                  ...bot,
                  testStatus: 'success',
                  healthState: bot.enabled ? 'healthy' : 'paused',
                  lastTestAt: '刚刚',
                  lastActive: '刚刚',
                  lastTestResponse: nextResponse,
                  healthSummary: bot.enabled
                    ? 'runtime 对话测试已通过，可以继续在真实 IM 会话中灰度验证。'
                    : '机器人已停用，但 runtime 对话测试已通过。',
                  auditLogs: [
                    createAuditEntry('success', '测试消息已返回', `默认助手“${bot.assistant}”已成功处理一条真实 runtime 测试消息。`),
                    ...bot.auditLogs,
                  ],
                };
              }),
            );
          },
          onError: (error) => {
            setBots((prev) =>
              prev.map((bot) =>
                bot.id === botId
                  ? {
                      ...bot,
                      testStatus: 'idle',
                      healthState: 'connectivity_issue',
                      lastTestResponse: error.message || '测试消息调用失败',
                      healthSummary: '测试消息未能从本地 runtime 返回，请先检查 gateway 或本地运行状态。',
                      auditLogs: [
                        createAuditEntry('warning', '测试消息失败', error.message || '测试消息调用失败'),
                        ...bot.auditLogs,
                      ],
                    }
                  : bot,
              ),
            );
          },
        },
      );
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '测试消息调用失败';
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId
            ? {
                ...bot,
                testStatus: 'idle',
                healthState: 'connectivity_issue',
                lastTestResponse: messageText,
                healthSummary: '测试消息未能从本地 runtime 返回，请先检查 gateway 或本地运行状态。',
                auditLogs: [
                  createAuditEntry('warning', '测试消息失败', messageText),
                  ...bot.auditLogs,
                ],
              }
            : bot,
        ),
      );
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
                    onRunConnectionTest={() => {
                      setSelectedBotId(bot.id);
                      void handleRunConnectionTest(bot.id);
                    }}
                    onToggleEnabled={() => handleToggleBot(bot.id)}
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
        onSendTestMessage={handleSendTestMessage}
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
  onRunConnectionTest,
  onToggleEnabled,
}: {
  bot: ManagedBot;
  meta: PlatformCardMeta;
  onOpenDetails: () => void;
  onRunConnectionTest: () => void;
  onToggleEnabled: () => void;
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
            leadingIcon={<TestTube2 className={cn('h-4 w-4', bot.testStatus === 'testing' && 'animate-spin')} />}
            onClick={onRunConnectionTest}
            disabled={bot.testStatus === 'testing'}
            className="px-3 py-1.5 text-[12px]"
          >
            测试连通
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
        <InlineMetaItem label="触发方式" value={bot.triggerMode} />
        <InlineMetaItem label="回复格式" value={bot.replyFormat} />
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
                    ? 'border border-[var(--button-primary-border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--button-secondary-shadow)]'
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
  onSendTestMessage,
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
  onRunConnectionTest: (botId: string) => Promise<void> | void;
  onSendTestMessage: (botId: string, message: string) => Promise<void> | void;
}) {
  const [draftName, setDraftName] = useState('');
  const [draftCompany, setDraftCompany] = useState('');
  const [draftAssistantId, setDraftAssistantId] = useState<string | null>(null);
  const [draftBindingScope, setDraftBindingScope] = useState<BindingScope>('organization');
  const [draftOfflineReply, setDraftOfflineReply] = useState('');
  const [draftTestMessage, setDraftTestMessage] = useState('请给我一句上线自检回复');
  const [draftWelcomeTemplate, setDraftWelcomeTemplate] = useState('');
  const [draftUnavailableTemplate, setDraftUnavailableTemplate] = useState('');

  useEffect(() => {
    if (!bot) return;
    setDraftName(bot.name);
    setDraftCompany(bot.company);
    setDraftAssistantId(bot.assistantId);
    setDraftBindingScope(bot.bindingScope);
    setDraftOfflineReply(bot.offlineReply);
    setDraftTestMessage('请给我一句上线自检回复');
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
                  leadingIcon={<RefreshCw className={cn('h-4 w-4', bot.testStatus === 'testing' && 'animate-spin')} />}
                  onClick={() => onRunConnectionTest(bot.id)}
                  disabled={bot.testStatus === 'testing'}
                >
                  测试连通
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
              label="最近连接测试"
              value={bot.lastTestAt ?? '还未执行'}
              description={bot.lastTestAt ? '可以继续在下方测试面板中发送一条消息。' : '建议先执行一次连接测试，确认平台链路是通的。'}
              tone={bot.lastTestAt ? 'success' : 'warning'}
              className="dark:border-[rgba(255,255,255,0.08)]"
            />
          </section>

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

          <DrawerSection
            title="测试面板"
            icon={<TestTube2 className="h-5 w-5" />}
            description="先做连接测试，再发一条测试消息。这样用户可以在管理台内确认平台链路和默认助手回复都已打通。"
          >
            <div className="mt-4 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">测试消息</div>
                  <input
                    value={draftTestMessage}
                    onChange={(event) => setDraftTestMessage(event.target.value)}
                    className={DETAIL_INPUT_CLASS}
                  />
                </label>
                <div className="flex items-end gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<RefreshCw className={cn('h-4 w-4', bot.testStatus === 'testing' && 'animate-spin')} />}
                    onClick={() => onRunConnectionTest(bot.id)}
                    disabled={bot.testStatus === 'testing'}
                  >
                    连接测试
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<SendHorizontal className="h-4 w-4" />}
                    onClick={() => onSendTestMessage(bot.id, draftTestMessage)}
                    disabled={bot.testStatus === 'testing' || !draftTestMessage.trim()}
                  >
                    发测试消息
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoTile
                  label="最近一次测试消息"
                  value={bot.lastTestMessage || '还没有发送过测试消息'}
                  className="min-h-[104px]"
                />
                <InfoTile
                  label="最近一次测试回复"
                  value={bot.lastTestResponse || '还没有收到测试回复'}
                  tone={bot.lastTestResponse ? 'success' : 'neutral'}
                  className="min-h-[104px]"
                />
              </div>
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
        description: '连接已建立，但默认助手、会话范围或首条测试消息还没完成。',
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
