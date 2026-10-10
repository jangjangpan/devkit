// dagre 기반 자동 정렬 — 순서도/ERD 공용.
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export type LayoutDir = 'TB' | 'LR';

export function layoutNodes<T extends Node>(nodes: T[], edges: Edge[], dir: LayoutDir = 'TB'): T[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: dir === 'LR' ? 40 : 50, ranksep: dir === 'LR' ? 90 : 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    const w = (n as { measured?: { width?: number } }).measured?.width || 170;
    const h = (n as { measured?: { height?: number } }).measured?.height || 60;
    g.setNode(n.id, { width: w, height: h });
  });
  edges.forEach((e) => { if (e.source && e.target) g.setEdge(e.source, e.target); });

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    if (!p) return n;
    return { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } };
  });
}
