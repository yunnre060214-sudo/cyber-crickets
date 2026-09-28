import {AGENT_META} from '../agents.js?v=20260928-strongest-v6';
import {CELL_COUNT, WIDTH, HEIGHT} from '../match.js?v=20260928-strongest-v6';
import {COLORS, TEAM_NAMES} from '../ui/constants.js?v=20260928-strongest-v6';

export const EXPORT_VERSION = '20260928-export-v2';
export const htmlSafe = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
export const mdSafe = value => htmlSafe(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
export const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—';
export const percent = value => number(value * 100, 1) + '%';
export const clock = value => {
  const seconds = Math.max(0, Math.floor(value));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
};
export const excerpt = (value, limit = 220) => {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  return text.length > limit ? text.slice(0, limit) + '…' : text;
};

function snapshot(match) {
  return {time: match.time, resourceTotal: match.resourceTotal,
    teams: match.teams.map(({id, score, territory, resources, captures}) =>
      ({id, score, territory, resources, captures}))};
}

function reportTimeline(match) {
  const points = match.timeline.filter(point => point.time <= match.time + 1e-9)
    .map(point => ({...point, teams: point.teams.map(team => ({...team}))}));
  const current = snapshot(match);
  if (points.at(-1)?.time === match.time) points[points.length - 1] = current;
  else points.push(current);
  return points;
}

function stateAt(points, time) {
  const right = points.findIndex(point => point.time >= time);
  if (right <= 0) return right === 0 ? points[0] : points.at(-1);
  const before = points[right - 1], after = points[right];
  const ratio = (time - before.time) / (after.time - before.time || 1);
  return {time, resourceTotal: before.resourceTotal + (after.resourceTotal - before.resourceTotal) * ratio,
    teams: before.teams.map(team => {
      const next = after.teams.find(item => item.id === team.id) || team;
      return {id: team.id, score: team.score + (next.score - team.score) * ratio};
    })};
}

function averageControl(points, id, elapsed) {
  if (!elapsed) return {averageTerritory: 0, averageResourceShare: 0};
  let territory = 0, resource = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dt = b.time - a.time;
    const left = a.teams.find(team => team.id === id), right = b.teams.find(team => team.id === id);
    territory += dt * (left.territory + right.territory) / 2;
    resource += dt * ((a.resourceTotal ? left.resources / a.resourceTotal : 0) +
      (b.resourceTotal ? right.resources / b.resourceTotal : 0)) / 2;
  }
  return {averageTerritory: territory / elapsed, averageResourceShare: resource / elapsed};
}

function uniqueLeader(point) {
  const sorted = [...point.teams].sort((a, b) => b.score - a.score);
  return sorted[0]?.score > (sorted[1]?.score ?? -Infinity) + 1e-9 ? sorted[0].id : null;
}

function leadHistory(points) {
  let previous = null;
  const events = [];
  for (const point of points) {
    const leader = uniqueLeader(point);
    if (leader == null) continue;
    if (previous != null && leader !== previous) events.push({time: point.time, from: previous, to: leader});
    previous = leader;
  }
  return {total: events.length, events};
}

function sampleItems(items, limit) {
  if (items.length <= limit) return [...items];
  return Array.from({length: limit}, (_, i) => items[Math.round(i * (items.length - 1) / (limit - 1))]);
}

function chartSamples(points, importantTimes, limit = 120) {
  if (points.length <= limit) return points;
  const chosen = new Set([0, points.length - 1]);
  for (const time of importantTimes) {
    let nearest = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(points[i].time - time) < Math.abs(points[nearest].time - time)) nearest = i;
    chosen.add(nearest);
  }
  for (const point of sampleItems(points, limit - chosen.size)) chosen.add(points.indexOf(point));
  return [...chosen].sort((a, b) => a - b).map(i => points[i]);
}

function emptyActions() {
  return {total: 0, settled: 0, successes: 0, failures: 0, pending: 0, successRate: null,
    expansions: 0, captures: 0, resourceAttempts: 0, resourceWins: 0,
    longestFailedTargetRun: 0, meanThinkMs: 0, meanPressure: 0};
}

