import {AGENT_META} from './agents.js?v=20260928-strongest-v5';
import {FORMAT_NAMES, Tournament} from './tournament.js?v=20260928-strongest-v5';

const STORAGE_KEY = 'cyber-crickets-tournaments-v1';
const escapeHTML = value => String(value).replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const agentName = (tournament, id) =>
  AGENT_META[tournament.config.entrants[Number(id.slice(1))]]?.name || id;
const formatVP = value => Number(value).toFixed(1);

export function loadTournamentRecords(storage) {
  try {
    const records = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(records)) return [];
    return records.flatMap(record => {
      try { return [Tournament.fromJSON(record)]; }
      catch { return []; }
    }).slice(0, 20);
  } catch { return []; }
}

export function renderCreateForm() {
  const formats = Object.entries(FORMAT_NAMES).map(([value, label]) =>
    '<option value="' + value + '">' + label + '</option>').join('');
  const agents = Object.entries(AGENT_META);
  const slots = Array.from({length: 8}, (_, index) =>
    '<label class="tour-slot"><span>' + (index + 1) + ' 号种子</span><select data-entry="' + index +
    '" aria-label="' + (index + 1) + ' 号参赛者">' +
    agents.map(([key, meta]) => '<option value="' + key + '"' +
      (agents[index][0] === key ? ' selected' : '') + '>' + escapeHTML(meta.name) + '</option>').join('') +
    '</select></label>').join('');
  return '<div class="tour-lead"><h3>新建比赛</h3><p>选择八种不同 Agent。每个对阵在同一地图交换出生侧，共打两局。</p></div>' +
    '<form id="tournamentForm" class="tour-form">' +
    '<label>比赛名称<input name="name" maxlength="80" value="算法联赛" required></label>' +
    '<div class="tour-form-pair"><label>赛制<select name="format">' + formats + '</select></label>' +
    '<label>单局时长<select name="duration"><option value="60">60 秒</option>' +
    '<option value="90" selected>90 秒</option><option value="120">120 秒</option>' +
    '<option value="180">180 秒</option><option value="custom">自定义…</option></select></label></div>' +
    '<label class="tour-custom-duration" data-tour-custom-duration hidden>自定义单局时长（秒）' +
    '<input name="durationCustom" type="number" min="10" max="1800" step="1" value="180" inputmode="numeric"></label>' +
    '<label>赛事种子<input name="seed" maxlength="64" spellcheck="false" required></label>' +
    '<div class="tour-slot-grid">' + slots + '</div>' +
    '<p id="tournamentError" class="tour-error" role="alert"></p>' +
    '<button class="primary tour-main-action" type="submit">生成赛程</button></form>' +
    '<button type="button" data-action="list" class="tour-link">查看已有比赛</button>';
}

function renderList(records) {
  return '<div class="tour-lead"><h3>我的比赛</h3><p>比赛保存在当前浏览器中，可以随时继续下一轮。</p></div>' +
    '<button type="button" data-action="new" class="primary tour-main-action">新建比赛</button>' +
    '<div class="tour-history">' + (records.length ? records.map(tournament => {
      const completed = tournament.rounds.filter(round => round.completed).length;
      return '<button type="button" class="tour-history-item" data-action="open" data-id="' +
        escapeHTML(tournament.config.id) + '"><b>' + escapeHTML(tournament.config.name) +
        '</b><span>' + escapeHTML(FORMAT_NAMES[tournament.config.format]) + ' · ' +
        completed + '/' + tournament.rounds.length + ' 轮 · ' +
        (tournament.complete ? '已完赛' : '进行中') + '</span></button>';
    }).join('') : '<p class="tour-empty">还没有比赛，先创建一场。</p>') + '</div>';
}

function renderFixture(tournament, fixture) {
  const [a, b] = fixture.entrants;
  const names = escapeHTML(agentName(tournament, a)) + ' vs ' + escapeHTML(agentName(tournament, b));
  if (!fixture.result)
    return '<div class="tour-fixture pending"><span>' + names + '</span><small>待赛 · ' +
      escapeHTML(fixture.group ? fixture.group + ' 组' : fixture.stage) + '</small></div>';
  const result = fixture.result;
  return '<div class="tour-fixture"><div class="tour-fixture-title"><b>' + names +
    '</b><span>' + (result.winner ? escapeHTML(agentName(tournament, result.winner)) + ' 胜' : '平局') +
    '</span></div><div class="tour-fixture-score">' +
    formatVP(result.aggregates[a].vp) + ' : ' + formatVP(result.aggregates[b].vp) +
    ' VP</div><details><summary>查看双局明细</summary>' +
    result.legs.map((leg, index) => '<p>第 ' + (index + 1) + ' 局：' +
      escapeHTML(agentName(tournament, leg.seats[0])) + ' ' + formatVP(leg.vp[0]) +
      ' : ' + formatVP(leg.vp[1]) + ' ' +
      escapeHTML(agentName(tournament, leg.seats[1])) + ' VP</p>').join('') +
    '<small>地图种子：' + escapeHTML(fixture.seed) + '</small></details></div>';
}

