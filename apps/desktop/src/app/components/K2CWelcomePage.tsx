import { useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Lightbulb,
  MessageCircle,
  PieChart,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import type { ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';

type WelcomeQuickAction = {
  label: string;
  prompt: string;
  iconKey: string | null;
};

type WelcomeProfile = {
  kolName: string;
  expertName: string;
  slogan: string;
  avatarUrl: string;
  primaryColor: string;
  backgroundImageUrl: string;
  description: string;
  expertiseAreas: string[];
  targetAudience: string;
  quickActions: WelcomeQuickAction[];
  disclaimer: string;
};

const DEFAULT_PROFILE: WelcomeProfile = {
  kolName: '陈雪',
  expertName: '陈雪的投资智囊',
  slogan: '用价值投资思维，陪你穿越市场周期',
  avatarUrl:
    'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBhc2lhbiUyMHdvbWFuJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzc0MjgzMTg0fDA&ixlib=rb-4.1.0&q=80&w=1080',
  primaryColor: '#C4975F',
  backgroundImageUrl:
    'https://images.unsplash.com/photo-1760172287483-02d382f63a6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwYWJzdHJhY3QlMjBnb2xkJTIwZ3JhZGllbnR8ZW58MXx8fHwxNzc0MjgzMTgzfDA&ixlib=rb-4.1.0&q=80&w=1080',
  description:
    '我会用我 10 年的投资框架和市场洞察，帮你理解复杂的金融市场，找到适合你的投资路径。',
  expertiseAreas: ['价值投资', '资产配置', '长期持有策略', '市场周期分析'],
  targetAudience: '希望建立长期投资思维的理性投资者。',
  quickActions: [
    {
      label: '市场行情分析',
      prompt: '帮我分析一下当前市场形势，有哪些值得关注的板块和投资机会？',
      iconKey: 'TrendingUp',
    },
    {
      label: '投资组合诊断',
      prompt: '帮我分析我的投资组合，看看是否需要调整配置？',
      iconKey: 'PieChart',
    },
    {
      label: '个股深度研究',
      prompt: '我想了解某个公司的投资价值，能帮我做个深度分析吗？',
      iconKey: 'Search',
    },
    {
      label: '投资策略咨询',
      prompt: '基于当前市场环境，给我一些长期投资的建议。',
      iconKey: 'Lightbulb',
    },
  ],
  disclaimer:
    '本智囊提供的所有信息仅供学习参考，不构成投资建议。投资有风险，决策需谨慎。',
};

const WELCOME_ICON_MAP: Record<string, LucideIcon> = {
  trendingup: TrendingUp,
  piechart: PieChart,
  search: Search,
  lightbulb: Lightbulb,
  messagecircle: MessageCircle,
  sparkles: Sparkles,
  shieldcheck: ShieldCheck,
};

function normalizeIconKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function resolveActionIcon(iconKey: string | null | undefined): LucideIcon {
  return WELCOME_ICON_MAP[normalizeIconKey(iconKey)] || Sparkles;
}

function buildPromptPreview(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 26) {
    return normalized;
  }
  return `${normalized.slice(0, 26).trim()}...`;
}

function resolveWelcomeProfile(config?: ResolvedWelcomePageConfig | null): WelcomeProfile {
  if (!config) {
    return DEFAULT_PROFILE;
  }

  const quickActions = config.quickActions
    .map((action) => ({
      label: action.label.trim(),
      prompt: action.prompt.trim(),
      iconKey: action.iconKey,
    }))
    .filter((action) => action.label && action.prompt);

  return {
    kolName: config.kolName || DEFAULT_PROFILE.kolName,
    expertName: config.expertName || DEFAULT_PROFILE.expertName,
    slogan: config.slogan || DEFAULT_PROFILE.slogan,
    avatarUrl: config.avatarUrl || DEFAULT_PROFILE.avatarUrl,
    primaryColor: config.primaryColor || DEFAULT_PROFILE.primaryColor,
    backgroundImageUrl: config.backgroundImageUrl || DEFAULT_PROFILE.backgroundImageUrl,
    description: config.description || DEFAULT_PROFILE.description,
    expertiseAreas: config.expertiseAreas.length ? config.expertiseAreas : DEFAULT_PROFILE.expertiseAreas,
    targetAudience: config.targetAudience || DEFAULT_PROFILE.targetAudience,
    quickActions: quickActions.length ? quickActions : DEFAULT_PROFILE.quickActions,
    disclaimer: config.disclaimer || DEFAULT_PROFILE.disclaimer,
  };
}

function buildWelcomeVars(profile: WelcomeProfile): CSSProperties {
  return {
    '--iclaw-welcome-primary': profile.primaryColor,
    '--iclaw-welcome-primary-soft': `${profile.primaryColor}14`,
    '--iclaw-welcome-primary-border': `${profile.primaryColor}30`,
    '--iclaw-welcome-primary-strong': `${profile.primaryColor}52`,
  } as CSSProperties;
}

function AvatarWithFallback({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src.trim()) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(196,151,95,0.92),rgba(150,116,71,0.96))] text-[28px] font-semibold text-white">
        {fallback}
      </div>
    );
  }

  return <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

