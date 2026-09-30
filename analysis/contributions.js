export function summarizeMatch(pkg) {
  const c = pkg.config,
    board = structuredClone(pkg.initialBoard),
    teams = c.entrants.map((e) => ({
      ...e,
      score: 0,
      areaVP: 0,
      resourceVP: 0,
      resourceHoldingSeconds: 0,
      resourceValueSeconds: 0,
      captures: 0,
      recaptures: 0,
      decisions: 0,
      successes: 0,
      phases: [0, 0, 0, 0],
      selectedDecisions: [],
    })),
    history = Array.from(
      { length: 4096 },
      (_, i) => new Set(board.owner[i] >= 0 ? [board.owner[i]] : []),
    ),
    leadChanges = [];
  let leader = null;
  for (const r of pkg.tickRecords) {
    const phase = Math.min(
      3,
      [0.33, 0.62, 0.82].filter(
        (p) => (r.timeMs - r.elapsedMs) / c.durationMs >= p,
      ).length,
    );
    for (const d of r.scoreDeltas) {
      const t = teams.find((t) => t.participantId === d.participantId);
      t.areaVP += d.areaVP;
      t.resourceVP += d.resourceVP;
      t.score += d.areaVP + d.resourceVP;
      t.phases[phase] += d.areaVP + d.resourceVP;
    }
    for (let i = 0; i < 4096; i++)
      if (board.resources[i] && board.owner[i] >= 0) {
        const t = teams[board.owner[i]];
        t.resourceHoldingSeconds += r.elapsedMs / 1000;
        t.resourceValueSeconds += (board.resources[i] * r.elapsedMs) / 1000;
      }
    for (const e of r.resourceChanges) board.resources[e.index] = e.value;
    for (const e of r.ownershipChanges) {
      if (e.previousOwner >= 0) {
        teams[e.owner].captures++;
        if (history[e.index].has(e.owner)) teams[e.owner].recaptures++;
      }
      board.owner[e.index] = e.owner;
      history[e.index].add(e.owner);
    }
    for (const a of r.results) {
      const t =
        teams.find((t) => t.participantId === a.participantId) ||
        teams[a.teamId];
      if (!t) continue;
      t.decisions++;
      if (a.success ?? a.result?.success) t.successes++;
      if (
        t.selectedDecisions.length < 6 &&
        ((a.success && board.resources[a.move?.to]) ||
          (a.result?.success && a.target?.resource))
      )
        t.selectedDecisions.push({
          timeMs: r.timeMs,
          action: structuredClone(a),
        });
    }
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    if (sorted[0].score > 0 && sorted[0].score - sorted[1].score > 1e-9) {
      const next = sorted[0].participantId;
      if (leader !== null && next !== leader)
        leadChanges.push({ timeMs: r.timeMs, from: leader, to: next });
      leader = next;
    }
  }
  return {
    timeMs: pkg.tickRecords.at(-1)?.timeMs ?? 0,
    finished: (pkg.tickRecords.at(-1)?.timeMs ?? 0) >= c.durationMs - 1e-7,
    teams,
    leadChanges,
    leader,
    ruleVersion: c.ruleVersion,
    engineVersion: c.engineVersion,
  };
}
