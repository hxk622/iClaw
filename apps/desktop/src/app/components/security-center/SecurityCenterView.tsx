import { useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  Check,
  FileText,
  Puzzle,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { ProtectionSignal } from '@/app/components/ui/ProtectionSignal';
import { SecurityStatusBadge } from '@/app/components/ui/SecurityStatusBadge';
import { StatCard } from '@/app/components/ui/StatCard';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type SecurityCardId =
  | 'hero'
  | 'prompt-injection'
  | 'audit-log'
  | 'skill-scan'
  | 'intent-monitor'
  | 'access-control';

type SecurityFeature = {
  id: Exclude<SecurityCardId, 'hero'>;
  title: string;
  description: string;
  icon: typeof FileText;
  wide?: boolean;
};

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    id: 'prompt-injection',
    title: '提示词注入检测',
    description: '识别隐藏指令、越狱尝试和恶意引导，降低模型被上下文污染的风险。',
    icon: FileText,
  },
  {
    id: 'audit-log',
    title: '安全审计日志',
    description: '完整记录关键交互与策略命中情况，方便后续审计与安全追溯。',
    icon: ScrollText,
  },
  {
    id: 'skill-scan',
    title: '技能安全检测',
    description: '对技能加载链路做静态扫描，检查权限越界、敏感信息暴露和危险调用。',
    icon: Puzzle,
  },
  {
    id: 'intent-monitor',
    title: '意图偏离监控',
    description: '监控输出与任务目标是否偏离，及时发现异常对话路径和恶意诱导。',
    icon: Target,
  },
  {
    id: 'access-control',
    title: '访问控制策略',
    description: '统一管理黑白名单、路径拦截、工具限制与不同运行环境的安全边界。',
    icon: SlidersHorizontal,
    wide: true,
  },
];

const INITIAL_SECURITY_STATE: Record<SecurityCardId, boolean> = {
  hero: true,
  'prompt-injection': true,
  'audit-log': true,
  'skill-scan': true,
  'intent-monitor': true,
  'access-control': true,
};

export function SecurityCenterView() {
  const [enabledState, setEnabledState] =
    useState<Record<SecurityCardId, boolean>>(INITIAL_SECURITY_STATE);

  const updateEnabledState = (id: SecurityCardId, next: boolean) => {
    setEnabledState((current) => ({ ...current, [id]: next }));
  };

  const enabledFeatureCount = useMemo(
    () => SECURITY_FEATURES.filter((feature) => enabledState[feature.id]).length,
    [enabledState],
  );
  const disabledFeatureCount = SECURITY_FEATURES.length - enabledFeatureCount;
  const protectionEnabled = enabledState.hero;

  return (
    <PageSurface as="div">
      <PageContent className="py-5">
        <PageHeader
          title="安全中心"
          description="统一管理 iClaw 的运行时防护、技能审计和访问控制策略，让安全模块和其它管理页面遵循同一套页面壳与交互规范。"
          className="gap-2.5"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em]"
          descriptionClassName="mt-0 text-[12px] leading-5"
        />

        <SurfacePanel tone="subtle" className="mt-3 rounded-[20px] p-1.5">
          <div className="flex flex-wrap gap-y-2">
            <SummaryMetricItem
              first
              tone={protectionEnabled ? 'success' : 'warning'}
              icon={Shield}
              label="主防线"
              value={protectionEnabled ? '开启' : '关闭'}
              note="一键实时防护统一控制整体策略"
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone="brand"
              icon={Check}
              label="启用模块"
              value={`${enabledFeatureCount}/${SECURITY_FEATURES.length}`}
              note="核心检测模块状态一眼可见"
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone={disabledFeatureCount > 0 ? 'warning' : 'neutral'}
              icon={SlidersHorizontal}
              label="待关注"
              value={disabledFeatureCount > 0 ? String(disabledFeatureCount) : '0'}
              note={disabledFeatureCount > 0 ? '存在关闭中的模块' : '所有模块均处于工作态'}
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone="neutral"
              icon={Target}
              label="策略模式"
              value="统一"
              note="安全策略与桌面端页面规范已统一收口"
              className="px-2 py-1"
            />
          </div>
        </SurfacePanel>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Shield className="h-5 w-5" />}
            label="实时防护"
            value={
              <SecurityStatusBadge
                state={protectionEnabled ? 'protecting' : 'disabled'}
                label={protectionEnabled ? '保护中' : '未开启'}
              />
            }
            description={protectionEnabled ? '已覆盖所有 AI 交互入口' : '建议恢复主防线'}
            tone={protectionEnabled ? 'success' : 'warning'}
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="审计追踪"
            value={<SecurityStatusBadge state={enabledState['audit-log'] ? 'enabled' : 'disabled'} />}
            description="保留关键交互与命中记录"
            tone={enabledState['audit-log'] ? 'brand' : 'default'}
          />
          <StatCard
            icon={<Puzzle className="h-5 w-5" />}
            label="技能扫描"
            value={enabledState['skill-scan'] ? '已覆盖' : '未覆盖'}
            description="检查技能导入与执行边界"
            tone={enabledState['skill-scan'] ? 'success' : 'warning'}
          />
          <StatCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            label="访问控制"
            value={enabledState['access-control'] ? '严格' : '宽松'}
            description="黑白名单和工具调用边界"
            tone={enabledState['access-control'] ? 'brand' : 'default'}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <SecurityHeroCard
              enabled={enabledState.hero}
              onToggle={(next) => updateEnabledState('hero', next)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-7">
            {SECURITY_FEATURES.slice(0, 4).map((feature) => (
              <SecurityFeatureCard
                key={feature.id}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                enabled={enabledState[feature.id]}
                onToggle={(next) => updateEnabledState(feature.id, next)}
              />
            ))}

            <SecurityFeatureCard
              title={SECURITY_FEATURES[4].title}
              description={SECURITY_FEATURES[4].description}
              icon={SECURITY_FEATURES[4].icon}
              enabled={enabledState['access-control']}
              onToggle={(next) => updateEnabledState('access-control', next)}
              wide
            />
          </div>
        </div>

        <SurfacePanel className="mt-4 rounded-[24px] p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <PolicyBlock
              title="默认策略"
              description="所有可交互模块统一走共享 hover、focus 与按钮视觉，不再在业务页分叉实现。"
              items={['共享按钮与卡片基础件', '危险调用最小权限', '审计日志全链路可追溯']}
            />
            <PolicyBlock
              title="重点防护面"
              description="当前主要覆盖对话输入、技能执行、配置修改和外部连接等高风险链路。"
              items={['提示词注入检测', '技能安全扫描', '访问控制边界']}
            />
            <PolicyBlock
              title="上线建议"
              description="正式环境建议保持主防线与审计日志开启，再按业务场景精细化调整其余策略。"
              items={['关闭模块需有明确原因', '变更后建议回归测试', '保留最小可追溯信息']}
            />
          </div>
        </SurfacePanel>
      </PageContent>
    </PageSurface>
  );
}

