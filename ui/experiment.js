import { h, button, label, select, status } from "./dom.js";
import { AGENT_REGISTRY } from "../agents/registry.js";
import { createJobExport } from "../export/jobs.js";
import { saveMatchExport } from "../export/download.js";
export const describeExperimentConfidence = (summary) =>
  summary.independentSeeds < 8
    ? "已完成 " +
      summary.independentSeeds +
      " 个独立种子，仅显示描述统计；至少 8 个种子才计算置信区间。"
    : "按独立种子聚合，2000 次 bootstrap，95% 置信区间。";
export function createExperimentWorkspace({
  root,
  controller,
  store,
  onOpenReplay,
}) {
  let active = null,
    c = {
      name: "策略比较",
      mode: "standard",
      mapPresets: ["plain"],
      durationsMs: [60000],
      teamCount: 4,
      budgetProfile: "standard",
      seedList: Array.from({ length: 8 }, (_, i) => "lab-20260930-" + i),
    },
    strategies = ["strongest", "pathfinder", "boundary", "ucb"];
  const form = h("div", {}),
    list = h("div", { className: "record-list" }),
    detail = h(
      "div",
      { className: "panel panel-body" },
      h("h2", {}, "用样本验证策略"),
      h(
        "p",
        { className: "muted" },
        "同一种子的四方轮换或单挑换边先合并，再计算统计。",
      ),
    ),
    message = h("p", { className: "status", role: "status" });
  const config = () => ({
    ...c,
    rosters: [
      strategies
        .slice(0, c.teamCount)
        .map((strategyId, i) => ({ participantId: "p" + i, strategyId })),
    ],
  });
  root.replaceChildren(
    h(
      "div",
      { className: "workspace-head" },
      h(
        "div",
        {},
        h("h1", {}, "策略实验室"),
        h("p", {}, "独立种子聚合，真实样本胜率与本地单挑 Elo。"),
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
          h("div", { className: "panel-head" }, h("h2", {}, "实验计划")),
          h("div", { className: "panel-body" }, form),
        ),
        h(
          "div",
          { className: "panel" },
          h(
            "div",
            { className: "panel-head" },
            h("h2", {}, "本地实验"),
            button("刷新", refresh),
          ),
          h("div", { className: "panel-body" }, list),
        ),
      ),
      h("div", { className: "stack" }, detail, message),
    ),
  );
  function renderForm() {
    let preview;
    try {
      preview = controller.preview(config());
    } catch (e) {
      preview = { totalMatches: 0, independentSeeds: 0 };
      status(message, e.message, true);
    }
    const update = (k, v) => {
      c[k] = v;
      renderForm();
    };
    form.replaceChildren(
      h(
        "div",
        { className: "settings-grid", style: "grid-template-columns:1fr 1fr" },
        label(
          "实验名称",
          h("input", {
            name: "experiment-name",
            value: c.name,
            onchange: (e) => update("name", e.target.value),
          }),
        ),
        label(
          "阵营数",
          select(
            [
              [4, "四方全轮换"],
              [2, "单挑换边"],
            ],
            c.teamCount,
            (v) => update("teamCount", Number(v)),
            { name: "experiment-teams" },
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
                strategies = strategies.map((s) =>
                  AGENT_REGISTRY.slice(0, 18).some((a) => a.id === s)
                    ? s
                    : "random",
                );
              update("mode", v);
            },
            { name: "experiment-mode" },
          ),
        ),
        label(
          "统一预算",
          select(
            [
              ["fast", "4096"],
              ["standard", "8192"],
              ["deep", "16384"],
            ],
            c.budgetProfile,
            (v) => update("budgetProfile", v),
            { name: "experiment-budget" },
          ),
        ),
        label(
          "时长 / 秒，以逗号分隔",
          h("input", {
            name: "experiment-durations",
            value: c.durationsMs.map((n) => n / 1000).join(","),
            onchange: (e) =>
              update(
                "durationsMs",
                e.target.value.split(",").map((n) => Number(n.trim()) * 1000),
              ),
          }),
        ),
        ...strategies.slice(0, c.teamCount).map((s, i) =>
          label(
            "策略 " + (i + 1),
            select(
              AGENT_REGISTRY.slice(0, c.mode === "classic" ? 18 : 21).map(
                (a) => [a.id, a.name],
              ),
              s,
              (v) => {
                strategies[i] = v;
                renderForm();
              },
              { name: "experiment-agent-" + i },
            ),
          ),
        ),
      ),
      h(
        "fieldset",
        { style: "margin-top:12px" },
        h("legend", {}, "地图模板"),
        ["plain", "basin", "canyon", "ring"].map((m) =>
          label(
            { plain: "平原", basin: "盆地", canyon: "峡谷", ring: "环形" }[m],
            h("input", {
              type: "checkbox",
              checked: c.mapPresets.includes(m),
              disabled: c.mode === "classic",
              onchange: (e) =>
                update(
                  "mapPresets",
                  e.target.checked
                    ? [...c.mapPresets, m]
                    : c.mapPresets.filter((n) => n !== m),
                ),
            }),
          ),
        ),
      ),
      label(
        "独立种子，一行一个",
        h("textarea", {
          name: "experiment-seeds",
          rows: 5,
          value: c.seedList.join("\n"),
          onchange: (e) =>
            update(
              "seedList",
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            ),
        }),
      ),
      h(
        "div",
        { className: "controls", style: "margin-top:8px" },
        [4, 8, 16, 64].map((n) =>
          button(n + " 种子", () =>
            update(
              "seedList",
              Array.from(
                { length: n },
                (_, i) =>
                  "lab-" + new Date().toISOString().slice(0, 10) + "-" + i,
              ),
            ),
          ),
        ),
      ),
      h(
        "p",
        { className: "muted", style: "margin:12px 0" },
        "计划 " +
          preview.totalMatches +
          " 局 / " +
          preview.independentSeeds +
          " 个独立种子。",
      ),
      button(
        "创建实验",
        async () => {
          try {
            active = await controller.create(config());
            await open(active);
            await refresh();
          } catch (e) {
            status(message, e.message, true);
          }
        },
        { className: "primary", disabled: !preview.totalMatches },
      ),
    );
  }
  async function refresh() {
    try {
      const records = await controller.list();
      list.replaceChildren(
        ...records.map((r) =>
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
                "已保存 " + (r.index.completedTasks ?? 0) + " 局",
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
      render(await controller.load(id));
    } catch (e) {
      status(message, e.message, true);
    }
  }
  function render({ record, summary: s, results = [] }) {
    if (record.id !== active) return;
    const cells = (t) => [
      AGENT_REGISTRY.find((a) => a.id === t.strategyId)?.name ?? t.strategyId,
      (t.winRate * 100).toFixed(1) + "%",
      t.interval
        ? (t.interval.low * 100).toFixed(1) +
          "～" +
          (t.interval.high * 100).toFixed(1) +
          "%"
        : "种子不足",
      t.meanRank.toFixed(2),
      t.meanMargin.toFixed(2),
      t.meanBudget.toFixed(0),
      t.meanThinkMs === null ? "未采集" : t.meanThinkMs.toFixed(2),
    ];
    const table = h(
      "table",
      {},
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          [
            "策略",
            "样本胜率",
            "95% 区间",
            "平均名次",
            "平均 VP 差",
            "工作单位",
            "实际 ms",
          ].map((t) => h("th", {}, t)),
        ),
      ),
      h(
        "tbody",
        {},
        s.teams.map((t) =>
          h(
            "tr",
            {},
            cells(t).map((v) => h("td", {}, v)),
          ),
        ),
      ),
    );
    const facets = s.teams.map((t) =>
      h(
        "details",
        {},
        h(
          "summary",
          {},
          t.strategyId + " · " + t.facets.length + " 个地图样本",
        ),
        h(
          "div",
          { className: "table-wrap" },
          h(
            "table",
            {},
            h(
              "tbody",
              {},
              t.facets.map((f) =>
                h(
                  "tr",
                  {},
                  h("td", {}, f.mapPreset + " / " + f.durationMs / 1000 + "s"),
                  h(
                    "td",
                    {},
                    "seed " + f.seedIndex + " / roster " + f.rosterIndex,
                  ),
                  h(
                    "td",
                    {},
                    (f.winRate * 100).toFixed(1) +
                      "% / " +
                      f.meanRank.toFixed(2),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    const elo = s.elo
      ? h(
          "div",
          {},
          h("h2", { style: "margin-top:16px" }, "本地单挑 Elo"),
          h(
            "p",
            { className: "muted" },
            "初值 1000 · K24 · 仅完整换边双局 · 范围 " + s.eloScope,
          ),
          h(
            "pre",
            {},
            Object.entries(s.elo)
              .map(([id, n]) => id + " " + n.toFixed(1))
              .join(String.fromCharCode(10)),
          ),
        )
      : h(
          "p",
          { className: "muted", style: "margin-top:12px" },
          "四方比赛不参与单挑 Elo。",
        );
    const exports = [
      ["html", "HTML 报告"],
      ["markdown", "Markdown"],
      ["data", "完整实验包"],
    ].map(([format, text]) =>
      button(text, async () => {
        try {
          saveMatchExport(await createJobExport(active, await store, format));
          status(message, "已导出 " + text);
        } catch (e) {
          status(message, e.message, true);
        }
      }),
    );
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
            s.completedMatches +
              " / " +
              s.totalMatches +
              " 局 · " +
              s.completedSeedGroups +
              " 个完整地图样本",
          ),
        ),
        h("span", { className: "tag" }, s.independentSeeds + " 独立种子"),
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
          {
            className: "primary",
            disabled: s.completedMatches === s.totalMatches,
          },
        ),
        button("暂停队列", () => controller.pause(active)),
        button("取消待运行", () => controller.cancelPending(active)),
      ),
      h(
        "p",
        { className: "muted", style: "margin:12px 0" },
        describeExperimentConfidence(s),
      ),
      h("h2", {}, "实际样本统计"),
      h("div", { className: "table-wrap" }, table),
      elo,
      h("h2", { style: "margin-top:16px" }, "分地图 / 时长 / 对阵"),
      facets,
      h("h2", { style: "margin-top:16px" }, "逐局回放"),
      h(
        "div",
        { className: "record-list" },
        results.slice(-20).map((r) =>
          h(
            "div",
            { className: "record-row" },
            h(
              "span",
              {},
              r.result.config.seed +
                " / " +
                r.result.config.durationMs / 1000 +
                "s",
            ),
            button("回放", () => onOpenReplay(r.result.replayId)),
          ),
        ),
      ),
      h("div", { className: "controls", style: "margin-top:16px" }, exports),
    );
  }
  controller.subscribe((e) => {
    if (e.id !== active) return;
    if (e.summary) render(e);
    if (e.error || e.progress?.error)
      status(message, e.error ?? e.progress.error, true);
    else if (e.progress?.timeMs)
      status(
        message,
        "当前单局 " + e.progress.timeMs / 1000 + " 秒，已保存恢复点",
      );
    else if (e.status)
      status(
        message,
        e.status === "paused"
          ? "队列已暂停"
          : "待运行任务已取消，已完成数据保留",
      );
  });
  renderForm();
  return { refresh, open };
}
