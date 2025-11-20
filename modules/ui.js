import { ICONS, STORAGE_KEYS } from './config.js';

const initThemeToggle = () => {
  const root = document.documentElement;
  const body = document.body;
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  let isDark = storedTheme ? storedTheme === 'dark' : prefersDark;
  const render = () => {
    root.classList.toggle('dark', isDark);
    body.classList.toggle('dark', isDark);
    btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
    btn.classList.remove('ql-active');
  };
  render();
  requestAnimationFrame(() => {
    document.body.classList.add('pmid-sidebar-ready');
  });
  btn.addEventListener('click', () => {
    isDark = !root.classList.contains('dark');
    render();
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light');
  });
};

const initTitleSizing = () => {
  const row = document.getElementById('title-row');
  const author = document.getElementById('title-author');
  const ghost = document.getElementById('title-author-ghost');
  if (!row || !author || !ghost) return;
  const labels = [
    author.dataset.authorFull || author.textContent,
    author.dataset.authorShort,
    author.dataset.authorTiny
  ].filter(Boolean);
  if (!labels.length) return;
  const applyLabel = label => {
    author.textContent = label;
    ghost.textContent = label;
  };
  const fit = () => {
    const parentWidth = row.parentElement?.clientWidth || row.clientWidth || window.innerWidth;
    for (const label of labels) {
      applyLabel(label);
      if (row.scrollWidth <= parentWidth) return;
    }
    applyLabel(labels[labels.length - 1]);
  };
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('load', fit, { once: true });
  fit();
};

const initViewToggle = quill => {
  const btn = document.getElementById('view-toggle');
  if (!btn || !quill) return;
  const readStoredState = () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.viewMode) === 'view';
    } catch (_) {
      return false;
    }
  };
  let viewOnly = readStoredState();
  const apply = () => {
    quill.enable(!viewOnly);
    quill.root.classList.toggle('ql-view-only', viewOnly);
    document.body.classList.toggle('view-only-mode', viewOnly);
    btn.classList.toggle('ql-active', viewOnly);
    btn.innerHTML = ICONS.eye;
    btn.setAttribute('aria-pressed', viewOnly ? 'true' : 'false');
    btn.setAttribute('aria-label', viewOnly ? 'Switch to editing mode' : 'Enable view-only mode');
    btn.title = viewOnly ? 'Switch to editing mode' : 'Enable view-only mode';
    try {
      localStorage.setItem(STORAGE_KEYS.viewMode, viewOnly ? 'view' : 'edit');
    } catch (_) {}
  };
  btn.addEventListener('click', () => {
    viewOnly = !viewOnly;
    apply();
  });
  apply();
};

export { initThemeToggle, initTitleSizing, initViewToggle };
