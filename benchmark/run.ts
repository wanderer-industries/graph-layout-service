import { readFileSync } from 'node:fs';
import type { LayoutEdge, LayoutNode, LayoutRequest } from '../src/types.js';

interface BenchmarkCase {
  name: string;
  graphClass: 'chain' | 'tree' | 'sparse';
  nodes: number;
  jobs: number;
  concurrency: number;
}

const matrix = JSON.parse(readFileSync(new URL('./matrix.json', import.meta.url), 'utf8')) as BenchmarkCase[];
const baseUrl = process.env.LAYOUT_BENCHMARK_URL ?? 'http://127.0.0.1:3000';

for (const benchmarkCase of matrix) {
  const request = createRequest(benchmarkCase);
  const durations: number[] = [];
  let failures = 0;
  const startedAt = performance.now();
  let nextJob = 0;

  async function runner(): Promise<void> {
    while (nextJob < benchmarkCase.jobs) {
      nextJob += 1;
      const jobStartedAt = performance.now();
      const response = await fetch(`${baseUrl}/v1/layout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      durations.push(performance.now() - jobStartedAt);
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    }
  }

  await Promise.all(Array.from({ length: benchmarkCase.concurrency }, () => runner()));
  durations.sort((left, right) => left - right);
  const elapsedMs = performance.now() - startedAt;
  process.stdout.write(`${JSON.stringify({
    ...benchmarkCase,
    failures,
    elapsedMs: Math.round(elapsedMs),
    requestsPerSecond: Number(((benchmarkCase.jobs * 1000) / elapsedMs).toFixed(2)),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
  })}\n`);
}

function createRequest(benchmarkCase: BenchmarkCase): LayoutRequest {
  const nodes: LayoutNode[] = Array.from({ length: benchmarkCase.nodes }, (_, index) => ({
    id: String(index),
    name: `Node ${index}`,
    width: 120,
    height: 60,
  }));
  const edges = createEdges(benchmarkCase);
  return {
    nodes,
    edges,
    options: {
      engine: 'elk',
      direction: 'TB',
      routing: 'orthogonal',
      spacing: { nodeSpacing: 40, layerSpacing: 80, edgeSpacing: 16 },
      ordering: { by: 'name', direction: 'asc', locale: 'en', policy: 'prefer' },
      groups: 'none',
    },
  };
}

function createEdges(benchmarkCase: BenchmarkCase): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  for (let index = 1; index < benchmarkCase.nodes; index += 1) {
    let source = index - 1;
    if (benchmarkCase.graphClass === 'tree') source = Math.floor((index - 1) / 2);
    if (benchmarkCase.graphClass === 'sparse') source = Math.max(0, index - 1 - (index % 7));
    edges.push({ id: `${source}-${index}`, source: String(source), target: String(index) });
  }
  return edges;
}

function percentile(values: number[], fraction: number): number {
  const index = Math.min(values.length - 1, Math.floor(values.length * fraction));
  return Number((values[index] ?? 0).toFixed(2));
}
