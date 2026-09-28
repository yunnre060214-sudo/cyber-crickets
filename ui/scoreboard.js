import {AGENT_META} from '../agents.js?v=20260928-ui-refactor-v1';
import {CELL_COUNT} from '../match.js?v=20260928-ui-refactor-v1';
import {vpRate} from '../rules.js?v=20260928-ui-refactor-v1';
import {COLORS} from './constants.js?v=20260928-ui-refactor-v1';
import {renderLiveChart} from './chart.js?v=20260928-ui-refactor-v1';

export function currentWinProbabilities(match) {
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

export function renderScoreboard({match, el, formatTime}) {
  el.timer.textContent = formatTime(match.duration - match.time);
  const teams = [...match.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...teams.map(team => team.score));
  const winProb=currentWinProbabilities(match);
  renderLiveChart({match, el});
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
