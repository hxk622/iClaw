import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOutputArtifactsProtocolInstruction,
  parseChatTurnOutputArtifacts,
  selectAutoOpenOutputArtifact,
} from './chat-output-artifacts.ts';

test('parseChatTurnOutputArtifacts extracts explicit output artifacts and strips the protocol block', () => {
  const parsed = parseChatTurnOutputArtifacts(`
结论先放这里。

<!-- OUTPUT_ARTIFACTS_V1 {"artifacts":[{"kind":"md","title":"沪深300加仓备忘录","path":"workspace/outputs/hs300-memo.md","mimeType":"text/markdown","autoOpen":true,"finalOutput":true}]} -->
`);

  assert.equal(parsed.cleanedAnswer, '结论先放这里。');
  assert.deepEqual(parsed.outputArtifacts, [
    {
      protocolVersion: 1,
      kind: 'md',
      title: '沪深300加仓备忘录',
      path: 'workspace/outputs/hs300-memo.md',
      mimeType: 'text/markdown',
      autoOpen: true,
      finalOutput: true,
    },
  ]);
});

test('parseChatTurnOutputArtifacts ignores malformed or incomplete artifacts', () => {
  const parsed = parseChatTurnOutputArtifacts(`
回答正文
<!-- OUTPUT_ARTIFACTS_V1 {"artifacts":[{"kind":"md","title":"","path":""},{"kind":"unknown","title":"x","path":"a"}]} -->
`);

  assert.equal(parsed.cleanedAnswer, '回答正文');
  assert.deepEqual(parsed.outputArtifacts, []);
});

test('buildOutputArtifactsProtocolInstruction emits protocol guidance', () => {
  const instruction = buildOutputArtifactsProtocolInstruction({
    selectedOutput: 'report',
    selectedOutputLabel: '报告',
  });

  assert.match(instruction, /OUTPUT_ARTIFACTS_V1/);
  assert.match(instruction, /报告/);
  assert.match(instruction, /HTML 注释协议块/);
});

test('selectAutoOpenOutputArtifact only returns explicit final outputs in the active conversation', () => {
  const selection = selectAutoOpenOutputArtifact(
    [
      {
        id: 'turn-3',
        source: 'chat',
        status: 'completed',
        conversationId: 'conv-a',
        outputArtifacts: [
          {
            protocolVersion: 1,
            kind: 'md',
            title: '不自动打开',
            path: 'workspace/outputs/skip.md',
            autoOpen: false,
            finalOutput: true,
          },
        ],
      },
      {
        id: 'turn-2',
        source: 'chat',
        status: 'completed',
        conversationId: 'conv-a',
        outputArtifacts: [
          {
            protocolVersion: 1,
            kind: 'pdf',
            title: '真正成果',
            path: 'workspace/outputs/final.pdf',
            autoOpen: true,
            finalOutput: true,
          },
        ],
      },
      {
        id: 'turn-1',
        source: 'chat',
        status: 'completed',
        conversationId: 'conv-b',
        outputArtifacts: [
          {
            protocolVersion: 1,
            kind: 'md',
            title: '别的会话',
            path: 'workspace/outputs/other.md',
            autoOpen: true,
            finalOutput: true,
          },
        ],
      },
    ],
    'conv-a',
  );

  assert.deepEqual(selection, {
    turnId: 'turn-2',
    artifact: {
      protocolVersion: 1,
      kind: 'pdf',
      title: '真正成果',
      path: 'workspace/outputs/final.pdf',
      autoOpen: true,
      finalOutput: true,
    },
  });
});

test('selectAutoOpenOutputArtifact returns null when the conversation has no explicit output artifacts', () => {
  const selection = selectAutoOpenOutputArtifact(
    [
      {
        id: 'turn-1',
        source: 'chat',
        status: 'completed',
        conversationId: 'conv-a',
        outputArtifacts: [],
      },
      {
        id: 'turn-2',
        source: 'chat',
        status: 'running',
        conversationId: 'conv-a',
        outputArtifacts: [
          {
            protocolVersion: 1,
            kind: 'md',
            title: '未完成产物',
            path: 'workspace/outputs/running.md',
            autoOpen: true,
            finalOutput: true,
          },
        ],
      },
    ],
    'conv-a',
  );

  assert.equal(selection, null);
});
