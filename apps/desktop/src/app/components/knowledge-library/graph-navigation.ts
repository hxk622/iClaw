import type { OntologyDocument, OntologyEdge, OntologyNode } from './ontology-types.ts';

export interface OntologyNodeNeighbor {
  node: OntologyNode;
  edge: OntologyEdge;
  direction: 'outgoing' | 'incoming';
}

export interface OntologyNodeDetail {
  node: OntologyNode;
  neighbors: OntologyNodeNeighbor[];
  degree: number;
}

export interface OntologyShortestPathResult {
  nodeIds: string[];
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function getOntologyNodeById(document: OntologyDocument, nodeId: string | null | undefined): OntologyNode | null {
  if (!nodeId) {
    return null;
  }
  return document.nodes.find((node) => node.id === nodeId) || null;
}

export function getOntologyNodeDetail(document: OntologyDocument, nodeId: string | null | undefined): OntologyNodeDetail | null {
  const node = getOntologyNodeById(document, nodeId);
  if (!node) {
    return null;
  }

  const neighbors: OntologyNodeNeighbor[] = [];
  document.edges.forEach((edge) => {
    if (edge.from_node_id === node.id) {
      const target = getOntologyNodeById(document, edge.to_node_id);
      if (target) {
        neighbors.push({
          node: target,
          edge,
          direction: 'outgoing',
        });
      }
    } else if (edge.to_node_id === node.id) {
      const source = getOntologyNodeById(document, edge.from_node_id);
      if (source) {
        neighbors.push({
          node: source,
          edge,
          direction: 'incoming',
        });
      }
    }
  });

  return {
    node,
    neighbors: uniqueById(neighbors.map((item) => ({ ...item, id: `${item.direction}:${item.node.id}:${item.edge.id}` }))).map(
      ({ id: _id, ...rest }) => rest,
    ),
    degree: neighbors.length,
  };
}

export function findOntologyShortestPath(
  document: OntologyDocument,
  sourceNodeId: string | null | undefined,
  targetNodeId: string | null | undefined,
): OntologyShortestPathResult | null {
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
    return null;
  }
  const source = getOntologyNodeById(document, sourceNodeId);
  const target = getOntologyNodeById(document, targetNodeId);
  if (!source || !target) {
    return null;
  }

  const adjacency = new Map<string, Array<{ nodeId: string; edge: OntologyEdge }>>();
  document.edges.forEach((edge) => {
    adjacency.set(edge.from_node_id, [
      ...(adjacency.get(edge.from_node_id) || []),
      { nodeId: edge.to_node_id, edge },
    ]);
    adjacency.set(edge.to_node_id, [
      ...(adjacency.get(edge.to_node_id) || []),
      { nodeId: edge.from_node_id, edge },
    ]);
  });

  const queue: string[] = [source.id];
  const visited = new Set<string>([source.id]);
  const previousNode = new Map<string, string>();
  const previousEdge = new Map<string, OntologyEdge>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target.id) {
      break;
    }
    for (const neighbor of adjacency.get(current) || []) {
      if (visited.has(neighbor.nodeId)) {
        continue;
      }
      visited.add(neighbor.nodeId);
      previousNode.set(neighbor.nodeId, current);
      previousEdge.set(neighbor.nodeId, neighbor.edge);
      queue.push(neighbor.nodeId);
    }
  }

  if (!visited.has(target.id)) {
    return null;
  }

  const nodeIds: string[] = [];
  const edges: OntologyEdge[] = [];
  let cursor: string | undefined = target.id;
  while (cursor) {
    nodeIds.unshift(cursor);
    const edge = previousEdge.get(cursor);
    if (edge) {
      edges.unshift(edge);
    }
    cursor = previousNode.get(cursor);
  }

  return {
    nodeIds,
    nodes: nodeIds.map((id) => getOntologyNodeById(document, id)).filter((node): node is OntologyNode => Boolean(node)),
    edges,
  };
}
