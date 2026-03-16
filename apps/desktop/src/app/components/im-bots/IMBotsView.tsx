import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  Clock3,
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
    logoClassName: 'scale-[1.3]',
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

const initialBots: ManagedBot[] = [];

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

  const runningCount = useMemo(
    () => bots.filter((item) => item.enabled && item.status === 'running').length,
    [bots],
  );

  const warningCount = useMemo(
    () => bots.filter((item) => item.status === 'warning' || item.status === 'paused').length,
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
        note: bots.length > 0 ? '当前展示的都是已真实创建的机器人实例。' : '当前还没有机器人，先从下方平台卡片开始接入。',
        icon: Bot,
        tone: 'brand',
      },
      {
        label: '当前运行中',
        value: String(runningCount),
        note: runningCount > 0 ? '已启用且状态正常的机器人会显示在这里。' : '接入完成并启用后，这里会显示运行中的机器人数量。',
        icon: Power,
        tone: runningCount > 0 ? 'success' : 'neutral',
      },
      {
        label: '已接入平台',
        value: String(configuredPlatforms.size),
        note: configuredPlatforms.size > 0 ? '平台与机器人实例会按真实配置关系自动归类。' : '目前还没有任何平台完成接入。',
        icon: Link2,
        tone: configuredPlatforms.size > 0 ? 'success' : 'neutral',
      },
      {
        label: '待关注项',
        value: String(warningCount),
        note: warningCount > 0 ? '这里会集中显示需要留意的机器人状态。' : '当前没有需要关注的机器人告警。',
        icon: AlertCircle,
        tone: warningCount > 0 ? 'warning' : 'neutral',
      },
    ],
    [bots.length, configuredPlatforms.size, runningCount, warningCount],
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
          company: '待完善',
          assistant: '默认助手待配置',
          status: 'running',
          enabled: true,
          lastActive: '刚刚',
          healthSummary: '接入刚完成，最近一次测试通过。后续可进入详情页继续完善名称、助手和策略。',
          triggerMode: formatTriggerMode(draft.triggerMode),
          replyFormat: formatReplyFormat(draft.replyFormat),
        },
      ];
    });
  };

  return (
    <div className="flex flex-1 overflow-y-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-full max-w-[1440px] px-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">IM Robot Workspace</div>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">IM机器人</h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[var(--text-secondary)]">
              将 OpenClaw 接入企业常用办公 IM，并统一管理机器人状态。这个视图区默认按“已创建机器人 + 平台接入卡片”的产品化路径组织。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" leadingIcon={<AlertCircle className="h-4 w-4" />} disabled={warningCount === 0}>
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

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_340px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">已创建的机器人</div>
                <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">通常一屏就能看全所有机器人，不需要复杂的后台表格。</p>
              </div>
            </div>
            {bots.length > 0 ? (
              bots.map((bot) => {
                const meta = platformMetaList.find((item) => item.id === bot.platformId)!;
                return <ManagedBotCard key={bot.id} bot={bot} meta={meta} />;
              })
            ) : (
              <EmptyBotState onCreate={() => setSelectedPlatformId('feishu')} />
            )}
          </div>

          <ActivityPanel
            activeTab={activeSideTab}
            onTabChange={setActiveSideTab}
            bots={bots}
          />
        </div>

        <div className="relative my-8">
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

          <div className="mt-5 grid gap-3 md:grid-cols-2">
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
    <PressableCard className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,244,0.90))] px-4 py-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.96),rgba(18,18,18,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
          <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">{value}</div>
          <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">{note}</p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-[18px]', toneClassName)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </PressableCard>
  );
}

