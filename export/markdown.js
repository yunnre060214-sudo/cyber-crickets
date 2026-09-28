import {AGENT_META} from '../agents.js?v=20260928-ui-refactor-v1';
import {WIDTH, HEIGHT, CELL_COUNT} from '../match.js?v=20260928-ui-refactor-v1';
import {TEAM_NAMES} from '../ui/constants.js?v=20260928-ui-refactor-v1';

const mdSafe = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const ownerName = id => id >= 0 ? TEAM_NAMES[id] : '无主';
const terrainName = value => ({1:'普通',2:'复杂',3:'高阻力'}[value] || String(value));
const fmtLog = value => Number.isFinite(value) ? Number(value).toFixed(3) : 'N/A';

export function buildMarkdownLog({match, running, speedValue}) {
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
    '| 模拟速度（仅 UI 播放速度） | '+mdSafe(speedValue)+'× |',
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

export function exportMarkdownLog({match, running, speedValue, log}){
  const md=buildMarkdownLog({match, running, speedValue});
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
