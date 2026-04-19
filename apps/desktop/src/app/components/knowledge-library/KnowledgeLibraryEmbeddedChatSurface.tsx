import { forwardRef, useCallback } from 'react';
import type { IClawClient } from '@iclaw/sdk';

import { OpenClawChatSurface } from '@/app/components/OpenClawChatSurface';
import { createScopedChatSessionKey } from '@/app/lib/chat-session';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';
import type { KnowledgeLibraryItem, KnowledgeLibraryTab } from './model';
import { resolveKnowledgeLibraryItemSourceContext } from './chat-feedback';
import { buildKnowledgeLibraryGraphQueryPrompt } from './chat-context';
import { runGraphifyQuery } from '@/app/lib/tauri-graphify';
import type { ComposerSendPayload } from '../RichChatComposer';

type KnowledgeLibraryEmbeddedChatSurfaceProps = {
  selectedItem: KnowledgeLibraryItem | null;
  activeTab: KnowledgeLibraryTab;
  autoGraphQueryEnabled?: boolean;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
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
};

export const KnowledgeLibraryEmbeddedChatSurface = forwardRef<HTMLDivElement, KnowledgeLibraryEmbeddedChatSurfaceProps>(
  (
    {
      selectedItem,
      activeTab,
      autoGraphQueryEnabled = false,
      initialPrompt = null,
      initialPromptKey = null,
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
    },
    ref,
  ) => {
    const sessionSeed = `knowledge-library-${activeTab}`;
    const sourceContext = resolveKnowledgeLibraryItemSourceContext(selectedItem);
    const transformSendPayload = useCallback(
      async (payload: ComposerSendPayload): Promise<ComposerSendPayload> => {
        if (!autoGraphQueryEnabled || activeTab !== 'graph' || !selectedItem?.ontologyDocument) {
          return payload;
        }
        const graphPath = selectedItem.ontologyDocument.metadata?.graphify_graph_json_path || null;
        const question = payload.prompt.trim();
        if (!graphPath || !question) {
          return payload;
        }
        const result = await runGraphifyQuery({
          graphPath,
          question,
          useDfs: false,
          budget: 1600,
        });
        if (!result?.available || result.error || !result.stdout?.trim()) {
          return payload;
        }
        return {
          ...payload,
          prompt: buildKnowledgeLibraryGraphQueryPrompt({
            tab: activeTab,
            item: selectedItem,
            question,
            queryResult: result.stdout.trim(),
          }),
        };
      },
      [activeTab, autoGraphQueryEnabled, selectedItem],
    );

    return (
      <div ref={ref} className="knowledge-library-embedded-chat flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <OpenClawChatSurface
          key={`knowledge-library-chat:${sessionSeed}`}
          gatewayUrl={gatewayUrl}
          gatewayToken={gatewayToken}
          gatewayPassword={gatewayPassword}
          authBaseUrl={authBaseUrl}
          appName={appName}
          conversationId={null}
          sessionKey={createScopedChatSessionKey(sessionSeed)}
          initialPrompt={initialPrompt}
          initialPromptKey={initialPromptKey}
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
          compactWelcomePage
          onRequireAuth={onRequestAuth}
          runtimeStateKey={`knowledge-library:${sessionSeed}`}
          surfaceVisible
          sendBlockedReason={null}
          transformSendPayload={transformSendPayload}
          outputPromotionSourceContext={sourceContext}
        />
      </div>
    );
  },
);

KnowledgeLibraryEmbeddedChatSurface.displayName = 'KnowledgeLibraryEmbeddedChatSurface';
