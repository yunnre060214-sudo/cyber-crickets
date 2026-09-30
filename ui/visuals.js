import { h, select } from "./dom.js";
import { renderArenaMap } from "./map-renderer.js";
import { renderVPChart } from "./chart.js";
import { renderArenaScoreboard } from "./scoreboard.js";
import { renderDecisionTrace } from "./decision-trace.js";
export function connectArenaVisuals(arena) {
  let selected = "p0",
    last = null,
    matchId = null;
  const layers = {
      territory: true,
      resources: true,
      terrain: false,
      path: true,
      targets: true,
    },
    bar = arena.root.querySelector("#mapLayers");
  const layer = select(
    [
      ["territory", "领地 + 资源"],
      ["terrain", "地形 + 资源"],
      ["clean", "领地"],
    ],
    "territory",
    (v) => {
      layers.terrain = v === "terrain";
      layers.territory = v !== "terrain";
      layers.resources = v !== "clean";
      if (last) draw(last);
    },
  );
  const teamSelect = select(
    arena.store.nextConfig.entrants.map((e, i) => [
      e.participantId,
      ["绿方", "红方", "蓝方", "金方"][i],
    ]),
    selected,
    (v) => {
      selected = v;
      if (last) draw(last);
    },
  );
  bar.replaceChildren(layer, teamSelect);
  function draw(args) {
    last = args;
    const { snapshot, canvas, scores, chart, trace, feed, samples } = args;
    if (matchId !== snapshot.matchId) {
      matchId = snapshot.matchId;
      chart.dataset.chartMax = "0";
      teamSelect.replaceChildren(
        ...snapshot.teams.map((t) =>
          h(
            "option",
            { value: t.participantId },
            ["绿方", "红方", "蓝方", "金方"][t.seat],
          ),
        ),
      );
    }
    renderArenaMap({ canvas, snapshot, layers, selectedParticipant: selected });
    renderArenaScoreboard(scores, snapshot);
    renderVPChart(chart, samples, snapshot.config);
    const team =
      snapshot.teams.find((t) => t.participantId === selected) ??
      snapshot.teams[0];
    renderDecisionTrace(trace, team.lastMove?.explain, team);
    feed.replaceChildren(
      h("h2", {}, "阶段事件"),
      snapshot.events.length
        ? snapshot.events
            .slice(-5)
            .map((e) =>
              h(
                "div",
                { className: "event-item" },
                h(
                  "time",
                  {},
                  ((e.timeMs ?? e.time * 1000) / 1000).toFixed(1) + "s",
                ),
                h("span", {}, e.label ?? e.banner),
              ),
            )
        : h(
            "small",
            {},
            snapshot.config.mode === "migration"
              ? "25% / 50% / 75% 资源轮换 · 82% 超频"
              : "33% 资源潮汐 · 62% 高价值节点 · 82% 超频",
          ),
    );
  }
  arena.setRenderer(draw);
}
