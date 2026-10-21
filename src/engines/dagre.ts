import dagre from '@dagrejs/dagre';
import packageJson from '@dagrejs/dagre/package.json' with { type: 'json' };
import type { LayoutEngine, LayoutRequest, LayoutResult, Routing } from '../types.js';
import { normalizeResult } from '../normalize.js';

const RANK_DIRECTIONS = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' } as const;

export class DagreLayoutEngine implements LayoutEngine {
  readonly name = 'dagre' as const;
  readonly version = packageJson.version;

  async layout(request: LayoutRequest): Promise<LayoutResult> {
    const startedAt = performance.now();
    const graph = new dagre.graphlib.Graph({ compound: request.options.groups === 'compound', multigraph: true });
    const warnings: string[] = [];
    graph.setGraph({
      rankdir: RANK_DIRECTIONS[request.options.direction],
      nodesep: request.options.spacing.nodeSpacing,
      ranksep: request.options.spacing.layerSpacing,
      edgesep: request.options.spacing.edgeSpacing,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of request.nodes) graph.setNode(node.id, { width: node.width, height: node.height });
    if (request.options.groups === 'compound') {
      for (const node of request.nodes) if (node.groupId) graph.setParent(node.id, node.groupId);
    }
    for (const edge of request.edges) graph.setEdge(edge.source, edge.target, { weight: edge.weight, minlen: edge.minRankSpan }, edge.id);
    dagre.layout(graph);
    if (request.nodes.some(node => node.pinned)) warnings.push('DAGRE_PINNED_NODES_NOT_SUPPORTED');
    if (request.options.stability?.preservePreviousPositions) warnings.push('DAGRE_STABILITY_IS_ORDER_ONLY');
    if (request.options.routing === 'orthogonal') warnings.push('DAGRE_ORTHOGONAL_ROUTING_NOT_SUPPORTED');
    const nodes = request.nodes.map(node => {
      const positioned = graph.node(node.id);
      return { id: node.id, x: positioned.x - node.width / 2, y: positioned.y - node.height / 2, width: node.width, height: node.height };
    });
    let edges;
    if (request.options.includeEdgeRoutes) {
      edges = request.edges.map(edge => ({
        id: edge.id,
        points: routePoints(request.options.routing, graph.edge({ v: edge.source, w: edge.target, name: edge.id }).points),
      }));
    }
    return normalizeResult({ nodes, edges, bounds: { x: 0, y: 0, width: 0, height: 0 }, engine: { name: this.name, version: this.version }, durationMs: performance.now() - startedAt, warnings });
  }
}

function routePoints(routing: Routing, points: Array<{ x: number; y: number }>) {
  if (routing === 'straight' && points.length > 1) return [points[0]!, points[points.length - 1]!];
  return points;
}
