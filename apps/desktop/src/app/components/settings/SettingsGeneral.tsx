import { Check, FileText, Monitor, Moon, Sun } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import {
  type ContentFontSize,
  type GeneralLanguage,
  type LayoutPreset,
  type MessageAlignment,
} from '@/app/lib/general-preferences';
import { CompactSegmentedControl } from '@/app/components/ui/CompactSegmentedControl';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';
import { SettingsChoiceCard } from '@/app/components/settings/ui/SettingsChoiceCard';
import { ToolCardThemeSelector } from '@/app/components/settings/ToolCardThemeSelector';
import type { ThemeMode } from '@/app/lib/theme';
import { cn } from '@/app/lib/cn';

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: '浅色', description: '明亮清晰的界面', icon: Sun },
  { value: 'dark', label: '深色', description: '护眼深色主题', icon: Moon },
  { value: 'system', label: '跟随系统', description: '自动切换主题', icon: Monitor },
];

const fontSizeOptions: Array<{ value: ContentFontSize; label: string }> = [
  { value: 'small', label: '12px' },
  { value: 'medium', label: '14px' },
  { value: 'large', label: '16px' },
  { value: 'xlarge', label: '18px' },
];

const languageOptions: Array<{ value: GeneralLanguage; label: string }> = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
];

const layoutPresetOptions: Array<{ value: LayoutPreset; label: string }> = [
  { value: 'standard', label: '标准' },
  { value: 'compact', label: '紧凑' },
  { value: 'column', label: '分栏' },
];

const messageAlignmentOptions: Array<{ value: MessageAlignment; label: string }> = [
  { value: 'left', label: '全部左侧' },
  { value: 'sided', label: '用户右侧 / AI 左侧' },
];

const SETTINGS_SEGMENTED_WRAPPER_CLASS =
  'rounded-lg border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_70%,transparent)] p-1 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]';
const SETTINGS_SEGMENTED_ITEM_CLASS = 'min-h-0 rounded-md px-5 py-2.5 text-[13px] font-medium';
const SETTINGS_SEGMENTED_ACTIVE_CLASS =
  'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.08)]';
const SETTINGS_SEGMENTED_INACTIVE_CLASS = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]';

