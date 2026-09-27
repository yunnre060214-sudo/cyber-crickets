import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent} from '../agents.js';
import {createRng} from '../rules.js';

const options = Array.from({length: 40}, (_, n) => ({
  from: 80, to: n + 100, dir: [1, 0], owner: -1, enemy: false,
  ownN: 1 + n % 3, enemyN: n % 2, terrain: 1 + n % 3,
  resource: n % 7 === 0 ? 3 : 0, distOwnCore: n,
  distRivalCore: 40 - n, nearestResourceDist: n % 9,
  resourcePull: n % 8, enemyPressure: n % 3 / 4
}));
const view = {id: 0, time: 1, progress: 0.2, share: 0.1, localPressure: 0, options, width: 64, height: 64};

test('every strategy makes its random choices only through its injected seed stream', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('global random used'); };
  try {
    for (const type of ['bfs', 'dfs', 'greedy', 'random', 'aco', 'voronoi',
      'potential', 'pid', 'qlearn', 'minimax', 'mcts', 'mst']) {
      const agent = createAgent(type, 0, 4096, createRng('agent:' + type));
      assert.ok(agent.selectAction(view), type);
    }
  } finally {
    Math.random = original;
  }
});

test('Monte Carlo sampling is independent of elapsed wall-clock time', () => {
  const original = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', {configurable: true, value: {
    now() { throw new Error('wall clock used in decision'); }
  }});
  try {
    const a = createAgent('mcts', 0, 4096, createRng('same'));
    const b = createAgent('mcts', 0, 4096, createRng('same'));
    assert.equal(a.selectAction(view)?.to, b.selectAction(view)?.to);
  } finally {
    Object.defineProperty(globalThis, 'performance', {configurable: true, value: original});
  }
});

test('Q learning updates from reward and next state value', () => {
  const agent = createAgent('qlearn', 0, 4096, createRng('q'));
  agent.eps = 0;
  agent.q.SLN = {expand: 2, attack: 0, resource: 0, fortify: 0};
  agent.selectAction({...view, options: options.map(o => ({...o, resource: 0}))});
  agent.onResult({reward: 3, success: true, move: options[0]});
  agent.q.LHR = {expand: 5, attack: 1, resource: 0, fortify: 0};
  agent.selectAction({...view, share: .3, localPressure: .6, options});
  assert.ok(Math.abs(agent.q.SLN.expand - 2.972) < 1e-10);
});
