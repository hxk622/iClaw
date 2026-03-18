import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

export function UserProfile() {
  const { settings, updateUserProfile } = useSettings();
  const { userProfile, workspaceDir, isLoading } = settings;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">用户画像User.md</h1>
        <p className="text-[var(--text-secondary)]">
          当前登录用户的本地画像文件。设置页和 OpenClaw 读取的是同一份内容。
        </p>
        {workspaceDir && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Workspace: {workspaceDir}/USER.md</p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="Markdown 内容" help="登录切换用户后，这份文件未来会由云端备份恢复覆盖。">
          <textarea
            rows={22}
            value={userProfile.markdownContent}
            disabled={isLoading}
            onChange={(e) => updateUserProfile({ markdownContent: e.target.value })}
            className="font-mono text-sm"
          />
        </FormRow>
      </div>
    </div>
  );
}
