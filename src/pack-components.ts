import type { LayoutRequest, Point, PositionedNode, RoutedEdge } from './types.js';

interface ComponentBounds {
  ids: string[];
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface PackedLayout {
  nodes: PositionedNode[];
  edges?: RoutedEdge[];
}

interface Placement {
  component: ComponentBounds;
  x: number;
  y: number;
}

export function packConnectedComponents(
  nodes: PositionedNode[],
  edges: RoutedEdge[] | undefined,
  request: LayoutRequest,
): PackedLayout {
  if (nodes.length < 2) return { nodes, edges };

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const components = findComponents(request)
    .map(ids => componentBounds(ids, nodeById))
    .sort(compareComponents);
  const rankedNodeIds = new Set(request.nodes.filter(node => node.rank != null).map(node => node.id));
  const connectedComponents = components.filter(component =>
    component.ids.length > 1 || component.ids.some(id => rankedNodeIds.has(id)),
  );
  const isolatedComponents = components.filter(component =>
    component.ids.length === 1 && !rankedNodeIds.has(component.ids[0]!),
  );
  const gap = request.options.spacing.nodeSpacing;
  const shifts = new Map<string, Point>();
  const placements = placeConnectedComponents(connectedComponents, shifts, request);
  placeIsolatedComponents(isolatedComponents, placements, shifts, request, gap);

  const packedNodes = nodes.map(node => {
    const shift = shifts.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, x: node.x + shift.x, y: node.y + shift.y };
  });
  const sourceByEdgeId = new Map(request.edges.map(edge => [edge.id, edge.source]));
  const packedEdges = edges?.map(edge => {
    const source = sourceByEdgeId.get(edge.id);
    const shift = source ? shifts.get(source) : undefined;
    if (!shift) return edge;
    return { ...edge, points: edge.points.map(point => ({ x: point.x + shift.x, y: point.y + shift.y })) };
  });

  return { nodes: packedNodes, edges: packedEdges };
}

function placeConnectedComponents(
  components: ComponentBounds[],
  shifts: Map<string, Point>,
  request: LayoutRequest,
): Placement[] {
  const verticalTree = request.options.direction === 'TB' || request.options.direction === 'BT';
  const componentGap = Math.max(
    request.options.spacing.layerSpacing,
    request.options.spacing.nodeSpacing * 2,
  );
  const maxWidth = Math.max(0, ...components.map(component => component.width));
  const maxHeight = Math.max(0, ...components.map(component => component.height));
  const placements: Placement[] = [];
  let offset = 0;

  for (const component of components) {
    const x = componentX(component, request.options.direction, verticalTree, offset, maxWidth);
    const y = componentY(component, request.options.direction, verticalTree, offset, maxHeight);
    const shift = { x: x - component.minX, y: y - component.minY };
    for (const id of component.ids) shifts.set(id, shift);
    placements.push({ component, x, y });
    offset += (verticalTree ? component.width : component.height) + componentGap;
  }

  return placements;
}

function componentX(
  component: ComponentBounds,
  direction: LayoutRequest['options']['direction'],
  verticalTree: boolean,
  offset: number,
  maxWidth: number,
): number {
  if (verticalTree) return offset;
  if (direction === 'RL') return maxWidth - component.width;
  return 0;
}

function componentY(
  component: ComponentBounds,
  direction: LayoutRequest['options']['direction'],
  verticalTree: boolean,
  offset: number,
  maxHeight: number,
): number {
  if (!verticalTree) return offset;
  if (direction === 'BT') return maxHeight - component.height;
  return 0;
}

function placeIsolatedComponents(
  components: ComponentBounds[],
  placements: Placement[],
  shifts: Map<string, Point>,
  request: LayoutRequest,
  gap: number,
): void {
  if (components.length === 0) return;

  const verticalTree = request.options.direction === 'TB' || request.options.direction === 'BT';
  let x = 0;
  let y = Math.max(0, ...placements.map(item => item.y + item.component.height)) + gap;

  for (const component of components) {
    const shift = { x: x - component.minX, y: y - component.minY };
    shifts.set(component.ids[0]!, shift);
    if (verticalTree) x += component.width + gap;
    else y += component.height + gap;
  }
}

function findComponents(request: LayoutRequest): string[][] {
  const adjacency = new Map(request.nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of request.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of request.nodes) {
    if (visited.has(node.id)) continue;
    const ids: string[] = [];
    const pending = [node.id];
    visited.add(node.id);
    while (pending.length > 0) {
      const id = pending.pop()!;
      ids.push(id);
      const neighbours = [...(adjacency.get(id) ?? [])].sort().reverse();
      for (const neighbour of neighbours) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        pending.push(neighbour);
      }
    }
    components.push(ids.sort());
  }
  return components;
}

function componentBounds(ids: string[], nodeById: Map<string, PositionedNode>): ComponentBounds {
  const nodes = ids.map(id => nodeById.get(id)).filter((node): node is PositionedNode => node != null);
  const minX = Math.min(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxX = Math.max(...nodes.map(node => node.x + node.width));
  const maxY = Math.max(...nodes.map(node => node.y + node.height));
  return { ids, minX, minY, width: maxX - minX, height: maxY - minY };
}

function compareComponents(left: ComponentBounds, right: ComponentBounds): number {
  if (left.ids.length === 1 && right.ids.length === 1) return 0;
  if (left.ids.length !== right.ids.length) return right.ids.length - left.ids.length;
  const areaDifference = right.width * right.height - left.width * left.height;
  if (areaDifference !== 0) return areaDifference;
  return left.ids[0]!.localeCompare(right.ids[0]!);
}