export function SettingsGeneral() {
  const { settings, updateGeneral } = useSettings();
  const workspaceRoot = settings.workspaceDir || '~/Documents/iClaw/workspace';

  return (
    <div className="max-w-[680px] space-y-8">
      <header className="space-y-2">
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">通用设置</h1>
        <p className="text-[15px] leading-7 text-[var(--text-secondary)]">
          配置界面主题、工具卡片风格、阅读体验、聊天布局与工作区映射
        </p>
      </header>

      <section className="space-y-4">
        <SectionTitle title="界面风格" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {themeOptions.map((option) => (
            <SettingsChoiceCard
              key={option.value}
              title={option.label}
              description={option.description}
              icon={option.icon}
              active={settings.general.themeMode === option.value}
              onClick={() => updateGeneral({ themeMode: option.value })}
              selectedIndicator={<Check className="h-3.5 w-3.5" />}
              className="min-h-[148px] rounded-[18px] p-4"
              iconWrapperClassName="mb-3 h-10 w-10 rounded-[12px]"
              descriptionClassName="leading-5"
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="风格主题" />
        <div className="space-y-2">
          <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
            选择一套工具卡片风格主题。浅色和深色会自动适配为同一组风格，不需要分别配置。
          </div>
          <ToolCardThemeSelector
            value={settings.general.toolCardTone}
            onChange={(toolCardTone) => updateGeneral({ toolCardTone })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="内容字号" />
        <CompactSegmentedControl
          value={settings.general.contentFontSize}
          options={fontSizeOptions}
          onChange={(value) => updateGeneral({ contentFontSize: value })}
          className={SETTINGS_SEGMENTED_WRAPPER_CLASS}
          itemClassName={SETTINGS_SEGMENTED_ITEM_CLASS}
          activeItemClassName={SETTINGS_SEGMENTED_ACTIVE_CLASS}
          inactiveItemClassName={SETTINGS_SEGMENTED_INACTIVE_CLASS}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle title="语言" />
        <CompactSegmentedControl
          value={settings.general.language}
          options={languageOptions}
          onChange={(value) => updateGeneral({ language: value })}
          className={SETTINGS_SEGMENTED_WRAPPER_CLASS}
          itemClassName={SETTINGS_SEGMENTED_ITEM_CLASS}
          activeItemClassName={SETTINGS_SEGMENTED_ACTIVE_CLASS}
          inactiveItemClassName={SETTINGS_SEGMENTED_INACTIVE_CLASS}
        />
      </section>

      <section className="space-y-5">
        <SectionTitle title="聊天布局" />

        <div className="space-y-3">
          <SubsectionLabel label="布局预设" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {layoutPresetOptions.map((option) => {
              const active = settings.general.layoutPreset === option.value;
              return (
                <SettingsChoiceCard
                  key={option.value}
                  title={option.label}
                  active={active}
                  onClick={() => updateGeneral({ layoutPreset: option.value })}
                  illustration={<LayoutPresetPreview preset={option.value} active={active} />}
                  className="rounded-[16px] px-4 py-3"
                  iconWrapperClassName="mb-2 h-12 w-full rounded-[10px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_72%,transparent)] p-2"
                  titleClassName="text-[12px]"
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <SubsectionLabel label="消息对齐" />
          <CompactSegmentedControl
            value={settings.general.messageAlignment}
            options={messageAlignmentOptions}
            onChange={(value) => updateGeneral({ messageAlignment: value })}
            className={SETTINGS_SEGMENTED_WRAPPER_CLASS}
            itemClassName={SETTINGS_SEGMENTED_ITEM_CLASS}
            activeItemClassName={SETTINGS_SEGMENTED_ACTIVE_CLASS}
            inactiveItemClassName={SETTINGS_SEGMENTED_INACTIVE_CLASS}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="工作区文件" />
        <SettingsCard className="rounded-[16px] p-5">
          <div className="space-y-4">
            <div className="text-[12px] text-[var(--text-secondary)]">{workspaceRoot}</div>

            <div className="space-y-3">
              {[
                { name: 'Identity.md', description: '身份信息配置文件' },
                { name: 'User.md', description: '用户画像配置文件' },
                { name: 'Soul.md', description: '人格系统配置文件' },
              ].map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{file.name}</div>
                      <div className="text-[12px] text-[var(--text-secondary)]">{file.description}</div>
                    </div>
                  </div>
                  <SettingsBadge tone="blue">本地文件</SettingsBadge>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border-default)] pt-3">
              <p className="text-[12px] text-[var(--text-secondary)]">保存后将直接覆盖本地工作区文件</p>
            </div>
          </div>
        </SettingsCard>
      </section>

    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2>;
}

function SubsectionLabel({ label }: { label: string }) {
  return <div className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</div>;
}

function LayoutPresetPreview({ preset, active }: { preset: LayoutPreset; active: boolean }) {
  const chromeClassName = active ? 'bg-[var(--brand-primary)]/35' : 'bg-[var(--text-muted)]/30';
  const panelClassName = active
    ? 'border-[color:color-mix(in_srgb,var(--brand-primary)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,var(--bg-card))]'
    : 'border-[var(--border-default)] bg-[var(--bg-card)]';

  if (preset === 'column') {
    return (
      <div className="flex h-full w-full gap-1.5">
        <div className={cn('h-full flex-1 rounded-[6px] border', panelClassName)} />
        <div className={cn('h-full w-[36%] rounded-[6px] border', panelClassName)} />
      </div>
    );
  }

  const lineHeightClassName = preset === 'compact' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      <div className={cn('w-2/5 rounded-full', lineHeightClassName, chromeClassName)} />
      <div className={cn('w-full rounded-[6px] border', preset === 'compact' ? 'h-4' : 'h-5', panelClassName)} />
      <div className={cn('w-4/5 rounded-full', lineHeightClassName, chromeClassName)} />
    </div>
  );
}
