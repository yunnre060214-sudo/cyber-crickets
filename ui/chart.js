import {AGENT_META} from '../agents.js?v=20260928-ui-refactor-v1';
import {COLORS, TEAM_NAMES} from './constants.js?v=20260928-ui-refactor-v1';

export function renderLiveChart({match, el}) {
  const width=720,height=360,left=48,right=14,top=16,bottom=32;
  const snapshots=match.timeline;
  const current={time:match.time,teams:match.teams.map(team=>({id:team.id,score:team.score}))};
  const data=snapshots.at(-1)?.time===match.time?snapshots:[...snapshots,current];

  // Y 轴按模拟时长线性标定：120 秒 = 300 VP，180 秒 = 450 VP。
  // 自定义时长沿用同一比例；播放倍速只改变现实观看速度，不改变模拟时间或 VP 产出。
  // 一局内部坐标固定，避免曲线随实时得分重新缩放而产生视觉漂移。
  const maxVP=Math.max(25,match.duration*2.5);
  const x=time=>left+(width-left-right)*(time/match.duration);
  const timeTickLabel=seconds=>{
    const rounded=Math.round(seconds);
    if(match.duration<300)return rounded+'s';
    const minutes=Math.floor(rounded/60),rest=rounded%60;
    return rest?minutes+':'+String(rest).padStart(2,'0'):minutes+'m';
  };
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
      '" text-anchor="middle" fill="#8b96a8" font-size="10">'+timeTickLabel(match.duration*t)+'</text>').join('');

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
    '"></i>'+TEAM_NAMES[team.id]+'·'+AGENT_META[team.strategy].name+
    ' <b>'+team.score.toFixed(1)+'</b></span>').join('');
}

export function chartSvg({match, metric, label, formatter}) {
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
