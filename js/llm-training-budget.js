(function () {
  'use strict';
  function init() {
    const root = document.getElementById('llm-training-budget');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';
    const parameters = root.querySelector('[name="parameters"]');
    const ranks = root.querySelector('[name="ranks"]');
    const rows = root.querySelectorAll('tbody tr');
    const result = root.querySelector('.training-budget-result');
    function render() {
      // N is in billions, so bytes per parameter times N gives decimal GB.
      const n = Number(parameters.value), k = Number(ranks.value);
      if (!(n > 0 && k >= 1)) return;
      const states = [
        [2 * n, 2 * n, 12 * n],
        [2 * n, 2 * n, 12 * n / k],
        [2 * n, 2 * n / k, 12 * n / k],
        [2 * n / k, 2 * n / k, 12 * n / k]
      ];
      states.forEach((parts, i) => {
        const values = parts.concat(parts.reduce((a, b) => a + b, 0));
        rows[i].querySelectorAll('td').forEach((cell, j) => {
          cell.textContent = values[j].toFixed(2);
        });
      });
      result.textContent = k === 1
        ? `${n}B 参数、1 路：没有跨卡分片，四种方案均为 ${(16 * n).toFixed(2)} GB。`
        : `${n}B 参数、${k} 路分片：ZeRO-3 的每卡稳态模型状态为 ${(16 * n / k).toFixed(2)} GB，DDP 为 ${(16 * n).toFixed(2)} GB。`;
    }
    parameters.addEventListener('change', render);
    ranks.addEventListener('change', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:complete', init);
})();
