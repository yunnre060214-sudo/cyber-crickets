export function createBudget(profile = "standard") {
  const limit = { fast: 4096, standard: 8192, deep: 16384 }[profile];
  if (!limit) throw Error("INVALID_BUDGET");
  let used = 0;
  return {
    get used() {
      return used;
    },
    get remaining() {
      return limit - used;
    },
    consume(kind, count = 1) {
      const weight = { score: 1, path: 1, rollout: 4 }[kind];
      if (!weight || !Number.isSafeInteger(count) || count < 0)
        throw Error("INVALID_WORK");
      const cost = count * weight;
      if (cost > limit - used) return false;
      used += cost;
      return true;
    },
  };
}
