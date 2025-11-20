import { CONFIG, STORAGE_KEYS, isMobile, onMobileChange } from './modules/config.js';
import { $, debounce, easeOutCubic, animateScrollTo, fetchWithRetry } from './modules/utils.js';
import { extractUniquePMIDs, countPMIDMentions, fetchPmidMetadata } from './modules/pmid.js';
import { initThemeToggle, initTitleSizing, initViewToggle } from './modules/ui.js';
import { initQuill, setupToolbarSnap, initToolbarTooltips, initExport, initCopy } from './modules/editor.js';
import { initLayout } from './modules/layout.js';
import { initStatsAndHighlighting } from './modules/stats.js';
import { initPersistence, initPopup } from './modules/persistence.js';
import { createSidebars } from './modules/sidebars.js';

(() => {
      // Shared state holders
      const state = {
        abstractSidebarApi: {
          show: () => {},
          hide: () => {},
          openEmpty: () => {},
          isActive: () => false,
          isEnabled: () => true,
          getActive: () => null
        },
        hideInlinePopup: () => {},
        forceClearActive: () => {},
        abstractPanelEnabled: true,
        lastHighlightedPmid: null
      };
      const sidebars = createSidebars(state);
      const {
        isPmidSidebarOpen,
        keepAbstractAlignedWithPmid,
        readAbstractPanelEnabled,
        setAbstractPanelEnabled,
        syncAbstractToggleButton,
        initSidebarToggle,
        initAbstractPanelToggle,
        initAbstractSidebar,
        initPmidSidebar
      } = sidebars;

      // Main Init
      const init = () => {
        initThemeToggle();
        initTitleSizing();
        const { quill, toolbarEl } = initQuill();
        initViewToggle(quill);
        setupToolbarSnap(toolbarEl, quill);
        initToolbarTooltips(toolbarEl);
        initExport(quill);
        initCopy(quill);
        const { ensureCaretBelowTop, topbarEl } = initLayout(quill);
        initStatsAndHighlighting(quill, ensureCaretBelowTop);
        setAbstractPanelEnabled(readAbstractPanelEnabled());
        state.abstractSidebarApi = initAbstractSidebar(quill);
        initPmidSidebar(quill);
        const sidebarEl = document.getElementById('pmid-sidebar');
        initSidebarToggle(sidebarEl);
        initAbstractPanelToggle();
        initPersistence(quill);
        initPopup(quill, topbarEl);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    })();
