import {Tournament} from './tournament.js?v=20260927-strongest-v2';

self.onmessage = event => {
  try {
    const tournament = Tournament.fromJSON(event.data);
    tournament.advance();
    self.postMessage({ok: true, tournament: tournament.toJSON()});
  } catch (error) {
    self.postMessage({ok: false, error: error.message || '赛程计算失败'});
  }
};
