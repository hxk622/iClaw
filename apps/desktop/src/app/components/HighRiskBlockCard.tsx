import { ChevronRight, ShieldAlert } from 'lucide-react';

interface HighRiskBlockCardProps {
  requestType?: string;
  onContinueResearch?: () => void;
  onModifyQuestion?: () => void;
}

export function HighRiskBlockCard({
  requestType = '金融执行操作',
  onContinueResearch,
  onModifyQuestion,
}: HighRiskBlockCardProps) {
  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm">
      <div className="border-b border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3 dark:border-orange-900/30 dark:from-orange-950/30 dark:to-amber-950/30">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
            <ShieldAlert className="text-orange-700 dark:text-orange-400" size={20} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] leading-tight text-slate-900 dark:text-slate-100">
              当前请求属于高风险场景
            </h3>
            <p className="mt-0.5 text-[12px] leading-tight text-slate-600 dark:text-slate-400">
              {requestType}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="space-y-3">
          <p className="text-[14px] leading-[1.6] text-slate-700 dark:text-slate-300">
            系统识别到您的请求涉及
            <strong className="font-medium text-slate-900 dark:text-slate-100">
              直接买卖、仓位调整、下单或申赎
            </strong>
            等执行性操作。
          </p>

          <div className="rounded-md bg-[var(--bg-hover)] px-4 py-3">
            <p className="text-[13px] leading-[1.6] text-slate-700 dark:text-slate-300">
              理财客当前仅支持<strong className="font-medium">研究分析与信息查询</strong>，
              暂不提供直接执行性结论或操作指令。此类决策需结合您的风险承受能力、资产状况与投资目标，由您本人或持牌顾问完成。
            </p>
          </div>

          <div className="space-y-1.5 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300">请注意：</p>
            <ul className="space-y-1 pl-4">
              <li className="relative before:absolute before:-left-3 before:content-['·']">
                执行性投资决策存在本金损失风险
              </li>
              <li className="relative before:absolute before:-left-3 before:content-['·']">
                系统无法获知您的完整财务状况与风险偏好
              </li>
              <li className="relative before:absolute before:-left-3 before:content-['·']">
                算法分析不构成对未来收益的承诺或保证
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]/60 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onContinueResearch}
            className="group flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-4 py-2.5 text-[13px] font-medium text-[var(--button-secondary-text)] transition-all hover:border-[var(--button-secondary-border-hover)] hover:bg-[var(--button-secondary-bg-hover)]"
          >
            <span>查看研究分析版本</span>
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={onModifyQuestion}
            className="flex-1 rounded-md border border-transparent px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            重新提问
          </button>
        </div>
      </div>
    </div>
  );
}
