import {AGENT_META} from './agents.js';
import {Match, WIDTH, HEIGHT, CELL_COUNT} from './match.js';
import {vpRate} from './rules.js';
import {initTournamentUI} from './tournament-ui.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#arena'), ctx = canvas.getContext('2d');
const el = {
  timer: $('#timer'), state: $('#statePill'), start: $('#startBtn'),
  pause: $('#pauseBtn'), reset: $('#resetBtn'), duration: $('#duration'),
  speed: $('#speed'), cfg: $('#teamConfig'), score: $('#scoreboard'),
  feed: $('#feed'), banner: $('#eventBanner'), dialog: $('#resultDialog'),
  title: $('#winnerTitle'), summary: $('#winnerSummary'), results: $('#resultList'),
  insights: $('#resultInsights'), charts: $('#resultCharts'),
  again: $('#againBtn'), close: $('#closeResultBtn'), overlay: $('#overlayToggle'),
  seed: $('#seedInput'), rotation: $('#rotation'), newSeed: $('#newSeedBtn'),
  liveChart: $('#liveChart'), liveGrid: $('#liveChartGrid'), liveLines: $('#liveChartLines'),
  liveLegend: $('#liveChartLegend'), durationSummary: $('#durationSummary'), speedSummary: $('#speedSummary')
};
const COLORS = ['#ff5b5b', '#4f7cff', '#25b77a', '#9b6bff'];
const TEAM_NAMES = ['红方', '蓝方', '绿方', '紫方'];
const lineup = ['aco', 'minimax', 'qlearn', 'voronoi'];
const params = new URLSearchParams(location.search);
const makeSeed = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
el.seed.value = params.get('seed')?.trim().slice(0, 64) || makeSeed();
const requestedAgents = params.get('agents')?.split(',');
if (requestedAgents?.length === 4 && requestedAgents.every(key => Object.hasOwn(AGENT_META, key))) {
  lineup.splice(0, 4, ...requestedAgents);
}
if (['60', '90', '120'].includes(params.get('duration'))) el.duration.value = params.get('duration');
const initialRotation = Number(params.get('rotation'));
el.rotation.value = Number.isInteger(initialRotation) && initialRotation >= 0 && initialRotation < 4
  ? String(initialRotation) : '0';

let match, running = false, accumulator = 0, lastFrame = performance.now(), bannerTimer;
const formatTime = seconds => {
  const whole = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(whole / 60)).padStart(2, '0') + ':' +
    String(whole % 60).padStart(2, '0');
};

function syncUrl() {
  const query = new URLSearchParams(location.search);
  query.set('seed', el.seed.value);
  query.set('rotation', el.rotation.value);
  query.set('agents', lineup.join(','));
  query.set('duration', el.duration.value);
  history.replaceState(null, '', location.pathname + '?' + query.toString());
}

function config() {
  el.cfg.innerHTML = '';
  lineup.forEach((strategy, id) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    const options = Object.entries(AGENT_META).map(([key, meta]) =>
      '<option value="' + key + '" ' + (strategy === key ? 'selected' : '') + '>' + meta.name + '</option>').join('');
    card.innerHTML = '<div class="team-card-head"><div class="team-id"><i class="team-swatch" style="background:' +
      COLORS[id] + '"></i>' + TEAM_NAMES[id] + '</div><span class="agent-tier">' +
      AGENT_META[strategy].tier + '</span></div><select data-team="' + id + '">' + options +
      '</select><div class="strategy-desc" data-desc="' + id + '">' + AGENT_META[strategy].desc + '</div>';
    el.cfg.appendChild(card);
  });
  el.cfg.querySelectorAll('select').forEach(select => select.onchange = event => {
    const id = +event.target.dataset.team, key = event.target.value;
    lineup[id] = key;
    const description = el.cfg.querySelector('[data-desc="' + id + '"]');
    if (description) description.textContent = AGENT_META[key].desc;
    reset();
  });
}

function reset() {
  running = false; accumulator = 0; lastFrame = performance.now();
  el.seed.value = el.seed.value.trim().slice(0, 64) || makeSeed();
  syncUrl();
  match = new Match({
    seed: el.seed.value, rotation: +el.rotation.value,
    duration: +el.duration.value, strategies: [...lineup]
  });
  el.feed.innerHTML = '';
  log('种子 ' + match.seed + '，出生轮换 ' + (+el.rotation.value + 1) + '/4。');
  el.state.textContent = '待机';
  el.durationSummary.textContent = el.duration.value + 's';
  el.speedSummary.textContent = el.speed.value + '×';
  el.start.textContent = '开始比赛'; el.start.disabled = false;
  el.pause.textContent = '暂停'; el.pause.disabled = true;
  ui(); draw();
}

