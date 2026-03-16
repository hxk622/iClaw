import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  MessageSquare,
  Power,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';
import dingtalkLogo from '@/app/assets/im-bots/dingtalk.png';
import feishuLogo from '@/app/assets/im-bots/feishu.png';
import qqLogo from '@/app/assets/im-bots/qq.png';
import wecomLogo from '@/app/assets/im-bots/wecom.png';
import { IMBotSetupModal, type IMBotDraft, type IMPlatformId, type IMPlatformMeta } from './IMBotSetupModal';

type BotStatus = 'running' | 'warning' | 'draft' | 'paused';
type SideTab = 'messages' | 'health' | 'alerts';

interface ManagedBot {
  id: string;
  platformId: IMPlatformId;
  name: string;
  company: string;
  assistant: string;
  status: BotStatus;
  enabled: boolean;
  lastActive: string;
  healthSummary: string;
  triggerMode: string;
  replyFormat: string;
}

const platformMetaList: IMPlatformMeta[] = [
  {
    id: 'feishu',
    label: '飞书',
    logo: feishuLogo,
    intro: '适合企业群聊、私聊与组织内 AI 助手。',
    difficulty: '中',
    eta: '10 分钟',
    admin: '需要',
    guideUrl: 'https://open.feishu.cn/app',
    credentialFields: [
      { key: 'app_id', label: 'App ID', placeholder: '请输入飞书 App ID' },
      { key: 'app_secret', label: 'App Secret', placeholder: '请输入飞书 App Secret' },
      { key: 'callback_url', label: '回调地址', placeholder: '', readOnly: true },
    ],
    introSteps: [
      '登录飞书开放平台，创建企业自建应用。',
      '开启机器人能力，并在权限管理中开通消息收发权限。',
      '确认事件订阅方式，并保留当前产品生成的回调地址。',
      '回到 iClaw 继续完成凭据填写与测试。',
    ],
    testHints: [
      '飞书官方原生支持 OpenClaw，多账号场景可通过 accountId 建模。',
      '如企业使用国际版 Lark，后续可在高级配置里补充域名覆盖。',
    ],
  },
  {
    id: 'dingtalk',
    label: '钉钉',
    logo: dingtalkLogo,
    intro: '适合组织内办公对话、通知流和群聊助手。',
    difficulty: '中',
    eta: '12 分钟',
    admin: '需要',
    guideUrl: 'https://open-dev.dingtalk.com/',
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
    ],
  },
  {
    id: 'wecom',
    label: '企微',
    logo: wecomLogo,
    intro: '适合组织内员工助手、企业消息与内部工作流。',
    difficulty: '高',
    eta: '15 分钟',
    admin: '需要',
    guideUrl: 'https://developer.work.weixin.qq.com/',
    credentialFields: [
      { key: 'corp_id', label: 'Corp ID', placeholder: '请输入企业 ID' },
      { key: 'agent_id', label: 'Agent ID', placeholder: '请输入应用 ID' },
      { key: 'secret', label: 'Secret', placeholder: '请输入应用 Secret' },
      { key: 'callback_url', label: '回调地址', placeholder: '', readOnly: true },
    ],
    introSteps: [
      '在企业微信管理后台创建自建应用。',
      '记录 Corp ID、Agent ID 和应用 Secret。',
      '在回调设置里配置 URL、Token 和 EncodingAESKey。',
      '回到 iClaw 完成凭据录入并做一次回调连通测试。',
    ],
    testHints: [
      '企微对回调配置更敏感，建议先确保 URL 可访问。',
      '正式上线前，可以先在单个部门或应用内试运行。',
    ],
  },
  {
    id: 'qq',
    label: 'QQ',
    logo: qqLogo,
    intro: '适合 QQ 群、频道和轻量办公协作入口。',
    difficulty: '高',
    eta: '15 分钟',
    admin: '部分需要',
    guideUrl: 'https://q.qq.com/bot/',
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
    ],
  },
];

