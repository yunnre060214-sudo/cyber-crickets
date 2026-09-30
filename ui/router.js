export const ROUTES = [
  "arena",
  "competition",
  "replay",
  "experiment",
  "agents",
];
export function decodeMatchQuery(search) {
  const p = new URLSearchParams(search),
    old =
      !p.has("mode") &&
      !p.has("map") &&
      (p.has("agents") || p.has("duration") || p.has("rotation")),
    configInput = {
      mode: p.get("mode") ?? (old ? "classic" : "standard"),
      mapPreset: p.get("map") ?? "plain",
    };
  if (p.has("seed")) configInput.seed = p.get("seed");
  if (p.has("duration"))
    configInput.durationMs = Number(p.get("duration")) * 1000;
  if (p.has("rotation")) configInput.rotation = Number(p.get("rotation"));
  if (p.has("agents"))
    configInput.entrants = p
      .get("agents")
      .split(",")
      .map((strategyId, i) => ({ participantId: "p" + i, strategyId }));
  if (p.has("entrants")) {
    if (p.get("entrants").length > 20000) throw Error("INVALID_URL");
    configInput.entrants = JSON.parse(p.get("entrants"));
  }
  if (configInput.entrants) configInput.teamCount = configInput.entrants.length;
  if (p.has("budget")) configInput.budgetProfile = p.get("budget");
  const n = Number(p.get("speed") ?? 1),
    speed =
      Number.isFinite(n) && n >= 0.25 && n <= 20 && (n * 4) % 1 === 0 ? n : 1;
  return {
    configInput,
    speed,
    route: ROUTES.includes(p.get("view")) ? p.get("view") : "arena",
  };
}
export function encodeMatchQuery(config, speed = 1) {
  const p = new URLSearchParams({
    seed: config.seed,
    rotation: config.rotation,
    agents: config.entrants.map((e) => e.strategyId).join(","),
    duration: config.durationMs / 1000,
    speed,
    mode: config.mode,
    map: config.mapPreset,
    budget: config.budgetProfile,
    entrants: JSON.stringify(config.entrants),
  });
  return "?" + p.toString();
}
export function createRouter({ root, routes }) {
  const navigate = (route) => {
    if (!ROUTES.includes(route)) route = "arena";
    root.querySelectorAll("[data-workspace]").forEach((el) => {
      el.hidden = el.dataset.workspace !== route;
    });
    root
      .querySelectorAll("[data-route]")
      .forEach((el) =>
        el.setAttribute(
          "aria-current",
          el.dataset.route === route ? "page" : "false",
        ),
      );
    routes[route]?.();
    const u = new URL(location.href);
    u.searchParams.set("view", route);
    history.replaceState({}, "", u);
  };
  root
    .querySelectorAll("[data-route]")
    .forEach((el) =>
      el.addEventListener("click", () => navigate(el.dataset.route)),
    );
  return { navigate };
}
