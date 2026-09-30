import { createRng } from "./rng.js";
export function neighbors(i, width = 64, height = 64) {
  const out = [];
  if (i % width > 0) out.push(i - 1);
  if (i % width < width - 1) out.push(i + 1);
  if (i >= width) out.push(i - width);
  if (i < width * (height - 1)) out.push(i + width);
  return out;
}
function orbit(i, count) {
  const x = i % 64,
    y = Math.floor(i / 64);
  return count === 2
    ? [i, y * 64 + 63 - x]
    : [i, x * 64 + 63 - y, (63 - y) * 64 + 63 - x, (63 - x) * 64 + y];
}
export function generateMap(config) {
  const board = {
      width: 64,
      height: 64,
      owner: new Int8Array(4096).fill(-1),
      terrain: new Uint8Array(4096),
      resources: new Uint8Array(4096),
      core: new Int8Array(4096).fill(-1),
      blocked: new Uint8Array(4096),
      spawns: [],
      playableCellCount: 4096,
    },
    rng = createRng(config.seed, "map"),
    done = new Set();
  for (let i = 0; i < 4096; i++) {
    if (done.has(i)) continue;
    const cells = orbit(i, config.teamCount),
      x = i % 64,
      y = Math.floor(i / 64),
      dx = Math.abs(x - 31.5),
      dy = Math.abs(y - 31.5),
      r = Math.max(dx, dy);
    let blocked = false,
      terrain = 1 + (rng.next() < 0.17) + (rng.next() < 0.04);
    if (config.mapPreset === "basin") terrain = r < 18 ? 2 : terrain;
    if (config.mapPreset === "ring")
      blocked = r >= 18 && r <= 20 && Math.min(dx, dy) > 3;
    if (config.mapPreset === "canyon")
      blocked =
        ((dx >= 11 && dx <= 13) || (dy >= 11 && dy <= 13)) &&
        Math.min(dx, dy) > 3 &&
        Math.abs(dx - dy) > 3;
    for (const c of cells) {
      board.terrain[c] = terrain;
      board.blocked[c] = +blocked;
      done.add(c);
    }
  }
  const spawns =
    config.teamCount === 2
      ? [
          [5, 32],
          [58, 32],
        ]
      : [
          [5, 5],
          [58, 5],
          [5, 58],
          [58, 58],
        ];
  board.spawns = spawns.map((_, i) => [
    ...spawns[(i + config.rotation) % config.teamCount],
  ]);
  board.spawns.forEach(([cx, cy], seat) => {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        const i = y * 64 + x;
        board.owner[i] = board.core[i] = seat;
        board.blocked[i] = 0;
        board.terrain[i] = 1;
      }
  });
  // Core terrain is symmetric under all seat rotations. Duel cores mirror x.
  board.playableCellCount =
    4096 - [...board.blocked].reduce((a, b) => a + b, 0);
  const used = new Set(),
    eventsRng = createRng(config.seed, "events");
  function nodes(count, value, center = false) {
    const result = [];
    for (let attempt = 0; result.length < count && attempt < 20000; attempt++) {
      const x = center ? 18 + eventsRng.int(28) : 4 + eventsRng.int(56),
        y = center ? 18 + eventsRng.int(28) : 4 + eventsRng.int(56),
        cells = orbit(y * 64 + x, config.teamCount);
      if (
        cells.some((i) => board.blocked[i] || board.core[i] >= 0 || used.has(i))
      )
        continue;
      for (const index of cells) {
        used.add(index);
        result.push({ index, value });
      }
    }
    if (result.length !== count) throw Error("MAP_RESOURCE_GENERATION_FAILED");
    return result;
  }
  for (const n of [...nodes(24, 1), ...nodes(8, 3)])
    board.resources[n.index] = n.value;
  let eventPlan = [];
  if (config.mode === "migration") {
    const groups = Array.from({ length: 4 }, () => nodes(8, 3));
    for (const n of groups[0]) board.resources[n.index] = 3;
    for (let g = 1; g < 4; g++)
      eventPlan.push({
        id: "migration-" + g,
        timeMs: (config.durationMs * g) / 4,
        type: "migration",
        label: "资源轮换 " + g,
        changes: [
          ...groups[g - 1].map((n) => ({ ...n, value: 0 })),
          ...groups[g],
        ],
      });
    eventPlan.publicRotationPlan = groups;
  } else
    eventPlan = [
      {
        id: "tide",
        timeMs: config.durationMs * 0.33,
        type: "resource",
        label: "资源潮汐",
        changes: nodes(12, 1, true),
      },
      {
        id: "high-value",
        timeMs: config.durationMs * 0.62,
        type: "resource",
        label: "高价值节点上线",
        changes: nodes(12, 3, true),
      },
    ];
  eventPlan.push({
    id: "overclock",
    timeMs: config.durationMs * 0.82,
    type: "overclock",
    label: "终局超频",
    changes: [],
  });
  return { board, eventPlan };
}
