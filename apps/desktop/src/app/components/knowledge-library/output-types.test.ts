import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseOutputArtifactFinanceCompliance,
  parseOutputArtifactLineage,
  parseOutputArtifactSourceSurface,
} from './output-types.ts';

test('parseOutputArtifactLineage reads chat-turn lineage metadata', () => {
  const result = parseOutputArtifactLineage({
    generated_from: 'chat-turn',
    source_surface: 'chat',
    lineage: {
      source: 'chat-turn',
      turn_id: 'turn_1',
      conversation_id: 'conv_1',
      session_key: 'agent:main:main',
      artifact_kinds: ['webpage', 'ppt'],
      artifact_refs: [
        {
          kind: 'webpage',
          path: '/tmp/result.html',
          title: 'Result Page',
        },
      ],
      prompt_excerpt: '请生成网页稿',
      source_raw_ids: ['raw_1'],
      source_ontology_ids: ['graph_1'],
    },
  });

  assert.ok(result);
  assert.equal(result?.source, 'chat-turn');
  assert.equal(result?.turn_id, 'turn_1');
  assert.equal(result?.conversation_id, 'conv_1');
  assert.equal(result?.session_key, 'agent:main:main');
  assert.deepEqual(result?.artifact_kinds, ['webpage', 'ppt']);
  assert.equal(result?.artifact_refs[0]?.path, '/tmp/result.html');
});

test('parseOutputArtifactSourceSurface reads source surface metadata', () => {
  assert.equal(parseOutputArtifactSourceSurface({ source_surface: 'chat' }), 'chat');
  assert.equal(parseOutputArtifactSourceSurface({}), null);
});

test('parseOutputArtifactFinanceCompliance reads finance compliance snapshot', () => {
  const result = parseOutputArtifactFinanceCompliance({
    finance_compliance: {
      domain: 'finance',
      inputClassification: 'research_request',
      outputClassification: 'investment_view',
      riskLevel: 'high',
      showDisclaimer: true,
      disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
      requiresRiskSection: true,
      blocked: false,
      degraded: true,
      reasons: ['finance_domain'],
      usedCapabilities: ['research'],
      usedModel: 'qwen',
      sourceAttributionRequired: true,
      timestampRequired: true,
    },
  });

  assert.ok(result);
  assert.equal(result?.domain, 'finance');
  assert.equal(result?.riskLevel, 'high');
  assert.equal(result?.degraded, true);
  assert.equal(result?.showDisclaimer, true);
  assert.deepEqual(result?.reasons, ['finance_domain']);
});
