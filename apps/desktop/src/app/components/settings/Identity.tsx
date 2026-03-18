import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

export function Identity() {
  const { settings, updateIdentity } = useSettings();
  const { identity, workspaceDir, isLoading } = settings;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">身份设置Identity.md</h1>
        <p className="text-[var(--text-secondary)]">
          直接编辑当前工作区中的身份文件。OpenClaw 会从同一份本地文件读取。
        </p>
        {workspaceDir && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Workspace: {workspaceDir}/IDENTITY.md</p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="Markdown 内容" help="首次安装时来自 DMG 默认文件；后续保存直接覆盖工作区同名文件。">
          <textarea
            rows={22}
            value={identity.markdownContent}
            disabled={isLoading}
            onChange={(e) => updateIdentity({ markdownContent: e.target.value })}
            className="font-mono text-sm"
          />
        </FormRow>
      </div>
    </div>
  );
}
