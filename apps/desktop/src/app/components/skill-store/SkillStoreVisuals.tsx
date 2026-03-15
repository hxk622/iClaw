import type { ComponentType } from 'react';
import {
  BarChart3,
  Bot,
  Briefcase,
  Database,
  FileText,
  Globe2,
  Landmark,
  LayoutGrid,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/app/lib/cn';
import type { SkillStoreItem } from '@/app/lib/skill-store';

type IconComponent = ComponentType<LucideProps>;
type VisualTone = 'brand' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'slate';

type VisualDescriptor = {
  icon: IconComponent;
  tone: VisualTone;
  label: string;
};

const TONE_STYLES: Record<VisualTone, {wrap: string; glow: string; icon: string}> = {
  brand: {
    wrap: 'border-[rgba(201,169,97,0.24)] bg-[linear-gradient(180deg,rgba(244,234,206,0.9),rgba(255,255,255,0.82))]',
    glow: 'shadow-[0_18px_36px_rgba(201,169,97,0.18)]',
    icon: 'text-[rgb(163,116,29)]',
  },
  emerald: {
    wrap: 'border-[rgba(34,197,94,0.20)] bg-[linear-gradient(180deg,rgba(219,246,228,0.98),rgba(255,255,255,0.84))]',
    glow: 'shadow-[0_18px_36px_rgba(34,197,94,0.14)]',
    icon: 'text-[rgb(22,128,61)]',
  },
  sky: {
    wrap: 'border-[rgba(56,189,248,0.22)] bg-[linear-gradient(180deg,rgba(224,242,254,0.98),rgba(255,255,255,0.84))]',
    glow: 'shadow-[0_18px_36px_rgba(56,189,248,0.14)]',
    icon: 'text-[rgb(14,116,144)]',
  },
  amber: {
    wrap: 'border-[rgba(245,158,11,0.22)] bg-[linear-gradient(180deg,rgba(254,243,199,0.98),rgba(255,255,255,0.86))]',
    glow: 'shadow-[0_18px_36px_rgba(245,158,11,0.14)]',
    icon: 'text-[rgb(180,100,24)]',
  },
  rose: {
    wrap: 'border-[rgba(244,63,94,0.20)] bg-[linear-gradient(180deg,rgba(255,228,236,0.98),rgba(255,255,255,0.86))]',
    glow: 'shadow-[0_18px_36px_rgba(244,63,94,0.12)]',
    icon: 'text-[rgb(190,24,93)]',
  },
  violet: {
    wrap: 'border-[rgba(139,92,246,0.22)] bg-[linear-gradient(180deg,rgba(237,233,254,0.98),rgba(255,255,255,0.84))]',
    glow: 'shadow-[0_18px_36px_rgba(139,92,246,0.14)]',
    icon: 'text-[rgb(109,40,217)]',
  },
  slate: {
    wrap: 'border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(241,245,249,0.98),rgba(255,255,255,0.86))]',
    glow: 'shadow-[0_18px_36px_rgba(148,163,184,0.12)]',
    icon: 'text-[rgb(71,85,105)]',
  },
};

function resolveSkillVisual(skill: SkillStoreItem): VisualDescriptor {
  const text = `${skill.slug} ${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase();

  if (skill.source === 'bundled') {
    return { icon: Landmark, tone: 'brand', label: '系统预置' };
  }
  if (/esg|治理|可持续/.test(text)) {
    return { icon: ShieldCheck, tone: 'emerald', label: 'ESG' };
  }
  if (/search|find|检索|搜索/.test(text)) {
    return { icon: Search, tone: 'sky', label: '搜索' };
  }
  if (/agent|自动化|proactive|workflow/.test(text)) {
    return { icon: Bot, tone: 'violet', label: 'Agent' };
  }
  if (skill.categoryId === 'data') {
    return { icon: Database, tone: 'sky', label: '数据工具' };
  }
  if (skill.categoryId === 'report') {
    return { icon: FileText, tone: 'rose', label: '报告生成' };
  }
  if (skill.categoryId === 'portfolio') {
    return { icon: BarChart3, tone: 'amber', label: '组合与风险' };
  }
  if (skill.market === 'A股') {
    return { icon: Landmark, tone: 'amber', label: 'A股' };
  }
  if (skill.market === '美股') {
    return { icon: Briefcase, tone: 'sky', label: '美股' };
  }
  if (skill.categoryId === 'research') {
    return { icon: LineChart, tone: 'emerald', label: '研究分析' };
  }
  if (skill.official) {
    return { icon: Sparkles, tone: 'brand', label: '官方' };
  }
  return { icon: LayoutGrid, tone: 'slate', label: '通用技能' };
}

export function IconWell({
  icon: Icon,
  tone,
  className,
  iconClassName,
}: {
  icon: IconComponent;
  tone: VisualTone;
  className?: string;
  iconClassName?: string;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-[20px] border backdrop-blur-[8px]',
        palette.wrap,
        palette.glow,
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),transparent_68%)]" />
      <Icon className={cn('relative z-[1]', palette.icon, iconClassName)} />
    </div>
  );
}

export function SkillGlyph({
  skill,
  className,
  iconClassName,
}: {
  skill: SkillStoreItem;
  className?: string;
  iconClassName?: string;
}) {
  const visual = resolveSkillVisual(skill);
  return <IconWell icon={visual.icon} tone={visual.tone} className={className} iconClassName={iconClassName} />;
}

export function skillVisualLabel(skill: SkillStoreItem): string {
  return resolveSkillVisual(skill).label;
}

export function SummaryGlyph({
  icon,
  tone,
  className,
  iconClassName,
}: {
  icon: IconComponent;
  tone: VisualTone;
  className?: string;
  iconClassName?: string;
}) {
  return <IconWell icon={icon} tone={tone} className={className} iconClassName={iconClassName} />;
}

export { Globe2, LayoutGrid, LineChart, ShieldCheck, Sparkles };
