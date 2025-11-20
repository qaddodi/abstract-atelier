import { isMobile } from './config.js';
import { createAnchorForPMID } from './link-utils.js';

const registerQuillExtensions = () => {
  const Inline = Quill.import('blots/inline');
  class PMIDBlot extends Inline {
    static create(value) {
      const node = super.create();
      if (value && value !== true) node.setAttribute('data-pmid', value);
      node.classList.add('ql-pmid');
      return node;
    }
    static formats(node) {
      return node.getAttribute('data-pmid') || false;
    }
  }
  PMIDBlot.blotName = 'pmid';
  PMIDBlot.tagName = 'span';
  Quill.register(PMIDBlot, true);

  const Size = Quill.import('attributors/style/size');
  Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px'];
  Quill.register(Size, true);
};

const initQuill = () => {
  registerQuillExtensions();
  const toolbarEl = document.getElementById('toolbar');
  if (!toolbarEl) throw new Error('Toolbar container #toolbar not found in DOM at init time');
  const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: '',
    modules: { toolbar: toolbarEl },
    formats: ['bold', 'italic', 'underline', 'list', 'align', 'pmid', 'size']
  });
  return { quill, toolbarEl };
};

const setupToolbarSnap = (toolbarEl, quill) => {
  const getToolbarNode = () => {
    if (toolbarEl.classList.contains('ql-toolbar')) return toolbarEl;
    return toolbarEl.querySelector('.ql-toolbar');
  };
  const snapToolbarToStart = (behavior = 'auto') => {
    const node = getToolbarNode();
    if (!node) return;
    if (node.scrollWidth <= node.clientWidth) return;
    try {
      node.scrollTo({ left: 0, behavior });
    } catch (_) {
      node.scrollLeft = 0;
    }
  };
  const placeCaretIfBlank = () => {
    if (quill.getLength() > 1) return;
    try {
      quill.setSelection(0, 0, 'api');
    } catch (_) {}
  };
  quill.root.addEventListener('focus', placeCaretIfBlank);
  requestAnimationFrame(() => {
    quill.focus();
    placeCaretIfBlank();
    snapToolbarToStart('auto');
  });
  setTimeout(() => {
    if (!quill.hasFocus()) return;
    placeCaretIfBlank();
  }, 150);
  quill.on('text-change', () => {
    if (quill.getLength() > 1) return;
    placeCaretIfBlank();
  });
  window.addEventListener('resize', () => snapToolbarToStart('auto'), { passive: true });
};

const initToolbarTooltips = toolbarEl => {
  if (!toolbarEl) return;
  const tooltip = document.createElement('div');
  tooltip.id = 'toolbar-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);
  toolbarEl.classList.add('toolbar-tooltips-ready');
  let activeBtn = null;
  const positionTooltip = btn => {
    const rect = btn?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const x = Math.min(Math.max(rect.left + (rect.width / 2), 8), Math.max(8, viewportWidth - 8));
    const y = rect.bottom + 8;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  };
  const hideTooltip = () => {
    activeBtn = null;
    tooltip.classList.remove('is-visible');
  };
  const showTooltip = btn => {
    const label = btn?.dataset?.tooltip;
    if (!label || isMobile()) return;
    activeBtn = btn;
    tooltip.textContent = label;
    positionTooltip(btn);
    tooltip.classList.add('is-visible');
  };
  const handleEnter = event => {
    const target = event?.currentTarget;
    if (!target) return;
    showTooltip(target);
  };
  const handleLeave = () => hideTooltip();
  toolbarEl.querySelectorAll('[data-tooltip]').forEach(btn => {
    btn.addEventListener('mouseenter', handleEnter);
    btn.addEventListener('focus', handleEnter);
    btn.addEventListener('mouseleave', handleLeave);
    btn.addEventListener('blur', handleLeave);
  });
  toolbarEl.addEventListener('scroll', () => {
    if (!activeBtn) return;
    positionTooltip(activeBtn);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (!activeBtn) return;
    positionTooltip(activeBtn);
  }, { passive: true });
  window.addEventListener('scroll', hideTooltip, { passive: true });
};

