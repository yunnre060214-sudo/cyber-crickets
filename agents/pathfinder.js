import { BaseAgent } from "./base.js";
import { neighbors } from "../engine/maps.js";
const dist = (a, b, w) =>
  Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));
class Heap {
  constructor() {
    this.a = [];
  }
  push(n) {
    this.a.push(n);
    let i = this.a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= n.f) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = n;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let j = i * 2 + 1;
        if (j + 1 < this.a.length && this.a[j + 1].f < this.a[j].f) j++;
        if (last.f <= this.a[j].f) break;
        this.a[i] = this.a[j];
        i = j;
      }
      this.a[i] = last;
    }
    return first;
  }
}
export function findPath(board, from, to, { seat, budget }) {
  const n = board.owner.length,
    g = new Float64Array(n).fill(Infinity),
    parent = new Int32Array(n).fill(-1),
    closed = new Uint8Array(n),
    heap = new Heap();
  g[from] = 0;
  heap.push({ i: from, f: dist(from, to, board.width) });
  let expanded = 0;
  while (heap.a.length) {
    const { i } = heap.pop();
    if (closed[i]) continue;
    if (!budget.consume("path")) return null;
    closed[i] = 1;
    expanded++;
    if (i === to) {
      const path = [];
      for (let j = to; j !== -1; j = parent[j]) path.push(j);
      return { path: path.reverse(), cost: g[to], expanded };
    }
    for (const j of neighbors(i, board.width, board.height)) {
      if (
        board.blocked[j] ||
        closed[j] ||
        (board.core[j] >= 0 && board.core[j] !== seat)
      )
        continue;
      const score =
        g[i] +
        board.terrain[j] +
        (board.owner[j] >= 0 && board.owner[j] !== seat ? 2 : 0);
      if (score < g[j]) {
        g[j] = score;
        parent[j] = i;
        heap.push({ i: j, f: score + dist(j, to, board.width) });
      }
    }
  }
  return null;
}
export class PathfinderAgent extends BaseAgent {
  constructor(...args) {
    super(...args);
    this.lastPath = [];
    this.lastGoal = null;
  }
  selectAction(v) {
    this.lastPath = [];
    const b = v.board;
    let goal = null,
      value = -Infinity;
    const [x, y] = b.spawns[this.id],
      from = y * b.width + x;
    for (let i = 0; i < b.resources.length; i++)
      if (b.resources[i] && b.owner[i] !== this.id) {
        if (!this.budget.consume("score")) break;
        const s = b.resources[i] / (1 + dist(from, i, b.width));
        if (s > value) {
          value = s;
          goal = i;
        }
      }
    if (goal !== null) {
      const r = findPath(b, from, goal, { seat: this.id, budget: this.budget });
      if (r) {
        this.lastPath = r.path;
        this.lastGoal = goal;
        const edge = r.path.findIndex((i) => b.owner[i] !== this.id);
        const o = v.options.find((o) => o.to === r.path[edge]);
        if (o) {
          this.thought =
            "A* 通路，成本 " + r.cost + "，展开 " + r.expanded + " 个节点";
          return o;
        }
      }
    }
    this.thought = "A* 无可用通路，使用资源前沿";
    return this.choose(
      v.options,
      (o) => o.resource * 10 - o.nearestResourceDist + o.ownN - o.terrain,
    );
  }
}
