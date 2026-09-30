export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export class BaseAgent {
  constructor(id, size, rng) {
    this.id = id;
    this.size = size;
    this.rng = rng;
    this.lastDir = [1, 0];
    this.thought = "等待决策";
    this.lastChoice = null;
  }
  evaluate(o, score) {
    if (!this.budget.consume("score")) throw Error("BUDGET_EXHAUSTED");
    const value = score(o);
    this.evaluated.push({ to: o.to, score: value });
    if (value > this.bestScore) {
      this.bestScore = value;
      this.best = o;
    }
    return value;
  }
  choose(options, score) {
    let m = null,
      b = -Infinity;
    for (const o of options) {
      const value = this.evaluate(o, score);
      if (value > b) {
        m = o;
        b = value;
      }
    }
    this.lastChoice = m?.to ?? null;
    return m;
  }
  onResult(r) {
    if (r?.move?.dir) this.lastDir = r.move.dir;
  }
  endMatch() {}
  reset() {}
}
export function sampleOptions(options, limit, rng) {
  if (options.length <= limit) return options;
  const sample = [...options];
  for (let i = sample.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }
  return sample.slice(0, limit);
}
