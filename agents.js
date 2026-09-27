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
  mst:{name:'资源链启发式',desc:'优先靠近资源节点；不构造最小生成树。',tier:'结构型'},
  runner:{name:'Frontier Runner',desc:'低阻力优先，牺牲阵型换取最快铺图速度。',tier:'竞速型'},
  raider:{name:'Raider 掠袭者',desc:'专挑敌方薄弱边界翻色，偏好孤立目标。',tier:'侵袭型'},
  turtle:{name:'Turtle 堡垒',desc:'高邻接密度推进，保持紧凑领地并降低暴露面。',tier:'防守型'},
  denial:{name:'Resource Denial',desc:'优先夺走敌占资源，其次封锁高价值节点。',tier:'压制型'},
  momentum:{name:'Momentum 变速器',desc:'原创策略：根据面积、敌压和赛程阶段动态切换节奏。',tier:'自适应型'},
  strongest:{name:'最强',desc:'阶段/比分感知 VP 规划器：真实边际 VP + 资源赛道 + 前沿跑道 + Beam 前瞻。',tier:'规划型'}
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

class FrontierRunnerAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>(o.owner<0?6:0)-o.terrain*3.2-o.ownN*.45+
      o.resource*2.5-o.enemyPressure*1.2+this.rng.next()*1.8);
    this.thought='寻找最低阻力缺口，以铺图速度换阵型完整度';return m;
  }
}

class RaiderAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>(o.enemy?10:0)+(o.enemy?Math.max(0,3-o.enemyN)*3:0)+
      o.resource*4-o.ownN*.35-o.terrain+this.rng.next()*1.4);
    this.thought='寻找敌方薄弱边界，优先切掉孤立格';return m;
  }
}

class TurtleAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.ownN*4.6-o.enemyN*2.4+(o.enemy?.8:2.5)+
      o.resource*3-o.terrain*.7+this.rng.next()*.8);
    this.thought='压缩暴露边界，沿高邻接区域稳步推进';return m;
  }
}

class ResourceDenialAgent extends BaseAgent{
  selectAction(v){
    const m=this.choose(v.options,o=>o.resource*(o.enemy?16:11)+(o.enemy?4:0)+
      o.resourcePull*1.6-o.enemyN*.8-o.terrain+this.rng.next());
    this.thought='优先切断对手资源收益，再抢无主节点';return m;
  }
}

class MomentumAgent extends BaseAgent{
  selectAction(v){
    const behind=v.share<.22, late=v.progress>.68, pressured=v.localPressure>.32;
    const attack=clamp((behind?.28:0)+(late?.32:0)+(pressured?.2:0)+.28,0,1);
    const m=this.choose(v.options,o=>attack*((o.enemy?8:1)+o.resource*4+o.enemyN*.7)+
      (1-attack)*(o.ownN*3.1+(o.owner<0?3:0)-o.enemyN)+
      (late?o.resource*3:0)-o.terrain*.9+this.rng.next()*1.1);
    this.thought=attack>.7?'进入冲刺档，主动争夺敌区和资源':
      attack<.45?'保持巡航档，扩大连续领地':'切入变速档，扩张与进攻并行';
    return m;
  }
}


class StrongestAgent extends BaseAgent{
  constructor(id,size,rng){
    super(id,size,rng);
    this.recentTargets=new Int32Array(16).fill(-1);
    this.recentCursor=0;
    this.failures=new Map();
  }

  estimatedChance(o,overclock){
    let p=o.owner<0
      ? .93-(o.terrain-1)*.12
      : .39+o.ownN*.105-o.enemyN*.075-(o.terrain-1)*.05;
    if(overclock)p+=.075;
    // The rules already expose the exact probability model. Recent luck is not
    // evidence that the next independent roll became easier or harder.
    return clamp(p,.12,.93);
  }

  situation(v){
    const teamCount=Math.max(2,v.teamCount||4);
    const fair=1/teamCount;
    const remaining=Math.max(.05,Number.isFinite(v.remaining)?v.remaining:(1-v.progress)*90);
    const rank=Number.isFinite(v.rank)?v.rank:(v.share<fair*.92?2:1);
    const scoreGap=Math.max(0,v.scoreGap||0);
    const rateGap=Math.max(0,(v.leaderVpRate||0)-(v.vpRate||0));
    const recoverability=clamp(scoreGap/Math.max(1,remaining*10),0,1);
    const trailing=rank>1||v.share<fair*.9;
    const leading=rank===1&&v.progress>.24;
    const urgency=clamp((trailing?.14:0)+recoverability*1.85+
      clamp(rateGap/3.5,0,1)*.42+(v.progress>.72?.10:0),0,1);
    const phase=v.progress<.34?'early':v.progress<.72?'mid':v.progress<.88?'late':'final';
    return {teamCount,fair,remaining,rank,trailing,leading,urgency,phase};
  }

