(() => {
  const CODE_LINE_LIMIT = 30
  const CODE_HEIGHT_LIMIT = 430
  const MOBILE_BREAKPOINT = 768
  let enhancementScheduled = false

  function createIcon(className) {
    const icon = document.createElement('i')
    icon.className = className
    icon.setAttribute('aria-hidden', 'true')
    return icon
  }

  function createMobileTools() {
    if (document.getElementById('cp-mobile-tools')) return

    const tools = document.createElement('div')
    tools.id = 'cp-mobile-tools'
    tools.innerHTML = `
      <div class="cp-mobile-tools-menu" id="cp-mobile-tools-menu" aria-hidden="true">
        <button type="button" data-action="toc"><i class="fas fa-list-ul" aria-hidden="true"></i><span>目录</span></button>
        <button type="button" data-action="theme"><i class="fas fa-adjust" aria-hidden="true"></i><span>主题</span></button>
        <button type="button" data-action="top"><i class="fas fa-arrow-up" aria-hidden="true"></i><span>顶部</span></button>
      </div>
      <button type="button" class="cp-mobile-tools-toggle" aria-label="打开阅读工具" aria-controls="cp-mobile-tools-menu" aria-expanded="false">
        <i class="fas fa-ellipsis-h" aria-hidden="true"></i>
      </button>
    `
    document.body.appendChild(tools)

    const toggle = tools.querySelector('.cp-mobile-tools-toggle')
    const menu = tools.querySelector('.cp-mobile-tools-menu')

    const setOpen = open => {
      tools.classList.toggle('is-open', open)
      toggle.setAttribute('aria-expanded', String(open))
      toggle.setAttribute('aria-label', open ? '关闭阅读工具' : '打开阅读工具')
      menu.setAttribute('aria-hidden', String(!open))
    }

    toggle.addEventListener('click', event => {
      event.stopPropagation()
      setOpen(!tools.classList.contains('is-open'))
    })

    menu.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]')
      if (!button) return

      const action = button.dataset.action
      if (action === 'toc') {
        document.getElementById('mobile-toc-button')?.click()
      } else if (action === 'theme') {
        document.getElementById('darkmode')?.click()
      } else if (action === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setOpen(false)
    })

    document.addEventListener('click', event => {
      if (!tools.contains(event.target)) setOpen(false)
    })

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setOpen(false)
    })
  }

  function updateMobileTools() {
    const tools = document.getElementById('cp-mobile-tools')
    if (!tools) return

    const tocButton = tools.querySelector('[data-action="toc"]')
    const hasToc = Boolean(document.getElementById('mobile-toc-button'))
    tocButton.hidden = !hasToc
    tools.classList.toggle('has-toc', hasToc)
  }

  function countCodeLines(figure) {
    const codeBlock = figure.querySelector('td.code') || figure.querySelector(':scope > pre')
    if (!codeBlock) return 0

    const codeLines = codeBlock.querySelectorAll('.line')
    if (codeLines.length) return codeLines.length

    const code = codeBlock.textContent || ''
    return code ? code.replace(/\n$/, '').split('\n').length : 0
  }

  function makeCodeCollapsible(figure) {
    if (figure.dataset.cpCollapsible || figure.classList.contains('text')) return

    const tableOrPre = figure.querySelector(':scope > table, :scope > pre')
    if (!tableOrPre) return

    const lineCount = countCodeLines(figure)
    const codeHeight = tableOrPre.getBoundingClientRect().height
    if (lineCount <= CODE_LINE_LIMIT && codeHeight <= CODE_HEIGHT_LIMIT) return

    figure.dataset.cpCollapsible = 'true'
    figure.classList.add('cp-code-collapsible', 'is-collapsed')

    const viewport = document.createElement('div')
    viewport.className = 'cp-code-viewport'
    tableOrPre.before(viewport)
    viewport.appendChild(tableOrPre)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cp-code-toggle'
    button.setAttribute('aria-expanded', 'false')
    button.append(createIcon('fas fa-chevron-down'))
    const label = document.createElement('span')
    label.textContent = `展开完整代码 · ${lineCount} 行`
    button.append(label)
    figure.appendChild(button)

    button.addEventListener('click', () => {
      const expanded = figure.classList.toggle('is-expanded')
      figure.classList.toggle('is-collapsed', !expanded)
      button.setAttribute('aria-expanded', String(expanded))
      button.querySelector('span').textContent = expanded ? '收起代码' : `展开完整代码 · ${lineCount} 行`

      if (!expanded && figure.getBoundingClientRect().top < 72) {
        figure.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  function rewriteSvgIds(svg) {
    const suffix = `-cp-modal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const replacements = new Map()

    svg.querySelectorAll('[id]').forEach(element => {
      const oldId = element.id
      const newId = `${oldId}${suffix}`
      replacements.set(oldId, newId)
      element.id = newId
    })

    if (!replacements.size) return

    svg.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value
        replacements.forEach((newId, oldId) => {
          value = value
            .replaceAll(`url(#${oldId})`, `url(#${newId})`)
            .replaceAll(`href="#${oldId}"`, `href="#${newId}"`)
          if (value === `#${oldId}`) value = `#${newId}`
        })
        if (value !== attribute.value) element.setAttribute(attribute.name, value)
      })
    })
  }

  function createChartModal() {
    const modal = document.createElement('div')
    modal.className = 'cp-chart-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-hidden', 'true')
    modal.innerHTML = `
      <div class="cp-chart-modal-shell">
        <header class="cp-chart-modal-header">
          <div class="cp-chart-modal-title"><span class="cp-chart-modal-kicker">图表大图</span><strong>概念流程</strong></div>
          <div class="cp-chart-modal-actions">
            <button type="button" data-action="minus" aria-label="缩小图表"><i class="fas fa-minus" aria-hidden="true"></i></button>
            <button type="button" data-action="reset" aria-label="恢复图表大小"><span>100%</span></button>
            <button type="button" data-action="plus" aria-label="放大图表"><i class="fas fa-plus" aria-hidden="true"></i></button>
            <button type="button" data-action="close" aria-label="关闭大图"><i class="fas fa-times" aria-hidden="true"></i></button>
          </div>
        </header>
        <div class="cp-chart-modal-stage" tabindex="0">
          <div class="cp-chart-modal-canvas"></div>
        </div>
      </div>
    `
    return modal
  }

  function openChartModal(sourceWrap) {
    const article = document.getElementById('article-container')
    const sourceSvg = sourceWrap.querySelector(':scope > svg')
    if (!article || !sourceSvg) return

    const modal = createChartModal()
    const canvas = modal.querySelector('.cp-chart-modal-canvas')
    const stage = modal.querySelector('.cp-chart-modal-stage')
    const resetLabel = modal.querySelector('[data-action="reset"] span')
    const title = modal.querySelector('.cp-chart-modal-title strong')
    const chartWrap = document.createElement('div')
    const svg = sourceSvg.cloneNode(true)
    rewriteSvgIds(svg)

    chartWrap.className = `${sourceWrap.className} cp-chart-modal-chart`
    chartWrap.removeAttribute('style')
    chartWrap.dataset.chartLabel = sourceWrap.dataset.chartLabel || '图表'
    chartWrap.appendChild(svg)
    canvas.appendChild(chartWrap)
    title.textContent = sourceWrap.dataset.chartLabel || '图表'
    article.appendChild(modal)

    const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number)
    const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : sourceSvg.getBoundingClientRect().width
    const viewportWidth = Math.max(document.documentElement.clientWidth, 320)
    const minimumWidth = viewportWidth <= MOBILE_BREAKPOINT ? 620 : 760
    const maximumWidth = viewportWidth <= MOBILE_BREAKPOINT ? 920 : 1280
    const baseWidth = Math.min(Math.max(viewBoxWidth, minimumWidth), maximumWidth)
    let zoom = 1
    const previousOverflow = document.body.style.overflow

    const applyZoom = () => {
      svg.style.width = `${Math.round(baseWidth * zoom)}px`
      svg.style.height = 'auto'
      svg.style.maxWidth = 'none'
      resetLabel.textContent = `${Math.round(zoom * 100)}%`
    }

    const close = () => {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = previousOverflow
      modal.classList.remove('is-visible')
      modal.setAttribute('aria-hidden', 'true')
      window.setTimeout(() => modal.remove(), 180)
    }

    modal.addEventListener('click', event => {
      const action = event.target.closest('button[data-action]')?.dataset.action
      if (action === 'close') close()
      if (action === 'minus') {
        zoom = Math.max(0.6, Number((zoom - 0.2).toFixed(1)))
        applyZoom()
      }
      if (action === 'plus') {
        zoom = Math.min(2, Number((zoom + 0.2).toFixed(1)))
        applyZoom()
      }
      if (action === 'reset') {
        zoom = 1
        applyZoom()
        stage.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      }
      if (event.target === modal) close()
    })

    const onKeydown = event => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', onKeydown)

    applyZoom()
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      modal.classList.add('is-visible')
      modal.setAttribute('aria-hidden', 'false')
      stage.focus({ preventScroll: true })
    })
  }

  function enhanceChart(wrap) {
    if (wrap.dataset.cpExpandable || !wrap.querySelector(':scope > svg')) return
    wrap.dataset.cpExpandable = 'true'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cp-chart-expand'
    button.setAttribute('aria-label', '在大图中查看图表')
    button.append(createIcon('fas fa-expand-alt'))
    const label = document.createElement('span')
    label.textContent = '查看大图'
    button.append(label)
    button.addEventListener('click', () => openChartModal(wrap))
    wrap.appendChild(button)
  }

  function enhanceArticle() {
    createMobileTools()
    updateMobileTools()
    document.querySelectorAll('#article-container figure.highlight').forEach(makeCodeCollapsible)
    document.querySelectorAll('#article-container .mermaid-wrap').forEach(enhanceChart)
  }

  function scheduleEnhancement() {
    if (enhancementScheduled) return
    enhancementScheduled = true
    requestAnimationFrame(() => {
      enhancementScheduled = false
      enhanceArticle()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceArticle, { once: true })
  } else {
    enhanceArticle()
  }

  document.addEventListener('pjax:complete', scheduleEnhancement)
  const observer = new MutationObserver(scheduleEnhancement)
  observer.observe(document.documentElement, { childList: true, subtree: true })
})()
