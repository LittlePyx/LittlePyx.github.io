(() => {
  const chartClasses = ['cp-flowchart', 'cp-sequence', 'cp-mindmap']
  let scheduled = false

  function chartMeta(source) {
    const text = source.trimStart()

    if (text.startsWith('sequenceDiagram')) {
      return { className: 'cp-sequence', label: '交互时序' }
    }

    if (text.startsWith('mindmap')) {
      return { className: 'cp-mindmap', label: '知识地图' }
    }

    return { className: 'cp-flowchart', label: '概念流程' }
  }

  function polishChart(wrap) {
    const source = wrap.querySelector('.mermaid-src')?.textContent || ''
    const svg = wrap.querySelector('svg')

    if (!source || !svg) return

    const meta = chartMeta(source)
    wrap.classList.remove(...chartClasses)
    wrap.classList.add(meta.className)
    wrap.dataset.chartLabel = meta.label

    const viewBox = (svg.getAttribute('viewBox') || '')
      .trim()
      .split(/\s+/)
      .map(Number)
    const ratio = viewBox.length === 4 && viewBox[3] ? viewBox[2] / viewBox[3] : 1

    wrap.classList.toggle('is-wide-chart', ratio > 4)
    wrap.classList.toggle('is-ultrawide-chart', ratio > 7)
    wrap.classList.toggle('is-tall-chart', ratio < 0.85)

    requestAnimationFrame(() => {
      const isScrollable = wrap.scrollWidth > wrap.clientWidth + 8
      wrap.classList.toggle('is-scrollable', isScrollable)

      let hint = wrap.querySelector(':scope > .cp-scroll-hint')
      if (!hint) {
        hint = document.createElement('span')
        hint.className = 'cp-scroll-hint'
        hint.textContent = '左右滑动查看完整图'
        hint.setAttribute('aria-hidden', 'true')
        wrap.appendChild(hint)
      }
      hint.hidden = !isScrollable
    })
  }

  function polishAll() {
    document.querySelectorAll('#article-container .mermaid-wrap').forEach(polishChart)
  }

  function schedulePolish() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      polishAll()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', polishAll, { once: true })
  } else {
    polishAll()
  }

  document.addEventListener('pjax:complete', schedulePolish)
  window.addEventListener('resize', schedulePolish, { passive: true })

  const observer = new MutationObserver(schedulePolish)
  observer.observe(document.documentElement, { childList: true, subtree: true })
})()
