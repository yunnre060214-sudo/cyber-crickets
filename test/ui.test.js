import test from 'node:test';
import assert from 'node:assert/strict';

test('the page exposes its shareable seed, rotation and VP scoring', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', value: '', checked: false, disabled: false,
      width: 720, height: 720, children: [],
      classList: {add() {}, remove() {}},
      appendChild() {}, prepend() {}, querySelectorAll() { return []; },
      getContext() { return new Proxy({}, {get: () => () => {}}); },
      showModal() {}, close() {}
    });
    return elements.get(selector);
  };
  element('#duration').value = '90';
  element('#speed').value = '1';
  element('#durationCustom').value = '150';
  element('#speedCustom').value = '1.5';
  element('#overlayToggle').checked = false;
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  const oldHistory = globalThis.history;
  const oldRaf = globalThis.requestAnimationFrame;
  const urls = [];
  element('#feed').prepend = entry => {
    element('#feed').lastEntry = entry;
    element('#feed').children.unshift(entry);
  };
  const tournamentSelectors = new Set([
    '#tournamentOpen', '#tournamentDrawer', '#tournamentBackdrop',
    '#tournamentClose', '#tournamentContent', '#tournamentStatus'
  ]);
  globalThis.document = {
    querySelector: selector => tournamentSelectors.has(selector) || selector === '#exportDialog' ? null : element(selector),
    createElement: () => ({
      innerHTML: '', className: '', textContent: '', parts: [],
      appendChild(child) { this.parts.push(child.textContent); },
      remove() {}
    }),
    createTextNode: text => ({textContent: text})
  };
  globalThis.location = {
    search: '?seed=abc&rotation=1&agents=dfs,greedy,random,pid&duration=60',
    pathname: '/cyber-crickets/'
  };
  globalThis.history = {replaceState: (_state, _title, url) => urls.push(url)};
  globalThis.requestAnimationFrame = () => {};
  try {
    await import('../app.js');
    assert.equal(element('#seedInput').value, 'abc');
    assert.equal(element('#rotation').value, '1');
    assert.equal(element('#duration').value, '60');
    assert.match(element('#scoreboard').innerHTML, /VP/);
    assert.match(element('#liveChartLegend').innerHTML, /红方·DFS 风格穿刺/);
    element('#resetBtn').onclick();
    assert.match(urls.at(-1), /seed=abc&rotation=1/);
    assert.match(urls.at(-1), /agents=dfs%2Cgreedy%2Crandom%2Cpid/);
    assert.match(urls.at(-1), /duration=60/);
    assert.match(urls.at(-1), /speed=1/);
    const malicious = '<img src=x onerror=alert(1)>';
    element('#seedInput').value = malicious;
    element('#resetBtn').onclick();
    assert.doesNotMatch(element('#feed').lastEntry.innerHTML, /<img/);
    assert.ok(element('#feed').lastEntry.parts.some(part => part.includes(malicious)));
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
    globalThis.history = oldHistory;
    globalThis.requestAnimationFrame = oldRaf;
  }
});
