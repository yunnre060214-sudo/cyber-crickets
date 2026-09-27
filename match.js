import {createAgent} from './agents.js?v=20260927-strongest-v3';
import {createRng, deriveSeed, spawnFor, vpRate, resolveActions} from './rules.js?v=20260927-strongest-v3';

export const WIDTH = 64, HEIGHT = 64, CELL_COUNT = WIDTH * HEIGHT;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const index = (x, y) => y * WIDTH + x;
const xy = i => [i % WIDTH, Math.floor(i / WIDTH)];
const inside = (x, y) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

export class Match {
  constructor({seed, rotation = 0, duration = 90, strategies, agentKeys}) {
    this.seed = String(seed);
    this.rotation = rotation;
    this.duration = duration;
    this.time = 0;
    this.finished = false;
    this.flags = new Set();
    this.timeline = [];
    this.nextSnapshot = 1;
    // Full-fidelity match log for Markdown export / external AI analysis.
    this.decisionLog = [];
    this.eventLog = [];
    this.rng = createRng(deriveSeed(this.seed, 'world'));
    this.width = WIDTH;
    this.height = HEIGHT;
    this.owner = new Int8Array(CELL_COUNT).fill(-1);
    this.terrain = new Uint8Array(CELL_COUNT);
    this.resources = new Uint8Array(CELL_COUNT);
    this.core = new Int8Array(CELL_COUNT).fill(-1);
    this.resourceCells = [];
    this.resourceTotal = 0;
    this.spawns = strategies.length === 2
      ? [[5, 32], [58, 32]]
      : strategies.map((_, id) => spawnFor(id, rotation));
    this.teams = strategies.map((strategy, id) => ({
      id, strategy, score: 0, captures: 0, resources: 0, territory: 0,
      nextDecision: 0, thinkMs: 0, lastMove: null,
      agent: createAgent(strategy, id, CELL_COUNT,
        createRng(deriveSeed(this.seed, 'agent:' + (agentKeys?.[id] ?? id) + ':' + strategy)))
    }));
    for (let i = 0; i < CELL_COUNT; i++)
      this.terrain[i] = 1 + (this.rng.next() < .17) + (this.rng.next() < .04);
    this.seedCores();
    this.addResources(26, false);
    this.stats();
    this.recordSnapshot();
  }

  recordSnapshot() {
    this.timeline.push({
      time: this.time,
      resourceTotal: this.resourceTotal,
      teams: this.teams.map(team => ({
        id: team.id, score: team.score, territory: team.territory,
        resources: team.resources, captures: team.captures
      }))
    });
  }