const initExport = quill => {
  const exportBtn = document.getElementById('export-pdf');
  if (!exportBtn) return;
  const handleExport = () => {
    exportBtn.classList.add('ql-active');
    setTimeout(() => exportBtn.classList.remove('ql-active'), 400);
    const clone = document.createElement('div');
    clone.innerHTML = quill.root.innerHTML;
    clone.querySelectorAll('.ql-pmid').forEach(createAnchorForPMID);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const markup = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Abstract Atelier Export</title>
  <style>
    body { font-family: "Inter", Arial, sans-serif; margin: 40px; line-height: 1.5; font-size: 11pt; color: #111827; }
    h1, h2, h3 { color: #0f172a; margin-bottom: .6em; }
    a { color: #1d4ed8; text-decoration: underline; }
    p { margin-bottom: .6em; }
    ul, ol { padding-left: 1.25rem; margin-bottom: .75em; }
    li { margin-bottom: .35em; }
  </style>
</head>
<body>${clone.innerHTML}</body>
</html>`;
    printWindow.document.write(markup);
    printWindow.document.close();
    printWindow.focus();
  };
  exportBtn.addEventListener('click', handleExport);
};

const initCopy = quill => {
  const copyBtn = document.getElementById('copy-html');
  const copyIcon = document.getElementById('copy-icon');
  if (!copyBtn || !copyIcon) return;
  const renderCopiedState = copied => {
    if (copied) {
      copyBtn.classList.add('ql-active');
      copyIcon.innerHTML = '<path d="M9 16.2 5.5 12.7l1.4-1.4 2.1 2.1 4.2-4.2 1.4 1.4-5.6 5.6z"/>';
      copyIcon.setAttribute('viewBox', '0 0 24 24');
      copyIcon.setAttribute('fill', 'currentColor');
      copyIcon.classList.add('scale-110');
    } else {
      copyBtn.classList.remove('ql-active');
      copyIcon.innerHTML = '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-1 16H8V7h11v14z"/>';
      copyIcon.setAttribute('viewBox', '0 0 24 24');
      copyIcon.setAttribute('fill', 'currentColor');
      copyIcon.classList.remove('scale-110');
    }
  };
  const showCopySuccess = () => {
    renderCopiedState(true);
    setTimeout(() => renderCopiedState(false), 700);
  };
  const buildClipboardItems = (plain, html) => {
    if (typeof ClipboardItem === 'undefined') return null;
    try {
      return [
        new ClipboardItem({ 'text/plain': new Blob([plain], { type: 'text/plain' }) }),
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })
      ];
    } catch (error) {
      console.warn('Failed to build ClipboardItem payload, falling back to execCommand.', error);
      return null;
    }
  };
  const handleCopy = async () => {
    const clone = document.createElement('div');
    clone.innerHTML = quill.root.innerHTML;
    clone.querySelectorAll('.ql-pmid').forEach(createAnchorForPMID);
    const html = clone.innerHTML;
    const plain = clone.textContent || '';
    const clipboardItems = buildClipboardItems(plain, html);
    if (clipboardItems) {
      try {
        await navigator.clipboard.write(clipboardItems);
        showCopySuccess();
        return;
      } catch (err) {
        console.warn('Navigator clipboard write failed, attempting fallback.', err);
      }
    }
    const temp = document.createElement('div');
    temp.contentEditable = 'true';
    temp.style.position = 'fixed';
    temp.style.left = '-9999px';
    temp.innerHTML = html;
    document.body.appendChild(temp);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(temp);
    selection.removeAllRanges();
    selection.addRange(range);
    const success = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(temp);
    if (success) {
      showCopySuccess();
    } else {
      console.error('Fallback copy failed');
      alert('Unable to copy. Please ensure clipboard permissions are granted.');
    }
  };
  copyBtn.addEventListener('click', handleCopy);
};

export { registerQuillExtensions, initQuill, setupToolbarSnap, initToolbarTooltips, initExport, initCopy };