function PolicyBlock({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(74,107,90,0.10)] text-[var(--state-success)]">
              <Check className="h-3 w-3 stroke-[2.6]" />
            </span>
            <span className="text-[13px] text-[var(--text-secondary)]">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityHeroCard({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <PressableCard
      interactive
      onClick={() => onToggle(!enabled)}
      className={cn(
        'h-full min-h-[332px] rounded-[28px] p-6',
        enabled
          ? 'border-[var(--chip-brand-border-strong)] bg-[var(--bg-elevated)] shadow-[0_18px_38px_rgba(168,140,93,0.10)]'
          : 'border-[var(--border-default)] bg-[var(--bg-card)]',
      )}
      aria-label={`${enabled ? '关闭' : '开启'}一键实时防护`}
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start gap-4">
          <SecurityIconContainer accent={enabled}>
            {enabled ? (
              <ProtectionSignal size="md" tone="gold" />
            ) : (
              <Shield
                className={cn(
                  'h-6 w-6 stroke-[1.6]',
                  enabled ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]',
                )}
              />
            )}
          </SecurityIconContainer>

          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              一键实时防护
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              将运行时监控、异常识别与默认拦截策略统一切到保护态，适合作为全局默认安全开关。
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <SecurityToggle checked={enabled} onChange={onToggle} label="切换一键实时防护" />
            <SecurityStatusBadge state={enabled ? 'protecting' : 'disabled'} />
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            当前策略
          </div>
          <div className="mt-3 space-y-3">
            <SecurityCapabilityItem label="实时流量监控" enabled={enabled} />
            <SecurityCapabilityItem label="自动威胁识别" enabled={enabled} />
            <SecurityCapabilityItem label="智能拦截策略" enabled={enabled} />
          </div>
        </div>

        <div className="mt-auto rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-4">
          <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
            与其它桌面主页面一样，这里使用统一页框、统一统计条和统一交互反馈，避免安全页继续成为视觉孤岛。
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

function SecurityFeatureCard({
  title,
  description,
  icon: Icon,
  enabled,
  onToggle,
  wide = false,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  wide?: boolean;
}) {
  return (
    <PressableCard
      interactive
      onClick={() => onToggle(!enabled)}
      className={cn(
        'rounded-[28px] p-5',
        wide && 'md:col-span-2',
        !enabled && 'opacity-[0.94]',
      )}
      aria-label={`${enabled ? '关闭' : '开启'}${title}`}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-4">
          <SecurityIconContainer accent={enabled}>
            <Icon
              className={cn(
                'h-5 w-5 stroke-[1.8]',
                enabled ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]',
              )}
            />
          </SecurityIconContainer>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
          </div>
          <SecurityToggle checked={enabled} onChange={onToggle} label={`切换${title}`} />
        </div>

        <div className="mt-auto flex justify-end">
          <SecurityStatusBadge state={enabled ? 'enabled' : 'disabled'} />
        </div>
      </div>
    </PressableCard>
  );
}

function SecurityIconContainer({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border overflow-visible',
        accent
          ? 'border-[rgba(168,140,93,0.18)] bg-[rgba(168,140,93,0.10)]'
          : 'border-[var(--border-default)] bg-[var(--bg-hover)]',
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function SecurityCapabilityItem({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          enabled ? 'bg-[rgba(74,107,90,0.10)]' : 'bg-[rgba(154,146,136,0.10)]',
        )}
        aria-hidden="true"
      >
        <Check
          className={cn(
            'h-3 w-3 stroke-[2.6]',
            enabled ? 'text-[var(--state-success)]' : 'text-[var(--text-muted)]',
          )}
        />
      </span>
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

function SecurityToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={handleClick}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full border border-transparent',
        checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-default)]',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(18,15,11,0.14)] transition-transform duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
