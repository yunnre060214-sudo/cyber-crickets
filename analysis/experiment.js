import { createMatchConfig } from "../engine/config.js";
import { canonicalHash } from "../engine/hash.js";
import { mean, bootstrapInterval } from "./statistics.js";
import { calculateElo } from "./rating.js";
export function planExperiment(input) {
  const c = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? "策略实验",
    mode: input.mode ?? "standard",
    budgetProfile: input.budgetProfile ?? "standard",
  };
  if (
    ![2, 4].includes(c.teamCount) ||
    !Array.isArray(c.seedList) ||
    !c.seedList.length ||
    c.seedList.length > 64 ||
    new Set(c.seedList).size !== c.seedList.length ||
    !c.rosters?.length ||
    c.rosters.length > 32 ||
    !c.mapPresets?.length ||
    !c.durationsMs?.length ||
    c.durationsMs.length > 16
  )
    throw Error("INVALID_EXPERIMENT_CONFIG");
  const orderedTasks = [],
    seedGroups = [],
    identity = canonicalHash({ ...c, id: "", name: "" });
  for (const [seedIndex, seed] of c.seedList.entries())
    for (const mapPreset of c.mapPresets)
      for (const durationMs of c.durationsMs)
        for (const [rosterIndex, entrants] of c.rosters.entries()) {
          const groupId =
              identity +
              "/seed" +
              seedIndex +
              "/" +
              mapPreset +
              "/" +
              durationMs +
              "/roster" +
              rosterIndex,
            jobIds = [];
          for (let rotation = 0; rotation < c.teamCount; rotation++) {
            const config = createMatchConfig({
              seed: String(seed) + "|map:" + mapPreset,
              mode: c.mode,
              mapPreset,
              teamCount: c.teamCount,
              durationMs,
              rotation: c.teamCount === 2 ? 0 : rotation,
              budgetProfile: c.budgetProfile,
              entrants:
                c.teamCount === 2 && rotation
                  ? [...entrants].reverse()
                  : entrants,
            });
            const jobId = groupId + "/seat" + rotation;
            orderedTasks.push({
              jobId,
              kind: "experiment-match",
              status: "pending",
              config,
              seedIndex,
              groupId,
              mapPreset,
              durationMs,
              rosterIndex,
              rotation,
            });
            jobIds.push(jobId);
          }
          seedGroups.push({
            groupId,
            seedIndex,
            seed,
            mapPreset,
            durationMs,
            rosterIndex,
            jobIds,
          });
        }
  if (orderedTasks.length > 32768) throw Error("EXPERIMENT_TOO_LARGE");
  return { config: structuredClone(c), orderedTasks, seedGroups };
}
export function aggregateExperiment(results, config) {
  const plan = planExperiment(config),
    expected = new Map(plan.orderedTasks.map((j) => [j.jobId, j])),
    byId = new Map();
  for (const item of results) {
    const j = expected.get(item.jobId);
    if (!j) throw Error("UNKNOWN_EXPERIMENT_JOB");
    if (canonicalHash(item.result.config) !== canonicalHash(j.config))
      throw Error("MIXED_EXPERIMENT_RULES");
    byId.set(item.jobId, item.result);
  }
  const completedGroups = plan.seedGroups.filter((g) =>
      g.jobIds.every((id) => byId.has(id)),
    ),
    rows = new Map(),
    paired = [];
  for (const g of completedGroups) {
    const legs = g.jobIds.map((id) => byId.get(id)),
      teamRows = new Map();
    for (const r of legs) {
      const top = Math.max(...r.teams.map((t) => t.score));
      for (const t of r.teams) {
        const key =
            t.participantId + "/" + t.strategyId + "/" + t.strategyVersion,
          a = teamRows.get(key) ?? {
            participantId: t.participantId,
            strategyId: t.strategyId,
            strategyVersion: t.strategyVersion,
            wins: [],
            ranks: [],
            vp: [],
            margin: [],
            budget: [],
            thinkMs: [],
          };
        a.wins.push(
          t.score === top
            ? 1 / r.teams.filter((x) => Math.abs(x.score - top) < 1e-9).length
            : 0,
        );
        a.ranks.push(
          1 + r.teams.filter((x) => x.score > t.score + 1e-9).length,
        );
        a.vp.push(t.score);
        a.margin.push(
          t.score -
            Math.max(
              ...r.teams
                .filter((x) => x.participantId !== t.participantId)
                .map((x) => x.score),
            ),
        );
        a.budget.push(t.meanBudgetUsed ?? t.budgetUsed ?? 0);
        if (Number.isFinite(t.meanThinkMs)) a.thinkMs.push(t.meanThinkMs);
        teamRows.set(key, a);
      }
    }
    for (const [key, t] of teamRows) {
      const row = rows.get(key) ?? {
        participantId: t.participantId,
        strategyId: t.strategyId,
        strategyVersion: t.strategyVersion,
        samples: [],
        bySeed: new Map(),
      };
      const sample = {
        seedIndex: g.seedIndex,
        mapPreset: g.mapPreset,
        durationMs: g.durationMs,
        rosterIndex: g.rosterIndex,
        winRate: mean(t.wins),
        meanRank: mean(t.ranks),
        meanVP: mean(t.vp),
        meanMargin: mean(t.margin),
        meanBudget: mean(t.budget),
        meanThinkMs: t.thinkMs.length ? mean(t.thinkMs) : null,
      };
      row.samples.push(sample);
      (
        row.bySeed.get(g.seedIndex) ??
        row.bySeed.set(g.seedIndex, []).get(g.seedIndex)
      ).push(sample.winRate);
      rows.set(key, row);
    }
    if (config.teamCount === 2) {
      const totals = new Map();
      for (const r of legs)
        for (const t of r.teams)
          totals.set(
            t.strategyId + "@" + t.strategyVersion,
            (totals.get(t.strategyId + "@" + t.strategyVersion) ?? 0) + t.score,
          );
      if (totals.size === 2) {
        const [a, b] = [...totals.keys()].sort(),
          x = totals.get(a),
          y = totals.get(b);
        paired.push({
          pairId: g.groupId,
          a,
          b,
          score: Math.abs(x - y) < 1e-9 ? 0.5 : x > y ? 1 : 0,
        });
      }
    }
  }
  const teams = [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, r]) => {
      const seedValues = [...r.bySeed.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, v]) => mean(v));
      return {
        participantId: r.participantId,
        strategyId: r.strategyId,
        strategyVersion: r.strategyVersion,
        independentSeeds: seedValues.length,
        winRate: mean(seedValues),
        meanRank: mean(r.samples.map((s) => s.meanRank)),
        meanVP: mean(r.samples.map((s) => s.meanVP)),
        meanMargin: mean(r.samples.map((s) => s.meanMargin)),
        meanBudget: mean(r.samples.map((s) => s.meanBudget)),
        meanThinkMs: r.samples.some((s) => s.meanThinkMs !== null)
          ? mean(
              r.samples
                .filter((s) => s.meanThinkMs !== null)
                .map((s) => s.meanThinkMs),
            )
          : null,
        interval: bootstrapInterval(seedValues, {
          seed: canonicalHash(config) + key,
        }),
        facets: r.samples,
      };
    });
  return {
    completedMatches: byId.size,
    totalMatches: plan.orderedTasks.length,
    completedSeedGroups: completedGroups.length,
    independentSeeds: new Set(completedGroups.map((g) => g.seedIndex)).size,
    teams,
    elo: config.teamCount === 2 ? calculateElo(paired) : null,
    eloScope: canonicalHash({
      mode: config.mode,
      budget: config.budgetProfile,
      maps: config.mapPresets,
      durations: config.durationsMs,
      versions: "2.0.0",
    }),
    pairedSamples: paired.length,
  };
}
