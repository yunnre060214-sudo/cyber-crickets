import { AGENT_META } from "../agents.js?v=20260928-strongest-v6";
import { COLORS, TEAM_NAMES } from "./constants.js?v=20260928-strongest-v6";
import { AGENT_REGISTRY } from "../agents/registry.js";
import { h, label, select, button, status } from "./dom.js";

export function createMatchSettings({ store, onChange = () => {} }) {
  const message = h("p", { className: "status", role: "status" }),
    body = h("div", { className: "settings-grid" });
  const update = (changes) => {
    try {
      store.edit(changes);
      status(message, "下次开始新局时应用");
      onChange(store.nextConfig);
      render();
    } catch (e) {
      status(message, e.message, true);
    }
  };
  function render() {
    const c = store.nextConfig,
      available = AGENT_REGISTRY.slice(0, c.mode === "classic" ? 18 : 21);
    body.replaceChildren(
      label(
        "模式",
        select(
          [
            ["standard", "标准控制"],
            ["migration", "资源迁移"],
            ["classic", "经典 1.0"],
          ],
          c.mode,
          (mode) =>
            update({
              mode,
              mapPreset: mode === "classic" ? "legacy" : "plain",
              entrants: c.entrants.map((e) => ({
                ...e,
                strategyId:
                  mode === "classic" &&
                  !AGENT_REGISTRY.slice(0, 18).some(
                    (a) => a.id === e.strategyId,
                  )
                    ? "strongest"
                    : e.strategyId,
              })),
            }),
          { name: "mode" },
        ),
      ),
      label(
        "地图",
        select(
          c.mode === "classic"
            ? [["legacy", "经典地图"]]
            : [
                ["plain", "平原"],
                ["basin", "盆地"],
                ["canyon", "峡谷"],
                ["ring", "环形"],
              ],
          c.mapPreset,
          (mapPreset) => update({ mapPreset }),
          { name: "map", disabled: c.mode === "classic" },
        ),
      ),
      label(
        "阵营数",
        select(
          [
            [4, "四方竞技"],
            [2, "1 对 1"],
          ],
          c.teamCount,
          (n) => {
            const teamCount = Number(n),
              entrants = Array.from(
                { length: teamCount },
                (_, i) =>
                  c.entrants[i] ?? {
                    participantId: "p" + i,
                    strategyId: c.mode === "classic" ? "random" : "ucb",
                  },
              );
            update({ teamCount, entrants, rotation: 0 });
          },
          { name: "teams" },
        ),
      ),
      label(
        "模拟时长 / 秒",
        h("input", {
          name: "duration",
          type: "number",
          min: 10,
          max: 1800,
          step: 1,
          value: c.durationMs / 1000,
          onchange: (e) =>
            update({ durationMs: Number(e.target.value) * 1000 }),
        }),
      ),
      label(
        "地图种子",
        h("input", {
          name: "seed",
          value: c.seed,
          maxLength: 256,
          onchange: (e) => update({ seed: e.target.value }),
        }),
      ),
      label(
        "出生位轮换",
        select(
          Array.from({ length: c.teamCount }, (_, i) => [i, "轮换 " + i]),
          c.rotation,
          (n) => update({ rotation: Number(n) }),
          { name: "rotation" },
        ),
      ),
      label(
        "统一工作预算",
        select(
          [
            ["fast", "快速 · 4096"],
            ["standard", "标准 · 8192"],
            ["deep", "深入 · 16384"],
          ],
          c.budgetProfile,
          (budgetProfile) => update({ budgetProfile }),
          { name: "budget" },
        ),
      ),
      ...c.entrants.map((e, i) =>
        label(
          ["绿方", "红方", "蓝方", "金方"][i] + "策略",
          select(
            available.map((a) => [a.id, a.name]),
            e.strategyId,
            (strategyId) =>
              update({
                entrants: c.entrants.map((x, j) =>
                  j === i ? { ...x, strategyId } : x,
                ),
              }),
            { name: "agent-" + i },
          ),
        ),
      ),
    );
  }
  render();
  return h(
    "div",
    {},
    body,
    h(
      "div",
      { className: "controls", style: "margin-top:12px" },
      [60, 90, 120, 180].map((n) =>
        button(n + " 秒", () => update({ durationMs: n * 1000 })),
      ),
    ),
    message,
  );
}

const DURATION_PRESETS = new Set([60, 90, 120, 180]);
const SPEED_PRESETS = new Set([1, 2, 4]);

