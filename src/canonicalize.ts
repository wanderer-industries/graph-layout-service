import type { LayoutEdge, LayoutNode, LayoutRequest } from './types.js';

function compareText(left: string, right: string, locale: string): number {
  return left.localeCompare(right, locale, { numeric: true, sensitivity: 'base' });
}

function orderedNodes(request: LayoutRequest): LayoutNode[] {
  const { by, direction, locale } = request.options.ordering;
  const factor = direction === 'asc' ? 1 : -1;
  const previousOrder = [...request.nodes]
    .sort((left, right) => {
      const leftPoint = left.previousPosition ?? { x: 0, y: 0 };
      const rightPoint = right.previousPosition ?? { x: 0, y: 0 };
      const primaryAxis = request.options.direction === 'TB' || request.options.direction === 'BT' ? 'x' : 'y';
      return leftPoint[primaryAxis] - rightPoint[primaryAxis];
    })
    .map((node, index) => [node.id, index] as const);
  const previousIndex = new Map(previousOrder);

  return [...request.nodes].sort((left, right) => {
    let result = 0;
    if (by === 'name') result = compareText(left.name, right.name, locale);
    if (by === 'previous-order') result = (previousIndex.get(left.id) ?? 0) - (previousIndex.get(right.id) ?? 0);
    if (result === 0) result = compareText(left.id, right.id, locale);
    return result * factor;
  });
}

export function canonicalize(request: LayoutRequest): LayoutRequest {
  const nodes = orderedNodes(request);
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const edges: LayoutEdge[] = [...request.edges].sort((left, right) => {
    const sourceOrder = (nodeIndex.get(left.source) ?? 0) - (nodeIndex.get(right.source) ?? 0);
    if (sourceOrder !== 0) return sourceOrder;
    const targetOrder = (nodeIndex.get(left.target) ?? 0) - (nodeIndex.get(right.target) ?? 0);
    if (targetOrder !== 0) return targetOrder;
    return left.id.localeCompare(right.id, request.options.ordering.locale);
  });
  return { ...request, nodes, edges };
}
