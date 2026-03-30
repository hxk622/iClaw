export type ContentFontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type GeneralLanguage = 'zh' | 'en';
export type LayoutPreset = 'standard' | 'compact' | 'column';
export type MessageAlignment = 'left' | 'sided';

export interface GeneralPreferences {
  contentFontSize: ContentFontSize;
  language: GeneralLanguage;
  layoutPreset: LayoutPreset;
  messageAlignment: MessageAlignment;
}

export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = {
  contentFontSize: 'large',
  language: 'zh',
  layoutPreset: 'standard',
  messageAlignment: 'sided',
};

export function resolveAppLocale(language: GeneralLanguage): 'zh-CN' | 'en-US' {
  return language === 'en' ? 'en-US' : 'zh-CN';
}

export function readAppLocale(): string {
  if (typeof document === 'undefined') {
    return resolveAppLocale(DEFAULT_GENERAL_PREFERENCES.language);
  }
  return document.documentElement.lang || resolveAppLocale(DEFAULT_GENERAL_PREFERENCES.language);
}

export function applyGeneralPreferences(preferences: GeneralPreferences): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset.contentFontSize = preferences.contentFontSize;
  root.dataset.appLanguage = preferences.language;
  root.dataset.chatLayoutPreset = preferences.layoutPreset;
  root.dataset.messageAlignment = preferences.messageAlignment;
  root.lang = resolveAppLocale(preferences.language);
}
