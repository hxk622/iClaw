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
          <h1 className="text-2xl text-[var(--text-primary)]">人格配置（可选）</h1>
          <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-sm text-[var(--state-info)]">
            可选
          </span>
        </div>
        <p className="text-[var(--text-secondary)]">定义助手的语气、澄清与风险决策风格。</p>
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
          className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          使用默认
        </button>
        <button
          onClick={() => {
            updateSoulPersona({ mode: 'wizard' });
            setShowWizard(true);
            setEditingMarkdown(false);
          }}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm text-[var(--brand-on-primary)] hover:bg-[var(--brand-primary-hover)]"
        >
          打开向导
        </button>
        <button
          onClick={() => {
            updateSoulPersona({ mode: 'markdown' });
            setEditingMarkdown(true);
            setShowWizard(false);
          }}
          className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          编辑 Markdown
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {showWizard && (
            <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
              <FormRow label="语气">
                <select
                  value={soulPersona.tone}
                  onChange={(e) => updateSoulPersona({ tone: e.target.value })}
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
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
              <FormRow label="SOUL.md">
                <textarea
                  rows={16}
                  value={soulPersona.markdownContent || markdown}
                  onChange={(e) => updateSoulPersona({ markdownContent: e.target.value })}
                  className="font-mono text-sm"
                />
              </FormRow>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <h4 className="mb-3 text-sm text-[var(--text-secondary)]">SOUL.md 预览</h4>
            <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded bg-[var(--bg-hover)] p-3 text-xs text-[var(--text-primary)]">
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
