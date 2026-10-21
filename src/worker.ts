import { parentPort } from 'node:worker_threads';
import { trace } from '@opentelemetry/api';
import { canonicalize } from './canonicalize.js';
import { DagreLayoutEngine } from './engines/dagre.js';
import { ElkLayoutEngine } from './engines/elk.js';
import type { LayoutRequest } from './types.js';

const engines = { elk: new ElkLayoutEngine(), dagre: new DagreLayoutEngine() } as const;
const tracer = trace.getTracer('graph-layout-service-worker');

parentPort?.on('message', async (message: { jobId: number; request: LayoutRequest }) => {
  try {
    const request = canonicalize(message.request);
    const engine = engines[request.options.engine ?? 'elk'];
    const result = await tracer.startActiveSpan('layout.engine_calculation', async span => {
      try {
        return await engine.layout(request);
      } finally {
        span.end();
      }
    });
    parentPort?.postMessage({ jobId: message.jobId, result });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({ jobId: message.jobId, error: messageText });
  }
});
