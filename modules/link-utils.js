import { CONFIG } from './config.js';

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

export { createAnchorForPMID, openPubmed };
