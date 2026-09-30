import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../engine/factory.js";
import { testConfig } from "./support/factories.js";
import { encode } from "../engine/hash.js";
import { buildReplayPackage } from "../replay/ledger.js";
const capture = (m) => ({
  checkpoint: m.captureCheckpoint(),
  initialBoard: m.getInitialBoard(),
  ledger: m.readLedger().records,
  snapshot: m.getSnapshot(),
  boardCheckpoints: m.boardCheckpoints,
});
test("export freezes one capture and HTML is offline and escapes seed text", async () => {
  const { createMatchExport } = await import("../ui/export.js");
  const m = createMatch(testConfig({ seed: "<img src=x onerror=alert(1)>" }));
  m.advance(50);
  const cap = capture(m),
    p = createMatchExport(cap, "data");
  m.advance(50);
  const file = await p;
  const { importPackage } = await import("../export/import.js");
  const imported = await importPackage(new File([file.blob], file.name));
  assert.equal(imported.package.summary.timeMs, 1000);
  const html = await (await createMatchExport(cap, "html")).blob.text();
  assert.ok(html.includes("&lt;img"));
  assert.doesNotMatch(html, /<script|<link|<img|https?:\/\//);
});
test("invalid version, participant, arrays and truncated compression never write records", async () => {
  const { importPackage } = await import("../export/import.js");
  let writes = 0;
  const store = {
    putPackage() {
      writes++;
    },
  };
  for (const obj of [
    { format: "cyber-crickets.replay", formatVersion: 999 },
    {
      ...encode(buildReplayPackage(capture(createMatch(testConfig())))),
      config: { schemaVersion: 999 },
    },
  ])
    await assert.rejects(() =>
      importPackage(new File([JSON.stringify(obj)], "bad.json"), { store }),
    );
  await assert.rejects(() =>
    importPackage(new File([new Uint8Array([31, 139, 8])], "bad.json.gz"), {
      store,
    }),
  );
  assert.equal(writes, 0);
});
