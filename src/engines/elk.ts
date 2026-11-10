import { createRequire } from 'node:module';
import { type ELK, type ELKConstructorArguments, type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import packageJson from 'elkjs/package.json' with { type: 'json' };
import type { LayoutEngine, LayoutRequest, LayoutResult, Point } from '../types.js';
import { normalizeResult } from '../normalize.js';
import { packConnectedComponents } from '../pack-components.js';

const DIRECTIONS = { TB: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' } as const;
const ROUTING = { straight: 'POLYLINE', polyline: 'POLYLINE', orthogonal: 'ORTHOGONAL', spline: 'SPLINES' } as const;
const MODEL_ORDER = { strict: 'NODES_AND_EDGES', prefer: 'PREFER_NODES', 'crossings-first': 'NONE' } as const;
const require = createRequire(import.meta.url);
const ELKConstructor = require('elkjs/lib/elk.bundled.js') as new (args?: ELKConstructorArguments) => ELK;

export class ElkLayoutEngine implements LayoutEngine {
  readonly name = 'elk' as const;
  readonly version = packageJson.version;
  private readonly elk = new ELKConstructor();

  async layout(request: LayoutRequest): Promise<LayoutResult> {
    const startedAt = performance.now();
    const warnings: string[] = [];
    const root = await this.elk.layout(toElkGraph(request));
    if (request.nodes.some(node => node.pinned)) warnings.push('ELK_LAYERED_PINNING_IS_BEST_EFFORT');
    if (request.options.stability?.preservePreviousPositions) warnings.push('ELK_STABILITY_PRESERVES_ORDER_ONLY');
    const nodes = flattenNodes(root).filter(node => request.nodes.some(input => input.id === node.id));
    const dimensions = new Map(request.nodes.map(node => [node.id, node]));
    const positionedNodes = nodes.map(node => {
      const input = dimensions.get(node.id)!;
      return { id: node.id, x: node.x, y: node.y, width: input.width, height: input.height };
    });
    let edges;
    if (request.options.includeEdgeRoutes) {
      edges = (root.edges ?? []).map((edge: ElkExtendedEdge) => ({
        id: edge.id,
        points: edgePoints(edge, request.options.routing === 'straight'),
      }));
    }
    const packed = packConnectedComponents(positionedNodes, edges, request);
    return normalizeResult({ nodes: packed.nodes, edges: packed.edges, bounds: { x: 0, y: 0, width: 0, height: 0 }, engine: { name: this.name, version: this.version }, durationMs: performance.now() - startedAt, warnings });
  }
}

function toElkGraph(request: LayoutRequest): ElkNode {
  const options = request.options;
  const children: ElkNode[] = request.nodes.map(node => {
    const child: ElkNode = { id: node.id, width: node.width, height: node.height };
    if (node.rank != null) child.layoutOptions = { 'org.eclipse.elk.partitioning.partition': String(node.rank) };
    return child;
  });
  const rootChildren = options.groups === 'compound' ? compoundChildren(children, request) : children;
  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': DIRECTIONS[options.direction],
    'elk.edgeRouting': ROUTING[options.routing],
    'elk.spacing.nodeNode': String(options.spacing.nodeSpacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(options.spacing.layerSpacing),
    'elk.spacing.edgeEdge': String(options.spacing.edgeSpacing),
    'elk.spacing.componentComponent': String(options.spacing.nodeSpacing),
    'elk.separateConnectedComponents': 'true',
    'elk.layered.compaction.connectedComponents': 'true',
    'elk.layered.considerModelOrder.strategy': MODEL_ORDER[options.ordering.policy],
    'elk.layered.crossingMinimization.forceNodeModelOrder': String(options.ordering.policy === 'strict'),
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
    'elk.hierarchyHandling': options.groups === 'compound' ? 'INCLUDE_CHILDREN' : 'INHERIT',
  };
  if (request.nodes.some(node => node.rank != null)) {
    layoutOptions['elk.partitioning.activate'] = 'true';
  }
  if (options.stability?.preservePreviousPositions) {
    layoutOptions['elk.layered.crossingMinimization.semiInteractive'] = 'true';
  }
  return {
    id: 'root',
    children: rootChildren,
    edges: request.edges.map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    layoutOptions,
  };
}

function compoundChildren(children: ElkNode[], request: LayoutRequest): ElkNode[] {
  const groups = new Map<string, ElkNode[]>();
  const ungrouped: ElkNode[] = [];
  for (const child of children) {
    const groupId = request.nodes.find(node => node.id === child.id)?.groupId;
    if (!groupId) ungrouped.push(child);
    else groups.set(groupId, [...(groups.get(groupId) ?? []), child]);
  }
  return [...ungrouped, ...[...groups.entries()].map(([id, grouped]) => ({ id: `group:${id}`, children: grouped }))];
}

function flattenNodes(root: ElkNode, parent: Point = { x: 0, y: 0 }): Array<{ id: string; x: number; y: number }> {
  const origin = { x: parent.x + (root.x ?? 0), y: parent.y + (root.y ?? 0) };
  return [{ id: root.id, ...origin }, ...(root.children ?? []).flatMap(child => flattenNodes(child, origin))];
}

function edgePoints(edge: ElkExtendedEdge, straight: boolean): Point[] {
  const points = (edge.sections ?? []).flatMap(section => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]);
  if (straight && points.length > 1) return [points[0]!, points[points.length - 1]!];
  return points;
}
