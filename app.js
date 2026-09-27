import {AGENT_META,createAgent} from './agents.js';

const $=s=>document.querySelector(s),C=$('#arena'),X=C.getContext('2d'),W=64,H=64,N=W*H;
const el={
  timer:$('#timer'),state:$('#statePill'),start:$('#startBtn'),pause:$('#pauseBtn'),reset:$('#resetBtn'),
  dur:$('#duration'),speed:$('#speed'),cfg:$('#teamConfig'),score:$('#scoreboard'),feed:$('#feed'),
  banner:$('#eventBanner'),dlg:$('#resultDialog'),title:$('#winnerTitle'),sum:$('#winnerSummary'),
  list:$('#resultList'),again:$('#againBtn'),close:$('#closeResultBtn'),overlay:$('#overlayToggle')
};
const COL=['#ff5b5b','#4f7cff','#25b77a','#9b6bff'],TN=['红方','蓝方','绿方','紫方'];
const CP=[[5,5],[58,5],[5,58],[58,58]],D=[[1,0],[-1,0],[0,1],[0,-1]];
let teams=[T(0,'aco'),T(1,'minimax'),T(2,'qlearn'),T(3,'voronoi')];
let own,ter,res,core,run=false,end=false,t=0,last=0,acc=0,dur=90,flags=new Set(),flash;

function T(id,strategy){
  return {id,strategy,score:0,captures:0,resources:0,territory:0,nextDecision:0,thinkMs:0,agent:null,lastMove:null};
}
const I=(x,y)=>y*W+x,XY=i=>[i%W,(i/W)|0],IB=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
const RI=n=>(Math.random()*n)|0,CL=(n,a,b)=>Math.max(a,Math.min(b,n)),MD=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);

function config(){
  el.cfg.innerHTML='';
  teams.forEach(a=>{
    const d=document.createElement('div');d.className='team-card';
    const o=Object.entries(AGENT_META).map(([k,v])=>'<option value="'+k+'" '+(a.strategy===k?'selected':'')+'>'+v.name+'</option>').join('');
    const meta=AGENT_META[a.strategy];
    d.innerHTML='<div class="team-card-head"><div class="team-id"><i class="team-swatch" style="background:'+COL[a.id]+'"></i>'+TN[a.id]+'</div><span class="agent-tier">'+meta.tier+'</span></div><select data-team="'+a.id+'">'+o+'</select><div class="strategy-desc" data-desc="'+a.id+'">'+meta.desc+'</div>';
    el.cfg.appendChild(d);
  });
  el.cfg.querySelectorAll('select').forEach(s=>s.onchange=e=>{
    const id=+e.target.dataset.team,key=e.target.value;teams[id].strategy=key;
    const desc=el.cfg.querySelector('[data-desc="'+id+'"]');if(desc)desc.textContent=AGENT_META[key].desc;
    if(!run)reset();
  });
}

