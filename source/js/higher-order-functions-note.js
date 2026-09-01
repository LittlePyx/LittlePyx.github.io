(() => {
  const steps = [
    {
      title: '调用函数工厂',
      description: '执行 make_min_score_filter(60)，创建局部帧 f1，并把 min_score 绑定到 60。'
    },
    {
      title: '创建内层函数',
      description: '执行内层 def，创建 qualified 函数对象。它的 parent 在定义这一刻确定为 f1，而不是未来调用它的位置。'
    },
    {
      title: '返回闭包',
      description: 'qualified 被返回并绑定给全局名字 is_pass。外层调用虽然结束，但 f1 仍被函数对象引用，所以其中的绑定继续存在。'
    },
    {
      title: '沿定义环境查找',
      description: '调用 is_pass 后创建 f2。min_score 不在 f2 中，于是沿 parent 进入 f1，找到 min_score = 60，最终得到 True。'
    }
  ];

  const initialize = root => {
    if (root.dataset.traceReady === 'true') return;
    root.dataset.traceReady = 'true';

    const title = root.querySelector('[data-trace-title]');
    const description = root.querySelector('[data-trace-description]');
    const current = root.querySelector('[data-trace-current]');
    const previous = root.querySelector('[data-trace-prev]');
    const next = root.querySelector('[data-trace-next]');
    const dots = [...root.querySelectorAll('[data-trace-goto]')];
    let step = 0;

    const render = nextStep => {
      step = Math.max(0, Math.min(steps.length - 1, nextStep));
      root.dataset.step = String(step);
      current.textContent = String(step + 1);
      title.textContent = steps[step].title;
      description.textContent = steps[step].description;
      previous.disabled = step === 0;
      next.disabled = step === steps.length - 1;
      dots.forEach((dot, index) => {
        if (index === step) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
      });
    };

    previous.addEventListener('click', () => render(step - 1));
    next.addEventListener('click', () => render(step + 1));
    dots.forEach(dot => {
      dot.addEventListener('click', () => render(Number(dot.dataset.traceGoto)));
    });

    render(0);
  };

  const initializeAll = () => {
    document.querySelectorAll('[data-closure-trace]').forEach(initialize);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAll, { once: true });
  } else {
    initializeAll();
  }

  window.addEventListener('pjax:complete', initializeAll);
})();
