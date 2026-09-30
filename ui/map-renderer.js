import { WIDTH, HEIGHT } from "../match.js?v=20260928-strongest-v6";
import { COLORS } from "./constants.js?v=20260928-strongest-v6";

export function drawArena({ match, canvas, ctx, overlayEnabled }) {
  const cw = canvas.width / WIDTH,
    ch = canvas.height / HEIGHT;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x,
        owner = match.owner[i],
        terrain = match.terrain[i];
      if (owner >= 0) {
        ctx.fillStyle = COLORS[owner];
        ctx.globalAlpha = terrain === 3 ? 0.72 : terrain === 2 ? 0.84 : 0.96;
      } else {
        ctx.fillStyle =
          terrain === 3 ? "#c8ced8" : terrain === 2 ? "#dde2e9" : "#f3f5f8";
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(x * cw, y * ch, cw + 0.4, ch + 0.4);
      if (match.resources[i]) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = match.resources[i] === 3 ? "#ffb703" : "#ffd166";
        ctx.beginPath();
        ctx.arc(
          x * cw + cw / 2,
          y * ch + ch / 2,
          match.resources[i] === 3 ? cw * 0.27 : cw * 0.18,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      if (match.core[i] >= 0) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1, cw * 0.18);
        ctx.strokeRect(
          x * cw + cw * 0.18,
          y * ch + ch * 0.18,
          cw * 0.64,
          ch * 0.64,
        );
      }
    }
  if (overlayEnabled) drawThinking({ match, ctx, cw, ch });
  ctx.globalAlpha = 1;
}
function drawThinking({ match, ctx, cw, ch }) {
  for (const team of match.teams) {
    const pheromone = team.agent.pheromone;
    if (pheromone) {
      let max = 0;
      for (const value of pheromone) if (value > max) max = value;
      if (max > 0)
        for (let i = 0; i < pheromone.length; i++)
          if (pheromone[i] > 0.15) {
            const x = i % WIDTH,
              y = Math.floor(i / WIDTH);
            ctx.fillStyle = COLORS[team.id];
            ctx.globalAlpha = Math.min(0.28, (pheromone[i] / max) * 0.25);
            ctx.fillRect(x * cw, y * ch, cw, ch);
          }
    }
    const target = team.agent.lastChoice;
    if (target != null) {
      const x = target % WIDTH,
        y = Math.floor(target / WIDTH);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(1.5, cw * 0.18);
      ctx.strokeRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
    }
  }
}
import { TEAM_COLORS } from "../engine/match.js";
const mapCaches = new WeakMap();
export function renderArenaMap({
  canvas,
  snapshot,
  layers = {
    territory: true,
    resources: true,
    terrain: false,
    path: true,
    targets: true,
  },
  selectedParticipant,
}) {
  const b = snapshot.board,
    ctx = canvas.getContext("2d"),
    size = canvas.width / 64,
    old = mapCaches.get(canvas),
    signature = JSON.stringify(layers) + selectedParticipant,
    full = !old || old.signature !== signature || layers.path || layers.targets;
  for (let i = 0; i < 4096; i++) {
    if (
      !full &&
      old.owner[i] === b.owner[i] &&
      old.resources[i] === b.resources[i]
    )
      continue;
    const x = (i % 64) * size,
      y = Math.floor(i / 64) * size;
    ctx.fillStyle = b.blocked[i]
      ? "#39413e"
      : layers.territory && b.owner[i] >= 0
        ? TEAM_COLORS[b.owner[i]]
        : layers.terrain
          ? ["", "#f0f3eb", "#d8dfd0", "#b9c6b0"][b.terrain[i]]
          : "#f1f3ed";
    ctx.fillRect(x, y, size, size);
    if (b.core[i] >= 0) {
      ctx.strokeStyle = "#172a23";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
    if (layers.resources && b.resources[i]) {
      ctx.fillStyle = b.owner[i] >= 0 ? "#fff9d5" : "#9a7729";
      const r = b.resources[i] === 3 ? size * 0.36 : size * 0.23;
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + size / 2 - r);
      ctx.lineTo(x + size / 2 + r, y + size / 2);
      ctx.lineTo(x + size / 2, y + size / 2 + r);
      ctx.lineTo(x + size / 2 - r, y + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  const team =
      snapshot.teams.find((t) => t.participantId === selectedParticipant) ??
      snapshot.teams[0],
    move = team?.lastMove;
  if (layers.path && move?.explain?.path?.length) {
    ctx.strokeStyle = "#192b25";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    move.explain.path.forEach((i, n) => {
      const x = ((i % 64) + 0.5) * size,
        y = (Math.floor(i / 64) + 0.5) * size;
      n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (layers.targets && move) {
    ctx.strokeStyle = "#192b25";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (move.to % 64) * size - 1,
      Math.floor(move.to / 64) * size - 1,
      size + 2,
      size + 2,
    );
  }
  mapCaches.set(canvas, {
    signature,
    owner: b.owner.slice(),
    resources: b.resources.slice(),
  });
}
