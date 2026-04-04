import { AlertCircle, FileOutput, MessageSquare, Target, TrendingUp, User } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { pushAppNotification } from '@/app/lib/task-notifications';
import { SettingsHelperCard } from '@/app/components/settings/ui/SettingsHelperCard';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';
import {
  userProfileTemplateGroups,
  type SettingsMarkdownTemplate,
} from '@/app/components/settings/markdown-template-catalog';
import { SettingsTemplateLibrary } from '@/app/components/settings/ui/SettingsTemplateLibrary';

const dimensions = [
  { icon: User, label: '身份背景', desc: '职业、经验、专业领域' },
  { icon: Target, label: '投资目标', desc: '目标、周期、风险偏好' },
  { icon: TrendingUp, label: '关注重点', desc: '行业、主题、市场' },
  { icon: MessageSquare, label: '语气偏好', desc: '专业度、亲和度' },
  { icon: FileOutput, label: '输出格式', desc: '长度、结构、图表' },
  { icon: AlertCircle, label: '禁忌项', desc: '避免的内容与表述' },
];

export function UserProfile() {
  const { settings, updateUserProfile } = useSettings();
  const { userProfile, workspaceDir, isLoading } = settings;

  const handleApplyTemplate = (template: SettingsMarkdownTemplate, mode: 'replace' | 'append') => {
    const nextValue =
      mode === 'replace'
        ? template.content
        : [userProfile.markdownContent.trim(), template.content].filter(Boolean).join('\n\n');
    updateUserProfile({ markdownContent: nextValue });
    pushAppNotification({
      tone: 'success',
      title: mode === 'replace' ? '用户画像模板已应用' : '用户画像模板已追加',
      text: `已${mode === 'replace' ? '应用' : '追加'}「${template.title}」到 User.md。`,
    });
  };

  return (
    <SettingsMarkdownPage
      title="用户画像"
      fileName="User.md"
      description="定义用户背景、投资偏好、风险承受能力、表达习惯与输出要求"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/User.md`}
      syncLabel="5分钟前同步"
      value={userProfile.markdownContent}
      placeholder="输入用户画像内容..."
      onChange={(value) => updateUserProfile({ markdownContent: value })}
      disabled={isLoading}
    >
      <div className="space-y-4">
        <SettingsTemplateLibrary
          title="用户画像模板库"
          description="内置按用户角色和行业偏好整理的画像模板，适合快速建立长期协作上下文。"
          groups={userProfileTemplateGroups}
          onApplyTemplate={handleApplyTemplate}
        />

        <div>
          <div className="mb-3 text-[12px] text-[var(--text-secondary)]">推荐画像维度</div>
          <div className="grid grid-cols-2 gap-3">
            {dimensions.map((dimension) => (
              <SettingsHelperCard
                key={dimension.label}
                title={dimension.label}
                description={dimension.desc}
                icon={dimension.icon}
                tone="neutral"
              />
            ))}
          </div>
        </div>
      </div>
    </SettingsMarkdownPage>
  );
}
