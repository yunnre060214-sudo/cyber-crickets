import { h, button, label, status, select } from "./dom.js";
import { ReplayPlayer } from "../replay/player.js";
import { buildReplayPackage } from "../replay/ledger.js";
import { renderArenaMap } from "./map-renderer.js";
import { renderArenaScoreboard } from "./scoreboard.js";
import { renderDecisionTrace } from "./decision-trace.js";
import { createMatchExport, saveMatchExport } from "../export/download.js";
import { importPackage } from "../export/import.js";
export function createReplayWorkspace({
  root,
  store,
  onResume = () => {},
  onImportJob = () => {},
}) {
  let current,
    player,
    timer = null;
  const records = h("div", { className: "record-list" }),
    detail = h("div", {}),
    message = h("p", { className: "status", role: "status" }),
    input = h("input", {
      type: "file",
      accept: ".json,.gz,application/json,application/gzip",
      "aria-label": "导入比赛数据",
      onchange: async (e) => {
        try {
          const r = await importPackage(e.target.files[0], {
            store: await store,
          });
          if (r.type === "match") await open(r.package);
          else await onImportJob(r.type, r.id);
          await refresh();
          status(
            message,
            "导入成功" + (r.archive ? "，旧数据仅作为真实历史档案" : ""),
          );
        } catch (err) {
          status(message, "导入失败：" + err.message, true);
        }
        e.target.value = "";
      },
    });
  root.replaceChildren(
    h(
      "div",
      { className: "workspace-head" },
      h(
        "div",
        {},
        h("h1", {}, "回放分析"),
        h("p", {}, "从账本重建每一刻，查看积分来源和真实行动。"),
      ),
    ),
    h(
      "div",
      { className: "workspace-grid" },
      h(
        "aside",
        { className: "panel" },
        h(
          "div",
          { className: "panel-head" },
          h("h2", {}, "本地比赛"),
          button("刷新", refresh),
        ),
        h("div", { className: "panel-body" }, input, records),
      ),
      h("div", { className: "stack" }, detail, message),
    ),
  );
  async function refresh() {
    try {
      const s = await store,
        list = await s.list({ type: "match", limit: 30 });
      records.replaceChildren(
        ...list.items.map((r) =>
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
                r.index.archive
                  ? "旧版档案"
                  : (r.index.timeMs / 1000).toFixed(1) +
                      "s · " +
                      (r.index.finished ? "已结束" : "可继续"),
              ),
            ),
            button("打开", () => open(r.id)),
          ),
        ),
      );
      if (!list.items.length)
        records.replaceChildren(
          h(
            "p",
            { className: "muted", style: "margin-top:12px" },
            "比赛每 5 模拟秒自动保存；也可导入数据文件。",
          ),
        );
    } catch (e) {
      status(message, "读取失败：" + e.message, true);
    }
  }
  async function open(value) {
    clearInterval(timer);
    try {
      if (typeof value === "string") {
        const s = await store;
        current =
          (await s.getPackage(value)) ??
          buildReplayPackage(await s.loadMatch(value));
      } else current = value;
      if (current.format === "cyber-crickets.archive") {
        const original = current.original;
        detail.replaceChildren(
          h(
            "article",
            { className: "panel panel-body" },
            h("h2", {}, "经典数据档案"),
            h(
              "p",
              {},
              "仅展示旧文件实际保存的棋盘、统计与决策。此文件无法恢复运行，也不具备逐 tick 回放数据。",
            ),
            h(
              "pre",
              {},
              JSON.stringify(
                {
                  metadata: original.metadata,
                  teams: original.snapshot?.teams,
                  events: original.events,
                },
                null,
                2,
              ),
            ),
          ),
        );
        return;
      }
      if (current.format !== "cyber-crickets.replay")
        throw Error("NOT_A_MATCH_REPLAY");
      player = new ReplayPlayer(current);
      const canvas = h("canvas", { width: 640, height: 640 }),
        scores = h("div", { className: "standings" }),
        trace = h("div", { className: "trace" }),
        analysis = h("div", { className: "panel-body" }),
        time = h("span", { className: "tag" }),
        slider = h("input", {
          type: "range",
          min: 0,
          max: current.summary.timeMs,
          step: current.config.tickMs,
          value: current.summary.timeMs,
          "aria-label": "回放时间",
          style: "width:100%",
          oninput: () => draw(Number(slider.value)),
        }),
        play = button("播放", () => {
          if (timer) {
            clearInterval(timer);
            timer = null;
            play.textContent = "播放";
          } else {
            if (Number(slider.value) >= current.summary.timeMs)
              slider.value = 0;
            timer = setInterval(() => {
              draw(
                Math.min(current.summary.timeMs, Number(slider.value) + 100),
              );
              if (Number(slider.value) >= current.summary.timeMs) {
                clearInterval(timer);
                timer = null;
                play.textContent = "播放";
              }
            }, 100);
            play.textContent = "暂停";
          }
        }),
        step = (delta) => {
          const n = Number(slider.value),
            r =
              delta > 0
                ? current.tickRecords.find((r) => r.timeMs > n + 1e-8)
                : current.tickRecords.findLast((r) => r.timeMs < n - 1e-8);
          draw(r?.timeMs ?? 0);
        };
      let layer = "territory",
        selected = current.config.entrants[0].participantId;
      function draw(t) {
        const snapshot = player.seek(t);
        slider.value = snapshot.timeMs;
        time.textContent = (snapshot.timeMs / 1000).toFixed(2) + " 秒";
        renderArenaMap({
          canvas,
          snapshot,
          layers: {
            territory: layer !== "terrain",
            resources: true,
            terrain: layer === "terrain",
            path: true,
            targets: true,
          },
          selectedParticipant: selected,
        });
        renderArenaScoreboard(scores, snapshot);
        const team = snapshot.teams.find((t) => t.participantId === selected);
        renderDecisionTrace(trace, team?.lastMove?.explain, team);
      }
      detail.replaceChildren(
        h(
          "div",
          { className: "panel" },
          h(
            "div",
            { className: "panel-head" },
            h("h2", {}, current.config.seed + " · " + current.config.mode),
            time,
          ),
          h(
            "div",
            { className: "arena-toolbar" },
            h(
              "div",
              { className: "controls" },
              play,
              button("上一 tick", () => step(-1)),
              button("下一 tick", () => step(1)),
              button("继续此存档", () => onResume(current.checkpoint), {
                disabled: current.summary.finished || !current.checkpoint,
              }),
            ),
            h(
              "div",
              { className: "controls" },
              select(
                [
                  ["territory", "领地"],
                  ["terrain", "地形"],
                ],
                layer,
                (v) => {
                  layer = v;
                  draw(Number(slider.value));
                },
              ),
              select(
                current.config.entrants.map((e) => [
                  e.participantId,
                  e.strategyId,
                ]),
                selected,
                (v) => {
                  selected = v;
                  draw(Number(slider.value));
                },
              ),
            ),
          ),
          h(
            "div",
            { className: "panel-body" },
            slider,
            h(
              "div",
              { className: "controls" },
              current.tickRecords
                .flatMap((r) => r.events)
                .map((e) =>
                  button(e.label ?? e.banner ?? "事件", () => draw(e.timeMs)),
                ),
              current.summary.leadChanges
                .slice(0, 6)
                .map((e) =>
                  button("领先 " + (e.timeMs / 1000).toFixed(1) + "s", () =>
                    draw(e.timeMs),
                  ),
                ),
            ),
          ),
          h(
            "div",
            { className: "arena-grid" },
            h(
              "div",
              { className: "battlefield" },
              h("div", { className: "map-frame" }, canvas),
            ),
            h("aside", { className: "arena-side" }, scores, trace),
          ),
          analysis,
          h(
            "div",
            { className: "arena-toolbar" },
            h(
              "div",
              { className: "controls" },
              [
                ["html", "HTML 战报"],
                ["markdown", "Markdown 摘要"],
                ["data", "完整 JSON.gz"],
              ].map(([format, text]) =>
                button(text, async () => {
                  try {
                    saveMatchExport(await createMatchExport(current, format));
                    status(message, "已导出 " + text);
                  } catch (e) {
                    status(message, e.message, true);
                  }
                }),
              ),
            ),
          ),
        ),
      );
      analysis.replaceChildren(
        h("h2", {}, "实际贡献与保有"),
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
                ["参赛者", "面积 VP", "资源 VP", "价值·秒", "翻色 / 反抢"].map(
                  (t) => h("th", {}, t),
                ),
              ),
            ),
            h(
              "tbody",
              {},
              current.summary.teams.map((t) =>
                h(
                  "tr",
                  {},
                  h("td", {}, t.participantId),
                  h("td", {}, t.areaVP.toFixed(3)),
                  h("td", {}, t.resourceVP.toFixed(3)),
                  h("td", {}, t.resourceValueSeconds.toFixed(2)),
                  h("td", {}, t.captures + " / " + t.recaptures),
                ),
              ),
            ),
          ),
        ),
      );
      draw(current.summary.timeMs);
      status(message, "回放仅应用已记录的变化，不重新运行策略。");
    } catch (e) {
      status(message, "打开失败：" + e.message, true);
    }
  }
  return { refresh, open };
}
