import { createMatch } from "../engine/factory.js";
import { buildReplayPackage } from "../replay/ledger.js";
export function resultReplay(job, result) {
  const initial = createMatch(job.config).getInitialBoard();
  return buildReplayPackage({
    checkpoint: null,
    initialBoard: initial,
    ledger: result.ledger ?? [],
    snapshot: { config: job.config, finished: true, timeMs: result.timeMs },
    boardCheckpoints: [],
  });
}
export const compactResult = (result, observations = []) => ({
  config: result.config,
  timeMs: result.timeMs,
  finished: result.finished,
  teams: result.teams.map(({ lastMove, thought, thinkMs, ...t }) => {
    const o = observations.find((o) => o.participantId === t.participantId);
    return {
      ...t,
      ...(o
        ? {
            meanThinkMs: o.meanThinkMs,
            meanBudgetUsed: o.meanBudgetUsed,
            observationSamples: o.samples,
          }
        : {}),
    };
  }),
  integrityHash: result.integrityHash,
});
