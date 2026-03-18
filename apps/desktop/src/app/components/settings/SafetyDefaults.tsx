import { AlertTriangle, FolderOpen, Globe, RotateCcw, Shield } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';
import { SettingsChoiceCard } from '@/app/components/settings/ui/SettingsChoiceCard';
import { SettingsPageHeader } from '@/app/components/settings/ui/SettingsPageHeader';
import { SettingsSectionHeader } from '@/app/components/settings/ui/SettingsSectionHeader';
import { SettingsSegmentedControl } from '@/app/components/settings/ui/SettingsSegmentedControl';
import { SettingsSwitch } from '@/app/components/settings/ui/SettingsSwitch';

export function SafetyDefaults() {
  const { settings, updateSafetyDefaults } = useSettings();
  const { safetyDefaults } = settings;

  return (
    <div className="max-w-4xl space-y-8">
      <SettingsPageHeader
        title="安全策略"
        description="配置系统运行模式、访问权限和风险边界"
      />

      <section className="space-y-4">
        <SettingsSectionHeader title="系统运行模式" description="定义系统如何处理敏感操作请求" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              value: 'ask' as const,
              label: '询问',
              description: '每次操作前征询确认',
              badge: '推荐',
              badgeTone: 'gold' as const,
            },
            {
              value: 'allow' as const,
              label: '自动允许',
              description: '自动执行所有操作',
              badge: '风险',
              badgeTone: 'red' as const,
            },
            {
              value: 'deny' as const,
              label: '自动拒绝',
              description: '拒绝所有敏感操作',
              badge: '保守',
              badgeTone: 'blue' as const,
            },
          ].map((option) => (
            <SettingsChoiceCard
              key={option.value}
              title={option.label}
              description={option.description}
              active={safetyDefaults.systemRunMode === option.value}
              badge={option.badge}
              badgeTone={option.badgeTone}
              onClick={() => updateSafetyDefaults({ systemRunMode: option.value })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SettingsSectionHeader title="危险操作确认" description="对高风险操作启用二次确认" />
        <SettingsCard>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[rgba(239,68,68,0.10)]">
                <AlertTriangle className="h-5 w-5 text-[var(--state-error)]" />
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">启用危险操作确认</div>
                <div className="text-xs text-[var(--text-secondary)]">删除、覆盖等操作需要额外确认</div>
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
        <SettingsSectionHeader title="网络访问策略" description="控制系统的网络请求权限" />
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
              <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
              <div className="flex-1 text-sm font-medium text-[var(--text-primary)]">网络访问级别</div>
              <SettingsBadge
                tone={
                  safetyDefaults.networkAccessPolicy === '严格'
                    ? 'blue'
                    : safetyDefaults.networkAccessPolicy === '适中'
                      ? 'gold'
                      : 'red'
                }
              >
                {safetyDefaults.networkAccessPolicy}
              </SettingsBadge>
            </div>
            <SettingsSegmentedControl
              value={safetyDefaults.networkAccessPolicy}
              options={[
                { value: '严格', label: '严格' },
                { value: '适中', label: '适中' },
                { value: '宽松', label: '宽松' },
              ]}
              onChange={(value) => updateSafetyDefaults({ networkAccessPolicy: value })}
            />
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <SettingsSectionHeader title="文件访问范围" description="限制系统可以访问的文件范围" />
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
              <FolderOpen className="h-5 w-5 text-[var(--text-secondary)]" />
              <div className="flex-1 text-sm font-medium text-[var(--text-primary)]">文件访问级别</div>
              <SettingsBadge
                tone={
                  safetyDefaults.fileAccessScope === '仅工作区'
                    ? 'blue'
                    : safetyDefaults.fileAccessScope === '用户目录'
                      ? 'gold'
                      : 'red'
                }
              >
                {safetyDefaults.fileAccessScope}
              </SettingsBadge>
            </div>
            <SettingsSegmentedControl
              value={safetyDefaults.fileAccessScope}
              options={[
                { value: '仅工作区', label: '仅工作区' },
                { value: '用户目录', label: '用户目录' },
                { value: '不限制', label: '不限制' },
              ]}
              onChange={(value) => updateSafetyDefaults({ fileAccessScope: value })}
            />
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <SettingsSectionHeader title="工具失败回退策略" description="当工具调用失败时的处理方式" />
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
              <RotateCcw className="h-5 w-5 text-[var(--text-secondary)]" />
              <div className="flex-1 text-sm font-medium text-[var(--text-primary)]">失败处理方式</div>
            </div>
            <SettingsSegmentedControl
              value={safetyDefaults.toolFallbackPolicy}
              options={[
                { value: '重试', label: '重试' },
                { value: '跳过', label: '跳过' },
                { value: '优雅降级', label: '降级' },
              ]}
              onChange={(value) => updateSafetyDefaults({ toolFallbackPolicy: value })}
            />
          </div>
        </SettingsCard>
      </section>

      <SettingsCard className="border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.04)]">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-[var(--state-error)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">当前生效边界摘要</div>
            <p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
              当前系统运行模式为“{safetyDefaults.systemRunMode === 'ask' ? '询问' : safetyDefaults.systemRunMode === 'allow' ? '自动允许' : '自动拒绝'}”，
              网络访问“{safetyDefaults.networkAccessPolicy}”，文件访问“{safetyDefaults.fileAccessScope}”，失败回退“{safetyDefaults.toolFallbackPolicy}”。
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
