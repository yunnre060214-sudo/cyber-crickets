export class FixedClock{
 constructor({durationMs,tickMs=20}){if(!Number.isSafeInteger(durationMs)||!Number.isSafeInteger(tickMs)||durationMs<=0||tickMs<=0||durationMs%tickMs)throw Error('INVALID_CLOCK');this.durationMs=durationMs;this.tickMs=tickMs;this.tick=0;this.timeMs=0;}
 advance(count){if(!Number.isSafeInteger(count)||count<0)throw Error('INVALID_TICK_COUNT');const out=[];for(let i=0;i<count&&this.timeMs<this.durationMs;i++){this.tick++;this.timeMs=this.tick*this.tickMs;out.push({tick:this.tick,timeMs:this.timeMs,ended:this.timeMs===this.durationMs});}return out;}
}
