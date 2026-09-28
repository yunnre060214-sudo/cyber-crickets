import {buildHtmlReport} from './html.js?v=20260928-export-v2';
import {buildMarkdownLog} from './markdown.js?v=20260928-export-v2';
import {buildFullData} from './model.js?v=20260928-export-v2';

export async function createMatchExport(context, format = 'html') {
  const {match} = context;
  const safeSeed = String(match.seed).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 32) || 'match';
  const stem = 'cyber-crickets_' + safeSeed + '_' + Math.round(match.time) + 's';
  if (format === 'html') return {filename: stem + '_report.html', label: '可视化战报',
    blob: new Blob([buildHtmlReport(context)], {type: 'text/html;charset=utf-8'})};
  if (format === 'markdown') return {filename: stem + '_summary.md', label: '精简摘要',
    blob: new Blob([buildMarkdownLog(context)], {type: 'text/markdown;charset=utf-8'})};
  if (format !== 'data') throw new RangeError('Unsupported export format');
  // Serialize before awaiting compression: a running match may advance in the meantime.
  const raw = new Blob([JSON.stringify(buildFullData(context))], {type: 'application/json'});
  if (typeof CompressionStream === 'function') {
    try {
      const stream = raw.stream().pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
      return {filename: stem + '_data.json.gz', label: '完整数据（压缩）',
        blob: new Blob([buffer], {type: 'application/gzip'}), compressed: true};
    } catch { /* A browser without working gzip still receives all records below. */ }
  }
  return {filename: stem + '_data.json', label: '完整数据（未压缩）', blob: raw, compressed: false};
}

export function formatBytes(bytes) {
  return bytes < 1024 ? bytes + ' B' : bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function saveMatchExport(file) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url; link.download = file.filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return {...file, sizeLabel: formatBytes(file.blob.size)};
}

export async function downloadMatchExport(context, format = 'html') {
  return saveMatchExport(await createMatchExport(context, format));
}