function addAction(stats, decision) {
  stats.total++;
  stats.meanThinkMs += decision.thinkMs || 0;
  stats.meanPressure += decision.localPressure || 0;
  if (decision.target.resource > 0) stats.resourceAttempts++;
  if (!decision.result) { stats.pending++; return; }
  stats.settled++;
  if (!decision.result.success) { stats.failures++; return; }
  stats.successes++;
  const previous = decision.result.previousOwner ?? decision.target.owner;
  if (previous < 0) stats.expansions++;
  else if (previous !== decision.teamId) stats.captures++;
  if (decision.target.resource > 0) stats.resourceWins++;
}

function finishActions(stats) {
  stats.successRate = stats.settled ? stats.successes / stats.settled : null;
  if (stats.total) {
    stats.meanThinkMs /= stats.total;
    stats.meanPressure /= stats.total;
  }
  return stats;
}

function phaseRanges(match) {
  const names = ['开局扩张', '资源潮汐', '核心节点', '终局超频'];
  const starts = [0, ...[.33, .62, .82].map((ratio, index) => match.eventLog[index]?.time ?? match.duration * ratio)];
  return starts.map((start, index) => ({index, name: names[index], start,
    end: Math.min(match.time, starts[index + 1] ?? match.duration),
    event: index ? match.eventLog[index - 1]?.message : '四方从核心区向外扩张。'}))
    // Events precede decisions within a tick, so an event at export time has already started its phase.
    .filter(phase => phase.start < match.time || phase.index === 0 ||
      (phase.start === match.time && match.eventLog[phase.index - 1]));
}

export function buildReportModel({match, running = false, speedValue = 1}) {
  const timeline = reportTimeline(match), phases = phaseRanges(match);
  const teams = [...match.teams].sort((a, b) => b.score - a.score || a.id - b.id).map(team => ({
    id: team.id, strategy: team.strategy, name: AGENT_META[team.strategy]?.name || team.strategy,
    label: TEAM_NAMES[team.id] + ' · ' + (AGENT_META[team.strategy]?.name || team.strategy),
    color: COLORS[team.id], description: AGENT_META[team.strategy]?.desc || '',
    rank: 1 + match.teams.filter(other => other.score > team.score + 1e-9).length,
    score: team.score, territory: team.territory, resources: team.resources, captures: team.captures,
    resourceShare: match.resourceTotal ? team.resources / match.resourceTotal : 0,
    ...averageControl(timeline, team.id, match.time), actions: emptyActions()
  }));
  const byId = new Map(teams.map(team => [team.id, team]));
  for (const phase of phases) phase.teams = teams.map(team => ({id: team.id, actions: emptyActions()}));
  const evidence = new Map(teams.map(team => [team.id, {phases: new Map(), resources: [], captures: [],
    failedTarget: null, failureRun: 0, longestFailure: null, last: null}]));
  for (const decision of match.decisionLog) {
    const team = byId.get(decision.teamId);
    if (!team) continue;
    const phase = phases.findLast(item => decision.time >= item.start) || phases[0];
    addAction(team.actions, decision);
    addAction(phase.teams.find(item => item.id === team.id).actions, decision);
    const pool = evidence.get(team.id);
    if (!pool.phases.has(phase.index)) pool.phases.set(phase.index, {decision, reason: phase.name + '首个动作', priority: 12});
    pool.last = {decision, reason: '最近一个动作', priority: 15};
    if (decision.result?.success && decision.target.resource > 0) {
      pool.resources.push({decision, reason: '成功夺取价值 ' + decision.target.resource + ' 的资源格', priority: 40 + decision.target.resource * 3});
      pool.resources.sort((a, b) => b.priority - a.priority || a.decision.time - b.decision.time);
      pool.resources.length = Math.min(pool.resources.length, 2);
    }
    if (decision.result?.success && decision.target.enemy) {
      pool.captures.push({decision, reason: decision.target.resource ? '夺取敌方资源' : '成功翻色', priority: 35 + decision.target.resource * 4});
      pool.captures.sort((a, b) => b.priority - a.priority || a.decision.time - b.decision.time);
      pool.captures.length = Math.min(pool.captures.length, 1);
    }
    if (decision.result && !decision.result.success) {
      pool.failureRun = pool.failedTarget === decision.to.index ? pool.failureRun + 1 : 1;
      pool.failedTarget = decision.to.index;
      if (pool.failureRun > team.actions.longestFailedTargetRun) {
        team.actions.longestFailedTargetRun = pool.failureRun;
        pool.longestFailure = {decision, reason: '同一目标连续失败 ' + pool.failureRun + ' 次', priority: 50};
      }
    } else if (decision.result) { pool.failureRun = 0; pool.failedTarget = null; }
  }
  for (const phase of phases) {
    const before = stateAt(timeline, phase.start), after = stateAt(timeline, phase.end);
    for (const team of phase.teams) {
      finishActions(team.actions);
      team.vpGain = after.teams.find(item => item.id === team.id).score - before.teams.find(item => item.id === team.id).score;
    }
  }
  for (const team of teams) finishActions(team.actions);
  const selectedDecisions = teams.flatMap(team => {
    const pool = evidence.get(team.id), candidates = [...pool.phases.values(), ...pool.resources, ...pool.captures];
    if (pool.last) candidates.push(pool.last);
    if (team.actions.longestFailedTargetRun >= 3) candidates.push(pool.longestFailure);
    const unique = new Map();
    for (const candidate of candidates) if (!unique.has(candidate.decision.seq) ||
      candidate.priority > unique.get(candidate.decision.seq).priority) unique.set(candidate.decision.seq, candidate);
    return [...unique.values()].sort((a, b) => b.priority - a.priority || a.decision.time - b.decision.time)
      .slice(0, 6).sort((a, b) => a.decision.time - b.decision.time)
      .map(({decision, reason}) => ({...decision, reason, thought: excerpt(decision.thought),
        from: {...decision.from}, to: {...decision.to}, target: {...decision.target},
        result: decision.result ? {...decision.result} : null}));
  });
  const leaders = teams.filter(team => team.rank === 1), leadChanges = leadHistory(timeline);
  const shownLeadChanges = sampleItems(leadChanges.events, 12);
  return {
    seed: match.seed, duration: match.duration, elapsed: match.time, rotation: match.rotation,
    speedValue, finished: match.finished,
    status: match.finished ? '已结束' : running ? '进行中' : match.time > 0 ? '已暂停' : '尚未开始',
    outcomeLabel: match.time === 0 ? '尚未开始' : leaders.length > 1 ?
      (match.finished ? '并列第一' : '并列领先') : match.finished ? '获胜' : '当前领先',
    teams, leaders, margin: teams[0].score - (teams[1]?.score ?? 0),
    timeline, chartPoints: chartSamples(timeline, [...match.eventLog.map(event => event.time), ...shownLeadChanges.map(event => event.time)]),
    phases, leadChanges, shownLeadChanges, events: match.eventLog.map(event => ({...event})), selectedDecisions,
    decisionCount: match.decisionLog.length, snapshotCount: match.timeline.length,
    resourceTotal: match.resourceTotal, cellCount: CELL_COUNT, width: WIDTH, height: HEIGHT,
    map: {owner: Array.from(match.owner), resources: Array.from(match.resources), core: Array.from(match.core)},
    exportedAt: new Date().toISOString()
  };
}

