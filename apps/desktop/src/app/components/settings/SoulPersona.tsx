import { useSettings } from '@/app/contexts/settings-context';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';

export function SoulPersona() {
  const { settings, updateSoulPersona } = useSettings();
  const { soulPersona, workspaceDir, isLoading } = settings;

  return (
    <SettingsMarkdownPage
      title="人格配置"
      fileName="Soul.md"
      description="定义行为边界、语气、风格约束"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/SOUL.md`}
      value={soulPersona.markdownContent}
      placeholder="在此编辑人格配置..."
      help="保存后将直接覆盖本地工作区文件"
      badges={[
        { label: '本地文件', tone: 'blue' },
        { label: '已同步', tone: 'green' },
      ]}
      headerExtra={<SettingsBadge tone="gold">私密文件</SettingsBadge>}
      onChange={(value) => updateSoulPersona({ markdownContent: value })}
      disabled={isLoading}
    />
  );
}
