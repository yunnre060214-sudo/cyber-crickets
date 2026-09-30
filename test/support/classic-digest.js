import { createHash } from "node:crypto";
export function classicDigest(m) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        owner: [...m.owner],
        terrain: [...m.terrain],
        resources: [...m.resources],
        core: [...m.core],
        spawns: m.spawns,
        teams: m.teams.map((t) => ({
          id: t.id,
          strategy: t.strategy,
          score: t.score,
          captures: t.captures,
          resources: t.resources,
          territory: t.territory,
          lastMove: t.lastMove,
        })),
        timeline: m.timeline,
        events: m.eventLog,
        decisions: m.decisionLog.map(({ thinkMs, ...d }) => d),
      }),
    )
    .digest("hex");
}
