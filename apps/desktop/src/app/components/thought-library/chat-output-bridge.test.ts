import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildChatOutputArtifactDedupeKey,
  buildOutputArtifactFromChatTurn,
  resolveOutputArtifactTypeFromChatArtifacts,
} from './chat-output-bridge.ts';

test('resolveOutputArtifactTypeFromChatArtifacts prefers explicit type', () => {
  const result = resolveOutputArtifactTypeFromChatArtifacts({
    preferredType: 'doc',
    artifactKinds: ['ppt', 'webpage'],
  });

  assert.equal(result, 'doc');
});

test('resolveOutputArtifactTypeFromChatArtifacts maps ppt and webpage to publishable output classes', () => {
  assert.equal(resolveOutputArtifactTypeFromChatArtifacts({ artifactKinds: ['ppt'] }), 'ppt');
  assert.equal(resolveOutputArtifactTypeFromChatArtifacts({ artifactKinds: ['webpage'] }), 'article');
  assert.equal(resolveOutputArtifactTypeFromChatArtifacts({ artifactKinds: ['report', 'pdf'] }), 'memo');
});

test('buildOutputArtifactFromChatTurn preserves turn lineage and finance compliance snapshot', () => {
  const artifact = buildOutputArtifactFromChatTurn({
    turnId: 'turn_123',
    conversationId: 'conv_456',
    sessionKey: 'agent:main:main',
    prompt: '请帮我生成一份宁德时代研究 memo，并输出网页版。',
    answer: '这里是研究结论。',
    artifactKinds: ['webpage'],
    artifactRefs: [
      {
        kind: 'webpage',
        path: '/tmp/research.html',
        title: '宁德时代研究网页稿',
        previewKind: 'html',
      },
    ],
    sourceContext: {
      rawMaterialIds: ['raw_1', 'raw_2'],
      ontologyIds: ['graph_1'],
    },
    financeCompliance: {
      domain: 'finance',
      inputClassification: 'research_request',
      outputClassification: 'investment_view',
      riskLevel: 'medium',
      showDisclaimer: true,
      disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
      requiresRiskSection: true,
      blocked: false,
      degraded: true,
      reasons: ['finance_domain', 'research_only_policy'],
      usedCapabilities: ['a-share-research'],
      usedModel: 'bailian/qwen3.5-plus',
      sourceAttributionRequired: true,
      timestampRequired: true,
    },
  });

  assert.equal(artifact.type, 'article');
  assert.equal(artifact.source_raw_ids.length, 2);
  assert.equal(artifact.source_ontology_ids.length, 1);
  assert.match(artifact.title, /网页稿/);
  assert.match(artifact.content, /Execution Artifacts/);

  const metadata = artifact.metadata as Record<string, unknown>;
  const lineage = metadata.lineage as Record<string, unknown>;
  const compliance = metadata.finance_compliance as Record<string, unknown>;

  assert.equal(metadata.generated_from, 'chat-turn');
  assert.equal(lineage.turn_id, 'turn_123');
  assert.equal(lineage.conversation_id, 'conv_456');
  assert.equal(lineage.session_key, 'agent:main:main');
  assert.deepEqual(lineage.source_raw_ids, ['raw_1', 'raw_2']);
  assert.deepEqual(lineage.source_ontology_ids, ['graph_1']);
  assert.equal(compliance.riskLevel, 'medium');
  assert.equal(compliance.degraded, true);
});

test('buildChatOutputArtifactDedupeKey stays stable per turn id', () => {
  assert.equal(buildChatOutputArtifactDedupeKey('turn_abc'), 'output::chat-turn::turn_abc');
});
