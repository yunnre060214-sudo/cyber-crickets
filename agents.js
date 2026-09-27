export const AGENT_META={
  bfs:{name:'BFS 洪流',desc:'均匀推进，优先填满连续边界。',tier:'反应型'},
  dfs:{name:'DFS 穿刺',desc:'沿既有方向持续深入，擅长撕开缝隙。',tier:'快攻型'},
  greedy:{name:'Greedy 疯狗',desc:'只看眼前收益，资源与翻色优先。',tier:'反应型'},
  random:{name:'Random 赌徒',desc:'完全随机，作为基准线和整活位。',tier:'基准型'},
  aco:{name:'ACO 蚁群',desc:'信息素沉积与蒸发，逐渐形成高频“蚁道”。',tier:'群体型'},
  voronoi:{name:'Voronoi 圈地',desc:'围绕本方核心和现有领地塑造干净势力圈。',tier:'稳健型'},
  potential:{name:'势场 流体',desc:'资源产生引力，强敌产生斥力，像流体绕行。',tier:'反应型'},
  pid:{name:'PID 稳健',desc:'根据目标面积与当前面积误差动态调整扩张/防守。',tier:'稳健型'},
  qlearn:{name:'Q-Learning 学习者',desc:'在扩张、进攻、资源、巩固四种宏观策略间在线学习。',tier:'学习型'},
  minimax:{name:'Minimax 谋士',desc:'短视野极小极大，假设别人都在针对自己。',tier:'深谋型'},
  mcts:{name:'MCTS 赌树',desc:'在有限时间预算内做随机 rollout，寻找“神来一手”。',tier:'深谋型'},
  mst:{name:'MST 枝网',desc:'优先用低成本路径连接高价值资源点，形成树枝状网络。',tier:'结构型'}
};

const pickBest=(arr,score)=>{
  let best=null,b=-Infinity;
  for(const x of arr){const s=score(x);if(s>b){b=s;best=x}}
  return best;
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

class BaseAgent{
  constructor(id,size){this.id=id;this.size=size;this.lastDir=[1,0];this.thought='等待决策';this.lastChoice=null}
  choose(options,score){const m=pickBest(options,score);this.lastChoice=m?.to??null;return m}
  onResult(result){if(result?.move?.dir)this.lastDir=result.move.dir}
  reset(){}
}

class BFSAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.ownN*2.6+o.resource*5-o.terrain*1.25-o.enemyN*.45+Math.random()*1.5);
    this.thought='压平边界，优先维持连续战线';return m;
  }
}
class DFSAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>((o.dir[0]===this.lastDir[0]&&o.dir[1]===this.lastDir[1])?8:0)+(o.enemy?4:0)+o.resource*2.4-o.terrain+Math.random()*3);
    this.thought='沿成功方向继续穿刺';return m;
  }
}
class GreedyAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.resource*14+(o.enemy?8:0)+Math.max(0,3-o.enemyN)*2-o.terrain*1.4+Math.random()*2);
    this.thought='只吃眼前最高价值';return m;
  }
}
class RandomAgent extends BaseAgent{
  selectAction(v){const m=v.options[(Math.random()*v.options.length)|0]??null;this.lastChoice=m?.to??null;this.thought='随机游走，拒绝解释';return m}
}

class ACOAgent extends BaseAgent{
  constructor(id,size){super(id,size);this.pheromone=new Float32Array(size);this.evaporateAt=0}
  selectAction(v){
    if(v.time-this.evaporateAt>.9){for(let i=0;i<this.pheromone.length;i++)this.pheromone[i]*=.84;this.evaporateAt=v.time}
    const m=this.choose(v.options,o=>this.pheromone[o.to]*5+o.resource*8+o.ownN*1.2+(o.enemy?2.5:0)-o.terrain+Math.random()*2.4);
    this.thought='沿高信息素通道推进，成功路线会被强化';return m;
  }
  onResult(r){super.onResult(r);if(r?.success&&r.move){this.pheromone[r.move.to]+=r.reward>5?2.6:1.1;this.pheromone[r.move.from]+=.45}}
}

class VoronoiAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>{
      const ownDist=o.distOwnCore;
      const rivalDist=o.distRivalCore;
      return (rivalDist-ownDist)*2.8+o.ownN*2.2+o.resource*4-(o.enemy?1.2:0)-o.terrain*.8+Math.random();
    });
    this.thought='先吃属于自己的势力圈，再推整齐边界';return m;
  }
}

class PotentialAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.resourcePull*3.8-o.enemyPressure*2.6+o.ownN*1.4-o.terrain*.7+(o.enemy?1.6:0)+Math.random()*1.4);
    this.thought='资源吸引，强敌排斥，绕开硬骨头';return m;
  }
}

