import {AGENT_META} from './agents.js?v=20260928-custom-controls-v1';
import {Match} from './match.js?v=20260928-custom-controls-v1';
import {createRng, deriveSeed} from './rules.js?v=20260928-custom-controls-v1';

export const FORMAT_NAMES = {
  round_robin: '单循环',
  double_round_robin: '双循环',
  knockout: '淘汰赛',
  groups: '小组赛',
  swiss: '瑞士轮',
  group_knockout: '小组＋淘汰'
};

function pairsForCircle(ids) {
  const rounds = [], circle = [...ids];
  for (let round = 0; round < ids.length - 1; round++) {
    const pairs = [];
    for (let i = 0; i < ids.length / 2; i++)
      pairs.push([circle[i], circle[ids.length - 1 - i]]);
    rounds.push(pairs);
    circle.splice(1, 0, circle.pop());
  }
  return rounds;
}

function swissPairs(ranked, previous) {
  let best = null, bestCost = Infinity;
  function search(remaining, pairs, cost) {
    if (cost >= bestCost) return;
    if (!remaining.length) {
      best = pairs; bestCost = cost; return;
    }
    const first = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      const other = remaining[i];
      const key = [first.id, other.id].sort().join(':');
      const penalty = previous.has(key) ? 10000 : 0;
      const gap = Math.abs(first.points - other.points) * 100 +
        Math.abs(first.seedRank - other.seedRank);
      search(remaining.slice(1, i).concat(remaining.slice(i + 1)),
        [...pairs, [first.id, other.id]], cost + penalty + gap);
    }
  }
  search(ranked, [], 0);
  return best;
}

function validate(config) {
  if (!Object.hasOwn(FORMAT_NAMES, config.format)) throw new Error('不支持的赛制');
  if (!Array.isArray(config.entrants) || config.entrants.length !== 8 ||
      new Set(config.entrants).size !== 8 ||
      config.entrants.some(key => !Object.hasOwn(AGENT_META, key)))
    throw new Error('请选择八种不同的 Agent');
  if (!(config.duration === 1 || (Number.isInteger(config.duration) && config.duration >= 10 && config.duration <= 1800))) throw new Error('比赛时长无效：请输入 10～1800 秒的整数');
  if (typeof config.seed !== 'string' || !config.seed.trim() || config.seed.length > 64)
    throw new Error('赛事种子无效');
}

export function runDuel(fixture, config) {
  const legs = [], aggregates = Object.fromEntries(fixture.entrants.map(id =>
    [id, {vp: 0, captures: 0, territory: 0}]));
  const orders = [fixture.entrants, [...fixture.entrants].reverse()];
  for (const seats of orders) {
    const match = new Match({
      seed: fixture.seed, duration: config.duration,
      strategies: seats.map(id => config.entrants[Number(id.slice(1))]),
      agentKeys: seats
    });
    while (!match.finished) match.step(.035);
    const leg = {seats: [...seats], vp: [], captures: [], territory: []};
    match.teams.forEach((team, index) => {
      leg.vp.push(team.score);
      leg.captures.push(team.captures);
      leg.territory.push(team.territory);
      aggregates[seats[index]].vp += team.score;
      aggregates[seats[index]].captures += team.captures;
      aggregates[seats[index]].territory += team.territory;
    });
    legs.push(leg);
  }
  const [a, b] = fixture.entrants, x = aggregates[a], y = aggregates[b];
  let winner = x.vp > y.vp + 1e-9 ? a : y.vp > x.vp + 1e-9 ? b : null;
  const decisive = ['quarterfinal', 'semifinal', 'final', 'bronze'].includes(fixture.stage);
  if (winner === null && decisive) {
    winner = x.captures > y.captures ? a : y.captures > x.captures ? b :
      x.territory > y.territory ? a : y.territory > x.territory ? b :
      createRng(deriveSeed(fixture.seed, 'tiebreak')).next() < .5 ? a : b;
  }
  return {winner, aggregates, legs};
}

