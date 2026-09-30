import { FORMAT_NAMES, circlePairs, swissPairs } from "./formats.js";
import { standingsFor } from "./standings.js";
import { fixtureJobs } from "./fixture.js";
import { createMatchConfig } from "../engine/config.js";
import { canonicalHash } from "../engine/hash.js";
export function validateTournamentConfig(input) {
  const c = {
    ...input,
    id: String(input.id ?? crypto.randomUUID()),
    name: String(input.name ?? "新赛事").slice(0, 80),
    mapCount: input.mapCount ?? 1,
    swissRounds: input.swissRounds ?? 3,
    mode: input.mode ?? "standard",
    mapPreset: input.mapPreset ?? "plain",
    budgetProfile: input.budgetProfile ?? "standard",
    durationMs: input.durationMs ?? 60000,
  };
  const n = c.entrants?.length;
  if (
    !Object.hasOwn(FORMAT_NAMES, c.format) ||
    ![4, 8, 16].includes(n) ||
    (["groups", "group_knockout"].includes(c.format) && n === 4) ||
    ![1, 3, 5].includes(c.mapCount) ||
    !Number.isInteger(c.swissRounds) ||
    c.swissRounds < 1 ||
    c.swissRounds >= n ||
    new Set(c.entrants.map((e) => e.participantId)).size !== n
  )
    throw Error("INVALID_TOURNAMENT_CONFIG");
  for (let i = 0; i < n; i += 2)
    createMatchConfig({
      ...c,
      teamCount: 2,
      entrants: c.entrants.slice(i, i + 2),
    });
  return structuredClone(c);
}
export class Tournament {
  constructor(input) {
    this.config = validateTournamentConfig(input);
    this.rounds = [];
    this.groups = {};
    this.status = "ready";
    this.initialize();
  }
  addRound(label, phase, pairs, groups = []) {
    const round = this.rounds.length;
    this.rounds.push({
      label,
      phase,
      completed: false,
      fixtures: pairs.map((entrants, i) => ({
        id: "r" + round + "f" + i,
        stage: phase,
        group: groups[i] ?? null,
        entrants,
        seed: this.config.seed + "|round:" + round + "|fixture:" + i,
        result: null,
        extraMap: false,
      })),
    });
  }
  initialize() {
    const c = this.config,
      ids = c.entrants.map((e) => e.participantId);
    if (["round_robin", "double_round_robin"].includes(c.format)) {
      for (
        let cycle = 0;
        cycle < (c.format === "double_round_robin" ? 2 : 1);
        cycle++
      )
        circlePairs(ids).forEach((p) =>
          this.addRound(
            "第 " + (this.rounds.length + 1) + " 轮",
            "league",
            cycle ? p.map((x) => [...x].reverse()) : p,
          ),
        );
    } else if (["groups", "group_knockout"].includes(c.format)) {
      const num = ids.length / 4;
      ids.forEach((id, i) => {
        const row = Math.floor(i / num),
          g = String.fromCharCode(
            65 + (row % 2 ? num - 1 - (i % num) : i % num),
          );
        (this.groups[g] ??= []).push(id);
      });
      const groupRounds = Object.entries(this.groups).map(([g, list]) => ({
        g,
        rounds: circlePairs(list),
      }));
      for (let r = 0; r < 3; r++)
        this.addRound(
          "小组第 " + (r + 1) + " 轮",
          "group",
          groupRounds.flatMap((g) => g.rounds[r]),
          groupRounds.flatMap((g) => g.rounds[r].map(() => g.g)),
        );
    } else if (c.format === "knockout")
      this.addRound(
        ids.length + " 强赛",
        "knockout",
        Array.from({ length: ids.length / 2 }, (_, i) => [
          ids[i],
          ids[ids.length - 1 - i],
        ]),
      );
    else
      this.addRound(
        "瑞士第 1 轮",
        "swiss",
        Array.from({ length: ids.length / 2 }, (_, i) => [
          ids[i],
          ids[i + ids.length / 2],
        ]),
      );
  }
  applyFixtureResult(id, result) {
    const round = this.rounds.find((r) => r.fixtures.some((f) => f.id === id)),
      f = round?.fixtures.find((f) => f.id === id);
    if (!f) throw Error("UNKNOWN_FIXTURE");
    if (f.result) {
      if (canonicalHash(f.result) !== canonicalHash(result))
        throw Error("CONFLICTING_FIXTURE_RESULT");
      return false;
    }
    if (
      (result.winner !== null && !f.entrants.includes(result.winner)) ||
      f.entrants.some((id) => !Number.isFinite(result.aggregates?.[id]?.vp))
    )
      throw Error("INVALID_FIXTURE_RESULT");
    f.result = structuredClone(result);
    if (round.fixtures.every((f) => f.result)) {
      round.completed = true;
      this.scheduleFollowing(round);
    }
    this.status = this.rounds.every((r) => r.completed)
      ? "completed"
      : "running";
    return true;
  }
  scheduleFollowing(r) {
    const format = this.config.format;
    if (format === "swiss" && this.rounds.length < this.config.swissRounds) {
      const played = new Set(
        this.rounds.flatMap((r) =>
          r.fixtures.map((f) => [...f.entrants].sort().join(":")),
        ),
      );
      this.addRound(
        "瑞士第 " + (this.rounds.length + 1) + " 轮",
        "swiss",
        swissPairs(this.standings(), played),
      );
    }
    if (
      format === "group_knockout" &&
      r.phase === "group" &&
      this.rounds.filter((r) => r.phase === "group" && r.completed).length === 3
    ) {
      const qualifiers = Object.keys(this.groups)
        .sort()
        .map((g) => this.standings(g).slice(0, 2));
      const pairs = [];
      for (let i = 0; i < qualifiers.length; i += 2)
        pairs.push(
          [qualifiers[i][0].id, qualifiers[i + 1][1].id],
          [qualifiers[i + 1][0].id, qualifiers[i][1].id],
        );
      this.addRound("晋级淘汰", "knockout", pairs);
    }
    if (r.phase === "knockout") {
      const winners = r.fixtures.map((f) => f.result.winner);
      if (winners.length === 2) {
        this.addRound("决赛与季军赛", "final", [
          [...winners],
          r.fixtures.map((f) =>
            f.entrants.find((id) => id !== f.result.winner),
          ),
        ]);
        this.rounds.at(-1).fixtures[1].stage = "bronze";
      } else if (winners.length > 2)
        this.addRound(
          winners.length + " 强赛",
          "knockout",
          Array.from({ length: winners.length / 2 }, (_, i) => [
            winners[i * 2],
            winners[i * 2 + 1],
          ]),
        );
    }
  }
  nextJobs() {
    const r = this.rounds.find((r) => !r.completed);
    return r
      ? r.fixtures
          .filter((f) => !f.result)
          .flatMap((f) => fixtureJobs(f, this.config))
      : [];
  }
  standings(group) {
    return standingsFor(
      this.config,
      this.rounds,
      group ? this.groups[group] : undefined,
      group,
    );
  }
  champion() {
    if (this.status !== "completed" || this.config.format === "groups")
      return null;
    return ["knockout", "group_knockout"].includes(this.config.format)
      ? this.rounds.at(-1).fixtures[0].result.winner
      : this.standings()[0].id;
  }
  toJSON() {
    return structuredClone({
      schemaVersion: 3,
      config: this.config,
      rounds: this.rounds,
      status: this.status,
      groups: this.groups,
    });
  }
  static fromJSON(data) {
    if (data?.schemaVersion !== 3 || !Array.isArray(data.rounds) || !data.rounds.length)
      throw Error("INVALID_TOURNAMENT_SCHEMA");
    const t = new Tournament(data.config);
    for (let ri=0; ri<data.rounds.length; ri++) {
      const saved=data.rounds[ri], round=t.rounds[ri];
      if(!round||!Array.isArray(saved.fixtures)||saved.fixtures.length!==round.fixtures.length||
        typeof saved.completed!=="boolean") throw Error("INVALID_TOURNAMENT_STATE");
      for(let fi=0;fi<saved.fixtures.length;fi++){
        const f=saved.fixtures[fi], expected=round.fixtures[fi];
        if(typeof f.extraMap!=="boolean")throw Error("INVALID_TOURNAMENT_STATE");
        expected.extraMap=f.extraMap;
        const {result,...shape}=f;
        if(canonicalHash(shape)!==canonicalHash(Object.fromEntries(Object.entries(expected).filter(([k])=>k!=="result"))))throw Error("INVALID_TOURNAMENT_STATE");
        if(result) {
          if(t.rounds.find(r=>!r.completed)!==round)throw Error("INVALID_TOURNAMENT_ORDER");
          t.applyFixtureResult(f.id,result);
        }
      }
      if(saved.completed!==round.completed)throw Error("INVALID_TOURNAMENT_STATE");
    }
    if(canonicalHash(t.toJSON())!==canonicalHash(data))throw Error("INVALID_TOURNAMENT_STATE");
    return t;
  }
}
export const createTournament = (config) => new Tournament(config);