function start() {
  if (match.finished) reset();
  running = true; lastFrame = performance.now();
  el.start.textContent = '进行中'; el.start.disabled = true;
  el.pause.disabled = false; el.state.textContent = '交战中';
  log('回合开始：四方从相同地图快照决策。');
}

function pause() {
  running = !running;
  if (running) {
    lastFrame = performance.now(); el.pause.textContent = '暂停';
    el.start.disabled = true; el.state.textContent = '交战中';
    log('模拟继续。');
  } else {
    el.pause.textContent = '继续'; el.start.disabled = false;
    el.start.textContent = '继续比赛'; el.state.textContent = '已暂停';
    log('模拟暂停。');
  }
}

function loop(timestamp) {
  const dt = Math.min(.1, (timestamp - lastFrame) / 1000 || 0);
  lastFrame = timestamp;
  if (running) {
    accumulator += dt * (+el.speed.value);
    while (accumulator >= .035 && running) {
      for (const event of match.step(.035)) {
        banner(event.banner); log(event.log);
      }
      accumulator -= .035;
      if (match.finished) finish();
    }
    ui();
  }
  draw();
  requestAnimationFrame(loop);
}

function banner(message) {
  el.banner.textContent = message; el.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 2200);
}

function renderLiveChart() {
  const width=720,height=360,left=48,right=14,top=16,bottom=32;
  const snapshots=match.timeline;
  const current={time:match.time,teams:match.teams.map(team=>({id:team.id,score:team.score}))};
  const data=snapshots.at(-1)?.time===match.time?snapshots:[...snapshots,current];

  // VP/s 的理论上限是 10，因此整个回合从开始就使用固定 Y 轴。
  // 历史点一旦绘制，其 x/y 坐标不会因为后续分数增长而改变。
  const maxVP=match.duration*10;
  const x=time=>left+(width-left-right)*(time/match.duration);
  const y=value=>top+(height-top-bottom)*(1-Math.min(value,maxVP)/maxVP);
  const ticks=[0,.25,.5,.75,1];

  el.liveGrid.innerHTML=
    ticks.map(t=>'<line x1="'+left+'" y1="'+y(maxVP*t).toFixed(1)+'" x2="'+(width-right)+
      '" y2="'+y(maxVP*t).toFixed(1)+'" stroke="#e7ebf2" stroke-width="1"/>'+
      '<text x="'+(left-8)+'" y="'+(y(maxVP*t)+3).toFixed(1)+'" text-anchor="end" fill="#8b96a8" font-size="10">'+
      Math.round(maxVP*t)+'</text>').join('')+
    ticks.map(t=>'<line x1="'+x(match.duration*t).toFixed(1)+'" y1="'+top+'" x2="'+
      x(match.duration*t).toFixed(1)+'" y2="'+(height-bottom)+'" stroke="#f0f2f6" stroke-width="1"/>'+
      '<text x="'+x(match.duration*t).toFixed(1)+'" y="'+(height-9)+
      '" text-anchor="middle" fill="#8b96a8" font-size="10">'+Math.round(match.duration*t)+'s</text>').join('');

  el.liveLines.innerHTML=match.teams.map(team=>{
    const points=data.map(point=>{
      const sample=point.teams.find(item=>item.id===team.id);
      return x(point.time).toFixed(1)+','+y(sample?.score||0).toFixed(1);
    }).join(' ');
    const last=data.at(-1)?.teams.find(item=>item.id===team.id);
    const cx=x(data.at(-1)?.time||0).toFixed(1),cy=y(last?.score||0).toFixed(1);
    return '<polyline points="'+points+'" fill="none" stroke="'+COLORS[team.id]+
      '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'+
      '<circle cx="'+cx+'" cy="'+cy+'" r="4.5" fill="'+COLORS[team.id]+'" stroke="#fff" stroke-width="2"/>';
  }).join('');

  el.liveLegend.innerHTML=match.teams.map(team=>'<span><i style="background:'+COLORS[team.id]+
    '"></i>'+TEAM_NAMES[team.id]+' <b>'+team.score.toFixed(1)+'</b></span>').join('');
}
function ui() {
  el.timer.textContent = formatTime(match.duration - match.time);
  const teams = [...match.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...teams.map(team => team.score));
  renderLiveChart();
  el.score.innerHTML = teams.map((team, rank) => {
    const meta = AGENT_META[team.strategy], thought = team.agent.thought || '等待决策';
    const rate = vpRate(team.territory, CELL_COUNT, team.resources, match.resourceTotal);
    return '<div class="score-row"><div class="score-top"><div class="score-name"><span>' +
      (rank + 1) + '</span><i class="team-swatch" style="background:' + COLORS[team.id] +
      '"></i>' + meta.name + '</div><div class="score-number">' + team.score.toFixed(1) +
      ' VP</div></div><div class="bar"><i style="width:' + (team.score / maxScore * 100) +
      '%;background:' + COLORS[team.id] + '"></i></div><div class="score-meta"><span>领地 ' +
      (team.territory / CELL_COUNT * 100).toFixed(1) + '%</span><span>资源 ' +
      team.resources + '</span><span>翻色 ' + team.captures + '</span><span>' +
      rate.toFixed(2) + ' VP/s</span><span>' + team.thinkMs.toFixed(2) +
      'ms</span></div><div class="thinking"><b>正在想</b><span>' + thought +
      '</span></div></div>';
  }).join('');
}

