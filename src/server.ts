import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { trace } from '@opentelemetry/api';
import { config } from './config.js';
import { edgeCount, engineDuration, nodeCount, registry, requestCount, requestDuration } from './metrics.js';
import type { LayoutRequest } from './types.js';
import { validateRequest } from './validation.js';
import { JobTimeoutError, QueueFullError, WorkerPool } from './worker-pool.js';

const pool = new WorkerPool(config.workerCount, config.maxQueueLength, config.jobTimeoutMs);
const tracer = trace.getTracer('graph-layout-service');

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > config.maxBodyBytes) throw new RequestError(413, 'REQUEST_BODY_TOO_LARGE', `Body exceeds ${config.maxBodyBytes} bytes`);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
}

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function handleLayout(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = await readJson(request);
  const validationErrors = tracer.startActiveSpan('layout.validation', span => {
    try {
      return validateRequest(input, config.maxNodes, config.maxEdges);
    } finally {
      span.end();
    }
  });
  if (validationErrors.length > 0) {
    sendJson(response, 422, { error: { code: 'VALIDATION_FAILED', message: 'Layout request is invalid', details: validationErrors } });
    return;
  }
  const layoutRequest = input as LayoutRequest;
  nodeCount.observe(layoutRequest.nodes.length);
  edgeCount.observe(layoutRequest.edges.length);
  const result = await pool.run(layoutRequest);
  engineDuration.observe({ engine: result.engine.name }, result.durationMs / 1000);
  sendJson(response, 200, result);
}

const server = createServer(async (request, response) => {
  const startedAt = performance.now();
  const route = request.url?.split('?')[0] ?? '/';
  let status = 500;
  try {
    if (request.method === 'GET' && route === '/healthz') {
      status = 200;
      sendJson(response, status, { status: 'ok' });
    } else if (request.method === 'GET' && route === '/readyz') {
      status = pool.isReady() ? 200 : 503;
      sendJson(response, status, { status: pool.isReady() ? 'ready' : 'not_ready' });
    } else if (request.method === 'GET' && route === '/metrics') {
      status = 200;
      response.writeHead(status, { 'content-type': registry.contentType });
      response.end(await registry.metrics());
    } else if (request.method === 'POST' && route === '/v1/layout') {
      await handleLayout(request, response);
      status = response.statusCode;
    } else {
      status = 404;
      sendJson(response, status, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }
  } catch (error) {
    if (error instanceof RequestError) {
      status = error.status;
      sendJson(response, status, { error: { code: error.code, message: error.message } });
    } else if (error instanceof QueueFullError) {
      status = 429;
      sendJson(response, status, { error: { code: 'QUEUE_FULL', message: error.message } });
    } else if (error instanceof JobTimeoutError) {
      status = 504;
      sendJson(response, status, { error: { code: 'LAYOUT_TIMEOUT', message: error.message } });
    } else {
      status = 500;
      const message = error instanceof Error ? error.message : 'Unknown layout error';
      sendJson(response, status, { error: { code: 'ENGINE_ERROR', message } });
    }
  } finally {
    requestCount.inc({ method: request.method ?? 'UNKNOWN', route, status: String(status) });
    requestDuration.observe({ route }, (performance.now() - startedAt) / 1000);
  }
});

server.listen(config.port, '0.0.0.0', () => process.stdout.write(`graph-layout-service listening on ${config.port}\n`));

async function shutdown(): Promise<void> {
  server.close();
  await pool.close();
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
