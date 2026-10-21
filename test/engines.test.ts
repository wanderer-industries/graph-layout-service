import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalize } from '../src/canonicalize.js';
import { DagreLayoutEngine } from '../src/engines/dagre.js';
import { ElkLayoutEngine } from '../src/engines/elk.js';
import type { LayoutEngine, LayoutResult } from '../src/types.js';
import { SIMPLE_GRAPH } from './fixtures.js';

for (const engine of [new ElkLayoutEngine(), new DagreLayoutEngine()]) {
  test(`${engine.name} returns deterministic valid coordinates`, async () => {
    const request = canonicalize({ ...structuredClone(SIMPLE_GRAPH), options: { ...structuredClone(SIMPLE_GRAPH.options), engine: engine.name } });
    const first = await engine.layout(request);
    const second = await engine.layout(request);
    assert.deepEqual(stablePart(first), stablePart(second));
    assertLayoutInvariants(first, engine);
  });
}

test('ELK direction translation places targets on the requested axis', async () => {
  const engine = new ElkLayoutEngine();
  for (const direction of ['TB', 'BT', 'LR', 'RL'] as const) {
    const request = structuredClone(SIMPLE_GRAPH);
    request.options.direction = direction;
    const result = await engine.layout(canonicalize(request));
    const a = result.nodes.find(node => node.id === 'a')!;
    const c = result.nodes.find(node => node.id === 'c')!;
    if (direction === 'TB') assert.ok(a.y < c.y);
    if (direction === 'BT') assert.ok(a.y > c.y);
    if (direction === 'LR') assert.ok(a.x < c.x);
    if (direction === 'RL') assert.ok(a.x > c.x);
  }
});

test('ELK centers a TB parent over its child span', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.options.direction = 'TB';
  request.nodes = [
    { id: 'root', name: 'Root', width: 130, height: 34, rank: 0 },
    { id: 'left', name: 'Left', width: 130, height: 34, rank: 1 },
    { id: 'right', name: 'Right', width: 130, height: 34, rank: 1 },
  ];
  request.edges = [
    { id: 'root-left', source: 'root', target: 'left' },
    { id: 'root-right', source: 'root', target: 'right' },
  ];

  const result = await new ElkLayoutEngine().layout(canonicalize(request));
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  const rootCenter = nodeCenterX(byId.get('root')!);
  const childCenters = [nodeCenterX(byId.get('left')!), nodeCenterX(byId.get('right')!)];
  const childSpanCenter = (Math.min(...childCenters) + Math.max(...childCenters)) / 2;

  assert.equal(rootCenter, childSpanCenter);
});

test('ELK golden fixture keeps normalized coordinates stable', async () => {
  const result = await new ElkLayoutEngine().layout(canonicalize(SIMPLE_GRAPH));
  assert.deepEqual(result.nodes, [
    { id: 'a', x: 0, y: 0, width: 100, height: 50 },
    { id: 'b', x: 0, y: 130, width: 100, height: 50 },
    { id: 'c', x: 0, y: 260, width: 100, height: 50 },
  ]);
});

test('ELK packs disconnected nodes compactly instead of preserving absolute gaps', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.edges = [];
  request.nodes = [
    { id: 'a', name: 'Alpha', width: 130, height: 34, previousPosition: { x: 0, y: 0 } },
    { id: 'b', name: 'Beta', width: 130, height: 34, previousPosition: { x: 8_000, y: 4_000 } },
    { id: 'c', name: 'Gamma', width: 130, height: 34, previousPosition: { x: -6_000, y: 9_000 } },
    { id: 'd', name: 'Delta', width: 130, height: 34, previousPosition: { x: 12_000, y: -5_000 } },
  ];

  const result = await new ElkLayoutEngine().layout(canonicalize(request));

  assert.ok(result.bounds.width <= 700, `unexpected width: ${result.bounds.width}`);
  assert.ok(result.bounds.height <= 500, `unexpected height: ${result.bounds.height}`);
  assert.equal(new Set(result.nodes.map(node => node.y)).size, 1);
});

