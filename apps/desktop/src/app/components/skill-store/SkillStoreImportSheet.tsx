import {FolderOpen, Github, X} from 'lucide-react';

import {Button} from '@/app/components/ui/Button';

export function SkillStoreImportSheet({
  open,
  githubUrl,
  githubLoading,
  localLoading,
  error,
  onGithubUrlChange,
  onImportGithub,
  onImportLocal,
  onClose,
}: {
  open: boolean;
  githubUrl: string;
  githubLoading: boolean;
  localLoading: boolean;
  error: string | null;
  onGithubUrlChange: (value: string) => void;
  onImportGithub: () => void;
  onImportLocal: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,24,33,0.16)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(252,252,251,0.98),rgba(246,247,244,0.96))] shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[rgba(15,23,42,0.08)] px-6 py-5 dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-1 text-[12px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                导入技能
              </div>
              <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">把自己的 skill 收进账号</h2>
              <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                支持 GitHub 公开仓库和本地目录。导入后会写入你的云端技能库，并自动安装到当前电脑。
              </p>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-[10px] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:shadow-[0_20px_36px_rgba(0,0,0,0.26)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(24,24,27,0.06)] text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.08)]">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[16px] font-medium text-[var(--text-primary)]">GitHub 公开仓库</div>
                <div className="text-[13px] leading-6 text-[var(--text-secondary)]">输入仓库链接，桌面端会拉取仓库、识别 SKILL.md、打包并同步到你的账号。</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={githubUrl}
                onChange={(event) => onGithubUrlChange(event.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:placeholder:text-[rgba(250,250,250,0.34)]"
                style={{['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)'}}
              />
              <Button variant="primary" size="md" disabled={githubLoading || localLoading} onClick={onImportGithub}>
                {githubLoading ? '导入中…' : '从 GitHub 导入'}
              </Button>
            </div>
          </section>

          <section className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-[10px] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:shadow-[0_20px_36px_rgba(0,0,0,0.26)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(201,169,97,0.14)] text-[var(--brand-primary)]">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[16px] font-medium text-[var(--text-primary)]">本地目录</div>
                <div className="text-[13px] leading-6 text-[var(--text-secondary)]">直接选择一个技能目录。系统会验证是否包含 SKILL.md，然后自动打包、上传并安装。</div>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="md" disabled={githubLoading || localLoading} onClick={onImportLocal}>
                {localLoading ? '导入中…' : '选择目录并导入'}
              </Button>
            </div>
          </section>

          {error ? (
            <div
              className="rounded-[24px] px-5 py-4 text-sm text-[var(--state-error)]"
              style={{border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)'}}
            >
              {error}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
