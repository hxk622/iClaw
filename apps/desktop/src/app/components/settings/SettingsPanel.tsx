import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { type PersistableSettingsSection, useSettings } from '@/app/contexts/settings-context';
import { SettingsGeneral } from '@/app/components/settings/SettingsGeneral';
import { Identity } from '@/app/components/settings/Identity';
import { UserProfile } from '@/app/components/settings/UserProfile';
import { SoulPersona } from '@/app/components/settings/SoulPersona';
import { SafetyDefaults } from '@/app/components/settings/SafetyDefaults';
import { SettingsBottomBar } from '@/app/components/settings/ui/SettingsBottomBar';
import { SettingsSidebar } from '@/app/components/settings/ui/SettingsSidebar';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { cn } from '@/app/lib/cn';

interface SettingsPanelProps {
  onClose: () => void;
  onSave: (section: PersistableSettingsSection) => Promise<void>;
  desktopUpdateCurrentVersion: string;
  desktopUpdateLatestVersion: string | null;
  desktopUpdateMandatory: boolean;
  desktopUpdateChecking: boolean;
  desktopUpdateReadyToRestart: boolean;
  desktopUpdateStatusMessage: string | null;
  onCheckForDesktopUpdates: () => void;
  onRestartDesktopApp: () => void;
}

export function SettingsPanel({
  onClose,
  onSave,
  desktopUpdateCurrentVersion,
  desktopUpdateLatestVersion,
  desktopUpdateMandatory,
  desktopUpdateChecking,
  desktopUpdateReadyToRestart,
  desktopUpdateStatusMessage,
  onCheckForDesktopUpdates,
  onRestartDesktopApp,
}: SettingsPanelProps) {
  const { hasUnsavedChangesForSection, resetSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<PersistableSettingsSection>('general');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const hasUnsavedChanges = hasUnsavedChangesForSection(activeSection);

  const content = useMemo(() => {
    switch (activeSection) {
      case 'general':
        return (
          <SettingsGeneral
            currentVersion={desktopUpdateCurrentVersion}
            latestVersion={desktopUpdateLatestVersion}
            mandatory={desktopUpdateMandatory}
            checkingForUpdates={desktopUpdateChecking}
            readyToRestart={desktopUpdateReadyToRestart}
            statusMessage={desktopUpdateStatusMessage}
            onCheckForUpdates={onCheckForDesktopUpdates}
            onRestartToApply={onRestartDesktopApp}
          />
        );
      case 'identity':
        return <Identity />;
      case 'user-profile':
        return <UserProfile />;
      case 'soul-persona':
        return <SoulPersona />;
      case 'safety-defaults':
        return <SafetyDefaults />;
      default:
        return null;
    }
  }, [
    activeSection,
    desktopUpdateChecking,
    desktopUpdateCurrentVersion,
    desktopUpdateLatestVersion,
    desktopUpdateMandatory,
    desktopUpdateReadyToRestart,
    desktopUpdateStatusMessage,
    onCheckForDesktopUpdates,
    onRestartDesktopApp,
  ]);

  useEffect(() => {
    setSaveState('idle');
    setSaveMessage(null);
  }, [activeSection]);

  const handleSave = async () => {
    setSaveState('saving');
    setSaveMessage(null);
    try {
      await onSave(activeSection);
      setSaveState('saved');
      setSaveMessage('当前页面更改已保存');
      window.setTimeout(() => {
        setSaveState((current) => (current === 'saved' ? 'idle' : current));
        setSaveMessage((current) => (current === '当前页面更改已保存' ? null : current));
      }, 1500);
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : '保存失败，请稍后重试');
    }
  };

  const handleReset = () => {
    resetSettings(activeSection);
    setSaveState('idle');
    setSaveMessage(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex h-[960px] max-h-[90vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_1px_rgba(0,0,0,0.1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭设置"
          onClick={onClose}
          className={cn(
            'absolute right-6 top-6 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-card)_80%,transparent)] text-[var(--text-secondary)] cursor-pointer',
            SPRING_PRESSABLE,
            INTERACTIVE_FOCUS_RING,
          )}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-h-0 flex-1">
          <SettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-12 py-8">{content}</div>
          </div>
        </div>

        <SettingsBottomBar
          hasUnsavedChanges={hasUnsavedChanges}
          saveState={saveState}
          saveMessage={saveMessage}
          onReset={handleReset}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