export function buildFullData({match, running = false, speedValue = 1}) {
  return {
    format: 'cyber-crickets.match-log', formatVersion: 2,
    metadata: {seed: match.seed, rotation: match.rotation, duration: match.duration, time: match.time,
      finished: match.finished, running, speedValue, exportedAt: new Date().toISOString(),
      exportVersion: EXPORT_VERSION, simulationVersion: '20260928-strongest-v6',
      vpFormula: '10 * (0.65 * territory / 4096 + 0.35 * resources / resourceTotal)',
      notes: {reward: '动作反馈，不加入 VP', thinkMs: '本机墙钟耗时，不参与结算',
        resources: '控制资源的价值，不是资源节点数量', owner: '-1 表示无主；其他数字为阵营 id',
        coordinates: '左上角为 (0,0)，index = y * width + x',
        replay: '同一模拟版本、种子、阵容、时长与出生轮换可复现；数据不含可恢复的随机流内部状态'}},
    teams: match.teams.map(team => ({id: team.id, strategy: team.strategy,
      name: AGENT_META[team.strategy]?.name || team.strategy, color: COLORS[team.id],
      spawn: [...match.spawns[team.id]]})),
    snapshot: {...snapshot(match), map: {width: WIDTH, height: HEIGHT,
      owner: Array.from(match.owner), terrain: Array.from(match.terrain),
      resources: Array.from(match.resources), core: Array.from(match.core)}},
    timeline: match.timeline, events: match.eventLog, decisions: match.decisionLog
  };
}
