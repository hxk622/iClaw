import type { IClawClient } from '@iclaw/sdk';

import { OpenClawChatSurface } from '@/app/components/OpenClawChatSurface';
import { createScopedChatSessionKey } from '@/app/lib/chat-session';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';
import type { ThoughtLibraryItem, ThoughtLibraryTab } from './model';
import { buildThoughtLibraryContextPrompt } from './chat-context';

export function ThoughtLibraryEmbeddedChatSurface({
  selectedItem,
  activeTab,
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  authBaseUrl,
  appName,
  client,
  accessToken,
  currentUser,
  authenticated,
  onRequestAuth,
  inputComposerConfig,
  welcomePageConfig,
}: {
  selectedItem: ThoughtLibraryItem | null;
  activeTab: ThoughtLibraryTab;
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  authBaseUrl: string;
  appName: string;
  client: IClawClient;
  accessToken: string | null;
  currentUser: {
    name?: string | null;
    username?: string | null;
    display_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
  inputComposerConfig?: ResolvedInputComposerConfig | null;
  welcomePageConfig?: ResolvedWelcomePageConfig | null;
}) {
  const sessionSeed = selectedItem ? `thought-library-${activeTab}-${selectedItem.id}` : 'thought-library-empty';
  const initialPrompt = selectedItem
    ? buildThoughtLibraryContextPrompt({
        tab: activeTab,
        item: selectedItem,
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <OpenClawChatSurface
        key={`thought-library-chat:${sessionSeed}`}
        gatewayUrl={gatewayUrl}
        gatewayToken={gatewayToken}
        gatewayPassword={gatewayPassword}
        authBaseUrl={authBaseUrl}
        appName={appName}
        conversationId={null}
        sessionKey={createScopedChatSessionKey(sessionSeed)}
        initialPrompt={initialPrompt}
        initialPromptKey={selectedItem ? sessionSeed : null}
        focusedTurnId={null}
        focusedTurnKey={null}
        initialAgentSlug={null}
        initialSkillSlug={null}
        initialSkillOption={null}
        initialStockContext={null}
        shellAuthenticated={authenticated}
        creditClient={client}
        creditToken={accessToken}
        user={currentUser}
        inputComposerConfig={inputComposerConfig}
        welcomePageConfig={welcomePageConfig}
        onRequireAuth={onRequestAuth}
        runtimeStateKey={`thought-library:${sessionSeed}`}
        surfaceVisible
        sendBlockedReason={null}
      />
    </div>
  );
}
