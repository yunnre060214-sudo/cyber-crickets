import test from 'node:test';
import assert from 'node:assert/strict';
import {Tournament} from '../tournament.js';
import {renderCreateForm, renderTournamentDetail, loadTournamentRecords, initTournamentUI, advanceInWorker} from '../tournament-ui.js';

const entrants = ['aco', 'minimax', 'qlearn', 'voronoi', 'bfs', 'dfs', 'greedy', 'random'];
const make = () => new Tournament({id: 't1', name: '<img src=x onerror=alert(1)>',
  format: 'knockout', seed: 'safe', duration: 1, entrants});

test('creation form offers all six formats and eight entrant slots', () => {
  const html = renderCreateForm();
  for (const format of ['单循环', '双循环', '淘汰赛', '小组赛', '瑞士轮', '小组＋淘汰'])
    assert.ok(html.includes(format));
  assert.equal((html.match(/data-entry=/g) || []).length, 8);
});

test('report shows actual rounds, two-leg scores and champion while escaping tournament names', () => {
  const tournament = make();
  while (!tournament.complete) tournament.advance();
  const schedule = renderTournamentDetail(tournament, 'schedule');
  const report = renderTournamentDetail(tournament, 'report');
  assert.ok(schedule.includes('八强赛'));
  assert.ok(schedule.includes('半决赛'));
  assert.ok(schedule.includes('决赛与季军赛'));
  assert.ok(report.includes('冠军'));
  assert.ok(report.includes('第 1 局'));
  assert.ok(report.includes('第 2 局'));
  assert.ok(report.includes('&lt;img'));
  assert.ok(!report.includes('<img src=x'));
});

test('damaged saved records are ignored and valid records can be recovered', () => {
  const tournament = make();
  const storage = {getItem() {return JSON.stringify([{broken: true}, tournament.toJSON()]);}};
  const records = loadTournamentRecords(storage);
  assert.equal(records.length, 1);
  assert.equal(records[0].config.id, 't1');
});

test('sidebar creates a competition, advances one round and restores it after reopening', async () => {
  const previousDocument = globalThis.document;
  const previousStorage = globalThis.localStorage;
  const previousFormData = globalThis.FormData;
  const saved = new Map();
  globalThis.localStorage = {
    getItem: key => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value)
  };
  globalThis.FormData = class {
    constructor(form) {this.values = form.values;}
    get(key) {return this.values[key];}
  };
  const makeDOM = () => {
    const content = {
      innerHTML: '', events: {},
      addEventListener(type, handler) {this.events[type] = handler;},
      querySelector() {return {value: ''};}
    };
    const nodes = {
      '#tournamentOpen': {focus() {}},
      '#tournamentDrawer': {classList: {add() {}, remove() {}}, setAttribute() {}},
      '#tournamentBackdrop': {hidden: true},
      '#tournamentClose': {focus() {}},
      '#tournamentContent': content,
      '#tournamentStatus': {textContent: ''}
    };
    globalThis.document = {
      querySelector: selector => nodes[selector] || null,
      addEventListener() {}
    };
    initTournamentUI();
    const click = (action, data = {}) => content.events.click({target: {
      dataset: {action, ...data}, disabled: false, textContent: '',
      closest() {return this;}
    }});
    return {nodes, content, click};
  };
  try {
    const first = makeDOM();
    first.nodes['#tournamentOpen'].onclick();
    assert.ok(first.content.innerHTML.includes('生成赛程'));
    const form = {
      id: 'tournamentForm',
      values: {name: '测试联赛', format: 'knockout', duration: '1', seed: 'side'},
      querySelectorAll: () => entrants.map(value => ({value})),
      querySelector: () => ({textContent: ''})
    };
    first.content.events.submit({target: form, preventDefault() {}});
    assert.ok(first.content.innerHTML.includes('八强赛'));
    first.click('advance');
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.ok(first.content.innerHTML.includes('半决赛'));
    const second = makeDOM();
    second.nodes['#tournamentOpen'].onclick();
    assert.ok(second.content.innerHTML.includes('测试联赛'));
    const storedId = loadTournamentRecords(globalThis.localStorage)[0].config.id;
    second.click('open', {id: storedId});
    second.click('tab', {tab: 'report'});
    assert.ok(second.content.innerHTML.includes('逐轮赛果'));
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousStorage;
    globalThis.FormData = previousFormData;
  }
});

test('a round advances through a module worker and returns a resumable tournament', async () => {
  class FakeWorker {
    constructor(_url, options) {assert.equal(options.type, 'module');}
    postMessage(data) {
      const competition = Tournament.fromJSON(data);
      competition.advance();
      queueMicrotask(() => this.onmessage({data: {ok: true, tournament: competition.toJSON()}}));
    }
    terminate() {this.terminated = true;}
  }
  const before = make();
  const after = await advanceInWorker(before, FakeWorker);
  assert.equal(before.rounds[0].completed, false);
  assert.equal(after.rounds[0].completed, true);
  assert.equal(after.rounds[1].label, '半决赛');
});
