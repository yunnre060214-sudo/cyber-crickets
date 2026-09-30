import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export const digest = (text) => createHash("sha256").update(text).digest("hex");
export function references(text, extension) {
  const patterns =
    extension === ".html"
      ? [/<(?:script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g]
      : extension === ".css"
        ? [/@import\s+["']([^"']+)["']/g, /url\(\s*["']?([^\s"')]+)["']?\s*\)/g]
        : [
            /\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g,
            /\bimport\(\s*["']([^"']+)["']/g,
            /new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g,
          ];
  return [
    ...new Set(
      patterns
        .flatMap((re) => [...text.matchAll(re)].map((m) => m[1]))
        .filter((ref) => ref.startsWith("./") || ref.startsWith("../")),
    ),
  ];
}
export async function runtimeGraph(sourceRoot) {
  const files = new Map();
  async function visit(file) {
    if (files.has(file)) return;
    const abs = path.resolve(sourceRoot, file);
    if (!abs.startsWith(path.resolve(sourceRoot) + path.sep))
      throw Error("REFERENCE_ESCAPES_SOURCE");
    const text = await readFile(abs, "utf8");
    files.set(file, text);
    for (const ref of references(text, path.extname(file)))
      await visit(
        path.posix.normalize(
          path.posix.join(path.posix.dirname(file), ref.split(/[?#]/)[0]),
        ),
      );
  }
  await visit("index.html");
  return files;
}
export async function buildSite({
  sourceRoot,
  outDir,
  commitSha = process.env.GITHUB_SHA ?? "development",
  version = "2.0.0",
}) {
  const graph = await runtimeGraph(sourceRoot),
    sourceHash = digest(
      [...graph]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, t]) => p + "\0" + t)
        .join("\0"),
    ),
    buildHash = sourceHash.slice(0, 12);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const files = [];
  for (const [file, text] of [...graph].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (file === "index.html") continue;
    const target = "assets/" + buildHash + "/" + file;
    await mkdir(path.dirname(path.join(outDir, target)), { recursive: true });
    await writeFile(path.join(outDir, target), text);
    files.push({
      path: target,
      sha256: digest(text),
      bytes: Buffer.byteLength(text),
    });
  }
  const html = graph
    .get("index.html")
    .replace(/\b(src|href)=["'](\.\/[^"']+)["']/g, (match, key, ref) => {
      const relative = ref.slice(2).split(/[?#]/)[0];
      return graph.has(relative)
        ? key + '="./assets/' + buildHash + "/" + relative + '"'
        : match;
    });
  await writeFile(path.join(outDir, "index.html"), html);
  files.push({
    path: "index.html",
    sha256: digest(html),
    bytes: Buffer.byteLength(html),
  });
  const manifest = {
    productVersion: version,
    engineVersion: "2.0.0",
    ruleVersions: ["v2-standard", "v2-migration", "v1-eff46735"],
    commitSha,
    buildHash,
    sourceHash,
    files,
  };
  await writeFile(
    path.join(outDir, "build-info.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, ".."),
    manifest = await buildSite({
      sourceRoot: root,
      outDir: path.join(root, "dist"),
    });
  console.log(
    JSON.stringify({
      version: manifest.productVersion,
      buildHash: manifest.buildHash,
      files: manifest.files.length,
      commitSha: manifest.commitSha,
    }),
  );
}
