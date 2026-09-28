import {buildReportModel, htmlSafe as esc, number, percent, clock} from './model.js?v=20260928-export-v2';

const style = `
:root{color-scheme:light;--ink:#202734;--muted:#657082;--line:#dce2eb;--blue:#235bce;--paper:#fff;--ground:#f2f5fa}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
main{max-width:1160px;margin:auto;padding:42px 32px 24px}h1,h2,h3,p{margin:0}h1{font-size:34px;line-height:1.25;letter-spacing:-.03em}h2{font-size:21px;margin-bottom:14px}h3{font-size:15px}.eyebrow{font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.14em;color:var(--muted);margin-bottom:8px}
.muted,.note{color:var(--muted)}.note{font-size:12px;line-height:1.6;margin-top:10px}.hero{padding:28px;background:var(--paper);border:1px solid var(--line);border-top:4px solid var(--blue)}.hero-meta{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;margin-top:14px}.hero-meta span{overflow-wrap:anywhere}.summary-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);margin-top:22px;padding-top:20px;gap:20px}.metric span{display:block;color:var(--muted);font-size:12px}.metric strong{font:600 25px/1.4 ui-monospace,monospace}.metric small{margin-left:5px;font-size:11px;color:var(--muted)}
nav{display:flex;flex-wrap:wrap;gap:8px 20px;padding:16px 4px;font-size:13px}nav a{color:var(--blue);text-decoration:none}nav a:hover{text-decoration:underline}section{scroll-margin-top:20px;margin-top:24px}.panel{background:var(--paper);border:1px solid var(--line);padding:22px}.overview{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(250px,.8fr);gap:20px}.table-scroll{overflow:auto;max-width:100%}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:500;color:var(--muted);font-size:11px;white-space:nowrap}td.numeric{text-align:right;font:500 13px/1.7 ui-monospace,monospace;white-space:nowrap}.team{overflow-wrap:anywhere;min-width:95px}.swatch{display:inline-block;width:8px;height:8px;background:var(--team);margin-right:7px}.rank{color:var(--muted);width:30px}.control-bars{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}.bar-head{display:flex;justify-content:space-between;gap:12px;font-size:12px}.bar-track{height:6px;background:#edf1f6;margin-top:5px}.bar-track i{display:block;height:100%;background:var(--team);width:var(--value)}.map svg{display:block;width:100%;max-width:300px;aspect-ratio:1;margin:auto;background:#edf1f6}.map h3{margin-bottom:12px}.map-legend{font-size:11px;color:var(--muted);margin-top:10px;text-align:center}
.charts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.chart{padding:16px}.chart svg{width:100%;height:auto;display:block;margin-top:12px}.chart text{font:10px ui-monospace,monospace;fill:#657082}.chart-line{fill:none;stroke-width:2.5;vector-effect:non-scaling-stroke}.legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:11px;margin-top:12px}.legend span{overflow-wrap:anywhere}.chart-unit{font-size:11px;color:var(--muted)}
.phase-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.phase header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px}.phase header span{font:11px ui-monospace,monospace;color:var(--muted)}.phase p{font-size:12px;color:var(--muted);margin:5px 0 10px}.phase table{font-size:12px}.phase td,.phase th{padding:8px 5px}.events{list-style:none;margin:0;padding:0}.events li{display:grid;grid-template-columns:65px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.events time{font:12px/1.7 ui-monospace,monospace;color:var(--muted)}.events p{font-size:13px}.tag{display:inline-block;font-size:10px;padding:2px 7px;background:#eef3fd;color:var(--blue);margin-right:8px}
.strategy-table{min-width:700px}.strategy-table th{white-space:normal}.strategy-table td{font-size:12px}.decision-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.decision-group>h3{margin-bottom:10px}.decision{border-top:1px solid var(--line)}summary{cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}.decision summary{display:grid;grid-template-columns:73px minmax(0,1fr) 42px;gap:8px;align-items:start;padding:12px 0;font-size:12px}.decision summary:before{display:none}.decision summary>span:first-child{font:11px/1.6 ui-monospace,monospace;color:var(--muted)}.decision summary>span:first-child small{display:block}.decision summary>strong{font-weight:500}.decision summary .outcome{color:var(--blue);font-size:11px;text-align:right}.decision summary .outcome.fail{color:#b54a48}.decision summary strong:after{content:" ＋";color:var(--muted)}.decision[open] summary strong:after{content:" −"}.decision-body{padding:0 0 15px;font-size:12px;overflow-wrap:anywhere}.decision-body p{margin-bottom:8px}.decision-body dl{display:grid;grid-template-columns:75px 1fr;gap:5px 10px;margin:0;color:var(--muted)}dt,dd{margin:0}.rules summary{font-weight:600}.rules p,.rules li{font-size:12px;margin-top:8px;color:var(--muted)}.rules ul{padding-left:20px;margin-bottom:0}footer{padding:20px 4px;color:var(--muted);font-size:11px;overflow-wrap:anywhere}
@media(max-width:900px){.charts{grid-template-columns:1fr}.chart svg{max-height:250px}.overview{grid-template-columns:1fr 280px}.summary-metrics{gap:12px}.metric strong{font-size:21px}}
@media(max-width:680px){main{padding:18px 12px}.hero{padding:20px 16px}h1{font-size:26px}h2{font-size:19px}.summary-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.overview,.phase-grid,.decision-groups{grid-template-columns:1fr}.panel{padding:16px}.overview>.map{border-top:1px solid var(--line);padding-top:18px}.team{min-width:80px}th,td{padding:9px 5px}.phase th{white-space:normal}nav{gap:8px 15px}.events li{grid-template-columns:52px 1fr;gap:8px}.decision summary{grid-template-columns:66px minmax(0,1fr) 38px}.hero-meta{gap:6px 14px}}
@media print{body{background:#fff}main{padding:0;max-width:none}nav{display:none}.panel,.hero{break-inside:avoid;box-shadow:none}section{margin-top:18px}.table-scroll{overflow:visible}.decision-groups{display:block}.decision-group{break-inside:avoid}a{color:inherit}}
`;

