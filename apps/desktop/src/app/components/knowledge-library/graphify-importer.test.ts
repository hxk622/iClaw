import test from 'node:test';
import assert from 'node:assert/strict';

import { importGraphifyGraphToOntologyDocument } from './graphify-importer.ts';

test('importGraphifyGraphToOntologyDocument converts node-link graph into OntologyDocument', () => {
  const document = importGraphifyGraphToOntologyDocument({
    trigger: 'output_feedback',
    graphJsonText: JSON.stringify({
      directed: true,
      multigraph: false,
      graph: {},
      nodes: [
        {
          id: 'memo_node',
          label: '宁德时代投资备忘录',
          file_type: 'document',
          source_file: 'corpus/output_1.md',
          source_location: 'L1',
          community: 1,
        },
        {
          id: 'capex_node',
          label: '资本开支',
          file_type: 'semantic',
          source_file: 'corpus/output_1.md',
          source_location: 'L12',
          community: 1,
        },
      ],
      links: [
        {
          source: 'memo_node',
          target: 'capex_node',
          relation: 'rationale_for',
          confidence: 'INFERRED',
          source_file: 'corpus/output_1.md',
          source_location: 'L12',
          weight: 1,
        },
      ],
    }),
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
    graphifyMetadata: {
      corpusDir: '/tmp/job/corpus',
      outputDir: '/tmp/job/corpus/graphify-out',
      graphJsonPath: '/tmp/job/corpus/graphify-out/graph.json',
      reportPath: '/tmp/job/corpus/graphify-out/GRAPH_REPORT.md',
      htmlPath: '/tmp/job/corpus/graphify-out/graph.html',
    },
  });

  assert.equal(document.metadata?.compiler_backend, 'graphify-v3');
  assert.equal(document.metadata?.graphify_graph_json_path, '/tmp/job/corpus/graphify-out/graph.json');
  assert.equal(document.nodes.length, 2);
  assert.equal(document.edges.length, 1);
  assert.equal(document.nodes.some((node) => node.node_type === 'Output'), true);
  assert.equal(document.edges[0]?.relation_type, 'supports');
});
