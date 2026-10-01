import { decode, encode, verify, seal, canonicalHash } from "../engine/hash.js";
import { createMatchConfig } from "../engine/config.js";
import { validateCheckpoint } from "../replay/checkpoint.js";
import { validateReplayData, reconstructLedger, validateResultReplay } from "../replay/validation.js";
import { planExperiment } from "../analysis/experiment.js";
import { Tournament } from "../competition/tournament.js";
import { ClassicTournamentAdapter } from "../competition/legacy.js";
import { aggregateFixture, fixtureJobs } from "../competition/fixture.js";
export const INPUT_LIMITS = {compressed:32*1024*1024,expanded:128*1024*1024};
function finiteTree(value,depth=0) {
  if(depth>100)throw Error("DATA_TOO_DEEP");
  if(typeof value==="number"&&!Number.isFinite(value))throw Error("NON_FINITE_DATA");
  if(value&&typeof value==="object")for(const [k,v]of Object.entries(value)){
    if(["__proto__","prototype","constructor"].includes(k))throw Error("UNSAFE_KEY");
    finiteTree(v,depth+1);
  }
}
export function validateReplayPackage(pkg) {
  if(pkg.format!=="cyber-crickets.replay"||pkg.formatVersion!==3)throw Error("UNSUPPORTED_FORMAT");
  if(pkg.config?.schemaVersion!==3||pkg.config?.engineVersion!=="2.0.0")throw Error("UNSUPPORTED_SCHEMA");
  const c=createMatchConfig(pkg.config);
  if(canonicalHash(c)!==canonicalHash(pkg.config))throw Error("INVALID_MATCH_CONFIG");
  verify(pkg);
  validateReplayData(pkg,c);
  if(pkg.checkpoint)validateCheckpoint(pkg.checkpoint,{replay:pkg});
  return pkg;
}
function legacyFixtureResult(t,f) {
  const r=f.result;
  if(!Array.isArray(r.legs)||r.legs.length!==2)throw Error("INVALID_LEGACY_RESULT");
  const results=r.legs.map((leg,index)=>{
    const seats=index?[...f.entrants].reverse():f.entrants;
    if(canonicalHash(leg.seats)!==canonicalHash(seats)||["vp","captures","territory"].some(k=>!Array.isArray(leg[k])||leg[k].length!==2||
      leg[k].some(n=>!Number.isFinite(n)||n<0)))throw Error("INVALID_LEGACY_RESULT");
    return {teams:seats.map((id,i)=>({participantId:id,score:leg.vp[i],captures:leg.captures[i],territory:leg.territory[i]}))};
  });
  if(canonicalHash(t.aggregate(f,results))!==canonicalHash(r))throw Error("INVALID_LEGACY_RESULT");
}
function validateCompetitionResults(t,items,classic) {
  const byId=new Map(items.map(x=>[x.jobId,x.result]));
  for(const round of t.rounds)for(const f of round.fixtures){
    const jobs=classic?t.fixtureJobs(f):fixtureJobs(f,t.config),present=jobs.filter(j=>byId.has(j.jobId));
    if(!classic&&f.extraMap){
      const base={...f,extraMap:false},baseJobs=fixtureJobs(base,t.config);
      if(!baseJobs.every(j=>byId.has(j.jobId))||!aggregateFixture(base,baseJobs.map(j=>byId.get(j.jobId))).needsExtraMap)throw Error("INVALID_EXTRA_MAP");
    }
    if(!f.result)continue;
    if(classic&&present.length===0){legacyFixtureResult(t,f);continue;}
    if(present.length!==jobs.length)throw Error("FIXTURE_LEGS_MISSING");
    const expected=classic?t.aggregate(f,jobs.map(j=>byId.get(j.jobId))):aggregateFixture(f,jobs.map(j=>byId.get(j.jobId)));
    if(canonicalHash(expected)!==canonicalHash(f.result))throw Error("FIXTURE_RESULT_MISMATCH");
  }
}
async function readBounded(stream, limit) {
  const reader = stream.getReader(),
    decoder = new TextDecoder(),
    parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw Error("IMPORT_SIZE_LIMIT");
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}
export async function importPackage(file,{store}={}) {
  const magic=new Uint8Array(await file.slice(0,2).arrayBuffer()),gzip=magic[0]===31&&magic[1]===139;
  if(file.size>(gzip?INPUT_LIMITS.compressed:INPUT_LIMITS.expanded))throw Error("IMPORT_SIZE_LIMIT");
  let stream=file.stream();
  if(gzip){
    if(typeof DecompressionStream!=="function")throw Error("GZIP_UNAVAILABLE");
    stream=stream.pipeThrough(new DecompressionStream("gzip"));
  }
  const raw=JSON.parse(await readBounded(stream,INPUT_LIMITS.expanded));finiteTree(raw);
  let pkg,normalizedState,resume=false,archive=false,type="match";
  if(raw.format==="cyber-crickets.match-log"&&raw.formatVersion===2) {
    const b=raw.snapshot?.map;
    if(!b||["owner","terrain","resources","core"].some(k=>!Array.isArray(b[k])||b[k].length!==4096)||
      !Array.isArray(raw.teams)||![2,4].includes(raw.teams.length))throw Error("INVALID_LEGACY_LOG");
    pkg=seal({format:"cyber-crickets.archive",formatVersion:3,original:raw,resume:false});archive=true;
  }else if(raw.format==="cyber-crickets.replay"){
    if(raw.formatVersion!==3)throw Error("UNSUPPORTED_FORMAT");
    verify(raw);pkg=validateReplayPackage(decode(raw));
    resume=!!pkg.checkpoint&&!pkg.summary.finished;
  }else if(["cyber-crickets.competition","cyber-crickets.experiment"].includes(raw.format)&&raw.formatVersion===3){
    verify(raw);pkg=decode(raw);verify(pkg);type=raw.format.split(".").at(-1);
    if(!pkg.config||!pkg.state||!Array.isArray(pkg.results)||!Array.isArray(pkg.checkpoints))throw Error("INVALID_JOB_PACKAGE");
    let tasks,t,classic=false;
    if(type==="experiment"){
      const plan=planExperiment(pkg.config);
      if(canonicalHash(plan)!==canonicalHash(pkg.state))throw Error("INVALID_EXPERIMENT_PLAN");
      tasks=plan.orderedTasks;
    }else{
      classic=pkg.state.legacy===true;
      t=classic?ClassicTournamentAdapter.fromJSON(pkg.state):Tournament.fromJSON(pkg.state);
      tasks=t.rounds.flatMap(r=>r.fixtures.flatMap(f=>classic?t.fixtureJobs(f):fixtureJobs(f,t.config)));
    }
    const expectedConfig=type==="experiment"?pkg.state.config:t.config;
    if(canonicalHash(expectedConfig)!==canonicalHash(pkg.config))throw Error("JOB_CONFIG_MISMATCH");
    const expected=new Map(tasks.map(j=>[j.jobId,j])),seen=new Set();
    for(const r of pkg.results){
      const job=expected.get(r.jobId);
      if(!job||seen.has(r.jobId)||!r.result?.finished||canonicalHash(r.result.config)!==canonicalHash(job.config)||!r.replay)throw Error("INVALID_JOB_RESULT");
      seen.add(r.jobId);validateReplayPackage(r.replay);
      if(canonicalHash(r.replay.config)!==canonicalHash(job.config))throw Error("JOB_CONFIG_MISMATCH");
      const view={...reconstructLedger(r.replay),summary:r.replay.summary};
      validateResultReplay(r.result,r.replay,view);
    }
    const checkpointIds=new Set();
    for(const saved of pkg.checkpoints){
      const job=expected.get(saved.jobId);
      if(!job||seen.has(saved.jobId)||checkpointIds.has(saved.jobId))throw Error("INVALID_JOB_CHECKPOINT");
      checkpointIds.add(saved.jobId);validateCheckpoint(saved.checkpoint);
      if(canonicalHash(saved.checkpoint.config)!==canonicalHash(job.config))throw Error("JOB_CONFIG_MISMATCH");
    }
    if(type==="competition"){
      validateCompetitionResults(t,pkg.results,classic);
      normalizedState=t.toJSON();
    }
    resume=type==="experiment"?seen.size<tasks.length:t.status!=="completed";
  }else throw Error("UNSUPPORTED_FORMAT");
  const id="import:"+canonicalHash(pkg);
  // Keep an older file's duplicate identity, then seal the normalized snapshot.
  if(normalizedState)pkg=seal({...verify(pkg),state:normalizedState});
  if(store){
    const write=type==="match"?store.putPackage:store.putJobPackage;
    await write.call(store,{id,type,schemaVersion:3,index:{
      name:pkg.config?.name??pkg.config?.seed??raw.metadata?.seed??file.name,
      archive,finished:pkg.summary?.finished??!resume,
    },payloadRefs:[]},pkg);
  }
  return {id,package:pkg,resume,archive,type};
}
