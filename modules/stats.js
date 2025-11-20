import { $, debounce } from './utils.js';
import { CONFIG } from './config.js';
import { extractUniquePMIDs } from './pmid.js';

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

export { initStatsAndHighlighting };
