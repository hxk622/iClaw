import { ChevronRight, MessageSquare, Shield, Sparkles, User, UserCircle } from 'lucide-react';
import { type ComponentType } from 'react';
import { useSettings } from '@/app/contexts/settings-context';
import { StatusBadge } from '@/app/components/settings/ui/StatusBadge';

export type SettingsSection =
  | 'overview'
  | 'identity'
  | 'user-profile'
  | 'soul-persona'
  | 'channel-preference'
  | 'safety-defaults';

interface SettingsOverviewProps {
  onNavigate: (section: SettingsSection) => void;
}

const cards: Array<{
  key: keyof ReturnType<typeof useSettings>['settings']['configStatuses'];
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  section: SettingsSection;
}> = [
  {
    key: 'identity',
    title: '身份设置',
    description: '配置助手名称、表情和介绍风格',
    icon: UserCircle,
    section: 'identity',
  },
  {
    key: 'userProfile',
    title: '用户资料',
    description: '设置称呼、语言、时区与主要用途',
    icon: User,
    section: 'user-profile',
  },
  {
    key: 'soulPersona',
    title: '人格配置',
    description: '定义语气、澄清策略和决策风格',
    icon: Sparkles,
    section: 'soul-persona',
  },
  {
    key: 'channelPreference',
    title: '渠道偏好',
    description: '选择默认渠道和通知策略',
    icon: MessageSquare,
    section: 'channel-preference',
  },
  {
    key: 'safetyDefaults',
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
        <h1 className="mb-2 text-2xl text-zinc-900 dark:text-zinc-100">引导目标（可选）</h1>
        <p className="text-zinc-500 dark:text-zinc-400">这些配置均为可选，不影响立即开始使用。</p>
      </div>

      <div className="space-y-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => onNavigate(card.section)}
              className="group flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Icon className="h-6 w-6 text-zinc-800 dark:text-zinc-200" />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-base text-zinc-900 dark:text-zinc-100">{card.title}</h3>
                  <StatusBadge status={settings.configStatuses[card.key]} />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{card.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