  retryPenalty(o,s){
    const failed=this.failures.get(o.to)||0;
    let repeated=0;
    for(let i=0;i<this.recentTargets.length;i++)if(this.recentTargets[i]===o.to)repeated++;
    const strategic=o.resource>0||o.nearestResourceDist<=1;
    const failWeight=strategic?.22:o.enemy?.58:(s.phase==='final'?.26:1);
    const repeatWeight=strategic?.035:.10;
    return failed*failWeight+repeated*repeatWeight;
  }

  staticValue(o,v,{continuation=false,situation=null}={}){
    const s=situation||this.situation(v);
    const cellCount=Math.max(1,v.cellCount||v.width*v.height||this.size);
    const resourceTotal=Math.max(1,v.resourceTotal||40);
    const p=this.estimatedChance(o,s.phase==='final');

    // Convert a capture into its expected remaining-match VP contribution.
    // This fixes the old 6.5-vs-3.5 shortcut, which ignored that area is divided
    // by 4096 cells while resources are divided by a much smaller resource pool.
    const areaCarry=s.remaining*6.5/cellCount;
    const resourceCarry=s.remaining*3.5*o.resource/resourceTotal;
    const hold=clamp(.84+o.ownN*.06-o.enemyN*.05-o.enemyPressure*.13,.46,1.05);
    const enemySwing=o.enemy
      ?1+(s.trailing?.92:s.leading?.44:.68)
      :1;
    const continuationScale=continuation?.56:1;
    const direct=(areaCarry+resourceCarry)*enemySwing*hold*continuationScale;

    // Treat movement toward the next uncontrolled resource as an investment.
    // Resource specialists lead early because resource VP starts compounding
    // immediately; this planner now prices that opportunity explicitly.
    const d=o.nearestResourceDist;
    const avgResourceValue=1.36;
    const pathBase=s.remaining*3.5*avgResourceValue/resourceTotal;
    const phasePath={early:1.10,mid:.94,late:.56,final:.14}[s.phase];
    const resourceFair=1/s.teamCount;
    const resourceDeficit=clamp((resourceFair-(v.resourceShare||0))/Math.max(.01,resourceFair),0,1);
    const demand=(.84+resourceDeficit*.28+(s.trailing?.16*s.urgency:0))*(continuation?.62:1);
    const distDecay={early:.28,mid:.36,late:.52,final:.88}[s.phase];
    const path=(o.resource>0||d>=99)?0:
      pathBase*phasePath*demand/(1+d*distDecay);

    // Prefer frontier cells that leave several productive next moves. This is
    // the anti-stall component that prevents a compact early shape from giving
    // all strategic space to Runner / Potential / resource-chain opponents.
    const next=o.continuations||[];
    const openBranches=next.filter(n=>n.owner<0).length;
    const attackBranches=next.filter(n=>n.enemy).length;
    const runwayCells=openBranches*({early:7.0,mid:4.2,late:2.1,final:.45}[s.phase])+
      attackBranches*({early:1.0,mid:2.1,late:2.8,final:1.2}[s.phase]);
    const runway=areaCarry*runwayCells*(continuation?.34:1);

    // In otherwise similar positions, move the frontier outward early and
    // become more compact later or while protecting a lead.
    const outward=areaCarry*clamp(o.distOwnCore/18,0,2.2)*
      ({early:3.2,mid:1.55,late:.55,final:.08}[s.phase])*(continuation?.5:1);
    const structureCells=o.ownN*({early:.62,mid:1.08,late:1.42,final:1.05}[s.phase])-
      o.enemyN*({early:.12,mid:.42,late:.58,final:.22}[s.phase]);
    const structure=areaCarry*structureCells*(s.leading?2.15:1.72)*(continuation?.58:1);

    // Pressure is a cost, but resource objectives and comeback states are
    // allowed to accept more contact instead of automatically yielding space.
    const rawRisk=areaCarry*(o.enemyPressure*4.2+o.enemyN*.62+
      Math.max(0,2-o.ownN)*(o.enemy?.72:.30));
    const riskTolerance=clamp(1-(s.trailing?.46*s.urgency:0)+(s.leading?.18:0),.42,1.18);
    const objectiveDiscount=(o.resource>0||d<=1)?.58:1;
    const pressure=rawRisk*riskTolerance*objectiveDiscount*(continuation?.55:1);

    const retry=this.retryPenalty(o,s)*areaCarry*
      ({early:2.8,mid:2.55,late:1.7,final:.72}[s.phase])*(continuation?0:1);

    return {p,utility:p*(direct+path+runway+outward+structure)-pressure-retry,
      direct,path,runway};
  }