const initialBots: ManagedBot[] = [
  {
    id: 'feishu-office',
    platformId: 'feishu',
    name: '飞书办公助手',
    company: '艾元析科技',
    assistant: '通用办公助手',
    status: 'running',
    enabled: true,
    lastActive: '2 分钟前',
    healthSummary: '最近 24 小时运行稳定，最近一次测试通过。',
    triggerMode: '@提及时响应',
    replyFormat: '卡片/富文本',
  },
  {
    id: 'dingtalk-ops',
    platformId: 'dingtalk',
    name: '钉钉运营助手',
    company: '艾元析科技',
    assistant: '运营值班助手',
    status: 'warning',
    enabled: true,
    lastActive: '18 分钟前',
    healthSummary: '当前可用，但最近一次回调延迟偏高，建议稍后复测。',
    triggerMode: '关键词触发',
    replyFormat: 'Markdown',
  },
];

const summaryCards: Array<{
  label: string;
  value: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'neutral';
}> = [
  { label: '已创建机器人', value: '2', note: '大多数企业从 1 到 2 个机器人开始试点。', icon: Bot, tone: 'brand' },
  { label: '当前运行中', value: '2', note: '两个机器人都已启用，其中一个建议稍后复测。', icon: Power, tone: 'success' },
  { label: '最近消息成功率', value: '99.2%', note: '过去 24 小时整体收发稳定。', icon: MessageSquare, tone: 'success' },
  { label: '待处理异常', value: '1', note: '钉钉连接延迟偏高，但尚未影响正常回复。', icon: AlertCircle, tone: 'warning' },
];

const sideMessages = [
  { platform: '飞书', user: '张薇', content: '帮我整理今天下午的会议纪要', time: '2 分钟前' },
  { platform: '钉钉', user: '李明', content: '@AI助手 把本周待办整理成列表', time: '18 分钟前' },
  { platform: '飞书', user: '陈军', content: '生成一个招聘 JD 初稿', time: '35 分钟前' },
];

const sideHealth = [
  { title: '飞书办公助手', detail: 'WebSocket 连接正常，最近一次测试通过。', tone: 'success' as const },
  { title: '钉钉运营助手', detail: '回调链路可用，但最近 30 分钟有 2 次连接波动。', tone: 'warning' as const },
  { title: '企业微信', detail: '尚未接入，等待创建。', tone: 'neutral' as const },
];

const sideAlerts = [
  { title: '钉钉连接波动', detail: '建议在业务低峰期重新执行一次连接测试。', time: '今天 14:08' },
  { title: 'QQ 尚未接入', detail: '可以在下方平台卡片中发起新的接入流程。', time: '今天 10:24' },
];

