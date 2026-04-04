import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { type PersistableSettingsSection, useSettings } from '@/app/contexts/settings-context';
import { SettingsGeneral } from '@/app/components/settings/SettingsGeneral';
import { Identity } from '@/app/components/settings/Identity';
import { UserProfile } from '@/app/components/settings/UserProfile';
import { SoulPersona } from '@/app/components/settings/SoulPersona';
import { SettingsBottomBar } from '@/app/components/settings/ui/SettingsBottomBar';
import { SettingsSidebar } from '@/app/components/settings/ui/SettingsSidebar';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { cn } from '@/app/lib/cn';

interface SettingsPanelProps {
  onClose: () => void;
  onSave: (section: PersistableSettingsSection) => Promise<void>;
  active?: boolean;
  desktopUpdateCurrentVersion: string;
  desktopUpdateLatestVersion: string | null;
  desktopUpdateMandatory: boolean;
  desktopUpdateEnforcementState: 'recommended' | 'required_after_run' | 'required_now';
  desktopUpdatePolicyLabel: string;
  desktopUpdateChecking: boolean;
  desktopUpdateReadyToRestart: boolean;
  desktopUpdateStatusMessage: string | null;
  onCheckForDesktopUpdates: () => void;
  onRestartDesktopApp: () => void;
}

export function SettingsPanel({
  onClose,
  onSave,
  active = true,
  desktopUpdateCurrentVersion,
  desktopUpdateLatestVersion,
  desktopUpdateMandatory,
  desktopUpdateEnforcementState,
  desktopUpdatePolicyLabel,
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
            enforcementState={desktopUpdateEnforcementState}
            policyLabel={desktopUpdatePolicyLabel}
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
      default:
        return null;
    }
  }, [
    activeSection,
    desktopUpdateChecking,
    desktopUpdateCurrentVersion,
    desktopUpdateLatestVersion,
    desktopUpdateMandatory,
    desktopUpdateEnforcementState,
    desktopUpdatePolicyLabel,
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
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-8 backdrop-blur-sm ${
        active ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={active ? undefined : true}
      onClick={onClose}
    >
      <div
        className="relative flex h-[720px] w-full max-w-[1200px] max-h-[calc(100vh-64px)] flex-col overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_1px_rgba(0,0,0,0.1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭设置"
          onClick={onClose}
          className={cn(
            'absolute right-5 top-5 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:bg-[var(--bg-hover)]',
            SPRING_PRESSABLE,
            INTERACTIVE_FOCUS_RING,
          )}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-h-0 flex-1">
          <SettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-10 py-8">{content}</div>
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
