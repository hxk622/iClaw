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
        <h1 className="mb-2 text-2xl text-zinc-900 dark:text-zinc-100">身份设置</h1>
        <p className="text-zinc-500 dark:text-zinc-400">自定义助手如何展示自己。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <FormRow label="助手名称" help="助手对外展示的名称">
          <input
            value={identity.assistantName}
            onChange={(e) => updateIdentity({ assistantName: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none ring-0 focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50'
                    : 'border-zinc-200 dark:border-zinc-700'
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
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
