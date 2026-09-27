export function deriveSeed(seed, stream) {
  return String(seed) + ':' + stream;
}

// A small deterministic PRNG. This is a game seed, not cryptographic randomness.
export function createRng(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.codePointAt(0);
    state = Math.imul(state, 16777619);
  }
  return {
    next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * max);
    }
  };
}

const SPAWNS = [[5, 5], [58, 5], [5, 58], [58, 58]];
export function spawnFor(id, rotation) {
  return [...SPAWNS[((id + rotation) % 4 + 4) % 4]];
}

export function vpRate(area, cellCount, resources, resourceTotal) {
  return 10 * (0.65 * area / cellCount +
    (resourceTotal ? 0.35 * resources / resourceTotal : 0));
}

function adjacent(a, b, width) {
  return Math.abs(a % width - b % width) +
    Math.abs(Math.floor(a / width) - Math.floor(b / width)) === 1;
}

function neighbors(owner, index, team, width, height) {
  const x = index % width, y = Math.floor(index / width);
  let count = 0;
  if (x > 0 && owner[index - 1] === team) count++;
  if (x < width - 1 && owner[index + 1] === team) count++;
  if (y > 0 && owner[index - width] === team) count++;
  if (y < height - 1 && owner[index + width] === team) count++;
  return count;
}

// All attacks are evaluated against the old owner grid. Ownership changes only
// after contested targets have a single winner.
export function resolveActions(world, proposals, next, overclock = false) {
  const {width, height, owner, terrain, resources, core} = world;
  const results = [...proposals].sort((a, b) => a.id - b.id).map(({id, move}) => {
    const from = move?.from, to = move?.to;
    const valid = Number.isInteger(from) && Number.isInteger(to) &&
      from >= 0 && to >= 0 && from < owner.length && to < owner.length &&
      owner[from] === id && owner[to] !== id && core[to] < 0 &&
      adjacent(from, to, width);
    const previousOwner = valid ? owner[to] : -1;
    if (!valid) return {id, move, success: false, reward: -0.15, previousOwner};
    const support = neighbors(owner, to, id, width, height);
    const defense = previousOwner < 0 ? 0 : neighbors(owner, to, previousOwner, width, height);
    let chance = previousOwner < 0
      ? 0.93 - (terrain[to] - 1) * 0.12
      : 0.39 + support * 0.105 - defense * 0.075 - (terrain[to] - 1) * 0.05;
    if (overclock) chance += 0.075;
    chance = Math.max(0.12, Math.min(0.93, chance));
    return {id, move, success: next() <= chance, reward: -0.15, previousOwner};
  });
  const targets = new Map();
  for (const result of results) if (result.success) {
    const group = targets.get(result.move.to) || [];
    group.push(result);
    targets.set(result.move.to, group);
  }
  for (const group of targets.values()) {
    const winner = group.length === 1 ? group[0] : group[Math.floor(next() * group.length)];
    for (const result of group) if (result !== winner) result.success = false;
    owner[winner.move.to] = winner.id;
    winner.reward = 1 + resources[winner.move.to] * 4 + (winner.previousOwner >= 0 ? 0.5 : 0);
  }
  return results;
}
