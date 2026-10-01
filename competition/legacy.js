import { Tournament as LegacyTournament } from "../legacy/v1/tournament.js";
import { createRng, deriveSeed } from "../legacy/v1/rules.js";
import { createMatchConfig } from "../engine/config.js";
import { canonicalHash } from "../engine/hash.js";
import { fixtureReasons, validateFixtureReasons, withoutFixtureReasons } from "./reasons.js";
function restoreLegacy(raw) {
  if(raw?.version!==1||!Array.isArray(raw.rounds)||!raw.rounds.length)throw Error("INVALID_LEGACY_TOURNAMENT");
  const t=new LegacyTournament(raw.config);
  if(canonicalHash(t.config)!==canonicalHash(raw.config))throw Error("INVALID_LEGACY_TOURNAMENT");
  for(let ri=0;ri<raw.rounds.length;ri++){
    const saved=raw.rounds[ri],r=t.rounds[ri];
    if(!r||saved.label!==r.label||saved.phase!==r.phase||typeof saved.completed!=="boolean"||
      !Array.isArray(saved.fixtures)||saved.fixtures.length!==r.fixtures.length)throw Error("INVALID_LEGACY_TOURNAMENT");
    for(let fi=0;fi<saved.fixtures.length;fi++){
      const f=saved.fixtures[fi],expected=r.fixtures[fi],{result,...shape}=f;
      if(canonicalHash(shape)!==canonicalHash(Object.fromEntries(Object.entries(expected).filter(([k])=>k!=="result"))))throw Error("INVALID_LEGACY_TOURNAMENT");
      if(result){
        if(t.nextRound!==r||!Array.isArray(result.legs)||result.legs.length!==2||
          (result.winner!==null&&!f.entrants.includes(result.winner))||
          f.entrants.some(id=>!Number.isFinite(result.aggregates?.[id]?.vp)))throw Error("INVALID_LEGACY_RESULT");
        expected.result=structuredClone(result);
      }
    }
    const complete=r.fixtures.every(f=>f.result);
    if(saved.completed!==complete)throw Error("INVALID_LEGACY_TOURNAMENT");
    if(complete){r.completed=true;t.scheduleFollowingRound(r);}
  }
  if(canonicalHash(t.toJSON())!==canonicalHash(raw))throw Error("INVALID_LEGACY_TOURNAMENT");
  return t;
}
export class ClassicTournamentAdapter {
  constructor(raw) {
    this.raw=restoreLegacy(raw);
    this.config={
      ...this.raw.config,durationMs:this.raw.config.duration*1000,
      mapCount:1,mode:"classic",mapPreset:"legacy",
      entrants:this.raw.entrants.map(e=>({participantId:e.id,strategyId:e.strategy,strategyVersion:"1.0.0",parameters:{}})),
    };
  }
  get rounds(){return this.raw.rounds;}
  get status(){return this.raw.complete?"completed":"running";}
  get groups(){return this.raw.groups;}
  fixtureJobs(f){
    return [0,1].map(leg=>({
      jobId:this.config.id+"/"+f.id+"/legacy-leg"+leg,fixtureId:f.id,map:0,leg,
      kind:"fixture-leg",status:"pending",
      config:createMatchConfig({seed:f.seed,mode:"classic",teamCount:2,rotation:0,
        durationMs:this.config.durationMs,
        entrants:(leg?[...f.entrants].reverse():f.entrants).map(id=>this.config.entrants.find(e=>e.participantId===id)),
      }),
    }));
  }
  nextJobs(){return this.raw.nextRound?.fixtures.filter(f=>!f.result).flatMap(f=>this.fixtureJobs(f))??[];}
  aggregate(f,results){
    const aggregates=Object.fromEntries(f.entrants.map(id=>[id,{vp:0,captures:0,territory:0}]));
    const legs=results.map(r=>{
      const seats=r.teams.map(t=>t.participantId);
      for(const t of r.teams){const a=aggregates[t.participantId];a.vp+=t.score;a.captures+=t.captures;a.territory+=t.territory;}
      return {seats,vp:r.teams.map(t=>t.score),captures:r.teams.map(t=>t.captures),territory:r.teams.map(t=>t.territory)};
    });
    const [a,b]=f.entrants,x=aggregates[a],y=aggregates[b];
    let winner=x.vp>y.vp+1e-9?a:y.vp>x.vp+1e-9?b:null;
    if(winner===null&&["quarterfinal","semifinal","final","bronze"].includes(f.stage))
      winner=x.captures!==y.captures?(x.captures>y.captures?a:b):
        x.territory!==y.territory?(x.territory>y.territory?a:b):
        createRng(deriveSeed(f.seed,"tiebreak")).next()<.5?a:b;
    return {winner,aggregates,legs};
  }
  applyFixtureResult(id,result){
    const r=this.raw.rounds.find(r=>r.fixtures.some(f=>f.id===id)),f=r?.fixtures.find(f=>f.id===id);
    if(!f)throw Error("UNKNOWN_FIXTURE");
    if(f.result){if(canonicalHash(f.result)!==canonicalHash(result))throw Error("CONFLICTING_FIXTURE_RESULT");return false;}
    f.result=structuredClone(result);
    if(r.fixtures.every(f=>f.result)){r.completed=true;this.raw.scheduleFollowingRound(r);}
    return true;
  }
  standings(g){return this.raw.standings(g);}
  champion(){return this.raw.champion();}
  toJSON(){return {schemaVersion:3,legacy:true,rawLegacy:this.raw.toJSON(),fixtureReasons:fixtureReasons(this.rounds)};}
  static fromJSON(state){
    if(state?.schemaVersion!==3||state.legacy!==true)throw Error("INVALID_LEGACY_TOURNAMENT");
    const t=new ClassicTournamentAdapter(state.rawLegacy);
    validateFixtureReasons(state,t.rounds);
    if(canonicalHash(withoutFixtureReasons(t.toJSON()))!==canonicalHash(withoutFixtureReasons(state)))throw Error("INVALID_LEGACY_TOURNAMENT");
    return t;
  }
}
