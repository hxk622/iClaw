import { useState } from 'react';
import { useSettings } from '@/app/contexts/settings-context';
import { FormRow } from '@/app/components/settings/ui/FormRow';

const tones = ['平衡', '热情', '专业', '随意', '分析'];
const clarifications = ['不清楚时询问', '做出合理假设', '行动前总是澄清'];
const risks = ['保守', '适中', '宽松（带警告）'];
const decisions = ['协作式', '指导式', '建议式', '分析式'];

export function SoulPersona() {
  const { settings, updateSoulPersona } = useSettings();
  const { soulPersona } = settings;
  const [showWizard, setShowWizard] = useState(soulPersona.mode === 'wizard');
  const [editingMarkdown, setEditingMarkdown] = useState(soulPersona.mode === 'markdown');

  const markdown = `# SOUL 配置\n\n## 语气\n${soulPersona.tone}\n\n## 澄清策略\n${soulPersona.clarificationPolicy}\n\n## 风险策略\n${soulPersona.riskPolicy}\n\n## 决策风格\n${soulPersona.decisionStyle}\n`;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl text-zinc-900 dark:text-zinc-100">人格配置（可选）</h1>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            可选
          </span>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400">定义助手的语气、澄清与风险决策风格。</p>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => {
            updateSoulPersona({
              mode: 'default',
              tone: '平衡',
              clarificationPolicy: '不清楚时询问',
              riskPolicy: '保守',
              decisionStyle: '协作式',
              markdownContent: '',
            });
            setShowWizard(false);
            setEditingMarkdown(false);
          }}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          使用默认
        </button>
        <button
          onClick={() => {
            updateSoulPersona({ mode: 'wizard' });
            setShowWizard(true);
            setEditingMarkdown(false);
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          打开向导
        </button>
        <button
          onClick={() => {
            updateSoulPersona({ mode: 'markdown' });
            setEditingMarkdown(true);
            setShowWizard(false);
          }}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          编辑 Markdown
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {showWizard && (
            <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <FormRow label="语气">
                <select
                  value={soulPersona.tone}
                  onChange={(e) => updateSoulPersona({ tone: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {tones.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="澄清策略">
                <select
                  value={soulPersona.clarificationPolicy}
                  onChange={(e) => updateSoulPersona({ clarificationPolicy: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {clarifications.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="风险策略">
                <select
                  value={soulPersona.riskPolicy}
                  onChange={(e) => updateSoulPersona({ riskPolicy: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {risks.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="决策风格">
                <select
                  value={soulPersona.decisionStyle}
                  onChange={(e) => updateSoulPersona({ decisionStyle: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {decisions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormRow>
            </div>
          )}

          {editingMarkdown && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <FormRow label="SOUL.md">
                <textarea
                  rows={16}
                  value={soulPersona.markdownContent || markdown}
                  onChange={(e) => updateSoulPersona({ markdownContent: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </FormRow>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">SOUL.md 预览</h4>
            <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {soulPersona.mode === 'markdown' && soulPersona.markdownContent
                ? soulPersona.markdownContent
                : markdown}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