  continuationValue(o,v,s){
    const next=o.continuations||[];
    if(!next.length)return 0;
    const scored=next.map(n=>this.staticValue(n,v,{continuation:true,situation:s}).utility)
      .sort((x,y)=>y-x).slice(0,4);
    const weights=[.56,.24,.13,.07];
    let value=0;
    for(let i=0;i<scored.length;i++)value+=scored[i]*weights[i];
    const areaCarry=s.remaining*6.5/Math.max(1,v.cellCount||v.width*v.height||this.size);
    const breadth=Math.min(4,next.length)*areaCarry*
      ({early:2.2,mid:1.25,late:.55,final:.08}[s.phase]);
    return value+breadth;
  }

  selectAction(v){
    if(!v.options.length)return null;
    const s=this.situation(v);

    // The same target can appear from several friendly origins. Collapse those
    // duplicates so the beam represents distinct strategic choices.
    const unique=[],seen=new Set();
    for(const o of v.options){
      if(seen.has(o.to))continue;
      seen.add(o.to);unique.push(o);
    }

    const ranked=unique.map(o=>{
      const now=this.staticValue(o,v,{situation:s});
      return {o,now,pre:now.utility};
    }).sort((x,y)=>y.pre-x.pre);

    const beamWidth={early:24,mid:22,late:18,final:12}[s.phase];
    const lookWeight={early:.72,mid:.61,late:.40,final:.15}[s.phase];
    const beam=ranked.slice(0,Math.min(beamWidth,ranked.length));
    let best=null,bestScore=-Infinity,bestFuture=0,bestP=0,bestNow=null;
    for(const item of beam){
      const future=this.continuationValue(item.o,v,s);
      const lookahead=item.now.p*future*lookWeight;
      const score=item.now.utility+lookahead+this.rng.next()*1e-6;
      if(score>bestScore){
        bestScore=score;best=item.o;bestFuture=lookahead;bestP=item.now.p;bestNow=item.now;
      }
    }

    if(best){
      this.lastChoice=best.to;
      this.recentTargets[this.recentCursor]=best.to;
      this.recentCursor=(this.recentCursor+1)%this.recentTargets.length;
      const motive=best.resource>0?(best.enemy?'夺取敌方资源':'直接资源'):
        best.nearestResourceDist<=2?'资源赛道':
        best.enemy?'压制翻色':
        (best.continuations?.filter(n=>n.owner<0).length||0)>=2?'扩张跑道':
        best.ownN>=2?'连续阵型':'边界扩张';
      const phaseName={early:'开局',mid:'中盘',late:'后盘',final:'终局'}[s.phase];
      const posture=s.trailing?'追分':s.leading?'控盘':'均衡';
      this.thought=phaseName+'·'+posture+'：'+motive+'；成功率 '+Math.round(bestP*100)+
        '%；即时 '+bestNow.utility.toFixed(2)+'；前瞻 '+bestFuture.toFixed(2);
    }
    return best;
  }

  onResult(r){
    super.onResult(r);
    if(!r?.move)return;
    const key=r.move.to;
    if(r.success)this.failures.delete(key);
    else this.failures.set(key,Math.min(6,(this.failures.get(key)||0)+1));
    if(this.failures.size>128)this.failures.delete(this.failures.keys().next().value);
  }

  reset(){
    this.recentTargets.fill(-1);
    this.recentCursor=0;
    this.failures.clear();
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
  const C={bfs:FloodAgent,dfs:SpearheadAgent,greedy:GreedyAgent,random:RandomAgent,aco:ACOAgent,voronoi:VoronoiAgent,potential:PotentialAgent,pid:PIDAgent,qlearn:QLearningAgent,minimax:CounterplayAgent,mcts:SamplingAgent,mst:ResourceChainAgent,runner:FrontierRunnerAgent,raider:RaiderAgent,turtle:TurtleAgent,denial:ResourceDenialAgent,momentum:MomentumAgent,strongest:StrongestAgent}[type]||RandomAgent;
  return new C(id,size,rng);
}
