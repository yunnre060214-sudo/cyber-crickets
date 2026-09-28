import {AGENT_META} from '../agents.js?v=20260928-ui-refactor-v1';
import {COLORS, TEAM_NAMES} from './constants.js?v=20260928-ui-refactor-v1';

const DURATION_PRESETS = new Set([60, 90, 120, 180]);
const SPEED_PRESETS = new Set([1, 2, 4]);

const normalizeDuration = value => {
  const number = Number(value);
  return Math.min(1800, Math.max(10, Math.round(Number.isFinite(number) ? number : 90)));
};
const normalizeSpeed = value => {
  const number = Number(value);
  const clamped = Math.min(20, Math.max(.25, Number.isFinite(number) ? number : 1));
  return Math.round(clamped * 4) / 4;
};

export function createSettingsController({el, lineup, makeSeed, onLineupChange}) {
  const selectedDuration = () => el.duration.value === 'custom'
    ? normalizeDuration(el.durationCustom.value) : normalizeDuration(el.duration.value);
  const selectedSpeed = () => el.speed.value === 'custom'
    ? normalizeSpeed(el.speedCustom.value) : normalizeSpeed(el.speed.value);

  function syncCustomSettingVisibility() {
    if (el.durationCustomGroup) el.durationCustomGroup.hidden = el.duration.value !== 'custom';
    if (el.speedCustomGroup) el.speedCustomGroup.hidden = el.speed.value !== 'custom';
  }

  function applyInitialQuery() {
    const params = new URLSearchParams(location.search);
    el.seed.value = params.get('seed')?.trim().slice(0, 64) || makeSeed();
    const requestedAgents = params.get('agents')?.split(',');
    if (requestedAgents?.length === 4 && requestedAgents.every(key => Object.hasOwn(AGENT_META, key))) {
      lineup.splice(0, 4, ...requestedAgents);
    }
    const requestedDuration = Number(params.get('duration'));
    if (Number.isFinite(requestedDuration) && requestedDuration >= 10 && requestedDuration <= 1800) {
      const duration = normalizeDuration(requestedDuration);
      if (DURATION_PRESETS.has(duration)) el.duration.value = String(duration);
      else { el.duration.value = 'custom'; el.durationCustom.value = String(duration); }
    }
    const requestedSpeed = Number(params.get('speed'));
    if (Number.isFinite(requestedSpeed) && requestedSpeed >= .25 && requestedSpeed <= 20) {
      const speed = normalizeSpeed(requestedSpeed);
      if (SPEED_PRESETS.has(speed)) el.speed.value = String(speed);
      else { el.speed.value = 'custom'; el.speedCustom.value = String(speed); }
    }
    const initialRotation = Number(params.get('rotation'));
    el.rotation.value = Number.isInteger(initialRotation) && initialRotation >= 0 && initialRotation < 4
      ? String(initialRotation) : '0';
    syncCustomSettingVisibility();
  }

  function syncUrl() {
    const query = new URLSearchParams(location.search);
    query.set('seed', el.seed.value);
    query.set('rotation', el.rotation.value);
    query.set('agents', lineup.join(','));
    query.set('duration', String(selectedDuration()));
    query.set('speed', String(selectedSpeed()));
    history.replaceState(null, '', location.pathname + '?' + query.toString());
  }

  function renderTeamConfig() {
    el.cfg.innerHTML = '';
    lineup.forEach((strategy, id) => {
      const card = document.createElement('div');
      card.className = 'team-card';
      const options = Object.entries(AGENT_META).map(([key, meta]) =>
        '<option value="' + key + '" ' + (strategy === key ? 'selected' : '') + '>' + meta.name + '</option>').join('');
      card.innerHTML = '<div class="team-card-head"><div class="team-id"><i class="team-swatch" style="background:' +
        COLORS[id] + '"></i>' + TEAM_NAMES[id] + '</div><span class="agent-tier">' +
        AGENT_META[strategy].tier + '</span></div><select data-team="' + id + '">' + options +
        '</select><div class="strategy-desc" data-desc="' + id + '">' + AGENT_META[strategy].desc + '</div>';
      el.cfg.appendChild(card);
    });
    el.cfg.querySelectorAll('select').forEach(select => select.onchange = event => {
      const id = +event.target.dataset.team, key = event.target.value;
      lineup[id] = key;
      const description = el.cfg.querySelector('[data-desc="' + id + '"]');
      if (description) description.textContent = AGENT_META[key].desc;
      onLineupChange?.();
    });
  }

  return {applyInitialQuery, renderTeamConfig, selectedDuration, selectedSpeed, syncCustomSettingVisibility, syncUrl};
}
