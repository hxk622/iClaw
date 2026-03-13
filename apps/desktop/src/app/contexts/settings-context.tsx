import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  loadIclawWorkspaceFiles,
  onIclawWorkspaceUpdated,
  type IclawWorkspaceFiles,
} from '@/app/lib/iclaw-settings';
import { applyThemeMode, persistThemeMode, readStoredThemeMode, type ThemeMode } from '@/app/lib/theme';

export type ConfigStatus = 'not-configured' | 'using-default' | 'customized';
export type PersistableSettingsSection =
  | 'appearance'
  | 'general'
  | 'identity'
  | 'user-profile'
  | 'soul-persona'
  | 'channel-preference'
  | 'safety-defaults';

export type IdentityConfig = {
  markdownContent: string;
};

export type AppearanceConfig = {
  themeMode: 'light' | 'dark' | 'system';
};

export type GeneralConfig = {
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
  appearance: AppearanceConfig;
  general: GeneralConfig;
  identity: IdentityConfig;
  userProfile: UserProfileConfig;
  soulPersona: SoulPersonaConfig;
  channelPreference: ChannelPreferenceConfig;
  safetyDefaults: SafetyDefaultsConfig;
  configStatuses: {
    appearance: ConfigStatus;
    general: ConfigStatus;
    identity: ConfigStatus;
    userProfile: ConfigStatus;
    soulPersona: ConfigStatus;
    channelPreference: ConfigStatus;
    safetyDefaults: ConfigStatus;
  };
  workspaceDir: string;
  dirtySections: Record<PersistableSettingsSection, boolean>;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
};

type SettingsContextType = {
  settings: SettingsState;
  updateAppearance: (config: Partial<AppearanceConfig>) => void;
  updateGeneral: (config: Partial<GeneralConfig>) => void;
  updateIdentity: (config: Partial<IdentityConfig>) => void;
  updateUserProfile: (config: Partial<UserProfileConfig>) => void;
  updateSoulPersona: (config: Partial<SoulPersonaConfig>) => void;
  updateChannelPreference: (config: Partial<ChannelPreferenceConfig>) => void;
  updateSafetyDefaults: (config: Partial<SafetyDefaultsConfig>) => void;
  hasUnsavedChangesForSection: (section: PersistableSettingsSection) => boolean;
  buildSectionSaveSnapshot: (section: PersistableSettingsSection) => SettingsState;
  commitSectionSave: (section: PersistableSettingsSection) => void;
  resetSettings: (section: PersistableSettingsSection) => void;
};

const LOCAL_STORAGE_KEY = 'iclaw-settings';
const emptyDirtySections = (): Record<PersistableSettingsSection, boolean> => ({
  appearance: false,
  general: false,
  identity: false,
  'user-profile': false,
  'soul-persona': false,
  'channel-preference': false,
  'safety-defaults': false,
});

const hasDirtySections = (dirtySections: Record<PersistableSettingsSection, boolean>) =>
  Object.values(dirtySections).some(Boolean);

const defaultSettings: SettingsState = {
  appearance: {
    themeMode: 'system',
  },
  general: {
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
    appearance: 'using-default',
    general: 'using-default',
    identity: 'using-default',
    userProfile: 'using-default',
    soulPersona: 'using-default',
    channelPreference: 'using-default',
    safetyDefaults: 'using-default',
  },
  workspaceDir: '',
  dirtySections: emptyDirtySections(),
  hasUnsavedChanges: false,
  isLoading: true,
};

type PersistedSettings = Pick<
  SettingsState,
  'appearance' | 'general' | 'channelPreference' | 'safetyDefaults' | 'configStatuses'
