import { verify, canonicalHash, decode } from "../engine/hash.js";
import { createMatchConfig } from "../engine/config.js";
import { generateMap } from "../engine/maps.js";
import { createRng } from "../engine/rng.js";
import { createAgent } from "../agents/registry.js";
import { reconstructLedger, validateBoard, equalBoard } from "./validation.js";
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7;
export function validateCheckpoint(data,{replay}={}) {
  if(data?.schemaVersion!==3)throw Error("UNSUPPORTED_SCHEMA");
  verify(data);
  const config=createMatchConfig(data.config);
  if(canonicalHash(config)!==canonicalHash(data.config))throw Error("CHECKPOINT_CONFIG_MISMATCH");
  const classic=config.mode==="classic";
  if(classic!==(data.kind==="classic"))throw Error("CHECKPOINT_CONFIG_MISMATCH");
  const world=classic?decode(data.world):null;
  const initialBoard=replay?.initialBoard??(classic?decode(data.initialBoard):generateMap(config).board);
  if(!Array.isArray(data.ledger)||!Number.isSafeInteger(data.tick)||data.tick<0||data.tick!==data.ledger.length ||
    (!classic&&data.ledgerCursor!==data.ledger.length) ||
    (replay&&canonicalHash(data.ledger)!==canonicalHash(replay.tickRecords)))throw Error("INVALID_CHECKPOINT_CURSOR");
  const state=reconstructLedger({config,initialBoard,tickRecords:data.ledger,boardCheckpoints:classic?[]:data.boardCheckpoints});
  const board=classic?{...decode(data.initialBoard),owner:world.owner,terrain:world.terrain,resources:world.resources,core:world.core}:data.board;
  validateBoard(board,config);
  const timeMs=classic?world.time*1000:data.timeMs,finished=classic?world.finished:data.finished;
  if(!close(timeMs,state.timeMs)||finished!==state.finished||(!classic&&timeMs!==data.tick*20)||
    !equalBoard(board,state.board)||!Array.isArray(data.teams)||data.teams.length!==config.teamCount)throw Error("CHECKPOINT_LEDGER_MISMATCH");
  const teams=classic?data.teams.map(t=>decode(t.data)):data.teams;
  for(let seat=0;seat<config.teamCount;seat++){
    const t=teams[seat],e=config.entrants[seat];
    if(!close(t.score,state.scores[seat]) || (classic?(t.id!==seat||t.strategy!==e.strategyId):(t.participantId!==e.participantId||t.strategyId!==e.strategyId||t.strategyVersion!==e.strategyVersion||t.seat!==seat)))throw Error("CHECKPOINT_TEAM_MISMATCH");
  }
  if(classic){
    if(!Array.isArray(data.rngCounts)||data.rngCounts.length!==config.teamCount+1||
      data.rngCounts.some(n=>!Number.isSafeInteger(n)||n<0||n>10000+data.tick*4096))throw Error("INVALID_RNG_STATE");
    for(const t of data.teams) {
      const agent=decode(t.agent);
      if(!agent||typeof agent!=="object")throw Error("INVALID_AGENT_STATE");
      for(const key of ["pheromone","recentTargets"])if(agent[key]!==undefined&&(!ArrayBuffer.isView(agent[key])||agent[key].length!==(key==="pheromone"?4096:14)))throw Error("INVALID_AGENT_STATE_LENGTH");
    }
  }else{
    if(!Array.isArray(data.scores)||data.scores.length!==config.teamCount||data.scores.some((n,i)=>!close(n,state.scores[i]))||
      !Array.isArray(data.agentStates)||data.agentStates.length!==config.teamCount||
      !Array.isArray(data.rngStates)||data.rngStates.length!==config.teamCount)throw Error("INVALID_AGENT_STATE");
    const expectedEvents=generateMap(config).eventPlan.filter(e=>e.timeMs<=timeMs).map(e=>e.id);
    if(!Array.isArray(data.eventState)||canonicalHash(data.eventState)!==canonicalHash(expectedEvents)||
      canonicalHash(data.events)!==canonicalHash(data.ledger.flatMap(r=>r.events)))throw Error("INVALID_EVENT_STATE");
    for(let seat=0;seat<config.teamCount;seat++){
      const e=config.entrants[seat],rng=createRng(config.seed,"validation");
      rng.importState(data.rngStates[seat]);
      if(canonicalHash(data.rngStates[seat])!==canonicalHash(data.agentStates[seat].rng))throw Error("INVALID_RNG_STATE");
      const agent=createAgent(e.strategyId,{seat,participantId:e.participantId,size:4096,rng,parameters:e.parameters,budgetProfile:config.budgetProfile});
      agent.importState(data.agentStates[seat]);
    }
  }
  return data;
}
