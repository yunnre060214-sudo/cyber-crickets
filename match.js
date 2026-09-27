import {createAgent} from './agents.js';
import {createRng, deriveSeed, spawnFor, vpRate, resolveActions} from './rules.js';

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
        options.push(this.enrich(id, {from, to, dir}));
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
    if (this.time < this.duration) for (const team of this.teams) {
      if (this.time < team.nextDecision) continue;
      const options = this.options(team.id);
      if (!options.length) continue;
      const contested = options.filter(option => option.enemy).length;
      const view = {id: team.id, time: this.time, progress: this.time / this.duration,
        share: team.territory / CELL_COUNT, localPressure: contested / options.length,
        options, width: WIDTH, height: HEIGHT};
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
      if (move) proposals.push({id: team.id, move});
    }
    const results = resolveActions(this, proposals, () => this.rng.next(), this.flags.has('f'));
    for (const result of results) {
      const team = this.teams[result.id];
      team.lastMove = result.move;
      if (result.success && result.previousOwner >= 0) team.captures++;
      team.agent.onResult(result);
    }
    this.stats();
    for (const team of this.teams) {
      team.score += elapsed * vpRate(team.territory, CELL_COUNT, team.resources, this.resourceTotal);
    }
    if (this.time >= this.duration) {
      this.finished = true;
      for (const team of this.teams) team.agent.endMatch?.();
    }
    return news;
  }
}
