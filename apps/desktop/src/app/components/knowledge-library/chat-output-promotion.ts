import type { ChatTurnRecord } from '../../lib/chat-turns.ts';
import type { FinanceComplianceSnapshot } from '../../lib/finance-compliance.ts';
import { buildOutputArtifactFromChatTurn, type ChatOutputArtifactRef } from './chat-output-bridge.ts';
import { getOutputArtifactByDedupeKey, upsertOutputArtifact } from './output-storage.ts';
import type { OutputArtifact, OutputArtifactType } from './output-types.ts';
import { syncOutputArtifactsIntoOntology } from './graph-compiler.ts';

export interface PromoteChatOutputArtifactInput {
  turn: Pick<ChatTurnRecord, 'id' | 'conversationId' | 'sessionKey' | 'prompt' | 'title' | 'artifacts' | 'financeCompliance'>;
  answer: string;
  artifactRef?: ChatOutputArtifactRef | null;
  sourceContext?: {
    rawMaterialIds?: string[];
    ontologyIds?: string[];
  } | null;
  preferredType?: OutputArtifactType | null;
  financeCompliance?: FinanceComplianceSnapshot | null;
  sourceSurface?: 'chat' | 'cron' | 'notification' | 'report';
}

function collapseText(value: string | null | undefined, maxLength = 20000): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export async function promoteChatTurnToOutputArtifact(input: PromoteChatOutputArtifactInput): Promise<OutputArtifact> {
  const answer = collapseText(input.answer, 20000) || collapseText(input.turn.prompt, 4000) || '未记录';
  const artifactKinds = Array.isArray(input.turn.artifacts) ? input.turn.artifacts : [];
  const artifactRefs = input.artifactRef ? [input.artifactRef] : [];
  const financeCompliance = input.financeCompliance ?? input.turn.financeCompliance ?? null;
  const nextArtifact = buildOutputArtifactFromChatTurn({
    turnId: input.turn.id,
    conversationId: input.turn.conversationId,
    sessionKey: input.turn.sessionKey,
    prompt: input.turn.prompt,
    answer,
    title: input.turn.title,
    preferredType: input.preferredType,
    artifactKinds,
    artifactRefs,
    sourceContext: input.sourceContext,
    financeCompliance,
    sourceSurface: input.sourceSurface || 'chat',
  });
  const dedupeKey =
    nextArtifact.metadata && typeof nextArtifact.metadata === 'object'
      ? (nextArtifact.metadata as Record<string, unknown>).dedupe_key
      : null;
  const existing =
    typeof dedupeKey === 'string' && dedupeKey.trim() ? getOutputArtifactByDedupeKey(dedupeKey) : null;
  const saved = upsertOutputArtifact({
    ...nextArtifact,
    id: existing?.id,
  });
  await syncOutputArtifactsIntoOntology([saved]);
  return saved;
}