function renderSchedule(tournament) {
  return tournament.rounds.map(round =>
    '<section class="tour-round"><div class="tour-round-heading"><h4>' +
      escapeHTML(round.label) + '</h4><span>' + (round.completed ? '已完成' : '待进行') +
      '</span></div>' + round.fixtures.map(fixture => renderFixture(tournament, fixture)).join('') +
      '</section>').join('');
}

function renderTable(tournament, group = null) {
  const rows = tournament.standings(group);
  return '<div class="tour-table"><div class="tour-table-head"><span>排名 / Agent</span>' +
    '<span>场次</span><span>积分</span><span>VP 净胜</span></div>' +
    rows.map((row, index) => '<div class="tour-table-row"><span>' + (index + 1) + '. ' +
      escapeHTML(agentName(tournament, row.id)) + '</span><span>' + row.played +
      '</span><strong>' + row.points + '</strong><span>' +
      formatVP(row.vpFor - row.vpAgainst) + '</span></div>').join('') + '</div>';
}

function renderStandings(tournament) {
  if (['groups', 'group_knockout'].includes(tournament.config.format))
    return '<h4>A 组</h4>' + renderTable(tournament, 'A') +
      '<h4>B 组</h4>' + renderTable(tournament, 'B') +
      (tournament.config.format === 'group_knockout' ? '<h4>总成绩</h4>' + renderTable(tournament) : '');
  return renderTable(tournament);
}

function renderReport(tournament) {
  const completed = tournament.rounds.filter(round => round.completed);
  const champion = tournament.champion();
  const podium = champion ? '<div class="tour-champion"><span>冠军</span><strong>' +
    escapeHTML(agentName(tournament, champion)) + '</strong></div>' :
    tournament.complete && tournament.config.format === 'groups'
      ? '<div class="tour-champion"><span>小组第一</span><strong>A 组：' +
        escapeHTML(agentName(tournament, tournament.standings('A')[0].id)) + '　B 组：' +
        escapeHTML(agentName(tournament, tournament.standings('B')[0].id)) + '</strong></div>'
      : '<p class="tour-empty">赛事尚未结束，以下是当前阶段报告。</p>';
  const fixtures = completed.flatMap(round => round.fixtures);
  const closest = [...fixtures].sort((a, b) => {
    const gap = f => Math.abs(f.result.aggregates[f.entrants[0]].vp -
      f.result.aggregates[f.entrants[1]].vp);
    return gap(a) - gap(b);
  })[0];
  return '<div class="tour-report"><p class="tour-report-title">' +
    escapeHTML(tournament.config.name) + ' · ' + escapeHTML(FORMAT_NAMES[tournament.config.format]) +
    '</p>' + podium + '<div class="tour-report-stats"><div><b>' + completed.length +
    '</b><span>已完成轮次</span></div><div><b>' + fixtures.length +
    '</b><span>已完成对阵</span></div><div><b>' + fixtures.length * 2 +
    '</b><span>双局总数</span></div></div>' +
    (closest ? '<p class="tour-note">最胶着对阵：' +
      escapeHTML(agentName(tournament, closest.entrants[0])) + ' vs ' +
      escapeHTML(agentName(tournament, closest.entrants[1])) + '，VP 差 ' +
      formatVP(Math.abs(closest.result.aggregates[closest.entrants[0]].vp -
        closest.result.aggregates[closest.entrants[1]].vp)) + '。</p>' : '') +
    '<h4>排名与积分</h4>' + renderStandings(tournament) +
    '<h4>逐轮赛果</h4>' + renderSchedule(tournament) + '</div>';
}

export function renderTournamentDetail(tournament, tab = 'overview') {
  const completed = tournament.rounds.filter(round => round.completed).length;
  const tabs = [['overview','总览'],['schedule','赛程'],['standings','排名'],['report','报告']];
  const header = '<div class="tour-detail-head"><button type="button" data-action="list" class="tour-link">所有比赛</button>' +
    '<h3>' + escapeHTML(tournament.config.name) + '</h3><p>' +
    escapeHTML(FORMAT_NAMES[tournament.config.format]) + ' · 种子 ' +
    escapeHTML(tournament.config.seed) + ' · ' + completed + '/' +
    tournament.rounds.length + ' 轮</p></div><nav class="tour-tabs" aria-label="比赛子菜单">' +
    tabs.map(([key,label]) => '<button type="button" data-action="tab" data-tab="' + key +
      '" class="' + (tab === key ? 'active' : '') + '">' + label + '</button>').join('') + '</nav>';
  if (tab === 'schedule') return header + renderSchedule(tournament);
  if (tab === 'standings') return header + renderStandings(tournament);
  if (tab === 'report') return header + renderReport(tournament);
  const next = tournament.nextRound;
  return header + '<div class="tour-overview"><div class="tour-progress"><span>已完成 ' +
    completed + ' 轮</span><span>' + (tournament.complete ? '已完赛' : '进行中') +
    '</span></div><div class="tour-progress-bar"><i style="width:' +
    (completed / tournament.rounds.length * 100) + '%"></i></div>' +
    (next ? '<h4>下一轮：' + escapeHTML(next.label) + '</h4><p>' +
      next.fixtures.length + ' 个对阵，每个对阵换边打两局。</p>' +
      '<button type="button" data-action="advance" class="primary tour-main-action">进行下一轮</button>' :
      '<div class="tour-champion"><span>赛事完成</span><strong>' +
      (tournament.champion() ? escapeHTML(agentName(tournament, tournament.champion())) :
        '请查看两个小组的排名') + '</strong></div>') +
    '<h4>本轮对阵</h4>' +
    (next ? next.fixtures.map(fixture => renderFixture(tournament, fixture)).join('') :
      '<p class="tour-empty">所有赛程均已结束。</p>') + '</div>';
}

