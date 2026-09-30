/**
 * @typedef {{schemaVersion:3, productVersion:string, engineVersion:string, ruleVersion:string,
 * seed:string, mode:'standard'|'migration'|'classic', mapPreset:string,teamCount:2|4,
 * rotation:number,durationMs:number,tickMs:number,decisionIntervalMs:number,budgetProfile:string,
 * entrants:{participantId:string,strategyId:string,strategyVersion:string,parameters:Object}[]}} MatchConfig
 * @typedef {{width:number,height:number,owner:Int8Array,terrain:Uint8Array,resources:Uint8Array,
 * core:Int8Array,blocked:Uint8Array,playableCellCount:number,spawns:number[][]}} Board
 * @typedef {{from:number,to:number,explain:Object}} Action
 * @typedef {{seq:number,tick:number,timeMs:number,elapsedMs:number,resourceChanges:Object[],
 * ownershipChanges:Object[],proposals:Object[],results:Object[],scoreDeltas:Object[],events:Object[]}} TickRecord
 * @typedef {{schemaVersion:3,config:MatchConfig,tick:number,timeMs:number,board:Board,
 * scores:number[],rngStates:Object[],agentStates:Object[],eventState:string[],ledgerCursor:number,integrityHash:string}} Checkpoint
 * @typedef {{protocolVersion:1,requestId:string,matchId?:string,jobId?:string,type:string,payload:Object}} WorkerMessage
 * @typedef {{format:'cyber-crickets.replay',formatVersion:3,config:MatchConfig,initialBoard:Board,
 * tickRecords:TickRecord[],boardCheckpoints:Object[],summary:Object,integrityHash:string}} ReplayPackage
 * @typedef {{id:string,type:'match'|'competition'|'experiment',schemaVersion:3,revision:number,updatedAt:number,index:Object,payloadRefs:Object}} StoredRecord
 * @typedef {{jobId:string,kind:string,config:MatchConfig,status:string,result?:Object}} Job
 */
export {};