export function IMBotsView() {
  const [bots, setBots] = useState<ManagedBot[]>(initialBots);
  const [activeSideTab, setActiveSideTab] = useState<SideTab>('messages');
  const [selectedPlatformId, setSelectedPlatformId] = useState<IMPlatformId | null>(null);

  const selectedPlatform = useMemo(
    () => platformMetaList.find((item) => item.id === selectedPlatformId) ?? null,
    [selectedPlatformId],
  );

  const configuredPlatforms = useMemo(
    () => new Set(bots.map((item) => item.platformId)),
    [bots],
  );

  const handleCompleteSetup = (draft: IMBotDraft) => {
    const meta = platformMetaList.find((item) => item.id === draft.platformId);
    if (!meta) return;

    setBots((prev) => {
      const existing = prev.find((item) => item.platformId === draft.platformId);
      if (existing) {
        return prev.map((item) =>
          item.platformId === draft.platformId
            ? {
                ...item,
                status: 'running',
                enabled: true,
                lastActive: '刚刚',
                healthSummary: '接入已更新完成，当前未发现异常。',
                triggerMode: formatTriggerMode(draft.triggerMode),
                replyFormat: formatReplyFormat(draft.replyFormat),
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: `${draft.platformId}-bot`,
          platformId: draft.platformId,
          name: `${meta.label}办公助手`,
          company: '艾元析科技',
          assistant: '通用办公助手',
          status: 'running',
          enabled: true,
          lastActive: '刚刚',
          healthSummary: '接入刚完成，最近一次测试通过。',
          triggerMode: formatTriggerMode(draft.triggerMode),
          replyFormat: formatReplyFormat(draft.replyFormat),
        },
      ];
    });
  };

  return (
    <div className="flex flex-1 overflow-y-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-full max-w-[1440px] px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">IM Robot Workspace</div>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">IM机器人</h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[var(--text-secondary)]">
              将 OpenClaw 接入企业常用办公 IM，并统一管理机器人状态。这个视图区默认按“已创建机器人 + 平台接入卡片”的产品化路径组织。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" leadingIcon={<ArrowUpRight className="h-4 w-4" />}>
              查看异常
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Link2 className="h-4 w-4" />}
              onClick={() => setSelectedPlatformId('feishu')}
            >
              新建机器人
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">已创建的机器人</div>
                <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">通常一屏就能看全所有机器人，不需要复杂的后台表格。</p>
              </div>
              <Button variant="ghost" size="sm" leadingIcon={<ExternalLink className="h-4 w-4" />}>
                查看全部
              </Button>
            </div>
            {bots.map((bot) => {
              const meta = platformMetaList.find((item) => item.id === bot.platformId)!;
              return <ManagedBotCard key={bot.id} bot={bot} meta={meta} />;
            })}
          </div>

          <ActivityPanel
            activeTab={activeSideTab}
            onTabChange={setActiveSideTab}
          />
        </div>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-default)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--bg-page)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              平台接入配置
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">接入新的平台</div>
              <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">点击任一平台卡片，直接弹出步骤式接入模态窗，在当前页面内完成整个流程。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
      </div>

      <IMBotSetupModal
        platform={selectedPlatform}
        open={Boolean(selectedPlatform)}
        onClose={() => setSelectedPlatformId(null)}
        onComplete={handleCompleteSetup}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'neutral';
}) {
  const toneClassName = {
    brand: 'bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]',
    success: 'bg-[rgba(34,197,94,0.12)] text-[rgb(22,163,74)] dark:text-[#9af0c5]',
    warning: 'bg-[rgba(245,158,11,0.16)] text-[rgb(217,119,6)] dark:text-[#ffd49a]',
    neutral: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  }[tone];

  return (
    <PressableCard className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,244,0.90))] px-5 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.96),rgba(18,18,18,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
          <div className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">{value}</div>
          <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{note}</p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-[18px]', toneClassName)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </PressableCard>
  );
}

function ManagedBotCard({ bot, meta }: { bot: ManagedBot; meta: IMPlatformMeta }) {
  const statusTone = {
    running: 'border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.12)] text-[rgb(22,163,74)] dark:text-[#9af0c5]',
    warning: 'border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.14)] text-[rgb(217,119,6)] dark:text-[#ffd49a]',
    draft: 'border-[rgba(148,163,184,0.18)] bg-[rgba(148,163,184,0.12)] text-[var(--text-secondary)]',
    paused: 'border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.12)] text-[rgb(220,38,38)] dark:text-[#fecaca]',
  }[bot.status];

  const statusLabel = {
    running: '运行中',
    warning: '异常待关注',
    draft: '未完成配置',
    paused: '已停用',
  }[bot.status];

  return (
    <PressableCard className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.90))] px-6 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.96),rgba(17,17,17,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.30)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={meta.logo} alt={meta.label} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{bot.name}</h3>
              <span className={cn('rounded-full border px-3 py-1 text-[12px] font-medium', statusTone)}>{statusLabel}</span>
            </div>
            <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
              {meta.label} · {bot.company} · 默认助手：{bot.assistant}
            </p>
            <p className="mt-3 max-w-[720px] text-[14px] leading-7 text-[var(--text-secondary)]">{bot.healthSummary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />}>
            测试连通
          </Button>
          <Button variant={bot.enabled ? 'ghost' : 'success'} size="sm" leadingIcon={<Power className="h-4 w-4" />}>
            {bot.enabled ? '停用' : '启用'}
          </Button>
          <Button variant="ghost" size="sm" leadingIcon={<Settings2 className="h-4 w-4" />}>
            详情
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--border-default)] pt-5 md:grid-cols-4">
        <InfoItem label="最近活跃" value={bot.lastActive} icon={Clock3} />
        <InfoItem label="触发方式" value={bot.triggerMode} icon={Sparkles} />
        <InfoItem label="回复格式" value={bot.replyFormat} icon={MessageSquare} />
        <InfoItem label="状态信号" value={bot.enabled ? '当前已启用' : '当前已停用'} icon={ShieldCheck} />
      </div>
    </PressableCard>
  );
}

