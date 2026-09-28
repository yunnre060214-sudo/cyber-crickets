import test from 'node:test';
import assert from 'node:assert/strict';
import {Tournament, runDuel} from '../tournament.js';

const entrants = ['aco', 'minimax', 'qlearn', 'voronoi', 'bfs', 'dfs', 'greedy', 'random'];

test('competition duration accepts 180 seconds and custom values within 10–1800 seconds', () => {
  assert.doesNotThrow(() => new Tournament({id:'d180',name:'180',format:'knockout',seed:'d180',duration:180,entrants}));
  assert.doesNotThrow(() => new Tournament({id:'d240',name:'240',format:'knockout',seed:'d240',duration:240,entrants}));
  assert.throws(() => new Tournament({id:'d9',name:'9',format:'knockout',seed:'d9',duration:9,entrants}), /比赛时长无效/);
  assert.throws(() => new Tournament({id:'d1801',name:'1801',format:'knockout',seed:'d1801',duration:1801,entrants}), /比赛时长无效/);
});

const config = format => ({id: 'league-1', name: '算法联赛', format,
  seed: '20260927', duration: 1, entrants});
const pairKey = fixture => [...fixture.entrants].sort().join(':');

test('single and double round robin give every pair one and two fixtures respectively', () => {
  for (const [format, rounds, meetings] of [['round_robin', 7, 1], ['double_round_robin', 14, 2]]) {
    const tournament = new Tournament(config(format));
    assert.equal(tournament.rounds.length, rounds);
    const fixtures = tournament.rounds.flatMap(round => round.fixtures);
    const counts = new Map();
    for (const fixture of fixtures) counts.set(pairKey(fixture), (counts.get(pairKey(fixture)) || 0) + 1);
    assert.equal(counts.size, 28);
    assert.ok([...counts.values()].every(count => count === meetings));
    assert.ok(tournament.rounds.every(round => round.fixtures.length === 4));
  }
});

test('a fixture uses two legs on the same map with exchanged entrant seats', () => {
  const result = runDuel({entrants: ['p0', 'p1'], seed: 'duel-seed', stage: 'league'}, config('round_robin'));
  assert.deepEqual(result.legs.map(leg => leg.seats), [['p0', 'p1'], ['p1', 'p0']]);
  assert.equal(result.legs.length, 2);
  assert.ok(result.legs.every(leg => leg.vp.every(Number.isFinite)));
  assert.equal(result.aggregates.p0.vp, result.legs[0].vp[0] + result.legs[1].vp[1]);
});

test('knockout progresses from four quarterfinals to two semifinals to final and bronze', () => {
  const tournament = new Tournament(config('knockout'));
  assert.deepEqual(tournament.rounds.map(round => round.fixtures.length), [4]);
  tournament.advance();
  assert.deepEqual(tournament.rounds.map(round => round.fixtures.length), [4, 2]);
  tournament.advance();
  assert.deepEqual(tournament.rounds.map(round => round.fixtures.length), [4, 2, 2]);
  tournament.advance();
  assert.equal(tournament.complete, true);
  assert.ok(tournament.champion());
  assert.equal(new Set(tournament.rounds[2].fixtures.flatMap(f => f.entrants)).size, 4);
});

test('group stage stops after three rounds without inventing an overall champion', () => {
  const tournament = new Tournament(config('groups'));
  assert.equal(tournament.rounds.length, 3);
  while (!tournament.complete) tournament.advance();
  assert.equal(tournament.champion(), null);
  assert.equal(tournament.standings('A').length, 4);
  assert.equal(tournament.standings('B').length, 4);
  assert.ok(tournament.standings('A').every(row => row.played === 3));
});

test('hybrid advances two from each group into crossed semifinals', () => {
  const tournament = new Tournament(config('group_knockout'));
  for (let i = 0; i < 3; i++) tournament.advance();
  const [a1, a2] = tournament.standings('A').slice(0, 2).map(row => row.id);
  const [b1, b2] = tournament.standings('B').slice(0, 2).map(row => row.id);
  assert.deepEqual(tournament.rounds[3].fixtures.map(f => f.entrants), [[a1, b2], [b1, a2]]);
  tournament.advance(); tournament.advance();
  assert.equal(tournament.complete, true);
  assert.ok(tournament.champion());
});

test('Swiss pairing avoids repeat opponents through three rounds', () => {
  const tournament = new Tournament(config('swiss'));
  while (!tournament.complete) tournament.advance();
  const fixtures = tournament.rounds.flatMap(round => round.fixtures);
  assert.equal(tournament.rounds.length, 3);
  assert.equal(new Set(fixtures.map(pairKey)).size, 12);
  assert.ok(tournament.standings().every(row => row.played === 3));
});

test('a saved competition resumes at the next round without counting old fixtures twice', () => {
  const first = new Tournament(config('round_robin'));
  first.advance();
  const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(first.toJSON())));
  assert.equal(restored.standings()[0].played, 1);
  restored.advance();
  assert.ok(restored.standings().every(row => row.played === 2));
  const replay = new Tournament(config('round_robin'));
  replay.advance(); replay.advance();
  assert.deepEqual(restored.toJSON(), replay.toJSON());
});

test('a tournament rejects duplicate entrants and unsupported formats', () => {
  assert.throws(() => new Tournament({...config('swiss'), entrants: Array(8).fill('aco')}));
  assert.throws(() => new Tournament(config('unknown')));
});

test('a corrupted saved round cannot masquerade as a completed tournament', () => {
  const data = new Tournament(config('knockout')).toJSON();
  data.rounds[0].completed = true;
  assert.throws(() => Tournament.fromJSON(data), /无效/);
  data.rounds[0].completed = false;
  data.rounds[0].fixtures[0].entrants[0] = 'p99';
  assert.throws(() => Tournament.fromJSON(data), /无效/);
});

test('knockout report ranks finalists ahead of the bronze winner regardless of points', () => {
  const tournament = new Tournament({...config('knockout'), seed: 'a'});
  while (!tournament.complete) tournament.advance();
  const [final, bronze] = tournament.rounds.at(-1).fixtures;
  const expected = [
    final.result.winner,
    final.entrants.find(id => id !== final.result.winner),
    bronze.result.winner,
    bronze.entrants.find(id => id !== bronze.result.winner)
  ];
  assert.deepEqual(tournament.standings().slice(0, 4).map(row => row.id), expected);
});
