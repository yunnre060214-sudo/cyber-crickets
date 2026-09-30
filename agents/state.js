import { encode, decode } from "../engine/hash.js";
export const STATE_FIELDS = [
  "lastDir",
  "thought",
  "lastChoice",
  "pheromone",
  "evaporateAt",
  "integral",
  "prev",
  "alpha",
  "gamma",
  "eps",
  "lastState",
  "lastMacro",
  "pending",
  "q",
  "recentTargets",
  "recentCursor",
  "failures",
  "peakShare",
  "lastShare",
  "shareLossEMA",
  "pressureEMA",
  "rateDeficitEMA",
  "strategyState",
  "counts",
  "values",
  "pendingMacro",
  "total",
  "lastPath",
  "lastGoal",
];
export function exportAgentState(agent, id) {
  return {
    schemaVersion: 1,
    id,
    version: "2.0.0",
    rng: agent.rng.exportState(),
    fields: encode(
      Object.fromEntries(
        STATE_FIELDS.filter((k) => Object.hasOwn(agent, k)).map((k) => [
          k,
          agent[k],
        ]),
      ),
    ),
  };
}
export function importAgentState(agent, state, id) {
  if (
    state.schemaVersion !== 1 ||
    state.id !== id ||
    state.version !== "2.0.0" ||
    !state.fields ||
    Object.keys(state.fields).some((k) => !STATE_FIELDS.includes(k))
  )
    throw Error("INVALID_AGENT_STATE");
  const fields = decode(state.fields);
  for (const [k, v] of Object.entries(fields)) {
    if (
      ArrayBuffer.isView(v) &&
      v.length !==
        (k === "pheromone" ? agent.size : k === "recentTargets" ? 14 : 4)
    )
      throw Error("INVALID_AGENT_STATE_LENGTH");
  }
  agent.rng.importState(state.rng);
  Object.assign(agent, fields);
}
