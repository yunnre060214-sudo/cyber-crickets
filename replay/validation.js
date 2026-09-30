import { canonicalHash } from "../engine/hash.js";
import { decodeBoard, encodeBoard } from "./codec.js";
import { summarizeMatch } from "../analysis/contributions.js";
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7;
export function validateBoard(board,config) {
  decodeBoard(encodeBoard(board));
  if (board.owner.some(x=>x>=config.teamCount) || board.core.some(x=>x>=config.teamCount) ||
      board.playableCellCount!==board.blocked.reduce((n,x)=>n+(x===0),0) ||
      !Array.isArray(board.spawns)||board.spawns.length!==config.teamCount ||
      board.spawns.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isInteger(n)||n<0||n>=64))) throw Error("INVALID_BOARD");
  for(let i=0;i<4096;i++) if(board.blocked[i]&&(board.owner[i]>=0||board.core[i]>=0||board.resources[i])) throw Error("INVALID_BOARD");
}
export function equalBoard(a,b) {
  return canonicalHash(a)===canonicalHash(b);
}
export function reconstructLedger({config,initialBoard,tickRecords,boardCheckpoints=[]}) {
  validateBoard(initialBoard,config);
  if(!Array.isArray(tickRecords)||tickRecords.length>100000||!Array.isArray(boardCheckpoints)) throw Error("INVALID_LEDGER");
  const board=structuredClone(initialBoard),scores=config.entrants.map(()=>0),checks=new Map();
  let cpTick=-1;
  for(const cp of boardCheckpoints) {
    if(!Number.isSafeInteger(cp.tick)||cp.tick<=cpTick||cp.tick<1||cp.tick>tickRecords.length ||
      !Array.isArray(cp.scores)||cp.scores.length!==config.teamCount||cp.scores.some(x=>!Number.isFinite(x))) throw Error("INVALID_BOARD_CHECKPOINT");
    validateBoard(cp.board,config);
    checks.set(cp.tick,cp); cpTick=cp.tick;
  }
  let previous=0;
  for(const [i,r] of tickRecords.entries()){
    if(r.seq!==i||r.tick!==i+1||!Number.isFinite(r.timeMs)||r.timeMs<=previous||
      r.timeMs>config.durationMs+1e-7||!close(r.timeMs-previous,r.elapsedMs) ||
      (config.mode!=="classic"&&(r.timeMs!==(i+1)*20||r.elapsedMs!==20)) ||
      [r.resourceChanges,r.ownershipChanges,r.proposals,r.results,r.events,r.scoreDeltas].some(x=>!Array.isArray(x))) throw Error("INVALID_LEDGER_TIME");
    const seen=new Set();
    for(const d of r.scoreDeltas){
      const seat=config.entrants.findIndex(e=>e.participantId===d.participantId);
      if(seat<0||seen.has(seat)||!Number.isFinite(d.areaVP)||!Number.isFinite(d.resourceVP)||
        d.areaVP< -1e-9||d.resourceVP< -1e-9||d.areaVP+d.resourceVP>10*r.elapsedMs/1000+1e-7) throw Error("INVALID_SCORE_LEDGER");
      seen.add(seat); scores[seat]+=d.areaVP+d.resourceVP;
    }
    if(seen.size!==config.teamCount)throw Error("INVALID_SCORE_LEDGER");
    for(const x of r.resourceChanges){
      if(!Number.isInteger(x.index)||x.index<0||x.index>=4096||![0,1,3].includes(x.value)||
        x.previousValue!==board.resources[x.index]||board.blocked[x.index])throw Error("INVALID_LEDGER_CHANGE");
      board.resources[x.index]=x.value;
    }
    for(const x of r.ownershipChanges){
      if(!Number.isInteger(x.index)||x.index<0||x.index>=4096||!Number.isInteger(x.owner)||x.owner<0||x.owner>=config.teamCount||
        x.previousOwner!==board.owner[x.index]||board.blocked[x.index]||
        (board.core[x.index]>=0&&board.core[x.index]!==x.owner))throw Error("INVALID_LEDGER_CHANGE");
      board.owner[x.index]=x.owner;
    }
    for(const p of r.proposals)if(!config.entrants.some((e,seat)=>e.participantId===p.participantId&&seat===p.seat))throw Error("INVALID_LEDGER_IDENTITY");
    for(const x of r.results)if(config.mode==="classic"
      ? !Number.isInteger(x.teamId)||x.teamId<0||x.teamId>=config.teamCount
      : !config.entrants.some((e,seat)=>e.participantId===x.participantId&&seat===x.seat))throw Error("INVALID_LEDGER_IDENTITY");
    previous=r.timeMs;
    const cp=checks.get(r.tick);
    if(cp&&(!close(cp.timeMs,r.timeMs)||!equalBoard(cp.board,board)||cp.scores.some((x,seat)=>!close(x,scores[seat]))))throw Error("REPLAY_CHECKPOINT_MISMATCH");
  }
  return {board,scores,tick:tickRecords.length,timeMs:previous,finished:previous>=config.durationMs-1e-7};
}
export function validateReplayData(pkg,config) {
  const state=reconstructLedger({...pkg,config});
  const summary=summarizeMatch({...pkg,config});
  if(canonicalHash(pkg.summary)!==canonicalHash(summary))throw Error("REPLAY_SUMMARY_MISMATCH");
  return {...state,summary};
}
export function validateResultReplay(result,pkg,state) {
  if(result.finished!==true||!state.finished||!close(result.timeMs,state.timeMs)||
    !Array.isArray(result.teams)||result.teams.length!==pkg.config.teamCount)throw Error("RESULT_REPLAY_MISMATCH");
  const seen=new Set();
  for(const t of result.teams){
    const seat=pkg.config.entrants.findIndex(e=>e.participantId===t.participantId&&e.strategyId===t.strategyId&&e.strategyVersion===t.strategyVersion);
    if(seat<0||seen.has(seat)||!close(t.score,state.scores[seat]))throw Error("RESULT_REPLAY_MISMATCH");
    seen.add(seat);
    let territory=0,resources=0;
    state.board.owner.forEach((owner,i)=>{if(owner===seat){territory++;resources+=state.board.resources[i];}});
    if(t.territory!==territory||t.resources!==resources||t.captures!==state.summary.teams[seat].captures)throw Error("RESULT_REPLAY_MISMATCH");
  }
}
