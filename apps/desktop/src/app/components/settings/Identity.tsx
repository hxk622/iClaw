import { useSettings } from '@/app/contexts/settings-context';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';

export function Identity() {
  const { settings, updateIdentity } = useSettings();
  const { identity, workspaceDir, isLoading } = settings;

  return (
    <SettingsMarkdownPage
      title="身份设置"
      fileName="Identity.md"
      description="定义助手身份与长期自我定位"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/IDENTITY.md`}
      value={identity.markdownContent}
      placeholder="在此编辑身份配置..."
      help="保存后将直接覆盖本地工作区文件"
      badges={[
        { label: '本地文件', tone: 'blue' },
        { label: '已同步', tone: 'green' },
      ]}
      onChange={(value) => updateIdentity({ markdownContent: value })}
      disabled={isLoading}
    />
  );
}
