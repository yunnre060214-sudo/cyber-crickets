import { h, button, label, status } from "./dom.js";
import { createMatchSettings } from "./settings.js";
import { encodeMatchQuery } from "./router.js";
export function createArena({
  root,
  clientFactory,
  store,
  onCapture = () => {},
  speed: initialSpeed = 1,
}) {
  let client,
    speed = initialSpeed,
    renderer = null,
    latestSavedTime = 0;
  const name = h("span", { className: "tag" }, "就绪"),
    message = h("p", { className: "status", role: "status" }),
    clock = h(
      "span",
      {},
      "0.0 / " + store.activeConfig.durationMs / 1000 + " 秒",
    ),
    seed = h("span", {}),
    canvas = h("canvas", {
      width: 640,
      height: 640,
      "aria-label": "64 × 64 算法竞技地图",
    }),
    scores = h("div", { className: "standings" }),
    chart = h("div", { className: "chart-panel" }),
    trace = h("div", { className: "trace" }),
    feed = h("div", { className: "event-feed" }),
    config = h("div", { className: "arena-config", hidden: true }),
    samples = [];
  const toggle = button(
      "比赛设置",
      () => {
        config.hidden = !config.hidden;
        toggle.setAttribute("aria-expanded", String(!config.hidden));
        if (!config.hidden) close.focus();
      },
      { "aria-expanded": "false", "aria-controls": "arena-settings" },
    ),
    close = button("收起设置", () => {
      config.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    });
  config.id = "arena-settings";
  config.append(
    h("div", { className: "panel-head" }, h("h2", {}, "下一局设置"), close),
    createMatchSettings({
      store,
      onChange: () => status(message, "设置已修改，下一局生效"),
    }),
  );
  async function run(fresh = false, checkpoint = null) {
    try {
      if (fresh) store.edit({ seed: crypto.randomUUID().slice(0, 8) });
      if (client) await client.dispose();
      store.activate();
      samples.length = 0;
      latestSavedTime = 0;
      client = clientFactory(store.activeConfig, { checkpoint });
      client.subscribe(async (m) => {
        if (m.type === "snapshot") {
          store.snapshot = m.payload;
          draw(m.payload);
          if (m.payload.timeMs - latestSavedTime >= 5000) {
            latestSavedTime = m.payload.timeMs;
            try {
              await onCapture(await client.capture(), client.matchId, false);
            } catch (e) {
              status(message, "保存失败：" + e.message, true);
            }
          }
        }
        if (m.type === "result") {
          store.status = "finished";
          name.textContent = "已结算";
          pause.textContent = "已结束";
          pause.disabled = true;
          try {
            await onCapture(await client.capture(), client.matchId, true);
            status(message, "比赛已结算");
          } catch (e) {
            status(message, "比赛已结算，保存失败：" + e.message, true);
          }
        }
        if (m.type === "error") status(message, m.payload.code, true);
      });
      await client.setSpeed(speed);
      await client.start();
      store.status = "running";
      name.textContent = "运行中";
      pause.disabled = false;
      pause.textContent = "暂停";
      status(message, "相同配置与种子可复现结果");
      history.replaceState(
        {},
        "",
        location.pathname + encodeMatchQuery(store.activeConfig, speed),
      );
    } catch (e) {
      status(message, e.message, true);
    }
  }
  const pause = button(
    "暂停",
    async () => {
      if (!client) return;
      if (store.status === "running") {
        await client.pause();
        store.status = "paused";
        name.textContent = "已暂停";
        pause.textContent = "继续";
      } else if (store.status === "paused") {
        await client.resume();
        store.status = "running";
        name.textContent = "运行中";
        pause.textContent = "暂停";
      }
    },
    { disabled: true },
  );
  const speedInput = h("input", {
    type: "number",
    name: "speed",
    value: speed,
    min: 0.25,
    max: 20,
    step: 0.25,
    style: "width:80px",
    onchange: async (e) => {
      const n = Number(e.target.value);
      if (n < 0.25 || n > 20 || (n * 4) % 1 || !Number.isFinite(n)) {
        status(message, "倍速范围 0.25～20，步进 0.25", true);
        e.target.value = speed;
        return;
      }
      speed = n;
      await client?.setSpeed(speed);
    },
  });
  const start = button("开始新局", () => run(), { className: "primary" }),
    fresh = button("新种子", () => run(true));
  root.replaceChildren(
    h(
      "div",
      { className: "workspace-head" },
      h(
        "div",
        {},
        h("h1", {}, "竞技场"),
        h("p", {}, "配置策略，观察争夺，留下可复现的比赛。"),
      ),
      name,
    ),
    h(
      "div",
      { className: "panel" },
      h(
        "div",
        { className: "arena-toolbar" },
        h("div", { className: "controls" }, start, pause, fresh, toggle),
        h(
          "div",
          { className: "controls" },
          label("播放倍速", speedInput),
          button("分享本局", async () => {
            try {
              const u =
                location.origin +
                location.pathname +
                encodeMatchQuery(store.activeConfig, speed);
              await navigator.clipboard.writeText(u);
              status(message, "本局链接已复制");
            } catch {
              status(
                message,
                location.origin +
                  location.pathname +
                  encodeMatchQuery(store.activeConfig, speed),
              );
            }
          }),
          button("保存 / 导出", async () => {
            if (client)
              try {
                await onCapture(
                  await client.capture(),
                  client.matchId,
                  store.status === "finished",
                  true,
                );
              } catch (e) {
                status(message, e.message, true);
              }
          }),
        ),
      ),
      config,
      h(
        "div",
        { className: "metrics" },
        clock,
        seed,
        h("span", {}, "20 ms tick · 100 ms 同步决策"),
      ),
      h(
        "div",
        { className: "arena-grid" },
        h(
          "div",
          { className: "battlefield" },
          h(
            "div",
            { className: "map-bar" },
            h("h2", {}, "控制地图"),
            h("div", { id: "mapLayers" }),
          ),
          h("div", { className: "map-frame" }, canvas),
          h(
            "div",
            { className: "map-caption" },
            h("span", {}, "■ 核心 · ◆ 资源 · ▧ 障碍"),
            h("span", {}, "面积 65% + 资源 35%"),
          ),
        ),
        h(
          "aside",
          { className: "arena-side" },
          h(
            "div",
            { className: "panel-head" },
            h("h2", {}, "实时榜单"),
            h("small", {}, "VP · 累计积分"),
          ),
          scores,
          trace,
          feed,
        ),
      ),
      chart,
    ),
    message,
  );
  function draw(s) {
    clock.textContent =
      (s.timeMs / 1000).toFixed(1) +
      " / " +
      store.activeConfig.durationMs / 1000 +
      " 秒";
    seed.textContent =
      store.activeConfig.seed +
      " · " +
      store.activeConfig.mode +
      " / " +
      store.activeConfig.mapPreset;
    if (
      !samples.length ||
      s.timeMs - samples.at(-1).timeMs >= 1000 ||
      s.finished
    )
      samples.push({ timeMs: s.timeMs, teams: s.teams.map((t) => ({ ...t })) });
    if (renderer) {
      renderer({ snapshot: s, canvas, scores, chart, trace, feed, samples });
      return;
    }
    const ctx = canvas.getContext("2d"),
      b = s.board;
    for (let i = 0; i < 4096; i++) {
      ctx.fillStyle = b.blocked[i]
        ? "#353f3c"
        : b.owner[i] < 0
          ? "#f1f3ed"
          : ["#247858", "#b54b49", "#3473b2", "#9a7729"][b.owner[i]];
      ctx.fillRect((i % 64) * 10, Math.floor(i / 64) * 10, 10, 10);
    }
    scores.replaceChildren(
      ...s.teams.map((t) =>
        h("p", {}, t.strategyId + " · " + t.score.toFixed(2) + " VP"),
      ),
    );
  }
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden && store.status === "running") {
      await client?.pause();
      store.status = "paused";
      name.textContent = "后台已暂停";
      pause.textContent = "继续";
    }
  });
  return {
    run,
    resume: async (checkpoint) => {
      store.nextConfig = checkpoint.config;
      await run(false, checkpoint);
    },
    setRenderer(fn) {
      renderer = fn;
      if (store.snapshot) draw(store.snapshot);
    },
    get client() {
      return client;
    },
    store,
    canvas,
    root,
  };
}