const normalizeDuration = (value) => {
  const number = Number(value);
  return Math.min(
    1800,
    Math.max(10, Math.round(Number.isFinite(number) ? number : 90)),
  );
};
const normalizeSpeed = (value) => {
  const number = Number(value);
  const clamped = Math.min(
    20,
    Math.max(0.25, Number.isFinite(number) ? number : 1),
  );
  return Math.round(clamped * 4) / 4;
};

export function createSettingsController({
  el,
  lineup,
  makeSeed,
  onLineupChange,
}) {
  const selectedDuration = () =>
    el.duration.value === "custom"
      ? normalizeDuration(el.durationCustom.value)
      : normalizeDuration(el.duration.value);
  const selectedSpeed = () =>
    el.speed.value === "custom"
      ? normalizeSpeed(el.speedCustom.value)
      : normalizeSpeed(el.speed.value);

  function syncCustomSettingVisibility() {
    if (el.durationCustomGroup)
      el.durationCustomGroup.hidden = el.duration.value !== "custom";
    if (el.speedCustomGroup)
      el.speedCustomGroup.hidden = el.speed.value !== "custom";
  }

  function applyInitialQuery() {
    const params = new URLSearchParams(location.search);
    el.seed.value = params.get("seed")?.trim().slice(0, 64) || makeSeed();
    const requestedAgents = params.get("agents")?.split(",");
    if (
      requestedAgents?.length === 4 &&
      requestedAgents.every((key) => Object.hasOwn(AGENT_META, key))
    ) {
      lineup.splice(0, 4, ...requestedAgents);
    }
    const requestedDuration = Number(params.get("duration"));
    if (
      Number.isFinite(requestedDuration) &&
      requestedDuration >= 10 &&
      requestedDuration <= 1800
    ) {
      const duration = normalizeDuration(requestedDuration);
      if (DURATION_PRESETS.has(duration)) el.duration.value = String(duration);
      else {
        el.duration.value = "custom";
        el.durationCustom.value = String(duration);
      }
    }
    const requestedSpeed = Number(params.get("speed"));
    if (
      Number.isFinite(requestedSpeed) &&
      requestedSpeed >= 0.25 &&
      requestedSpeed <= 20
    ) {
      const speed = normalizeSpeed(requestedSpeed);
      if (SPEED_PRESETS.has(speed)) el.speed.value = String(speed);
      else {
        el.speed.value = "custom";
        el.speedCustom.value = String(speed);
      }
    }
    const initialRotation = Number(params.get("rotation"));
    el.rotation.value =
      Number.isInteger(initialRotation) &&
      initialRotation >= 0 &&
      initialRotation < 4
        ? String(initialRotation)
        : "0";
    syncCustomSettingVisibility();
  }

  function syncUrl() {
    const query = new URLSearchParams(location.search);
    query.set("seed", el.seed.value);
    query.set("rotation", el.rotation.value);
    query.set("agents", lineup.join(","));
    query.set("duration", String(selectedDuration()));
    query.set("speed", String(selectedSpeed()));
    history.replaceState(null, "", location.pathname + "?" + query.toString());
  }

  function renderTeamConfig() {
    el.cfg.innerHTML = "";
    lineup.forEach((strategy, id) => {
      const card = document.createElement("div");
      card.className = "team-card";
      const options = Object.entries(AGENT_META)
        .map(
          ([key, meta]) =>
            '<option value="' +
            key +
            '" ' +
            (strategy === key ? "selected" : "") +
            ">" +
            meta.name +
            "</option>",
        )
        .join("");
      card.innerHTML =
        '<div class="team-card-head"><div class="team-id"><i class="team-swatch" style="background:' +
        COLORS[id] +
        '"></i>' +
        TEAM_NAMES[id] +
        '</div><span class="agent-tier">' +
        AGENT_META[strategy].tier +
        '</span></div><select data-team="' +
        id +
        '">' +
        options +
        '</select><div class="strategy-desc" data-desc="' +
        id +
        '">' +
        AGENT_META[strategy].desc +
        "</div>";
      el.cfg.appendChild(card);
    });
    el.cfg.querySelectorAll("select").forEach(
      (select) =>
        (select.onchange = (event) => {
          const id = +event.target.dataset.team,
            key = event.target.value;
          lineup[id] = key;
          const description = el.cfg.querySelector('[data-desc="' + id + '"]');
          if (description) description.textContent = AGENT_META[key].desc;
          onLineupChange?.();
        }),
    );
  }

  return {
    applyInitialQuery,
    renderTeamConfig,
    selectedDuration,
    selectedSpeed,
    syncCustomSettingVisibility,
    syncUrl,
  };
}
