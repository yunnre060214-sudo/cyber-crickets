import { BaseAgent, clamp, sampleOptions } from "./base.js";
export class FloodAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        o.ownN * 2.6 +
        o.resource * 5 -
        o.terrain * 1.25 -
        o.enemyN * 0.45 +
        this.rng.next() * 1.5,
    );
    this.thought = "压平边界，优先维持连续战线";
    return m;
  }
}

export class SpearheadAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        (o.dir[0] === this.lastDir[0] && o.dir[1] === this.lastDir[1] ? 8 : 0) +
        (o.enemy ? 4 : 0) +
        o.resource * 2.4 -
        o.terrain +
        this.rng.next() * 3,
    );
    this.thought = "沿成功方向继续穿刺";
    return m;
  }
}

export class GreedyAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        o.resource * 14 +
        (o.enemy ? 8 : 0) +
        Math.max(0, 3 - o.enemyN) * 2 -
        o.terrain * 1.4 +
        this.rng.next() * 2,
    );
    this.thought = "只吃眼前最高价值";
    return m;
  }
}

export class RandomAgent extends BaseAgent {
  selectAction(v) {
    const m = v.options[(this.rng.next() * v.options.length) | 0] ?? null;
    this.lastChoice = m?.to ?? null;
    this.thought = "随机游走，拒绝解释";
    return m;
  }
}

export class FrontierRunnerAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        (o.owner < 0 ? 6 : 0) -
        o.terrain * 3.2 -
        o.ownN * 0.45 +
        o.resource * 2.5 -
        o.enemyPressure * 1.2 +
        this.rng.next() * 1.8,
    );
    this.thought = "寻找最低阻力缺口，以铺图速度换阵型完整度";
    return m;
  }
}

export class RaiderAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        (o.enemy ? 10 : 0) +
        (o.enemy ? Math.max(0, 3 - o.enemyN) * 3 : 0) +
        o.resource * 4 -
        o.ownN * 0.35 -
        o.terrain +
        this.rng.next() * 1.4,
    );
    this.thought = "寻找敌方薄弱边界，优先切掉孤立格";
    return m;
  }
}

export class TurtleAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        o.ownN * 4.6 -
        o.enemyN * 2.4 +
        (o.enemy ? 0.8 : 2.5) +
        o.resource * 3 -
        o.terrain * 0.7 +
        this.rng.next() * 0.8,
    );
    this.thought = "压缩暴露边界，沿高邻接区域稳步推进";
    return m;
  }
}

export class ResourceDenialAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        o.resource * (o.enemy ? 16 : 11) +
        (o.enemy ? 4 : 0) +
        o.resourcePull * 1.6 -
        o.enemyN * 0.8 -
        o.terrain +
        this.rng.next(),
    );
    this.thought = "优先切断对手资源收益，再抢无主节点";
    return m;
  }
}
