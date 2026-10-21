import type { LayoutResult, Point, PositionedNode, RoutedEdge } from './types.js';
import { trace } from '@opentelemetry/api';

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function normalizeResult(result: LayoutResult): LayoutResult {
  const span = trace.getTracer('graph-layout-service-worker').startSpan('layout.output_normalization');
  try {
    const minX = result.nodes.length > 0 ? Math.min(...result.nodes.map(node => finite(node.x))) : 0;
    const minY = result.nodes.length > 0 ? Math.min(...result.nodes.map(node => finite(node.y))) : 0;
    const shiftPoint = (point: Point): Point => ({ x: finite(point.x) - minX, y: finite(point.y) - minY });
    const nodes: PositionedNode[] = result.nodes
      .map(node => ({ ...node, ...shiftPoint(node) }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const edges: RoutedEdge[] | undefined = result.edges
      ?.map(edge => ({ id: edge.id, points: edge.points.map(shiftPoint) }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const width = nodes.length > 0 ? Math.max(...nodes.map(node => node.x + node.width)) : 0;
    const height = nodes.length > 0 ? Math.max(...nodes.map(node => node.y + node.height)) : 0;
    return { ...result, nodes, edges, bounds: { x: 0, y: 0, width, height } };
  } finally {
    span.end();
  }
}