type K2CWelcomePageProps = {
  onStartChat: () => void;
  onFillPrompt: (prompt: string) => void;
  config?: ResolvedWelcomePageConfig | null;
};

export function K2CWelcomePage({
  onStartChat,
  onFillPrompt,
  config,
}: K2CWelcomePageProps) {
  const profile = resolveWelcomeProfile(config);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10"
      style={{ bottom: 'calc(var(--iclaw-composer-height) + 18px)' }}
    >
      <div className="pointer-events-auto h-full overflow-y-auto px-6 py-5 [scrollbar-width:none] lg:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-[1120px] items-start justify-center">
          <section
            className="relative w-full overflow-hidden rounded-[36px] border border-[var(--chat-surface-panel-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--chat-surface-panel)_82%,white_18%),color-mix(in_srgb,var(--chat-surface-panel)_90%,white_10%))] shadow-[0_28px_70px_rgba(36,28,15,0.08)] dark:border-[rgba(214,190,151,0.16)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.96),rgba(14,13,12,0.98))] dark:shadow-[0_34px_100px_rgba(0,0,0,0.42)]"
            style={buildWelcomeVars(profile)}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
              style={{
                backgroundImage: `url(${profile.backgroundImageUrl})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(196,151,95,0.20),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_54%)] dark:bg-[radial-gradient(circle_at_top,rgba(196,151,95,0.28),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_30%),linear-gradient(180deg,rgba(14,12,10,0.06),rgba(9,8,8,0.2))]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)] opacity-70 dark:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)] dark:opacity-100" />
            <div className="pointer-events-none absolute left-[-8%] top-[-18%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(196,151,95,0.18),transparent_66%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(196,151,95,0.20),transparent_64%)] dark:blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-24%] right-[-4%] h-[300px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(196,151,95,0.12),transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(196,151,95,0.18),transparent_62%)]" />
            <div className="pointer-events-none absolute left-[18%] top-[28%] h-[180px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_72%)] opacity-0 dark:opacity-100 dark:blur-3xl" />

            <div className="relative px-6 py-8 md:px-10 md:py-10 lg:px-12">
              <div className="mx-auto max-w-[760px] text-center">
                  <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--iclaw-welcome-primary-border)] bg-[var(--iclaw-welcome-primary-soft)] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] dark:border-[rgba(214,190,151,0.24)] dark:bg-[rgba(196,151,95,0.12)] dark:text-[rgba(233,224,210,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.2)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--iclaw-welcome-primary)]" />
                    <span>{profile.kolName} · 专属龙虾专家</span>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-[-12px] rounded-full bg-[radial-gradient(circle,rgba(196,151,95,0.22),transparent_68%)] dark:inset-[-18px] dark:bg-[radial-gradient(circle,rgba(196,151,95,0.32),transparent_66%)]" />
                      <div className="relative h-[108px] w-[108px] overflow-hidden rounded-full border border-[rgba(255,255,255,0.86)] bg-[var(--chat-surface-panel)] shadow-[0_22px_48px_rgba(196,151,95,0.18)] dark:border-[rgba(255,255,255,0.2)] dark:bg-[rgba(255,255,255,0.04)] dark:shadow-[0_26px_60px_rgba(0,0,0,0.34),0_0_0_1px_rgba(196,151,95,0.16)] md:h-[128px] md:w-[128px]">
                        <AvatarWithFallback
                          src={profile.avatarUrl}
                          alt={profile.kolName}
                          fallback={(profile.kolName || profile.expertName || '龙').slice(0, 1)}
                        />
                      </div>
                      <div className="absolute bottom-[4px] right-[2px] flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-[var(--iclaw-welcome-primary)] text-white shadow-[0_8px_18px_rgba(196,151,95,0.28)] dark:border-[rgba(255,255,255,0.18)] dark:shadow-[0_10px_26px_rgba(196,151,95,0.4)]">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-[13px] font-medium tracking-[0.08em] text-[var(--text-muted)] dark:text-[rgba(233,224,210,0.58)]">
                      面向粉丝开放的 K2C 服务入口
                    </div>
                    <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.96)] md:text-[42px]">
                      {profile.expertName}
                    </h1>
                    <p className="mx-auto mt-4 max-w-[680px] text-[15px] leading-7 text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.74)] md:text-[18px]">
                      {profile.slogan}
                    </p>
                  </div>
              </div>

              <div className="mx-auto mt-8 max-w-[820px] rounded-[28px] border border-[rgba(255,255,255,0.65)] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_74%,white_26%)] p-5 shadow-[0_14px_38px_rgba(36,28,15,0.05)] backdrop-blur-xl dark:border-[rgba(214,190,151,0.16)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.035))] dark:shadow-[0_18px_40px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.04)] md:p-7">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--iclaw-welcome-primary-soft)] text-[var(--iclaw-welcome-primary)] dark:bg-[rgba(196,151,95,0.14)] dark:shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.96)]">
                        我能为你做什么
                      </div>
                      <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.74)] md:text-[15px]">
                        {profile.description}
                      </p>
                    </div>
                  </div>
                </div>

              <div className="mt-8 text-center">
                  <Button
                    variant="accent"
                    size="md"
                    className="min-h-[58px] rounded-[20px] px-7 text-[16px] shadow-[0_18px_42px_rgba(196,151,95,0.28)] dark:border-[rgba(214,190,151,0.28)] dark:bg-[linear-gradient(180deg,rgba(118,86,41,0.94),rgba(84,61,28,0.98))] dark:text-[#f4ddad] dark:shadow-[0_20px_50px_rgba(0,0,0,0.34),0_0_0_1px_rgba(196,151,95,0.16)] dark:hover:border-[rgba(232,208,165,0.38)] dark:hover:bg-[linear-gradient(180deg,rgba(132,97,47,0.96),rgba(94,68,31,1))]"
                    leadingIcon={<MessageCircle className="h-5 w-5" />}
                    onClick={onStartChat}
                  >
                    立即开始对话
                  </Button>
                  <div className="mt-4 inline-flex items-center gap-2 text-[13px] text-[var(--text-muted)] dark:text-[rgba(233,224,210,0.5)]">
                    <ArrowDown className="h-4 w-4 text-[var(--iclaw-welcome-primary)]" />
                    <span>也可以直接点下方问题建议</span>
                  </div>
              </div>

              <div className="mt-8">
                <div className="mb-4 flex items-center justify-center gap-2 text-[13px] text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.68)]">
                  <Sparkles className="h-4 w-4 text-[var(--iclaw-welcome-primary)]" />
                  <span>问题建议</span>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {profile.quickActions.map((action) => {
                    const Icon = resolveActionIcon(action.iconKey);
                    return (
                      <button
                        key={action.label}
                        type="button"
                        className="group flex min-h-[138px] flex-col rounded-[20px] border border-[rgba(255,255,255,0.72)] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_76%,white_24%)] p-4 text-left shadow-[0_10px_28px_rgba(30,24,15,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--iclaw-welcome-primary-border)] hover:shadow-[0_16px_34px_rgba(196,151,95,0.14)] dark:border-[rgba(214,190,151,0.12)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] dark:shadow-[0_16px_34px_rgba(0,0,0,0.18)] dark:hover:border-[rgba(214,190,151,0.26)] dark:hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035))] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.28),0_0_0_1px_rgba(196,151,95,0.08)]"
                        onClick={() => onFillPrompt(action.prompt)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--iclaw-welcome-primary-soft)] text-[var(--iclaw-welcome-primary)] dark:bg-[rgba(196,151,95,0.12)]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] transition duration-200 group-hover:text-[var(--iclaw-welcome-primary)] dark:text-[rgba(233,224,210,0.42)]" />
                        </div>
                        <div className="mt-4 text-[14px] font-medium leading-6 text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.92)]">
                          {action.label}
                        </div>
                        <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.62)] [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {buildPromptPreview(action.prompt)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-[rgba(255,255,255,0.62)] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_70%,white_30%)] p-5 backdrop-blur-xl dark:border-[rgba(214,190,151,0.14)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--iclaw-welcome-primary-soft)] text-[var(--iclaw-welcome-primary)] dark:bg-[rgba(196,151,95,0.12)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="text-[16px] font-semibold text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.94)]">擅长领域</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.expertiseAreas.map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] text-[var(--iclaw-welcome-primary)] dark:bg-[rgba(196,151,95,0.1)] dark:text-[#e6c98f]"
                        style={{
                          background: 'var(--iclaw-welcome-primary-soft)',
                          borderColor: 'var(--iclaw-welcome-primary-border)',
                        }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[rgba(255,255,255,0.62)] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_70%,white_30%)] p-5 backdrop-blur-xl dark:border-[rgba(214,190,151,0.14)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--iclaw-welcome-primary-soft)] text-[var(--iclaw-welcome-primary)] dark:bg-[rgba(196,151,95,0.12)]">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="text-[16px] font-semibold text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.94)]">适合你，如果</div>
                  </div>
                  <p className="mt-4 text-[14px] leading-7 text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.74)]">
                    {profile.targetAudience}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-[rgba(255,255,255,0.55)] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_66%,white_34%)] px-5 py-4 text-[12px] leading-6 text-[var(--text-muted)] backdrop-blur-xl dark:border-[rgba(214,190,151,0.12)] dark:bg-[rgba(255,255,255,0.035)] dark:text-[rgba(233,224,210,0.56)]">
                <span className="font-semibold text-[var(--text-secondary)] dark:text-[rgba(248,245,238,0.82)]">免责声明：</span>
                {profile.disclaimer}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
