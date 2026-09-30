import { createMatchConfig } from "../../engine/config.js";
import { canonicalHash } from "../../engine/hash.js";
export const testConfig = (overrides = {}) =>
  createMatchConfig({
    seed: "test-default",
    durationMs: 10000,
    mode: "standard",
    mapPreset: "plain",
    entrants: ["random", "greedy", "turtle", "strongest"].map(
      (strategyId, i) => ({ participantId: "p" + i, strategyId }),
    ),
    ...overrides,
  });
export const resultDigest = canonicalHash;
export const testTournamentConfig = (overrides = {}) => ({
  id: "test-tournament",
  name: "Test",
  format: "round_robin",
  seed: "test-tournament",
  durationMs: 10000,
  mode: "standard",
  mapPreset: "plain",
  mapCount: 1,
  entrants: ["bfs", "dfs", "greedy", "random"].map((strategyId, i) => ({
    participantId: "p" + i,
    strategyId,
  })),
  ...overrides,
});
export const testExperimentConfig = (overrides = {}) => ({
  id: "test-experiment",
  name: "Test",
  mode: "standard",
  mapPresets: ["plain"],
  durationsMs: [10000],
  rosters: [
    ["random", "greedy", "turtle", "strongest"].map((strategyId, i) => ({
      participantId: "p" + i,
      strategyId,
    })),
  ],
  seedList: Array.from({ length: 8 }, (_, i) => "test-seed-" + i),
  teamCount: 4,
  budgetProfile: "standard",
  ...overrides,
});
