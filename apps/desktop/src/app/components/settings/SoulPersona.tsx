import { useSettings } from '@/app/contexts/settings-context';
import { pushAppNotification } from '@/app/lib/task-notifications';
import { SettingsHelperCard } from '@/app/components/settings/ui/SettingsHelperCard';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';
import {
  soulTemplateGroups,
  type SettingsMarkdownTemplate,
} from '@/app/components/settings/markdown-template-catalog';
import { SettingsTemplateLibrary } from '@/app/components/settings/ui/SettingsTemplateLibrary';

const presets = [
  { label: '专业分析型', desc: '高密度信息、数据驱动' },
  { label: '冷静克制型', desc: '理性客观、风险意识强' },
  { label: '高信息密度型', desc: '简洁高效、要点突出' },
  { label: '亲切陪伴型', desc: '适度亲和、易于理解' },
];

export function SoulPersona() {
  const { settings, updateSoulPersona } = useSettings();
  const { soulPersona, workspaceDir, isLoading } = settings;

  const handleApplyTemplate = (template: SettingsMarkdownTemplate, mode: 'replace' | 'append') => {
    const nextValue =
      mode === 'replace'
        ? template.content
        : [soulPersona.markdownContent.trim(), template.content].filter(Boolean).join('\n\n');
    updateSoulPersona({ markdownContent: nextValue });
    pushAppNotification({
      tone: 'success',
      title: mode === 'replace' ? '人格模板已应用' : '人格模板已追加',
      text: `已${mode === 'replace' ? '应用' : '追加'}「${template.title}」到 Soul.md。`,
    });
  };

  return (
    <SettingsMarkdownPage
      title="人格配置"
      fileName="Soul.md"
      description="配置 AI 的人格特征、语气风格、价值观边界与默认表达策略"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/Soul.md`}
      syncLabel="1分钟前同步"
      value={soulPersona.markdownContent}
      placeholder="输入人格配置内容..."
      onChange={(value) => updateSoulPersona({ markdownContent: value })}
      disabled={isLoading}
    >
      <div className="space-y-4">
        <SettingsTemplateLibrary
          title="人格模板库"
          description="提供风格和场景两类预设，可快速定义 Soul.md 的默认表达与边界。"
          groups={soulTemplateGroups}
          onApplyTemplate={handleApplyTemplate}
        />

        <div>
          <div className="mb-3 text-[12px] text-[var(--text-secondary)]">人格预设提示</div>
          <div className="grid grid-cols-2 gap-3">
            {presets.map((preset) => (
              <SettingsHelperCard key={preset.label} title={preset.label} description={preset.desc} tone="accent" />
            ))}
          </div>
        </div>
      </div>
    </SettingsMarkdownPage>
  );
}
