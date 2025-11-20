import { $, debounce } from './utils.js';
import { CONFIG, STORAGE_KEYS, isMobile } from './config.js';
import { fetchPmidMetadata } from './pmid.js';

const initPersistence = quill => {
  let canPersist = true;
  const save = debounce(() => {
    if (!canPersist) return;
    try {
      const delta = quill.getContents();
      localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(delta));
    } catch (error) {
      canPersist = false;
      console.warn('Unable to persist editor state', error);
    }
  }, CONFIG.saveDebounce);
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.content);
  } catch (error) {
    canPersist = false;
    console.warn('Unable to access stored editor state', error);
  }
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        quill.setContents(parsed);
      }
    } catch (error) {
      console.warn('Stored editor state is invalid; clearing it', error);
      try {
        localStorage.removeItem(STORAGE_KEYS.content);
      } catch (_) {}
    }
  }
  quill.on('text-change', save);
};

const initPopup = (quill, topbarEl, state) => {
  const popup = $('#popup');
  if (!popup) return;
  let hideId = null;
  let anchor = null;
  const clearHideTimer = () => {
    if (hideId) {
      clearTimeout(hideId);
      hideId = null;
    }
  };
  const scheduleHide = (delay = 200) => {
    clearHideTimer();
    hideId = setTimeout(() => {
      hideId = null;
      hidePopup();
    }, delay);
  };
  const adjustAbstractHeight = () => {
    const abstractEl = popup.querySelector('.abstract-box');
    const headerEl = popup.querySelector('[data-popup-header]');
    if (!abstractEl) return;
    requestAnimationFrame(() => {
      const computedMax = Number(popup.dataset.maxHeight) || popup.getBoundingClientRect().height || 0;
      if (!computedMax) return;
      const styles = getComputedStyle(popup);
      const paddingTop = parseFloat(styles.paddingTop || '0');
      const paddingBottom = parseFloat(styles.paddingBottom || '0');
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const available = computedMax - headerHeight - paddingTop - paddingBottom - 8;
      if (available > 60) {
        abstractEl.style.maxHeight = `${Math.floor(available)}px`;
      } else {
        abstractEl.style.maxHeight = '';
      }
    });
  };
  const placePopup = rect => {
    if (!rect) return;
    const vw = innerWidth;
    const vh = innerHeight;
    const pad = CONFIG.popupPad;
    const topbarBottom = topbarEl ? Math.max(0, topbarEl.getBoundingClientRect().bottom) : 0;
    const width = Math.min(CONFIG.popupMaxWidth, vw * 0.92);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(pad, Math.min(left, vw - width - pad));
    const topSafety = topbarBottom + pad;
    if (rect.bottom <= topSafety) return hidePopup();
    const bottomLimit = vh - pad;
    if (rect.top >= bottomLimit) return hidePopup();
    const maxHeightLimit = Math.min(CONFIG.popupMaxWidth, Math.max(0, bottomLimit - topSafety));
    const spaceBelow = Math.max(0, bottomLimit - (rect.bottom + pad));
    const spaceAbove = Math.max(0, (rect.top - pad) - topSafety);
    const order = spaceBelow >= spaceAbove ? ['below', 'above'] : ['above', 'below'];
    const attempt = direction => {
      if (direction === 'below') {
        const topCandidate = Math.max(topSafety, rect.bottom + pad);
        const available = bottomLimit - topCandidate;
        if (available <= 0) return null;
        const limit = maxHeightLimit > 0 ? maxHeightLimit : available;
        const maxHeight = Math.min(limit, available);
        if (maxHeight <= 0) return null;
        return { orientation: 'below', top: topCandidate, maxHeight };
      }
      const bottomEdge = rect.top - pad;
      const available = bottomEdge - topSafety;
      if (available <= 0) return null;
      const limit = maxHeightLimit > 0 ? maxHeightLimit : available;
      let maxHeight = Math.min(limit, available);
      if (maxHeight <= 0) return null;
      let topCandidate = bottomEdge - maxHeight;
      if (topCandidate < topSafety) {
        const overshoot = topSafety - topCandidate;
        topCandidate = topSafety;
        if (overshoot >= maxHeight) return null;
        maxHeight -= overshoot;
      }
      let bottomCandidate = rect.top - pad;
      if (bottomCandidate > bottomLimit) {
        bottomCandidate = bottomLimit;
      }
      maxHeight = Math.min(maxHeight, bottomCandidate - topCandidate);
      if (maxHeight <= 0) return null;
      return { orientation: 'above', top: bottomCandidate - maxHeight, maxHeight, bottom: bottomCandidate };
    };
    let placement = null;
    for (const direction of order) {
      placement = attempt(direction);
      if (placement) break;
    }
    if (!placement) {
      if (order[0] === 'above') {
        let bottomCandidate = rect.top - pad;
        if (!Number.isFinite(bottomCandidate)) bottomCandidate = bottomLimit;
        bottomCandidate = Math.min(bottomCandidate, bottomLimit);
        const available = Math.max(0, bottomCandidate - topSafety);
        let maxHeight = maxHeightLimit > 0 ? Math.min(maxHeightLimit, available) : available;
        if (maxHeight <= 0) maxHeight = Math.max(0, bottomLimit - topSafety);
        let topCandidate = Math.max(topSafety, bottomCandidate - maxHeight);
        if (topCandidate > bottomCandidate) topCandidate = bottomCandidate;
        const height = Math.max(0, bottomCandidate - topCandidate);
        placement = { orientation: 'above', top: topCandidate, maxHeight: height, bottom: bottomCandidate };
      } else {
        const fallbackTop = Math.max(topSafety, Math.min(rect.bottom + pad, bottomLimit));
        const fallbackHeight = Math.max(0, bottomLimit - fallbackTop);
        placement = { orientation: 'below', top: fallbackTop, maxHeight: fallbackHeight };
      }
    }
    const maxHeightValue = Math.max(0, placement.maxHeight);
    if (maxHeightValue <= 0) return hidePopup();
    popup.style.left = `${left}px`;
    if (placement.orientation === 'above') {
      const bottomTarget = placement.bottom != null ? placement.bottom : rect.top - pad;
      let bottomOffset = vh - bottomTarget;
      if (!Number.isFinite(bottomOffset)) bottomOffset = pad;
      bottomOffset = Math.max(pad, Math.min(bottomOffset, vh - topSafety));
      popup.style.top = 'auto';
      popup.style.bottom = `${Math.round(bottomOffset)}px`;
    } else {
      popup.style.top = `${Math.round(placement.top)}px`;
      popup.style.bottom = 'auto';
    }
    popup.style.width = `${width}px`;
    popup.style.maxHeight = `${Math.round(maxHeightValue)}px`;
    popup.dataset.maxHeight = String(Math.round(maxHeightValue));
    popup.dataset.orientation = placement.orientation;
    adjustAbstractHeight();
  };
  const showPopup = async element => {
    if (isMobile()) return;
    const pmid = element.getAttribute('data-pmid');
    if (!pmid) return;
    if (state.abstractSidebarApi.isActive && state.abstractSidebarApi.isActive(pmid)) return;
    anchor = element;
    clearHideTimer();
    popup.classList.add('popup-open');
    popup.innerHTML = '<div class="flex-1 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300"><svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Loading abstract</span></div>';
    placePopup(element.getBoundingClientRect());
    try {
      const metadata = await fetchPmidMetadata(pmid);
      const journalLabelRaw = metadata.journalAbbrev || metadata.journalTitle || '';
      const journalLabel = journalLabelRaw ? journalLabelRaw.toUpperCase() : '&nbsp;';
      const yearLabel = metadata.year || '&nbsp;';
      const abstractMarkup = metadata.abstractHtml
        ? `<div class="abstract-box flex-1 text-sm leading-relaxed nice-scroll overflow-y-auto rounded-lg px-3 py-3">${metadata.abstractHtml}</div>`
        : '';
      popup.innerHTML = `
        <div class="flex flex-1 flex-col gap-4 h-full">
          <div data-popup-header class="space-y-3">
            <div class="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              <span class="truncate text-left">${journalLabel}</span>
              <a class="justify-self-center font-mono tracking-[0.12em] uppercase text-gray-500 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors" href="${CONFIG.pubmedBaseUrl}${pmid}/" target="_blank" rel="noopener noreferrer">PMID ${pmid}</a>
              <span class="text-right">${yearLabel}</span>
            </div>
            <div class="text-lg font-semibold leading-snug text-center text-gray-800 dark:text-gray-100 px-2">${metadata.title}</div>
          </div>
          ${abstractMarkup}
        </div>
      `;
      placePopup(element.getBoundingClientRect());
    } catch (error) {
      popup.innerHTML = '<div class="flex-1 flex items-center justify-center text-red-500">Error loading abstract</div>';
      placePopup(element.getBoundingClientRect());
    }
  };
  const hidePopup = () => {
    clearHideTimer();
    popup.classList.remove('popup-open');
    popup.dataset.maxHeight = '0';
    anchor = null;
  };
  state.hideInlinePopup = hidePopup;
  quill.root.addEventListener('mouseover', event => {
    if (isMobile()) return;
    const target = event.target.closest('.ql-pmid');
    if (!target) return;
    const suppressHover = state.abstractSidebarApi.isEnabled && state.abstractSidebarApi.isEnabled();
    if (suppressHover && state.abstractSidebarApi.isActive && state.abstractSidebarApi.isActive(target.getAttribute('data-pmid'))) return;
    clearHideTimer();
    showPopup(target);
  });
  quill.root.addEventListener('mouseout', event => {
    if (isMobile()) return;
    const target = event.target.closest('.ql-pmid');
    if (!target) return;
    const related = event.relatedTarget;
    if (related) {
      if (popup.contains(related)) return;
      const relatedToken = related.closest && related.closest('.ql-pmid');
      if (relatedToken) return;
    }
    scheduleHide(220);
  });
  popup.addEventListener('mouseenter', clearHideTimer);
  popup.addEventListener('mouseleave', () => scheduleHide(200));
  document.addEventListener('pointerdown', event => {
    if (isMobile()) {
      hidePopup();
      return;
    }
    if (!popup.classList.contains('popup-open')) return;
    const target = event.target;
    if (!target) return;
    if (popup.contains(target)) return;
    if (anchor && (target === anchor || (target.closest && target.closest('.ql-pmid') === anchor))) return;
    hidePopup();
  });
  window.addEventListener('scroll', () => {
    if (popup.classList.contains('popup-open') && anchor) placePopup(anchor.getBoundingClientRect());
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (isMobile()) {
      hidePopup();
      return;
    }
    if (popup.classList.contains('popup-open') && anchor) placePopup(anchor.getBoundingClientRect());
  });
};

export { initPersistence, initPopup };
