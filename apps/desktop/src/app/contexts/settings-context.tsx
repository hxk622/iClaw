import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  loadIclawWorkspaceFiles,
  onIclawWorkspaceUpdated,
  type IclawWorkspaceFiles,
} from '@/app/lib/iclaw-settings';
import {
  applyGeneralPreferences,
  DEFAULT_GENERAL_PREFERENCES,
  type ContentFontSize,
  type GeneralLanguage,
  type LayoutPreset,
  type MessageAlignment,
} from '@/app/lib/general-preferences';
import {
  applyThemeMode,
  normalizeThemeModePreference,
  readStoredThemeMode,
  type ThemeMode,
} from '@/app/lib/theme';
import {
  DESKTOP_CONFIG_SECTION_SETTINGS,
  DESKTOP_CONFIG_SECTION_THEME,
  buildExplicitThemeConfig,
  readDesktopConfigSection,
  writeDesktopConfigSection,
} from '@/app/lib/persistence/config-store';

export type ConfigStatus = 'not-configured' | 'using-default' | 'customized';
export type PersistableSettingsSection =
  | 'general'
  | 'identity'
  | 'user-profile'
  | 'soul-persona';
export type SettingsSection = PersistableSettingsSection | 'version';

export type IdentityConfig = {
  markdownContent: string;
};

export type GeneralConfig = {
  themeMode: ThemeMode;
  contentFontSize: ContentFontSize;
  language: GeneralLanguage;
  layoutPreset: LayoutPreset;
  messageAlignment: MessageAlignment;
  updateStrategy: 'notify' | 'force';
};

export type UserProfileConfig = {
  markdownContent: string;
};

export type SoulPersonaConfig = {
  markdownContent: string;
};

export type SettingsState = {
  general: GeneralConfig;
  identity: IdentityConfig;
  userProfile: UserProfileConfig;
  soulPersona: SoulPersonaConfig;
  configStatuses: {
    general: ConfigStatus;
    identity: ConfigStatus;
    userProfile: ConfigStatus;
    soulPersona: ConfigStatus;
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
  hasUnsavedChangesForSection: (section: PersistableSettingsSection) => boolean;
  buildSectionSaveSnapshot: (section: PersistableSettingsSection) => SettingsState;
  commitSectionSave: (section: PersistableSettingsSection) => Promise<void>;
  resetSettings: (section: PersistableSettingsSection) => void;
};

const emptyDirtySections = (): Record<PersistableSettingsSection, boolean> => ({
  general: false,
  identity: false,
  'user-profile': false,
  'soul-persona': false,
});

const hasDirtySections = (dirtySections: Record<PersistableSettingsSection, boolean>) =>
  Object.values(dirtySections).some(Boolean);

const defaultSettings: SettingsState = {
  general: {
    themeMode: 'system',
    ...DEFAULT_GENERAL_PREFERENCES,
    updateStrategy: 'notify',
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
  configStatuses: {
    general: 'using-default',
    identity: 'using-default',
    userProfile: 'using-default',
    soulPersona: 'using-default',
  },
  workspaceDir: '',
  dirtySections: emptyDirtySections(),
  hasUnsavedChanges: false,
  isLoading: true,
};

type PersistedSettings = Pick<SettingsState, 'general' | 'configStatuses'>;

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function readPersistedSettings(): PersistedSettings {
  const parsed = readDesktopConfigSection<Partial<PersistedSettings> & {
    appearance?: { themeMode?: ThemeMode };
    general?: Partial<GeneralConfig>;
  }>(DESKTOP_CONFIG_SECTION_SETTINGS);
  const storedTheme = readStoredThemeMode();
  if (!parsed) {
    return {
      general: { ...defaultSettings.general, themeMode: storedTheme },
      configStatuses: defaultSettings.configStatuses,
    };
  }
  const legacyTheme = parsed.appearance?.themeMode;
  return {
    general: {
      ...defaultSettings.general,
      ...parsed.general,
      themeMode: normalizeThemeModePreference(parsed.general?.themeMode ?? legacyTheme, storedTheme),
    },
    configStatuses: {
      ...defaultSettings.configStatuses,
      ...parsed.configStatuses,
    },
  };
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
    applyGeneralPreferences(settings.general);
  }, [
    settings.general.contentFontSize,
    settings.general.language,
    settings.general.layoutPreset,
    settings.general.messageAlignment,
    settings.general.toolCardTone,
  ]);

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
    configStatuses: {
      ...settings.configStatuses,
      general: section === 'general' ? settings.configStatuses.general : savedPersistedSettings.configStatuses.general,
    },
    dirtySections: emptyDirtySections(),
    hasUnsavedChanges: false,
    isLoading: false,
  });

  const commitSectionSave = async (section: PersistableSettingsSection) => {
    if (section === 'general') {
      const next: PersistedSettings = {
        general: settings.general,
        configStatuses: {
          ...savedPersistedSettings.configStatuses,
          general: settings.configStatuses.general,
        },
      };
      setSavedPersistedSettings(next);
      await writeDesktopConfigSection(DESKTOP_CONFIG_SECTION_SETTINGS, next);
      await writeDesktopConfigSection(DESKTOP_CONFIG_SECTION_THEME, buildExplicitThemeConfig(settings.general.themeMode));
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
        configStatuses: {
          ...prev.configStatuses,
          general: section === 'general' ? savedPersistedSettings.configStatuses.general : prev.configStatuses.general,
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
