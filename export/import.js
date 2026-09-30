import { decode, encode, verify, seal, canonicalHash } from "../engine/hash.js";
import { decodeBoard } from "../replay/codec.js";
import { createMatchConfig } from "../engine/config.js";
import { validateCheckpoint } from "../replay/checkpoint.js";
export const INPUT_LIMITS = {
  compressed: 32 * 1024 * 1024,
  expanded: 128 * 1024 * 1024,
};
function finiteTree(value, depth = 0) {
  if (depth > 100) throw Error("DATA_TOO_DEEP");
  if (typeof value === "number" && !Number.isFinite(value))
    throw Error("NON_FINITE_DATA");
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(k))
        throw Error("UNSAFE_KEY");
      finiteTree(v, depth + 1);
    }
}
export function validateReplayPackage(pkg) {
  if (pkg.format !== "cyber-crickets.replay" || pkg.formatVersion !== 3)
    throw Error("UNSUPPORTED_FORMAT");
  if (pkg.config?.schemaVersion !== 3 || pkg.config?.engineVersion !== "2.0.0")
    throw Error("UNSUPPORTED_SCHEMA");
  const c = createMatchConfig(pkg.config);
  verify(pkg);
  decodeBoard(encode(pkg.initialBoard));
  if (!Array.isArray(pkg.tickRecords) || pkg.tickRecords.length > 100000)
    throw Error("INVALID_LEDGER");
  let previous = 0;
  for (const [i, r] of pkg.tickRecords.entries()) {
    if (
      r.seq !== i ||
      r.tick !== i + 1 ||
      !Number.isFinite(r.timeMs) ||
      r.timeMs <= previous ||
      r.timeMs > c.durationMs + 1e-7 ||
      Math.abs(r.timeMs - previous - r.elapsedMs) > 1e-5
    )
      throw Error("INVALID_LEDGER_TIME");
    for (const v of [...r.resourceChanges, ...r.ownershipChanges]) {
      if (
        !Number.isInteger(v.index) ||
        v.index < 0 ||
        v.index >= 4096 ||
        ("owner" in v &&
          (!Number.isInteger(v.owner) ||
            v.owner < 0 ||
            v.owner >= c.teamCount)) ||
        ("value" in v && ![0, 1, 3].includes(v.value))
      )
        throw Error("INVALID_LEDGER_CHANGE");
    }
    if (
      r.scoreDeltas.length !== c.teamCount ||
      new Set(r.scoreDeltas.map((d) => d.participantId)).size !== c.teamCount ||
      r.scoreDeltas.some(
        (d) =>
          !c.entrants.some((e) => e.participantId === d.participantId) ||
          !Number.isFinite(d.areaVP) ||
          !Number.isFinite(d.resourceVP),
      )
    )
      throw Error("INVALID_SCORE_LEDGER");
    previous = r.timeMs;
  }
  for (const cp of pkg.boardCheckpoints ?? []) {
    decodeBoard(encode(cp.board));
    if (
      !Array.isArray(cp.scores) ||
      cp.scores.length !== c.teamCount ||
      cp.scores.some((s) => !Number.isFinite(s))
    )
      throw Error("INVALID_BOARD_CHECKPOINT");
  }
  if (pkg.checkpoint) validateCheckpoint(pkg.checkpoint);
  return pkg;
}
async function readBounded(stream, limit) {
  const reader = stream.getReader(),
    decoder = new TextDecoder(),
    parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw Error("IMPORT_SIZE_LIMIT");
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}
export async function importPackage(file, { store } = {}) {
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer()),
    gzip = magic[0] === 31 && magic[1] === 139;
  if (file.size > (gzip ? INPUT_LIMITS.compressed : INPUT_LIMITS.expanded))
    throw Error("IMPORT_SIZE_LIMIT");
  let stream = file.stream();
  if (gzip) {
    if (typeof DecompressionStream !== "function")
      throw Error("GZIP_UNAVAILABLE");
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  }
  const raw = JSON.parse(await readBounded(stream, INPUT_LIMITS.expanded));
  finiteTree(raw);
  let pkg,
    resume = false,
    archive = false,
    type = "match";
  if (raw.format === "cyber-crickets.match-log" && raw.formatVersion === 2) {
    const b = raw.snapshot?.map;
    if (
      !b ||
      ["owner", "terrain", "resources", "core"].some(
        (k) => !Array.isArray(b[k]) || b[k].length !== 4096,
      ) ||
      !Array.isArray(raw.teams) ||
      ![2, 4].includes(raw.teams.length)
    )
      throw Error("INVALID_LEGACY_LOG");
    pkg = seal({
      format: "cyber-crickets.archive",
      formatVersion: 3,
      original: raw,
      resume: false,
    });
    archive = true;
  } else if (raw.format === "cyber-crickets.replay") {
    if (raw.formatVersion !== 3) throw Error("UNSUPPORTED_FORMAT");
    pkg = validateReplayPackage(decode(raw));
    resume = !!pkg.checkpoint && !pkg.summary.finished;
  } else if (
    ["cyber-crickets.competition", "cyber-crickets.experiment"].includes(
      raw.format,
    ) &&
    raw.formatVersion === 3
  ) {
    pkg = decode(raw);
    verify(pkg);
    type = raw.format.split(".").at(-1);
    if (!pkg.config || !Array.isArray(pkg.results))
      throw Error("INVALID_JOB_PACKAGE");
    for (const r of pkg.results) {
      if (r.replay) validateReplayPackage(r.replay);
    }
    resume = false;
  } else throw Error("UNSUPPORTED_FORMAT");
  const id = "import:" + canonicalHash(pkg);
  if (store)
    await store.putPackage(
      {
        id,
        type,
        schemaVersion: 3,
        index: {
          name:
            pkg.config?.name ??
            pkg.config?.seed ??
            raw.metadata?.seed ??
            file.name,
          archive,
          finished: pkg.summary?.finished ?? true,
        },
        payloadRefs: [],
      },
      pkg,
    );
  return { id, package: pkg, resume, archive, type };
}
