import test from 'node:test';
import assert from 'node:assert/strict';

import { findOntologyShortestPath, getOntologyNodeDetail } from './graph-navigation.ts';
import type { OntologyDocument } from './ontology-types.ts';

const documentFixture: OntologyDocument = {
  id: 'ontology_1',
  title: '测试图谱',
  summary: 'summary',
  source_raw_ids: ['raw_1'],
  status: 'compiled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  nodes: [
    { id: 'a', graph_id: 'ontology_1', label: 'A', node_type: 'Concept', summary: 'A', weight: 1, evidence_links: [] },
    { id: 'b', graph_id: 'ontology_1', label: 'B', node_type: 'Concept', summary: 'B', weight: 1, evidence_links: [] },
    { id: 'c', graph_id: 'ontology_1', label: 'C', node_type: 'Concept', summary: 'C', weight: 1, evidence_links: [] },
  ],
  edges: [
    { id: 'e1', graph_id: 'ontology_1', from_node_id: 'a', to_node_id: 'b', relation_type: 'mentions', weight: 1, evidence_links: [] },
    { id: 'e2', graph_id: 'ontology_1', from_node_id: 'b', to_node_id: 'c', relation_type: 'supports', weight: 1, evidence_links: [] },
  ],
  metadata: null,
};

test('getOntologyNodeDetail returns neighbors and degree', () => {
  const detail = getOntologyNodeDetail(documentFixture, 'b');
  assert.ok(detail);
  assert.equal(detail?.degree, 2);
  assert.deepEqual(detail?.neighbors.map((item) => item.node.label), ['A', 'C']);
});

test('findOntologyShortestPath returns ordered nodes and edges', () => {
  const path = findOntologyShortestPath(documentFixture, 'a', 'c');
  assert.ok(path);
  assert.deepEqual(path?.nodeIds, ['a', 'b', 'c']);
  assert.deepEqual(path?.edges.map((edge) => edge.id), ['e1', 'e2']);
});
