import { useMemo } from 'react';
import type { GraphifyDocumentViewModel } from './ontology-types';

type PositionedNode = GraphifyDocumentViewModel['nodes'][number] & {
  x: number;
  y: number;
};

function buildNodePositions(graph: GraphifyDocumentViewModel, width: number, height: number): PositionedNode[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const nodes = graph.nodes || [];
  if (nodes.length === 0) return [];

  const central = nodes[0];
  const others = nodes.slice(1);
  const ringA = others.filter((node) => node.type !== 'Evidence').slice(0, Math.max(0, others.length - 2));
  const ringB = others.filter((node) => node.type === 'Evidence');

  const positioned: PositionedNode[] = [
    {
      ...central,
      x: centerX,
      y: centerY,
    },
  ];

  const placeRing = (items: typeof nodes, radius: number, startAngle = -Math.PI / 2) => {
    items.forEach((node, index) => {
      const angle = startAngle + (index / Math.max(items.length, 1)) * Math.PI * 2;
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    });
  };

  placeRing(ringA, Math.min(width, height) * 0.27);
  placeRing(ringB, Math.min(width, height) * 0.4, Math.PI / 5);

  return positioned;
}

function findNode(nodes: PositionedNode[], id: string) {
  return nodes.find((node) => node.id === id) || null;
}

export function GraphifyOntologyGraphView({
  graph,
  className = '',
  height = 360,
}: {
  graph: GraphifyDocumentViewModel;
  className?: string;
  height?: number;
}) {
  const width = 720;
  const nodes = useMemo(() => buildNodePositions(graph, width, height), [graph, height]);

  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border border-[var(--border-primary)] bg-[radial-gradient(circle_at_top,rgba(180,154,112,0.10),transparent_46%),var(--bg-page)] ${className}`}
      style={{ height: `${height}px` }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        {(graph.edges || []).map((edge) => {
          const source = findNode(nodes, edge.source);
          const target = findNode(nodes, edge.target);
          if (!source || !target) return null;
          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="rgba(180,154,112,0.34)"
                strokeWidth={edge.width}
              />
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 6}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(232,232,227,0.55)"
              >
                {edge.relation}
              </text>
            </g>
          );
        })}
      </svg>

      {nodes.map((node, index) => {
        const size = Math.max(34, node.size + 12);
        const isCenter = index === 0;
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-center shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
            style={{
              left: `${(node.x / width) * 100}%`,
              top: `${(node.y / height) * 100}%`,
              width: `${size}px`,
              minHeight: `${size}px`,
              padding: isCenter ? '12px 14px' : '10px 12px',
              borderColor: isCenter ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)',
              background: node.color,
              color: isCenter ? '#111827' : '#0F172A',
              fontWeight: isCenter ? 700 : 600,
              fontSize: isCenter ? '12px' : '11px',
              lineHeight: 1.35,
            }}
            title={`${node.type} · ${node.label}`}
          >
            {node.label}
          </div>
        );
      })}
    </div>
  );
}