function reset(){
  run=false;end=false;t=acc=0;last=performance.now();dur=+el.dur.value;
  own=new Int8Array(N).fill(-1);ter=new Uint8Array(N);res=new Uint8Array(N);core=new Int8Array(N).fill(-1);flags=new Set();
  teams=teams.map(a=>{const n=T(a.id,a.strategy);n.agent=createAgent(n.strategy,n.id,N);return n});
  for(let i=0;i<N;i++)ter[i]=1+(Math.random()<.17)+(Math.random()<.04);
  resources(26,false);seed();el.feed.innerHTML='';log('新地图生成，等待开战。');
  state('待机');ui();draw();el.start.textContent='开始';el.start.disabled=false;el.pause.disabled=true;el.pause.textContent='暂停';
}
function seed(){
  CP.forEach(([cx,cy],id)=>{for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){const i=I(x,y);own[i]=core[i]=id;ter[i]=1}});
  stats();
}
function resources(n,center){
  let guard=0;while(n&&guard++<5000){
    const x=center?Math.floor(W*.28+Math.random()*W*.44):4+RI(W-8),y=center?Math.floor(H*.28+Math.random()*H*.44):4+RI(H-8),i=I(x,y);
    if(core[i]>=0||res[i])continue;res[i]=Math.random()<.18?3:1;n--;
  }
}
function state(s){el.state.textContent=s}
function ft(s){s=Math.max(0,Math.ceil(s));return String((s/60)|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}

function start(){
  if(end)reset();run=true;last=performance.now();el.start.textContent='进行中';el.start.disabled=true;el.pause.disabled=false;
  state('交战中');log('回合开始：不同算法开始独立决策。');
}
function pause(){
  run=!run;
  if(run){last=performance.now();el.pause.textContent='暂停';el.start.disabled=true;state('交战中');log('模拟继续。')}
  else{el.pause.textContent='继续';el.start.disabled=false;el.start.textContent='继续';state('已暂停');log('模拟暂停。')}
}
function loop(ts){
  const dt=Math.min(.1,(ts-last)/1000||0);last=ts;
  if(run){acc+=dt*(+el.speed.value);while(acc>=.035&&run){tick(.035);acc-=.035}}
  draw();requestAnimationFrame(loop);
}
function tick(dt){
  t+=dt;if(t>=dur)return finish();events();
  for(const a of teams){
    if(t>=a.nextDecision){
      act(a);
      const heavy=a.strategy==='mcts'||a.strategy==='minimax';
      a.nextDecision=t+(heavy?.16:.085);
    }
  }
  stats();for(const a of teams)a.score+=dt*(a.territory*.045+a.resources*1.5);
  if(((t*5)|0)!==(((t-dt)*5)|0))ui();
}

function events(){
  const p=t/dur;
  if(p>=.33&&!flags.has('p')){flags.add('p');resources(12,true);banner('资源潮汐：中央新增高价值节点');log('资源潮汐出现，中央区域价值上升。')}
  if(p>=.62&&!flags.has('o')){
    flags.add('o');for(let y=25;y<39;y++)for(let x=25;x<39;x++){const i=I(x,y);if(!res[i]&&Math.random()<.09)res[i]=3}
    banner('核心节点上线：中央资源价值暴涨');log('核心节点上线，深谋型算法开始获得更多博弈空间。');
  }
  if(p>=.82&&!flags.has('f')){flags.add('f');banner('终局超频：翻色成功率提升');log('终局超频开始，最后冲刺。')}
}
function banner(s){el.banner.textContent=s;el.banner.classList.add('show');clearTimeout(flash);flash=setTimeout(()=>el.banner.classList.remove('show'),2200)}

function act(a){
  const options=opts(a.id);if(!options.length){reclaim(a);return}
  const view=makeView(a,options),st=performance.now();
  let move=null;
  try{move=a.agent.selectAction(view)}catch(err){console.error(err);move=options[RI(options.length)];a.agent.thought='决策异常，降级为随机策略'}
  a.thinkMs=performance.now()-st;if(!move)return;
  const result=claim(a,move);a.lastMove=move;
  try{a.agent.onResult({...result,move})}catch{}
}
function opts(id){
  const owned=[],out=[];
  for(let i=0;i<N;i++)if(own[i]===id)owned.push(i);
  if(!owned.length)return out;
  const st=owned.length>300?Math.ceil(owned.length/300):1,begin=RI(Math.min(st,owned.length));
  for(let n=begin;n<owned.length;n+=st){
    const from=owned[n],[x,y]=XY(from);
    for(const d of D){
      const nx=x+d[0],ny=y+d[1];if(!IB(nx,ny))continue;const to=I(nx,ny);
      if(own[to]===id||core[to]>=0)continue;
      out.push(enrich(id,{from,to,dir:d}));
    }
  }
  return out;
}
function enrich(id,o){
  const owner=own[o.to],p=XY(o.to),ownN=neighbors(o.to,id),enemyN=owner>=0?neighbors(o.to,owner):enemyAround(o.to,id);
  const ownCore=CP[id],rivalDist=Math.min(...CP.filter((_,k)=>k!==id).map(q=>MD(p,q)));
  const nrd=nearestResourceDist(p,id);
  return {...o,owner,enemy:owner>=0&&owner!==id,ownN,enemyN,terrain:ter[o.to],resource:res[o.to],
    distOwnCore:MD(p,ownCore),distRivalCore:rivalDist,nearestResourceDist:nrd,
    resourcePull:nrd>=99?0:12/(1+nrd),enemyPressure:enemyAround(o.to,id)/4};
}
function makeView(a,options){
  const contested=options.filter(o=>o.enemy).length;
  return {id:a.id,time:t,progress:t/dur,share:a.territory/N,localPressure:options.length?contested/options.length:0,options,width:W,height:H};
}
function nearestResourceDist(p,id){
  let best=99;
  for(let i=0;i<N;i++)if(res[i]&&own[i]!==id){const d=MD(p,XY(i));if(d<best)best=d;if(best<=1)break}
  return best;
}
function enemyAround(i,id){
  const [x,y]=XY(i);let n=0;
  for(const d of D){const nx=x+d[0],ny=y+d[1];if(IB(nx,ny)){const v=own[I(nx,ny)];if(v>=0&&v!==id)n++}}
  return n;
}
function neighbors(i,id){
  const [x,y]=XY(i);let n=0;
  for(const d of D){const nx=x+d[0],ny=y+d[1];if(IB(nx,ny)&&own[I(nx,ny)]===id)n++}
  return n;
}
function claim(a,m){
  const v=own[m.to],fs=neighbors(m.to,a.id),vs=v>=0?neighbors(m.to,v):0;
  let ch=v<0?.93-(ter[m.to]-1)*.12:.39+fs*.105-vs*.075-(ter[m.to]-1)*.05;
  if(a.strategy==='greedy')ch+=.035;if(a.strategy==='dfs'&&m.dir[0]===a.agent.lastDir[0]&&m.dir[1]===a.agent.lastDir[1])ch+=.055;
  if(flags.has('f'))ch+=.075;ch=CL(ch,.12,.93);
  const success=Math.random()<=ch;let reward=-.15;
  if(success){
    reward=.4+res[m.to]*2;
    if(v>=0&&v!==a.id){a.captures++;a.score+=2.2+res[m.to]*3;reward+=4}
    else a.score+=.15;
    own[m.to]=a.id;if(res[m.to]){a.score+=res[m.to]*8;reward+=res[m.to]*4}
  }
  return {success,reward,previousOwner:v};
}
function reclaim(a){
  const [cx,cy]=CP[a.id];
  for(let r=2;r<8;r++){
    const q=[];for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(IB(x,y)){const i=I(x,y);if(core[i]<0&&own[i]!==a.id)q.push(i)}
    if(q.length){own[q[RI(q.length)]]=a.id;return}
  }
}
function stats(){
  const area=[0,0,0,0],rr=[0,0,0,0];
  for(let i=0;i<N;i++){const v=own[i];if(v>=0){area[v]++;if(res[i])rr[v]+=res[i]}}
  teams.forEach(a=>{a.territory=area[a.id];a.resources=rr[a.id]});
}
function ui(){
  el.timer.textContent=ft(dur-t);
  const a=[...teams].sort((x,y)=>y.score-x.score),m=Math.max(1,...a.map(x=>x.score));
  el.score.innerHTML=a.map((x,k)=>{
    const meta=AGENT_META[x.strategy],thought=x.agent?.thought||'等待决策';
    return '<div class="score-row"><div class="score-top"><div class="score-name"><span>'+(k+1)+'</span><i class="team-swatch" style="background:'+COL[x.id]+'"></i>'+meta.name+'</div><div class="score-number">'+Math.round(x.score)+'</div></div><div class="bar"><i style="width:'+(x.score/m*100)+'%;background:'+COL[x.id]+'"></i></div><div class="score-meta"><span>领地 '+(x.territory/N*100).toFixed(1)+'%</span><span>资源 '+x.resources+'</span><span>翻色 '+x.captures+'</span><span>'+x.thinkMs.toFixed(2)+'ms</span></div><div class="thinking"><b>正在想</b><span>'+thought+'</span></div></div>';
  }).join('');
}
function log(s){
  const d=document.createElement('div');d.className='feed-item';d.innerHTML='<span class="feed-time">'+ft(t)+'</span>'+s;el.feed.prepend(d);
  while(el.feed.children.length>30)el.feed.lastChild.remove();
}
function finish(){
  run=false;end=true;t=dur;stats();ui();state('已结算');el.pause.disabled=true;el.start.disabled=false;el.start.textContent='新一局';
  const a=[...teams].sort((x,y)=>y.score-x.score),w=a[0];
  el.title.textContent=TN[w.id]+'获胜 · '+AGENT_META[w.strategy].name;
  el.sum.textContent='最终 '+Math.round(w.score)+' 分，控制 '+(w.territory/N*100).toFixed(1)+'% 的战场。';
  el.list.innerHTML=a.map((x,k)=>'<div class="result-line"><span>'+(k+1)+'. '+TN[x.id]+' · '+AGENT_META[x.strategy].name+'</span><strong>'+Math.round(x.score)+' 分</strong></div>').join('');
  log(AGENT_META[w.strategy].name+' 以 '+Math.round(w.score)+' 分拿下本局。');el.dlg.showModal();
}

function draw(){
  const cw=C.width/W,ch=C.height/H;X.clearRect(0,0,C.width,C.height);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=I(x,y),v=own[i];
    if(v>=0){X.fillStyle=COL[v];X.globalAlpha=ter[i]===3?.72:ter[i]===2?.84:.96}
    else{X.fillStyle=ter[i]===3?'#c8ced8':ter[i]===2?'#dde2e9':'#f3f5f8';X.globalAlpha=1}
    X.fillRect(x*cw,y*ch,cw+.4,ch+.4);
    if(res[i]){X.globalAlpha=1;X.fillStyle=res[i]===3?'#ffb703':'#ffd166';X.beginPath();X.arc(x*cw+cw/2,y*ch+ch/2,res[i]===3?cw*.27:cw*.18,0,Math.PI*2);X.fill()}
    if(core[i]>=0){X.globalAlpha=1;X.strokeStyle='#fff';X.lineWidth=Math.max(1,cw*.18);X.strokeRect(x*cw+cw*.18,y*ch+ch*.18,cw*.64,ch*.64)}
  }
  if(el.overlay?.checked)drawThinking(cw,ch);
  X.globalAlpha=1;
}
function drawThinking(cw,ch){
  for(const a of teams){
    const ph=a.agent?.pheromone;
    if(ph){
      let max=0;for(let i=0;i<ph.length;i++)if(ph[i]>max)max=ph[i];
      if(max>0)for(let i=0;i<ph.length;i++)if(ph[i]>.15){
        const [x,y]=XY(i);X.fillStyle=COL[a.id];X.globalAlpha=Math.min(.28,(ph[i]/max)*.25);X.fillRect(x*cw,y*ch,cw,ch);
      }
    }
    const target=a.agent?.lastChoice;
    if(target!=null){const [x,y]=XY(target);X.globalAlpha=.95;X.strokeStyle='#ffffff';X.lineWidth=Math.max(1.5,cw*.18);X.strokeRect(x*cw+1,y*ch+1,cw-2,ch-2)}
  }
}

el.start.onclick=start;el.pause.onclick=pause;el.reset.onclick=reset;el.dur.onchange=()=>{if(!run)reset()};
el.again.onclick=()=>{el.dlg.close();reset();start()};el.close.onclick=()=>el.dlg.close();
config();reset();requestAnimationFrame(loop);
