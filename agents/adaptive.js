import { BaseAgent, clamp, sampleOptions } from "./base.js";
export class ACOAgent extends BaseAgent {
  constructor(id, size, rng) {
    super(id, size, rng);
    this.pheromone = new Float32Array(size);
    this.evaporateAt = 0;
  }
  selectAction(v) {
    if (v.time - this.evaporateAt > 0.9) {
      for (let i = 0; i < this.pheromone.length; i++) this.pheromone[i] *= 0.84;
      this.evaporateAt = v.time;
    }
    const m = this.choose(
      v.options,
      (o) =>
        this.pheromone[o.to] * 5 +
        o.resource * 8 +
        o.ownN * 1.2 +
        (o.enemy ? 2.5 : 0) -
        o.terrain +
        this.rng.next() * 2.4,
    );
    this.thought = "沿高信息素通道推进，成功路线会被强化";
    return m;
  }
  onResult(r) {
    super.onResult(r);
    if (r?.success && r.move) {
      this.pheromone[r.move.to] += r.reward > 5 ? 2.6 : 1.1;
      this.pheromone[r.move.from] += 0.45;
    }
  }
}

export class PIDAgent extends BaseAgent {
  constructor(id, size, rng) {
    super(id, size, rng);
    this.integral = 0;
    this.prev = 0;
  }
  selectAction(v) {
    const target = 0.26 + (v.progress > 0.72 ? 0.06 : 0),
      err = target - v.share;
    this.integral = clamp(this.integral + err * 0.2, -0.5, 0.5);
    const deriv = err - this.prev;
    this.prev = err;
    const output = 2.4 * err + 0.5 * this.integral + 0.85 * deriv;
    const aggression = clamp(0.45 + output, 0, 1);
    const m = this.choose(
      v.options,
      (o) =>
        (1 - aggression) * (o.ownN * 3 - o.enemyN * 1.7) +
        aggression * ((o.enemy ? 6 : 1) + o.resource * 5) -
        o.terrain +
        this.rng.next(),
    );
    this.thought =
      aggression > 0.62
        ? "面积落后，PID 提高扩张力度"
        : aggression < 0.35
          ? "面积超标，PID 转向巩固"
          : "误差稳定，维持均衡输出";
    return m;
  }
}

export class QLearningAgent extends BaseAgent {
  constructor(id, size, rng) {
    super(id, size, rng);
    this.alpha = 0.18;
    this.gamma = 0.88;
    this.eps = 0.16;
    this.lastState = null;
    this.lastMacro = null;
    this.pending = null;
    this.q = {};
  }
  state(v) {
    const share = v.share < 0.18 ? "S" : v.share < 0.28 ? "M" : "L";
    const pressure =
      v.localPressure > 0.48 ? "H" : v.localPressure > 0.22 ? "M" : "L";
    const rich = v.options.some((o) => o.resource > 0) ? "R" : "N";
    return share + pressure + rich;
  }
  row(s) {
    return (
      this.q[s] ||
      (this.q[s] = { expand: 0, attack: 0, resource: 0, fortify: 0 })
    );
  }
  selectAction(v) {
    const s = this.state(v),
      row = this.row(s),
      macros = Object.keys(row);
    if (this.pending) {
      const { state, macro, reward } = this.pending,
        old = this.row(state)[macro];
      this.row(state)[macro] =
        old +
        this.alpha *
          (reward + this.gamma * Math.max(...Object.values(row)) - old);
      this.pending = null;
    }
    const macro =
      this.rng.next() < this.eps
        ? macros[(this.rng.next() * macros.length) | 0]
        : macros.reduce((a, b) => (row[a] >= row[b] ? a : b));
    this.lastState = s;
    this.lastMacro = macro;
    const score = {
      expand: (o) => (!o.enemy ? 5 : 0) + o.ownN * 1.5 - o.terrain,
      attack: (o) => (o.enemy ? 9 : 0) + o.enemyN * 1.7 + o.resource * 2,
      resource: (o) => o.resource * 13 + o.resourcePull * 2 - o.terrain,
      fortify: (o) => o.ownN * 3.2 - o.enemyN * 2 + (o.enemy ? 1 : 0),
    }[macro];
    const m = this.choose(v.options, (o) => score(o) + this.rng.next() * 1.6);
    this.thought =
      "Q 表选择宏观策略：" +
      { expand: "扩张", attack: "进攻", resource: "抢资源", fortify: "巩固" }[
        macro
      ];
    return m;
  }
  onResult(r) {
    super.onResult(r);
    if (!this.lastState || !this.lastMacro) return;
    this.pending = {
      state: this.lastState,
      macro: this.lastMacro,
      reward: r?.reward ?? 0,
    };
  }
  endMatch() {
    if (!this.pending) return;
    const { state, macro, reward } = this.pending,
      old = this.row(state)[macro];
    this.row(state)[macro] = old + this.alpha * (reward - old);
    this.pending = null;
  }
}

export class MomentumAgent extends BaseAgent {
  selectAction(v) {
    const behind = v.share < 0.22,
      late = v.progress > 0.68,
      pressured = v.localPressure > 0.32;
    const attack = clamp(
      (behind ? 0.28 : 0) + (late ? 0.32 : 0) + (pressured ? 0.2 : 0) + 0.28,
      0,
      1,
    );
    const m = this.choose(
      v.options,
      (o) =>
        attack * ((o.enemy ? 8 : 1) + o.resource * 4 + o.enemyN * 0.7) +
        (1 - attack) * (o.ownN * 3.1 + (o.owner < 0 ? 3 : 0) - o.enemyN) +
        (late ? o.resource * 3 : 0) -
        o.terrain * 0.9 +
        this.rng.next() * 1.1,
    );
    this.thought =
      attack > 0.7
        ? "进入冲刺档，主动争夺敌区和资源"
        : attack < 0.45
          ? "保持巡航档，扩大连续领地"
          : "切入变速档，扩张与进攻并行";
    return m;
  }
}
