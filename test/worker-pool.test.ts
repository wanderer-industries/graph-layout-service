import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMPLE_GRAPH } from './fixtures.js';
import { JobTimeoutError, QueueFullError, WorkerPool } from '../dist/worker-pool.js';

test('worker pool executes layout outside the HTTP thread', async () => {
  const pool = new WorkerPool(1, 2, 5_000);
  try {
    const result = await pool.run(SIMPLE_GRAPH);
    assert.equal(result.nodes.length, SIMPLE_GRAPH.nodes.length);
  } finally {
    await pool.close();
  }
});

test('worker pool rejects timed out jobs', async () => {
  const pool = new WorkerPool(1, 1, 1);
  try {
    await assert.rejects(pool.run(SIMPLE_GRAPH), JobTimeoutError);
  } finally {
    await pool.close();
  }
});

test('worker pool applies queue backpressure', async () => {
  const pool = new WorkerPool(1, 1, 5_000);
  const first = pool.run(SIMPLE_GRAPH);
  const second = pool.run(SIMPLE_GRAPH);
  try {
    await assert.rejects(pool.run(SIMPLE_GRAPH), QueueFullError);
    await Promise.all([first, second]);
  } finally {
    await pool.close();
  }
});
