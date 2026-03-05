import { Shield } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

export function SafetyDefaults() {
  const { settings, updateSafetyDefaults } = useSettings();
  const { safetyDefaults } = settings;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">安全策略</h1>
        <p className="text-[var(--text-secondary)]">配置系统命令、网络与文件访问边界。</p>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-hover)] p-4">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-5 w-5 text-[var(--state-info)]" />
          <p className="text-sm text-[var(--text-secondary)]">这些设置会影响高风险能力，保存后立即生效。</p>
        </div>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="system.run 模式">
          <select
            value={safetyDefaults.systemRunMode}
            onChange={(e) =>
              updateSafetyDefaults({
                systemRunMode: e.target.value as 'ask' | 'allow' | 'deny',
              })
            }
          >
            <option value="ask">询问</option>
            <option value="allow">允许</option>
            <option value="deny">拒绝</option>
          </select>
        </FormRow>

        <FormRow label="危险操作确认">
          <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={safetyDefaults.dangerousActionConfirmation}
              onChange={(e) =>
                updateSafetyDefaults({ dangerousActionConfirmation: e.target.checked })
              }
            />
            始终确认
          </label>
        </FormRow>

        <FormRow label="网络访问策略">
          <input
            value={safetyDefaults.networkAccessPolicy}
            onChange={(e) => updateSafetyDefaults({ networkAccessPolicy: e.target.value })}
          />
        </FormRow>

        <FormRow label="文件访问范围">
          <input
            value={safetyDefaults.fileAccessScope}
            onChange={(e) => updateSafetyDefaults({ fileAccessScope: e.target.value })}
          />
        </FormRow>

        <FormRow label="工具回退策略">
          <input
            value={safetyDefaults.toolFallbackPolicy}
            onChange={(e) => updateSafetyDefaults({ toolFallbackPolicy: e.target.value })}
          />
        </FormRow>
      </div>
    </div>
  );
}
