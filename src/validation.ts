import { createRequire } from 'node:module';
import { type Ajv as AjvClass, type ErrorObject } from 'ajv';
import { layoutRequestSchema } from './schema.js';
import type { LayoutRequest } from './types.js';

export interface ValidationError {
  code: string;
  path: string;
  message: string;
}

const require = createRequire(import.meta.url);
const Ajv = require('ajv') as typeof AjvClass;
const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(layoutRequestSchema);

function schemaError(error: ErrorObject): ValidationError {
  return {
    code: `VALIDATION_${error.keyword.toUpperCase()}`,
    path: error.instancePath || '/',
    message: error.message ?? 'Invalid value',
  };
}

export function validateRequest(value: unknown, maxNodes: number, maxEdges: number): ValidationError[] {
  if (!validateSchema(value)) return (validateSchema.errors ?? []).map(schemaError);
  const request = value as LayoutRequest;
  const errors: ValidationError[] = [];
  if (request.nodes.length > maxNodes) errors.push({ code: 'LIMIT_NODES_EXCEEDED', path: '/nodes', message: `At most ${maxNodes} nodes are allowed` });
  if (request.edges.length > maxEdges) errors.push({ code: 'LIMIT_EDGES_EXCEEDED', path: '/edges', message: `At most ${maxEdges} edges are allowed` });
  const nodeIds = new Set<string>();
  for (const [index, node] of request.nodes.entries()) {
    if (nodeIds.has(node.id)) errors.push({ code: 'DUPLICATE_NODE_ID', path: `/nodes/${index}/id`, message: `Duplicate node id: ${node.id}` });
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const [index, edge] of request.edges.entries()) {
    if (edgeIds.has(edge.id)) errors.push({ code: 'DUPLICATE_EDGE_ID', path: `/edges/${index}/id`, message: `Duplicate edge id: ${edge.id}` });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) errors.push({ code: 'EDGE_SOURCE_NOT_FOUND', path: `/edges/${index}/source`, message: `Unknown source node: ${edge.source}` });
    if (!nodeIds.has(edge.target)) errors.push({ code: 'EDGE_TARGET_NOT_FOUND', path: `/edges/${index}/target`, message: `Unknown target node: ${edge.target}` });
  }
  return errors;
}
