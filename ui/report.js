import { AGENT_META } from "../agents.js?v=20260928-strongest-v6";
import { CELL_COUNT } from "../match.js?v=20260928-strongest-v6";
import { TEAM_NAMES } from "./constants.js?v=20260928-strongest-v6";
import { chartSvg } from "./chart.js?v=20260928-strongest-v6";

function averageMetrics(match, teamId) {
  const samples = match.timeline.length || 1;
  let territory = 0,
    resource = 0;
  for (const point of match.timeline) {
    const team = point.teams.find((item) => item.id === teamId);
    territory += team.territory / CELL_COUNT;
    resource += point.resourceTotal ? team.resources / point.resourceTotal : 0;
  }
  return { territory: territory / samples, resource: resource / samples };
}
function leadChanges(match) {
  let previous = null,
    changes = 0;
  for (const point of match.timeline) {
    const leader = [...point.teams].sort((a, b) => b.score - a.score)[0]?.id;
    if (previous != null && leader !== previous) changes++;
    previous = leader;
  }
  return changes;
}
export function renderPostMatchAnalysis({ match, el, winner }) {
  const metrics = match.teams.map((team) => ({
    id: team.id,
    ...averageMetrics(match, team.id),
  }));
  const winnerMetrics = metrics.find((item) => item.id === winner.id);
  const territoryRank = [...metrics].sort((a, b) => b.territory - a.territory);
  const resourceRank = [...metrics].sort((a, b) => b.resource - a.resource);
  let edge = "综合控制",
    detail = "领地与资源的持续控制更均衡";
  if (territoryRank[0].id === winner.id && resourceRank[0].id !== winner.id) {
    edge = "领地控制";
    detail = "整局平均领地占比排名第一";
  } else if (
    resourceRank[0].id === winner.id &&
    territoryRank[0].id !== winner.id
  ) {
    edge = "资源控制";
    detail = "整局平均资源控制率排名第一";
  } else if (
    resourceRank[0].id === winner.id &&
    territoryRank[0].id === winner.id
  ) {
    edge = "双重控制";
    detail = "平均领地与资源控制均排名第一";
  }
  el.insights.innerHTML =
    '<div class="insight-primary"><span>关键优势</span><strong>' +
    edge +
    "</strong><p>" +
    detail +
    "。平均领地 " +
    (winnerMetrics.territory * 100).toFixed(1) +
    "%，平均资源控制 " +
    (winnerMetrics.resource * 100).toFixed(1) +
    "%。</p></div>" +
    '<div class="insight-stat"><span>领先易手</span><strong>' +
    leadChanges(match) +
    "</strong><small>次</small></div>" +
    '<div class="insight-stat"><span>终局翻色</span><strong>' +
    winner.captures +
    "</strong><small>格</small></div>";
  el.charts.innerHTML =
    chartSvg({
      match,
      metric: (team) => team.score,
      label: "VP 趋势",
      formatter: (value) => value.toFixed(1),
    }) +
    chartSvg({
      match,
      metric: (team) => (team.territory / CELL_COUNT) * 100,
      label: "领地趋势",
      formatter: (value) => value.toFixed(1) + "%",
    });
}
export function renderMatchResult({ match, el }) {
  const teams = [...match.teams].sort((a, b) => b.score - a.score),
    winner = teams[0];
  el.title.textContent =
    TEAM_NAMES[winner.id] + "获胜 · " + AGENT_META[winner.strategy].name;
  el.summary.textContent =
    "累计 " +
    winner.score.toFixed(1) +
    " VP，终局控制 " +
    ((winner.territory / CELL_COUNT) * 100).toFixed(1) +
    "% 的战场。";
  el.results.innerHTML = teams
    .map(
      (team, rank) =>
        '<div class="result-line"><span>' +
        (rank + 1) +
        ". " +
        TEAM_NAMES[team.id] +
        " · " +
        AGENT_META[team.strategy].name +
        "</span><strong>" +
        team.score.toFixed(1) +
        " VP</strong></div>",
    )
    .join("");
  renderPostMatchAnalysis({ match, el, winner });
  return { teams, winner };
}