class PIDAgent extends BaseAgent{
  constructor(id,size){super(id,size);this.integral=0;this.prev=0}
  selectAction(v){
    const target=.26+(v.progress>.72?.06:0),err=target-v.share;
    this.integral=clamp(this.integral+err*.2,-.5,.5);const deriv=err-this.prev;this.prev=err;
    const output=2.4*err+.5*this.integral+.85*deriv;
    const aggression=clamp(.45+output,0,1);
    const m=this.choose(v.options,o=>(1-aggression)*(o.ownN*3-o.enemyN*1.7)+aggression*((o.enemy?6:1)+o.resource*5)-o.terrain+Math.random());
    this.thought=aggression>.62?'面积落后，PID 提高扩张力度':aggression<.35?'面积超标，PID 转向巩固':'误差稳定，维持均衡输出';
    return m;
  }
}

class QLearningAgent extends BaseAgent{
  constructor(id,size){
    super(id,size);this.alpha=.18;this.gamma=.88;this.eps=.16;this.lastState=null;this.lastMacro=null;
    try{this.q=JSON.parse(localStorage.getItem('cyber-crickets-q')||'{}')}catch{this.q={}}
  }
  state(v){
    const share=v.share<.18?'S':v.share<.28?'M':'L';
    const pressure=v.localPressure>.48?'H':v.localPressure>.22?'M':'L';
    const rich=v.options.some(o=>o.resource>0)?'R':'N';
    return share+pressure+rich;
  }
  row(s){return this.q[s]||(this.q[s]={expand:0,attack:0,resource:0,fortify:0})}
  selectAction(v){
    const s=this.state(v),row=this.row(s),macros=Object.keys(row);
    const macro=Math.random()<this.eps?macros[(Math.random()*macros.length)|0]:macros.reduce((a,b)=>row[a]>=row[b]?a:b);
    this.lastState=s;this.lastMacro=macro;
    const score={
      expand:o=>(!o.enemy?5:0)+o.ownN*1.5-o.terrain,
      attack:o=>(o.enemy?9:0)+o.enemyN*1.7+o.resource*2,
      resource:o=>o.resource*13+o.resourcePull*2-o.terrain,
      fortify:o=>o.ownN*3.2-o.enemyN*2+(o.enemy?1:0)
    }[macro];
    const m=this.choose(v.options,o=>score(o)+Math.random()*1.6);
    this.thought='Q 表选择宏观策略：'+({expand:'扩张',attack:'进攻',resource:'抢资源',fortify:'巩固'}[macro]);
    return m;
  }
  onResult(r){
    super.onResult(r);if(!this.lastState||!this.lastMacro)return;
    const row=this.row(this.lastState),old=row[this.lastMacro],reward=r?.reward??0;
    row[this.lastMacro]=old+this.alpha*(reward-old);
    if(Math.random()<.08){try{localStorage.setItem('cyber-crickets-q',JSON.stringify(this.q))}catch{}}
  }
}

class MinimaxAgent extends BaseAgent{
  selectAction(v){
    const sample=v.options.length>36?[...v.options].sort(()=>Math.random()-.5).slice(0,36):v.options;
    const m=this.choose(sample,o=>{
      const mine=o.resource*8+(o.enemy?7:2)+o.ownN*2-o.terrain;
      const worstReply=o.enemyN*2.7+o.enemyPressure*4+(o.enemy?1:0);
      return mine-worstReply+Math.random()*.7;
    });
    this.thought='搜索 2 层近似最坏反击，优先堵口和防被夹';return m;
  }
}

class MCTSAgent extends BaseAgent{
  selectAction(v){
    const opts=v.options.length>28?[...v.options].sort(()=>Math.random()-.5).slice(0,28):v.options;
    if(!opts.length)return null;
    const stats=opts.map(move=>({move,n:0,w:0})),deadline=performance.now()+2.3;
    let k=0;
    while(performance.now()<deadline&&k<220){
      const s=stats[k%stats.length];k++;let total=0;
      for(let d=0;d<3;d++)total+=(s.move.resource*5+(s.move.enemy?4:1)+s.move.ownN*1.2-s.move.enemyN*.9-s.move.terrain*.6)+(Math.random()*5-2.1);
      s.n++;s.w+=total;
    }
    const best=stats.reduce((a,b)=>(a.w/Math.max(1,a.n))>(b.w/Math.max(1,b.n))?a:b);
    this.lastChoice=best.move.to;this.thought='2.3ms rollout '+k+' 次，选择平均回报最高落子';return best.move;
  }
}

class MSTAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>-o.nearestResourceDist*2.4+o.resource*12+o.ownN*.8-o.terrain*1.3-(o.enemy?1.5:0)+Math.random());
    this.thought='以最低代价把资源节点连成枝状网络';return m;
  }
}

export function createAgent(type,id,size){
  const C={bfs:BFSAgent,dfs:DFSAgent,greedy:GreedyAgent,random:RandomAgent,aco:ACOAgent,voronoi:VoronoiAgent,potential:PotentialAgent,pid:PIDAgent,qlearn:QLearningAgent,minimax:MinimaxAgent,mcts:MCTSAgent,mst:MSTAgent}[type]||RandomAgent;
  return new C(id,size);
}
