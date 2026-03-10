import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  loadIclawWorkspaceFiles,
  onIclawWorkspaceUpdated,
  type IclawWorkspaceFiles,
} from '@/app/lib/iclaw-settings';

export type ConfigStatus = 'not-configured' | 'using-default' | 'customized';

export type IdentityConfig = {
  markdownContent: string;
};

export type GeneralConfig = {
  themeMode: 'light' | 'dark' | 'system';
  language: string;
  startupBehavior: string;
  updateStrategy: string;
};

export type UserProfileConfig = {
  markdownContent: string;
};

export type SoulPersonaConfig = {
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
  general: GeneralConfig;
  identity: IdentityConfig;
  userProfile: UserProfileConfig;
  soulPersona: SoulPersonaConfig;
  channelPreference: ChannelPreferenceConfig;
  safetyDefaults: SafetyDefaultsConfig;
  configStatuses: {
    general: ConfigStatus;
    identity: ConfigStatus;
    userProfile: ConfigStatus;
    soulPersona: ConfigStatus;
    channelPreference: ConfigStatus;
    safetyDefaults: ConfigStatus;
  };
  workspaceDir: string;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
};

type SettingsContextType = {
  settings: SettingsState;
  updateGeneral: (config: Partial<GeneralConfig>) => void;
  updateIdentity: (config: Partial<IdentityConfig>) => void;
  updateUserProfile: (config: Partial<UserProfileConfig>) => void;
  updateSoulPersona: (config: Partial<SoulPersonaConfig>) => void;
  updateChannelPreference: (config: Partial<ChannelPreferenceConfig>) => void;
  updateSafetyDefaults: (config: Partial<SafetyDefaultsConfig>) => void;
  saveSettings: () => void;
  resetSettings: () => void;
};

const LOCAL_STORAGE_KEY = 'iclaw-settings';

const defaultSettings: SettingsState = {
  general: {
    themeMode: 'light',
    language: '简体中文',
    startupBehavior: '即将支持',
    updateStrategy: '即将支持',
  },
  identity: {
    markdownContent: '',
  },
  userProfile: {
    markdownContent: '',
  },
  soulPersona: {
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
    general: 'using-default',
    identity: 'using-default',
    userProfile: 'using-default',
    soulPersona: 'using-default',
    channelPreference: 'using-default',
    safetyDefaults: 'using-default',
  },
  workspaceDir: '',
  hasUnsavedChanges: false,
  isLoading: true,
};

type PersistedSettings = Pick<
  SettingsState,
  'general' | 'channelPreference' | 'safetyDefaults' | 'configStatuses'
>;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function readPersistedSettings(): PersistedSettings | null {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as PersistedSettings;
  } catch {
    return null;
  }
}

function mergeWorkspaceFiles(
  current: SettingsState,
  workspaceFiles: IclawWorkspaceFiles,
): SettingsState {
  return {
    ...current,
    identity: { markdownContent: workspaceFiles.identity_md },
    userProfile: { markdownContent: workspaceFiles.user_md },
    soulPersona: { markdownContent: workspaceFiles.soul_md },
    workspaceDir: workspaceFiles.workspace_dir,
    configStatuses: {
      ...current.configStatuses,
      identity: 'using-default',
      userProfile: 'using-default',
      soulPersona: 'using-default',
    },
    hasUnsavedChanges: false,
    isLoading: false,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lastWorkspaceFiles, setLastWorkspaceFiles] = useState<IclawWorkspaceFiles | null>(null);
  const [settings, setSettings] = useState<SettingsState>(() => {
    const persisted = readPersistedSettings();
    return persisted ? { ...defaultSettings, ...persisted, isLoading: true } : defaultSettings;
  });

  useEffect(() => {
    let cancelled = false;

    const refreshWorkspace = () => {
      void loadIclawWorkspaceFiles()
        .then((workspaceFiles) => {
          if (cancelled || !workspaceFiles) return;
          setLastWorkspaceFiles(workspaceFiles);
          setSettings((prev) => mergeWorkspaceFiles(prev, workspaceFiles));
        })
        .catch(() => {
          if (cancelled) return;
          setSettings((prev) => ({ ...prev, isLoading: false }));
        });
    };

    refreshWorkspace();
    const unsubscribe = onIclawWorkspaceUpdated(refreshWorkspace);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const updateIdentity = (config: Partial<IdentityConfig>) => {
    setSettings((prev) => ({
      ...prev,
      identity: { ...prev.identity, ...config },
      configStatuses: { ...prev.configStatuses, identity: 'customized' },
      hasUnsavedChanges: true,
    }));
  };

  const updateGeneral = (config: Partial<GeneralConfig>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...config },
      configStatuses: { ...prev.configStatuses, general: 'customized' },
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
      configStatuses: { ...prev.configStatuses, soulPersona: 'customized' },
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
    const persisted: PersistedSettings = {
      general: settings.general,
      channelPreference: settings.channelPreference,
      safetyDefaults: settings.safetyDefaults,
      configStatuses: settings.configStatuses,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(persisted));
    setLastWorkspaceFiles({
      workspace_dir: settings.workspaceDir,
      identity_md: settings.identity.markdownContent,
      user_md: settings.userProfile.markdownContent,
      soul_md: settings.soulPersona.markdownContent,
      agents_md: '',
      finance_decision_framework_md: '',
    });
    setSettings((prev) => ({ ...prev, hasUnsavedChanges: false }));
  };

  const resetSettings = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSettings((prev) => {
      if (!lastWorkspaceFiles) {
        return {
          ...defaultSettings,
          workspaceDir: prev.workspaceDir,
          isLoading: false,
        };
      }

      return {
        ...defaultSettings,
        general: prev.general,
        channelPreference: prev.channelPreference,
        safetyDefaults: prev.safetyDefaults,
        configStatuses: {
          ...defaultSettings.configStatuses,
          general: prev.configStatuses.general,
          channelPreference: prev.configStatuses.channelPreference,
          safetyDefaults: prev.configStatuses.safetyDefaults,
          identity: 'using-default',
          userProfile: 'using-default',
          soulPersona: 'using-default',
        },
        workspaceDir: lastWorkspaceFiles.workspace_dir,
        identity: { markdownContent: lastWorkspaceFiles.identity_md },
        userProfile: { markdownContent: lastWorkspaceFiles.user_md },
        soulPersona: { markdownContent: lastWorkspaceFiles.soul_md },
        hasUnsavedChanges: false,
        isLoading: false,
      };
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateGeneral,
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
