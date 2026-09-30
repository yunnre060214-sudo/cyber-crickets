import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
test("dist contains the complete runtime graph and supports a Pages subdirectory", async () => {
  const { buildSite } = await import("../scripts/build.mjs"),
    { verifyDist } = await import("../scripts/verify-dist.mjs");
  const outDir = await mkdtemp(path.join(tmpdir(), "cc-v2-")),
    m = await buildSite({
      sourceRoot: path.resolve(import.meta.dirname, ".."),
      outDir,
      commitSha: "a".repeat(40),
      version: "2.0.0",
    });
  assert.equal((await verifyDist({ outDir })).ok, true);
  assert.match(
    await readFile(path.join(outDir, "index.html"), "utf8"),
    new RegExp('src="./assets/' + m.buildHash + "/app.js"),
  );
  assert.ok(m.files.some((f) => f.path.endsWith("workers/queue-worker.js")));
  assert.ok(m.files.every((f) => !/^test\/|^docs\/|app-202/.test(f.path)));
  await writeFile(
    path.join(outDir, "assets", m.buildHash, "workers/match-worker.js"),
    'import "./missing.js";',
  );
  assert.equal((await verifyDist({ outDir })).ok, false);
  await rm(outDir, { recursive: true, force: true });
});
test("changing an actual module changes the entire immutable asset directory", async () => {
  const { buildSite } = await import("../scripts/build.mjs");
  const root = await mkdtemp(path.join(tmpdir(), "cc-source-"));
  await writeFile(
    path.join(root, "index.html"),
    '<script type="module" src="./app.js"></script>',
  );
  await writeFile(path.join(root, "app.js"), "export const x=1;");
  const a = await buildSite({
    sourceRoot: root,
    outDir: path.join(root, "out"),
    commitSha: "a".repeat(40),
    version: "2.0.0",
  });
  await writeFile(path.join(root, "app.js"), "export const x=2;");
  const b = await buildSite({
    sourceRoot: root,
    outDir: path.join(root, "out"),
    commitSha: "a".repeat(40),
    version: "2.0.0",
  });
  assert.notEqual(a.buildHash, b.buildHash);
  await rm(root, { recursive: true, force: true });
});
