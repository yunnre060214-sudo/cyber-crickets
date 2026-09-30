import { AGENT_META } from "../agents.js?v=20260928-strongest-v6";
import { CELL_COUNT } from "../match.js?v=20260928-strongest-v6";
import { vpRate } from "../rules.js?v=20260928-strongest-v6";
import { COLORS } from "./constants.js?v=20260928-strongest-v6";
import { renderLiveChart } from "./chart.js?v=20260928-strongest-v6";

export function currentWinProbabilities(match) {
  const teams = match.teams;
  if (match.finished) {
    const best = Math.max(...teams.map((team) => team.score));
    const winners = teams.filter((team) => Math.abs(team.score - best) < 1e-9);
    return new Map(
      teams.map((team) => [
        team.id,
        winners.includes(team) ? 1 / winners.length : 0,
      ]),
    );
  }
  if (match.time <= 1e-9)
    return new Map(teams.map((team) => [team.id, 1 / teams.length]));

  const remaining = Math.max(0, match.duration - match.time);
  const progress = match.time / match.duration;
  const projected = teams.map((team) => {
    const rate = vpRate(
      team.territory,
      CELL_COUNT,
      team.resources,
      match.resourceTotal,
    );
    // Blend current control with realized average pace. Early estimates stay conservative;
    // late estimates increasingly trust the current board and accumulated lead.
    const avgRate = team.score / Math.max(match.time, 0.001);
    const pace =
      (0.35 + 0.45 * progress) * rate + (0.65 - 0.45 * progress) * avgRate;
    return { id: team.id, value: team.score + pace * remaining };
  });
  const mean =
    projected.reduce((sum, item) => sum + item.value, 0) / projected.length;
  const spread = Math.max(18, match.duration * (0.95 - 0.55 * progress));
  const weights = projected.map((item) => ({
    id: item.id,
    w: Math.exp((item.value - mean) / spread),
  }));
  const total = weights.reduce((sum, item) => sum + item.w, 0) || 1;
  return new Map(weights.map((item) => [item.id, item.w / total]));
}

export function renderScoreboard({ match, el, formatTime }) {
  el.timer.textContent = formatTime(match.duration - match.time);
  const teams = [...match.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...teams.map((team) => team.score));
  const winProb = currentWinProbabilities(match);
  renderLiveChart({ match, el });
  el.score.innerHTML = teams
    .map((team, rank) => {
      const meta = AGENT_META[team.strategy],
        thought = team.agent.thought || "等待决策";
      const rate = vpRate(
        team.territory,
        CELL_COUNT,
        team.resources,
        match.resourceTotal,
      );
      return (
        '<div class="score-row"><div class="score-top"><div class="score-name"><span>' +
        (rank + 1) +
        '</span><i class="team-swatch" style="background:' +
        COLORS[team.id] +
        '"></i>' +
        meta.name +
        '</div><div class="score-number">' +
        team.score.toFixed(1) +
        ' VP</div></div><div class="score-winrate">当前胜率 <strong>' +
        (winProb.get(team.id) * 100).toFixed(1) +
        '%</strong></div><div class="bar"><i style="width:' +
        (team.score / maxScore) * 100 +
        "%;background:" +
        COLORS[team.id] +
        '"></i></div><div class="score-meta"><span>领地 ' +
        ((team.territory / CELL_COUNT) * 100).toFixed(1) +
        "%</span><span>资源 " +
        team.resources +
        "</span><span>翻色 " +
        team.captures +
        "</span><span>" +
        rate.toFixed(2) +
        " VP/s</span><span>" +
        team.thinkMs.toFixed(2) +
        'ms</span></div><div class="thinking"><b>正在想</b><span>' +
        thought +
        "</span></div></div>"
      );
    })
    .join("");
}
import { h } from "./dom.js";
import { AGENT_REGISTRY } from "../agents/registry.js";
export function renderArenaScoreboard(root, snapshot) {
  const remaining = (snapshot.config.durationMs - snapshot.timeMs) / 1000,
    projections = snapshot.teams.map((t) => t.score + t.vpRate * remaining),
    top = Math.max(...projections),
    temperature = Math.max(1, remaining * 0.2),
    weights = projections.map((v) => Math.exp((v - top) / temperature)),
    total = weights.reduce((a, b) => a + b, 0),
    sorted = [...snapshot.teams].sort(
      (a, b) => b.score - a.score || a.seat - b.seat,
    );
  root.replaceChildren(
    h(
      "table",
      {},
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "阵营 / 策略"),
          h("th", { className: "number" }, "VP"),
          h("th", { className: "number" }, "VP/s"),
        ),
      ),
      h(
        "tbody",
        {},
        sorted.map((t) =>
          h(
            "tr",
            {},
            h(
              "td",
              {},
              h(
                "div",
                { className: "team-label" },
                h("i", {
                  className: "team-dot",
                  style:
                    "background:" +
                    ["#247858", "#b54b49", "#3473b2", "#9a7729"][t.seat],
                }),
                ["绿方", "红方", "蓝方", "金方"][t.seat],
              ),
              h(
                "div",
                { className: "team-sub" },
                AGENT_REGISTRY.find((a) => a.id === t.strategyId)?.name,
              ),
              h(
                "div",
                { className: "team-sub" },
                t.territory + " 格 · 资源 " + t.resources,
              ),
            ),
            h(
              "td",
              { className: "number" },
              h("span", { className: "team-score" }, t.score.toFixed(1)),
            ),
            h("td", { className: "number" }, t.vpRate.toFixed(2)),
          ),
        ),
      ),
    ),
    h(
      "p",
      { className: "muted", style: "font-size:10px;padding:8px 0" },
      "当前胜率 · 局势估计（未校准）：" +
        snapshot.teams
          .map(
            (t) =>
              ["绿", "红", "蓝", "金"][t.seat] +
              " " +
              ((weights[t.seat] / total) * 100).toFixed(0) +
              "%",
          )
          .join(" / "),
    ),
  );
}