const badge = team => '<span class="swatch" style="--team:' + team.color + '"></span>' + esc(team.label);

function battleMap(report) {
  const paths = new Map();
  for (let y = 0; y < report.height; y++) {
    for (let x = 0; x < report.width;) {
      const owner = report.map.owner[y * report.width + x];
      let end = x + 1;
      while (end < report.width && report.map.owner[y * report.width + end] === owner) end++;
      if (owner >= 0) paths.set(owner, (paths.get(owner) || '') + 'M' + x + ' ' + y + 'h' + (end - x) + 'v1h-' + (end - x) + 'z');
      x = end;
    }
  }
  let cells = '';
  for (const [id, d] of paths) cells += '<path fill="' + report.teams.find(team => team.id === id).color + '" d="' + d + '"/>';
  const resources = report.map.resources.flatMap((value, index) => value ?
    ['<circle cx="' + (index % report.width + .5) + '" cy="' + (Math.floor(index / report.width) + .5) + '" r="' +
      (value === 3 ? '.4' : '.27') + '" fill="#f4c12d" stroke="#7c6624" stroke-width=".08"/>'] : []).join('');
  const cores = report.teams.map(team => {
    const index = report.map.core.indexOf(team.id);
    return index < 0 ? '' : '<rect x="' + index % report.width + '" y="' + Math.floor(index / report.width) +
      '" width="3" height="3" fill="none" stroke="#fff" stroke-width=".28"/>';
  }).join('');
  return '<svg viewBox="0 0 ' + report.width + ' ' + report.height + '" role="img" aria-label="导出时的领地与资源分布"><title>控制分布</title>' + cells + resources + cores + '</svg>';
}

