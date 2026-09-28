import {buildReportModel, mdSafe, number, percent, clock, excerpt} from './model.js?v=20260928-export-v2';

export function buildMarkdownLog(context) {
  const report = buildReportModel(context), name = id => report.teams.find(team => team.id === id)?.label || '未知阵营';
  const lines = [
    '# 赛博斗蛐蛐 · 精简战报', '',
    '> 这是阶段汇总与精选证据，不含逐步流水。需要全部决策时，请另选「完整数据」。', '',
    '**' + report.outcomeLabel + '**：' + mdSafe(report.leaders.map(team => team.label).join('、')) +
      '；最高 ' + number(report.teams[0].score) + ' VP。', '',
    '| 种子 | 状态 | 进度 | 出生轮换 | 决策数 |',
    '| --- | --- | --- | --- | ---: |',
    '| ' + mdSafe(report.seed) + ' | ' + report.status + ' | ' + number(report.elapsed, 1) + ' / ' + report.duration +
      ' 秒 | ' + (report.rotation + 1) + '/4 | ' + report.decisionCount + ' |', '',
    '## 结果', '',
    '| 排名 | 阵营 · 算法 | 累计 VP | 控制格数 | 资源价值 | 翻色 |',
    '| ---: | --- | ---: | ---: | ---: | ---: |'
  ];
  for (const team of report.teams) lines.push('| ' + team.rank + ' | ' + mdSafe(team.label) + ' | ' + number(team.score) +
    ' | ' + team.territory + ' | ' + team.resources + ' | ' + team.captures + ' |');
  lines.push('', '## 持续控制与动作表现', '',
    '| 算法 | 平均领地占比* | 平均资源占比* | 成功 / 已结算 | 成功率 | 扩张成功 | 翻色成功 | 抢资源成功 | 同目标最长连续失败 |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const team of report.teams) {
    const a = team.actions;
    lines.push('| ' + mdSafe(team.label) + ' | ' + percent(team.averageTerritory / report.cellCount) + ' | ' + percent(team.averageResourceShare) +
      ' | ' + a.successes + ' / ' + a.settled + ' | ' + (a.successRate == null ? '—' : percent(a.successRate)) +
      ' | ' + a.expansions + ' | ' + a.captures + ' | ' + a.resourceWins + ' | ' + a.longestFailedTargetRun + ' |');
  }
  lines.push('', '*持续控制由约每秒快照按时间加权估算；抢资源成功是动作次数，不等于当前资源保有量。未结算动作不计入成功率。*', '',
    '## 阶段变化', '', '> 阶段边界采用实际全局事件时间；起止 VP 由快照插值，阶段增分为近似值。', '');
  for (const phase of report.phases) {
    lines.push('### ' + phase.name + ' · ' + clock(phase.start) + '—' + clock(phase.end), '',
      '| 算法 | 阶段 VP 增量* | 成功 / 已结算 | 抢资源成功 |', '| --- | ---: | --- | ---: |');
    for (const row of phase.teams) lines.push('| ' + mdSafe(name(row.id)) + ' | ' + number(row.vpGain) + ' | ' +
      row.actions.successes + ' / ' + row.actions.settled + ' | ' + row.actions.resourceWins + ' |');
    lines.push('');
  }
  lines.push('## 关键事件', '', '逐秒快照观察到 **' + report.leadChanges.total + ' 次领先易手**。', '');
  const events = [...report.events.map(event => ({time: event.time, text: event.message})),
    ...report.shownLeadChanges.map(event => ({time: event.time, text: name(event.to) + ' 超过 ' + name(event.from) + '，成为唯一领先者。'}))]
    .sort((a, b) => a.time - b.time);
  if (!events.length) lines.push('- 尚无全局事件或领先易手。');
  else for (const event of events) lines.push('- **' + clock(event.time) + '** ' + mdSafe(event.text));
  if (report.shownLeadChanges.length < report.leadChanges.total) lines.push('- 易手记录仅精选展示，全部变化可由完整数据恢复。');
  lines.push('', '## 精选决策', '',
    '> 每个算法最多 6 条：优先资源夺取、翻色、连续失败与阶段动作。选择原因随条目给出，不代表全部行为。', '',
    '| 决策 | 时间 | 算法 | 选择原因 | 目标 | 结果 | 算法解释 |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const decision of report.selectedDecisions) lines.push('| D' + String(decision.seq).padStart(5, '0') + ' | ' + clock(decision.time) +
    ' | ' + mdSafe(name(decision.teamId)) + ' | ' + mdSafe(decision.reason) + ' | (' + decision.to.x + ', ' + decision.to.y +
    ') | ' + (decision.result ? decision.result.success ? '成功' : '失败' : '待结算') + ' | ' + mdSafe(excerpt(decision.thought, 180)) + ' |');
  if (!report.selectedDecisions.length) lines.push('| — | — | — | 尚无决策 | — | — | — |');
  lines.push('', '## 简明规则与证据边界', '',
    '- 四个算法在 64×64 网格争夺领地和资源，核心区不可被夺取，动作基于同一旧快照同步结算。',
    '- **VP/s = 10 ×（0.65 × 领地格数 / 4096 + 0.35 × 当前资源价值 / 资源总价值）**；时间归零时累计 VP 最高者获胜。',
    '- 约 33% / 62% / 82% 赛程分别触发资源潮汐、核心节点和终局超频。资源价值分母会变化。',
    '- reward 是动作反馈，不直接加入 VP；thinkMs 是本机耗时，不参与胜负。',
    '- 思路文字由算法生成，是解释而非事实证明；引用 D 编号可在完整数据的 decisions 中找到原记录。',
    '- 这是一局的观察，不代表算法跨地图胜率；未结束时只显示当前领先。', '',
    '导出时间：' + report.exportedAt);
  return lines.join('\n');
}

// Keep an older cached app entrypoint functional while it refreshes its module graph.
export async function exportMarkdownLog(context) {
  const {downloadMatchExport} = await import('./download.js?v=20260928-export-v2');
  const file = await downloadMatchExport(context, 'markdown');
  context.log?.('已导出精简 Markdown 摘要（' + file.sizeLabel + '）。');
  return file;
}
