import { canonicalSerialize } from "./hash.js";
export const PRODUCT_VERSION = "2.0.0";
export const STRATEGY_IDS = [
  "bfs",
  "dfs",
  "greedy",
  "random",
  "aco",
  "voronoi",
  "potential",
  "pid",
  "qlearn",
  "minimax",
  "mcts",
  "mst",
  "runner",
  "raider",
  "turtle",
  "denial",
  "momentum",
  "strongest",
  "pathfinder",
  "boundary",
  "ucb",
];
function freeze(o) {
  if (o && typeof o === "object") {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
}
export function createMatchConfig(input = {}) {
  const mode = input.mode ?? "standard",
    teamCount = input.teamCount ?? input.entrants?.length ?? 4,
    classic = mode === "classic";
  const c = {
    schemaVersion: 3,
    productVersion: PRODUCT_VERSION,
    engineVersion: PRODUCT_VERSION,
    ruleVersion: classic ? "v1-eff46735" : "v2-" + mode,
    seed: String(input.seed ?? "20260930"),
    mode,
    mapPreset: classic ? "legacy" : (input.mapPreset ?? "plain"),
    teamCount,
    rotation: input.rotation ?? 0,
    durationMs: input.durationMs ?? 120000,
    tickMs: classic ? 35 : 20,
    decisionIntervalMs: classic ? 85 : 100,
    budgetProfile: input.budgetProfile ?? "standard",
    entrants: (
      input.entrants ??
      ["strongest", "pathfinder", "boundary", "ucb"]
        .slice(0, teamCount)
        .map((strategyId, i) => ({ participantId: "p" + i, strategyId }))
    ).map((e, i) => ({
      participantId: e.participantId,
      strategyId: e.strategyId,
      strategyVersion: classic ? "1.0.0" : "2.0.0",
      parameters: structuredClone(e.parameters ?? {}),
    })),
  };
  if (
    !["standard", "migration", "classic"].includes(mode) ||
    ![2, 4].includes(teamCount) ||
    c.entrants.length !== teamCount
  )
    throw Error("INVALID_MODE_OR_TEAMS");
  if (
    !Number.isSafeInteger(c.durationMs) ||
    c.durationMs % 1000 ||
    c.durationMs < 10000 ||
    c.durationMs > 1800000
  )
    throw Error("INVALID_DURATION");
  if (
    !Number.isInteger(c.rotation) ||
    c.rotation < 0 ||
    c.rotation > (teamCount === 2 ? 1 : 3)
  )
    throw Error("INVALID_ROTATION");
  if (
    !["plain", "basin", "canyon", "ring", "legacy"].includes(c.mapPreset) ||
    (!classic && c.mapPreset === "legacy")
  )
    throw Error("INVALID_MAP");
  if (!["fast", "standard", "deep"].includes(c.budgetProfile))
    throw Error("INVALID_BUDGET");
  const ids = new Set();
  for (const e of c.entrants) {
    if (
      typeof e.participantId !== "string" ||
      !/^[\w.-]{1,80}$/.test(e.participantId) ||
      ids.has(e.participantId)
    )
      throw Error("INVALID_PARTICIPANT");
    ids.add(e.participantId);
    if (!STRATEGY_IDS.slice(0, classic ? 18 : 21).includes(e.strategyId))
      throw Error("INVALID_STRATEGY");
    if (
      !e.parameters ||
      Object.getPrototypeOf(e.parameters) !== Object.prototype ||
      canonicalSerialize(e.parameters).length > 8192
    )
      throw Error("INVALID_PARAMETERS");
  }
  if (c.seed.length > 256) throw Error("INVALID_SEED");
  return freeze(c);
}
