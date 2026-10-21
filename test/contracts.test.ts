import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { canonicalize } from '../src/canonicalize.js';
import { ElkLayoutEngine } from '../src/engines/elk.js';
import { SIMPLE_GRAPH } from './fixtures.js';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js');
const ajv = new Ajv2020({ allErrors: true });
const requestSchema = JSON.parse(readFileSync(new URL('../schemas/layout-request-v1.json', import.meta.url), 'utf8'));
const responseSchema = JSON.parse(readFileSync(new URL('../schemas/layout-response-v1.json', import.meta.url), 'utf8'));

test('published request and response schemas match the implementation', async () => {
  const validateRequest = ajv.compile(requestSchema);
  const validateResponse = ajv.compile(responseSchema);
  assert.equal(validateRequest(SIMPLE_GRAPH), true, JSON.stringify(validateRequest.errors));
  const result = await new ElkLayoutEngine().layout(canonicalize(SIMPLE_GRAPH));
  assert.equal(validateResponse(result), true, JSON.stringify(validateResponse.errors));
});
