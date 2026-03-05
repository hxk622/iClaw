import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

const emojis = ['🐾', '🤖', '✨', '🦁', '🦊', '🐺', '🦅', '🐉'];
const themes = ['专业', '随意', '友好', '技术', '创意'];
const introStyles = ['友好', '正式', '简洁', '详细', '活泼'];

export function Identity() {
  const { settings, updateIdentity } = useSettings();
  const { identity } = settings;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">身份设置</h1>
        <p className="text-[var(--text-secondary)]">自定义助手如何展示自己。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <FormRow label="助手名称" help="助手对外展示的名称">
          <input
            value={identity.assistantName}
            onChange={(e) => updateIdentity({ assistantName: e.target.value })}
          />
        </FormRow>

        <FormRow label="表情符号" help="选择一个助手标识">
          <div className="flex flex-wrap gap-2">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => updateIdentity({ emoji })}
                className={`h-12 w-12 rounded-lg border-2 text-2xl ${
                  identity.emoji === emoji
                    ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </FormRow>

        <FormRow label="主题" help="整体个性主题">
          <select
            value={identity.theme}
            onChange={(e) => updateIdentity({ theme: e.target.value })}
          >
            {themes.map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="自我介绍风格" help="助手介绍自己的方式">
          <select
            value={identity.selfIntroStyle}
            onChange={(e) => updateIdentity({ selfIntroStyle: e.target.value })}
          >
            {introStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </FormRow>
      </div>
    </div>
  );
}
