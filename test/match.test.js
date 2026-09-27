import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../match.js';

const config = {
  seed: '20260927',
  rotation: 2,
  duration: 60,
  strategies: ['aco', 'mcts', 'qlearn', 'voronoi']
};

function outcome(match) {
  return {
    owner: Array.from(match.owner),
    terrain: Array.from(match.terrain),
    resources: Array.from(match.resources),
    teams: match.teams.map(a => ({
      score: a.score, territory: a.territory, resources: a.resources,
      captures: a.captures, lastMove: a.lastMove?.to
    }))
  };
}

test('same seed, agents, rotation and steps replay exactly, without global randomness', () => {
  const oldRandom = Math.random;
  Math.random = () => { throw new Error('global random used during a match'); };
  try {
    const a = new Match(config), b = new Match(config);
    for (let tick = 0; tick < 400; tick++) { a.step(.035); b.step(.035); }
    assert.deepEqual(outcome(a), outcome(b));
    assert.ok(a.teams.some(team => team.score > 0));
  } finally {
    Math.random = oldRandom;
  }
});

test('rotating spawn slots keeps the generated terrain and resources fixed', () => {
  const a = new Match({...config, rotation: 0});
  const b = new Match({...config, rotation: 1});
  assert.deepEqual(Array.from(a.terrain), Array.from(b.terrain));
  assert.deepEqual(Array.from(a.resources), Array.from(b.resources));
  assert.equal(a.owner[5 + 5 * 64], 0);
  assert.equal(b.owner[5 + 5 * 64], 3);
});

test('a full match accumulates only VP from control and ends at the selected duration', () => {
  const match = new Match({...config, duration: 1});
  for (let i = 0; i < 40; i++) match.step(.035);
  assert.equal(match.time, 1);
  assert.equal(match.finished, true);
  const oldScores = match.teams.map(a => a.score);
  match.step(.035);
  assert.deepEqual(match.teams.map(a => a.score), oldScores);
});
