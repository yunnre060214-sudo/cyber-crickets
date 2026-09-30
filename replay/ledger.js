import { seal } from "../engine/hash.js";
import { summarizeMatch } from "../analysis/contributions.js";
export function buildReplayPackage(capture) {
  const frozen = structuredClone(capture),
    config = frozen.checkpoint?.config ?? frozen.snapshot.config;
  const pkg = {
    format: "cyber-crickets.replay",
    formatVersion: 3,
    config,
    initialBoard: frozen.initialBoard,
    tickRecords: frozen.ledger,
    boardCheckpoints: frozen.boardCheckpoints ?? [],
    checkpoint: frozen.checkpoint ?? null,
  };
  pkg.summary = summarizeMatch(pkg);
  return seal(pkg);
}
