export const AGENT_META={
  bfs:{name:'BFS 风格洪流',desc:'边界连续性启发式，均匀铺开；不执行层序搜索。',tier:'反应型'},
  dfs:{name:'DFS 风格穿刺',desc:'方向惯性启发式，持续深入；不维护深搜栈。',tier:'快攻型'},
  greedy:{name:'Greedy 疯狗',desc:'只看眼前收益，资源与翻色优先。',tier:'反应型'},
  random:{name:'Random 赌徒',desc:'完全随机，作为基准线和整活位。',tier:'基准型'},
  aco:{name:'ACO 风格蚁道',desc:'信息素沉积与蒸发的轻量启发式。',tier:'群体型'},
  voronoi:{name:'Voronoi 圈地',desc:'围绕本方核心和现有领地塑造干净势力圈。',tier:'稳健型'},
  potential:{name:'势场 流体',desc:'资源产生引力，强敌产生斥力，像流体绕行。',tier:'反应型'},
  pid:{name:'PID 风格稳健',desc:'根据目标面积与当前面积误差调整扩张/防守。',tier:'稳健型'},
  qlearn:{name:'Q-Learning 学习者',desc:'在扩张、进攻、资源、巩固四种宏观策略间在线学习。',tier:'学习型'},
  minimax:{name:'防反启发式',desc:'按局部敌压估计反击风险；不构造博弈树。',tier:'防守型'},
  mcts:{name:'Monte Carlo 采样',desc:'固定次数采样候选落点；不执行 MCTS 树搜索。',tier:'采样型'},
  mst:{name:'资源链启发式',desc:'优先靠近资源节点；不构造最小生成树。',tier:'结构型'}
};

const pickBest=(arr,score)=>{
  let best=null,b=-Infinity;
  for(const x of arr){const s=score(x);if(s>b){b=s;best=x}}
  return best;
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

class BaseAgent{
  constructor(id,size,rng){this.id=id;this.size=size;this.rng=rng;this.lastDir=[1,0];this.thought='等待决策';this.lastChoice=null}
  choose(options,score){const m=pickBest(options,score);this.lastChoice=m?.to??null;return m}
  onResult(result){if(result?.move?.dir)this.lastDir=result.move.dir}
  reset(){}
}

class FloodAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.ownN*2.6+o.resource*5-o.terrain*1.25-o.enemyN*.45+this.rng.next()*1.5);
    this.thought='压平边界，优先维持连续战线';return m;
  }
}
class SpearheadAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>((o.dir[0]===this.lastDir[0]&&o.dir[1]===this.lastDir[1])?8:0)+(o.enemy?4:0)+o.resource*2.4-o.terrain+this.rng.next()*3);
    this.thought='沿成功方向继续穿刺';return m;
  }
}
class GreedyAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.resource*14+(o.enemy?8:0)+Math.max(0,3-o.enemyN)*2-o.terrain*1.4+this.rng.next()*2);
    this.thought='只吃眼前最高价值';return m;
  }
}
class RandomAgent extends BaseAgent{
  selectAction(v){const m=v.options[(this.rng.next()*v.options.length)|0]??null;this.lastChoice=m?.to??null;this.thought='随机游走，拒绝解释';return m}
}

class ACOAgent extends BaseAgent{
  constructor(id,size,rng){super(id,size,rng);this.pheromone=new Float32Array(size);this.evaporateAt=0}
  selectAction(v){
    if(v.time-this.evaporateAt>.9){for(let i=0;i<this.pheromone.length;i++)this.pheromone[i]*=.84;this.evaporateAt=v.time}
    const m=this.choose(v.options,o=>this.pheromone[o.to]*5+o.resource*8+o.ownN*1.2+(o.enemy?2.5:0)-o.terrain+this.rng.next()*2.4);
    this.thought='沿高信息素通道推进，成功路线会被强化';return m;
  }
  onResult(r){super.onResult(r);if(r?.success&&r.move){this.pheromone[r.move.to]+=r.reward>5?2.6:1.1;this.pheromone[r.move.from]+=.45}}
}

class VoronoiAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>{
      const ownDist=o.distOwnCore;
      const rivalDist=o.distRivalCore;
      return (rivalDist-ownDist)*2.8+o.ownN*2.2+o.resource*4-(o.enemy?1.2:0)-o.terrain*.8+this.rng.next();
    });
    this.thought='先吃属于自己的势力圈，再推整齐边界';return m;
  }
}

class PotentialAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.resourcePull*3.8-o.enemyPressure*2.6+o.ownN*1.4-o.terrain*.7+(o.enemy?1.6:0)+this.rng.next()*1.4);
    this.thought='资源吸引，强敌排斥，绕开硬骨头';return m;
  }
}