function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-[14px] text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function ActivityPanel({
  activeTab,
  onTabChange,
}: {
  activeTab: SideTab;
  onTabChange: (tab: SideTab) => void;
}) {
  const tabs: Array<{ id: SideTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'messages', label: '最近消息', icon: MessageSquare },
    { id: 'health', label: '连接健康', icon: Activity },
    { id: 'alerts', label: '告警日志', icon: AlertCircle },
  ];

  return (
    <PressableCard className="sticky top-8 overflow-hidden border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,244,0.92))] shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.96),rgba(18,18,18,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.28)]">
      <div className="border-b border-[var(--border-default)] px-5 py-4">
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">机器人活动面板</div>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">把用户最关心的健康和动态，压缩成右侧一块轻量运营面板。</p>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 rounded-[16px] bg-[var(--bg-hover)] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-[12px] font-medium transition',
                  active ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--text-secondary)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          {activeTab === 'messages'
            ? sideMessages.map((item) => (
                <div key={`${item.platform}-${item.time}`} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.user}</div>
                    <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-0.5 text-[11px] text-[var(--text-secondary)]">{item.platform}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.content}</p>
                  <div className="mt-2 text-[12px] text-[var(--text-muted)]">{item.time}</div>
                </div>
              ))
            : null}
          {activeTab === 'health'
            ? sideHealth.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        item.tone === 'success'
                          ? 'bg-emerald-500'
                          : item.tone === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-slate-400',
                      )}
                    />
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</div>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.detail}</p>
                </div>
              ))
            : null}
          {activeTab === 'alerts'
            ? sideAlerts.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.10)] px-4 py-3 dark:bg-[rgba(245,158,11,0.14)]">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.detail}</p>
                  <div className="mt-2 text-[12px] text-[var(--text-muted)]">{item.time}</div>
                </div>
              ))
            : null}
        </div>
      </div>
    </PressableCard>
  );
}

function PlatformCard({
  platform,
  configured,
  onClick,
}: {
  platform: IMPlatformMeta;
  configured: boolean;
  onClick: () => void;
}) {
  return (
    <PressableCard interactive onClick={onClick} className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.92))] px-5 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.96),rgba(17,17,17,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.30)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
          <img src={platform.logo} alt={platform.label} className="h-full w-full object-cover" />
        </div>
        {configured ? (
          <span className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[12px] font-medium text-[rgb(22,163,74)] dark:text-[#9af0c5]">
            已配置
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{platform.label}</div>
        <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">{platform.intro}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
        <MetaPill label="接入难度" value={platform.difficulty} />
        <MetaPill label="预计耗时" value={platform.eta} />
        <MetaPill label="管理员权限" value={platform.admin} />
      </div>
      <div className="mt-5">
        <Button variant={configured ? 'secondary' : 'primary'} size="sm" block leadingIcon={<Link2 className="h-4 w-4" />}>
          {configured ? '继续完善配置' : '开始接入'}
        </Button>
      </div>
    </PressableCard>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[var(--bg-hover)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function formatTriggerMode(value: IMBotDraft['triggerMode']): string {
  return value === 'mention' ? '@提及时响应' : value === 'keyword' ? '关键词触发' : '全部消息';
}

function formatReplyFormat(value: IMBotDraft['replyFormat']): string {
  return value === 'card' ? '卡片/富文本' : value === 'markdown' ? 'Markdown' : '纯文本';
}
