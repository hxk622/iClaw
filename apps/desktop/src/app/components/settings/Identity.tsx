import { useSettings } from '@/app/contexts/settings-context';
import { SettingsFieldChip } from '@/app/components/settings/ui/SettingsFieldChip';
import { SettingsMarkdownPage } from '@/app/components/settings/ui/SettingsMarkdownPage';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';

const recommendedFields = ['名称', '定位', '核心角色', '对外介绍', '默认署名', '专业领域', '服务承诺'];

export function Identity() {
  const { settings, updateIdentity } = useSettings();
  const { identity, workspaceDir, isLoading } = settings;

  return (
    <SettingsMarkdownPage
      title="身份设置"
      fileName="Identity.md"
      description="定义 iClaw 的身份信息、角色定位、对外自我介绍与默认署名"
      workspacePath={`${workspaceDir || '~/Documents/iClaw/workspace'}/Identity.md`}
      syncLabel="2分钟前同步"
      value={identity.markdownContent}
      placeholder="输入身份定义内容..."
      onChange={(value) => updateIdentity({ markdownContent: value })}
      disabled={isLoading}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-3 text-[12px] text-[var(--text-secondary)]">推荐字段</div>
          <div className="flex flex-wrap gap-2">
            {recommendedFields.map((field) => (
              <SettingsFieldChip key={field}>{field}</SettingsFieldChip>
            ))}
          </div>
        </div>

        <SettingsCard className="rounded-lg border-[color:color-mix(in_srgb,var(--border-default)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-hover)_65%,transparent)] p-3 shadow-none">
          <div className="text-[11px] text-[var(--text-secondary)]">
            保存后将立即生效，影响 iClaw 在所有对话中的自我介绍与署名方式
          </div>
        </SettingsCard>
      </div>
    </SettingsMarkdownPage>
  );
}
