import { neighbors } from "./maps.js";
const manhattan = (i, p) =>
  Math.abs((i % 64) - p[0]) + Math.abs(Math.floor(i / 64) - p[1]);
export class FrontierIndex {
  constructor(board) {
    this.board = board;
    this.sets = board.spawns.map(() => new Set());
    this.distanceCache = new Map();
    for (let i = 0; i < board.owner.length; i++) this.update(i);
  }
  update(i) {
    const b = this.board;
    for (let seat = 0; seat < this.sets.length; seat++) {
      if (
        !b.blocked[i] &&
        b.core[i] < 0 &&
        b.owner[i] !== seat &&
        neighbors(i).some((n) => b.owner[n] === seat)
      )
        this.sets[seat].add(i);
      else this.sets[seat].delete(i);
    }
  }
  applyChanges(changes) {
    const affected = new Set();
    for (const c of changes) {
      affected.add(c.index);
      neighbors(c.index).forEach((n) => affected.add(n));
    }
    affected.forEach((i) => this.update(i));
  }
  distances(seat) {
    const b = this.board,
      targets = [];
    for (let i = 0; i < 4096; i++)
      if (b.resources[i] && b.owner[i] !== seat) targets.push(i);
    const key = targets.join(",");
    let cached = this.distanceCache.get(seat);
    if (cached?.key === key) return cached.dist;
    const dist = new Int16Array(4096).fill(9999),
      q = [...targets];
    for (const i of q) dist[i] = 0;
    for (let n = 0; n < q.length; n++) {
      const i = q[n];
      for (const j of neighbors(i))
        if (!b.blocked[j] && dist[j] === 9999) {
          dist[j] = dist[i] + 1;
          q.push(j);
        }
    }
    this.distanceCache.set(seat, { key, dist });
    return dist;
  }
  options(seat) {
    const b = this.board,
      dist = this.distances(seat),
      ownerAt = (i, overlay) => (i === overlay ? seat : b.owner[i]);
    const enrich = (from, to, overlay = -1) => {
      const ns = neighbors(to),
        ownN = ns.filter((i) => ownerAt(i, overlay) === seat).length,
        old = ownerAt(to, overlay),
        enemyN = ns.filter(
          (i) =>
            ownerAt(i, overlay) >= 0 &&
            ownerAt(i, overlay) !== seat &&
            (old < 0 || ownerAt(i, overlay) === old),
        ).length,
        pressure =
          ns.filter(
            (i) => ownerAt(i, overlay) >= 0 && ownerAt(i, overlay) !== seat,
          ).length / 4;
      return {
        from,
        to,
        dir: [
          (to % 64) - (from % 64),
          Math.floor(to / 64) - Math.floor(from / 64),
        ],
        owner: old,
        enemy: old >= 0 && old !== seat,
        ownN,
        enemyN,
        terrain: b.terrain[to],
        resource: b.resources[to],
        distOwnCore: manhattan(to, b.spawns[seat]),
        distRivalCore: Math.min(
          ...b.spawns.filter((_, s) => s !== seat).map((p) => manhattan(to, p)),
        ),
        nearestResourceDist: Math.min(9999, dist[to]),
        resourcePull: dist[to] === 9999 ? 0 : 12 / (1 + dist[to]),
        enemyPressure: pressure,
        protectedResourceValue: ns
          .filter(
            (i) =>
              ownerAt(i, overlay) === seat &&
              neighbors(i).some(
                (n) => ownerAt(n, overlay) >= 0 && ownerAt(n, overlay) !== seat,
              ),
          )
          .reduce((sum, i) => sum + b.resources[i], 0),
      };
    };
    return [...this.sets[seat]]
      .sort((a, b) => a - b)
      .map((to) => {
        const from = neighbors(to)
            .filter((i) => b.owner[i] === seat)
            .sort((a, b) => a - b)[0],
          o = enrich(from, to);
        o.continuations = neighbors(to)
          .filter(
            (i) =>
              i !== from &&
              b.owner[i] !== seat &&
              b.core[i] < 0 &&
              !b.blocked[i],
          )
          .map((i) => enrich(to, i, to));
        return o;
      });
  }
}
