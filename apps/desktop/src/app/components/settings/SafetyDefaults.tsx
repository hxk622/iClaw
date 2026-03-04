import { Shield } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

export function SafetyDefaults() {
  const { settings, updateSafetyDefaults } = useSettings();
  const { safetyDefaults } = settings;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-zinc-900 dark:text-zinc-100">安全策略</h1>
        <p className="text-zinc-500 dark:text-zinc-400">配置系统命令、网络与文件访问边界。</p>
      </div>

      <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/40">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-5 w-5 text-yellow-700 dark:text-yellow-300" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">这些设置会影响高风险能力，保存后立即生效。</p>
        </div>
      </div>

      <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <FormRow label="system.run 模式">
          <select
            value={safetyDefaults.systemRunMode}
            onChange={(e) =>
              updateSafetyDefaults({
                systemRunMode: e.target.value as 'ask' | 'allow' | 'deny',
              })
            }
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ask">询问</option>
            <option value="allow">允许</option>
            <option value="deny">拒绝</option>
          </select>
        </FormRow>

        <FormRow label="危险操作确认">
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
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
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </FormRow>

        <FormRow label="文件访问范围">
          <input
            value={safetyDefaults.fileAccessScope}
            onChange={(e) => updateSafetyDefaults({ fileAccessScope: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </FormRow>

        <FormRow label="工具回退策略">
          <input
            value={safetyDefaults.toolFallbackPolicy}
            onChange={(e) => updateSafetyDefaults({ toolFallbackPolicy: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </FormRow>
      </div>
    </div>
  );
}
