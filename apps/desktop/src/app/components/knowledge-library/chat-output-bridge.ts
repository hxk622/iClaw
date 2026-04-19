import type { ChatTurnArtifact } from '../../lib/chat-turns.ts';
import type { FinanceComplianceSnapshot } from '../../lib/finance-compliance.ts';
import type { CreateOutputArtifactInput, OutputArtifactType } from './output-types';

export interface ChatOutputArtifactRef {
  kind: ChatTurnArtifact;
  path?: string | null;
  title?: string | null;
  mimeType?: string | null;
  previewKind?: string | null;
}

export interface ChatOutputArtifactSourceContext {
  rawMaterialIds?: string[];
  ontologyIds?: string[];
}

export interface BuildChatOutputArtifactInput {
  turnId: string;
  conversationId: string;
  sessionKey: string;
  prompt: string;
  answer: string;
  title?: string | null;
  preferredType?: OutputArtifactType | null;
  artifactKinds?: ChatTurnArtifact[];
  artifactRefs?: ChatOutputArtifactRef[];
  sourceContext?: ChatOutputArtifactSourceContext | null;
  financeCompliance?: FinanceComplianceSnapshot | null;
  sourceSurface?: 'chat' | 'cron' | 'notification' | 'report';
  metadata?: Record<string, unknown> | null;
}

function collapseText(value: string | null | undefined, maxLength = 8000): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function uniqueStrings(values: string[] | null | undefined, maxLength = 120): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values.map((entry) => collapseText(entry, maxLength)).filter(Boolean)));
}

function sanitizeArtifactRefs(input: ChatOutputArtifactRef[] | null | undefined): ChatOutputArtifactRef[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry): entry is ChatOutputArtifactRef => Boolean(entry && entry.kind))
    .map((entry) => ({
      kind: entry.kind,
      path: collapseText(entry.path, 400) || null,
      title: collapseText(entry.title, 160) || null,
      mimeType: collapseText(entry.mimeType, 120) || null,
      previewKind: collapseText(entry.previewKind, 80) || null,
    }));
}

export function buildChatOutputArtifactDedupeKey(turnId: string): string {
  return `output::chat-turn::${collapseText(turnId, 120)}`;
}

export function resolveOutputArtifactTypeFromChatArtifacts(input: {
  preferredType?: OutputArtifactType | null;
  artifactKinds?: ChatTurnArtifact[] | null;
}): OutputArtifactType {
  if (input.preferredType) {
    return input.preferredType;
  }
  const artifactKinds = Array.isArray(input.artifactKinds) ? input.artifactKinds : [];
  if (artifactKinds.includes('ppt')) {
    return 'ppt';
  }
  if (artifactKinds.includes('webpage')) {
    return 'article';
  }
  return 'memo';
}

function buildChatOutputArtifactTitle(input: {
  title?: string | null;
  prompt: string;
  type: OutputArtifactType;
}): string {
  const base =
    collapseText(input.title, 120) ||
    collapseText(input.prompt, 48).replace(/[?？。.!！]+$/g, '') ||
    '未命名对话产出';
  switch (input.type) {
    case 'ppt':
      return `${base} 演示稿`;
    case 'article':
      return `${base} 网页稿`;
    default:
      return `${base} 对话产出`;
  }
}

function buildChatOutputArtifactContent(input: {
  title: string;
  prompt: string;
  answer: string;
  artifactRefs: ChatOutputArtifactRef[];
  financeCompliance?: FinanceComplianceSnapshot | null;
}): string {
  const artifactSection =
    input.artifactRefs.length > 0
      ? `\n\n## Execution Artifacts\n${input.artifactRefs
          .map((entry) => {
            const meta = [entry.title, entry.path, entry.mimeType].filter(Boolean).join(' · ');
            return `- ${entry.kind}${meta ? `: ${meta}` : ''}`;
          })
          .join('\n')}`
      : '';
  const financeSection = input.financeCompliance
    ? `\n\n## Finance Compliance\n- 风险等级：${input.financeCompliance.riskLevel}\n- 输出分类：${input.financeCompliance.outputClassification || 'unknown'}\n- 展示免责声明：${input.financeCompliance.showDisclaimer ? 'yes' : 'no'}\n- 降级：${input.financeCompliance.degraded ? 'yes' : 'no'}\n- 拦截：${input.financeCompliance.blocked ? 'yes' : 'no'}`
    : '';
  return `# ${input.title}\n\n## 用户问题\n${collapseText(input.prompt, 12000) || '未记录'}\n\n## AI 输出\n${collapseText(input.answer, 20000) || '未记录'}${artifactSection}${financeSection}`;
}

export function buildOutputArtifactFromChatTurn(input: BuildChatOutputArtifactInput): CreateOutputArtifactInput {
  const artifactKinds = uniqueStrings(input.artifactKinds ?? [], 40) as ChatTurnArtifact[];
  const artifactRefs = sanitizeArtifactRefs(input.artifactRefs);
  const type = resolveOutputArtifactTypeFromChatArtifacts({
    preferredType: input.preferredType,
    artifactKinds,
  });
  const title = buildChatOutputArtifactTitle({
    title: input.title,
    prompt: input.prompt,
    type,
  });
  const sourceRawIds = uniqueStrings(input.sourceContext?.rawMaterialIds ?? [], 120);
  const sourceOntologyIds = uniqueStrings(input.sourceContext?.ontologyIds ?? [], 120);
  const financeCompliance = input.financeCompliance
    ? {
        ...input.financeCompliance,
        reasons: uniqueStrings(input.financeCompliance.reasons, 120),
        usedCapabilities: uniqueStrings(input.financeCompliance.usedCapabilities, 120),
      }
    : null;

  return {
    type,
    title,
    summary: collapseText(input.answer, 240) || collapseText(input.prompt, 240) || '暂无摘要',
    content: buildChatOutputArtifactContent({
      title,
      prompt: input.prompt,
      answer: input.answer,
      artifactRefs,
      financeCompliance,
    }),
    content_format: 'markdown',
    source_raw_ids: sourceRawIds,
    source_ontology_ids: sourceOntologyIds,
    status: 'draft',
    publish_targets: [],
    metadata: {
      generated_from: 'chat-turn',
      source_surface: input.sourceSurface || 'chat',
      dedupe_key: buildChatOutputArtifactDedupeKey(input.turnId),
      lineage: {
        source: 'chat-turn',
        turn_id: collapseText(input.turnId, 120),
        conversation_id: collapseText(input.conversationId, 120),
        session_key: collapseText(input.sessionKey, 240),
        artifact_kinds: artifactKinds,
        artifact_refs: artifactRefs,
        prompt_excerpt: collapseText(input.prompt, 240),
        source_raw_ids: sourceRawIds,
        source_ontology_ids: sourceOntologyIds,
      },
      finance_compliance: financeCompliance,
      ...input.metadata,
    },
  };
}
