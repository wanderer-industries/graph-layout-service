import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'layout_service_' });

export const requestCount = new Counter({ name: 'layout_service_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status'] as const, registers: [registry] });
export const requestDuration = new Histogram({ name: 'layout_service_request_duration_seconds', help: 'HTTP request duration', labelNames: ['route'] as const, registers: [registry] });
export const engineDuration = new Histogram({ name: 'layout_service_engine_duration_seconds', help: 'Layout engine duration', labelNames: ['engine'] as const, registers: [registry] });
export const nodeCount = new Histogram({ name: 'layout_service_node_count', help: 'Nodes per layout job', buckets: [1, 10, 50, 100, 500, 1000, 2000], registers: [registry] });
export const edgeCount = new Histogram({ name: 'layout_service_edge_count', help: 'Edges per layout job', buckets: [0, 10, 50, 100, 500, 1000, 5000], registers: [registry] });
export const queueSize = new Gauge({ name: 'layout_service_worker_queue_size', help: 'Queued layout jobs', registers: [registry] });
export const workersBusy = new Gauge({ name: 'layout_service_workers_busy', help: 'Busy workers', registers: [registry] });
export const timeouts = new Counter({ name: 'layout_service_timeouts_total', help: 'Timed out layout jobs', registers: [registry] });
export const engineErrors = new Counter({ name: 'layout_service_engine_errors_total', help: 'Layout engine errors', labelNames: ['engine'] as const, registers: [registry] });