test('ELK keeps linked nodes together while packing independent components', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.nodes.push(
    { id: 'd', name: 'Delta', width: 100, height: 50, previousPosition: { x: 10_000, y: 10_000 } },
    { id: 'e', name: 'Epsilon', width: 100, height: 50, previousPosition: { x: -10_000, y: -10_000 } },
  );
  const result = await new ElkLayoutEngine().layout(canonicalize(request));
  const linked = ['a', 'b', 'c'].map(id => result.nodes.find(node => node.id === id)!);

  assert.ok(linked[0]!.y < linked[1]!.y && linked[1]!.y < linked[2]!.y);
  assert.ok(result.bounds.width <= 400, `unexpected width: ${result.bounds.width}`);
  assert.ok(result.bounds.height <= 400, `unexpected height: ${result.bounds.height}`);
});

test('ELK places isolated nodes on a separate axis after linked components', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.nodes = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    name: String(index),
    width: 100,
    height: 50,
  }));
  request.edges = Array.from({ length: 9 }, (_, index) => ({
    id: `${index}-${index + 1}`,
    source: String(index),
    target: String(index + 1),
  }));

  const result = await new ElkLayoutEngine().layout(canonicalize(request));
  const linked = result.nodes.filter(node => Number(node.id) < 10);
  const isolated = result.nodes.filter(node => Number(node.id) >= 10);
  const linkedBottom = Math.max(...linked.map(node => node.y + node.height));

  assert.equal(new Set(isolated.map(node => node.y)).size, 1);
  assert.ok(isolated.every(node => node.y > linkedBottom));
  assert.ok(result.bounds.width <= 1_400, `unexpected width: ${result.bounds.width}`);
  assert.ok(result.bounds.height <= 1_350, `unexpected height: ${result.bounds.height}`);
});

test('ELK always places linked components above isolated nodes', async () => {
  for (const direction of ['TB', 'BT', 'LR', 'RL'] as const) {
    const request = structuredClone(SIMPLE_GRAPH);
    request.options.direction = direction;
    request.nodes.push(
      { id: 'isolated-a', name: 'Isolated A', width: 100, height: 50 },
      { id: 'isolated-b', name: 'Isolated B', width: 100, height: 50 },
    );

    const result = await new ElkLayoutEngine().layout(canonicalize(request));
    const linked = result.nodes.filter(node => ['a', 'b', 'c'].includes(node.id));
    const isolated = result.nodes.filter(node => node.id.startsWith('isolated-'));
    const linkedBottom = Math.max(...linked.map(node => node.y + node.height));

    assert.ok(isolated.every(node => node.y > linkedBottom), `${direction} placed isolated nodes before linked nodes`);
  }
});

test('ELK keeps a ranked root-only tree in the connected layout area', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.nodes = [
    { id: 'root-a', name: 'Root A', width: 100, height: 50, rank: 0 },
    { id: 'child-a', name: 'Child A', width: 100, height: 50, rank: 1 },
    { id: 'root-b', name: 'Root B', width: 100, height: 50, rank: 0 },
    { id: 'isolated', name: 'Isolated', width: 100, height: 50 },
  ];
  request.edges = [{ id: 'tree-a', source: 'root-a', target: 'child-a' }];

  const result = await new ElkLayoutEngine().layout(canonicalize(request));
  const rootB = result.nodes.find(node => node.id === 'root-b')!;
  const isolated = result.nodes.find(node => node.id === 'isolated')!;
  const treeBottom = Math.max(
    ...result.nodes.filter(node => node.id !== 'isolated').map(node => node.y + node.height),
  );

  assert.ok(rootB.y < isolated.y);
  assert.ok(isolated.y > treeBottom);
});

