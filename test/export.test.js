import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { Match } from "../match.js";
import { buildMarkdownLog } from "../export/markdown.js";

function decision(
  seq,
  time,
  teamId,
  success,
  { enemy = false, resource = 0, target = 65 } = {},
) {
  return {
    seq,
    time,
    teamId,
    strategy: teamId ? "dfs" : "bfs",
    score: 0,
    vpRate: 1,
    rank: 1,
    scoreGap: 0,
    share: 0.1,
    resourceShare: 0.1,
    localPressure: 0.25,
    optionCount: 8,
    thought: "选择资源目标",
    from: { index: 64, x: 0, y: 1 },
    to: { index: target, x: target % 64, y: Math.floor(target / 64) },
    target: {
      owner: enemy ? 1 - teamId : -1,
      enemy,
      terrain: 1,
      resource,
      ownNeighbors: 2,
      enemyNeighbors: 1,
      distOwnCore: 3,
      distRivalCore: 30,
      nearestResourceDist: 0,
      resourcePull: 12,
      enemyPressure: 0.25,
    },
    thinkMs: 0.2,
    result:
      success === null
        ? null
        : {
            success,
            previousOwner: enemy ? 1 - teamId : -1,
            reward: success ? 5 : -0.15,
          },
  };
}

function fixture() {
  const match = new Match({
    seed: "export-fixture",
    duration: 100,
    strategies: ["bfs", "dfs"],
  });
  match.time = 100;
  match.finished = true;
  match.resourceTotal = 10;
  Object.assign(match.teams[0], {
    score: 80,
    territory: 50,
    resources: 5,
    captures: 1,
  });
  Object.assign(match.teams[1], {
    score: 90,
    territory: 40,
    resources: 4,
    captures: 0,
  });
  match.timeline = [
    {
      time: 0,
      resourceTotal: 10,
      teams: [
        { id: 0, score: 0, territory: 10, resources: 1, captures: 0 },
        { id: 1, score: 0, territory: 10, resources: 1, captures: 0 },
      ],
    },
    {
      time: 10,
      resourceTotal: 10,
      teams: [
        { id: 0, score: 8, territory: 30, resources: 3, captures: 0 },
        { id: 1, score: 10, territory: 20, resources: 2, captures: 0 },
      ],
    },
    {
      time: 100,
      resourceTotal: 10,
      teams: [
        { id: 0, score: 80, territory: 50, resources: 5, captures: 1 },
        { id: 1, score: 90, territory: 40, resources: 4, captures: 0 },
      ],
    },
  ];
  match.eventLog = [
    { time: 33, type: "major", banner: "资源潮汐", message: "新增资源" },
    {
      time: 62,
      type: "major",
      banner: "核心节点上线",
      message: "中央资源增加",
    },
    { time: 82, type: "major", banner: "终局超频", message: "成功率提升" },
  ];
  match.decisionLog = [
    decision(1, 1, 0, true, { resource: 1 }),
    decision(2, 2, 1, false, { enemy: true }),
    decision(3, 2, 0, false, { resource: 1 }),
    decision(4, 3, 1, true),
    decision(5, 3, 0, false, { resource: 1 }),
    decision(7, 4, 0, false, { resource: 1 }),
    decision(9, 34, 0, true, { enemy: true, resource: 3 }),
    decision(11, 90, 0, true),
    decision(13, 95, 0, null),
  ];
  return match;
}

const context = (match) => ({ match, running: false, speedValue: 20 });
const modelModule = () => import("../export/model.js");
const htmlModule = () => import("../export/html.js");
const downloadModule = () => import("../export/download.js");

