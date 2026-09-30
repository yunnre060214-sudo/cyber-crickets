import test from "node:test";
import assert from "node:assert/strict";
test("legacy URLs select frozen classic rules while empty URLs select standard", async () => {
  const { decodeMatchQuery, encodeMatchQuery } =
    await import("../ui/router.js");
  assert.equal(
    decodeMatchQuery(
      "?seed=A&agents=aco,minimax,qlearn,voronoi&duration=120&rotation=1",
    ).configInput.mode,
    "classic",
  );
  assert.equal(decodeMatchQuery("").configInput.mode, "standard");
  const { createMatchConfig } = await import("../engine/config.js");
  const c = createMatchConfig({
    teamCount: 2,
    mode: "migration",
    mapPreset: "ring",
  });
  assert.deepEqual(
    createMatchConfig(decodeMatchQuery(encodeMatchQuery(c, 2)).configInput),
    c,
  );
});
test("edits change only next-match settings and explicit activation freezes config", async () => {
  const { ArenaStore } = await import("../ui/store.js");
  const s = new ArenaStore({ durationMs: 60000 });
  s.activate();
  s.edit({ durationMs: 180000, mapPreset: "canyon" });
  assert.equal(s.activeConfig.durationMs, 60000);
  assert.equal(s.nextConfig.durationMs, 180000);
  s.activate();
  assert.equal(s.activeConfig.mapPreset, "canyon");
  assert.ok(Object.isFrozen(s.activeConfig));
});
