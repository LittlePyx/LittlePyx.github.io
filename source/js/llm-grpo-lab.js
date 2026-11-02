(function () {
  'use strict';
  function init() {
    const root = document.getElementById('llm-grpo-lab');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';
    const rewards = [...root.querySelectorAll('[name="reward"]')];
    const normalize = root.querySelector('[name="normalize"]');
    const rows = root.querySelectorAll('tbody tr');
    const signed = n => Math.abs(n) < 0.0005 ? '0.000' : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(3);
    function render() {
      const r = rewards.map(input => Number(input.checked));
      const mean = r.reduce((a, b) => a + b, 0) / r.length;
      const std = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length);
      r.forEach((x, i) => {
        const centered = x - mean;
        const advantage = normalize.checked ? centered / (std + 1e-8) : centered;
        const cells = rows[i].querySelectorAll('td');
        cells[0].textContent = String(x);
        cells[1].textContent = signed(centered);
        cells[2].textContent = signed(advantage);
      });
      const detail = std === 0
        ? '四条优势均为 0；该组没有奖励驱动的相对策略信号，KL 等其他项需另看。'
        : '奖励高于均值的回答获正优势，低于均值的获负优势。当前采用' + (normalize.checked ? '标准化。' : '仅中心化。');
      root.querySelector('.grpo-stats').textContent = `均值 ${mean.toFixed(3)}，标准差 ${std.toFixed(3)}。${detail}`;
    }
    root.addEventListener('change', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:complete', init);
})();
