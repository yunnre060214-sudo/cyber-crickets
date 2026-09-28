import {AGENT_META} from './agents.js?v=20260928-strongest-v6';
import {Match} from './match.js?v=20260928-strongest-v6';
import {initTournamentUI} from './tournament-ui.js?v=20260928-strongest-v6';
import {createSettingsController} from './ui/settings.js?v=20260928-strongest-v6';
import {renderScoreboard} from './ui/scoreboard.js?v=20260928-strongest-v6';
import {drawArena} from './ui/map-renderer.js?v=20260928-strongest-v6';
import {renderMatchResult} from './ui/report.js?v=20260928-strongest-v6';
import {createExportController} from './ui/export.js?v=20260928-export-v2';

const $ = selector => document.querySelector(selector);
const canvas = $('#arena'), ctx = canvas.getContext('2d');
const el = {
  timer: $('#timer'), state: $('#statePill'), start: $('#startBtn'),
  pause: $('#pauseBtn'), reset: $('#resetBtn'), duration: $('#duration'),
  durationCustom: $('#durationCustom'), durationCustomGroup: $('#durationCustomGroup'),
  speed: $('#speed'), speedCustom: $('#speedCustom'), speedCustomGroup: $('#speedCustomGroup'),
  cfg: $('#teamConfig'), score: $('#scoreboard'),
  feed: $('#feed'), banner: $('#eventBanner'), dialog: $('#resultDialog'),
  title: $('#winnerTitle'), summary: $('#winnerSummary'), results: $('#resultList'),
  insights: $('#resultInsights'), charts: $('#resultCharts'),
  again: $('#againBtn'), close: $('#closeResultBtn'), overlay: $('#overlayToggle'),
  seed: $('#seedInput'), rotation: $('#rotation'), newSeed: $('#newSeedBtn'),
  liveChart: $('#liveChart'), liveGrid: $('#liveChartGrid'), liveLines: $('#liveChartLines'),
  liveLegend: $('#liveChartLegend'), durationSummary: $('#durationSummary'), speedSummary: $('#speedSummary'),
  exportLog: $('#exportLogBtn'), resultExport: $('#resultExportBtn'),
  setupMenu: $('#setupMenu'), setupClose: $('#setupCloseBtn')
};
const lineup = ['aco', 'minimax', 'qlearn', 'voronoi'];
const makeSeed = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
let match, running = false, accumulator = 0, lastFrame = performance.now(), bannerTimer;

const settings = createSettingsController({el, lineup, makeSeed, onLineupChange: reset});
settings.applyInitialQuery();

const formatTime = seconds => {
  const whole = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(whole / 60)).padStart(2, '0') + ':' + String(whole % 60).padStart(2, '0');
};

