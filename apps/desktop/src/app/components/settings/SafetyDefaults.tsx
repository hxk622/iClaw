import type { ReactNode } from 'react';
import { AlertTriangle, Check, Shield } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { CompactSegmentedControl } from '@/app/components/ui/CompactSegmentedControl';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';
import { SettingsChoiceCard } from '@/app/components/settings/ui/SettingsChoiceCard';
import { SettingsSwitch } from '@/app/components/settings/ui/SettingsSwitch';

const runModeOptions = [
  { value: 'deny' as const, label: '安全模式', description: '最严格的权限控制' },
  {
    value: 'ask' as const,
    label: '标准模式',
    description: '平衡安全与功能',
    recommended: true,
  },
  { value: 'allow' as const, label: '高级模式', description: '开放更多权限' },
];

const networkAccessOptions = [
  { value: '严格', label: '禁止访问' },
  { value: '适中', label: '限制访问' },
  { value: '宽松', label: '完全开放' },
];

const fileScopeOptions = [
  { value: '仅工作区', label: '仅工作区' },
  { value: '用户目录', label: '文档目录' },
  { value: '不限制', label: '系统范围' },
];

const failureStrategyOptions = [
  { value: '重试', label: '立即停止' },
  { value: '跳过', label: '跳过继续' },
  { value: '优雅降级', label: '降级处理' },
];

const runModeLabelMap = {
  deny: '安全模式',
  ask: '标准模式',
  allow: '高级模式',
} as const;

const networkLabelMap = {
  严格: '禁止访问',
  适中: '限制访问',
  宽松: '完全开放',
} as const;

const fileScopeLabelMap = {
  仅工作区: '仅工作区',
  用户目录: '文档目录',
  不限制: '系统范围',
} as const;

const failureLabelMap = {
  重试: '立即停止',
  跳过: '跳过继续',
  优雅降级: '降级处理',
} as const;

export function SafetyDefaults() {
  const { settings, updateSafetyDefaults } = useSettings();
  const { safetyDefaults } = settings;

  const currentRunModeLabel = runModeLabelMap[safetyDefaults.systemRunMode];
  const currentNetworkLabel = networkLabelMap[safetyDefaults.networkAccessPolicy as keyof typeof networkLabelMap] ?? safetyDefaults.networkAccessPolicy;
  const currentFileScopeLabel = fileScopeLabelMap[safetyDefaults.fileAccessScope as keyof typeof fileScopeLabelMap] ?? safetyDefaults.fileAccessScope;
  const currentFailureLabel =
    failureLabelMap[safetyDefaults.toolFallbackPolicy as keyof typeof failureLabelMap] ?? safetyDefaults.toolFallbackPolicy;

  return (
    <div className="max-w-[680px] space-y-8">
      <div className="mb-8">
        <h1 className="mb-2 text-[22px] font-medium tracking-tight text-[var(--text-primary)]">安全策略</h1>
        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
          管理系统运行模式、权限边界、网络访问与失败回退策略
        </p>
      </div>

      <section className="space-y-4">
        <SectionTitle title="系统运行模式" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {runModeOptions.map((option) => (
            <SettingsChoiceCard
              key={option.value}
              title={option.label}
              description={option.description}
              active={safetyDefaults.systemRunMode === option.value}
              align="left"
              onClick={() => updateSafetyDefaults({ systemRunMode: option.value })}
              selectedIndicator={<Check className="h-2.5 w-2.5" />}
              selectedIndicatorPlacement="bottom-right"
              floatingBadge={option.recommended ? <SettingsBadge tone="gold">推荐</SettingsBadge> : undefined}
              className="min-h-[124px] rounded-xl p-4"
              descriptionClassName="leading-5"
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="危险操作确认" />
        <SettingsCard className="rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={
                  safetyDefaults.dangerousActionConfirmation
                    ? 'mt-0.5 h-5 w-5 text-[var(--state-warning)]'
                    : 'mt-0.5 h-5 w-5 text-[var(--text-muted)]'
                }
              />
              <div>
                <div className="mb-1 text-[13px] font-medium text-[var(--text-primary)]">
                  执行危险操作前需要二次确认
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  包括删除文件、修改系统配置、网络请求等
                </div>
              </div>
            </div>
            <SettingsSwitch
              checked={safetyDefaults.dangerousActionConfirmation}
              onChange={(checked) => updateSafetyDefaults({ dangerousActionConfirmation: checked })}
            />
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <SectionTitle title="网络访问策略" />
        <CompactSegmentedControl
          value={safetyDefaults.networkAccessPolicy}
          options={networkAccessOptions}
          onChange={(value) => updateSafetyDefaults({ networkAccessPolicy: value })}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle title="文件访问范围" />
        <CompactSegmentedControl
          value={safetyDefaults.fileAccessScope}
          options={fileScopeOptions}
          onChange={(value) => updateSafetyDefaults({ fileAccessScope: value })}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle title="工具失败回退策略" />
        <CompactSegmentedControl
          value={safetyDefaults.toolFallbackPolicy}
          options={failureStrategyOptions}
          onChange={(value) => updateSafetyDefaults({ toolFallbackPolicy: value })}
        />
      </section>

      <SettingsCard className="rounded-xl p-5">
        <div className="mb-4 flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-[var(--brand-primary)]" />
          <div>
            <h3 className="mb-1 text-[14px] font-medium text-[var(--text-primary)]">当前生效边界摘要</h3>
            <div className="text-[11px] text-[var(--text-muted)]">基于上述配置，当前系统安全边界如下</div>
          </div>
        </div>

        <div className="space-y-2 pl-8 text-[12px] text-[var(--text-secondary)]">
          <SummaryItem>
            运行模式：{currentRunModeLabel}，{safetyDefaults.dangerousActionConfirmation ? '需要' : '无需'}危险操作二次确认
          </SummaryItem>
          <SummaryItem>网络权限：{currentNetworkLabel}</SummaryItem>
          <SummaryItem>文件范围：仅限 {currentFileScopeLabel} 访问</SummaryItem>
          <SummaryItem>失败策略：工具失败时采用 {currentFailureLabel}</SummaryItem>
        </div>
      </SettingsCard>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-[14px] font-medium text-[var(--text-primary)]">{title}</h2>;
}

function SummaryItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 text-[var(--brand-primary)]">•</span>
      <span>{children}</span>
    </div>
  );
}
