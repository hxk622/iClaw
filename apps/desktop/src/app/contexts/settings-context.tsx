import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  loadIclawWorkspaceFiles,
  onIclawWorkspaceUpdated,
  type IclawWorkspaceFiles,
} from '@/app/lib/iclaw-settings';
import { SETTINGS_STORAGE_KEY } from '@/app/lib/storage';
import { applyThemeMode, persistThemeMode, readStoredThemeMode, type ThemeMode } from '@/app/lib/theme';

export type ConfigStatus = 'not-configured' | 'using-default' | 'customized';
export type PersistableSettingsSection =
  | 'general'
  | 'identity'
  | 'user-profile'
  | 'soul-persona'
  | 'safety-defaults';

export type IdentityConfig = {
  markdownContent: string;
};

export type GeneralConfig = {
  themeMode: ThemeMode;
};

export type UserProfileConfig = {
  markdownContent: string;
};

export type SoulPersonaConfig = {
  markdownContent: string;
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
  safetyDefaults: SafetyDefaultsConfig;
  configStatuses: {
    general: ConfigStatus;
    identity: ConfigStatus;
    userProfile: ConfigStatus;
    soulPersona: ConfigStatus;
    safetyDefaults: ConfigStatus;
  };
  workspaceDir: string;
  dirtySections: Record<PersistableSettingsSection, boolean>;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
};

type SettingsContextType = {
  settings: SettingsState;
  updateGeneral: (config: Partial<GeneralConfig>) => void;
  updateIdentity: (config: Partial<IdentityConfig>) => void;
  updateUserProfile: (config: Partial<UserProfileConfig>) => void;
  updateSoulPersona: (config: Partial<SoulPersonaConfig>) => void;
  updateSafetyDefaults: (config: Partial<SafetyDefaultsConfig>) => void;
  hasUnsavedChangesForSection: (section: PersistableSettingsSection) => boolean;
  buildSectionSaveSnapshot: (section: PersistableSettingsSection) => SettingsState;
  commitSectionSave: (section: PersistableSettingsSection) => void;
  resetSettings: (section: PersistableSettingsSection) => void;
};

const emptyDirtySections = (): Record<PersistableSettingsSection, boolean> => ({
  general: false,
  identity: false,
  'user-profile': false,
  'soul-persona': false,
  'safety-defaults': false,
});

const hasDirtySections = (dirtySections: Record<PersistableSettingsSection, boolean>) =>
  Object.values(dirtySections).some(Boolean);

const defaultSettings: SettingsState = {
  general: {
    themeMode: 'system',
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
    safetyDefaults: 'using-default',
  },
  workspaceDir: '',
  dirtySections: emptyDirtySections(),
  hasUnsavedChanges: false,
  isLoading: true,
};

type PersistedSettings = Pick<SettingsState, 'general' | 'safetyDefaults' | 'configStatuses'>;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function readPersistedSettings(): PersistedSettings {
  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
  const storedTheme = readStoredThemeMode();
  if (!saved) {
    return {
      general: { themeMode: storedTheme },
      safetyDefaults: defaultSettings.safetyDefaults,
      configStatuses: defaultSettings.configStatuses,
    };
  }
  try {
    const parsed = JSON.parse(saved) as Partial<PersistedSettings> & {
      appearance?: { themeMode?: ThemeMode };
      general?: Partial<GeneralConfig>;
    };
    const legacyTheme = parsed.appearance?.themeMode;
    return {
      general: {
        ...defaultSettings.general,
        ...parsed.general,
        themeMode: parsed.general?.themeMode || legacyTheme || storedTheme,
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
      general: { themeMode: storedTheme },
      safetyDefaults: defaultSettings.safetyDefaults,
      configStatuses: defaultSettings.configStatuses,
    };
  }
}

function mergeWorkspaceFiles(current: SettingsState, workspaceFiles: IclawWorkspaceFiles): SettingsState {
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
    applyThemeMode(settings.general.themeMode);
  }, [settings.general.themeMode]);

  useEffect(() => {
    if (settings.general.themeMode !== 'system') {
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
  }, [settings.general.themeMode]);

  const updateGeneral = (config: Partial<GeneralConfig>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...config },
      configStatuses: { ...prev.configStatuses, general: 'customized' },
      dirtySections: { ...prev.dirtySections, general: true },
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
    safetyDefaults:
      section === 'safety-defaults' ? settings.safetyDefaults : savedPersistedSettings.safetyDefaults,
    configStatuses: {
      ...settings.configStatuses,
      general: section === 'general' ? settings.configStatuses.general : savedPersistedSettings.configStatuses.general,
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
    if (section === 'general' || section === 'safety-defaults') {
      setSavedPersistedSettings((prev) => {
        const next: PersistedSettings = {
          general: section === 'general' ? settings.general : prev.general,
          safetyDefaults: section === 'safety-defaults' ? settings.safetyDefaults : prev.safetyDefaults,
          configStatuses: {
            ...prev.configStatuses,
            general: section === 'general' ? settings.configStatuses.general : prev.configStatuses.general,
            safetyDefaults:
              section === 'safety-defaults'
                ? settings.configStatuses.safetyDefaults
                : prev.configStatuses.safetyDefaults,
          },
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    if (section === 'general') {
      persistThemeMode(settings.general.themeMode);
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
        safetyDefaults:
          section === 'safety-defaults' ? savedPersistedSettings.safetyDefaults : prev.safetyDefaults,
        configStatuses: {
          ...prev.configStatuses,
          general: section === 'general' ? savedPersistedSettings.configStatuses.general : prev.configStatuses.general,
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
        updateGeneral,
        updateIdentity,
        updateUserProfile,
        updateSoulPersona,
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
