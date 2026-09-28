import {createMatchExport, saveMatchExport, downloadMatchExport} from '../export/download.js?v=20260928-export-v2';

export function createExportController({dialog, getContext, log}) {
  if (!dialog) return {open: async () => {
    const file = await downloadMatchExport(getContext());
    log('已导出' + file.label + '（' + file.sizeLabel + '）。');
  }};
  const form = dialog.querySelector('form'), submit = dialog.querySelector('#exportDownloadBtn');
  const status = dialog.querySelector('#exportStatus'), info = dialog.querySelector('#exportInfo');
  const fallback = dialog.querySelector('#exportDataFallback');
  let busy = false, generation = 0;
  const selected = () => form.querySelector('input[name="exportFormat"]:checked')?.value || 'html';
  const update = () => {
    submit.textContent = ({html: '下载可视化战报', markdown: '下载精简摘要', data: '下载完整数据'})[selected()];
    fallback.hidden = selected() !== 'data' || typeof CompressionStream === 'function';
  };
  const updateInfo = () => {
    const {match} = getContext();
    info.textContent = (match.finished ? '已结束' : match.time > 0 ? '当前对局' : '尚未开始') + ' · ' +
      match.time.toFixed(1) + ' / ' + match.duration + ' 秒 · ' + match.decisionLog.length.toLocaleString('en-US') + ' 条原始决策';
  };
  form.addEventListener('change', () => { if (!busy) status.textContent = ''; update(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const token = ++generation;
    busy = true; submit.disabled = true;
    updateInfo(); status.textContent = '正在生成文件…';
    try {
      const file = await createMatchExport(getContext(), selected());
      if (generation !== token || !dialog.open) return;
      const saved = saveMatchExport(file);
      status.textContent = '已开始下载：' + saved.label + ' · ' + saved.sizeLabel;
      log('已导出' + saved.label + '（' + saved.sizeLabel + '）。');
    } catch (error) {
      if (generation === token) status.textContent = '导出失败，请重新尝试。';
      console.error(error);
    } finally { busy = false; submit.disabled = false; update(); }
  });
  dialog.querySelector('#exportCloseBtn').onclick = () => { generation++; dialog.close(); };
  dialog.addEventListener('cancel', () => { generation++; });
  return {open() {
    if (dialog.open) return;
    updateInfo(); status.textContent = ''; update(); dialog.showModal();
  }};
}
