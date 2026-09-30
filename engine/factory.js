import { createMatchConfig } from "./config.js";
import { MatchEngine } from "./match.js";
import { LegacyMatchAdapter } from "../legacy/adapter.js";
export function createMatch(input) {
  const config = createMatchConfig(input);
  return config.mode === "classic"
    ? new LegacyMatchAdapter(config)
    : new MatchEngine(config);
}
