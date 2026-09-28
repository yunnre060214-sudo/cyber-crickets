import {WIDTH, HEIGHT} from '../match.js?v=20260928-strongest-v6';
import {COLORS} from './constants.js?v=20260928-strongest-v6';

export function drawArena({match, canvas, ctx, overlayEnabled}) {
  const cw = canvas.width / WIDTH, ch = canvas.height / HEIGHT;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x, owner = match.owner[i], terrain = match.terrain[i];
    if (owner >= 0) {
      ctx.fillStyle = COLORS[owner]; ctx.globalAlpha = terrain === 3 ? .72 : terrain === 2 ? .84 : .96;
    } else {
      ctx.fillStyle = terrain === 3 ? '#c8ced8' : terrain === 2 ? '#dde2e9' : '#f3f5f8';
      ctx.globalAlpha = 1;
    }
    ctx.fillRect(x * cw, y * ch, cw + .4, ch + .4);
    if (match.resources[i]) {
      ctx.globalAlpha = 1; ctx.fillStyle = match.resources[i] === 3 ? '#ffb703' : '#ffd166';
      ctx.beginPath(); ctx.arc(x * cw + cw / 2, y * ch + ch / 2,
        match.resources[i] === 3 ? cw * .27 : cw * .18, 0, Math.PI * 2); ctx.fill();
    }
    if (match.core[i] >= 0) {
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, cw * .18);
      ctx.strokeRect(x * cw + cw * .18, y * ch + ch * .18, cw * .64, ch * .64);
    }
  }
  if (overlayEnabled) drawThinking({match, ctx, cw, ch});
  ctx.globalAlpha = 1;
}
function drawThinking({match, ctx, cw, ch}) {
  for (const team of match.teams) {
    const pheromone = team.agent.pheromone;
    if (pheromone) {
      let max = 0;
      for (const value of pheromone) if (value > max) max = value;
      if (max > 0) for (let i = 0; i < pheromone.length; i++) if (pheromone[i] > .15) {
        const x = i % WIDTH, y = Math.floor(i / WIDTH);
        ctx.fillStyle = COLORS[team.id];
        ctx.globalAlpha = Math.min(.28, pheromone[i] / max * .25);
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }
    const target = team.agent.lastChoice;
    if (target != null) {
      const x = target % WIDTH, y = Math.floor(target / WIDTH);
      ctx.globalAlpha = .95; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, cw * .18);
      ctx.strokeRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
    }
  }
}
