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
  liveLegend: $('#liveChartLegend'), durationSummary: $('#durationSummary'), speedSummary: $('#speedSummary'),
  exportLog: $('#exportLogBtn')
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


const mdSafe = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const ownerName = id => id >= 0 ? TEAM_NAMES[id] : '无主';
const terrainName = value => ({1:'普通',2:'复杂',3:'高阻力'}[value] || String(value));
const fmtLog = value => Number.isFinite(value) ? Number(value).toFixed(3) : 'N/A';

function buildMarkdownLog() {
  const status = match.finished ? '已结束' : running ? '进行中' : match.time > 0 ? '已暂停 / 未结束' : '尚未开始';
  const ranking = [...match.teams].sort((a,b)=>b.score-a.score);
  const lines = [
    '# Cyber Crickets 对局完整日志','',
    '> 这是一份由「赛博斗蛐蛐 / Cyber Crickets」自动导出的单局 Markdown 对局档案。它不仅记录比赛结果，还保存比赛配置、算法信息、重大事件、宏观时间序列和逐次算法决策。设计目标是让一个没有看过原网页、没有任何前置聊天上下文的 AI，仅凭本文件就能分析各算法为什么这样行动、哪些决策有效或失误、局势如何演化、胜负由什么造成，以及策略可以如何改进。','',
    '> 阅读约定：算法的 thought 是当次决策的简短可解释说明；决策前状态和结算结果是实际引擎记录。算法名称只代表策略风格，具体行为应以策略说明和本日志数据为准。','',
    '## 1. 对局元数据','',
    '| 字段 | 值 |','| --- | --- |',
    '| 状态 | '+status+' |',
    '| 地图 | '+WIDTH+' × '+HEIGHT+' |',
    '| 地图种子 | '+mdSafe(match.seed)+' |',
    '| 出生轮换 | '+(match.rotation+1)+'/4 |',
    '| 设定时长 | '+match.duration+' 秒 |',
    '| 已进行 | '+match.time.toFixed(3)+' 秒 |',
    '| 模拟速度（导出时 UI 设置） | '+mdSafe(el.speed.value)+'× |',
    '| 计分公式 | VP/sec = 10 × (0.65 × AreaShare + 0.35 × ResourceShare) |',
    '| 决策总数 | '+match.decisionLog.length+' |',
    '| 重大事件数 | '+match.eventLog.length+' |','',
    '## 2. 参赛算法',''
  ];
  match.teams.forEach(team=>{
    const meta=AGENT_META[team.strategy];
    lines.push('### '+TEAM_NAMES[team.id]+'：'+meta.name,'',
      '- 策略键：'+team.strategy,
      '- 类型：'+meta.tier,
      '- 策略说明：'+meta.desc,
      '- 出生点：('+match.spawns[team.id][0]+', '+match.spawns[team.id][1]+')','');
  });
  lines.push('## 3. 当前 / 最终结果','',
    '| 排名 | 阵营 | 算法 | VP | 领地 | 资源价值 | 翻色 |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: |');
  ranking.forEach((team,i)=>lines.push('| '+(i+1)+' | '+TEAM_NAMES[team.id]+' | '+mdSafe(AGENT_META[team.strategy].name)+' | '+team.score.toFixed(3)+' | '+team.territory+' ('+(team.territory/CELL_COUNT*100).toFixed(2)+'%) | '+team.resources+' | '+team.captures+' |'));
  lines.push('','## 4. 重大事件时间线','');
  if(!match.eventLog.length) lines.push('_截至导出时尚未发生全局重大事件。_');
  else match.eventLog.forEach(e=>lines.push('- **T+'+e.time.toFixed(3)+'s** '+mdSafe(e.message)+'（'+mdSafe(e.banner)+'）'));
  lines.push('','## 5. 每秒局势快照','',
    '> 用于恢复宏观走势。每行是引擎保存的一次时间序列快照。','',
    '| 时间 | 资源总价值 | 红方 VP / 领地 / 资源 | 蓝方 VP / 领地 / 资源 | 绿方 VP / 领地 / 资源 | 紫方 VP / 领地 / 资源 |',
    '| ---: | ---: | --- | --- | --- | --- |');
  for(const p of match.timeline){
    const cells=[0,1,2,3].map(id=>{
      const t=p.teams.find(x=>x.id===id);
      return t ? t.score.toFixed(2)+' / '+(t.territory/CELL_COUNT*100).toFixed(2)+'% / '+t.resources : 'N/A';
    });
    lines.push('| '+p.time.toFixed(3)+'s | '+p.resourceTotal+' | '+cells.join(' | ')+' |');
  }
  lines.push('','## 6. 完整算法决策日志','',
    '> 以下按真实执行顺序记录每一次算法决策。坐标为 (x, y)，左上角为 (0, 0)。owner=-1 表示目标格原本无主。localPressure 是当次候选边界中敌方格所占比例。reward 是动作结算后返回给算法的即时反馈，不等同于 VP。','');
  if(!match.decisionLog.length) lines.push('_尚无算法决策。_');
  for(const d of match.decisionLog){
    const meta=AGENT_META[d.strategy], r=d.result;
    lines.push('### D'+String(d.seq).padStart(5,'0')+' · T+'+d.time.toFixed(3)+'s · '+TEAM_NAMES[d.teamId]+' · '+meta.name,'',
      '- **算法解释**：'+(mdSafe(d.thought)||'无'),
      '- **决策前状态**：领地占比 '+(d.share*100).toFixed(2)+'%，局部敌压 '+(d.localPressure*100).toFixed(2)+'%，候选动作 '+d.optionCount+' 个，计算耗时 '+d.thinkMs.toFixed(3)+' ms。',
      '- **动作**：从 ('+d.from.x+', '+d.from.y+') → ('+d.to.x+', '+d.to.y+')。',
      '- **目标格**：原归属 '+ownerName(d.target.owner)+'；'+(d.target.enemy?'敌方格':'非敌方格')+'；地形 '+terrainName(d.target.terrain)+'；资源价值 '+d.target.resource+'；己方邻格 '+d.target.ownNeighbors+'；敌方邻格 '+d.target.enemyNeighbors+'。',
      '- **空间特征**：距己方核心 '+d.target.distOwnCore+'；距最近敌方核心 '+d.target.distRivalCore+'；距最近未控制资源 '+d.target.nearestResourceDist+'；resourcePull '+fmtLog(d.target.resourcePull)+'；enemyPressure '+fmtLog(d.target.enemyPressure)+'。',
      '- **结算**：'+(r ? (r.success?'成功':'失败')+'；previousOwner='+r.previousOwner+'（'+ownerName(r.previousOwner)+'）；reward='+fmtLog(r.reward) : '导出时尚未取得结算结果')+'。','');
  }
  lines.push('## 7. 给后续 AI 的分析建议','',
    '你可以直接基于本文件进行分析，无需原始网页或之前的聊天记录。建议至少区分：宏观局势演化、算法决策偏好、重大事件响应、资源争夺、领地效率、进攻/防守转换、失败动作模式、最终胜因。如果提出算法修改建议，请引用具体决策编号（例如 D00124）或时间点作为证据，并区分“从日志直接观察到的事实”和“基于事实作出的推断”。','',
    '---','',
    '_由 Cyber Crickets 自动生成。导出时间：'+new Date().toISOString()+'_');
  return lines.join('\n');
}

function exportMarkdownLog(){
  const md=buildMarkdownLog();
  const blob=new Blob([md],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safeSeed=String(match.seed).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,32)||'match';
  a.href=url;
  a.download='cyber-crickets_'+safeSeed+'_'+Math.round(match.time)+'s.md';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  log('已导出 AI 可读的完整 Markdown 对局日志。');
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
el.exportLog.onclick = exportMarkdownLog;
el.again.onclick = () => { el.dialog.close(); reset(); start(); };
el.close.onclick = () => el.dialog.close();
config(); reset(); initTournamentUI(); requestAnimationFrame(loop);
