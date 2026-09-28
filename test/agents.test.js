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
      'potential', 'pid', 'qlearn', 'minimax', 'mcts', 'mst', 'runner', 'raider', 'turtle', 'denial', 'momentum', 'strongest']) {
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

test('new tactical strategies are deterministic for the same seed', () => {
  for (const type of ['runner', 'raider', 'turtle', 'denial', 'momentum', 'strongest']) {
    const a=createAgent(type,0,4096,createRng('new:'+type));
    const b=createAgent(type,0,4096,createRng('new:'+type));
    assert.equal(a.selectAction(view)?.to,b.selectAction(view)?.to,type);
  }
});


test('strongest agent prefers a high-value resource when expected VP dominates', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-resource'));
  const plain={...options[1],to:501,owner:-1,enemy:false,terrain:1,resource:0,ownN:2,enemyN:0,nearestResourceDist:5,resourcePull:2,enemyPressure:0};
  const rich={...plain,to:502,resource:3,nearestResourceDist:0,resourcePull:12};
  assert.equal(agent.selectAction({...view,options:[plain,rich]})?.to,502);
});

test('strongest agent penalizes repeated failed attacks without using hidden state', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-failure'));
  const a={...options[0],to:601,owner:1,enemy:true,terrain:1,resource:0,ownN:2,enemyN:1,nearestResourceDist:8,resourcePull:1,enemyPressure:.25};
  const b={...a,to:602};
  for(let i=0;i<5;i++)agent.onResult({success:false,reward:-.15,move:a});
  assert.equal(agent.selectAction({...view,progress:.4,options:[a,b]})?.to,602);
});


test('strongest agent uses depth-2 continuation value when first-step values are similar', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-lookahead'));
  const base={...options[1],owner:-1,enemy:false,terrain:1,resource:0,ownN:2,enemyN:0,nearestResourceDist:8,resourcePull:1,enemyPressure:0};
  const dead={...base,to:701,continuations:[]};
  const futureRich={...base,to:702,continuations:[
    {...base,from:702,to:703,resource:3,nearestResourceDist:0,resourcePull:12,ownN:3},
    {...base,from:702,to:704,resource:1,nearestResourceDist:1,resourcePull:6,ownN:2}
  ]};
  assert.equal(agent.selectAction({...view,options:[dead,futureRich]})?.to,702);
});


test('strongest opening values high-quality frontier branches instead of an eight-second resource-only rush', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-opening-v4'));
  const compact={...options[1],to:901,owner:-1,enemy:false,terrain:1,resource:0,ownN:2,enemyN:0,distOwnCore:10,distRivalCore:40,nearestResourceDist:7,resourcePull:1.5,enemyPressure:0,continuations:[]};
  const open={...compact,to:902,ownN:0,continuations:[
    {"from":901,"to":903,"dir":[1,0],"owner":-1,"enemy":false,"terrain":1,"resource":0,"ownN":1,"enemyN":0,"distOwnCore":10,"distRivalCore":40,"nearestResourceDist":7,"resourcePull":1.5,"enemyPressure":0,"continuations":[]},
    {"from":901,"to":904,"dir":[1,0],"owner":-1,"enemy":false,"terrain":1,"resource":0,"ownN":1,"enemyN":0,"distOwnCore":10,"distRivalCore":40,"nearestResourceDist":7,"resourcePull":1.5,"enemyPressure":0,"continuations":[]},
    {"from":901,"to":905,"dir":[1,0],"owner":-1,"enemy":false,"terrain":1,"resource":0,"ownN":1,"enemyN":0,"distOwnCore":10,"distRivalCore":40,"nearestResourceDist":7,"resourcePull":1.5,"enemyPressure":0,"continuations":[]}
  ]};
  const openingView={...view,time:5,progress:.08,remaining:55,rank:2,scoreGap:2,leaderVpRate:1,vpRate:.8,leadMargin:0,options:[compact,open]};
  assert.ok(agent.staticValue(open,openingView).utility>agent.staticValue(compact,openingView).utility);
  assert.equal(agent.selectAction(openingView)?.to,902);
});

test('strongest risk posture becomes more aggressive when trailing and more conservative with a lead cushion', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-posture'));
  const trailing=agent.posture({...view,remaining:30,rank:3,scoreGap:36,leaderVpRate:1.5,vpRate:.8,leadMargin:0});
  const leading=agent.posture({...view,remaining:30,rank:1,scoreGap:0,leaderVpRate:1.5,vpRate:1.5,leadMargin:36});
  assert.ok(trailing.catchup>0);
  assert.ok(leading.cushion>0);
  assert.ok(trailing.risk>leading.risk);
});


test('strongest enters stop-loss mode after territory collapse under heavy pressure', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-collapse-v5'));
  const base={...options[1],owner:-1,enemy:false,terrain:1,resource:0,ownN:2,enemyN:0,
    nearestResourceDist:6,resourcePull:1.5,enemyPressure:.1,continuations:[]};
  agent.selectAction({...view,progress:.45,remaining:220,rank:1,scoreGap:0,leadMargin:28,
    leaderVpRate:2.6,vpRate:2.7,leaderShare:.29,share:.30,localPressure:.22,options:[base]});

  const safe={...base,to:1001,owner:-1,enemy:false,resource:0,ownN:3,enemyN:0,
    nearestResourceDist:5,resourcePull:2,enemyPressure:.05};
  const raid={...base,to:1002,owner:2,enemy:true,resource:3,ownN:1,enemyN:3,
    nearestResourceDist:0,resourcePull:12,enemyPressure:.75};
  const crisis={...view,progress:.59,remaining:164,rank:2,scoreGap:4,leadMargin:0,
    leaderVpRate:2.9,vpRate:1.75,leaderShare:.27,share:.12,localPressure:.82,options:[safe,raid]};
  const move=agent.selectAction(crisis);
  assert.equal(agent.posture(crisis).mode,'fortify');
  assert.equal(move?.to,1001);
  assert.match(agent.thought,/止损/);
});

test('strongest treats final overclock as extra exposure risk when already surrounded', () => {
  const agent=createAgent('strongest',0,4096,createRng('strongest-final-defense-v5'));
  const base={...options[1],owner:-1,enemy:false,terrain:1,resource:0,ownN:2,enemyN:0,
    nearestResourceDist:5,resourcePull:2,enemyPressure:.1,continuations:[]};
  agent.selectAction({...view,progress:.7,remaining:120,rank:1,scoreGap:0,leadMargin:18,
    leaderVpRate:2.5,vpRate:2.55,leaderShare:.25,share:.27,localPressure:.3,options:[base]});

  const compact={...base,to:1101,owner:-1,enemy:false,ownN:3,enemyN:0,enemyPressure:.05};
  const exposed={...base,to:1102,owner:1,enemy:true,resource:3,ownN:1,enemyN:3,
    nearestResourceDist:0,resourcePull:12,enemyPressure:.75};
  const finalView={...view,progress:.9,remaining:40,rank:3,scoreGap:16,leadMargin:0,
    leaderVpRate:3.0,vpRate:1.4,leaderShare:.31,share:.09,localPressure:.88,options:[compact,exposed]};
  const move=agent.selectAction(finalView);
  assert.equal(agent.posture(finalView).mode,'fortify');
  assert.equal(move?.to,1101);
  assert.ok(agent.opponentRisk(exposed,finalView)>agent.opponentRisk({...exposed,enemyPressure:.2},finalView));
});
