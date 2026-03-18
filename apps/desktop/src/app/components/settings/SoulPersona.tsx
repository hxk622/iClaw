import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

export function SoulPersona() {
  const { settings, updateSoulPersona } = useSettings();
  const { soulPersona, workspaceDir, isLoading } = settings;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl text-[var(--text-primary)]">人格配置Soul.md</h1>
          <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-sm text-[var(--state-info)]">
            私密文件
          </span>
        </div>
        <p className="text-[var(--text-secondary)]">
          这份文件定义行为边界与语气。切换账号时必须被对应用户内容整体覆盖。
        </p>
        {workspaceDir && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Workspace: {workspaceDir}/SOUL.md</p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="Markdown 内容" help="保存后直接覆盖工作区中的 SOUL.md。">
          <textarea
            rows={24}
            value={soulPersona.markdownContent}
            disabled={isLoading}
            onChange={(e) => updateSoulPersona({ markdownContent: e.target.value })}
            className="font-mono text-sm"
          />
        </FormRow>
      </div>
    </div>
  );
}
