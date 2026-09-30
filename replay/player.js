import { vpRate } from "../engine/rules.js";
export class ReplayPlayer {
  constructor(pkg) {
    this.pkg = pkg;
  }
  seek(timeMs) {
    const p = this.pkg,
      time = Math.max(
        0,
        Math.min(Number(timeMs) || 0, p.tickRecords.at(-1)?.timeMs ?? 0),
      ),
      checkpoints = p.boardCheckpoints ?? [],
      cp = [...checkpoints].reverse().find((c) => c.timeMs <= time),
      board = structuredClone(cp?.board ?? p.initialBoard),
      scores = cp ? [...cp.scores] : p.config.entrants.map(() => 0),
      start = cp?.timeMs ?? 0;
    let tick = cp?.tick ?? 0,
      actual = start;
    const events = [];
    for (const r of p.tickRecords) {
      if (r.timeMs > time + 1e-8) break;
      events.push(...r.events);
      if (r.timeMs <= start) continue;
      for (const c of r.resourceChanges) board.resources[c.index] = c.value;
      for (const c of r.ownershipChanges) board.owner[c.index] = c.owner;
      for (const d of r.scoreDeltas) {
        const i = p.config.entrants.findIndex(
          (e) => e.participantId === d.participantId,
        );
        scores[i] += d.areaVP + d.resourceVP;
      }
      tick = r.tick;
      actual = r.timeMs;
    }
    const areas = scores.map(() => 0),
      values = scores.map(() => 0),
      total = board.resources.reduce((a, b) => a + b, 0);
    board.owner.forEach((seat, i) => {
      if (seat >= 0) {
        areas[seat]++;
        values[seat] += board.resources[i];
      }
    });
    const last = p.tickRecords.findLast(
        (r) => r.timeMs <= time && r.proposals.length,
      ),
      teams = p.config.entrants.map((e, seat) => ({
        ...e,
        seat,
        score: scores[seat],
        territory: areas[seat],
        resources: values[seat],
        vpRate: vpRate({
          area: areas[seat],
          playableCellCount: board.playableCellCount,
          resourceValue: values[seat],
          resourceTotal: total,
        }),
        lastMove:
          last?.proposals.find((a) => a.participantId === e.participantId)
            ?.move ?? null,
      }));
    return {
      config: p.config,
      matchId: p.integrityHash,
      tick,
      timeMs: actual,
      finished: actual >= p.config.durationMs - 1e-7,
      boardRevision: tick,
      board,
      teams,
      events,
      publicDecisionTrace: teams.map((t) => t.lastMove?.explain ?? null),
    };
  }
}
