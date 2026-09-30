import { BaseAgent } from "./base.js";
export class BoundaryAgent extends BaseAgent {
  selectAction(v) {
    this.thought = "边界调度：支援、补洞与资源保有";
    return this.choose(v.options, (o) => {
      const resourceWeight = v.resourceTotal
        ? (3.5 * v.cellCount) / v.resourceTotal
        : 0;
      const hold =
        Math.min(v.remaining, 2 + 3 * o.ownN) / (1 + o.enemyPressure * 4);
      return (
        o.ownN * o.ownN * 5 -
        o.enemyN * 3 -
        o.enemyPressure * 8 +
        o.protectedResourceValue * resourceWeight * 0.14 +
        o.resource * resourceWeight * hold * 0.1 +
        (o.enemy ? 3 : 1) -
        o.terrain
      );
    });
  }
}