export class Tournament {
  constructor(config) {
    validate(config);
    this.config = {id: String(config.id || config.seed), name: String(config.name || '未命名比赛').slice(0, 80),
      format: config.format, seed: config.seed, duration: config.duration,
      entrants: [...config.entrants]};
    this.entrants = this.config.entrants.map((strategy, seedRank) =>
      ({id: 'p' + seedRank, strategy, seedRank}));
    this.rounds = [];
    this.groups = {
      A: ['p0', 'p3', 'p4', 'p7'],
      B: ['p1', 'p2', 'p5', 'p6']
    };
    this.initialize();
  }

  addRound(label, phase, pairs, groups = []) {
    const roundIndex = this.rounds.length;
    this.rounds.push({label, phase, completed: false, fixtures: pairs.map((entrants, index) => ({
      id: 'r' + roundIndex + 'f' + index, stage: phase,
      group: groups[index] || null, entrants: [...entrants],
      seed: this.config.seed + '|round:' + roundIndex + '|fixture:' + index,
      result: null
    }))});
  }

  initialize() {
    const ids = this.entrants.map(entry => entry.id);
    if (this.config.format === 'round_robin' || this.config.format === 'double_round_robin') {
      const rounds = pairsForCircle(ids);
      const cycles = this.config.format === 'double_round_robin' ? 2 : 1;
      for (let cycle = 0; cycle < cycles; cycle++)
        rounds.forEach((pairs, index) => this.addRound(
          '第 ' + (cycle * 7 + index + 1) + ' 轮', 'league',
          cycle ? pairs.map(pair => [...pair].reverse()) : pairs));
    } else if (this.config.format === 'groups' || this.config.format === 'group_knockout') {
      const a = pairsForCircle(this.groups.A), b = pairsForCircle(this.groups.B);
      for (let i = 0; i < 3; i++)
        this.addRound('小组赛第 ' + (i + 1) + ' 轮', 'group',
          [...a[i], ...b[i]], ['A', 'A', 'B', 'B']);
    } else if (this.config.format === 'knockout') {
      this.addRound('八强赛', 'quarterfinal',
        [[ids[0], ids[7]], [ids[3], ids[4]], [ids[1], ids[6]], [ids[2], ids[5]]]);
    } else {
      this.addRound('瑞士轮第 1 轮', 'swiss',
        Array.from({length: 4}, (_, i) => [ids[i], ids[i + 4]]));
    }
  }

  get complete() {
    return this.rounds.every(round => round.completed);
  }

  get nextRound() {
    return this.rounds.find(round => !round.completed) || null;
  }

  advance() {
    const round = this.nextRound;
    if (!round) throw new Error('赛事已经结束');
    for (const fixture of round.fixtures)
      fixture.result = runDuel(fixture, this.config);
    round.completed = true;
    this.scheduleFollowingRound(round);
    return round;
  }

  scheduleFollowingRound(round) {
    if (this.config.format === 'knockout') {
      if (round.phase === 'quarterfinal') {
        const winners = round.fixtures.map(f => f.result.winner);
        this.addRound('半决赛', 'semifinal',
          [[winners[0], winners[1]], [winners[2], winners[3]]]);
      } else if (round.phase === 'semifinal') this.addFinals(round);
    } else if (this.config.format === 'group_knockout') {
      if (round.phase === 'group' && this.rounds.filter(r => r.phase === 'group' && r.completed).length === 3) {
        const a = this.standings('A'), b = this.standings('B');
        this.addRound('半决赛', 'semifinal',
          [[a[0].id, b[1].id], [b[0].id, a[1].id]]);
      } else if (round.phase === 'semifinal') this.addFinals(round);
    } else if (this.config.format === 'swiss' && this.rounds.length < 3) {
      const played = new Set(this.rounds.flatMap(r => r.fixtures.map(f =>
        [...f.entrants].sort().join(':'))));
      this.addRound('瑞士轮第 ' + (this.rounds.length + 1) + ' 轮', 'swiss',
        swissPairs(this.standings(), played));
    }
  }