test('ELK places LR root trees in parallel horizontal lanes', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.options.direction = 'LR';
  request.options.spacing.nodeSpacing = 40;
  request.options.spacing.layerSpacing = 60;
  request.nodes = [
    { id: 'root-a', name: 'Root A', width: 100, height: 50, rank: 0 },
    { id: 'child-a', name: 'Child A', width: 100, height: 50, rank: 1 },
    { id: 'root-b', name: 'Root B', width: 100, height: 50, rank: 0 },
    { id: 'child-b', name: 'Child B', width: 100, height: 50, rank: 1 },
  ];
  request.edges = [
    { id: 'tree-a', source: 'root-a', target: 'child-a' },
    { id: 'tree-b', source: 'root-b', target: 'child-b' },
  ];

  const result = await new ElkLayoutEngine().layout(canonicalize(request));
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  const firstRoot = byId.get('root-a')!;
  const firstChild = byId.get('child-a')!;
  const secondRoot = byId.get('root-b')!;
  const firstTreeBottom = Math.max(firstRoot.y + firstRoot.height, firstChild.y + firstChild.height);

  assert.equal(firstRoot.x, secondRoot.x);
  assert.ok(secondRoot.y >= firstTreeBottom + 80);
});

test('ELK honors explicit tree ranks in every direction', async () => {
  const request = structuredClone(SIMPLE_GRAPH);
  request.nodes = [
    { id: 'root-a', name: 'Root A', width: 100, height: 50, rank: 0 },
    { id: 'root-b', name: 'Root B', width: 100, height: 50, rank: 0 },
    { id: 'child-a', name: 'Child A', width: 100, height: 50, rank: 1 },
    { id: 'child-b', name: 'Child B', width: 100, height: 50, rank: 2 },
  ];
  request.edges = [
    { id: 'a', source: 'root-a', target: 'child-a' },
    { id: 'b', source: 'root-b', target: 'child-a' },
    { id: 'c', source: 'child-a', target: 'child-b' },
  ];

  for (const direction of ['TB', 'BT', 'LR', 'RL'] as const) {
    request.options.direction = direction;
    const result = await new ElkLayoutEngine().layout(canonicalize(request));
    const byId = new Map(result.nodes.map(node => [node.id, node]));
    const rootA = byId.get('root-a')!;
    const rootB = byId.get('root-b')!;
    const childA = byId.get('child-a')!;
    const childB = byId.get('child-b')!;

    if (direction === 'TB' || direction === 'BT') assert.equal(rootA.y, rootB.y);
    if (direction === 'LR' || direction === 'RL') assert.equal(rootA.x, rootB.x);
    if (direction === 'TB') assert.ok(rootA.y < childA.y && childA.y < childB.y);
    if (direction === 'BT') assert.ok(rootA.y > childA.y && childA.y > childB.y);
    if (direction === 'LR') assert.ok(rootA.x < childA.x && childA.x < childB.x);
    if (direction === 'RL') assert.ok(rootA.x > childA.x && childA.x > childB.x);
  }
});

function stablePart(result: LayoutResult) {
  return { nodes: result.nodes, edges: result.edges, bounds: result.bounds, engine: result.engine, warnings: result.warnings };
}

function nodeCenterX(node: LayoutResult['nodes'][number]): number {
  return node.x + node.width / 2;
}

function assertLayoutInvariants(result: LayoutResult, engine: LayoutEngine): void {
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(SIMPLE_GRAPH.nodes.map(node => node.id)));
  assert.equal(result.nodes.length, new Set(result.nodes.map(node => node.id)).size);
  for (const node of result.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
    const input = SIMPLE_GRAPH.nodes.find(candidate => candidate.id === node.id)!;
    assert.equal(node.width, input.width);
    assert.equal(node.height, input.height);
    assert.ok(node.x >= result.bounds.x && node.y >= result.bounds.y);
    assert.ok(node.x + node.width <= result.bounds.width);
    assert.ok(node.y + node.height <= result.bounds.height);
  }
  for (const [index, left] of result.nodes.entries()) {
    for (const right of result.nodes.slice(index + 1)) {
      const separated = left.x + left.width <= right.x || right.x + right.width <= left.x || left.y + left.height <= right.y || right.y + right.height <= left.y;
      assert.ok(separated, `${engine.name}: nodes ${left.id} and ${right.id} overlap`);
    }
  }
  assert.deepEqual(new Set(result.edges?.map(edge => edge.id)), new Set(SIMPLE_GRAPH.edges.map(edge => edge.id)), engine.name);
}