function log(message) {
  const entry = document.createElement('div');
  entry.className = 'feed-item';
  const time = document.createElement('span');
  time.className = 'feed-time';
  time.textContent = formatTime(match.time);
  entry.appendChild(time);
  entry.appendChild(document.createTextNode(message));
  el.feed.prepend(entry);
  while (el.feed.children.length > 30) el.feed.lastChild.remove();
}

function averageMetrics(teamId) {
  const samples = match.timeline.length || 1;
  let territory = 0, resource = 0;
  for (const point of match.timeline) {
    const team = point.teams.find(item => item.id === teamId);
    territory += team.territory / CELL_COUNT;
    resource += point.resourceTotal ? team.resources / point.resourceTotal : 0;
  }
  return {territory: territory / samples, resource: resource / samples};
}

function leadChanges() {
  let previous = null, changes = 0;
  for (const point of match.timeline) {
    const leader = [...point.teams].sort((a, b) => b.score - a.score)[0]?.id;
    if (previous != null && leader !== previous) changes++;
    previous = leader;
  }
  return changes;
}

function chartSvg(metric, label, formatter) {
  const width = 520, height = 150, padX = 12, padY = 14;
  const series = match.teams.map(team => match.timeline.map(point => {
    const sample = point.teams.find(item => item.id === team.id);
    return metric(sample, point);
  }));
  const max = Math.max(1e-6, ...series.flat());
  const points = values => values.map((value, i) => {
    const x = padX + (width - padX * 2) * (values.length <= 1 ? 0 : i / (values.length - 1));
    const y = height - padY - (height - padY * 2) * value / max;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const lines = series.map((values, id) =>
    '<polyline points="' + points(values) + '" fill="none" stroke="' + COLORS[id] +
    '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
  ).join('');
  const endLabels = series.map((values, id) =>
    '<span><i style="background:' + COLORS[id] + '"></i>' + TEAM_NAMES[id] + ' ' +
    formatter(values.at(-1) || 0) + '</span>'
  ).join('');
  return '<article class="result-chart"><div class="result-chart-head"><strong>' + label +
    '</strong><small>0s → ' + Math.round(match.duration) + 's</small></div><svg viewBox="0 0 ' +
    width + ' ' + height + '" role="img" aria-label="' + label +
    '随时间变化"><path d="M12 136H508" stroke="#e7ebf2" stroke-width="1"/>' + lines +
    '</svg><div class="chart-legend">' + endLabels + '</div></article>';
}

function renderPostMatchAnalysis(teams, winner) {
  const metrics = match.teams.map(team => ({id: team.id, ...averageMetrics(team.id)}));
  const winnerMetrics = metrics.find(item => item.id === winner.id);
  const territoryRank = [...metrics].sort((a, b) => b.territory - a.territory);
  const resourceRank = [...metrics].sort((a, b) => b.resource - a.resource);
  let edge = '综合控制';
  let detail = '领地与资源的持续控制更均衡';
  if (territoryRank[0].id === winner.id && resourceRank[0].id !== winner.id) {
    edge = '领地控制'; detail = '整局平均领地占比排名第一';
  } else if (resourceRank[0].id === winner.id && territoryRank[0].id !== winner.id) {
    edge = '资源控制'; detail = '整局平均资源控制率排名第一';
  } else if (resourceRank[0].id === winner.id && territoryRank[0].id === winner.id) {
    edge = '双重控制'; detail = '平均领地与资源控制均排名第一';
  }
  el.insights.innerHTML =
    '<div class="insight-primary"><span>关键优势</span><strong>' + edge + '</strong><p>' + detail +
    '。平均领地 ' + (winnerMetrics.territory * 100).toFixed(1) + '%，平均资源控制 ' +
    (winnerMetrics.resource * 100).toFixed(1) + '%。</p></div>' +
    '<div class="insight-stat"><span>领先易手</span><strong>' + leadChanges() + '</strong><small>次</small></div>' +
    '<div class="insight-stat"><span>终局翻色</span><strong>' + winner.captures + '</strong><small>格</small></div>';
  el.charts.innerHTML =
    chartSvg((team) => team.score, 'VP 趋势', value => value.toFixed(1)) +
    chartSvg((team) => team.territory / CELL_COUNT * 100, '领地趋势', value => value.toFixed(1) + '%');
}

function finish() {
  running = false; ui(); el.state.textContent = '已结算';
  el.pause.disabled = true; el.start.disabled = false; el.start.textContent = '新一局';
  const teams = [...match.teams].sort((a, b) => b.score - a.score), winner = teams[0];
  el.title.textContent = TEAM_NAMES[winner.id] + '获胜 · ' + AGENT_META[winner.strategy].name;
  el.summary.textContent = '累计 ' + winner.score.toFixed(1) + ' VP，终局控制 ' +
    (winner.territory / CELL_COUNT * 100).toFixed(1) + '% 的战场。';
  el.results.innerHTML = teams.map((team, rank) =>
    '<div class="result-line"><span>' + (rank + 1) + '. ' + TEAM_NAMES[team.id] +
    ' · ' + AGENT_META[team.strategy].name + '</span><strong>' +
    team.score.toFixed(1) + ' VP</strong></div>').join('');
  renderPostMatchAnalysis(teams, winner);
  log(AGENT_META[winner.strategy].name + ' 以 ' + winner.score.toFixed(1) + ' VP 拿下本局。');
  el.dialog.showModal();
}

function draw() {
  const cw = canvas.width / WIDTH, ch = canvas.height / HEIGHT;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x, owner = match.owner[i], terrain = match.terrain[i];
    if (owner >= 0) {
      ctx.fillStyle = COLORS[owner]; ctx.globalAlpha = terrain === 3 ? .72 : terrain === 2 ? .84 : .96;
    } else {
      ctx.fillStyle = terrain === 3 ? '#c8ced8' : terrain === 2 ? '#dde2e9' : '#f3f5f8';
      ctx.globalAlpha = 1;
    }
    ctx.fillRect(x * cw, y * ch, cw + .4, ch + .4);
    if (match.resources[i]) {
      ctx.globalAlpha = 1; ctx.fillStyle = match.resources[i] === 3 ? '#ffb703' : '#ffd166';
      ctx.beginPath(); ctx.arc(x * cw + cw / 2, y * ch + ch / 2,
        match.resources[i] === 3 ? cw * .27 : cw * .18, 0, Math.PI * 2); ctx.fill();
    }
    if (match.core[i] >= 0) {
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, cw * .18);
      ctx.strokeRect(x * cw + cw * .18, y * ch + ch * .18, cw * .64, ch * .64);
    }
  }
  if (el.overlay.checked) drawThinking(cw, ch);
  ctx.globalAlpha = 1;
}

