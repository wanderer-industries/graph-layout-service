import { Worker } from 'node:worker_threads';
import { trace, type Span } from '@opentelemetry/api';
import { engineErrors, queueSize, timeouts, workersBusy } from './metrics.js';
import type { LayoutRequest, LayoutResult } from './types.js';

const WORKER_URL = new URL('./worker.js', import.meta.url);
const WORKER_EXEC_ARGV: string[] = [];

interface Job {
  id: number;
  request: LayoutRequest;
  resolve: (result: LayoutResult) => void;
  reject: (error: Error) => void;
  queueSpan: Span;
}

interface WorkerSlot {
  worker: Worker;
  job?: Job;
  timeout?: NodeJS.Timeout;
}

export class QueueFullError extends Error {}
export class JobTimeoutError extends Error {}

export class WorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: Job[] = [];
  private nextJobId = 1;
  private readonly tracer = trace.getTracer('graph-layout-service');

  constructor(private readonly size: number, private readonly maxQueueLength: number, private readonly timeoutMs: number) {
    for (let index = 0; index < size; index += 1) this.slots.push(this.createSlot());
  }

  isReady(): boolean {
    return this.slots.length === this.size;
  }

  run(request: LayoutRequest): Promise<LayoutResult> {
    const hasIdleWorker = this.slots.some(slot => !slot.job);
    if (!hasIdleWorker && this.queue.length >= this.maxQueueLength) return Promise.reject(new QueueFullError('Worker queue is full'));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextJobId++, request, resolve, reject, queueSpan: this.tracer.startSpan('layout.queue_wait') });
      this.updateMetrics();
      this.dispatch();
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.slots.map(slot => slot.worker.terminate()));
  }

  private createSlot(): WorkerSlot {
    const slot: WorkerSlot = { worker: new Worker(WORKER_URL, { execArgv: WORKER_EXEC_ARGV }) };
    slot.worker.on('message', (message: { jobId: number; result?: LayoutResult; error?: string }) => this.complete(slot, message));
    slot.worker.on('error', error => this.fail(slot, error));
    slot.worker.on('exit', code => {
      if (code !== 0 && slot.job) this.fail(slot, new Error(`Worker exited with code ${code}`));
    });
    return slot;
  }

  private dispatch(): void {
    for (const slot of this.slots) {
      if (slot.job || this.queue.length === 0) continue;
      const job = this.queue.shift()!;
      job.queueSpan.end();
      slot.job = job;
      slot.timeout = setTimeout(() => this.expire(slot), this.timeoutMs);
      slot.worker.postMessage({ jobId: job.id, request: job.request });
    }
    this.updateMetrics();
  }

  private complete(slot: WorkerSlot, message: { jobId: number; result?: LayoutResult; error?: string }): void {
    const job = slot.job;
    if (!job || job.id !== message.jobId) return;
    if (slot.timeout) clearTimeout(slot.timeout);
    slot.job = undefined;
    slot.timeout = undefined;
    if (message.error) {
      engineErrors.inc({ engine: job.request.options.engine ?? 'elk' });
      job.reject(new Error(message.error));
    } else if (message.result) job.resolve(message.result);
    this.dispatch();
  }

  private fail(slot: WorkerSlot, error: Error): void {
    if (slot.timeout) clearTimeout(slot.timeout);
    const job = slot.job;
    slot.job = undefined;
    slot.timeout = undefined;
    if (job) {
      engineErrors.inc({ engine: job.request.options.engine ?? 'elk' });
      job.reject(error);
    }
    this.replace(slot);
  }

  private expire(slot: WorkerSlot): void {
    if (!slot.job) return;
    const job = slot.job;
    slot.job = undefined;
    slot.timeout = undefined;
    timeouts.inc();
    job.reject(new JobTimeoutError(`Layout exceeded ${this.timeoutMs}ms`));
    void slot.worker.terminate();
    this.replace(slot);
  }

  private replace(slot: WorkerSlot): void {
    const index = this.slots.indexOf(slot);
    if (index >= 0) this.slots[index] = this.createSlot();
    this.dispatch();
  }

  private updateMetrics(): void {
    queueSize.set(this.queue.length);
    workersBusy.set(this.slots.filter(slot => slot.job).length);
  }
}
