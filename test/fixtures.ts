import type { LayoutRequest } from '../src/types.js';

export const SIMPLE_GRAPH: LayoutRequest = {
  nodes: [
    { id: 'b', name: 'Beta', width: 100, height: 50, previousPosition: { x: 100, y: 0 } },
    { id: 'a', name: 'Alpha', width: 100, height: 50, previousPosition: { x: 0, y: 0 } },
    { id: 'c', name: 'Gamma', width: 100, height: 50, previousPosition: { x: 200, y: 0 } },
  ],
  edges: [
    { id: 'bc', source: 'b', target: 'c' },
    { id: 'ab', source: 'a', target: 'b' },
  ],
  options: {
    engine: 'elk',
    direction: 'TB',
    routing: 'orthogonal',
    includeEdgeRoutes: true,
    spacing: { nodeSpacing: 40, layerSpacing: 80, edgeSpacing: 16 },
    ordering: { by: 'name', direction: 'asc', locale: 'en', policy: 'prefer' },
    groups: 'none',
    stability: { preservePreviousPositions: true },
  },
};
