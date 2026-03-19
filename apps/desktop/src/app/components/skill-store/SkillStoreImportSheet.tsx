import { FolderOpen, Github, X } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';

const SHEET_INPUT_CLASS =
  'w-full rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:placeholder:text-[rgba(250,250,250,0.34)]';

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
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_90px_rgba(26,22,18,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.98),rgba(17,16,15,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/72 px-3 py-1 text-[11px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                导入技能
              </div>
              <h2 className="mt-3.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">把自己的 skill 收进账号</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                支持 GitHub 公开仓库和本地目录。导入后会写入你的云端技能库，并自动安装到当前电脑。
              </p>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <DrawerSection
            title="GitHub 公开仓库"
            description="输入仓库链接，桌面端会拉取仓库、识别 SKILL.md、打包并同步到你的账号。"
            icon={
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(24,24,27,0.06)] text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.08)]">
                <Github className="h-5 w-5" />
              </div>
            }
          >
            <div className="mt-4 space-y-3">
              <input
                value={githubUrl}
                onChange={(event) => onGithubUrlChange(event.target.value)}
                placeholder="https://github.com/owner/repo"
                className={SHEET_INPUT_CLASS}
                style={{['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)'}}
              />
              <Button variant="primary" size="md" disabled={githubLoading || localLoading} onClick={onImportGithub}>
                {githubLoading ? '导入中…' : '从 GitHub 导入'}
              </Button>
            </div>
          </DrawerSection>

          <DrawerSection
            title="本地目录"
            description="直接选择一个技能目录。系统会验证是否包含 SKILL.md，然后自动打包、上传并安装。"
            icon={
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(201,169,97,0.14)] text-[var(--brand-primary)]">
                <FolderOpen className="h-5 w-5" />
              </div>
            }
          >
            <div className="mt-4">
              <Button variant="secondary" size="md" disabled={githubLoading || localLoading} onClick={onImportLocal}>
                {localLoading ? '导入中…' : '选择目录并导入'}
              </Button>
            </div>
          </DrawerSection>

          {error ? (
            <InfoTile label="导入错误" value={error} tone="warning" />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
