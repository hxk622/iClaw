import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphifyReportOutputArtifact } from './graphify-report-importer.ts';

test('buildGraphifyReportOutputArtifact builds memo output with stable dedupe key and artifact refs', () => {
  const artifact = buildGraphifyReportOutputArtifact({
    trigger: 'output_feedback',
    reportText: '# Graph Report\n\n- 22 nodes · 38 edges · 3 communities detected',
    reportPath: '/tmp/job/graphify-out/GRAPH_REPORT.md',
    htmlPath: '/tmp/job/graphify-out/graph.html',
    graphJsonPath: '/tmp/job/graphify-out/graph.json',
    corpusDir: '/tmp/job/corpus',
    outputDir: '/tmp/job/graphify-out',
    ontologyDocument: {
      id: 'ontology::graphify::output::output_1',
      title: '宁德时代投资备忘录 图谱',
      summary: '由成果反哺生成的图谱。',
      source_raw_ids: ['raw_1'],
      status: 'compiled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      nodes: [],
      edges: [],
      metadata: null,
    },
    outputArtifacts: [
      {
        id: 'output_1',
        type: 'memo',
        title: '宁德时代投资备忘录',
        summary: '聚焦资本开支与全球竞争力。',
        content: '# 宁德时代投资备忘录',
        content_format: 'markdown',
        source_raw_ids: ['raw_1'],
        source_ontology_ids: ['graph_1'],
        status: 'draft',
        publish_targets: [],
        metadata: {
          source_surface: 'chat',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  });

  assert.equal(artifact.type, 'memo');
  assert.match(artifact.title, /Graphify Report/);
  assert.equal((artifact.metadata as Record<string, unknown>).dedupe_key, 'graphify-report::ontology::graphify::output::output_1');
  const lineage = (artifact.metadata as Record<string, unknown>).lineage as Record<string, unknown>;
  assert.equal(lineage.source, 'graphify-report');
  assert.deepEqual(lineage.artifact_kinds, ['report', 'webpage']);
  const artifactRefs = lineage.artifact_refs as Array<Record<string, unknown>>;
  assert.equal(artifactRefs.length, 2);
  assert.equal(artifactRefs[0]?.path, '/tmp/job/graphify-out/GRAPH_REPORT.md');
});
