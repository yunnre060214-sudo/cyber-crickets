import { h, button, label, select, status } from "./dom.js";
import { AGENT_REGISTRY } from "../agents/registry.js";
import { FORMAT_NAMES } from "../competition/formats.js";
export function estimateTournamentGames({
  format,
  entrantCount: n,
  mapCount = 1,
  swissRounds = 3,
}) {
  const fixtures = {
    round_robin: (n * (n - 1)) / 2,
    double_round_robin: n * (n - 1),
    knockout: n,
    groups: (n / 4) * 6,
    group_knockout: (n / 4) * 6 + n / 2,
    swiss: (swissRounds * n) / 2,
  }[format];
  return fixtures * mapCount * 2;
}
export function createCompetitionWorkspace({ root, controller, onOpenReplay }) {
  let active = null,
    config = {
      name: "算法公开赛",
      format: "knockout",
      seed: "cup-20260930",
      entrantCount: 4,
      durationMs: 60000,
      mode: "standard",
      mapPreset: "plain",
      mapCount: 1,
      swissRounds: 3,
      budgetProfile: "standard",
    },
    entrants = AGENT_REGISTRY.slice(-4).map((a, i) => ({
      participantId: "p" + i,
      strategyId: a.id,
    }));
  const form = h("div", {}),
    list = h("div", { className: "record-list" }),
    detail = h(
      "div",
      { className: "panel panel-body" },
      h("h2", {}, "建立一场赛事"),
      h(
        "p",
        { className: "muted" },
        "每张地图自动换边两局，积分按参赛身份合并。",
      ),
    ),
    message = h("p", { className: "status", role: "status" });
  root.replaceChildren(
    h(
      "div",
      { className: "workspace-head" },
      h(
        "div",
        {},
        h("h1", {}, "赛事中心"),
        h("p", {}, "六种赛制，多地图换边，逐局保存回放。"),
      ),
    ),
    h(
      "div",
      { className: "workspace-grid" },
      h(
        "aside",
        { className: "stack" },
        h(
          "div",
          { className: "panel" },
          h("div", { className: "panel-head" }, h("h2", {}, "创建赛事")),
          h("div", { className: "panel-body" }, form),
        ),
        h(
          "div",
          { className: "panel" },
          h(
            "div",
            { className: "panel-head" },
            h("h2", {}, "本地赛事"),
            button("刷新", refresh),
          ),
          h("div", { className: "panel-body" }, list),
        ),
      ),
      h("div", { className: "stack" }, detail, message),
    ),
  );
  const update = (key, value) => {
    config[key] = value;
    if (
      ["groups", "group_knockout"].includes(config.format) &&
      config.entrantCount === 4
    )
      config.entrantCount = 8;
    config.swissRounds = Math.min(config.swissRounds, config.entrantCount - 1);
    entrants = Array.from(
      { length: config.entrantCount },
      (_, i) =>
        entrants[i] ?? {
          participantId: "p" + i,
          strategyId: AGENT_REGISTRY[i % AGENT_REGISTRY.length].id,
        },
    );
    renderForm();
  };
  function renderForm() {
    const c = config;
    form.replaceChildren(
      h(
        "div",
        { className: "settings-grid", style: "grid-template-columns:1fr 1fr" },
        label(
          "赛事名称",
          h("input", {
            name: "competition-name",
            value: c.name,
            onchange: (e) => update("name", e.target.value),
          }),
        ),
        label(
          "种子",
          h("input", {
            name: "competition-seed",
            value: c.seed,
            onchange: (e) => update("seed", e.target.value),
          }),
        ),
        label(
          "赛制",
          select(
            Object.entries(FORMAT_NAMES),
            c.format,
            (v) => update("format", v),
            { name: "competition-format" },
          ),
        ),
        label(
          "参赛人数",
          select(
            [4, 8, 16]
              .filter(
                (n) =>
                  n !== 4 || !["groups", "group_knockout"].includes(c.format),
              )
              .map((n) => [n, n + " 人"]),
            c.entrantCount,
            (v) => update("entrantCount", Number(v)),
            { name: "competition-count" },
          ),
        ),
        label(
          "单局秒数",
          h("input", {
            name: "competition-duration",
            type: "number",
            min: 10,
            max: 1800,
            value: c.durationMs / 1000,
            onchange: (e) =>
              update("durationMs", Number(e.target.value) * 1000),
          }),
        ),
        label(
          "对阵地图数",
          select(
            [1, 3, 5].map((n) => [n, n + " 图 · " + n * 2 + " 局"]),
            c.mapCount,
            (v) => update("mapCount", Number(v)),
            { name: "competition-maps" },
          ),
        ),
        label(
          "模式",
          select(
            [
              ["standard", "标准控制"],
              ["migration", "资源迁移"],
              ["classic", "经典 1.0"],
            ],
            c.mode,
            (v) => {
              if (v === "classic")
                entrants = entrants.map((e) => ({
                  ...e,
                  strategyId: AGENT_REGISTRY.slice(0, 18).some(
                    (a) => a.id === e.strategyId,
                  )
                    ? e.strategyId
                    : "strongest",
                }));
              update("mode", v);
            },
            { name: "competition-mode" },
          ),
        ),
        label(
          "地图",
          select(
            [
              ["plain", "平原"],
              ["basin", "盆地"],
              ["canyon", "峡谷"],
              ["ring", "环形"],
            ],
            c.mapPreset,
            (v) => update("mapPreset", v),
            { name: "competition-map", disabled: c.mode === "classic" },
          ),
        ),
        label(
          "瑞士轮数",
          h("input", {
            name: "competition-rounds",
            type: "number",
            min: 1,
            max: c.entrantCount - 1,
            value: c.swissRounds,
            disabled: c.format !== "swiss",
            onchange: (e) => update("swissRounds", Number(e.target.value)),
          }),
        ),
        ...entrants.map((e, i) =>
          label(
            "参赛者 " + (i + 1),
            select(
              AGENT_REGISTRY.slice(0, c.mode === "classic" ? 18 : 21).map(
                (a) => [a.id, a.name],
              ),
              e.strategyId,
              (v) => {
                entrants[i] = { ...e, strategyId: v };
              },
              { name: "competition-agent-" + i },
            ),
          ),
        ),
      ),
      h(
        "p",
        { className: "muted", style: "margin:12px 0" },
        "预计 " + estimateTournamentGames(c) + " 局；淘汰同分可能加赛。",
      ),
      button(
        "创建赛事",
        async () => {
          try {
            active = await controller.create({ ...config, entrants });
            await open(active);
            await refresh();
          } catch (e) {
            status(message, e.message, true);
          }
        },
        { className: "primary" },
      ),
    );
  }
  async function refresh() {
    try {
      const items = await controller.list();
      list.replaceChildren(
        ...items.map((r) =>
          h(
            "div",
            { className: "record-row" },
            h(
              "div",
              {},
              h("strong", {}, r.index.name),
              h(
                "p",
                { className: "muted" },
                r.index.resumeMode === "classic"
                  ? "经典历史"
                  : (r.index.format ?? ""),
              ),
            ),
            button("查看", () => open(r.id)),
          ),
        ),
      );
    } catch (e) {
      status(message, e.message, true);
    }
  }
  async function open(id) {
    active = id;
    try {
      const data = await controller.load(id);
      render(data);
    } catch (e) {
      status(message, e.message, true);
    }
  }
  function render({ record, tournament: t, results = [] }) {
    if (record?.id !== active) return;
    const standings = t.standings(),
      champion = t.champion(),
      entrant = (id) =>
        t.config.entrants.find((e) => (e.participantId ?? e.id) === id)
          ?.strategyId ??
        standings.find((e) => e.id === id)?.strategy ??
        id;
    detail.replaceChildren(
      h(
        "div",
        { className: "workspace-head" },
        h(
          "div",
          {},
          h("h1", {}, record.index.name),
          h(
            "p",
            {},
            (FORMAT_NAMES[t.config.format] ?? t.config.format) +
              " · " +
              (t.config.mode ?? "classic") +
              " · 已保存 " +
              (record.index.completedTasks ?? 0) +
              " 局",
          ),
        ),
        h(
          "span",
          { className: "tag" },
          t.status === "completed" ? "已结束" : "可继续",
        ),
      ),
      h(
        "div",
        { className: "controls" },
        button(
          "运行 / 继续",
          () =>
            controller
              .run(active)
              .catch((e) => status(message, e.message, true)),
          { className: "primary", disabled: t.status === "completed" },
        ),
        button("暂停队列", () => controller.pause(active)),
        button("取消待运行", () => controller.cancelPending(active)),
      ),
      h(
        "p",
        { className: "muted", style: "margin:12px 0" },
        champion
          ? "冠军：" + entrant(champion)
          : t.config.format === "groups"
            ? "各组按前二名排名，不设总冠军。"
            : "淘汰同分先加赛一张换边地图，再比较翻色、领地和种子抽签。",
      ),
      h("h2", {}, "积分榜"),
      h(
        "div",
        { className: "table-wrap" },
        h(
          "table",
          {},
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              ["参赛者 / 算法", "胜 / 平", "积分", "VP 差", "Buchholz"].map(
                (s) => h("th", {}, s),
              ),
            ),
          ),
          h(
            "tbody",
            {},
            standings.map((t) =>
              h(
                "tr",
                {},
                h("td", {}, t.id + " · " + entrant(t.id)),
                h("td", {}, t.wins + " / " + t.draws),
                h("td", {}, t.points),
                h("td", {}, (t.vpFor - t.vpAgainst).toFixed(2)),
                h("td", {}, t.buchholz ?? "—"),
              ),
            ),
          ),
        ),
      ),
      h("h2", { style: "margin-top:20px" }, "逐轮赛程与实际回放"),
      ...t.rounds.map((r) =>
        h(
          "div",
          { style: "margin-top:12px" },
          h("h3", {}, r.label),
          r.fixtures.map((f) =>
            h(
              "div",
              { className: "record-row" },
              h(
                "div",
                {},
                h(
                  "strong",
                  {},
                  (f.group ? f.group + " 组 · " : "") +
                    f.entrants.map((id) => id + " " + entrant(id)).join(" / "),
                ),
                h(
                  "p",
                  { className: "muted" },
                  f.result
                    ? "合计 VP " +
                        f.entrants
                          .map((id) => f.result.aggregates[id].vp.toFixed(2))
                          .join(" : ") +
                        " · " +
                        (f.result.winner ? "胜者 " + f.result.winner : "平局")
                    : "等待结算",
                ),
              ),
              h(
                "div",
                { className: "controls" },
                results
                  .filter((x) => x.jobId.includes("/" + f.id + "/"))
                  .map((x) =>
                    button(
                      "图 " +
                        ((Number(x.jobId.match(/map(\d+)/)?.[1]) || 0) + 1) +
                        " / 局 " +
                        ((Number(x.jobId.match(/leg(\d+)/)?.[1]) || 0) + 1),
                      () => onOpenReplay(x.result.replayId),
                    ),
                  ),
              ),
            ),
          ),
        ),
      ),
    );
  }
  controller.subscribe((e) => {
    if (e.id !== active) return;
    if (e.tournament) render(e);
    if (e.error || e.progress?.error)
      status(message, e.error ?? e.progress.error, true);
    else if (e.progress?.timeMs)
      status(
        message,
        "当前单局 " +
          (e.progress.timeMs / 1000).toFixed(1) +
          " 秒，检查点已保存",
      );
    else if (e.status)
      status(
        message,
        { paused: "队列已暂停", cancelled: "已取消待运行任务，当前局继续结算" }[
          e.status
        ] ?? e.status,
      );
  });
  renderForm();
  return { refresh, open };
}