>;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function readPersistedSettings(): PersistedSettings {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  const storedTheme = readStoredThemeMode();
  if (!saved) {
    return {
      appearance: { themeMode: storedTheme },
      general: defaultSettings.general,
      channelPreference: defaultSettings.channelPreference,
      safetyDefaults: defaultSettings.safetyDefaults,
      configStatuses: defaultSettings.configStatuses,
    };
  }
  try {
    const parsed = JSON.parse(saved) as Partial<PersistedSettings> & {
      general?: Partial<GeneralConfig> & { themeMode?: ThemeMode };
    };
    const legacyTheme = parsed.general?.themeMode;
    return {
      appearance: {
        themeMode: parsed.appearance?.themeMode || legacyTheme || storedTheme,
      },
      general: {
        ...defaultSettings.general,
        ...parsed.general,
      },
      channelPreference: {
        ...defaultSettings.channelPreference,
        ...parsed.channelPreference,
      },
      safetyDefaults: {
        ...defaultSettings.safetyDefaults,
        ...parsed.safetyDefaults,
      },
      configStatuses: {
        ...defaultSettings.configStatuses,
        ...parsed.configStatuses,
      },
    };
  } catch {
    return {
      appearance: { themeMode: storedTheme },
      general: defaultSettings.general,
      channelPreference: defaultSettings.channelPreference,
      safetyDefaults: defaultSettings.safetyDefaults,
      configStatuses: defaultSettings.configStatuses,
    };
  }
}

