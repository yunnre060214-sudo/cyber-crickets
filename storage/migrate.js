import { Tournament } from "../tournament.js";
export async function migrateLegacyTournaments(storage, store) {
  const summary = { migrated: 0, skipped: 0, errors: [] };
  let records;
  try {
    const text = storage.getItem("cyber-crickets-tournaments-v1");
    if (!text) return summary;
    records = JSON.parse(text);
    if (!Array.isArray(records)) throw Error("INVALID_LEGACY_RECORDS");
  } catch (e) {
    summary.errors.push(e.message);
    return summary;
  }
  for (const raw of records) {
    try {
      const t = Tournament.fromJSON(raw),
        id = "legacy:" + t.config.id;
      if (await store.get?.(id)) {
        summary.skipped++;
        continue;
      }
      await store.put(
        {
          id,
          type: "competition",
          schemaVersion: 3,
          index: {
            name: t.config.name,
            complete: t.complete,
            readOnly: t.complete,
            resumeMode: "classic",
          },
          payloadRefs: [],
          rawLegacy: raw,
        },
        { expectedRevision: 0 },
      );
      summary.migrated++;
    } catch (e) {
      summary.errors.push(e.message);
    }
  }
  if (!summary.errors.length)
    storage.setItem("cyber-crickets-tournaments-v2-migrated", "1");
  return summary;
}
