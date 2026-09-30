import test from "node:test";
import assert from "node:assert/strict";
import { MemoryBackend } from "./support/memory-backend.js";
test("atomic tasks deduplicate and optimistic revisions cannot erase other writers", async () => {
  const { createRecordStore } = await import("../storage/records.js");
  const s = createRecordStore({ backend: new MemoryBackend() }),
    record = {
      id: "e",
      type: "experiment",
      schemaVersion: 3,
      index: {},
      payloadRefs: [],
    };
  await s.put(record, { expectedRevision: 0 });
  assert.equal(
    (await s.putTaskResult("e", "j", { winner: "p0" })).inserted,
    true,
  );
  assert.equal(
    (await s.putTaskResult("e", "j", { winner: "p0" })).inserted,
    false,
  );
  const r = await s.get("e");
  assert.equal(r.index.completedTasks, 1);
  const writes = await Promise.allSettled([
    s.put({ ...r, index: { value: "a" } }, { expectedRevision: r.revision }),
    s.put({ ...r, index: { value: "b" } }, { expectedRevision: r.revision }),
  ]);
  assert.equal(writes.filter((w) => w.status === "fulfilled").length, 1);
});
test("legacy migration retains original key on failure and remains idempotent", async () => {
  const { migrateLegacyTournaments } = await import("../storage/migrate.js");
  const { Tournament } = await import("../tournament.js"),
    { createRecordStore } = await import("../storage/records.js");
  const t = new Tournament({
      seed: "old",
      format: "round_robin",
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
    }),
    raw = JSON.stringify([t.toJSON()]),
    values = new Map([["cyber-crickets-tournaments-v1", raw]]),
    storage = {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    };
  await migrateLegacyTournaments(storage, {
    put: async () => {
      throw Error("QUOTA");
    },
  });
  assert.equal(storage.getItem("cyber-crickets-tournaments-v1"), raw);
  const s = createRecordStore({ backend: new MemoryBackend() });
  await migrateLegacyTournaments(storage, s);
  await migrateLegacyTournaments(storage, s);
  assert.equal((await s.list({ type: "competition" })).items.length, 1);
});
test("migration uses each original config identity and name", async () => {
  const { migrateLegacyTournaments } = await import("../storage/migrate.js"),
    { createRecordStore } = await import("../storage/records.js"),
    { Tournament } = await import("../tournament.js");
  const records = ["a", "b"].map((id) =>
      new Tournament({
        id,
        name: "Name " + id,
        seed: id,
        format: "round_robin",
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
      }).toJSON(),
    ),
    store = createRecordStore({ backend: new MemoryBackend() });
  await migrateLegacyTournaments(
    { getItem: () => JSON.stringify(records), setItem() {} },
    store,
  );
  assert.equal((await store.list({ type: "competition" })).items.length, 2);
  assert.equal((await store.get("legacy:a")).index.name, "Name a");
});
