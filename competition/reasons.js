import { canonicalHash } from "../engine/hash.js";

// Explain the saved result without choosing a winner or changing tie policy.
export function fixtureReason(fixture) {
  const result = fixture.result;
  if (!result) return fixture.extraMap ? "extra_map" : "pending";
  if (result.winner === null) return "draw";
  const [a, b] = fixture.entrants,
    x = result.aggregates[a],
    y = result.aggregates[b];
  // Use the same comparison as both modern and frozen classic aggregation.
  if (x.vp > y.vp + 1e-9 || y.vp > x.vp + 1e-9) return "vp";
  if (x.captures !== y.captures) return "captures";
  if (x.territory !== y.territory) return "territory";
  return "seed";
}

export function fixtureReasonLabel(fixture) {
  return {
    vp: "累计 VP 更高",
    captures: "累计 VP 持平，翻色次数更多",
    territory: "累计 VP 与翻色次数持平，终局领地更多",
    seed: "累计 VP、翻色与领地持平，按赛事种子抽签",
    draw: "累计 VP 持平，记平局",
    extra_map: "累计 VP 持平，等待加赛",
    pending: "等待结算",
  }[fixtureReason(fixture)];
}

export function fixtureReasons(rounds) {
  return Object.fromEntries(
    rounds
      .flatMap((r) => r.fixtures)
      .filter((f) => f.result)
      .map((f) => [f.id, fixtureReason(f)]),
  );
}

export function validateFixtureReasons(state, rounds) {
  if (!Object.hasOwn(state, "fixtureReasons")) return;
  const saved = state.fixtureReasons;
  if (
    !saved ||
    typeof saved !== "object" ||
    Array.isArray(saved) ||
    canonicalHash(saved) !== canonicalHash(fixtureReasons(rounds))
  )
    throw Error("FIXTURE_REASON_MISMATCH");
}

export function withoutFixtureReasons({ fixtureReasons, ...state }) {
  return state;
}
