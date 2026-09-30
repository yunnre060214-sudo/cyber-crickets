export const CLASSIC_META={
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
  strongest:{name:'最强',desc:'VP 预测规划器：长局前沿投资 + 资源保有与护点 + 紧凑边界回收 + 去重 Beam 前瞻。',tier:'规划型'}
};

