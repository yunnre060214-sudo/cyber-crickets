import { BaseAgent, clamp, sampleOptions } from "./base.js";
export class VoronoiAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(v.options, (o) => {
      const ownDist = o.distOwnCore;
      const rivalDist = o.distRivalCore;
      return (
        (rivalDist - ownDist) * 2.8 +
        o.ownN * 2.2 +
        o.resource * 4 -
        (o.enemy ? 1.2 : 0) -
        o.terrain * 0.8 +
        this.rng.next()
      );
    });
    this.thought = "先吃属于自己的势力圈，再推整齐边界";
    return m;
  }
}

export class PotentialAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        o.resourcePull * 3.8 -
        o.enemyPressure * 2.6 +
        o.ownN * 1.4 -
        o.terrain * 0.7 +
        (o.enemy ? 1.6 : 0) +
        this.rng.next() * 1.4,
    );
    this.thought = "资源吸引，强敌排斥，绕开硬骨头";
    return m;
  }
}

export class ResourceChainAgent extends BaseAgent {
  selectAction(v) {
    const m = this.choose(
      v.options,
      (o) =>
        -o.nearestResourceDist * 2.4 +
        o.resource * 12 +
        o.ownN * 0.8 -
        o.terrain * 1.3 -
        (o.enemy ? 1.5 : 0) +
        this.rng.next(),
    );
    this.thought = "朝最近资源节点推进，形成枝状轨迹";
    return m;
  }
}

export class CounterplayAgent extends BaseAgent {
  selectAction(v) {
    const sample = sampleOptions(v.options, 36, this.rng);
    const m = this.choose(sample, (o) => {
      const mine = o.resource * 8 + (o.enemy ? 7 : 2) + o.ownN * 2 - o.terrain;
      const worstReply =
        o.enemyN * 2.7 + o.enemyPressure * 4 + (o.enemy ? 1 : 0);
      return mine - worstReply + this.rng.next() * 0.7;
    });
    this.thought = "估计局部敌压，优先堵口和防夹击";
    return m;
  }
}
