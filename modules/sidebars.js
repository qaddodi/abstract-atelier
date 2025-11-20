import { CONFIG, STORAGE_KEYS, isMobile, onMobileChange } from './config.js';
import { $, debounce, animateScrollTo, easeOutCubic, fetchWithRetry } from './utils.js';
import { fetchPmidMetadata, extractUniquePMIDs, countPMIDMentions } from './pmid.js';
import { openPubmed } from './link-utils.js';

const createSidebars = state => {
  const isPmidSidebarOpen = () => {
    return document.body.classList.contains('pmid-sidebar-mobile-open')
      || !document.body.classList.contains('pmid-sidebar-collapsed');
  };

  const keepAbstractAlignedWithPmid = ({ preserveActive = true } = {}) => {
    if (!state.abstractPanelEnabled) return;
    if (isPmidSidebarOpen()) {
      state.abstractSidebarApi.openEmpty({ preserveActive });
    }
  };

  const readAbstractPanelEnabled = () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.abstractPanel) !== 'off';
    } catch (_) {
      return true;
    }
  };

  const setAbstractPanelEnabled = value => {
    state.abstractPanelEnabled = !!value;
    document.body.classList.toggle('abstract-sidebar-disabled', !state.abstractPanelEnabled);
    try {
      localStorage.setItem(STORAGE_KEYS.abstractPanel, state.abstractPanelEnabled ? 'on' : 'off');
    } catch (_) {}
  };

  const syncAbstractToggleButton = () => {
    const btn = $('#toggle-abstract');
    if (!btn) return;
    btn.classList.toggle('ql-active', state.abstractPanelEnabled);
    btn.setAttribute('aria-pressed', state.abstractPanelEnabled ? 'true' : 'false');
    btn.setAttribute('aria-label', state.abstractPanelEnabled ? 'Disable abstract panel' : 'Enable abstract panel');
    btn.title = state.abstractPanelEnabled ? 'Disable abstract panel' : 'Enable abstract panel';
  };

  const initSidebarToggle = sidebar => {
    const btn = $('#toggle-sidebar');
    if (!btn || !sidebar) return;
    const readStoredState = () => {
      try {
        return localStorage.getItem(STORAGE_KEYS.sidebar) === 'collapsed';
      } catch (_) {
        return false;
      }
    };
    let collapsed = readStoredState();
    const render = () => {
      const mobile = isMobile();
      if (mobile) {
        document.body.classList.remove('pmid-sidebar-collapsed');
        document.body.classList.toggle('pmid-sidebar-mobile-open', !collapsed);
        if (!collapsed) keepAbstractAlignedWithPmid({ preserveActive: true });
      } else {
        document.body.classList.remove('pmid-sidebar-mobile-open');
        document.body.classList.toggle('pmid-sidebar-collapsed', collapsed);
        if (collapsed) {
          state.abstractSidebarApi.hide(true);
        } else {
          keepAbstractAlignedWithPmid({ preserveActive: true });
        }
      }
      sidebar.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
      btn.setAttribute('aria-label', collapsed ? 'Show citations panel' : 'Hide citations panel');
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.classList.toggle('ql-active', !collapsed);
    };
    render();
    btn.addEventListener('click', () => {
      collapsed = !collapsed;
      render();
      try {
        localStorage.setItem(STORAGE_KEYS.sidebar, collapsed ? 'collapsed' : 'expanded');
      } catch (_) {}
    });
    const handleMedia = () => render();
    onMobileChange(handleMedia);
  };

  const initAbstractPanelToggle = () => {
    const btn = $('#toggle-abstract');
    if (!btn) return;
    const apply = () => {
      document.body.classList.toggle('abstract-sidebar-disabled', !state.abstractPanelEnabled);
      syncAbstractToggleButton();
      if (!state.abstractPanelEnabled) {
        state.abstractSidebarApi.hide(true);
        return;
      }
      state.abstractSidebarApi.openEmpty({ preserveActive: true });
    };
    setAbstractPanelEnabled(readAbstractPanelEnabled());
    apply();
    btn.addEventListener('click', () => {
      setAbstractPanelEnabled(!state.abstractPanelEnabled);
      apply();
    });
  };

  const initAbstractSidebar = quill => {
    const sidebar = document.getElementById('abstract-sidebar');
    const contentEl = sidebar ? $('#abstract-sidebar-content', sidebar) : null;
    const emptyEl = sidebar ? $('#abstract-sidebar-empty', sidebar) : null;
    const searchForm = sidebar ? $('#abstract-search-form', sidebar) : null;
    const searchInput = sidebar ? $('#abstract-search-input', sidebar) : null;
    const searchResultsEl = sidebar ? $('#abstract-search-results', sidebar) : null;
    const newSearchBtn = sidebar ? $('#abstract-new-search', sidebar) : null;
    const backToResultsBtn = sidebar ? $('#abstract-back-to-results', sidebar) : null;
    const closeBtn = sidebar ? $('#abstract-sidebar-close', sidebar) : null;
    if (!sidebar || !contentEl || !emptyEl || !searchForm || !searchInput || !searchResultsEl) {
      return state.abstractSidebarApi;
    }

    let currentPmid = null;
    let requestId = 0;
    let viewMode = 'search';
    let viewSource = 'search'; // 'search' | 'inline'
    const defaultEmptyMessage = emptyEl.textContent || 'Search PubMed or select a citation.';
    const SEARCH_PAGE_SIZE = 12;
    let searchRequestId = 0;
    const searchState = {
      query: '',
      start: 0,
      total: 0,
      loading: false
    };
    let searchLoadingEl = null;

    const abstractSidebarEnabled = () => state.abstractPanelEnabled;

    const searchAllowed = () => !isMobile();

    const scrollSidebarToTop = () => {
      if (!sidebar) return;
      if (typeof sidebar.scrollTo === 'function') {
        sidebar.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        sidebar.scrollTop = 0;
      }
    };

    const setOpen = open => {
      if (!abstractSidebarEnabled()) {
        document.body.classList.remove('abstract-sidebar-open');
        return;
      }
      document.body.classList.toggle('abstract-sidebar-open', open);
    };

    const setEmptyMessage = message => {
      if (!emptyEl) return;
      emptyEl.textContent = message || defaultEmptyMessage;
    };

    const updateEmptyForSearch = () => {
      if (!emptyEl) return;
      if (viewMode !== 'search') {
        emptyEl.style.display = 'none';
        return;
      }
      const hasResults = searchResultsEl && searchResultsEl.querySelector('.pmid-card');
      if (hasResults || searchState.loading) {
        emptyEl.style.display = 'none';
        return;
      }
      setEmptyMessage(searchState.query ? 'No PubMed results. Try another search.' : defaultEmptyMessage);
      emptyEl.style.display = 'block';
    };

    const setViewMode = (mode, source = viewSource) => {
      viewMode = mode;
      viewSource = source || 'search';
      const searchEnabled = searchAllowed();
      const showSearchUi = searchEnabled && !(mode === 'abstract' && viewSource === 'inline');
      const isSearchAbstract = mode === 'abstract' && viewSource === 'search';
      if (contentEl) contentEl.style.display = mode === 'abstract' ? 'block' : 'none';
      if (searchResultsEl) searchResultsEl.style.display = mode === 'search' && searchEnabled ? 'flex' : 'none';
      const hasResults = searchResultsEl && searchResultsEl.children.length > 0;
      const showNewSearch = mode === 'search' && hasResults;
      if (backToResultsBtn) backToResultsBtn.style.display = mode === 'abstract' && showSearchUi ? 'inline-flex' : 'none';
      if (newSearchBtn) newSearchBtn.style.display = showNewSearch && searchEnabled ? 'inline-flex' : 'none';
      const fadeSearch = (mode === 'abstract' && showSearchUi) || showNewSearch;
      if (searchForm) searchForm.classList.toggle('is-faded', fadeSearch);
      const searchShell = sidebar ? $('#abstract-search-shell', sidebar) : null;
      if (searchShell) searchShell.style.display = showSearchUi ? 'block' : 'none';
      document.body.classList.toggle('abstract-from-search', isSearchAbstract);
      if (mode === 'abstract') {
        hideEmpty();
      } else {
        updateEmptyForSearch();
        animateSearchResults();
        refreshSearchCitedBadges();
      }
    };

    const applySearchAvailability = () => {
      const enabled = searchAllowed();
      if (searchInput) {
        searchInput.disabled = !enabled;
        searchInput.placeholder = enabled ? 'Search PubMed' : 'Search unavailable on mobile';
      }
      if (searchForm) {
        searchForm.style.display = enabled ? 'flex' : 'none';
      }
      if (!enabled) {
        searchResultsEl.innerHTML = '';
        setEmptyMessage('Search is unavailable on mobile.');
        updateEmptyForSearch();
        setViewMode('search', 'search');
      } else {
        setViewMode(viewMode, viewSource);
      }
    };

    const showEmpty = () => {
      setViewMode('search');
      updateEmptyForSearch();
      contentEl.innerHTML = '';
    };
    const resetSearch = () => {
      searchState.query = '';
      searchState.total = 0;
      searchState.start = 0;
      searchResultsEl.innerHTML = '';
      clearSearchLoading();
      setEmptyMessage(defaultEmptyMessage);
      updateEmptyForSearch();
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      setViewMode('search', 'search');
    };

    const animateContent = () => {
      const firstChild = contentEl && contentEl.firstElementChild;
      if (!firstChild) return;
      firstChild.classList.remove('is-visible');
      // Force reflow then animate
      // eslint-disable-next-line no-unused-expressions
      firstChild.offsetWidth;
      requestAnimationFrame(() => firstChild.classList.add('is-visible'));
    };

    const animateSearchResults = () => {
      if (!searchResultsEl) return;
      Array.from(searchResultsEl.children || []).forEach(child => {
        if (!(child instanceof HTMLElement)) return;
        child.classList.add('abstract-transition');
        child.classList.remove('is-visible');
        // eslint-disable-next-line no-unused-expressions
        child.offsetWidth;
        requestAnimationFrame(() => child.classList.add('is-visible'));
      });
    };

    const isPmidInText = pmid => {
      if (!pmid) return false;
      const formatted = quill?.root?.querySelector(`.ql-pmid[data-pmid="${pmid}"]`);
      if (formatted) return true;
      const text = (quill?.getText() || '').toString();
      const pattern = new RegExp(`(^|[^0-9])${pmid}([^0-9]|$)`);
      return pattern.test(text);
    };

    const refreshSearchCitedBadges = () => {
      if (!searchResultsEl) return;
      Array.from(searchResultsEl.querySelectorAll('.pmid-card')).forEach(card => {
        const badge = card.querySelector('.pmid-card-cited-badge');
        const pmid = card.dataset.pmid;
        const cited = pmid ? isPmidInText(pmid) : false;
        card.classList.toggle('pmid-card-is-cited', cited);
        if (badge) badge.style.display = cited ? 'inline-flex' : 'none';
      });
    };

    const findCitationBlock = (text, pos) => {
      const isAllowed = char => /[0-9,\s]/.test(char);
      let start = pos - 1;
      while (start >= 0 && isAllowed(text[start])) start--;
      start += 1;
      let end = pos;
      while (end < text.length && isAllowed(text[end])) end++;
      if (start >= end) return null;
      const segment = text.slice(start, end);
      const leading = segment.match(/^\s*/)?.[0]?.length || 0;
      const trailing = segment.match(/\s*$/)?.[0]?.length || 0;
      const trimmedStart = start + leading;
      const trimmedEnd = end - trailing;
      if (trimmedStart >= trimmedEnd) return null;
      const core = text.slice(trimmedStart, trimmedEnd);
      if (!/\d/.test(core)) return null;
      return { start: trimmedStart, end: trimmedEnd };
    };

    const insertCitation = pmid => {
      if (!quill) return;
      if (document.body.classList.contains('view-only-mode')) return;
      const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      const pos = selection.index;
      const text = quill.getText();
      const block = findCitationBlock(text, pos);
      let targetIndex = pos;
      if (block) {
        const inside = text.slice(block.start, block.end);
        const parts = inside.split(',').map(s => s.trim()).filter(Boolean);
        if (!parts.includes(String(pmid))) {
          parts.push(String(pmid));
        }
        const newBlockCore = parts.join(', ');
        const charBefore = block.start > 0 ? text[block.start - 1] : '';
        const charAfter = block.end < text.length ? text[block.end] : '';
        const prefix = charBefore && !/\s/.test(charBefore) ? ' ' : '';
        const suffix = charAfter && !/[\s.,;:!?]/.test(charAfter) ? ' ' : '';
        const newBlock = `${prefix}${newBlockCore}${suffix}`;
        quill.deleteText(block.start, (block.end - block.start), 'user');
        quill.insertText(block.start, newBlock, 'user');
        targetIndex = block.start + newBlock.length;
      } else {
        const charBefore = pos > 0 ? text[pos - 1] : '';
        const charAfter = pos < text.length ? text[pos] : '';
        const prefix = charBefore && !/\s/.test(charBefore) ? ' ' : '';
        const suffix = charAfter && !/[\s.,;:!?]/.test(charAfter) ? ' ' : '';
        const newBlock = `${prefix}${pmid}${suffix}`;
        quill.insertText(pos, newBlock, 'user');
        targetIndex = pos + newBlock.length;
      }
      quill.setSelection(targetIndex, 0, 'user');
      quill.focus();
    };

    const hideEmpty = () => {
      emptyEl.style.display = 'none';
    };

    const renderLoading = pmid => {
      setViewMode('abstract');
      hideEmpty();
      contentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-3 text-gray-600 dark:text-gray-300 py-6 abstract-transition">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs uppercase tracking-[0.2em]">Loading PMID ${pmid}</span>
        </div>
      `;
      animateContent();
    };

    const renderError = () => {
      setViewMode('abstract');
      hideEmpty();
      contentEl.innerHTML = '<div class="text-center text-sm text-red-500 py-4 abstract-transition">Unable to load abstract.</div>';
      animateContent();
    };

    const renderMetadata = (pmid, metadata) => {
      setViewMode('abstract', viewSource);
      hideEmpty();
      const journalLabel = metadata?.journalAbbrev || metadata?.journalTitle || '—';
      const yearLabel = metadata?.year || '—';
      const titleLabel = metadata?.title || 'Title unavailable';
      const typeLabel = metadata?.typeShort || metadata?.typeFull || 'Article';
      const abstractMarkup = metadata?.abstractHtml
        ? `<div class="abstract-sidebar-abstract nice-scroll">${metadata.abstractHtml}</div>`
        : '<div class="abstract-sidebar-abstract text-gray-600 dark:text-gray-300">No abstract available.</div>';
      const inText = isPmidInText(pmid);
      const isViewOnly = document.body.classList.contains('view-only-mode');
      const showCite = !isViewOnly && (viewSource === 'search' || !inText);
      const citeLabel = inText && viewSource === 'search' ? 'CITED' : 'Cite';
      const citeClass = inText && viewSource === 'search' ? ' abstract-sidebar-cite-btn is-cited' : ' abstract-sidebar-cite-btn';
      const citeButton = showCite
        ? `<button type="button" class="${citeClass.trim()}" aria-label="Cite this abstract">${citeLabel}</button>`
        : '';

      contentEl.innerHTML = `
        <div class="abstract-sidebar-card abstract-transition">
          <div class="abstract-sidebar-meta-top">
            <div class="abstract-sidebar-meta-left">
              <a class="abstract-sidebar-pmid hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="${CONFIG.pubmedBaseUrl}${pmid}/" target="_blank" rel="noopener noreferrer">PMID ${pmid}</a>
              <span class="abstract-sidebar-year">${yearLabel}</span>
            </div>
            ${citeButton}
          </div>
          <div class="abstract-sidebar-title-text">${titleLabel}</div>
          ${abstractMarkup}
          <div class="abstract-sidebar-bottom">
            <span class="abstract-sidebar-journal" title="${journalLabel}">${journalLabel}</span>
            <span class="abstract-sidebar-type" title="${metadata?.typeFull || typeLabel}">${typeLabel}</span>
          </div>
        </div>
      `;
      const citeBtnEl = contentEl.querySelector('.abstract-sidebar-cite-btn');
      if (citeBtnEl) {
        citeBtnEl.addEventListener('click', event => {
          event.preventDefault();
          insertCitation(pmid);
          refreshSearchCitedBadges();
          citeBtnEl.textContent = 'CITED';
          citeBtnEl.classList.add('is-cited');
          setTimeout(refreshSearchCitedBadges, 0);
        });
      }
      animateContent();
    };

    const hide = (force = false) => {
      if (!force && !isMobile()) return;
      currentPmid = null;
      requestId += 1;
      setOpen(false);
      showEmpty();
    };

    const canOpenSidebar = (force = false) => {
      if (force) return true;
      if (isMobile()) return true;
      // Allow opening on desktop even if the citations panel is collapsed.
      return true;
    };

    const show = async (pmid, { source = 'inline', forceOpen = false } = {}) => {
      if (!pmid || !abstractSidebarEnabled() || !canOpenSidebar(forceOpen)) {
        hide(true);
        return;
      }
      viewSource = source || 'inline';
      currentPmid = pmid;
      const myRequest = ++requestId;
      setOpen(true);
      scrollSidebarToTop();
      state.hideInlinePopup();
      renderLoading(pmid);
      try {
        const metadata = await fetchPmidMetadata(pmid);
        if (myRequest !== requestId || currentPmid !== pmid) return;
        renderMetadata(pmid, metadata || { pmid });
      } catch (error) {
        if (myRequest !== requestId || currentPmid !== pmid) return;
        renderError();
      }
    };

    const openEmpty = ({ preserveActive = false } = {}) => {
      if (!abstractSidebarEnabled() || !canOpenSidebar()) return;
      if (!preserveActive) {
        currentPmid = null;
        requestId += 1;
      }
      setOpen(true);
      if (!preserveActive) {
        showEmpty();
      }
    };

    const setSearchCardIndex = (card, index = 1) => {
      if (!card) return;
      const target = card.querySelector('.pmid-card-index');
      if (target) target.textContent = index;
    };

    const hydrateSearchCard = (card, metadata) => {
      if (!card || !metadata) return;
      const pmid = metadata.pmid;
      card.dataset.labelBase = `PMID ${pmid}`;
      const pmidLabel = card.querySelector('.pmid-card-pmid-link');
      const yearEl = card.querySelector('.pmid-card-year');
      const titleEl = card.querySelector('.pmid-card-title');
      const journalEl = card.querySelector('.pmid-card-journal');
      const typeEl = card.querySelector('.pmid-card-type');
      if (pmidLabel) {
        pmidLabel.textContent = `PMID ${pmid}`;
      }
      if (yearEl) {
        yearEl.textContent = metadata.year || '—';
        yearEl.classList.remove('pmid-card-loading');
      }
      if (titleEl) {
        titleEl.textContent = metadata.title || 'Citation unavailable';
        titleEl.classList.remove('pmid-card-loading');
      }
      if (journalEl) {
        journalEl.textContent = metadata.journalAbbrev || metadata.journalTitle || '—';
        journalEl.classList.remove('pmid-card-loading');
      }
      if (typeEl) {
        typeEl.textContent = metadata.typeShort || metadata.typeFull || 'Article';
        typeEl.classList.remove('pmid-card-loading');
      }
      refreshSearchCitedBadges();
    };

    const buildSearchResultCard = (pmid, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pmid-card abstract-search-card';
      card.classList.add('abstract-transition');
      card.dataset.pmid = pmid;
      card.dataset.labelBase = `PMID ${pmid} search result`;
      card.innerHTML = `
        <span class="pmid-card-index" aria-hidden="true"></span>
        <span class="pmid-card-cited-badge" aria-hidden="true">CITED</span>
        <span class="pmid-card-count" aria-hidden="true"></span>
        <div class="pmid-card-body">
          <div class="pmid-card-meta">
            <span class="pmid-card-pmid-link" title="Open on PubMed">PMID ${pmid}</span>
            <span class="pmid-card-year pmid-card-loading">•••</span>
          </div>
          <div class="pmid-card-title pmid-card-loading">Fetching citation…</div>
          <div class="pmid-card-row">
            <div class="pmid-card-journal pmid-card-loading">Loading journal…</div>
            <div class="pmid-card-type pmid-card-loading" aria-label="Article type">—</div>
          </div>
        </div>
      `;
      setSearchCardIndex(card, index);
      card.addEventListener('click', () => {
        if (!pmid) return;
        show(pmid, { source: 'search', forceOpen: true });
      });
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        show(pmid, { source: 'search', forceOpen: true });
      });
      fetchPmidMetadata(pmid)
        .then(metadata => hydrateSearchCard(card, metadata))
        .catch(() => {
          const titleEl = card.querySelector('.pmid-card-title');
          if (titleEl) titleEl.textContent = 'Unable to load citation.';
        });
      return card;
    };

    const clearSearchLoading = () => {
      if (searchLoadingEl && searchLoadingEl.parentNode) {
        searchLoadingEl.remove();
      }
      searchLoadingEl = null;
    };

    const showSearchLoading = () => {
      if (!searchResultsEl) return;
      if (!searchLoadingEl) {
        searchLoadingEl = document.createElement('div');
        searchLoadingEl.className = 'abstract-search-loading';
        searchLoadingEl.innerHTML = `
          <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs uppercase tracking-[0.2em]">Loading results</span>
        `;
      }
      if (!searchLoadingEl.parentNode) {
        searchResultsEl.appendChild(searchLoadingEl);
      }
    };

    const searchPubmed = async ({ append = false } = {}) => {
      if (!searchAllowed()) {
        setEmptyMessage('Search is unavailable on mobile.');
        updateEmptyForSearch();
        setViewMode('search', 'search');
        return;
      }
      // When the user searches on desktop, make sure the sidebar is opened.
      setOpen(true);
      const query = (searchInput.value || '').trim();
      if (!query) {
        searchState.query = '';
        searchState.total = 0;
        searchState.start = 0;
        searchResultsEl.innerHTML = '';
        setEmptyMessage(defaultEmptyMessage);
        updateEmptyForSearch();
        setViewMode('search', 'search');
        return;
      }
      if (searchState.loading) return;
      const myRequest = ++searchRequestId;
      const start = append ? searchState.start : 0;
      if (!append) {
        searchResultsEl.innerHTML = '';
        searchState.start = 0;
        searchState.total = 0;
      }
      searchState.loading = true;
      setViewMode('search');
      showSearchLoading();
      try {
        const url = `${CONFIG.pubmedSearchUrl}?db=pubmed&retmode=json&sort=relevance&retmax=${SEARCH_PAGE_SIZE}&retstart=${start}&term=${encodeURIComponent(query)}`;
        const text = await fetchWithRetry(url);
        const payload = JSON.parse(text);
        if (myRequest !== searchRequestId) return;
        const ids = (payload?.esearchresult?.idlist || []).filter(Boolean);
        const total = Number(payload?.esearchresult?.count || 0);
        searchState.query = query;
        searchState.total = total;
        const nextStart = start + ids.length;
        searchState.start = ids.length ? nextStart : total;
        searchState.loading = false;
        clearSearchLoading();
        if (!ids.length && (!append || !searchResultsEl.children.length)) {
          updateEmptyForSearch();
          setViewMode('search', 'search');
          return;
        }
        ids.forEach((pmid, index) => {
          const cardIndex = start + index + 1;
          const card = buildSearchResultCard(pmid, cardIndex);
          searchResultsEl.appendChild(card);
          animateSearchResults();
        });
        updateEmptyForSearch();
        refreshSearchCitedBadges();
        setViewMode('search', 'search');
      } catch (error) {
        if (myRequest !== searchRequestId) return;
        searchState.loading = false;
        clearSearchLoading();
        setEmptyMessage('Unable to search PubMed right now.');
        updateEmptyForSearch();
      }
    };

    const maybeLoadMore = () => {
      if (viewMode !== 'search') return;
      if (searchState.loading) return;
      if (!searchState.query) return;
      const nearBottom = sidebar.scrollHeight - sidebar.scrollTop - sidebar.clientHeight < 220;
      const hasMore = searchState.start < searchState.total;
      if (nearBottom && hasMore) {
        searchPubmed({ append: true });
      }
    };

    searchForm.addEventListener('submit', event => {
      event.preventDefault();
      searchPubmed({ append: false });
    });

    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchPubmed({ append: false });
      }
    });

    if (backToResultsBtn) {
      backToResultsBtn.addEventListener('click', () => {
        setViewMode('search', 'search');
        scrollSidebarToTop();
      });
    }
    if (newSearchBtn) {
      newSearchBtn.addEventListener('click', event => {
        event.preventDefault();
        resetSearch();
      });
    }

    sidebar.addEventListener('scroll', () => {
      maybeLoadMore();
    }, { passive: true });

    setViewMode('search');
    const handleMobileChange = () => applySearchAvailability();
    onMobileChange(handleMobileChange);
    applySearchAvailability();

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hide(true);
        state.forceClearActive();
        quill?.focus?.();
      });
    }

    return {
      show,
      hide,
      openEmpty,
      isActive: pmid => !!pmid && pmid === currentPmid,
      isEnabled: abstractSidebarEnabled,
      getActive: () => currentPmid
    };
  };


  const initPmidSidebar = quill => {
    const sidebar = $('#pmid-sidebar');
    const listEl = sidebar ? $('#pmid-card-list', sidebar) : null;
    const countEl = sidebar ? $('#pmid-sidebar-count', sidebar) : null;
    const emptyState = sidebar ? $('#pmid-sidebar-empty', sidebar) : null;
    if (!sidebar || !listEl || !countEl || !emptyState) return;

    let activePmid = null;
    let activeCard = null;
    let activeLock = null; // Keeps highlight locked after a click
    const cardMap = new Map();
    const mentionCycleIndex = new Map();

    const formatAriaLabel = (card, baseLabel) => {
      if (!card || !baseLabel) return;
      const mentions = Math.max(1, Number(card.dataset.mentions || '1'));
      const mentionText = mentions > 1 ? ` · ${mentions} mentions` : '';
      card.setAttribute('aria-label', `${baseLabel}${mentionText}`);
    };

    const setCardIndex = (card, index = 1) => {
      if (!card) return;
      const value = Math.max(1, Number(index) || 1);
      card.dataset.index = String(value);
      const indexBadge = card.querySelector('.pmid-card-index');
      if (indexBadge) {
        indexBadge.textContent = value;
      }
    };

    const setCardStack = (card, occurrences = 1) => {
      if (!card) return;
      const mentions = Math.max(1, occurrences || 1);
      const visibleLayers = Math.min(4, mentions) - 1;
      card.dataset.mentions = String(mentions);

      const countBadge = card.querySelector('.pmid-card-count');
      if (countBadge) {
        if (mentions > 1) {
          countBadge.textContent = mentions > 99 ? '99+' : String(mentions);
          countBadge.classList.add('is-visible');
        } else {
          countBadge.textContent = '';
          countBadge.classList.remove('is-visible');
        }
      }

      const layersContainer = card.querySelector('.pmid-card-layers');
      if (!layersContainer) {
        if (card.dataset.labelBase) formatAriaLabel(card, card.dataset.labelBase);
        return;
      }
      layersContainer.textContent = '';
      for (let i = 1; i <= visibleLayers; i++) {
        const layer = document.createElement('div');
        layer.className = `pmid-card-layer layer-${i}`;
        layersContainer.appendChild(layer);
      }
      if (card.dataset.labelBase) formatAriaLabel(card, card.dataset.labelBase);
    };

    const computeMentionOffsets = pmid => {
      if (!pmid) return [];
      const nodes = Array.from(quill.root.querySelectorAll(`.ql-pmid[data-pmid="${pmid}"]`));
      if (!nodes.length) return [];
      let scroller = quill.scrollingContainer || quill.root.parentElement || document.documentElement;
      const docEl = document.documentElement;
      const body = document.body;
      let scrollerRect = { top: 0 };
      try {
        scrollerRect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0 };
      } catch (_) {}
      const scrollTop = (scroller === docEl || scroller === body)
        ? (window.scrollY ?? window.pageYOffset ?? docEl.scrollTop ?? body?.scrollTop ?? 0)
        : (scroller.scrollTop || 0);
      const contentHeight = Math.max(1, scroller.scrollHeight || docEl.scrollHeight || body?.scrollHeight || 1);
      return nodes.map(node => {
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        const top = rect ? (rect.top - scrollerRect.top) + scrollTop : (node.offsetTop || 0);
        const ratio = Math.min(1, Math.max(0, top / contentHeight));
        return ratio;
      });
    };

    const renderMentionMap = (card, pmid) => {
      if (!card) return;
      const map = card.querySelector('.pmid-card-mention-map');
      if (!map) return;
      const offsets = computeMentionOffsets(pmid);
      map.innerHTML = '';
      if (!offsets.length) {
        map.classList.add('pmid-card-mention-map-empty');
        return;
      }
      map.classList.remove('pmid-card-mention-map-empty');
      offsets.forEach((offset, idx) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'pmid-card-mention-dot';
        const clamped = Math.max(2, Math.min(98, (offset || 0) * 100));
        dot.style.left = `${clamped}%`;
        dot.title = `Jump to mention ${idx + 1}`;
        dot.setAttribute('aria-label', `Jump to mention ${idx + 1}`);
        dot.addEventListener('click', event => {
          event.preventDefault();
          setActive(pmid, card, { lock: true, scroll: false });
          state.abstractSidebarApi.show(pmid, { source: 'inline', forceOpen: true });
          scrollInlineIntoView(pmid, { targetIndex: idx, duration: CONFIG.scrollDuration });
        });
        map.appendChild(dot);
      });
    };

    const toggleInlineHighlight = (pmid, active) => {
      if (!pmid) return;
      document.querySelectorAll(`.ql-pmid[data-pmid="${pmid}"]`).forEach(node => {
        node.classList.toggle('pmid-inline-highlight', active);
      });
    };

    const scrollCardIntoView = card => {
      if (!sidebar || !card) return;
      const sidebarRect = sidebar.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.top - sidebarRect.top;
      const target = sidebar.scrollTop + offset - 16;
      animateScrollTo(sidebar, Math.max(0, target), { isDocument: false, duration: CONFIG.scrollDuration });
    };

    const setActive = (pmid, card, { lock = false, scroll = true } = {}) => {
      if (lock) activeLock = pmid || null;
      if (activeLock && !lock && pmid && pmid !== activeLock) return;
      if (activePmid === pmid && activeCard === card) return;
      if (activePmid) toggleInlineHighlight(activePmid, false);
      if (activeCard) activeCard.classList.remove('is-hovered');
      const previousPmid = activePmid;
      activePmid = pmid || null;
      activeCard = card || null;
      if (!pmid) activeLock = null;
      state.lastHighlightedPmid = activePmid;
      if (activePmid && previousPmid !== activePmid) {
        mentionCycleIndex.set(activePmid, -1);
      }
      if (activePmid && activeCard) {
        toggleInlineHighlight(activePmid, true);
        activeCard.classList.add('is-hovered');
        if (scroll) {
          scrollCardIntoView(activeCard);
        }
      }
    };

    const clearActive = (force = false, { hideAbstract = true, keepClosed = false } = {}) => {
      if (activeLock && !force) return;
      activeLock = null;
      setActive(null, null);
      if (force) {
        if (hideAbstract) {
          state.abstractSidebarApi.hide(true);
        } else {
          const abstractIsOpen = document.body.classList.contains('abstract-sidebar-open');
          if (abstractIsOpen || !keepClosed) {
            state.abstractSidebarApi.openEmpty({ preserveActive: false });
          }
        }
        state.hideInlinePopup();
      }
    };
    state.forceClearActive = () => clearActive(true);

    const scrollInlineIntoView = (pmid, options = {}) => {
      if (!pmid) return;
      const { cycle = false, duration = CONFIG.scrollDuration, easing = easeOutCubic, targetIndex = null } = options;
      const mentions = Array.from(quill.root.querySelectorAll(`.ql-pmid[data-pmid="${pmid}"]`));
      if (!mentions.length) return;

      let index = mentionCycleIndex.get(pmid);
      if (!Number.isInteger(index)) index = -1;
      if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < mentions.length) {
        index = targetIndex;
      } else if (cycle) {
        index = (index + 1) % mentions.length;
      } else if (index < 0 || index >= mentions.length) {
        index = 0;
      }
      mentionCycleIndex.set(pmid, index);

      const target = mentions[index];
      if (!target) return;

      // Choose the correct scroller. Fall back to the document if the editor container is not scrollable.
      let scroller = quill.scrollingContainer || document.documentElement;
      const docEl = document.documentElement;
      const body = document.body;
      let isDocument = (scroller === docEl || scroller === body);

      if (!isDocument) {
        const canScroll = (scroller.scrollHeight - scroller.clientHeight) > 1;
        if (!canScroll) {
          scroller = docEl;
          isDocument = true;
        }
      }

      const scrollerRect = !isDocument && scroller.getBoundingClientRect
        ? scroller.getBoundingClientRect()
        : { top: 0, height: window.innerHeight || docEl.clientHeight || 0 };

      const targetRect = target.getBoundingClientRect();

      const currentScrollTop = isDocument
        ? (window.scrollY ?? window.pageYOffset ?? docEl.scrollTop ?? 0)
        : (scroller.scrollTop || 0);

      const topbar = document.getElementById('topbar');
      const cssTopbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 0;
      const topbarHeight = (topbar?.offsetHeight || cssTopbar || 0);

      const viewportHeight = isDocument
        ? (window.innerHeight || docEl.clientHeight || 0)
        : (scroller.clientHeight || scrollerRect.height || 0);
      if (!viewportHeight) return;

      const targetHeight = targetRect.height || target.offsetHeight || 0;
      const sidebar = document.getElementById('pmid-sidebar');
      const isMobileSidebarOpen = document.body.classList.contains('pmid-sidebar-mobile-open') && isMobile();
      const reservedHeight = (isDocument && isMobileSidebarOpen && sidebar)
        ? Math.min(viewportHeight * 0.6, Math.max(sidebar.getBoundingClientRect()?.height || 0, viewportHeight * 0.4))
        : 0;

      const visibleViewportHeight = isDocument
        ? Math.max(0, viewportHeight - topbarHeight - reservedHeight)
        : viewportHeight;

      const centerOffset = isDocument ? (topbarHeight + (visibleViewportHeight / 2)) : (viewportHeight / 2);
      const targetCenterOffset = (targetRect.top - scrollerRect.top) + (targetHeight / 2);

      let destination = currentScrollTop + targetCenterOffset - centerOffset;
      if (!Number.isFinite(destination)) return;

      const maxScroll = isDocument
        ? Math.max(0, Math.max(docEl.scrollHeight || 0, body?.scrollHeight || 0) - viewportHeight)
        : Math.max(0, (scroller.scrollHeight || 0) - viewportHeight);

      destination = Math.min(Math.max(0, destination), maxScroll);

      animateScrollTo(isDocument ? document.documentElement : scroller, destination, { isDocument, duration, easing });
      quill.focus();
    };

    const bindInteractions = card => {
      const pmidLink = card.querySelector('.pmid-card-pmid-link');
      if (pmidLink) {
        pmidLink.addEventListener('click', event => {
          event.stopPropagation();
          event.preventDefault();
          openPubmed(card.dataset.pmid);
        });
      }
      card.addEventListener('click', event => {
        const clickedPmidLink = event.target instanceof Element && event.target.closest('.pmid-card-pmid-link');
        if (clickedPmidLink) return;
        event.preventDefault();
        const pmid = card.dataset.pmid;
        if (!pmid) return;
        setActive(pmid, card, { lock: true, scroll: false });
        state.abstractSidebarApi.show(pmid, { source: 'inline', forceOpen: true });
        scrollInlineIntoView(pmid, { cycle: true, duration: CONFIG.scrollDuration });
      });
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const pmid = card.dataset.pmid;
        if (!pmid) return;
        setActive(pmid, card, { lock: true, scroll: false });
        state.abstractSidebarApi.show(pmid, { source: 'inline', forceOpen: true });
        scrollInlineIntoView(pmid, { cycle: true, duration: CONFIG.scrollDuration });
      });
    };

    // Allow clicking inline PMID tokens to cycle through mentions with smooth ease-out
    quill.root.addEventListener('click', event => {
      const token = event.target && event.target.closest('.ql-pmid');
      const selection = window.getSelection && window.getSelection();
      const hasExpandedSelection = selection && selection.rangeCount && !selection.getRangeAt(0).collapsed;
      if (!token) {
        if (!hasExpandedSelection && activePmid) {
          const mobile = isMobile();
          clearActive(true, { hideAbstract: mobile, keepClosed: true });
          if (mobile) state.abstractSidebarApi.hide(true);
        }
        return;
      }

      // Do not hijack true text selections
      if (hasExpandedSelection) return;

      event.preventDefault();
      const pmid = token.getAttribute('data-pmid');
      if (!pmid) return;

      const currentIndex = mentionCycleIndex.get(pmid);
      const isSameAsActive = activePmid === pmid;
      const isFirstClick = !isSameAsActive || !Number.isInteger(currentIndex) || currentIndex < 0;
      const card = cardMap.get(pmid);
      if (card) setActive(pmid, card, { lock: true });
      state.abstractSidebarApi.show(pmid, { source: 'inline', forceOpen: true });
      if (isFirstClick) {
        mentionCycleIndex.set(pmid, 0);
        return;
      }
      scrollInlineIntoView(pmid, { cycle: true, duration: CONFIG.scrollDuration });
    });

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (document.body.classList.contains('abstract-from-search')) {
        state.hideInlinePopup();
        return;
      }
      const insideSidebar = target.closest('#pmid-sidebar');
      const insideAbstractSidebar = target.closest('#abstract-sidebar');
      const inlinePmid = target.closest('.ql-pmid');
      const toggleBtn = target.closest('#toggle-sidebar');
      const toggleAbstractBtn = target.closest('#toggle-abstract');
      if (insideSidebar || insideAbstractSidebar || inlinePmid || toggleBtn || toggleAbstractBtn) return;
      const mobile = isMobile();
      clearActive(true, { hideAbstract: mobile, keepClosed: true });
      if (mobile) {
        state.abstractSidebarApi.hide(true);
      }
      state.hideInlinePopup();
    });

    const buildCard = pmid => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pmid-card';
      card.dataset.pmid = pmid;
      card.dataset.labelBase = `PMID ${pmid} (loading)`;
      card.innerHTML = `
        <span class="pmid-card-index" aria-hidden="true"></span>
        <div class="pmid-card-layers" aria-hidden="true"></div>
        <span class="pmid-card-count" aria-hidden="true"></span>
        <div class="pmid-card-body">
          <div class="pmid-card-meta">
            <span class="pmid-card-pmid-link" title="Open on PubMed">PMID ${pmid}</span>
            <span class="pmid-card-year pmid-card-loading">•••</span>
          </div>
          <div class="pmid-card-title pmid-card-loading">Fetching citation…</div>
          <div class="pmid-card-row">
            <div class="pmid-card-journal pmid-card-loading">Loading journal…</div>
            <div class="pmid-card-type pmid-card-loading" aria-label="Article type">—</div>
          </div>
          <div class="pmid-card-mention-map" role="group" aria-label="Jump to a specific mention"></div>
        </div>
      `;
      setCardStack(card, 1);
      bindInteractions(card);
      return card;
    };

    const applyMetadata = (card, metadata) => {
      if (!card || !metadata) return;
      const pmidLabel = metadata.pmid || card.dataset.pmid || '';
      card.dataset.labelBase = `PMID ${pmidLabel} · ${metadata.title || 'Citation'}`;
      formatAriaLabel(card, card.dataset.labelBase);
      const yearEl = card.querySelector('.pmid-card-year');
      if (yearEl) {
        yearEl.textContent = metadata.year || '—';
        yearEl.classList.remove('pmid-card-loading', 'pmid-card-error');
      }
      const titleEl = card.querySelector('.pmid-card-title');
      if (titleEl) {
        titleEl.textContent = metadata.title || 'Title unavailable';
        titleEl.classList.remove('pmid-card-loading', 'pmid-card-error');
      }
      const journalEl = card.querySelector('.pmid-card-journal');
      if (journalEl) {
        journalEl.textContent = metadata.journalAbbrev || metadata.journalTitle || 'Journal unavailable';
        journalEl.classList.remove('pmid-card-loading', 'pmid-card-error');
      }
      const typeEl = card.querySelector('.pmid-card-type');
      if (typeEl) {
        const full = metadata.typeFull || '';
        const short = metadata.typeShort || '';
        // Try full first, then downgrade to short if the row overflows
        typeEl.textContent = full || short || '';
        typeEl.title = full || '';
        typeEl.classList.remove('pmid-card-loading', 'pmid-card-error');
        const row = card.querySelector('.pmid-card-row');
        const needsAbbrev = () => row && (row.scrollWidth - 1) > row.clientWidth;
        requestAnimationFrame(() => {
          if (needsAbbrev()) {
            typeEl.textContent = short || full || '';
          }
        });
      }
    };

    const applyError = card => {
      if (!card) return;
      card.dataset.labelBase = `PMID ${card.dataset.pmid || ''} unavailable`;
      formatAriaLabel(card, card.dataset.labelBase);
      const yearEl = card.querySelector('.pmid-card-year');
      if (yearEl) {
        yearEl.textContent = '—';
        yearEl.classList.remove('pmid-card-loading');
      }
      const titleEl = card.querySelector('.pmid-card-title');
      if (titleEl) {
        titleEl.textContent = 'Unable to load citation';
        titleEl.classList.remove('pmid-card-loading');
        titleEl.classList.add('pmid-card-error');
      }
      const journalEl = card.querySelector('.pmid-card-journal');
      if (journalEl) {
        journalEl.textContent = 'Try again later.';
        journalEl.classList.remove('pmid-card-loading');
        journalEl.classList.add('pmid-card-error');
      }
      const typeEl = card.querySelector('.pmid-card-type');
      if (typeEl) {
        typeEl.textContent = '—';
        typeEl.classList.remove('pmid-card-loading');
        typeEl.classList.add('pmid-card-error');
      }
    };

    const updateSidebar = debounce(() => {
      const text = quill.getText();
      const mentionsMap = countPMIDMentions(text);
      const pmids = extractUniquePMIDs(text);
      countEl.textContent = String(pmids.length);
      emptyState.style.display = pmids.length ? 'none' : 'block';
      sidebar.classList.toggle('has-items', pmids.length > 0);

      if (!pmids.length) {
        clearActive(true, { hideAbstract: false });
        if (isPmidSidebarOpen() && state.abstractPanelEnabled) {
          keepAbstractAlignedWithPmid({ preserveActive: false });
        } else {
          state.abstractSidebarApi.hide(true);
        }
        state.hideInlinePopup();
        cardMap.forEach(card => {
          if (card.parentElement === listEl) listEl.removeChild(card);
        });
        cardMap.clear();
        mentionCycleIndex.clear();
        return;
      }

      const remaining = new Set(cardMap.keys());
      pmids.forEach((pmid, index) => {
        remaining.delete(pmid);
        if (!cardMap.has(pmid)) {
          const card = buildCard(pmid);
          cardMap.set(pmid, card);
          fetchPmidMetadata(pmid)
            .then(metadata => applyMetadata(card, metadata))
            .catch(() => applyError(card));
        }
          const card = cardMap.get(pmid);
          if (card) {
            setCardIndex(card, index + 1);
            const mentions = mentionsMap.get(pmid) || 1;
            setCardStack(card, mentions);
            listEl.appendChild(card);
            renderMentionMap(card, pmid);
          }
        });

      remaining.forEach(pmid => {
        const card = cardMap.get(pmid);
        if (card && card.parentElement === listEl) listEl.removeChild(card);
        cardMap.delete(pmid);
        mentionCycleIndex.delete(pmid);
      });

      if (activePmid && !cardMap.has(activePmid)) {
        clearActive(true, { hideAbstract: false });
        if (isPmidSidebarOpen() && state.abstractPanelEnabled) {
          keepAbstractAlignedWithPmid({ preserveActive: false });
        } else {
          state.abstractSidebarApi.hide(true);
        }
      }
    }, CONFIG.sidebarUpdateDebounce);

    updateSidebar();
    quill.on('text-change', updateSidebar);
  };


  return {
    isPmidSidebarOpen,
    keepAbstractAlignedWithPmid,
    readAbstractPanelEnabled,
    setAbstractPanelEnabled,
    syncAbstractToggleButton,
    initSidebarToggle,
    initAbstractPanelToggle,
    initAbstractSidebar,
    initPmidSidebar
  };
};

export { createSidebars };
