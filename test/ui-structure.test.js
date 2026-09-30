import test from "node:test";
import assert from "node:assert/strict";
import { runtimeGraph } from "../scripts/build.mjs";
import { execFileSync } from "node:child_process";
import path from "node:path";
test("every runtime module and Worker resolves from the canonical entrypoint", async () => {
  const files = await runtimeGraph(path.resolve(import.meta.dirname, ".."));
  for (const f of [
    "app.js",
    "ui/arena.js",
    "ui/replay.js",
    "ui/competition.js",
    "ui/experiment.js",
    "workers/match-worker.js",
    "workers/queue-worker.js",
    "css/mobile.css",
  ])
    assert.ok(files.has(f), f);
});
test("all referenced JavaScript modules pass the Node syntax checker", async () => {
  const root = path.resolve(import.meta.dirname, ".."),
    files = await runtimeGraph(root);
  for (const file of files.keys())
    if (file.endsWith(".js"))
      execFileSync(process.execPath, ["--check", path.join(root, file)], {
        stdio: "pipe",
      });
});