function mergeWorkspaceFiles(
  current: SettingsState,
  workspaceFiles: IclawWorkspaceFiles,
): SettingsState {
  return {
    ...current,
    identity: current.dirtySections.identity ? current.identity : { markdownContent: workspaceFiles.identity_md },
    userProfile: current.dirtySections['user-profile']
      ? current.userProfile
      : { markdownContent: workspaceFiles.user_md },
    soulPersona: current.dirtySections['soul-persona']
      ? current.soulPersona
      : { markdownContent: workspaceFiles.soul_md },
    workspaceDir: workspaceFiles.workspace_dir,
    hasUnsavedChanges: hasDirtySections(current.dirtySections),
    isLoading: false,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lastWorkspaceFiles, setLastWorkspaceFiles] = useState<IclawWorkspaceFiles | null>(null);
  const [savedPersistedSettings, setSavedPersistedSettings] = useState<PersistedSettings>(() => readPersistedSettings());
  const [settings, setSettings] = useState<SettingsState>(() => {
    const persisted = readPersistedSettings();
    return { ...defaultSettings, ...persisted, dirtySections: emptyDirtySections(), isLoading: true };
  });

  useEffect(() => {
    let cancelled = false;

    const refreshWorkspace = () => {
      void loadIclawWorkspaceFiles()
        .then((workspaceFiles) => {
          if (cancelled) return;
          if (!workspaceFiles) {
            setSettings((prev) => ({ ...prev, isLoading: false }));
            return;
          }
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

  useEffect(() => {
    applyThemeMode(settings.appearance.themeMode);
  }, [settings.appearance.themeMode]);

  useEffect(() => {
    if (settings.appearance.themeMode !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyThemeMode('system');
    };
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [settings.appearance.themeMode]);

  const updateAppearance = (config: Partial<AppearanceConfig>) => {
    setSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...config },
      configStatuses: { ...prev.configStatuses, appearance: 'customized' },
      dirtySections: { ...prev.dirtySections, appearance: true },
      hasUnsavedChanges: true,
    }));
  };

  const updateIdentity = (config: Partial<IdentityConfig>) => {
    setSettings((prev) => ({
      ...prev,
      identity: { ...prev.identity, ...config },
      configStatuses: { ...prev.configStatuses, identity: 'customized' },
      dirtySections: { ...prev.dirtySections, identity: true },
      hasUnsavedChanges: true,
    }));
  };

  const updateGeneral = (config: Partial<GeneralConfig>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...config },
      configStatuses: { ...prev.configStatuses, general: 'customized' },
      dirtySections: { ...prev.dirtySections, general: true },
      hasUnsavedChanges: true,
    }));
  };

  const updateUserProfile = (config: Partial<UserProfileConfig>) => {
    setSettings((prev) => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...config },
      configStatuses: { ...prev.configStatuses, userProfile: 'customized' },
      dirtySections: { ...prev.dirtySections, 'user-profile': true },
      hasUnsavedChanges: true,
    }));
  };

  const updateSoulPersona = (config: Partial<SoulPersonaConfig>) => {
    setSettings((prev) => ({
      ...prev,
      soulPersona: { ...prev.soulPersona, ...config },
      configStatuses: { ...prev.configStatuses, soulPersona: 'customized' },
      dirtySections: { ...prev.dirtySections, 'soul-persona': true },
      hasUnsavedChanges: true,
    }));
  };

  const updateChannelPreference = (config: Partial<ChannelPreferenceConfig>) => {
    setSettings((prev) => ({
      ...prev,
      channelPreference: { ...prev.channelPreference, ...config },
      configStatuses: { ...prev.configStatuses, channelPreference: 'customized' },
      dirtySections: { ...prev.dirtySections, 'channel-preference': true },
      hasUnsavedChanges: true,
    }));
  };

  const updateSafetyDefaults = (config: Partial<SafetyDefaultsConfig>) => {
    setSettings((prev) => ({
      ...prev,
      safetyDefaults: { ...prev.safetyDefaults, ...config },
      configStatuses: { ...prev.configStatuses, safetyDefaults: 'customized' },
      dirtySections: { ...prev.dirtySections, 'safety-defaults': true },
      hasUnsavedChanges: true,
    }));
  };

  const hasUnsavedChangesForSection = (section: PersistableSettingsSection) => settings.dirtySections[section];

  const buildSectionSaveSnapshot = (section: PersistableSettingsSection): SettingsState => ({
    ...settings,
    appearance: section === 'appearance' ? settings.appearance : savedPersistedSettings.appearance,
    general: section === 'general' ? settings.general : savedPersistedSettings.general,
    identity:
      section === 'identity'
        ? settings.identity
        : { markdownContent: lastWorkspaceFiles?.identity_md ?? settings.identity.markdownContent },
    userProfile:
      section === 'user-profile'
        ? settings.userProfile
        : { markdownContent: lastWorkspaceFiles?.user_md ?? settings.userProfile.markdownContent },
    soulPersona:
      section === 'soul-persona'
        ? settings.soulPersona
        : { markdownContent: lastWorkspaceFiles?.soul_md ?? settings.soulPersona.markdownContent },
    channelPreference:
      section === 'channel-preference' ? settings.channelPreference : savedPersistedSettings.channelPreference,
    safetyDefaults:
      section === 'safety-defaults' ? settings.safetyDefaults : savedPersistedSettings.safetyDefaults,
    configStatuses: {
      ...settings.configStatuses,
      appearance:
        section === 'appearance' ? settings.configStatuses.appearance : savedPersistedSettings.configStatuses.appearance,
      general: section === 'general' ? settings.configStatuses.general : savedPersistedSettings.configStatuses.general,
      channelPreference:
        section === 'channel-preference'
          ? settings.configStatuses.channelPreference
          : savedPersistedSettings.configStatuses.channelPreference,
      safetyDefaults:
        section === 'safety-defaults'
          ? settings.configStatuses.safetyDefaults
          : savedPersistedSettings.configStatuses.safetyDefaults,
    },
    dirtySections: emptyDirtySections(),
    hasUnsavedChanges: false,
    isLoading: false,
  });

  const commitSectionSave = (section: PersistableSettingsSection) => {
    if (section === 'appearance' || section === 'general' || section === 'channel-preference' || section === 'safety-defaults') {
      setSavedPersistedSettings((prev) => {
        const next: PersistedSettings = {
          appearance: section === 'appearance' ? settings.appearance : prev.appearance,
          general: section === 'general' ? settings.general : prev.general,
          channelPreference:
            section === 'channel-preference' ? settings.channelPreference : prev.channelPreference,
          safetyDefaults: section === 'safety-defaults' ? settings.safetyDefaults : prev.safetyDefaults,
          configStatuses: {
            ...prev.configStatuses,
            appearance: section === 'appearance' ? settings.configStatuses.appearance : prev.configStatuses.appearance,
            general: section === 'general' ? settings.configStatuses.general : prev.configStatuses.general,
            channelPreference:
              section === 'channel-preference'
                ? settings.configStatuses.channelPreference
                : prev.configStatuses.channelPreference,
            safetyDefaults:
              section === 'safety-defaults'
                ? settings.configStatuses.safetyDefaults
                : prev.configStatuses.safetyDefaults,
          },
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    if (section === 'appearance') {
      persistThemeMode(settings.appearance.themeMode);
    }

    if (section === 'identity' || section === 'user-profile' || section === 'soul-persona') {
      setLastWorkspaceFiles((prev) => ({
        workspace_dir: settings.workspaceDir,
        identity_md:
          section === 'identity' ? settings.identity.markdownContent : (prev?.identity_md ?? settings.identity.markdownContent),
        user_md:
          section === 'user-profile'
            ? settings.userProfile.markdownContent
            : (prev?.user_md ?? settings.userProfile.markdownContent),
        soul_md:
          section === 'soul-persona'
            ? settings.soulPersona.markdownContent
            : (prev?.soul_md ?? settings.soulPersona.markdownContent),
        agents_md: prev?.agents_md ?? '',
        finance_decision_framework_md: prev?.finance_decision_framework_md ?? '',
      }));
    }

    setSettings((prev) => {
      const dirtySections = { ...prev.dirtySections, [section]: false };
      return {
        ...prev,
        dirtySections,
        hasUnsavedChanges: hasDirtySections(dirtySections),
      };
    });
  };

  const resetSettings = (section: PersistableSettingsSection) => {
    setSettings((prev) => {
      const dirtySections = { ...prev.dirtySections, [section]: false };
      return {
        ...prev,
        appearance: section === 'appearance' ? savedPersistedSettings.appearance : prev.appearance,
        general: section === 'general' ? savedPersistedSettings.general : prev.general,
        identity:
          section === 'identity'
            ? { markdownContent: lastWorkspaceFiles?.identity_md ?? defaultSettings.identity.markdownContent }
            : prev.identity,
        userProfile:
          section === 'user-profile'
            ? { markdownContent: lastWorkspaceFiles?.user_md ?? defaultSettings.userProfile.markdownContent }
            : prev.userProfile,
        soulPersona:
          section === 'soul-persona'
            ? { markdownContent: lastWorkspaceFiles?.soul_md ?? defaultSettings.soulPersona.markdownContent }
            : prev.soulPersona,
        channelPreference:
          section === 'channel-preference' ? savedPersistedSettings.channelPreference : prev.channelPreference,
        safetyDefaults:
          section === 'safety-defaults' ? savedPersistedSettings.safetyDefaults : prev.safetyDefaults,
        configStatuses: {
          ...prev.configStatuses,
          appearance:
            section === 'appearance' ? savedPersistedSettings.configStatuses.appearance : prev.configStatuses.appearance,
          general: section === 'general' ? savedPersistedSettings.configStatuses.general : prev.configStatuses.general,
          channelPreference:
            section === 'channel-preference'
              ? savedPersistedSettings.configStatuses.channelPreference
              : prev.configStatuses.channelPreference,
          safetyDefaults:
            section === 'safety-defaults'
              ? savedPersistedSettings.configStatuses.safetyDefaults
              : prev.configStatuses.safetyDefaults,
        },
        dirtySections,
        hasUnsavedChanges: hasDirtySections(dirtySections),
      };
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateAppearance,
        updateGeneral,
        updateIdentity,
        updateUserProfile,
        updateSoulPersona,
        updateChannelPreference,
        updateSafetyDefaults,
        hasUnsavedChangesForSection,
        buildSectionSaveSnapshot,
        commitSectionSave,
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