class PIDAgent extends BaseAgent{
  constructor(id,size,rng){super(id,size,rng);this.integral=0;this.prev=0}
  selectAction(v){
    const target=.26+(v.progress>.72?.06:0),err=target-v.share;
    this.integral=clamp(this.integral+err*.2,-.5,.5);const deriv=err-this.prev;this.prev=err;
    const output=2.4*err+.5*this.integral+.85*deriv;
    const aggression=clamp(.45+output,0,1);
    const m=this.choose(v.options,o=>(1-aggression)*(o.ownN*3-o.enemyN*1.7)+aggression*((o.enemy?6:1)+o.resource*5)-o.terrain+this.rng.next());
    this.thought=aggression>.62?'面积落后，PID 提高扩张力度':aggression<.35?'面积超标，PID 转向巩固':'误差稳定，维持均衡输出';
    return m;
  }
}

class QLearningAgent extends BaseAgent{
  constructor(id,size,rng){
    super(id,size,rng);this.alpha=.18;this.gamma=.88;this.eps=.16;
    this.lastState=null;this.lastMacro=null;this.pending=null;this.q={};
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
    if(this.pending){
      const {state,macro,reward}=this.pending,old=this.row(state)[macro];
      this.row(state)[macro]=old+this.alpha*(reward+this.gamma*Math.max(...Object.values(row))-old);
      this.pending=null;
    }
    const macro=this.rng.next()<this.eps?macros[(this.rng.next()*macros.length)|0]:macros.reduce((a,b)=>row[a]>=row[b]?a:b);
    this.lastState=s;this.lastMacro=macro;
    const score={
      expand:o=>(!o.enemy?5:0)+o.ownN*1.5-o.terrain,
      attack:o=>(o.enemy?9:0)+o.enemyN*1.7+o.resource*2,
      resource:o=>o.resource*13+o.resourcePull*2-o.terrain,
      fortify:o=>o.ownN*3.2-o.enemyN*2+(o.enemy?1:0)
    }[macro];
    const m=this.choose(v.options,o=>score(o)+this.rng.next()*1.6);
    this.thought='Q 表选择宏观策略：'+({expand:'扩张',attack:'进攻',resource:'抢资源',fortify:'巩固'}[macro]);
    return m;
  }
  onResult(r){
    super.onResult(r);if(!this.lastState||!this.lastMacro)return;
    this.pending={state:this.lastState,macro:this.lastMacro,reward:r?.reward??0};
  }
  endMatch(){
    if(!this.pending)return;
    const {state,macro,reward}=this.pending,old=this.row(state)[macro];
    this.row(state)[macro]=old+this.alpha*(reward-old);this.pending=null;
  }
}

class CounterplayAgent extends BaseAgent{
  selectAction(v){
    const sample=sampleOptions(v.options,36,this.rng);
    const m=this.choose(sample,o=>{
      const mine=o.resource*8+(o.enemy?7:2)+o.ownN*2-o.terrain;
      const worstReply=o.enemyN*2.7+o.enemyPressure*4+(o.enemy?1:0);
      return mine-worstReply+this.rng.next()*.7;
    });
    this.thought='估计局部敌压，优先堵口和防夹击';return m;
  }
}

class SamplingAgent extends BaseAgent{
  selectAction(v){
    const opts=sampleOptions(v.options,28,this.rng);
    if(!opts.length)return null;
    const stats=opts.map(move=>({move,n:0,w:0}));
    let k=0;
    while(k<224){
      const s=stats[k%stats.length];k++;let total=0;
      for(let d=0;d<3;d++)total+=(s.move.resource*5+(s.move.enemy?4:1)+s.move.ownN*1.2-s.move.enemyN*.9-s.move.terrain*.6)+(this.rng.next()*5-2.1);
      s.n++;s.w+=total;
    }
    const best=stats.reduce((a,b)=>(a.w/Math.max(1,a.n))>(b.w/Math.max(1,b.n))?a:b);
    this.lastChoice=best.move.to;this.thought='固定 '+k+' 次局部采样，选择平均回报最高落点';return best.move;
  }
}

class ResourceChainAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>-o.nearestResourceDist*2.4+o.resource*12+o.ownN*.8-o.terrain*1.3-(o.enemy?1.5:0)+this.rng.next());
    this.thought='朝最近资源节点推进，形成枝状轨迹';return m;
  }
}

function sampleOptions(options,limit,rng){
  if(options.length<=limit)return options;
  const sample=[...options];
  for(let i=sample.length-1;i>0;i--){
    const j=rng.int(i+1);[sample[i],sample[j]]=[sample[j],sample[i]];
  }
  return sample.slice(0,limit);
}

export function createAgent(type,id,size,rng){
  const C={bfs:FloodAgent,dfs:SpearheadAgent,greedy:GreedyAgent,random:RandomAgent,aco:ACOAgent,voronoi:VoronoiAgent,potential:PotentialAgent,pid:PIDAgent,qlearn:QLearningAgent,minimax:CounterplayAgent,mcts:SamplingAgent,mst:ResourceChainAgent}[type]||RandomAgent;
  return new C(id,size,rng);
}