  seedCores() {
    this.spawns.forEach(([cx, cy], id) => {
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          const i = index(x, y);
          this.owner[i] = this.core[i] = id;
          this.terrain[i] = 1;
        }
    });
  }

  addResource(i, value) {
    if (this.resources[i] || this.core[i] >= 0) return;
    this.resources[i] = value;
    this.resourceTotal += value;
    this.resourceCells.push(i);
  }

  addResources(count, center) {
    let attempts = 0;
    while (count && attempts++ < 5000) {
      const x = center ? Math.floor(WIDTH * .28 + this.rng.next() * WIDTH * .44) : 4 + this.rng.int(WIDTH - 8);
      const y = center ? Math.floor(HEIGHT * .28 + this.rng.next() * HEIGHT * .44) : 4 + this.rng.int(HEIGHT - 8);
      const i = index(x, y);
      if (this.core[i] >= 0 || this.resources[i]) continue;
      this.addResource(i, this.rng.next() < .18 ? 3 : 1);
      count--;
    }
  }

  events() {
    const p = this.time / this.duration, news = [];
    if (p >= .33 && !this.flags.has('p')) {
      this.flags.add('p'); this.addResources(12, true);
      news.push({banner: '资源潮汐：中央新增节点', log: '资源潮汐出现，中央区域价值上升。'});
    }
    if (p >= .62 && !this.flags.has('o')) {
      this.flags.add('o');
      for (let y = 25; y < 39; y++) for (let x = 25; x < 39; x++) {
        const i = index(x, y);
        if (!this.resources[i] && this.rng.next() < .09) this.addResource(i, 3);
      }
      news.push({banner: '核心节点上线：中央资源价值提升', log: '核心节点上线，中央争夺加剧。'});
    }
    if (p >= .82 && !this.flags.has('f')) {
      this.flags.add('f');
      news.push({banner: '终局超频：全体翻色成功率提升', log: '终局超频开始，最后冲刺。'});
    }
    for (const item of news) this.eventLog.push({
      time: this.time, type: 'major', banner: item.banner, message: item.log
    });
    return news;
  }

  neighbors(i, id) {
    const [x, y] = xy(i);
    let count = 0;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny) && this.owner[index(nx, ny)] === id) count++;
    }
    return count;
  }

  enemyAround(i, id) {
    const [x, y] = xy(i);
    let count = 0;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny)) {
        const v = this.owner[index(nx, ny)];
        if (v >= 0 && v !== id) count++;
      }
    }
    return count;
  }

  nearestResourceDist(point, id) {
    let best = 99;
    for (const i of this.resourceCells) if (this.owner[i] !== id) {
      best = Math.min(best, distance(point, xy(i)));
      if (best <= 1) break;
    }
    return best;
  }

  enrich(id, move) {
    const owner = this.owner[move.to], point = xy(move.to);
    const ownN = this.neighbors(move.to, id);
    const enemyN = owner >= 0 ? this.neighbors(move.to, owner) : this.enemyAround(move.to, id);
    const nearest = this.nearestResourceDist(point, id);
    const rivalDist = Math.min(...this.spawns.filter((_, team) => team !== id).map(spawn => distance(point, spawn)));
    return {...move, owner, enemy: owner >= 0 && owner !== id,
      ownN, enemyN, terrain: this.terrain[move.to], resource: this.resources[move.to],
      distOwnCore: distance(point, this.spawns[id]), distRivalCore: rivalDist,
      nearestResourceDist: nearest, resourcePull: nearest >= 99 ? 0 : 12 / (1 + nearest),
      enemyPressure: this.enemyAround(move.to, id) / 4};
  }

  continuations(id, move) {
    // Public depth-2 local lookahead: assume the first move succeeds, then expose
    // legal moves originating from the newly captured cell. Every Agent receives
    // this same field; no future RNG or hidden outcome is exposed.
    const result = [], [x, y] = xy(move.to);
    for (const dir of DIRECTIONS) {
      const nx=x+dir[0], ny=y+dir[1];
      if (!inside(nx,ny)) continue;
      const to=index(nx,ny);
      if (to===move.from || this.owner[to]===id || this.core[to]>=0) continue;
      const next=this.enrich(id,{from:move.to,to,dir});
      // Under the hypothetical first-step success, the new origin becomes one
      // additional friendly neighbor of every second-step target.
      next.ownN=Math.min(4,next.ownN+1);
      result.push(next);
    }
    return result;
  }

  options(id) {
    const owned = [], options = [];
    for (let i = 0; i < CELL_COUNT; i++) if (this.owner[i] === id) owned.push(i);
    if (!owned.length) return options;
    const stride = Math.ceil(owned.length / 300), begin = this.rng.int(Math.min(stride, owned.length));
    for (let n = begin; n < owned.length; n += stride) {
      const from = owned[n], [x, y] = xy(from);
      for (const dir of DIRECTIONS) {
        const nx = x + dir[0], ny = y + dir[1];
        if (!inside(nx, ny)) continue;
        const to = index(nx, ny);
        if (this.owner[to] === id || this.core[to] >= 0) continue;
        const option=this.enrich(id,{from,to,dir});
        option.continuations=this.continuations(id,option);
        options.push(option);
      }
    }
    return options;
  }

  stats() {
    const areas = [0, 0, 0, 0], resourceValues = [0, 0, 0, 0];
    for (let i = 0; i < CELL_COUNT; i++) {
      const id = this.owner[i];
      if (id < 0) continue;
      areas[id]++;
      resourceValues[id] += this.resources[i];
    }
    for (const team of this.teams) {
      team.territory = areas[team.id];
      team.resources = resourceValues[team.id];
    }
  }

  step(dt) {
    if (this.finished) return [];
    const elapsed = Math.min(dt, this.duration - this.time);
    this.time += elapsed;
    const news = this.events();
    const proposals = [];
    const live = this.teams.map(team => ({
      id: team.id,
      score: team.score,
      territory: team.territory,
      resources: team.resources,
      vpRate: vpRate(team.territory, CELL_COUNT, team.resources, this.resourceTotal)
    }));
    const standings = [...live].sort((a,b) =>
      b.score-a.score || b.vpRate-a.vpRate || b.territory-a.territory || a.id-b.id);
    if (this.time < this.duration) for (const team of this.teams) {
      if (this.time < team.nextDecision) continue;
      const options = this.options(team.id);
      if (!options.length) continue;
      const contested = options.filter(option => option.enemy).length;
      const mine=live[team.id], rank=standings.findIndex(item => item.id===team.id)+1;
      const leader=standings[0], runnerUp=standings[rank===1?1:0]||leader;
      const view = {
        id: team.id,
        time: this.time,
        duration: this.duration,
        remaining: Math.max(0,this.duration-this.time),
        progress: this.time / this.duration,
        teamCount: this.teams.length,
        score: mine.score,
        vpRate: mine.vpRate,
        share: mine.territory / CELL_COUNT,
        territory: mine.territory,
        resources: mine.resources,
        resourceShare: this.resourceTotal ? mine.resources / this.resourceTotal : 0,
        resourceTotal: this.resourceTotal,
        cellCount: CELL_COUNT,
        rank,
        scoreGap: Math.max(0,leader.score-mine.score),
        leadMargin: rank===1 ? Math.max(0,mine.score-runnerUp.score) : 0,
        leaderScore: leader.score,
        leaderVpRate: leader.vpRate,
        leaderShare: leader.territory / CELL_COUNT,
        leaderResourceShare: this.resourceTotal ? leader.resources / this.resourceTotal : 0,
        localPressure: contested / options.length,
        options,
        width: WIDTH,
        height: HEIGHT
      };
      const start = performance.now();
      let move;
      try { move = team.agent.selectAction(view); }
      catch (error) {
        console.error(error);
        move = options[this.rng.int(options.length)];
        team.agent.thought = '决策异常，使用随机候选';
      }
      team.thinkMs = performance.now() - start;
      team.nextDecision = this.time + .085;
      if (move) {
        const [fromX, fromY] = xy(move.from), [toX, toY] = xy(move.to);
        const decision = {
          seq: this.decisionLog.length + 1,
          time: this.time,
          teamId: team.id,
          strategy: team.strategy,
          score: view.score,
          vpRate: view.vpRate,
          rank: view.rank,
          scoreGap: view.scoreGap,
          share: view.share,
          resourceShare: view.resourceShare,
          localPressure: view.localPressure,
          optionCount: options.length,
          thought: team.agent.thought || '',
          from: {index: move.from, x: fromX, y: fromY},
          to: {index: move.to, x: toX, y: toY},
          target: {
            owner: move.owner,
            enemy: !!move.enemy,
            terrain: move.terrain,
            resource: move.resource,
            ownNeighbors: move.ownN,
            enemyNeighbors: move.enemyN,
            distOwnCore: move.distOwnCore,
            distRivalCore: move.distRivalCore,
            nearestResourceDist: move.nearestResourceDist,
            resourcePull: move.resourcePull,
            enemyPressure: move.enemyPressure
          },
          thinkMs: team.thinkMs,
          result: null
        };
        this.decisionLog.push(decision);
        proposals.push({id: team.id, move, decision});
      }
    }
    const results = resolveActions(this, proposals, () => this.rng.next(), this.flags.has('f'));
    for (const result of results) {
      const team = this.teams[result.id];
      const proposal = proposals.find(item => item.id === result.id && item.move === result.move);
      if (proposal?.decision) proposal.decision.result = {
        success: !!result.success,
        previousOwner: result.previousOwner ?? -1,
        reward: result.reward ?? 0
      };
      team.lastMove = result.move;
      if (result.success && result.previousOwner >= 0) team.captures++;
      team.agent.onResult(result);
    }
    this.stats();
    for (const team of this.teams) {
      team.score += elapsed * vpRate(team.territory, CELL_COUNT, team.resources, this.resourceTotal);
    }
    while (this.time + 1e-9 >= this.nextSnapshot && this.nextSnapshot <= this.duration) {
      this.recordSnapshot();
      this.nextSnapshot++;
    }
    if (this.time >= this.duration) {
      if (this.timeline.at(-1)?.time !== this.time) this.recordSnapshot();
      this.finished = true;
      for (const team of this.teams) team.agent.endMatch?.();
    }
    return news;
  }
}
