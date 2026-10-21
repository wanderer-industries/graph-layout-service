import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMPLE_GRAPH } from './fixtures.js';
import { validateRequest } from '../src/validation.js';

test('accepts the public v1 contract', () => {
  assert.deepEqual(validateRequest(SIMPLE_GRAPH, 10, 10), []);
});

test('returns machine-readable graph errors', () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.nodes[1]!.id = request.nodes[0]!.id;
  request.edges[0]!.target = 'missing';
  const codes = validateRequest(request, 10, 10).map(error => error.code);
  assert.ok(codes.includes('DUPLICATE_NODE_ID'));
  assert.ok(codes.includes('EDGE_TARGET_NOT_FOUND'));
});

test('enforces configured graph limits', () => {
  const codes = validateRequest(SIMPLE_GRAPH, 2, 1).map(error => error.code);
  assert.deepEqual(codes, ['LIMIT_NODES_EXCEEDED', 'LIMIT_EDGES_EXCEEDED']);
});
