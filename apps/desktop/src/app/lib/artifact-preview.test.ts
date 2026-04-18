import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArtifactOpenActionLabel,
  extractArtifactExtension,
  resolveArtifactPreviewKind,
} from './artifact-preview.ts';

test('resolveArtifactPreviewKind classifies pdf and office artifacts', () => {
  assert.equal(resolveArtifactPreviewKind('reports/daily.pdf'), 'pdf');
  assert.equal(resolveArtifactPreviewKind('deck/final.pptx'), 'office');
  assert.equal(resolveArtifactPreviewKind('sheets/model.xlsx'), 'office');
});

test('resolveArtifactPreviewKind keeps text-like and html artifacts previewable', () => {
  assert.equal(resolveArtifactPreviewKind('notes/summary.md'), 'markdown');
  assert.equal(resolveArtifactPreviewKind('site/index.html'), 'html');
  assert.equal(resolveArtifactPreviewKind('exports/table.csv'), 'text');
});

test('buildArtifactOpenActionLabel adapts to file family', () => {
  assert.equal(buildArtifactOpenActionLabel('reports/daily.pdf'), '打开 PDF 原文件');
  assert.equal(buildArtifactOpenActionLabel('deck/final.pptx'), '打开演示文件');
  assert.equal(buildArtifactOpenActionLabel('sheets/model.xlsx'), '打开表格文件');
  assert.equal(buildArtifactOpenActionLabel('unknown.bin'), '打开原文件');
  assert.equal(extractArtifactExtension('notes/README.MD'), 'md');
});
