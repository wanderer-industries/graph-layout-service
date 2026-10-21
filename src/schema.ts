import type { JSONSchemaType } from 'ajv';
import type { LayoutRequest } from './types.js';

const pointSchema = {
  type: 'object',
  properties: { x: { type: 'number' }, y: { type: 'number' } },
  required: ['x', 'y'],
  additionalProperties: false,
} as const;

export const layoutRequestSchema: JSONSchemaType<LayoutRequest> = {
  $id: 'https://wanderer.example/schemas/layout-request-v1.json',
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string' },
          width: { type: 'number', exclusiveMinimum: 0 },
          height: { type: 'number', exclusiveMinimum: 0 },
          groupId: { type: 'string', nullable: true },
          rank: { type: 'number', nullable: true },
          previousPosition: { ...pointSchema, nullable: true },
          pinned: { type: 'boolean', nullable: true },
        },
        required: ['id', 'name', 'width', 'height'],
        additionalProperties: false,
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
          source: { type: 'string', minLength: 1 },
          target: { type: 'string', minLength: 1 },
          weight: { type: 'number', nullable: true },
          minRankSpan: { type: 'number', minimum: 1, nullable: true },
        },
        required: ['id', 'source', 'target'],
        additionalProperties: false,
      },
    },
    options: {
      type: 'object',
      properties: {
        engine: { type: 'string', enum: ['elk', 'dagre'], nullable: true },
        direction: { type: 'string', enum: ['TB', 'BT', 'LR', 'RL'] },
        routing: { type: 'string', enum: ['straight', 'polyline', 'orthogonal', 'spline'] },
        includeEdgeRoutes: { type: 'boolean', nullable: true },
        spacing: {
          type: 'object',
          properties: {
            nodeSpacing: { type: 'number', minimum: 0 },
            layerSpacing: { type: 'number', minimum: 0 },
            edgeSpacing: { type: 'number', minimum: 0 },
          },
          required: ['nodeSpacing', 'layerSpacing', 'edgeSpacing'],
          additionalProperties: false,
        },
        ordering: {
          type: 'object',
          properties: {
            by: { type: 'string', enum: ['name', 'id', 'previous-order'] },
            direction: { type: 'string', enum: ['asc', 'desc'] },
            locale: { type: 'string', minLength: 1 },
            policy: { type: 'string', enum: ['strict', 'prefer', 'crossings-first'] },
          },
          required: ['by', 'direction', 'locale', 'policy'],
          additionalProperties: false,
        },
        groups: { type: 'string', enum: ['none', 'compound'] },
        stability: {
          type: 'object',
          nullable: true,
          properties: { preservePreviousPositions: { type: 'boolean', nullable: true } },
          required: [],
          additionalProperties: false,
        },
      },
      required: ['direction', 'routing', 'spacing', 'ordering', 'groups'],
      additionalProperties: false,
    },
  },
  required: ['nodes', 'edges', 'options'],
  additionalProperties: false,
};
