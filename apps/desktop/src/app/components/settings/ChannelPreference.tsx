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
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">渠道偏好</h1>
        <p className="text-[var(--text-secondary)]">配置默认沟通渠道与通知方式。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="默认渠道">
          <div className="grid grid-cols-3 gap-3">
            {channels.map((item) => (
              <button
                key={item.value}
                onClick={() => updateChannelPreference({ defaultChannel: item.value })}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  channelPreference.defaultChannel === item.value
                    ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)] text-[var(--brand-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]'
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
          />
        </FormRow>

        <FormRow label="消息格式">
          <input
            value={channelPreference.messageFormat}
            onChange={(e) => updateChannelPreference({ messageFormat: e.target.value })}
          />
        </FormRow>

        <FormRow label="同步到 IM">
          <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
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
            />
          </FormRow>
        )}
      </div>
    </div>
  );
}
