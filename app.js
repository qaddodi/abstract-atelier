// Quick JS config: edit these to tweak data sources and timing
    const APP_CONFIG = {
      pubmedBaseUrl: 'https://pubmed.ncbi.nlm.nih.gov/', // Base URL for PubMed links
      eutilsBaseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=', // NCBI EUtils API base
      fetchRetries: 3, // Number of retries for fetching metadata
      metadataQueueDelay: 360, // Delay between metadata fetches in ms
      scrollDuration: 520, // Duration for animated scrolling in ms
      popupMaxWidth: 640, // Max width of popup in px
      popupPad: 16, // Padding around popup in px
      debounceDelay: 120, // General debounce delay in ms
      saveDebounce: 300, // Debounce for saving content in ms
      sidebarUpdateDebounce: 160, // Debounce for sidebar updates in ms
      highlightDebounce: 60 // Debounce for highlighting and stats in ms
    };

    (() => {
      // Configurable Variables (pulls from quick config above)
      const CONFIG = {
        ...APP_CONFIG,
        pmidPattern: /(\[\s*PMID\s*:\s*(\d{7,9})\s*\])|(?:PMID\s*:\s*(\d{7,9}))|(?:PMID\s+(\d{7,9}))|(?:PMID(\d{7,9}))|\b(\d{7,9})\b/g, // Regex for detecting PMIDs
        typePriority: [ // Priority for publication types
          'Randomized Controlled Trial',
          'Clinical Trial, Phase IV',
          'Clinical Trial, Phase III',
          'Clinical Trial, Phase II',
          'Clinical Trial, Phase I',
          'Clinical Trial',
          'Systematic Review',
          'Meta-Analysis',
          'Practice Guideline',
          'Guideline',
          'Comparative Study',
          'Observational Study',
          'Cohort Studies',
          'Cross-Sectional Studies',
          'Multicenter Study',
          'Case Reports',
          'Evaluation Study',
          'Validation Study',
          'Editorial',
          'Letter',
          'Comment',
          'Journal Article'
        ],
        typeAbbreviations: { // Abbreviations for publication types
          'Randomized Controlled Trial': 'RCT',
          'Clinical Trial, Phase I': 'CT P1',
          'Clinical Trial, Phase II': 'CT P2',
          'Clinical Trial, Phase III': 'CT P3',
          'Clinical Trial, Phase IV': 'CT P4',
          'Clinical Trial': 'CT',
          'Systematic Review': 'SR',
          'Meta-Analysis': 'MA',
          'Practice Guideline': 'Guideline',
          'Guideline': 'Guideline',
          'Comparative Study': 'Comp Study',
          'Observational Study': 'Obs Study',
          'Cohort Studies': 'Cohort',
          'Cross-Sectional Studies': 'X-Sectional',
          'Multicenter Study': 'Multicenter',
          'Case Reports': 'Case Rep',
          'Evaluation Study': 'Eval Study',
          'Validation Study': 'Validation',
          'Editorial': 'Editorial',
          'Letter': 'Letter',
          'Comment': 'Comment',
          'Journal Article': 'Article'
        }
      };

      const ICONS = {
        sun: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>',
        moon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
        eye: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
      };
      const STORAGE_KEYS = {
        theme: 'theme',
        sidebar: 'abstract-atelier:sidebar-visibility',
        content: 'abstract-atelier:content',
        viewMode: 'abstract-atelier:view-mode'
      };

      // Utilities
      const $ = (selector, scope = document) => scope.querySelector(selector);
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const debounce = (fn, delay = CONFIG.debounceDelay) => {
        let id;
        return (...args) => {
          clearTimeout(id);
          id = setTimeout(() => fn(...args), delay);
        };
      };
      const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
      let cancelActiveScroll = null;
      const animateScrollTo = (scroller, destination, { isDocument, duration = CONFIG.scrollDuration, easing = easeOutCubic } = {}) => {
        if (!Number.isFinite(destination)) return;
        const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const docEl = document.scrollingElement || document.documentElement || document.body;
        const targetEl = isDocument ? docEl : scroller;
        if (!targetEl) return;
        if (cancelActiveScroll) cancelActiveScroll();
        if (prefersReduced || typeof window.requestAnimationFrame !== 'function') {
          if (isDocument) {
            window.scrollTo(0, destination);
            if (docEl) docEl.scrollTop = destination;
            if (document.body) document.body.scrollTop = destination;
          } else {
            targetEl.scrollTop = destination;
          }
          cancelActiveScroll = null;
          return;
        }
        const raf = window.requestAnimationFrame.bind(window);
        const caf = window.cancelAnimationFrame.bind(window);
        const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const start = isDocument
          ? (window.scrollY ?? window.pageYOffset ?? docEl?.scrollTop ?? document.body?.scrollTop ?? 0)
          : (targetEl.scrollTop || 0);
        const distance = destination - start;
        if (Math.abs(distance) < 1) {
          if (isDocument) {
            window.scrollTo(0, destination);
            if (docEl) docEl.scrollTop = destination;
            if (document.body) document.body.scrollTop = destination;
          } else {
            targetEl.scrollTop = destination;
          }
          cancelActiveScroll = null;
          return;
        }
        const startTime = now();
        let rafId = null;
        const cancel = () => {
          if (rafId !== null) caf(rafId);
          cancelActiveScroll = null;
        };
        const step = timestamp => {
          const elapsed = duration > 0 ? Math.min(1, (timestamp - startTime) / duration) : 1;
          const progress = easing ? easing(elapsed) : elapsed;
          const value = start + (distance * progress);
          if (isDocument) {
            window.scrollTo(0, value);
            if (docEl) docEl.scrollTop = value;
            if (document.body) document.body.scrollTop = value;
          } else {
            targetEl.scrollTop = value;
          }
          if (elapsed < 1) {
            rafId = raf(step);
          } else {
            if (isDocument) {
              window.scrollTo(0, destination);
              if (docEl) docEl.scrollTop = destination;
              if (document.body) document.body.scrollTop = destination;
            } else {
              targetEl.scrollTop = destination;
            }
            cancel();
          }
        };
        cancelActiveScroll = cancel;
        rafId = raf(step);
      };
      const fetchWithRetry = async (url, tries = CONFIG.fetchRetries) => {
        for (let i = 0; i < tries; i++) {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(String(response.status));
            return await response.text();
          } catch (error) {
            if (i === tries - 1) throw error;
            await sleep(500 * (i + 1));
          }
        }
      };

      // PMID Utilities
      const pmidMetadataCache = new Map();
      const metadataQueue = [];
      let metadataWorkerActive = false;

      const processMetadataQueue = () => {
        if (metadataWorkerActive) return;
        const next = metadataQueue.shift();
        if (!next) return;
        metadataWorkerActive = true;
        const { pmid, resolve, reject, attempt } = next;
        fetchPmidMetadataNow(pmid)
          .then(data => resolve(data))
          .catch(error => {
            if (attempt < 2) {
              metadataQueue.push({ pmid, resolve, reject, attempt: attempt + 1 });
            } else {
              reject(error);
            }
          })
          .finally(() => {
            metadataWorkerActive = false;
            setTimeout(processMetadataQueue, CONFIG.metadataQueueDelay);
          });
      };

      const enqueueMetadataFetch = pmid => new Promise((resolve, reject) => {
        metadataQueue.push({ pmid, resolve, reject, attempt: 0 });
        processMetadataQueue();
      });

      const extractUniquePMIDs = text => {
        if (!text) return [];
        const seen = new Set();
        const ordered = [];
        CONFIG.pmidPattern.lastIndex = 0;
        let match;
        while ((match = CONFIG.pmidPattern.exec(text)) !== null) {
          const value = match[2] || match[3] || match[4] || match[5] || match[6];
          if (value && !seen.has(value)) {
            seen.add(value);
            ordered.push(value);
          }
        }
        return ordered;
      };

      const countPMIDMentions = text => {
        const counts = new Map();
        if (!text) return counts;
        CONFIG.pmidPattern.lastIndex = 0;
        let match;
        while ((match = CONFIG.pmidPattern.exec(text)) !== null) {
          const value = match[2] || match[3] || match[4] || match[5] || match[6];
          if (!value) continue;
          counts.set(value, (counts.get(value) || 0) + 1);
        }
        return counts;
      };

      const fetchPmidMetadataNow = async pmid => {
        const url = `${CONFIG.eutilsBaseUrl}${pmid}`;
        const xml = await fetchWithRetry(url);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const article = doc.querySelector('PubmedArticle');
        if (!article) throw new Error(`No article data for PMID ${pmid}`);
        const getText = selector => article.querySelector(selector)?.textContent?.trim() || '';
        const title = getText('ArticleTitle') || 'Title not found';
        const journalTitle = getText('Journal > Title');
        const journalAbbrev = getText('MedlineTA') || getText('ISOAbbreviation') || journalTitle;
        const yearRaw = getText('Journal > JournalIssue > PubDate > Year') || getText('ArticleDate > Year');
        const medlineDate = getText('Journal > JournalIssue > PubDate > MedlineDate');
        const yearFallback = medlineDate ? ((medlineDate.match(/\d{4}/) || [])[0] || '') : '';
        const year = yearRaw || yearFallback;
        const volume = getText('Journal > JournalIssue > Volume');
        const issue = getText('Journal > JournalIssue > Issue');
        const pages = getText('Article > Pagination > MedlinePgn');
        const authorNodes = article.querySelectorAll('AuthorList > Author');
        const authors = [...authorNodes].map(author => {
          const last = author.querySelector('LastName')?.textContent?.trim() || '';
          const initials = author.querySelector('Initials')?.textContent?.trim() || '';
          return (last + (initials ? ' ' + initials : '')).trim();
        }).filter(Boolean);
        const authorsFull = authors.length ? authors.join(', ') : 'Authors not found';
        let authorsDisplay = authorsFull;
        if (authorsDisplay.length > 140) authorsDisplay = authorsDisplay.slice(0, 137) + '...';
        const abstractNodes = article.querySelectorAll('AbstractText');
        const abstractSegments = [...abstractNodes].map(node => {
          const label = node.getAttribute('Label');
          const prefix = label ? `<strong>${label}:</strong> ` : '';
          return prefix + (node.textContent || '').trim();
        }).filter(Boolean);
        const abstractHtml = abstractSegments.join('<br><br>');
        // Publication types
        const typeNodes = article.querySelectorAll('PublicationTypeList > PublicationType');
        const pubTypes = [...typeNodes].map(n => (n.textContent || '').trim()).filter(Boolean);

        // Choose a primary type with simple priority, prefer a specific type over generic "Journal Article"
        const pickPrimaryType = types => {
          if (!types || !types.length) return '';
          for (const t of CONFIG.typePriority) {
            if (types.includes(t)) return t;
          }
          // Fallback to the first type if none matched priority
          return types[0] || '';
        };

        const autoAbbrev = s => {
          if (!s) return '';
          const parts = s.split(/\s+/).filter(Boolean);
          if (parts.length <= 2 && s.length <= 18) return s;
          const initials = parts.map(w => w[0]).join('').toUpperCase();
          return initials.length >= 2 ? initials : s;
        };

        const typeFull = pickPrimaryType(pubTypes);
        const typeShort = CONFIG.typeAbbreviations[typeFull] || autoAbbrev(typeFull);
        const citeVolume = volume ? volume + (issue ? `(${issue})` : '') : '';
        const citationParts = [journalAbbrev || journalTitle, year, citeVolume, pages].filter(Boolean);
        return {
          pmid,
          title,
          journalTitle,
          journalAbbrev,
          year,
          volume,
          issue,
          pages,
          citation: citationParts.join(' '),
          authorsFull,
          authorsDisplay,
          abstractHtml,
          pubTypes,
          typeFull,
          typeShort
        };
      };

      const fetchPmidMetadata = pmid => {
        if (!pmid) return Promise.reject(new Error('Invalid PMID'));
        if (pmidMetadataCache.has(pmid)) return pmidMetadataCache.get(pmid);
        const promise = enqueueMetadataFetch(pmid);
        pmidMetadataCache.set(pmid, promise);
        promise.catch(() => pmidMetadataCache.delete(pmid));
        return promise;
      };

      const createAnchorForPMID = node => {
        const pmid = node.getAttribute('data-pmid') || (node.textContent.match(/\d{7,9}/) || [])[0];
        if (!pmid) return;
        const anchor = document.createElement('a');
        anchor.href = `${CONFIG.pubmedBaseUrl}${pmid}/`;
        anchor.textContent = node.textContent;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        node.replaceWith(anchor);
      };

      const openPubmed = pmid => {
        if (!pmid) return;
        const url = `${CONFIG.pubmedBaseUrl}${pmid}/`;
        window.open(url, '_blank', 'noopener,noreferrer');
      };

      // Quill Extensions
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

      // Initialization Modules
      const initThemeToggle = () => {
        const root = document.documentElement;
        const body = document.body;
        const btn = $('#theme-toggle');
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
        const row = $('#title-row');
        const author = $('#title-author');
        const ghost = $('#title-author-ghost');
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
        const btn = $('#view-toggle');
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
        const mq = window.matchMedia('(max-width: 767px)');
        const render = () => {
          const isMobile = mq.matches;
          if (isMobile) {
            document.body.classList.remove('pmid-sidebar-collapsed');
            document.body.classList.toggle('pmid-sidebar-mobile-open', !collapsed);
          } else {
            document.body.classList.remove('pmid-sidebar-mobile-open');
            document.body.classList.toggle('pmid-sidebar-collapsed', collapsed);
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
        const handleMedia = () => {
          render();
        };
        mq.addEventListener ? mq.addEventListener('change', handleMedia) : mq.addListener(handleMedia);
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

      const initStatsAndHighlighting = (quill, ensureCaretBelowTop) => {
        const statusbar = $('#statusbar');
        const wordsStat = $('#s-words');
        const charsStat = $('#s-chars');
        const pmidsStat = $('#s-pmids');
        if (!wordsStat || !charsStat || !pmidsStat) return;
        const updateStats = () => {
          const text = quill.getText();
          const trimmedText = text.trim();
          const words = trimmedText ? trimmedText.split(/\s+/).length : 0;
          const chars = trimmedText.length;
          const pmidCount = extractUniquePMIDs(trimmedText).length;
          const selection = quill.getSelection();
          let selectionWords = 0;
          let selectionChars = 0;
          let selectionPmids = 0;
          const hasSelection = !!(selection && selection.length > 0);
          if (hasSelection) {
            const selectionText = quill.getText(selection.index, selection.length);
            const trimmedSelection = selectionText.trim();
            selectionWords = trimmedSelection ? trimmedSelection.split(/\s+/).length : 0;
            selectionChars = trimmedSelection.length;
            selectionPmids = extractUniquePMIDs(trimmedSelection).length;
          }
          const renderStat = (statEl, selectionValue, totalValue, label) => {
            const statTextEl = statEl.querySelector('.stat-text');
            if (!statTextEl) return;
            statTextEl.innerHTML = '';
            if (hasSelection) {
              statTextEl.append(document.createTextNode(`${selectionValue}/`));
            }
            const totalSpan = document.createElement('span');
            totalSpan.className = 'stat-total';
            totalSpan.textContent = totalValue;
            statTextEl.append(totalSpan);
            const labelValue = hasSelection ? `${selectionValue}/${totalValue}` : totalValue;
            statEl.setAttribute('aria-label', `${label} ${labelValue}`);
          };
          renderStat(wordsStat, selectionWords, words, 'Words');
          renderStat(charsStat, selectionChars, chars, 'Chars');
          renderStat(pmidsStat, selectionPmids, pmidCount, 'PMIDs');
          if (!statusbar) return;
          const statDigits = (hasSelection
            ? [selectionWords, words, selectionChars, chars, selectionPmids, pmidCount]
            : [words, chars, pmidCount])
            .reduce((sum, value) => sum + String(value).length, 0);
          const totalDigits = statDigits + (hasSelection ? 3 : 0);
          const basePad = 16 + Math.min(12, Math.max(0, totalDigits - 3)) * 1.2;
          statusbar.style.setProperty('--pill-pad', `${basePad}px`);
          statusbar.style.setProperty('--pill-pad-expanded', `${basePad + 16}px`);
        };
        const highlightPMIDs = () => {
          const text = quill.getText();
          const len = quill.getLength();
          const selection = quill.getSelection();
          quill.formatText(0, len, 'pmid', false, 'silent');
          let match;
          while ((match = CONFIG.pmidPattern.exec(text)) !== null) {
            const pmid = match[2] || match[3] || match[4] || match[5] || match[6];
            if (!pmid) continue;
            quill.formatText(match.index, match[0].length, 'pmid', pmid, 'silent');
          }
          if (selection) quill.setSelection(selection.index, selection.length, 'silent');
        };
        const refresh = debounce(() => {
          highlightPMIDs();
          updateStats();
          ensureCaretBelowTop();
        }, CONFIG.highlightDebounce);
        quill.on('text-change', refresh);
        quill.on('selection-change', updateStats);
        updateStats();
        highlightPMIDs();
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

        const toggleInlineHighlight = (pmid, active) => {
          if (!pmid) return;
          document.querySelectorAll(`.ql-pmid[data-pmid="${pmid}"]`).forEach(node => {
            node.classList.toggle('pmid-inline-highlight', active);
          });
        };

        const setActive = (pmid, card, { lock = false } = {}) => {
          if (lock) activeLock = pmid || null;
          if (activeLock && !lock && pmid && pmid !== activeLock) return;
          if (activePmid === pmid && activeCard === card) return;
          if (activePmid) toggleInlineHighlight(activePmid, false);
          if (activeCard) activeCard.classList.remove('is-hovered');
          const previousPmid = activePmid;
          activePmid = pmid || null;
          activeCard = card || null;
          if (!pmid) activeLock = null;
          if (activePmid && previousPmid !== activePmid) {
            mentionCycleIndex.set(activePmid, -1);
          }
          if (activePmid && activeCard) {
            toggleInlineHighlight(activePmid, true);
            activeCard.classList.add('is-hovered');
          }
        };

        const clearActive = (force = false) => {
          if (activeLock && !force) return;
          activeLock = null;
          setActive(null, null);
        };

        const scrollInlineIntoView = (pmid, options = {}) => {
          if (!pmid) return;
          const { cycle = false, duration = CONFIG.scrollDuration, easing = easeOutCubic } = options;
          const mentions = Array.from(quill.root.querySelectorAll(`.ql-pmid[data-pmid="${pmid}"]`));
          if (!mentions.length) return;

          let index = mentionCycleIndex.get(pmid);
          if (!Number.isInteger(index)) index = -1;
          if (cycle) {
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
          const isMobileSidebarOpen = document.body.classList.contains('pmid-sidebar-mobile-open') && window.matchMedia('(max-width: 767px)').matches;
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
          card.addEventListener('mouseenter', () => setActive(card.dataset.pmid, card));
          card.addEventListener('mouseleave', () => clearActive());
          card.addEventListener('focus', () => setActive(card.dataset.pmid, card, { lock: true }));
          card.addEventListener('blur', () => clearActive());
          card.addEventListener('click', event => {
            const clickedPmidLink = event.target instanceof Element && event.target.closest('.pmid-card-pmid-link');
            if (clickedPmidLink) return;
            event.preventDefault();
            const pmid = card.dataset.pmid;
            if (!pmid) return;
            setActive(pmid, card, { lock: true });
            scrollInlineIntoView(pmid, { cycle: true, duration: CONFIG.scrollDuration });
          });
          card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            const pmid = card.dataset.pmid;
            if (!pmid) return;
            setActive(pmid, card, { lock: true });
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
              clearActive(true);
            }
            return;
          }

          // Do not hijack true text selections
          if (hasExpandedSelection) return;

          event.preventDefault();
          const pmid = token.getAttribute('data-pmid');
          if (!pmid) return;

          const card = cardMap.get(pmid);
          if (card) setActive(pmid, card, { lock: true });
          scrollInlineIntoView(pmid, { cycle: true, duration: CONFIG.scrollDuration });
        });

        document.addEventListener('click', event => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const insideSidebar = target.closest('#pmid-sidebar');
          const inlinePmid = target.closest('.ql-pmid');
          if (insideSidebar || inlinePmid) return;
          clearActive(true);
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
            clearActive(true);
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
            }
          });

          remaining.forEach(pmid => {
            const card = cardMap.get(pmid);
            if (card && card.parentElement === listEl) listEl.removeChild(card);
            cardMap.delete(pmid);
            mentionCycleIndex.delete(pmid);
          });

          if (activePmid && !cardMap.has(activePmid)) {
            clearActive(true);
          }
        }, CONFIG.sidebarUpdateDebounce);

        updateSidebar();
        quill.on('text-change', updateSidebar);
      };

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

      const initPopup = (quill, topbarEl) => {
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
          const bottomLimit = vh - pad;
          const maxHeightLimit = Math.min(CONFIG.popupMaxWidth, Math.max(0, bottomLimit - topSafety));
          const spaceBelow = Math.max(0, bottomLimit - (rect.bottom + pad));
          const spaceAbove = Math.max(0, (rect.top - pad) - topSafety);
          const order = spaceBelow >= spaceAbove ? ['below', 'above'] : ['above', 'below'];
          const attempt = direction => {
            if (direction === 'below') {
              const topCandidate = rect.bottom + pad;
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
          const pmid = element.getAttribute('data-pmid');
          if (!pmid) return;
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
        quill.root.addEventListener('mouseover', event => {
          const target = event.target.closest('.ql-pmid');
          if (!target) return;
          clearHideTimer();
          showPopup(target);
        });
        quill.root.addEventListener('mouseout', event => {
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
          if (popup.classList.contains('popup-open') && anchor) placePopup(anchor.getBoundingClientRect());
        });
      };

      // Main Init
      const init = () => {
        initThemeToggle();
        initTitleSizing();
        const { quill, toolbarEl } = initQuill();
        initViewToggle(quill);
        const sidebarEl = document.getElementById('pmid-sidebar');
        initSidebarToggle(sidebarEl);
        setupToolbarSnap(toolbarEl, quill);
        initExport(quill);
        initCopy(quill);
        const { ensureCaretBelowTop, topbarEl } = initLayout(quill);
        initStatsAndHighlighting(quill, ensureCaretBelowTop);
        initPmidSidebar(quill);
        initPersistence(quill);
        initPopup(quill, topbarEl);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    })();
