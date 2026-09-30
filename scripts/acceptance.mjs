import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMatch } from "../engine/factory.js";
import { createMatchConfig } from "../engine/config.js";
import { buildSite } from "./build.mjs";
const strategies = ["strongest", "pathfinder", "boundary", "ucb"];
export function createAcceptanceMatrix(seeds) {
  if (seeds.length !== 8 || new Set(seeds).size !== 8)
    throw Error("EIGHT_INDEPENDENT_SEEDS_REQUIRED");
  const jobs = [];
  const add = (category, seed, mapPreset, durationMs, rotation, roster) =>
    jobs.push({
      id: category + "/" + jobs.length,
      category,
      config: createMatchConfig({
        seed,
        mapPreset,
        mode: "standard",
        durationMs,
        rotation,
        teamCount: roster.length,
        budgetProfile: "standard",
        entrants: roster.map((strategyId, i) => ({
          participantId:
            category === "duel" ? "entrant-" + strategyId : "p" + i,
          strategyId,
        })),
      }),
    });
  for (const seed of seeds)
    for (const map of ["plain", "basin", "canyon", "ring"])
      for (let rotation = 0; rotation < 4; rotation++)
        add("holdout", seed, map, 60000, rotation, strategies);
  for (const duration of [180000, 400000])
    for (let rotation = 0; rotation < 4; rotation++)
      add(
        "long",
        "long-" + seeds[0] + "-" + duration,
        "plain",
        duration,
        rotation,
        strategies,
      );
  for (const strategy of strategies.slice(1))
    for (const seed of seeds.slice(0, 2))
      for (const reverse of [false, true])
        add(
          "duel",
          "duel-" + seed,
          "plain",
          60000,
          0,
          reverse ? ["strongest", strategy] : [strategy, "strongest"],
        );
  return jobs;
}
export async function runAcceptance() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    out = path.join(root, "docs/benchmarks");
  await mkdir(out, { recursive: true });
  const manifest = await buildSite({
    sourceRoot: root,
    outDir: path.join(root, "dist"),
    commitSha: process.env.GITHUB_SHA ?? "local-validation",
    version: "2.0.0",
  });
  const seeds = Array.from(
    { length: 8 },
    () => "v2-holdout-" + randomBytes(8).toString("hex"),
  );
  const report = {
    productVersion: "2.0.0",
    engineVersion: "2.0.0",
    ruleVersion: "v2-standard",
    buildHash: manifest.buildHash,
    sourceHash: manifest.sourceHash,
    sourceFiles: manifest.files,
    startedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
      memoryBytes: os.totalmem(),
    },
    seedList: seeds,
    method:
      "Seeds generated after source freeze; no parameter tuning using these results. Wall-clock measurements are local observations, not gameplay inputs.",
    games: [],
    failures: [],
  };
  for (const job of createAcceptanceMatrix(seeds)) {
    const start = performance.now();
    try {
      const match = createMatch(job.config);
      while (!match.getSnapshot().finished) match.advance(250);
      const result = match.getResult();
      for (const t of result.teams) {
        const total = result.ledger.reduce((n, r) => {
          const d = r.scoreDeltas.find(
            (d) => d.participantId === t.participantId,
          );
          return n + d.areaVP + d.resourceVP;
        }, 0);
        if (Math.abs(total - t.score) > 1e-7) throw Error("VP_LEDGER_MISMATCH");
      }
      const canonicalJSON = JSON.stringify({
        ...result,
        teams: result.teams.map(({ thinkMs, ...t }) => t),
      });
      const ordered = [...result.teams].sort((a, b) => b.score - a.score),
        top = ordered[0].score;
      report.games.push({
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
      });
    } catch (e) {
      report.failures.push({
        id: job.id,
        config: job.config,
        error: e.stack ?? e.message,
      });
    }
    await writeFile(
      path.join(out, "v2-acceptance.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `${report.games.length + report.failures.length}/148 ${job.id} ${Math.round(performance.now() - start)}ms`,
    );
  }
  report.finishedAt = new Date().toISOString();
  report.passed = report.games.length === 148 && report.failures.length === 0;
  await writeFile(
    path.join(out, "v2-acceptance.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const holdouts = report.games.filter((g) => g.category === "holdout"),
    wins = Object.fromEntries(
      strategies.map((s) => [
        s,
        holdouts.filter((g) => g.winners.includes(s)).length,
      ]),
    );
  const text = [
    "# Cyber Crickets 2.0 实测验收",
    "",
    `时间：${report.finishedAt}。完成 ${report.games.length}/148，执行错误 ${report.failures.length}。`,
    `源码 SHA256：${report.sourceHash}；构建目录：${report.buildHash}。`,
    `环境：${report.environment.node} / ${report.environment.platform} / ${report.environment.cpu}。`,
    "",
    "固定矩阵：8 个独立种子 × 4 地图 × 4 出生位 × 60 秒，另有 180/400 秒各 4 局，三个新策略对 strongest 各 2 种子换边共 12 局。种子在源码冻结后生成，本次没有按结果调参。",
    "",
    `128 局四方第一名次数（同分分别计入）：${Object.entries(wins)
      .map(([s, n]) => s + " " + n)
      .join("，")}。`,
    "",
    "这不是样本外必胜或相对 1.0 提升百分比的证据；地图与策略组合限定了适用范围。播放速度与机器耗时不进入结果。完整配置、得分、败局、哈希和每局实测时间见 JSON。",
    "",
    "## 逐局结果",
    "",
    "| 局 | 地图 | 时长 | 轮换 | 第一名 | 各方 VP |",
    "|---|---|---:|---:|---|---|",
    ...report.games.map(
      (g) =>
        `| ${g.id} | ${g.config.mapPreset} | ${g.config.durationMs / 1000} | ${g.config.rotation} | ${g.winners.join("/")} | ${g.teams.map((t) => t.strategyId + " " + t.score.toFixed(3)).join(" / ")} |`,
    ),
    "",
    "## 执行错误",
    "",
    report.failures.length
      ? report.failures.map((f) => f.id + " " + f.error).join("\n")
      : "无。",
    "",
  ];
  await writeFile(path.join(out, "v2-acceptance.md"), text.join("\n"));
  if (!report.passed) process.exitCode = 1;
  return report;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runAcceptance();