function EmptyBotState({ onCreate }: { onCreate: () => void }) {
  return (
    <PressableCard className="border-dashed border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,247,244,0.88))] px-6 py-8 dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.92),rgba(18,18,18,0.92))]">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[640px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]">
            <Bot className="h-7 w-7" />
          </div>
          <div className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">还没有已创建的机器人</div>
          <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
            这里不再展示 mock 示例。完成任一平台接入后，新的机器人会真实出现在这个区域，后续你可以继续做助手绑定、启停和测试连通。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" leadingIcon={<Link2 className="h-4 w-4" />} onClick={onCreate}>
            从飞书开始接入
          </Button>
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
    <PressableCard className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.90))] px-5 py-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.96),rgba(17,17,17,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.30)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={meta.logo} alt={meta.label} className={cn('h-full w-full object-cover', meta.logoClassName)} />
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
  bots,
}: {
  activeTab: SideTab;
  onTabChange: (tab: SideTab) => void;
  bots: ManagedBot[];
}) {
  const healthItems = bots.map((bot) => ({
    title: bot.name,
    detail: bot.healthSummary,
    tone: (bot.status === 'running' ? 'success' : bot.status === 'warning' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral',
  }));

  const alertItems = bots
    .filter((bot) => bot.status === 'warning' || bot.status === 'paused')
    .map((bot) => ({
      title: bot.name,
      detail: bot.healthSummary,
      time: bot.lastActive,
    }));

  const tabs: Array<{ id: SideTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'messages', label: '最近消息', icon: MessageSquare },
    { id: 'health', label: '连接健康', icon: Activity },
    { id: 'alerts', label: '告警日志', icon: AlertCircle },
  ];

  return (
    <PressableCard className="sticky top-6 overflow-hidden border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,244,0.92))] shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.96),rgba(18,18,18,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.28)]">
      <div className="border-b border-[var(--border-default)] px-5 py-4">
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">机器人活动面板</div>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">这里只展示真实接入后的状态，不再填充示例消息和伪造日志。</p>
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
            ? bots.length > 0
              ? (
                <EmptyPanelState
                  title="最近消息暂未接入展示"
                  description="后续接通真实消息日志后，这里会显示最新的用户消息和来源平台。"
                />
              )
              : (
                <EmptyPanelState
                  title="还没有消息动态"
                  description="先完成任一平台接入，后续这里再接入真实消息和流量表现。"
                />
              )
            : null}
          {activeTab === 'health'
            ? healthItems.length > 0
              ? healthItems.map((item) => (
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
              : (
                <EmptyPanelState
                  title="还没有连接健康信息"
                  description="完成平台接入并创建机器人后，这里会显示真实的连接状态和健康摘要。"
                />
              )
            : null}
          {activeTab === 'alerts'
            ? alertItems.length > 0
              ? alertItems.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.10)] px-4 py-3 dark:bg-[rgba(245,158,11,0.14)]">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.detail}</p>
                  <div className="mt-2 text-[12px] text-[var(--text-muted)]">{item.time}</div>
                </div>
              ))
              : (
                <EmptyPanelState
                  title="当前没有告警日志"
                  description="当机器人出现异常待关注状态时，这里会集中展示需要处理的项目。"
                />
              )
            : null}
        </div>
      </div>
    </PressableCard>
  );
}

function EmptyPanelState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-5">
      <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
    </div>
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
    <PressableCard interactive onClick={onClick} className="border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.92))] px-5 py-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.96),rgba(17,17,17,0.94))] dark:shadow-[0_22px_38px_rgba(0,0,0,0.30)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={platform.logo} alt={platform.label} className={cn('h-full w-full object-cover', platform.logoClassName)} />
          </div>
          <div className="min-w-0">
            <div className="text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{platform.label}</div>
            <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{platform.intro}</p>
          </div>
        </div>
        {configured ? (
          <span className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[12px] font-medium text-[rgb(22,163,74)] dark:text-[#9af0c5]">
            已配置
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
        <MetaPill label="接入难度" value={platform.difficulty} />
        <MetaPill label="预计耗时" value={platform.eta} />
        <MetaPill label="管理员权限" value={platform.admin} />
      </div>
      <div className="mt-4">
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
