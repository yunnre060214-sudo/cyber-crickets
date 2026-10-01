import test from "node:test";
import assert from "node:assert/strict";
import { Tournament } from "../competition/tournament.js";
import { ClassicTournamentAdapter } from "../competition/legacy.js";
import { Tournament as OldTournament } from "../legacy/v1/tournament.js";
import { aggregateFixture } from "../competition/fixture.js";
import { createMatch } from "../engine/factory.js";
import { canonicalHash, encode, seal, verify } from "../engine/hash.js";
import { createCompetitionController } from "../runtime/competition-jobs.js";
import { createRecordStore } from "../storage/records.js";
import { createJobExport } from "../export/jobs.js";
import { importPackage } from "../export/import.js";
import { MemoryBackend } from "./support/memory-backend.js";
import { testTournamentConfig } from "./support/factories.js";

const store = () => createRecordStore({ backend: new MemoryBackend() });
const file = (pkg) =>
  new File([JSON.stringify(encode(pkg))], "competition.json");
const reseal = ({ integrityHash, ...body }) => seal(body);
function leg(f, vp, captures, territory) {
  return {
    teams: f.entrants.map((participantId, i) => ({
      participantId,
      score: vp[i],
      captures: captures[i],
      territory: territory[i],
    })),
  };
}

for (const { reason, format, vp, captures, territory } of [
  {
    reason: "vp",
    format: "knockout",
    vp: [12, 10],
    captures: [1, 9],
    territory: [1, 9],
  },
  {
    reason: "captures",
    format: "knockout",
    vp: [10, 10],
    captures: [3, 2],
    territory: [1, 9],
  },
  {
    reason: "territory",
    format: "knockout",
    vp: [10, 10],
    captures: [2, 2],
    territory: [4, 3],
  },
  {
    reason: "seed",
    format: "knockout",
    vp: [10, 10],
    captures: [2, 2],
    territory: [3, 3],
  },
  {
    reason: "draw",
    format: "round_robin",
    vp: [10, 10],
    captures: [3, 2],
    territory: [4, 3],
  },
])
  test(`saved fixtures explain ${reason} and restore the same winner`, () => {
    const t = new Tournament(testTournamentConfig({ format })),
      f = t.rounds[0].fixtures[0];
    f.extraMap = format === "knockout";
    const result = aggregateFixture(f, [leg(f, vp, captures, territory)]);
    t.applyFixtureResult(f.id, result);
    const state = t.toJSON();
    assert.deepEqual(state.fixtureReasons, { [f.id]: reason });
    const restored = Tournament.fromJSON(state);
    assert.deepEqual(restored.rounds[0].fixtures[0].result, result);
    assert.deepEqual(restored.toJSON().fixtureReasons, state.fixtureReasons);
  });

test("VP within the existing epsilon uses the next tiebreak criterion", () => {
  const t = new Tournament(testTournamentConfig({ format: "knockout" })),
    f = t.rounds[0].fixtures[0];
  f.extraMap = true;
  t.applyFixtureResult(
    f.id,
    aggregateFixture(f, [leg(f, [10 + 5e-10, 10], [1, 2], [9, 1])]),
  );
  assert.equal(f.result.winner, f.entrants[1]);
  assert.equal(t.toJSON().fixtureReasons?.[f.id], "captures");
});

test("pending extra maps have no saved winner reason and older snapshots gain explanations", () => {
  const t = new Tournament(testTournamentConfig({ format: "knockout" })),
    f = t.rounds[0].fixtures[0];
  assert.equal(
    aggregateFixture(f, [leg(f, [10, 10], [1, 2], [1, 2])]).needsExtraMap,
    true,
  );
  f.extraMap = true;
  assert.deepEqual(t.toJSON().fixtureReasons, {});
  t.applyFixtureResult(
    f.id,
    aggregateFixture(f, [leg(f, [12, 10], [1, 2], [1, 2])]),
  );
  const old = t.toJSON();
  delete old.fixtureReasons;
  const restored = Tournament.fromJSON(old);
  assert.equal(restored.toJSON().fixtureReasons?.[f.id], "vp");
  assert.deepEqual(restored.rounds, t.rounds);
});

test("saved reasons cannot contradict fixtures or refer to pending or unknown fixtures", () => {
  const t = new Tournament(testTournamentConfig()),
    f = t.rounds[0].fixtures[0];
  t.applyFixtureResult(
    f.id,
    aggregateFixture(f, [leg(f, [12, 10], [1, 2], [1, 2])]),
  );
  for (const fixtureReasons of [
    { [f.id]: "seed" },
    {},
    { [f.id]: "vp", unknown: "vp" },
    { [f.id]: "vp", [t.rounds[0].fixtures[1].id]: "vp" },
    null,
    ["vp"],
  ])
    assert.throws(
      () => Tournament.fromJSON({ ...t.toJSON(), fixtureReasons }),
      /FIXTURE_REASON_MISMATCH/,
    );
});

