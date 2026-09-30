import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { references, digest } from "./build.mjs";
export async function verifyDist({ outDir }) {
  const manifest = JSON.parse(
      await readFile(path.join(outDir, "build-info.json"), "utf8"),
    ),
    expected = new Map(manifest.files.map((f) => [f.path, f])),
    found = [];
  async function walk(dir = "") {
    for (const entry of await readdir(path.join(outDir, dir), {
      withFileTypes: true,
    })) {
      const p = path.posix.join(dir, entry.name);
      entry.isDirectory() ? await walk(p) : found.push(p);
    }
  }
  await walk();
  const missing = [],
    unexpected = found.filter(
      (p) => p !== "build-info.json" && !expected.has(p),
    );
  for (const [file, entry] of expected) {
    let text;
    try {
      text = await readFile(path.join(outDir, file), "utf8");
    } catch {
      missing.push(file);
      continue;
    }
    if (digest(text) !== entry.sha256) unexpected.push(file + ":hash");
    for (const ref of references(text, path.extname(file))) {
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), ref.split(/[?#]/)[0]),
      );
      if (!expected.has(target)) missing.push(target);
    }
  }
  if (
    !/^[a-f0-9]{12}$/.test(manifest.buildHash) ||
    manifest.productVersion !== "2.0.0"
  )
    unexpected.push("manifest:version");
  return {
    ok: !missing.length && !unexpected.length,
    missing: [...new Set(missing)],
    unexpected: [...new Set(unexpected)],
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await verifyDist({
    outDir: path.resolve(import.meta.dirname, "../dist"),
  });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
