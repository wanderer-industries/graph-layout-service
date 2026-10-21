import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalize } from '../src/canonicalize.js';
import { SIMPLE_GRAPH } from './fixtures.js';

test('canonicalizes nodes and edges with ids as final tie breakers', () => {
  const result = canonicalize(SIMPLE_GRAPH);
  assert.deepEqual(result.nodes.map(node => node.id), ['a', 'b', 'c']);
  assert.deepEqual(result.edges.map(edge => edge.id), ['ab', 'bc']);
});

test('supports explicit descending order', () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.options.ordering.direction = 'desc';
  assert.deepEqual(canonicalize(request).nodes.map(node => node.id), ['c', 'b', 'a']);
});
