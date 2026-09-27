import test from 'node:test';
import assert from 'node:assert/strict';
import {createRng, deriveSeed, spawnFor, vpRate, resolveActions} from '../rules.js';

function world() {
  const owner = new Int8Array(15).fill(-1);
  owner[6] = 0;
  owner[8] = 1;
  return {
    width: 5, height: 3, owner,
    terrain: new Uint8Array(15).fill(1),
    resources: new Uint8Array(15),
    core: new Int8Array(15).fill(-1)
  };
}

test('the same seed has the same random stream and independent derived streams', () => {
  const a = createRng('20260927'), b = createRng('20260927');
  assert.deepEqual(Array.from({length: 8}, () => a.next()), Array.from({length: 8}, () => b.next()));
  assert.notEqual(deriveSeed('20260927', 'world'), deriveSeed('20260927', 'agent:0'));
});

test('rotation moves each color around all four spawn slots', () => {
  assert.deepEqual([0, 1, 2, 3].map(r => spawnFor(0, r)), [[5,5], [58,5], [5,58], [58,58]]);
  assert.deepEqual([0, 1, 2, 3].map(id => spawnFor(id, 1)), [[58,5], [5,58], [58,58], [5,5]]);
});

test('VP is earned from held area and resource shares without one-time bonuses', () => {
  assert.equal(vpRate(1024, 4096, 3, 12), 2.5);
  assert.equal(vpRate(1024, 4096, 0, 0), 1.625);
});

test('simultaneous proposals to one resource resolve only one winner independent of submission order', () => {
  const proposals = [
    {id: 0, move: {from: 6, to: 7}},
    {id: 1, move: {from: 8, to: 7}}
  ];
  for (const order of [proposals, [...proposals].reverse()]) {
    const map = world(); map.resources[7] = 3;
    const results = resolveActions(map, order, () => 0, false);
    assert.equal(map.owner[7], 0);
    assert.deepEqual(results.map(r => [r.id, r.success, r.previousOwner]), [[0, true, -1], [1, false, -1]]);
  }
});

test('both agents can exchange enemy cells because all claims use the same pre-turn snapshot', () => {
  const map = world();
  map.owner[7] = 1;
  const results = resolveActions(map, [
    {id: 0, move: {from: 6, to: 7}},
    {id: 1, move: {from: 7, to: 6}}
  ], () => 0, false);
  assert.equal(map.owner[7], 0);
  assert.equal(map.owner[6], 1);
  assert.deepEqual(results.map(r => [r.success, r.previousOwner]), [[true, 1], [true, 0]]);
});

test('a protected core is never captured even when an agent submits it', () => {
  const map = world(); map.core[7] = 1; map.owner[7] = 1;
  const [result] = resolveActions(map, [{id: 0, move: {from: 6, to: 7}}], () => 0, false);
  assert.equal(result.success, false);
  assert.equal(map.owner[7], 1);
});