function reset() {
  running = false; accumulator = 0; lastFrame = performance.now();
  el.seed.value = el.seed.value.trim().slice(0, 64) || makeSeed();
  const duration = settings.selectedDuration(), speed = settings.selectedSpeed();
  if (el.duration.value === 'custom') el.durationCustom.value = String(duration);
  if (el.speed.value === 'custom') el.speedCustom.value = String(speed);
  settings.syncCustomSettingVisibility();
  settings.syncUrl();
  match = new Match({seed: el.seed.value, rotation: +el.rotation.value, duration, strategies: [...lineup]});
  el.feed.innerHTML = '';
  log('种子 ' + match.seed + '，出生轮换 ' + (+el.rotation.value + 1) + '/4。');
  el.state.textContent = '待机';
  el.durationSummary.textContent = duration + 's';
  el.speedSummary.textContent = speed + '×';
  el.start.textContent = '开始比赛'; el.start.disabled = false;
  el.pause.textContent = '暂停'; el.pause.disabled = true;
  renderUI(); draw();
}
function start() {
  if (match.finished) reset();
  running = true; lastFrame = performance.now();
  el.start.textContent = '进行中'; el.start.disabled = true;
  el.pause.disabled = false; el.state.textContent = '交战中';
  log('回合开始：四方从相同地图快照决策。');
}
function pause() {
  running = !running;
  if (running) {
    lastFrame = performance.now(); el.pause.textContent = '暂停';
    el.start.disabled = true; el.state.textContent = '交战中'; log('模拟继续。');
  } else {
    el.pause.textContent = '继续'; el.start.disabled = false;
    el.start.textContent = '继续比赛'; el.state.textContent = '已暂停'; log('模拟暂停。');
  }
}
function loop(timestamp) {
  const dt = Math.min(.1, (timestamp - lastFrame) / 1000 || 0);
  lastFrame = timestamp;
  if (running) {
    accumulator += dt * settings.selectedSpeed();
    while (accumulator >= .035 && running) {
      for (const event of match.step(.035)) { banner(event.banner); log(event.log); }
      accumulator -= .035;
      if (match.finished) finish();
    }
    renderUI();
  }
  draw();
  requestAnimationFrame(loop);
}
function banner(message) {
  el.banner.textContent = message; el.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 2200);
}
function renderUI() { renderScoreboard({match, el, formatTime}); }
function draw() { drawArena({match, canvas, ctx, overlayEnabled: el.overlay.checked}); }
function log(message) {
  const entry = document.createElement('div'); entry.className = 'feed-item';
  const time = document.createElement('span'); time.className = 'feed-time';
  time.textContent = formatTime(match.time);
  entry.appendChild(time); entry.appendChild(document.createTextNode(message)); el.feed.prepend(entry);
  while (el.feed.children.length > 30) el.feed.lastChild.remove();
}
function finish() {
  running = false; renderUI(); el.state.textContent = '已结算';
  el.pause.disabled = true; el.start.disabled = false; el.start.textContent = '新一局';
  const {winner} = renderMatchResult({match, el});
  log(AGENT_META[winner.strategy].name + ' 以 ' + winner.score.toFixed(1) + ' VP 拿下本局。');
  el.dialog.showModal();
}
function exportCurrentLog() {
  exporter.open();
}

const exporter = createExportController({dialog: $('#exportDialog'),
  getContext: () => ({match, running, speedValue: settings.selectedSpeed()}), log});

el.start.onclick = start;
el.pause.onclick = pause;
el.reset.onclick = reset;
el.duration.onchange = () => {
  settings.syncCustomSettingVisibility();
  if (!running) reset(); else settings.syncUrl();
};
el.durationCustom.onchange = () => {
  el.durationCustom.value = String(settings.selectedDuration());
  if (!running) reset(); else settings.syncUrl();
};
el.seed.onchange = reset;
el.rotation.onchange = reset;
el.speed.onchange = () => {
  settings.syncCustomSettingVisibility();
  el.speedSummary.textContent = settings.selectedSpeed() + '×';
  settings.syncUrl();
};
el.speedCustom.onchange = () => {
  el.speedCustom.value = String(settings.selectedSpeed());
  el.speedSummary.textContent = settings.selectedSpeed() + '×';
  settings.syncUrl();
};
el.newSeed.onclick = () => { el.seed.value = makeSeed(); reset(); };
el.exportLog.onclick = exportCurrentLog;
el.resultExport.onclick = exportCurrentLog;
if (el.setupClose) el.setupClose.onclick = () => { el.setupMenu.open = false; };
if (el.setupMenu?.addEventListener) el.setupMenu.addEventListener('toggle', () => {
  if (el.setupMenu.open) {
    const drawer = el.setupMenu.querySelector('.setup-popover');
    if (drawer) drawer.scrollTop = 0;
  }
});
el.again.onclick = () => { el.dialog.close(); reset(); start(); };
el.close.onclick = () => el.dialog.close();

settings.renderTeamConfig();
reset();
initTournamentUI();
requestAnimationFrame(loop);
