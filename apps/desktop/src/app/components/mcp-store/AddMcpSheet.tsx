import { Sparkles, Upload, Wrench, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { PressableCard } from '@/app/components/ui/PressableCard';

type AddMcpOption = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const ADD_MCP_OPTIONS: AddMcpOption[] = [
  {
    title: '从商店安装',
    description: '优先从服务端管理的 MCP 目录安装，避免把 cloud catalog 固化在本地代码里。',
    icon: Sparkles,
  },
  {
    title: '手动配置',
    description: '后续支持用户像添加技能一样，自定义接入私有 MCP 或企业内网 MCP。',
    icon: Wrench,
  },
  {
    title: '导入配置',
    description: '为已有 JSON 配置迁移预留入口，后续可与“我的MCP”联动。',
    icon: Upload,
  },
] as const;

export function AddMcpSheet({ open, onClose }: {open: boolean; onClose: () => void}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_90px_rgba(26,22,18,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.98),rgba(17,16,15,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/72 px-3 py-1 text-[11px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                添加MCP
              </div>
              <h2 className="mt-3.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">预留用户自定义 MCP 能力</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                这一版先把商店目录、用户库和预置安装态做实，手动添加入口保留在这里继续扩展。
              </p>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {ADD_MCP_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <PressableCard key={option.title} interactive className="rounded-[20px] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-[var(--text-primary)]">{option.title}</div>
                    <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">{option.description}</p>
                  </div>
                </div>
              </PressableCard>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
