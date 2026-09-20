(() => {
  'use strict';
  if (window.projectImageViewerReady) return;
  window.projectImageViewerReady = true;
  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') return;
  dialog.className = 'pv-dialog';
  dialog.setAttribute('aria-label', '项目展示图查看器');
  dialog.innerHTML = `<div class="pv-toolbar"><span class="pv-title">展示图</span><button type="button" data-pv="out" aria-label="缩小">−</button><output class="pv-zoom" aria-live="polite">100%</output><button type="button" data-pv="in" aria-label="放大">＋</button><button type="button" data-pv="fit">适应宽度</button><button type="button" data-pv="actual">原始大小</button><a target="_blank" rel="noopener" class="pv-original">打开原图 ↗</a><button type="button" data-pv="close" aria-label="关闭展示图">关闭 ×</button></div><p class="pv-hint">滚动查看长图 · 按钮缩放 / Ctrl＋滚轮 · 手机双指缩放、单指滚动 · Esc 关闭</p><div class="pv-scroll" tabindex="0" aria-label="展示图，可上下左右滚动"><img class="pv-image" alt="" draggable="false"></div>`;
  document.body.append(dialog);
  const viewport = dialog.querySelector('.pv-scroll');
  const img = dialog.querySelector('img');
  const output = dialog.querySelector('output');
  const hint = dialog.querySelector('.pv-hint');
  const defaultHint = hint.textContent;
  let scale = 1, ready = false, opener, oldOverflow, pinch = null;
  const fit = () => Math.min(1, (viewport.clientWidth - 16) / img.naturalWidth);
  function zoom(next, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    if (!ready) return;
    const previousWidth = img.naturalWidth * scale;
    const inset = Math.max(0, (viewport.clientWidth - previousWidth) / 2);
    const imageX = (viewport.scrollLeft + x - inset) / scale;
    const imageY = (viewport.scrollTop + y) / scale;
    scale = Math.max(Math.min(.1, fit()), Math.min(4, next));
    const width = img.naturalWidth * scale;
    img.style.width = `${width}px`;
    viewport.scrollLeft = imageX * scale + Math.max(0, (viewport.clientWidth - width) / 2) - x;
    viewport.scrollTop = imageY * scale - y;
    output.textContent = `${Math.round(scale * 100)}%`;
  }
  function fitWidth() { zoom(fit()); viewport.scrollTop = 0; viewport.scrollLeft = 0; }
  // Capture avoids competing theme lightboxes intercepting the same image.
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-project-viewer]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    opener = link; ready = false; pinch = null;
    hint.textContent = '正在载入展示图…';
    img.hidden = true;
    dialog.querySelectorAll('button:not([data-pv="close"])').forEach(b => b.disabled = true);
    dialog.querySelector('.pv-original').href = link.href;
    dialog.querySelector('.pv-title').textContent = link.querySelector('img')?.alt || '项目展示图';
    img.alt = link.querySelector('img')?.alt || '项目展示图';
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    img.onload = () => {
      if (!dialog.open) return;
      ready = true; img.hidden = false;
      dialog.querySelectorAll('button').forEach(b => b.disabled = false);
      hint.textContent = defaultHint; fitWidth(); viewport.focus();
    };
    img.onerror = () => { hint.textContent = '图片加载失败，可点击“打开原图”重试。'; };
    img.src = link.href;
  }, true);
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-pv]')?.dataset.pv;
    if (action === 'close') dialog.close();
    if (action === 'in') zoom(scale * 1.25);
    if (action === 'out') zoom(scale / 1.25);
    if (action === 'fit') fitWidth();
    if (action === 'actual') zoom(1);
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = oldOverflow || ''; pinch = null; opener?.focus(); });
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey || !ready) return;
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    zoom(scale * Math.exp(-event.deltaY * .005), event.clientX - box.left, event.clientY - box.top);
  }, { passive: false });
  const distance = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  viewport.addEventListener('touchstart', event => {
    if (event.touches.length === 2 && ready) {
      event.preventDefault(); pinch = { distance: distance(event.touches), scale };
    }
  }, { passive: false });
  viewport.addEventListener('touchmove', event => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const t = event.touches, box = viewport.getBoundingClientRect();
    zoom(pinch.scale * distance(t) / Math.max(1, pinch.distance), (t[0].clientX + t[1].clientX) / 2 - box.left, (t[0].clientY + t[1].clientY) / 2 - box.top);
  }, { passive: false });
  for (const type of ['touchend', 'touchcancel']) viewport.addEventListener(type, () => { pinch = null; });
})();
