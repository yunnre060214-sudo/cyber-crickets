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
  exportLog: $('#exportLogBtn'), resultExport: $('#resultExportBtn')
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

  // Y 轴上限随比赛时长配置变化，但在一局内部保持固定。
  // 60 / 90 / 120 秒分别使用 300 / 450 / 600 VP，避免短局曲线被压在底部，
  // 同时保持历史点在比赛进行过程中不会因动态缩放而移动。
  const yAxisMaxByDuration={60:300,90:450,120:600};
  const maxVP=yAxisMaxByDuration[match.duration] ?? match.duration*5;
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
function currentWinProbabilities() {
  const teams=match.teams;
  if(match.finished){
    const best=Math.max(...teams.map(team=>team.score));
    const winners=teams.filter(team=>Math.abs(team.score-best)<1e-9);
    return new Map(teams.map(team=>[team.id,winners.includes(team)?1/winners.length:0]));
  }
  if(match.time<=1e-9)return new Map(teams.map(team=>[team.id,1/teams.length]));

  const remaining=Math.max(0,match.duration-match.time);
  const progress=match.time/match.duration;
  const projected=teams.map(team=>{
    const rate=vpRate(team.territory,CELL_COUNT,team.resources,match.resourceTotal);
    // Blend current control with realized average pace. Early estimates stay conservative;
    // late estimates increasingly trust the current board and accumulated lead.
    const avgRate=team.score/Math.max(match.time,.001);
    const pace=(.35+.45*progress)*rate+(.65-.45*progress)*avgRate;
    return {id:team.id,value:team.score+pace*remaining};
  });
  const mean=projected.reduce((sum,item)=>sum+item.value,0)/projected.length;
  const spread=Math.max(18,match.duration*(.95-.55*progress));
  const weights=projected.map(item=>({id:item.id,w:Math.exp((item.value-mean)/spread)}));
  const total=weights.reduce((sum,item)=>sum+item.w,0)||1;
  return new Map(weights.map(item=>[item.id,item.w/total]));
}

