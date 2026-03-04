import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

const channels = [
  { value: 'web', label: '网页' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
] as const;

export function ChannelPreference() {
  const { settings, updateChannelPreference } = useSettings();
  const { channelPreference } = settings;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-zinc-900 dark:text-zinc-100">渠道偏好</h1>
        <p className="text-zinc-500 dark:text-zinc-400">配置默认沟通渠道与通知方式。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <FormRow label="默认渠道">
          <div className="grid grid-cols-3 gap-3">
            {channels.map((item) => (
              <button
                key={item.value}
                onClick={() => updateChannelPreference({ defaultChannel: item.value })}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  channelPreference.defaultChannel === item.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </FormRow>

        <FormRow label="通知级别">
          <input
            value={channelPreference.notificationLevel}
            onChange={(e) => updateChannelPreference({ notificationLevel: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </FormRow>

        <FormRow label="消息格式">
          <input
            value={channelPreference.messageFormat}
            onChange={(e) => updateChannelPreference({ messageFormat: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </FormRow>

        <FormRow label="同步到 IM">
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={channelPreference.syncToIM}
              onChange={(e) => updateChannelPreference({ syncToIM: e.target.checked })}
            />
            启用
          </label>
        </FormRow>

        {channelPreference.syncToIM && (
          <FormRow label="IM 目标">
            <input
              value={channelPreference.imTarget}
              onChange={(e) => updateChannelPreference({ imTarget: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </FormRow>
        )}
      </div>
    </div>
  );
}
