import * as reactive from './reactive.js';import * as spatial from './spatial.js';import * as adaptive from './adaptive.js';import * as planning from './planning.js';
import {CLASSIC_META} from './metadata.js';import {exportAgentState,importAgentState} from './state.js';
import {PathfinderAgent} from './pathfinder.js';import {BoundaryAgent} from './boundary.js';import {UcbAgent} from './ucb.js';
const classes={bfs:reactive.FloodAgent,dfs:reactive.SpearheadAgent,greedy:reactive.GreedyAgent,random:reactive.RandomAgent,aco:adaptive.ACOAgent,voronoi:spatial.VoronoiAgent,potential:spatial.PotentialAgent,pid:adaptive.PIDAgent,qlearn:adaptive.QLearningAgent,minimax:spatial.CounterplayAgent,mcts:planning.SamplingAgent,mst:spatial.ResourceChainAgent,runner:reactive.FrontierRunnerAgent,raider:reactive.RaiderAgent,turtle:reactive.TurtleAgent,denial:reactive.ResourceDenialAgent,momentum:adaptive.MomentumAgent,strongest:planning.StrongestAgent};
export const AGENT_REGISTRY=Object.entries(CLASSIC_META).map(([id,m])=>({id,name:m.name,description:m.desc,family:m.tier,version:'2.0.0',parameterSchema:{}}));
Object.assign(classes,{pathfinder:PathfinderAgent,boundary:BoundaryAgent,ucb:UcbAgent});
AGENT_REGISTRY.push({id:'pathfinder',name:'A* 通路规划',description:'执行真实 A* 四邻通路搜索，按地形与敌占成本寻找资源。',family:'路径型',version:'2.0.0',parameterSchema:{}},{id:'boundary',name:'边界调度器',description:'依据支援、补洞与公开资源保有价值安排边界行动。',family:'调度型',version:'2.0.0',parameterSchema:{}},{id:'ucb',name:'UCB1 自适应',description:'四个宏观臂按真实次数与平均 VP 速率变化执行 UCB1。',family:'学习型',version:'2.0.0',parameterSchema:{}});
export function createAgent(id,context){const C=classes[id];if(!C)throw Error('UNKNOWN_STRATEGY');const a=new C(context.seat,context.size,context.rng),select=a.selectAction.bind(a);a.participantId=context.participantId;
 a.selectAction=(view,budget)=>{if(!view.options.length)return null;a.budget=budget;a.best=null;a.bestScore=-Infinity;a.evaluated=[];let move;
  if(!budget.remaining){a.thought='预算耗尽，选择首个合法目标';move=view.options[0];}
  else try{move=select(view)}catch(e){a.thought=e.message==='BUDGET_EXHAUSTED'?'预算耗尽，使用已评估最佳目标':'策略异常，使用确定性回退';move=a.best??view.options[0];}
  move=view.options.find(o=>o.from===move?.from&&o.to===move?.to)??a.best??view.options[0];
  return {...move,explain:{method:a.thought,features:{ownN:move.ownN,enemyN:move.enemyN,resource:move.resource,nearestResourceDist:move.nearestResourceDist},chosenScore:Number.isFinite(a.bestScore)?a.bestScore:null,alternatives:[...a.evaluated].sort((x,y)=>y.score-x.score).slice(0,3),budgetUsed:budget.used,...(a.lastPath?{path:[...a.lastPath]}:{})}};
 };a.exportState=()=>exportAgentState(a,id);a.importState=s=>importAgentState(a,s,id);return a;
}