test("classic explanations stay outside the frozen v1 snapshot", () => {
  const raw = new OldTournament({
    id: "reason-classic",
    seed: "reason-classic",
    format: "knockout",
    duration: 10,
    entrants: [
      "bfs",
      "dfs",
      "greedy",
      "random",
      "aco",
      "voronoi",
      "potential",
      "pid",
    ],
  });
  const t = new ClassicTournamentAdapter(raw.toJSON()),
    f = t.rounds[0].fixtures[0];
  const result = t.aggregate(f, [
    leg(f, [10, 10], [3, 2], [1, 9]),
    leg(
      { ...f, entrants: [...f.entrants].reverse() },
      [10, 10],
      [2, 3],
      [9, 1],
    ),
  ]);
  t.applyFixtureResult(f.id, result);
  raw.rounds[0].fixtures[0].result = structuredClone(result);
  assert.deepEqual(t.toJSON().rawLegacy, raw.toJSON());
  assert.deepEqual(t.toJSON().fixtureReasons, { [f.id]: "captures" });
});

async function playedFixture() {
  const s = store(),
    jobs = [],
    queue = { enqueue: (list) => jobs.push(...list), resume() {}, pause() {} };
  const c = createCompetitionController({ store: s, queue });
  const id = await c.create(testTournamentConfig());
  await c.run(id);
  const fixtureId = jobs[0].fixtureId;
  for (const job of jobs.filter((j) => j.fixtureId === fixtureId)) {
    const m = createMatch(job.config);
    m.advance(500);
    await queue.onResult(job, m.getResult());
  }
  return { s, id, fixtureId };
}

test("opening a saved tournament retains actual leg replay references without rerunning", async () => {
  const { s, id } = await playedFixture();
  const saved = await createCompetitionController({ store: s }).load(id);
  assert.equal(saved.results?.length, 2);
  assert.equal(new Set(saved.results.map((r) => r.jobId)).size, 2);
  for (const item of saved.results) {
    const replay = await s.getPackage(item.result.replayId);
    assert.equal(replay.summary.finished, true);
    assert.equal(replay.summary.timeMs, 10000);
  }
});

test("controller saves actual reasons and all exports explain older records", async () => {
  const { s, id, fixtureId } = await playedFixture();
  const record = await s.get(id);
  assert.equal(record.state.fixtureReasons?.[fixtureId], "vp");
  delete record.state.fixtureReasons;
  await s.put(record, { expectedRevision: record.revision });
  for (const format of ["markdown", "html"]) {
    const text = await (await createJobExport(id, s, format)).blob.text();
    assert.match(text, /决胜依据/);
    assert.match(text, /累计 VP 更高/);
    assert.match(text, /r0f0/);
  }
  const output = await createJobExport(id, s);
  const imported = await importPackage(
    new File([output.blob], output.filename),
  );
  assert.equal(imported.package.state.fixtureReasons?.[fixtureId], "vp");
  const restored = await createCompetitionController({ store: s }).load(id);
  assert.equal(restored.record.state.fixtureReasons?.[fixtureId], "vp");
});

test("old imports persist normalized reasons with valid integrity and stable duplicate identity", async () => {
  const { s, id, fixtureId } = await playedFixture();
  const output = await createJobExport(id, s);
  const original = (
    await importPackage(new File([output.blob], output.filename))
  ).package;
  delete original.state.fixtureReasons;
  const old = reseal(original),
    target = store();
  const first = await importPackage(file(old), { store: target });
  assert.equal(first.id, "import:" + canonicalHash(old));
  assert.equal(first.package.state.fixtureReasons?.[fixtureId], "vp");
  verify(first.package);
  assert.equal(
    (await target.get(first.id)).state.fixtureReasons?.[fixtureId],
    "vp",
  );
  verify(await target.getPackage(first.id));
  const again = await importPackage(file(old), { store: target });
  assert.equal(again.id, first.id);
  assert.equal((await target.list({ type: "competition" })).items.length, 1);
  for (const fixtureReasons of [
    { [fixtureId]: "seed" },
    { [fixtureId]: "unknown" },
  ]) {
    const invalid = store();
    await assert.rejects(
      () =>
        importPackage(
          file(reseal({ ...old, state: { ...old.state, fixtureReasons } })),
          { store: invalid },
        ),
      /FIXTURE_REASON_MISMATCH/,
    );
    assert.equal((await invalid.list()).items.length, 0);
  }
});