export function advanceInWorker(tournament, WorkerCtor = globalThis.Worker) {
  return new Promise((resolve, reject) => {
    if (!WorkerCtor) {
      setTimeout(() => {
        try {
          const copy = Tournament.fromJSON(tournament.toJSON());
          copy.advance();
          resolve(copy);
        } catch (error) {reject(error);}
      }, 0);
      return;
    }
    const worker = new WorkerCtor(new URL('./tournament-worker.js?v=20260928-strongest-v5', import.meta.url), {type: 'module'});
    worker.onmessage = event => {
      worker.terminate();
      if (!event.data?.ok) {reject(new Error(event.data?.error || '赛程计算失败')); return;}
      try {resolve(Tournament.fromJSON(event.data.tournament));}
      catch (error) {reject(error);}
    };
    worker.onerror = event => {
      worker.terminate();
      reject(new Error(event.message || '赛程后台计算失败'));
    };
    worker.postMessage(tournament.toJSON());
  });
}

export function initTournamentUI() {
  const openButton = document.querySelector('#tournamentOpen');
  const drawer = document.querySelector('#tournamentDrawer');
  const backdrop = document.querySelector('#tournamentBackdrop');
  const closeButton = document.querySelector('#tournamentClose');
  const content = document.querySelector('#tournamentContent');
  const status = document.querySelector('#tournamentStatus');
  if (!openButton || !drawer || !backdrop || !closeButton || !content) return;

  let storage;
  try {storage = localStorage;} catch {storage = null;}
  let records = loadTournamentRecords(storage);
  let active = null, screen = records.length ? 'list' : 'create', tab = 'overview', busy = false;
  const save = () => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(records.map(item => item.toJSON())));
      if (status) status.textContent = '';
    } catch {
      if (status) status.textContent = '无法保存到浏览器，刷新后可能丢失本场记录。';
    }
  };
  const render = () => {
    content.innerHTML = screen === 'create' ? renderCreateForm() :
      screen === 'detail' && active ? renderTournamentDetail(active, tab) : renderList(records);
    if (screen === 'create') content.querySelector('[name="seed"]').value =
      crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
  };
  openButton.onclick = () => {
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false; render(); closeButton.focus();
  };
  const close = () => {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true; openButton.focus();
  };
  closeButton.onclick = close; backdrop.onclick = close;
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !backdrop.hidden) close();
  });
  content.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || busy) return;
    const action = button.dataset.action;
    if (action === 'new') {screen = 'create'; render();}
    if (action === 'list') {screen = 'list'; render();}
    if (action === 'open') {
      active = records.find(item => item.config.id === button.dataset.id) || null;
      if (active) {screen = 'detail'; tab = 'overview'; render();}
    }
    if (action === 'tab' && active) {tab = button.dataset.tab; render();}
    if (action === 'advance' && active && !active.complete) {
      busy = true; button.disabled = true; button.textContent = '正在计算本轮…';
      const activeId = active.config.id;
      advanceInWorker(active).then(updated => {
        const index = records.findIndex(item => item.config.id === activeId);
        if (index < 0) return;
        records[index] = active = updated;
        save(); render();
      }).catch(error => {
        button.textContent = error.message;
        button.disabled = false;
      }).finally(() => {busy = false;});
    }
  });
  content.addEventListener('change', event => {
    if (event.target?.name !== 'duration') return;
    const custom = content.querySelector('[data-tour-custom-duration]');
    if (custom) custom.hidden = event.target.value !== 'custom';
  });
  content.addEventListener('submit', event => {
    if (event.target.id !== 'tournamentForm') return;
    event.preventDefault();
    const form = event.target, fields = new FormData(form);
    try {
      const durationField = fields.get('duration');
      const duration = durationField === 'custom'
        ? Number(fields.get('durationCustom')) : Number(durationField);
      const tournament = new Tournament({
        id: crypto.getRandomValues(new Uint32Array(2)).join('-'),
        name: fields.get('name').trim(), format: fields.get('format'),
        duration, seed: fields.get('seed').trim(),
        entrants: [...form.querySelectorAll('[data-entry]')].map(select => select.value)
      });
      records.unshift(tournament); records = records.slice(0, 20);
      active = tournament; screen = 'detail'; tab = 'overview';
      save(); render();
    } catch (error) {
      form.querySelector('#tournamentError').textContent = error.message;
    }
  });
}