function chart(report, {title, unit, metric, maximum}) {
  const width = 420, height = 230, left = 42, top = 16, innerWidth = 360, innerHeight = 180;
  const max = maximum || Math.max(1, ...report.timeline.flatMap(point => point.teams.map(team => metric(team, point))));
  const elapsed = report.elapsed || 1;
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const value = max * i / 4, y = top + innerHeight * (1 - i / 4);
    grid += '<line x1="' + left + '" x2="' + (left + innerWidth) + '" y1="' + y + '" y2="' + y +
      '" stroke="#e5eaf2"/><text x="' + (left - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + number(value, 0) + '</text>';
  }
  for (let i = 0; i <= 4; i++) grid += '<text x="' + (left + innerWidth * i / 4) + '" y="218" text-anchor="middle">' +
    clock(report.elapsed * i / 4) + '</text>';
  const markers = report.events.map(event => {
    const x = left + event.time / elapsed * innerWidth;
    return '<line x1="' + number(x) + '" x2="' + number(x) + '" y1="' + top + '" y2="' + (top + innerHeight) +
      '" stroke="#bac6d9" stroke-dasharray="3 4"><title>' + esc(event.banner) + ' · ' + clock(event.time) + '</title></line>';
  }).join('');
  const lines = report.teams.map(team => {
    const points = report.chartPoints.map(point => {
      const state = point.teams.find(item => item.id === team.id);
      return number(left + point.time / elapsed * innerWidth) + ',' + number(top + innerHeight * (1 - metric(state, point) / max));
    }).join(' ');
    return '<polyline class="chart-line" stroke="' + team.color + '" points="' + points + '"><title>' + esc(team.label) + '</title></polyline>';
  }).join('');
  return '<article class="panel chart"><h3>' + title + '</h3><p class="chart-unit">' + unit + '</p><svg viewBox="0 0 ' +
    width + ' ' + height + '" role="img" aria-label="' + title + '"><title>' + title + '</title>' + grid + markers + lines + '</svg></article>';
}

function decisionCard(decision) {
  const outcome = decision.result ? decision.result.success ? '成功' : '失败' : '待结算';
  return '<details class="decision"><summary><span>D' + String(decision.seq).padStart(5, '0') + '<small>' + clock(decision.time) +
    '</small></span><strong>' + esc(decision.reason) + '</strong><span class="outcome' + (outcome === '失败' ? ' fail' : '') + '">' +
    outcome + '</span></summary><div class="decision-body"><p>' + esc(decision.thought || '算法未留下解释。') + '</p><dl>' +
    '<dt>动作</dt><dd>(' + decision.from.x + ', ' + decision.from.y + ') → (' + decision.to.x + ', ' + decision.to.y + ')</dd>' +
    '<dt>目标</dt><dd>' + (decision.target.enemy ? '敌方格' : '无主格') + '；地形 ' + decision.target.terrain + '；资源价值 ' + decision.target.resource + '</dd>' +
    '<dt>邻接支援</dt><dd>己方 ' + decision.target.ownNeighbors + ' / 敌方 ' + decision.target.enemyNeighbors + '</dd>' +
    '<dt>边界敌压</dt><dd>' + percent(decision.localPressure) + '</dd>' +
    '<dt>即时反馈</dt><dd>' + (decision.result ? number(decision.result.reward) : '待结算') + '（不是 VP）</dd></dl></div></details>';
}

