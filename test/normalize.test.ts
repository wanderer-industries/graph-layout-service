import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeResult } from '../src/normalize.js';

test('normalizes top-left coordinates, routes, order, and bounds', () => {
  const result = normalizeResult({
    nodes: [
      { id: 'b', x: 10, y: -5, width: 20, height: 10 },
      { id: 'a', x: -10, y: 5, width: 5, height: 5 },
    ],
    edges: [{ id: 'edge', points: [{ x: 0, y: 0 }] }],
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    engine: { name: 'elk', version: 'test' },
    durationMs: 1,
    warnings: [],
  });
  assert.deepEqual(result.nodes.map(node => [node.id, node.x, node.y]), [['a', 0, 10], ['b', 20, 0]]);
  assert.deepEqual(result.edges?.[0]?.points, [{ x: 10, y: 5 }]);
  assert.deepEqual(result.bounds, { x: 0, y: 0, width: 40, height: 15 });
});