function drawThinking(cw, ch) {
  for (const team of match.teams) {
    const pheromone = team.agent.pheromone;
    if (pheromone) {
      let max = 0;
      for (const value of pheromone) if (value > max) max = value;
      if (max > 0) for (let i = 0; i < pheromone.length; i++) if (pheromone[i] > .15) {
        const x = i % WIDTH, y = Math.floor(i / WIDTH);
        ctx.fillStyle = COLORS[team.id];
        ctx.globalAlpha = Math.min(.28, pheromone[i] / max * .25);
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }
    const target = team.agent.lastChoice;
    if (target != null) {
      const x = target % WIDTH, y = Math.floor(target / WIDTH);
      ctx.globalAlpha = .95; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, cw * .18);
      ctx.strokeRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
    }
  }
}

el.start.onclick = start;
el.pause.onclick = pause;
el.reset.onclick = reset;
el.duration.onchange = () => { el.durationSummary.textContent = el.duration.value + 's'; if (!running) reset(); };
el.seed.onchange = reset;
el.rotation.onchange = reset;
el.speed.onchange = () => { el.speedSummary.textContent = el.speed.value + '×'; };
el.newSeed.onclick = () => { el.seed.value = makeSeed(); reset(); };
el.again.onclick = () => { el.dialog.close(); reset(); start(); };
el.close.onclick = () => el.dialog.close();
config(); reset(); initTournamentUI(); requestAnimationFrame(loop);
