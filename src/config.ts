import { availableParallelism } from 'node:os';

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

export const config = {
  port: positiveInteger('PORT', 3000),
  workerCount: positiveInteger('LAYOUT_WORKER_COUNT', Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)))),
  maxNodes: positiveInteger('LAYOUT_MAX_NODES', 2_000),
  maxEdges: positiveInteger('LAYOUT_MAX_EDGES', 5_000),
  jobTimeoutMs: positiveInteger('LAYOUT_JOB_TIMEOUT_MS', 15_000),
  maxQueueLength: positiveInteger('LAYOUT_MAX_QUEUE_LENGTH', 100),
  maxBodyBytes: positiveInteger('LAYOUT_MAX_BODY_BYTES', 5 * 1024 * 1024),
};