test("Markdown exports are summaries, so thousands of decisions cannot grow into a multi-megabyte document", () => {
  const match = fixture();
  match.decisionLog = Array.from({ length: 16000 }, (_, index) =>
    decision(index + 1, index / 160, index % 2, true),
  );
  const md = buildMarkdownLog(context(match));
  assert.ok(
    Buffer.byteLength(md) < 60000,
    "the default Markdown must remain compact",
  );
  assert.doesNotMatch(md, /### D\d{5}/);
  assert.match(md, /16000/);
  assert.match(md, /90\.00/);
});

test("summary statistics count only settled actions and keep resource grabs separate from resource ownership", async () => {
  const { buildReportModel } = await modelModule();
  const match = fixture(),
    before = JSON.stringify(match.decisionLog);
  const report = buildReportModel(context(match));
  const stats = report.teams.find((team) => team.id === 0).actions;
  assert.deepEqual(
    {
      total: stats.total,
      settled: stats.settled,
      successes: stats.successes,
      failures: stats.failures,
      pending: stats.pending,
      successRate: stats.successRate,
      expansions: stats.expansions,
      captures: stats.captures,
      resourceAttempts: stats.resourceAttempts,
      resourceWins: stats.resourceWins,
      longestFailedTargetRun: stats.longestFailedTargetRun,
    },
    {
      total: 7,
      settled: 6,
      successes: 3,
      failures: 3,
      pending: 1,
      successRate: 0.5,
      expansions: 2,
      captures: 1,
      resourceAttempts: 5,
      resourceWins: 2,
      longestFailedTargetRun: 3,
    },
  );
  assert.equal(
    JSON.stringify(match.decisionLog),
    before,
    "building a report must not change the simulation",
  );
  assert.deepEqual(
    report.phases.map(
      (phase) => phase.teams.find((team) => team.id === 0).actions.total,
    ),
    [4, 1, 0, 2],
  );
});

test("control averages are weighted by elapsed time rather than the number of snapshots", async () => {
  const { buildReportModel } = await modelModule();
  const team = buildReportModel(context(fixture())).teams.find(
    (team) => team.id === 0,
  );
  assert.ok(Math.abs(team.averageTerritory - 38) < 1e-9);
  assert.ok(Math.abs(team.averageResourceShare - 0.38) < 1e-9);
});

test("a paused export includes the current state and does not label the current leader as the winner", async () => {
  const { buildReportModel } = await modelModule();
  const match = fixture();
  match.finished = false;
  match.time = 11.5;
  match.timeline.length = 2;
  match.decisionLog = match.decisionLog.filter((row) => row.time <= match.time);
  match.eventLog = [];
  const report = buildReportModel(context(match));
  assert.equal(report.status, "已暂停");
  assert.equal(report.outcomeLabel, "当前领先");
  assert.equal(report.timeline.at(-1).time, 11.5);
  assert.equal(
    report.timeline.at(-1).teams.find((team) => team.id === 1).score,
    90,
  );
  assert.equal(
    match.timeline.at(-1).time,
    10,
    "the additional report point belongs only to the export",
  );
});

test("the first actions after a global event belong to the new phase even when paused on that exact tick", async () => {
  const { buildReportModel } = await modelModule();
  const match = new Match({
    seed: "export-event-boundary",
    duration: 100,
    strategies: ["bfs", "dfs"],
  });
  while (!match.eventLog.length) match.step(0.035);
  const eventTime = match.eventLog[0].time;
  assert.equal(match.time, eventTime);
  assert.ok(match.decisionLog.some((row) => row.time === eventTime));
  const report = buildReportModel(context(match));
  assert.deepEqual(
    report.phases.map((phase) => phase.name),
    ["开局扩张", "资源潮汐"],
  );
  for (const team of match.teams) {
    const count = (phase) =>
      phase.teams.find((item) => item.id === team.id).actions.total;
    const records = match.decisionLog.filter((row) => row.teamId === team.id);
    assert.equal(
      count(report.phases[0]),
      records.filter((row) => row.time < eventTime).length,
    );
    assert.equal(
      count(report.phases[1]),
      records.filter((row) => row.time >= eventTime).length,
    );
  }
});

test("leader changes ignore the initial zero-score tie and count only changes in the unique leader", async () => {
  const { buildReportModel } = await modelModule();
  const match = fixture();
  const point = (time, a, b) => ({
    time,
    resourceTotal: 10,
    teams: [
      { id: 0, score: a, territory: 10, resources: 1 },
      { id: 1, score: b, territory: 10, resources: 1 },
    ],
  });
  match.timeline = [
    point(0, 0, 0),
    point(10, 8, 10),
    point(50, 40, 30),
    point(80, 70, 70),
    point(100, 80, 90),
  ];
  const report = buildReportModel(context(match));
  assert.equal(report.leadChanges.total, 2);
  assert.deepEqual(
    report.leadChanges.events.map((event) => [
      event.time,
      event.from,
      event.to,
    ]),
    [
      [50, 1, 0],
      [100, 0, 1],
    ],
  );
});

test("a tied finished match is reported as a tie, including shared ranks", async () => {
  const { buildReportModel } = await modelModule();
  const match = fixture();
  match.teams[0].score = 90;
  const report = buildReportModel(context(match));
  assert.equal(report.outcomeLabel, "并列第一");
  assert.deepEqual(
    report.teams.map((team) => team.rank),
    [1, 1],
  );
});

test("HTML is a self-contained report and untrusted seed or thought text cannot create executable markup", async () => {
  const { buildHtmlReport } = await htmlModule();
  const match = fixture();
  match.seed = '<img src="https://invalid.example/x" onerror="alert(1)">';
  match.decisionLog[0].thought = "</details><script>alert(1)</script>";
  const html = buildHtmlReport(context(match));
  assert.match(html, /<svg[\s>]/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.doesNotMatch(html, /<script[\s>]|<link[\s>]|<img[\s>]|<iframe[\s>]/i);
  assert.doesNotMatch(html, /\b(?:src|href)="https?:/i);
  assert.match(html, /90\.00/);
});

test("full data decompresses with every original decision and snapshot intact", async () => {
  const { createMatchExport } = await downloadModule();
  const match = fixture();
  const file = await createMatchExport(context(match), "data");
  assert.ok(file.filename.endsWith(".json.gz"));
  const data = JSON.parse(
    gunzipSync(Buffer.from(await file.blob.arrayBuffer())).toString(),
  );
  assert.equal(data.format, "cyber-crickets.match-log");
  assert.deepEqual(
    data.decisions,
    JSON.parse(JSON.stringify(match.decisionLog)),
  );
  assert.deepEqual(data.timeline, JSON.parse(JSON.stringify(match.timeline)));
  assert.equal(data.snapshot.teams[1].score, 90);
  assert.deepEqual(data.snapshot.map.owner, Array.from(match.owner));
  assert.equal(data.metadata.seed, "export-fixture");
});

test("a running match cannot change an export while compression is pending", async () => {
  const { createMatchExport } = await downloadModule();
  const match = fixture();
  match.finished = false;
  const expected = JSON.parse(
    JSON.stringify({
      decisions: match.decisionLog,
      timeline: match.timeline,
      owner: Array.from(match.owner),
      score: match.teams[0].score,
    }),
  );
  const pending = createMatchExport(
    { ...context(match), running: true },
    "data",
  );
  match.time = 101;
  match.teams[0].score = 999;
  match.owner[0] = 1;
  match.decisionLog[0].thought = "a later decision changed this object";
  match.decisionLog.push(decision(14, 101, 0, true));
  match.timeline.push({ time: 101, teams: [] });
  const file = await pending;
  const data = JSON.parse(
    gunzipSync(Buffer.from(await file.blob.arrayBuffer())).toString(),
  );
  assert.match(file.filename, /_100s_data\.json\.gz$/);
  assert.equal(data.metadata.time, 100);
  assert.equal(data.metadata.running, true);
  assert.equal(data.snapshot.teams[0].score, expected.score);
  assert.deepEqual(data.snapshot.map.owner, expected.owner);
  assert.deepEqual(data.decisions, expected.decisions);
  assert.deepEqual(data.timeline, expected.timeline);
});

test("full-data export falls back to ordinary JSON if gzip is unavailable", async () => {
  const { createMatchExport } = await downloadModule();
  const old = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  try {
    const file = await createMatchExport(context(fixture()), "data");
    assert.ok(file.filename.endsWith(".json"));
    assert.equal(JSON.parse(await file.blob.text()).decisions.length, 9);
  } finally {
    globalThis.CompressionStream = old;
  }
});

test("a gzip implementation that throws still downloads every record as JSON", async () => {
  const { createMatchExport } = await downloadModule();
  const old = globalThis.CompressionStream;
  globalThis.CompressionStream = class {
    constructor() {
      throw new Error("gzip unsupported");
    }
  };
  try {
    const match = fixture();
    const file = await createMatchExport(context(match), "data");
    assert.ok(file.filename.endsWith(".json"));
    assert.equal(file.compressed, false);
    const data = JSON.parse(await file.blob.text());
    assert.deepEqual(data.decisions, match.decisionLog);
    assert.deepEqual(data.events, match.eventLog);
  } finally {
    globalThis.CompressionStream = old;
  }
});

test("an unstarted match exports without fabricated results or invalid graph numbers", async () => {
  const { buildHtmlReport } = await htmlModule();
  const match = new Match({
    seed: "not-started",
    duration: 90,
    strategies: ["strongest", "potential", "mst", "denial"],
  });
  const html = buildHtmlReport(context(match));
  assert.match(html, /尚未开始/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
