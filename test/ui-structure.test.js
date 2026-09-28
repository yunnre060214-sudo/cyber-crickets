import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

test('UI entrypoint uses canonical app.js and modular CSS', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/app\.js\?v=/);
  assert.doesNotMatch(html, /src="\.\/app-\d/);
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const file of ['components.css','mobile-base.css','match.css','layout.css','tournament.css','responsive.css','match-report.css','mobile.css','settings.css']) {
    assert.match(styles, new RegExp('css/' + file.replace('.', '\\.') + '\\?v='));
  }
});

test('app.js delegates heavy UI responsibilities', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const modulePath of ['./ui/settings.js','./ui/scoreboard.js','./ui/map-renderer.js','./ui/report.js','./ui/export.js']) {
    assert.ok(app.includes(modulePath), modulePath + ' should be imported');
  }
  assert.doesNotMatch(app, /function renderLiveChart\s*\(/);
  assert.doesNotMatch(app, /function currentWinProbabilities\s*\(/);
  assert.doesNotMatch(app, /function buildMarkdownLog\s*\(/);
  assert.doesNotMatch(app, /function drawThinking\s*\(/);
});

test('refactored UI modules are valid JavaScript syntax', () => {
  for (const file of ['app.js','ui/constants.js','ui/settings.js','ui/chart.js','ui/scoreboard.js','ui/map-renderer.js','ui/report.js','ui/export.js','export/markdown.js','export/model.js','export/html.js','export/download.js']) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], {stdio:'pipe'});
  }
});
