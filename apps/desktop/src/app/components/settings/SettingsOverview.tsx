import { ChevronRight, MessageSquare, Palette, Shield, Sparkles, User, UserCircle } from 'lucide-react';
import { type ComponentType } from 'react';
import { useSettings } from '@/app/contexts/settings-context';
import { StatusBadge } from '@/app/components/settings/ui/StatusBadge';

export type SettingsSection =
  | 'overview'
  | 'appearance'
  | 'general'
  | 'identity'
  | 'user-profile'
  | 'soul-persona'
  | 'channel-preference'
  | 'safety-defaults';

interface SettingsOverviewProps {
  onNavigate: (section: SettingsSection) => void;
}

const cards: Array<{
  key: string;
  statusKey?: keyof ReturnType<typeof useSettings>['settings']['configStatuses'];
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  section: SettingsSection;
}> = [
  {
    key: 'appearance',
    statusKey: 'appearance',
    title: '风格',
    description: '切换浅色、深色或跟随系统外观',
    icon: Palette,
    section: 'appearance',
  },
  {
    key: 'general',
    statusKey: 'general',
    title: '通用',
    description: '语言、启动行为与全局偏好设置',
    icon: UserCircle,
    section: 'general',
  },
  {
    key: 'identity',
    statusKey: 'identity',
    title: 'IDENTITY.md',
    description: '编辑助手身份与长期自我定位文件',
    icon: UserCircle,
    section: 'identity',
  },
  {
    key: 'userProfile',
    statusKey: 'userProfile',
    title: 'USER.md',
    description: '编辑当前用户画像、协作偏好与隐私边界',
    icon: User,
    section: 'user-profile',
  },
  {
    key: 'soulPersona',
    statusKey: 'soulPersona',
    title: 'SOUL.md',
    description: '编辑行为边界、风险姿态与风格约束',
    icon: Sparkles,
    section: 'soul-persona',
  },
  {
    key: 'channelPreference',
    statusKey: 'channelPreference',
    title: '渠道偏好',
    description: '选择默认渠道和通知策略',
    icon: MessageSquare,
    section: 'channel-preference',
  },
  {
    key: 'safetyDefaults',
    statusKey: 'safetyDefaults',
    title: '安全策略',
    description: '配置系统操作和文件访问边界',
    icon: Shield,
    section: 'safety-defaults',
  },
];

export function SettingsOverview({ onNavigate }: SettingsOverviewProps) {
  const { settings } = useSettings();

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">工作区设置</h1>
        <p className="text-[var(--text-secondary)]">以 `~/.openclaw/workspace` 为唯一真相源管理本地文件。</p>
      </div>

      <div className="space-y-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => onNavigate(card.section)}
              className="group flex w-full items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-hover)]">
                <Icon className="h-6 w-6 text-[var(--text-primary)]" />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-base text-[var(--text-primary)]">{card.title}</h3>
                  <StatusBadge status={settings.configStatuses[card.statusKey!]} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{card.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-secondary)]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
