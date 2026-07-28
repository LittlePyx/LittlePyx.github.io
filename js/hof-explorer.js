(() => {
  const modes = {
    argument: {
      left: '策略函数',
      center: '通用机制',
      right: '计算结果',
      purpose: '注入行为',
      summary: '框架保留稳定流程，调用者只提供可替换策略。',
      control: '框架决定何时调用传入函数',
      uses: '排序 key · 目标函数 · 回调 · 测试替身',
      label: '策略函数进入通用机制并产生计算结果'
    },
    factory: {
      left: '配置 / 上下文',
      center: '函数工厂',
      right: '专用函数',
      purpose: '生成行为',
      summary: '创建阶段固定上下文，调用阶段只接收变化的数据。',
      control: '生成的函数保留定义时的环境',
      uses: '验证器 · 查询函数 · 配置化处理器 · 回调',
      label: '配置和上下文进入函数工厂并产生专用函数'
    },
    wrapper: {
      left: '原函数',
      center: '包装器',
      right: '增强函数',
      purpose: '包装行为',
      summary: '保持核心职责不变，在调用边界统一叠加额外能力。',
      control: '包装器接管原函数调用前后的流程',
      uses: '日志 · 缓存 · 权限 · 重试 · 中间件',
      label: '原函数经过包装器变成增强函数'
    }
  };

  const initialize = root => {
    if (root.dataset.hofReady === 'true') return;
    root.dataset.hofReady = 'true';

    const buttons = [...root.querySelectorAll('[data-hof-mode]')];
    const flow = root.querySelector('[data-hof-flow]');
    const fields = {
      left: root.querySelector('[data-hof-left]'),
      center: root.querySelector('[data-hof-center]'),
      right: root.querySelector('[data-hof-right]'),
      purpose: root.querySelector('[data-hof-purpose]'),
      summary: root.querySelector('[data-hof-summary]'),
      control: root.querySelector('[data-hof-control]'),
      uses: root.querySelector('[data-hof-uses]')
    };

    const selectMode = modeName => {
      const mode = modes[modeName];
      if (!mode) return;

      buttons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.hofMode === modeName));
      });

      Object.entries(fields).forEach(([name, element]) => {
        element.textContent = mode[name];
      });

      flow.setAttribute('aria-label', mode.label);
      flow.classList.remove('is-changing');
      void flow.offsetWidth;
      flow.classList.add('is-changing');
    };

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => selectMode(button.dataset.hofMode));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        const nextButton = buttons[(index + direction + buttons.length) % buttons.length];
        nextButton.focus();
        nextButton.click();
      });
    });
  };

  const initializeAll = () => {
    document.querySelectorAll('[data-hof-explorer]').forEach(initialize);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAll, { once: true });
  } else {
    initializeAll();
  }

  window.addEventListener('pjax:complete', initializeAll);
})();
