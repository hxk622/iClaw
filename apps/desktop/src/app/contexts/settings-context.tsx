import { type ReactNode, createContext, useContext, useState } from 'react';

export type ConfigStatus = 'not-configured' | 'using-default' | 'customized';

export type IdentityConfig = {
  assistantName: string;
  emoji: string;
  theme: string;
  selfIntroStyle: string;
};

export type UserProfileConfig = {
  preferredName: string;
  language: string;
  timezone: string;
  workRole: string;
  primaryUseCase: string;
  responseLengthPreference: string;
};

export type SoulPersonaConfig = {
  mode: 'default' | 'wizard' | 'markdown';
  tone: string;
  clarificationPolicy: string;
  riskPolicy: string;
  decisionStyle: string;
  markdownContent: string;
};

export type ChannelPreferenceConfig = {
  defaultChannel: 'web' | 'whatsapp' | 'telegram';
  notificationLevel: string;
  messageFormat: string;
  syncToIM: boolean;
  imTarget: string;
};

export type SafetyDefaultsConfig = {
  systemRunMode: 'ask' | 'allow' | 'deny';
  dangerousActionConfirmation: boolean;
  networkAccessPolicy: string;
  fileAccessScope: string;
  toolFallbackPolicy: string;
};

export type SettingsState = {
  identity: IdentityConfig;
  userProfile: UserProfileConfig;
  soulPersona: SoulPersonaConfig;
  channelPreference: ChannelPreferenceConfig;
  safetyDefaults: SafetyDefaultsConfig;
  configStatuses: {
    identity: ConfigStatus;
    userProfile: ConfigStatus;
    soulPersona: ConfigStatus;
    channelPreference: ConfigStatus;
    safetyDefaults: ConfigStatus;
  };
  hasUnsavedChanges: boolean;
};

type SettingsContextType = {
  settings: SettingsState;
  updateIdentity: (config: Partial<IdentityConfig>) => void;
  updateUserProfile: (config: Partial<UserProfileConfig>) => void;
  updateSoulPersona: (config: Partial<SoulPersonaConfig>) => void;
  updateChannelPreference: (config: Partial<ChannelPreferenceConfig>) => void;
  updateSafetyDefaults: (config: Partial<SafetyDefaultsConfig>) => void;
  saveSettings: () => void;
  resetSettings: () => void;
};

const defaultSettings: SettingsState = {
  identity: {
    assistantName: 'iClaw 助手',
    emoji: '🐾',
    theme: '专业',
    selfIntroStyle: '友好',
  },
  userProfile: {
    preferredName: '',
    language: '中文',
    timezone: 'Asia/Shanghai',
    workRole: '',
    primaryUseCase: '',
    responseLengthPreference: '中等',
  },
  soulPersona: {
    mode: 'default',
    tone: '平衡',
    clarificationPolicy: '不清楚时询问',
    riskPolicy: '保守',
    decisionStyle: '协作式',
    markdownContent: '',
  },
  channelPreference: {
    defaultChannel: 'web',
    notificationLevel: '正常',
    messageFormat: 'Markdown',
    syncToIM: false,
    imTarget: '',
  },
  safetyDefaults: {
    systemRunMode: 'ask',
    dangerousActionConfirmation: true,
    networkAccessPolicy: '询问',
    fileAccessScope: '受限',
    toolFallbackPolicy: '优雅降级',
  },
  configStatuses: {
    identity: 'using-default',
    userProfile: 'not-configured',
    soulPersona: 'using-default',
    channelPreference: 'using-default',
    safetyDefaults: 'using-default',
  },
  hasUnsavedChanges: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('iclaw-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const updateIdentity = (config: Partial<IdentityConfig>) => {
    setSettings((prev) => ({
      ...prev,
      identity: { ...prev.identity, ...config },
      configStatuses: { ...prev.configStatuses, identity: 'customized' },
      hasUnsavedChanges: true,
    }));
  };

  const updateUserProfile = (config: Partial<UserProfileConfig>) => {
    setSettings((prev) => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...config },
      configStatuses: { ...prev.configStatuses, userProfile: 'customized' },
      hasUnsavedChanges: true,
    }));
  };

  const updateSoulPersona = (config: Partial<SoulPersonaConfig>) => {
    setSettings((prev) => ({
      ...prev,
      soulPersona: { ...prev.soulPersona, ...config },
      configStatuses: {
        ...prev.configStatuses,
        soulPersona: config.mode === 'default' ? 'using-default' : 'customized',
      },
      hasUnsavedChanges: true,
    }));
  };

  const updateChannelPreference = (config: Partial<ChannelPreferenceConfig>) => {
    setSettings((prev) => ({
      ...prev,
      channelPreference: { ...prev.channelPreference, ...config },
      configStatuses: { ...prev.configStatuses, channelPreference: 'customized' },
      hasUnsavedChanges: true,
    }));
  };

  const updateSafetyDefaults = (config: Partial<SafetyDefaultsConfig>) => {
    setSettings((prev) => ({
      ...prev,
      safetyDefaults: { ...prev.safetyDefaults, ...config },
      configStatuses: { ...prev.configStatuses, safetyDefaults: 'customized' },
      hasUnsavedChanges: true,
    }));
  };

  const saveSettings = () => {
    localStorage.setItem('iclaw-settings', JSON.stringify(settings));
    setSettings((prev) => ({ ...prev, hasUnsavedChanges: false }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('iclaw-settings');
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateIdentity,
        updateUserProfile,
        updateSoulPersona,
        updateChannelPreference,
        updateSafetyDefaults,
        saveSettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
