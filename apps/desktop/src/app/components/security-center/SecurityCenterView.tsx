import { useState } from 'react';
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
import { PressableCard } from '@/app/components/ui/PressableCard';
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
    description:
      '基于深度语义分析的提示词注入攻击检测，识别隐藏指令、越狱尝试、恶意引导等多种攻击模式。',
    icon: FileText,
  },
  {
    id: 'audit-log',
    title: '安全审计日志',
    description:
      '完整记录所有 AI 交互行为，支持多维度检索与分析，满足合规审计与安全溯源需求。',
    icon: ScrollText,
  },
  {
    id: 'skill-scan',
    title: '技能安全检测',
    description:
      '对 AI Bot 加载的技能/插件进行安全扫描，检测权限越界、数据泄露、恶意调用等风险。',
    icon: Puzzle,
  },
  {
    id: 'intent-monitor',
    title: '意图偏离监控',
    description:
      '实时分析 AI 响应是否偏离预期行为，检测上下文污染与恶意引导，确保 AI 始终在安全边界内运行。',
    icon: Target,
  },
  {
    id: 'access-control',
    title: '访问控制策略',
    description:
      '灵活配置黑白名单、路径拦截、工具调用限制等访问控制规则，精细化管理 AI Bot 的能力边界。',
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

  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-[var(--bg-page)]">
      <div className="mx-auto flex w-full max-w-[980px] flex-col px-8 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <SecurityHeroCard
                enabled={enabledState.hero}
                onToggle={(next) => updateEnabledState('hero', next)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:col-span-7">
              {SECURITY_FEATURES.slice(0, 2).map((feature) => (
                <SecurityFeatureCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  enabled={enabledState[feature.id]}
                  onToggle={(next) => updateEnabledState(feature.id, next)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {SECURITY_FEATURES.slice(2, 4).map((feature) => (
              <SecurityFeatureCard
                key={feature.id}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                enabled={enabledState[feature.id]}
                onToggle={(next) => updateEnabledState(feature.id, next)}
              />
            ))}
          </div>

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
        'h-full min-h-[322px] border-[var(--brand-primary)] bg-[var(--bg-elevated)] p-6 shadow-[0_12px_26px_rgba(168,140,93,0.10)] hover:border-[var(--brand-primary-hover)] hover:bg-[var(--bg-elevated)] hover:shadow-[0_18px_34px_rgba(168,140,93,0.14)]',
        !enabled &&
          'border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--pressable-card-rest-shadow)] hover:border-[var(--border-strong)] hover:shadow-[var(--pressable-card-hover-shadow)]',
      )}
      aria-label={`${enabled ? '关闭' : '开启'}一键实时防护`}
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start gap-4">
          <SecurityIconContainer accent={enabled}>
            <Shield
              className={cn(
                'h-6 w-6 stroke-[1.6]',
                enabled ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]',
              )}
            />
          </SecurityIconContainer>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              一键实时防护
            </h2>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <SecurityToggle checked={enabled} onChange={onToggle} label="切换一键实时防护" />
            <SecurityStatusPill enabled={enabled} protecting />
          </div>
        </div>

        <p className="text-[14px] leading-7 text-[var(--text-secondary)]">
          单击开启全面防护模式，实时监控所有 AI Bot 交互，自动拦截可疑请求，零配置即刻生效。
        </p>

        <div className="h-px bg-[var(--border-default)]" />

        <div className="mt-auto space-y-3">
          <SecurityCapabilityItem label="实时流量监控" enabled={enabled} />
          <SecurityCapabilityItem label="自动威胁识别" enabled={enabled} />
          <SecurityCapabilityItem label="智能拦截策略" enabled={enabled} />
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
        'p-6',
        wide ? 'min-h-[184px]' : 'min-h-[228px]',
        !enabled && 'opacity-[0.92]',
      )}
      aria-label={`${enabled ? '关闭' : '开启'}${title}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-4">
          <SecurityIconContainer>
            <Icon
              className={cn(
                'h-6 w-6 stroke-[1.6]',
                enabled ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
              )}
            />
          </SecurityIconContainer>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {title}
            </h3>
          </div>

          <SecurityToggle checked={enabled} onChange={onToggle} label={`切换${title}`} />
        </div>

        <p className="mt-4 text-[14px] leading-7 text-[var(--text-secondary)]">{description}</p>

        <div className="mt-auto flex justify-end pt-5">
          <SecurityStatusPill enabled={enabled} />
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
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border',
        accent
          ? 'border-[rgba(168,140,93,0.18)] bg-[rgba(168,140,93,0.10)]'
          : 'border-[rgba(107,101,93,0.08)] bg-[var(--bg-hover)]',
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function SecurityStatusPill({
  enabled,
  protecting = false,
}: {
  enabled: boolean;
  protecting?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium leading-none',
        enabled
          ? 'border-[rgba(74,107,90,0.16)] bg-[rgba(74,107,90,0.10)] text-[var(--state-success)]'
          : 'border-[rgba(154,146,136,0.16)] bg-[rgba(154,146,136,0.10)] text-[var(--text-muted)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          enabled ? 'bg-[var(--state-success)]' : 'bg-[var(--text-muted)]',
        )}
        aria-hidden="true"
      />
      {enabled ? (protecting ? '保护中' : '已开启') : '已关闭'}
    </span>
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
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
          enabled ? 'bg-[rgba(74,107,90,0.10)]' : 'bg-[rgba(154,146,136,0.10)]',
        )}
        aria-hidden="true"
      >
        <Check
          className={cn(
            'h-2.5 w-2.5 stroke-[2.6]',
            enabled ? 'text-[var(--state-success)]' : 'text-[var(--text-muted)]',
          )}
        />
      </span>
      <span className="text-[14px] leading-7 text-[var(--text-secondary)]">{label}</span>
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
