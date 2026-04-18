import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ComplianceDisclaimerBannerProps {
  mode?: 'normal' | 'compact';
}

export function ComplianceDisclaimerBanner({
  mode = 'normal',
}: ComplianceDisclaimerBannerProps) {
  const [isExpanded, setIsExpanded] = useState(mode === 'normal');

  if (mode === 'compact') {
    return (
      <div className="border-l border-amber-500/30 bg-amber-50/20 px-3 py-1.5 dark:border-amber-500/20 dark:bg-amber-950/15">
        <div className="flex items-center gap-2">
          <AlertCircle
            className="shrink-0 text-amber-600 dark:text-amber-500"
            size={14}
            strokeWidth={2}
          />
          <p className="text-[11px] leading-[1.4] text-slate-600 dark:text-slate-400">
            研究参考口径 · 非投资建议
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-l-2 border-amber-600/40 bg-amber-50/30 px-4 py-3 transition-all hover:bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
          size={18}
          strokeWidth={2}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[13px] leading-[1.6] text-slate-700 dark:text-slate-300">
              当前回答已按<span className="font-medium">研究参考口径</span>
              展示。请结合前提、风险与失效条件自行判断，不应直接视为投资建议。
            </p>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-amber-100/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-amber-900/30 dark:hover:text-slate-200"
              aria-label={isExpanded ? '收起详情' : '展开详情'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isExpanded ? (
            <div className="mt-2 space-y-1 border-t border-amber-200/40 pt-2 text-[12px] leading-[1.5] text-slate-600 dark:border-amber-800/30 dark:text-slate-400">
              <p>· 本回答基于公开信息与历史数据，不构成投资建议</p>
              <p>· 市场环境变化可能导致分析结论失效</p>
              <p>· 投资决策应咨询持牌专业人士并自行承担风险</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
