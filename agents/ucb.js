import { BaseAgent } from "./base.js";
export class UcbAgent extends BaseAgent {
  constructor(...args) {
    super(...args);
    this.counts = [0, 0, 0, 0];
    this.values = [0, 0, 0, 0];
    this.pendingMacro = null;
    this.total = 0;
    this.prev = 0;
  }
  feedback(rate) {
    if (this.pendingMacro === null) return;
    const i = this.pendingMacro,
      n = ++this.counts[i];
    this.values[i] += (rate - this.prev - this.values[i]) / n;
    this.total++;
    this.pendingMacro = null;
  }
  selectAction(v) {
    this.feedback(v.vpRate);
    let i = this.counts.findIndex((n) => !n);
    if (i < 0) {
      const values = this.values.map(
        (m, k) => m + Math.sqrt((2 * Math.log(this.total)) / this.counts[k]),
      );
      i = values.indexOf(Math.max(...values));
    }
    this.pendingMacro = i;
    this.prev = v.vpRate;
    this.thought = "UCB1 宏观选择：" + ["扩张", "进攻", "资源", "巩固"][i];
    return this.choose(
      v.options,
      [
        (o) => (!o.enemy ? 5 : 0) + o.ownN - o.terrain,
        (o) => (o.enemy ? 10 : 0) + o.ownN * 2 - o.enemyN,
        (o) => o.resource * 14 + o.resourcePull * 2 - o.terrain,
        (o) => o.ownN * 4 - o.enemyN * 2 - o.enemyPressure * 3,
      ][i],
    );
  }
  endMatch(v) {
    this.feedback(v.vpRate);
  }
}