  addFinals(semifinal) {
    const [one, two] = semifinal.fixtures;
    const loser = fixture => fixture.entrants.find(id => id !== fixture.result.winner);
    this.addRound('决赛与季军赛', 'final',
      [[one.result.winner, two.result.winner], [loser(one), loser(two)]]);
    this.rounds.at(-1).fixtures[1].stage = 'bronze';
  }

  standings(group = null) {
    const allowed = group ? this.groups[group] : this.entrants.map(entry => entry.id);
    if (!allowed) throw new Error('小组不存在');
    const table = new Map(allowed.map(id => [id, {
      id, strategy: this.entrants[Number(id.slice(1))].strategy,
      seedRank: Number(id.slice(1)), played: 0, wins: 0, draws: 0,
      points: 0, vpFor: 0, vpAgainst: 0
    }]));
    for (const round of this.rounds) for (const fixture of round.fixtures) {
      if (!fixture.result || (group && fixture.group !== group)) continue;
      const [a, b] = fixture.entrants;
      if (!table.has(a) || !table.has(b)) continue;
      for (const [id, rival] of [[a, b], [b, a]]) {
        const row = table.get(id);
        row.played++;
        row.vpFor += fixture.result.aggregates[id].vp;
        row.vpAgainst += fixture.result.aggregates[rival].vp;
        if (fixture.result.winner === id) {row.wins++; row.points += 3;}
        else if (fixture.result.winner === null) {row.draws++; row.points++;}
      }
    }
    const finalRound = this.rounds.at(-1);
    let podium = [];
    if (!group && this.complete && finalRound?.phase === 'final' &&
        ['knockout', 'group_knockout'].includes(this.config.format)) {
      const [final, bronze] = finalRound.fixtures;
      podium = [final.result.winner,
        final.entrants.find(id => id !== final.result.winner),
        bronze.result.winner,
        bronze.entrants.find(id => id !== bronze.result.winner)];
    }
    return [...table.values()].sort((a, b) => {
      const positionA = podium.indexOf(a.id), positionB = podium.indexOf(b.id);
      if (positionA >= 0 || positionB >= 0)
        return (positionA < 0 ? 99 : positionA) - (positionB < 0 ? 99 : positionB);
      return b.points - a.points ||
        (b.vpFor - b.vpAgainst) - (a.vpFor - a.vpAgainst) ||
        b.vpFor - a.vpFor || a.seedRank - b.seedRank;
    });
  }

  champion() {
    if (!this.complete || this.config.format === 'groups') return null;
    if (['knockout', 'group_knockout'].includes(this.config.format))
      return this.rounds.at(-1).fixtures[0].result.winner;
    return this.standings()[0].id;
  }

  toJSON() {
    return {version: 1, config: this.config, rounds: this.rounds};
  }

  static fromJSON(data) {
    if (data?.version !== 1 || !Array.isArray(data.rounds)) throw new Error('赛事记录无效');
    const tournament = new Tournament(data.config);
    const validIds = new Set(tournament.entrants.map(entry => entry.id));
    if (!data.rounds.length || data.rounds.some(round =>
      !Array.isArray(round.fixtures) || !round.fixtures.length ||
      typeof round.completed !== 'boolean' ||
      round.fixtures.some(f => {
        if (!Array.isArray(f.entrants) || f.entrants.length !== 2 ||
            new Set(f.entrants).size !== 2 || f.entrants.some(id => !validIds.has(id)) ||
            typeof f.seed !== 'string' || round.completed !== Boolean(f.result)) return true;
        if (!f.result) return false;
        return f.result.winner !== null &&
            !f.entrants.includes(f.result.winner) ||
          !Array.isArray(f.result.legs) || f.result.legs.length !== 2 ||
          f.entrants.some(id => !Number.isFinite(f.result.aggregates?.[id]?.vp));
      })))
      throw new Error('赛事轮次无效');
    tournament.rounds = JSON.parse(JSON.stringify(data.rounds));
    return tournament;
  }
}
