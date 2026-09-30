import { createHash } from "node:crypto";
import { parentPort } from "node:worker_threads";
import { createMatch } from "../engine/factory.js";

export function evaluateAcceptanceGame(job) {
  const start = performance.now();
  const match = createMatch(job.config);
  while (!match.getSnapshot().finished) match.advance(250);
  const result = match.getResult();
  for (const t of result.teams) {
    const total = result.ledger.reduce((n, r) => {
      const d = r.scoreDeltas.find((d) => d.participantId === t.participantId);
      return n + d.areaVP + d.resourceVP;
    }, 0);
    if (Math.abs(total - t.score) > 1e-7) throw Error("VP_LEDGER_MISMATCH");
  }
  const canonicalJSON = JSON.stringify({
    ...result,
    teams: result.teams.map(({ thinkMs, ...t }) => t),
  });
  const ordered = [...result.teams].sort((a, b) => b.score - a.score);
  const top = ordered[0].score;
  return {
    id: job.id,
    category: job.category,
    config: job.config,
    canonicalHash: result.integrityHash,
    sha256: createHash("sha256").update(canonicalJSON).digest("hex"),
    timeMs: result.timeMs,
    ticks: result.ledger.length,
    decisions: result.ledger.reduce((n, r) => n + r.proposals.length, 0),
    elapsedMs: performance.now() - start,
    winners: ordered
      .filter((t) => Math.abs(t.score - top) < 1e-9)
      .map((t) => t.strategyId),
    teams: ordered.map(({ lastMove, thought, ...t }) => t),
  };
}

if (parentPort)
  parentPort.on("message", (job) => {
    try {
      parentPort.postMessage({ game: evaluateAcceptanceGame(job) });
    } catch (e) {
      parentPort.postMessage({
        failure: {
          id: job.id,
          config: job.config,
          error: e.stack ?? e.message,
        },
      });
    }
  });
