const initLayout = quill => {
  const topbarEl = document.getElementById('topbar');
  const editorShell = document.getElementById('editor-shell');
  const getScroller = () => quill.scrollingContainer || quill.root?.parentElement || document.querySelector('#editor .ql-editor')?.parentElement || null;
  const smoothScrollBy = (el, dy) => {
    if (!dy) return;
    try {
      el.scrollTo({ top: el.scrollTop + dy, behavior: 'smooth' });
    } catch (_) {
      el.scrollTop += dy;
    }
  };
  const setMinHeights = () => {
    const topH = topbarEl?.offsetHeight || 0;
    document.documentElement.style.setProperty('--topbar-height', `${topH}px`);
    const H = Math.max(0, window.innerHeight - topH);
    if (editorShell) editorShell.style.minHeight = `${H}px`;
    const editorEl = document.querySelector('#editor .ql-editor');
    if (editorEl) editorEl.style.minHeight = `${H}px`;
  };
  const recalcAnchors = () => {
    const scroller = getScroller();
    if (!scroller) return;
    scroller.style.paddingTop = '0px';
    scroller.style.paddingBottom = '0px';
  };
  const ANCHOR_TOP_PX = 16;
  const ensureCaretBelowTop = () => {
    const scroller = getScroller();
    if (!scroller) return;
    const range = quill.getSelection();
    if (!range) return;
    const bounds = quill.getBounds(range.index, range.length);
    if (bounds && typeof bounds.top === 'number' && bounds.top < ANCHOR_TOP_PX) {
      smoothScrollBy(scroller, bounds.top - ANCHOR_TOP_PX);
    }
  };
  const redoLayout = () => {
    setMinHeights();
    recalcAnchors();
  };
  requestAnimationFrame(redoLayout);
  window.addEventListener('resize', redoLayout, { passive: true });
  quill.on('selection-change', () => {
    redoLayout();
    ensureCaretBelowTop();
  });
  return { ensureCaretBelowTop, redoLayout, topbarEl };
};

export { initLayout };
