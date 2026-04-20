import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areArtifactPathsEquivalent,
  buildArtifactPreviewLoadingState,
  loadArtifactPreviewState,
} from './chat-artifact-preview.ts';

test('buildArtifactPreviewLoadingState returns immediate text preview for inline content', () => {
  const preview = buildArtifactPreviewLoadingState({
    path: null,
    inlineContent: '结论正文',
    source: {
      turnId: 'turn-1',
      promptText: '问题',
      answerText: '回答',
      rawIds: [],
      ontologyIds: [],
    },
  });

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'text');
  assert.equal(preview.content, '结论正文');
  assert.equal(preview.error, null);
});

test('loadArtifactPreviewState resolves markdown/text content from workspace candidates', async () => {
  const preview = await loadArtifactPreviewState(
    {
      path: 'workspace/outputs/hs300-memo.md',
      title: '沪深300备忘录',
      source: {
        turnId: 'turn-2',
        promptText: '现在是否建议买入沪深300ETF？',
        answerText: null,
        rawIds: ['raw-1'],
        ontologyIds: ['onto-1'],
      },
    },
    {
      getWorkspaceDir: async () => '/Users/xingkaihan/.openclaw/apps/caiclaw/workspace',
      readTextFile: async (name) =>
        name === 'outputs/hs300-memo.md' || name === 'workspace/outputs/hs300-memo.md'
          ? { content: '# 备忘录' }
          : null,
      readBinaryFile: async () => null,
      resolvePath: async () => null,
    },
  );

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'markdown');
  assert.equal(preview.content, '# 备忘录');
  assert.equal(preview.openPath, 'workspace/outputs/hs300-memo.md');
  assert.equal(preview.error, null);
  assert.equal(preview.sourceTurnId, 'turn-2');
  assert.deepEqual(preview.sourceRawIds, ['raw-1']);
});

test('loadArtifactPreviewState resolves pdf content into a data url', async () => {
  const preview = await loadArtifactPreviewState(
    {
      path: 'workspace/outputs/report.pdf',
      source: {
        turnId: 'turn-3',
        promptText: '生成 PDF',
        answerText: '已生成',
        rawIds: [],
        ontologyIds: [],
      },
    },
    {
      getWorkspaceDir: async () => null,
      readTextFile: async () => null,
      readBinaryFile: async (name) =>
        name === 'workspace/outputs/report.pdf'
          ? {
              path: '/tmp/report.pdf',
              mimeType: 'application/pdf',
              base64: 'JVBERi0x',
              sizeBytes: 2048,
            }
          : null,
      resolvePath: async () => null,
    },
  );

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'pdf');
  assert.match(preview.content ?? '', /^data:application\/pdf;base64,JVBERi0x$/);
  assert.equal(preview.openPath, '/tmp/report.pdf');
  assert.equal(preview.actionLabel, '打开 PDF 原文件');
});

test('loadArtifactPreviewState surfaces an office-path error when file cannot be resolved', async () => {
  const preview = await loadArtifactPreviewState(
    {
      path: 'workspace/outputs/model.xlsx',
      source: {
        turnId: 'turn-4',
        promptText: '生成表格',
        answerText: '已生成',
        rawIds: [],
        ontologyIds: [],
      },
    },
    {
      getWorkspaceDir: async () => null,
      readTextFile: async () => null,
      readBinaryFile: async () => null,
      resolvePath: async () => null,
    },
  );

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'office');
  assert.equal(preview.openPath, null);
  assert.match(preview.error ?? '', /没有定位到可打开的原文件/);
});

test('loadArtifactPreviewState keeps unsupported files actionable when path resolves', async () => {
  const preview = await loadArtifactPreviewState(
    {
      path: 'workspace/outputs/archive.bin',
      source: {
        turnId: 'turn-5',
        promptText: '导出二进制',
        answerText: '已导出',
        rawIds: [],
        ontologyIds: [],
      },
    },
    {
      getWorkspaceDir: async () => null,
      readTextFile: async () => null,
      readBinaryFile: async () => null,
      resolvePath: async (name) =>
        name === 'workspace/outputs/archive.bin'
          ? {
              path: '/tmp/archive.bin',
              sizeBytes: 1024,
            }
          : null,
    },
  );

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'unsupported');
  assert.equal(preview.openPath, '/tmp/archive.bin');
  assert.equal(preview.actionLabel, '打开原文件');
  assert.match(preview.error ?? '', /暂不支持直接预览 BIN 文件/);
});

test('loadArtifactPreviewState degrades to an explicit error when workspace reads fail', async () => {
  const preview = await loadArtifactPreviewState(
    {
      path: 'workspace/outputs/final.html',
      source: {
        turnId: 'turn-6',
        promptText: '生成 HTML',
        answerText: '已生成',
        rawIds: [],
        ontologyIds: [],
      },
    },
    {
      getWorkspaceDir: async () => null,
      readTextFile: async () => {
        throw new Error('EACCES');
      },
      readBinaryFile: async () => null,
      resolvePath: async () => null,
    },
  );

  assert.equal(preview.loading, false);
  assert.equal(preview.kind, 'html');
  assert.equal(preview.openPath, null);
  assert.match(preview.error ?? '', /没有从 OpenClaw workspace 读到对应文件内容/);
});

test('areArtifactPathsEquivalent matches workspace-relative and absolute paths', () => {
  assert.equal(
    areArtifactPathsEquivalent(
      '/Users/xingkaihan/.openclaw/apps/caiclaw/workspace/outputs/hs300-memo.md',
      'outputs/hs300-memo.md',
    ),
    true,
  );
});
