import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../engine/factory.js";
import { testConfig } from "./support/factories.js";
test("replay seeks exact boards and scores without rerunning agents at every event boundary", async () => {
  const { buildReplayPackage } = await import("../replay/ledger.js"),
    { ReplayPlayer } = await import("../replay/player.js");
  for (const mode of ["standard", "migration", "classic"]) {
    const config = testConfig({ mode }),
      m = createMatch(config),
      snapshots = [m.getSnapshot()];
    while (!m.getSnapshot().finished) {
      m.advance(1);
      if (
        [3280, 3300, 6200, 8200, 9980, 10000].includes(
          m.getSnapshot().timeMs,
        ) ||
        m.getSnapshot().finished
      )
        snapshots.push(m.getSnapshot());
    }
    const pkg = buildReplayPackage({
        checkpoint: m.captureCheckpoint(),
        initialBoard: m.getInitialBoard(),
        ledger: m.readLedger().records,
        snapshot: m.getSnapshot(),
        boardCheckpoints: m.boardCheckpoints ?? [],
      }),
      p = new ReplayPlayer(pkg);
    for (const s of snapshots) {
      const r = p.seek(s.timeMs);
      for (const field of ["owner", "terrain", "resources", "core"])
        assert.deepEqual(r.board[field], s.board[field], mode + field);
      r.teams.forEach((t, i) =>
        assert.ok(Math.abs(t.score - s.teams[i].score) < 1e-9),
      );
    }
    for (const t of pkg.summary.teams)
      assert.ok(Math.abs(t.areaVP + t.resourceVP - t.score) < 1e-9);
    const frozen = structuredClone(pkg);
    p.seek(0);
    assert.deepEqual(pkg, frozen);
  }
});
test("checkpoint validates schema before integrity and board arrays are bounded", async () => {
  const { validateCheckpoint } = await import("../replay/checkpoint.js"),
    { decodeBoard, encodeBoard } = await import("../replay/codec.js");
  const m = createMatch(testConfig()),
    cp = m.captureCheckpoint();
  assert.throws(
    () => validateCheckpoint({ ...cp, schemaVersion: 999 }),
    /UNSUPPORTED_SCHEMA/,
  );
  const b = encodeBoard(m.getInitialBoard());
  b.owner.data.pop();
  assert.throws(() => decodeBoard(b), /INVALID_BOARD/);
});
