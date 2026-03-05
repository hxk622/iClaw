import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

const languages = ['中文', 'English', '日本語', 'Español'];
const timezones = ['Asia/Shanghai', 'Asia/Hong_Kong', 'America/Los_Angeles', 'UTC'];
const lengths = ['简洁', '中等', '详细'];

export function UserProfile() {
  const { settings, updateUserProfile } = useSettings();
  const { userProfile } = settings;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">用户资料</h1>
        <p className="text-[var(--text-secondary)]">帮助助手更好地理解你的偏好。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="首选称呼">
          <input
            value={userProfile.preferredName}
            onChange={(e) => updateUserProfile({ preferredName: e.target.value })}
          />
        </FormRow>
        <FormRow label="语言">
          <select
            value={userProfile.language}
            onChange={(e) => updateUserProfile({ language: e.target.value })}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="时区">
          <select
            value={userProfile.timezone}
            onChange={(e) => updateUserProfile({ timezone: e.target.value })}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="工作角色">
          <input
            value={userProfile.workRole}
            onChange={(e) => updateUserProfile({ workRole: e.target.value })}
          />
        </FormRow>
        <FormRow label="主要用途">
          <input
            value={userProfile.primaryUseCase}
            onChange={(e) => updateUserProfile({ primaryUseCase: e.target.value })}
          />
        </FormRow>
        <FormRow label="回复长度偏好">
          <div className="flex gap-3">
            {lengths.map((len) => (
              <button
                key={len}
                onClick={() => updateUserProfile({ responseLengthPreference: len })}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm ${
                  userProfile.responseLengthPreference === len
                    ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)] text-[var(--brand-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]'
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        </FormRow>
      </div>
    </div>
  );
}