function ui() {
  el.timer.textContent = formatTime(match.duration - match.time);
  const teams = [...match.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...teams.map(team => team.score));
  const winProb=currentWinProbabilities();
  renderLiveChart();
  el.score.innerHTML = teams.map((team, rank) => {
    const meta = AGENT_META[team.strategy], thought = team.agent.thought || '等待决策';
    const rate = vpRate(team.territory, CELL_COUNT, team.resources, match.resourceTotal);
    return '<div class="score-row"><div class="score-top"><div class="score-name"><span>' +
      (rank + 1) + '</span><i class="team-swatch" style="background:' + COLORS[team.id] +
      '"></i>' + meta.name + '</div><div class="score-number">' + team.score.toFixed(1) +
      ' VP</div></div><div class="score-winrate">当前胜率 <strong>' + (winProb.get(team.id)*100).toFixed(1) + '%</strong></div><div class="bar"><i style="width:' + (team.score / maxScore * 100) +
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
    '# Cyber Crickets / 赛博斗蛐蛐：完整对局日志','',
    '## 0. 给第一次看到这个文件的 AI：先理解这是什么','',
    '### 0.1 这是什么游戏？','',
    'Cyber Crickets（赛博斗蛐蛐）是一个**算法自动对抗模拟器**。一局通常有 4 个阵营：红、蓝、绿、紫。每个阵营由一个不同的算法策略控制。人类只选择参赛算法、地图种子、比赛时长等参数；比赛开始后不直接操作，所有扩张行为都由算法自动决定。','',
    '这里的“斗蛐蛐”是把不同决策算法放进**相同规则和地图环境**，让它们竞争领地、资源和累计积分。它不是角色战斗，没有血量或攻击力；真正争夺的是 **64×64 网格上的格子控制权**。','',
    '### 0.2 地图上在争什么？','',
    '- 地图固定为 **64×64，共 4096 个格子**。格子具有地形阻力，可能带有资源，并处于无主或某阵营控制状态。',
    '- 每个阵营开局拥有一个 **3×3 核心区**。核心不可被翻色，所以阵营不会被彻底消灭。',
    '- 阵营从自己的领地边界向上下左右相邻格提出扩张，逐步占领无主格或尝试夺取敌方格。',
    '- **资源节点**位于部分格子上。控制资源会提高资源份额，从而持续增加 VP。',
    '- 目标是让整局累计 **VP（Victory Points）**最高。终局占地最多不保证获胜，因为早期长期控制同样会持续产生积分。','',
    '### 0.3 算法每次到底在“算”什么？','',
    '引擎约每 0.085 个模拟秒允许每个阵营决策一次。引擎先从该阵营当前领地边界生成一组**合法候选动作 options**。一个动作就是“从己方格 from，向四邻接的一个非己方、非核心格 to 扩张”。','',
    '算法不会直接修改地图。它收到当前时刻的决策视图，再从候选动作中选择一个。视图包含比赛时间与进度、己方领地占比、局部敌压、候选动作，以及各候选目标的地形、资源价值、周围己方/敌方邻格、距己方核心和敌方核心的距离、最近资源距离、resourcePull、enemyPressure 等。不同算法对这些特征赋予不同优先级，因此形成扩张、抢资源、防守、穿插、袭扰等行为。','',
    '日志中的 **thought / 算法解释** 是算法为当次选择留下的简短可解释说明；分析时应把状态、动作和结算结果视为主要事实证据。','',
    '### 0.4 动作如何结算？','',
    '四方基于同一地图快照先独立提交动作，然后引擎**同步结算**，避免先执行者天然占优。','',
    '- 对无主格扩张基础成功率较高，复杂地形会降低成功率。',
    '- 对敌方格翻色时，成功率受进攻方局部支援、防守方邻格和地形共同影响。',
    '- 多个阵营同轮成功指向同一目标时，只会有一个最终获胜者。',
    '- 终局超频后，所有阵营翻色成功率额外提高。',
    '- 成功会改变格子归属。带资源的格子和敌方格产生更高即时 reward；**reward 是算法反馈值，不是 VP**。','',
    '### 0.5 VP 如何决定胜负？','',
    '每个模拟时间片都按当前控制状态持续累加 VP：','',
    '**VP/sec = 10 × (0.65 × AreaShare + 0.35 × ResourceShare)**','',
    'AreaShare = 己方控制格数 / 4096；ResourceShare = 己方控制资源价值 / 地图当前资源总价值。领地贡献占 65%，资源贡献占 35%。时间归零时累计 VP 最高者获胜。','',
    '### 0.6 全局重大事件','',
    '- 约 33% 进度：**资源潮汐**，中央新增资源节点。',
    '- 约 62% 进度：**核心节点上线**，中央出现更多高价值资源。',
    '- 约 82% 进度：**终局超频**，全体翻色成功率提高。',
    '',
    '这些事件对所有阵营同时生效。分析时应检查事件前后各算法的行为是否改变。','',
    '### 0.7 本文件怎么读','',
    '1. **对局元数据**：地图、种子、时长、出生轮换和计分规则。',
    '2. **参赛算法**：每种颜色实际使用的策略及设计意图。',
    '3. **当前 / 最终结果**：VP、终局领地、资源和翻色数量。',
    '4. **重大事件时间线**：改变全局资源价值或翻色概率的事件。',
    '5. **每秒局势快照**：用于重建宏观走势、领先变化和控制历史。',
    '6. **完整算法决策日志**：逐次记录算法看到什么、选择什么、结果如何，是策略分析的主要细粒度证据。','',
    '### 0.8 字段语义和分析边界','',
    '- territory / 领地：当前控制格数或比例，与累计 VP 不同。',
    '- resources / 资源价值：当前控制的资源价值总和，不是已消费资源。',
    '- captures / 翻色：成功夺取原属于敌方的格子数量。',
    '- localPressure：当次候选边界中敌方目标所占比例。',
    '- ownNeighbors / enemyNeighbors：目标格四邻域中的局部支援与防守。',
    '- resourcePull：越接近可争夺资源通常越高的启发式特征；enemyPressure：目标周围敌方邻格比例。',
    '- thinkMs：浏览器中一次选择的墙钟耗时，只用于性能观察，**不参与胜负，也不能直接代表算法强弱**。',
    '- 地图、资源和随机过程由种子确定；同配置可复现。出生轮换用于降低固定出生位置偏差。','',
    '如果用户只把本 Markdown 发给你并要求分析，请先依据以上规则建立游戏模型，再结合后面的具体记录作结论。不要把它误解为棋类、寻路竞速、传统 RTS 或单纯最短路径比赛。','',
    '## 1. 对局元数据','',
    '| 字段 | 值 |','| --- | --- |',
    '| 状态 | '+status+' |',
    '| 地图 | '+WIDTH+' × '+HEIGHT+'（共 '+CELL_COUNT+' 格） |',
    '| 地图种子 | '+mdSafe(match.seed)+' |',
    '| 出生轮换 | '+(match.rotation+1)+'/4 |',
    '| 设定时长 | '+match.duration+' 秒 |',
    '| 已进行 | '+match.time.toFixed(3)+' 秒 |',
    '| 模拟速度（仅 UI 播放速度） | '+mdSafe(el.speed.value)+'× |',
    '| 决策周期 | 每个阵营约 0.085 模拟秒一次 |',
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
el.resultExport.onclick = exportMarkdownLog;
el.again.onclick = () => { el.dialog.close(); reset(); start(); };
el.close.onclick = () => el.dialog.close();
config(); reset(); initTournamentUI(); requestAnimationFrame(loop);