export function buildHtmlReport(context) {
  const report = buildReportModel(context), byId = id => report.teams.find(team => team.id === id);
  const leader = report.teams[0], title = report.elapsed ? report.leaders.map(team => team.label).join('、') : '比赛尚未开始';
  const rankings = report.teams.map(team => '<tr><td class="rank">' + team.rank + '</td><td class="team">' + badge(team) +
    '</td><td class="numeric"><strong>' + number(team.score) + '</strong></td><td class="numeric">' + team.territory +
    '</td><td class="numeric">' + team.resources + '</td></tr>').join('');
  const control = report.teams.map(team => '<div style="--team:' + team.color + ';--value:' + percent(team.averageResourceShare) +
    '"><div class="bar-head"><span>' + badge(team) + '</span><strong>' + percent(team.averageResourceShare) +
    '</strong></div><div class="bar-track"><i></i></div></div>').join('');
  const phases = report.phases.map(phase => '<article class="panel phase"><header><h3>' + phase.name + '</h3><span>' +
    clock(phase.start) + '—' + clock(phase.end) + '</span></header><p>' + esc(phase.event || '') + '</p><table><thead><tr><th>算法</th>' +
    '<th>VP 增量*</th><th>成功 / 结算</th><th>抢资源</th></tr></thead><tbody>' + phase.teams.map(row =>
      '<tr><td class="team">' + badge(byId(row.id)) + '</td><td class="numeric">+' + number(row.vpGain) + '</td><td class="numeric">' +
      row.actions.successes + ' / ' + row.actions.settled + '</td><td class="numeric">' + row.actions.resourceWins + '</td></tr>').join('') +
    '</tbody></table></article>').join('');
  const events = [...report.events.map(event => ({time: event.time, tag: '全局事件', text: event.message})),
    ...report.shownLeadChanges.map(event => ({time: event.time, tag: '领先易手',
      text: byId(event.to).label + ' 超过 ' + byId(event.from).label + '，成为唯一领先者。'}))].sort((a, b) => a.time - b.time);
  const eventList = events.length ? events.map(event => '<li><time>' + clock(event.time) + '</time><p><span class="tag">' +
    event.tag + '</span>' + esc(event.text) + '</p></li>').join('') : '<li><time>—</time><p>尚无全局事件或领先易手。</p></li>';
  const strategies = report.teams.map(team => {
    const a = team.actions;
    return '<tr><td class="team">' + badge(team) + '</td><td class="numeric">' + percent(team.averageTerritory / report.cellCount) +
      '</td><td class="numeric">' + percent(team.averageResourceShare) + '</td><td class="numeric">' + a.successes + ' / ' + a.settled +
      '</td><td class="numeric">' + (a.successRate == null ? '—' : percent(a.successRate)) + '</td><td class="numeric">' + a.expansions +
      '</td><td class="numeric">' + a.captures + '</td><td class="numeric">' + a.resourceWins + '</td><td class="numeric">' +
      a.longestFailedTargetRun + '</td></tr>';
  }).join('');
  const decisions = report.teams.map(team => {
    const rows = report.selectedDecisions.filter(decision => decision.teamId === team.id);
    return '<article class="panel decision-group"><h3>' + badge(team) + '</h3>' +
      (rows.length ? rows.map(decisionCard).join('') : '<p class="note">尚无决策。</p>') + '</article>';
  }).join('');
  const resourceLeader = [...report.teams].sort((a, b) => b.averageResourceShare - a.averageResourceShare)[0];
  const territoryLeader = [...report.teams].sort((a, b) => b.territory - a.territory)[0];
  const observation = report.elapsed ? esc(resourceLeader.label) + ' 的整局平均资源占比最高，为 ' + percent(resourceLeader.averageResourceShare) +
    '。' + esc(territoryLeader.label) + ' 在导出时控制格数最多（' + territoryLeader.territory + ' 格）。比赛按累计 VP 排名。' :
    '尚无对局表现可供比较。开始比赛后，走势和阶段统计会逐步形成。';
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>赛博斗蛐蛐战报 · ' + esc(report.seed) + '</title><style>' + style + '</style></head><body><main>' +
    '<header class="hero"><p class="eyebrow">CYBER CRICKETS · MATCH REPORT</p><p class="muted">' + report.outcomeLabel + '</p><h1>' + esc(title) +
    '</h1><div class="hero-meta"><span>种子 <strong>' + esc(report.seed) + '</strong></span><span>' + report.status + ' · ' + clock(report.elapsed) +
    ' / ' + clock(report.duration) + '</span><span>出生轮换 ' + (report.rotation + 1) + '/4</span></div>' +
    '<div class="summary-metrics"><div class="metric"><span>最高累计 VP</span><strong>' + number(leader.score) + '</strong></div>' +
    '<div class="metric"><span>第一与第二 VP 差</span><strong>' + number(report.margin) + '</strong></div>' +
    '<div class="metric"><span>领先易手 · 快照观察</span><strong>' + report.leadChanges.total + '</strong><small>次</small></div>' +
    '<div class="metric"><span>汇总决策</span><strong>' + report.decisionCount.toLocaleString('en-US') + '</strong><small>条</small></div></div></header>' +
    '<nav aria-label="战报目录"><a href="#overview">概览</a><a href="#trends">走势</a><a href="#phases">阶段</a><a href="#events">关键事件</a>' +
    '<a href="#strategies">算法表现</a><a href="#decisions">精选决策</a></nav>' +
    '<section id="overview" class="panel"><h2>结果与持续控制</h2><div class="overview"><div><div class="table-scroll"><table><thead><tr>' +
    '<th>排名</th><th>阵营 · 算法</th><th>累计 VP</th><th>格数</th><th>资源价值</th></tr></thead><tbody>' + rankings +
    '</tbody></table></div><h3 style="margin-top:20px">平均资源控制*</h3><div class="control-bars">' + control + '</div><p class="note">' +
    observation + '</p></div><div class="map"><h3>' + (report.finished ? '终局' : '当前') + '战场</h3>' + battleMap(report) +
    '<p class="map-legend">灰：未控制 · 金点：资源 · 白框：核心</p></div></div></section>' +
    '<section id="trends"><h2>对局走势</h2><div class="charts">' +
    chart(report, {title: '累计 VP', unit: '胜负由整场累计积分决定', metric: team => team.score}) +
    chart(report, {title: '领地占比', unit: '控制格数 / 4096', metric: team => team.territory / report.cellCount * 100, maximum: 100}) +
    chart(report, {title: '资源价值占比', unit: '当前资源价值 / 当前资源总量', metric: (team, point) => point.resourceTotal ? team.resources / point.resourceTotal * 100 : 0, maximum: 100}) +
    '</div><div class="legend">' + report.teams.map(team => '<span>' + badge(team) + '</span>').join('') +
    '</div><p class="note">图中虚线标记全局事件；曲线最多保留 120 个采样点，保留首尾及精选关键事件附近的快照。完整逐秒数据另存于「完整数据」。</p></section>' +
    '<section id="phases"><h2>按阶段看变化</h2><div class="phase-grid">' + phases + '</div><p class="note">*阶段起止 VP 由约每秒快照插值，增分为近似值；表中动作计数来自全部逐步记录。抢资源列是成功动作次数。</p></section>' +
    '<section id="events" class="panel"><h2>关键事件</h2><ol class="events">' + eventList + '</ol><p class="note">' +
    (report.shownLeadChanges.length < report.leadChanges.total ? '领先易手仅精选展示 12 次；总次数来自全部快照。' : '领先易手的时间精度取决于约每秒保存一次的快照。') + '</p></section>' +
    '<section id="strategies" class="panel"><h2>算法表现</h2><div class="table-scroll"><table class="strategy-table"><thead><tr><th>算法</th>' +
    '<th>平均领地*</th><th>平均资源*</th><th>成功 / 已结算</th><th>成功率</th><th>扩张成功</th><th>翻色成功</th><th>抢资源成功</th><th>同目标最长连续失败</th>' +
    '</tr></thead><tbody>' + strategies + '</tbody></table></div><p class="note">*控制比例由快照按时间加权估算。动作成功率排除待结算记录。资源夺取次数不等于资源保有量，也不直接等于 VP 收入。</p></section>' +
    '<section id="decisions"><h2>精选决策 · 点开查看</h2><p class="note" style="margin-bottom:12px">从 ' + report.decisionCount + ' 条记录中选出 ' +
    report.selectedDecisions.length + ' 条，每个算法最多 6 条。优先资源夺取、翻色、连续失败与阶段动作；D 编号对应完整数据中的 seq。</p>' +
    '<div class="decision-groups">' + decisions + '</div></section>' +
    '<section class="panel rules"><details><summary>比赛规则与阅读边界</summary><p>算法在 64×64 网格争夺领地和资源。核心区不可被翻色。动作基于相同旧快照同步结算。</p>' +
    '<p><strong>VP/s = 10 ×（0.65 × 领地格数 / 4096 + 0.35 × 当前资源价值 / 资源总价值）</strong>。时间归零时累计 VP 最高者获胜；终局占地最多不保证累计积分最高。</p>' +
    '<ul><li>约 33% / 62% / 82% 赛程触发资源潮汐、核心节点和终局超频。</li><li>reward 是动作反馈，不直接加入 VP；thinkMs 是本机耗时，不参与胜负。</li>' +
    '<li>思路文字由算法生成，是解释而非事实证明。精选记录不代表完整行为分布。</li><li>这是一局观察，不代表算法跨地图胜率。未结束时仅显示当前领先。</li></ul></details></section>' +
    '<footer>离线战报 · 全部图表与样式内置，无需联网。导出于 ' + esc(report.exportedAt) + '</footer></main></body></html>';
}
