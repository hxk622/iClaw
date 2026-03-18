import { useSettings } from '@/app/contexts/settings-context';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';

export function UserProfile() {
  const { settings, updateUserProfile } = useSettings();
  const { userProfile, workspaceDir, isLoading } = settings;

  return (
    <SettingsMarkdownPage
      title="用户画像"
      fileName="User.md"
      description="定义当前用户画像、协作偏好与隐私边界"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/USER.md`}
      value={userProfile.markdownContent}
      placeholder="在此编辑用户画像..."
      help="保存后将直接覆盖本地工作区文件"
      badges={[
        { label: '本地文件', tone: 'blue' },
        { label: '已同步', tone: 'green' },
      ]}
      onChange={(value) => updateUserProfile({ markdownContent: value })}
      disabled={isLoading}
    />
  );
}
