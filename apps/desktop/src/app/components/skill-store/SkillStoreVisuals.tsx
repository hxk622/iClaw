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

const TAG_TONE_CLASSES = {
  brand:
    'border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.14)] text-[rgb(163,116,29)] dark:border-[rgba(201,169,97,0.26)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#efd69d]',
  emerald:
    'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.10)] text-[rgb(22,128,61)] dark:border-[rgba(111,221,149,0.24)] dark:bg-[rgba(34,197,94,0.16)] dark:text-[#aaf3c1]',
  sky:
    'border-[rgba(56,189,248,0.22)] bg-[rgba(56,189,248,0.10)] text-[rgb(14,116,144)] dark:border-[rgba(125,211,252,0.24)] dark:bg-[rgba(56,189,248,0.15)] dark:text-[#afe5ff]',
  amber:
    'border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.11)] text-[rgb(180,100,24)] dark:border-[rgba(251,191,36,0.24)] dark:bg-[rgba(245,158,11,0.16)] dark:text-[#f7cf8a]',
  rose:
    'border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.10)] text-[rgb(190,24,93)] dark:border-[rgba(251,113,133,0.24)] dark:bg-[rgba(244,63,94,0.16)] dark:text-[#f6b6c9]',
  violet:
    'border-[rgba(139,92,246,0.22)] bg-[rgba(139,92,246,0.10)] text-[rgb(109,40,217)] dark:border-[rgba(167,139,250,0.24)] dark:bg-[rgba(139,92,246,0.16)] dark:text-[#d5c0ff]',
  slate:
    'border-[rgba(148,163,184,0.20)] bg-[rgba(148,163,184,0.10)] text-[rgb(71,85,105)] dark:border-[rgba(148,163,184,0.22)] dark:bg-[rgba(148,163,184,0.14)] dark:text-[#d7e2ef]',
} as const;

const TONE_STYLES: Record<VisualTone, {wrap: string; glow: string; icon: string}> = {
  brand: {
    wrap: 'border-[rgba(201,169,97,0.24)] bg-[linear-gradient(180deg,rgba(244,234,206,0.9),rgba(255,255,255,0.82))] dark:border-[rgba(201,169,97,0.22)] dark:bg-[linear-gradient(180deg,rgba(60,48,20,0.96),rgba(33,27,16,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(201,169,97,0.18)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(163,116,29)] dark:text-[#efd69d]',
  },
  emerald: {
    wrap: 'border-[rgba(34,197,94,0.20)] bg-[linear-gradient(180deg,rgba(219,246,228,0.98),rgba(255,255,255,0.84))] dark:border-[rgba(34,197,94,0.22)] dark:bg-[linear-gradient(180deg,rgba(18,63,39,0.96),rgba(15,35,24,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(34,197,94,0.14)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(22,128,61)] dark:text-[#9ff0b7]',
  },
  sky: {
    wrap: 'border-[rgba(56,189,248,0.22)] bg-[linear-gradient(180deg,rgba(224,242,254,0.98),rgba(255,255,255,0.84))] dark:border-[rgba(56,189,248,0.22)] dark:bg-[linear-gradient(180deg,rgba(19,55,72,0.96),rgba(15,27,37,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(56,189,248,0.14)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(14,116,144)] dark:text-[#9edfff]',
  },
  amber: {
    wrap: 'border-[rgba(245,158,11,0.22)] bg-[linear-gradient(180deg,rgba(254,243,199,0.98),rgba(255,255,255,0.86))] dark:border-[rgba(245,158,11,0.24)] dark:bg-[linear-gradient(180deg,rgba(74,45,13,0.96),rgba(42,28,12,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(245,158,11,0.14)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(180,100,24)] dark:text-[#f7cf8a]',
  },
  rose: {
    wrap: 'border-[rgba(244,63,94,0.20)] bg-[linear-gradient(180deg,rgba(255,228,236,0.98),rgba(255,255,255,0.86))] dark:border-[rgba(244,63,94,0.22)] dark:bg-[linear-gradient(180deg,rgba(76,21,39,0.96),rgba(38,16,25,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(244,63,94,0.12)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(190,24,93)] dark:text-[#f6b6c9]',
  },
  violet: {
    wrap: 'border-[rgba(139,92,246,0.22)] bg-[linear-gradient(180deg,rgba(237,233,254,0.98),rgba(255,255,255,0.84))] dark:border-[rgba(139,92,246,0.22)] dark:bg-[linear-gradient(180deg,rgba(50,31,80,0.96),rgba(27,18,45,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(139,92,246,0.14)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(109,40,217)] dark:text-[#ccb7ff]',
  },
  slate: {
    wrap: 'border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(241,245,249,0.98),rgba(255,255,255,0.86))] dark:border-[rgba(148,163,184,0.18)] dark:bg-[linear-gradient(180deg,rgba(42,48,58,0.96),rgba(22,25,31,0.92))]',
    glow: 'shadow-[0_18px_36px_rgba(148,163,184,0.12)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.24)]',
    icon: 'text-[rgb(71,85,105)] dark:text-[#d7e2ef]',
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
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[20px] border backdrop-blur-[8px]',
        palette.wrap,
        palette.glow,
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),transparent_68%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_68%)]" />
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

function tagTone(tag: string): keyof typeof TAG_TONE_CLASSES {
  const text = tag.trim().toLowerCase();

  if (/a股|ashare|esg|治理|可持续|研究|财报|估值|基本面/.test(text)) return 'emerald';
  if (/美股|us|search|搜索|检索|数据|api|document/.test(text)) return 'sky';
  if (/组合|风险|策略|量化|交易|portfolio/.test(text)) return 'amber';
  if (/报告|写作|memo|summary|report/.test(text)) return 'rose';
  if (/agent|workflow|自动化|proactive|self/.test(text)) return 'violet';
  if (/官方|内置|bundled|系统/.test(text)) return 'brand';

  const tones: Array<keyof typeof TAG_TONE_CLASSES> = ['brand', 'emerald', 'sky', 'amber', 'rose', 'violet', 'slate'];
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

export function skillTagClassName(tag: string): string {
  return TAG_TONE_CLASSES[tagTone(tag)];
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
