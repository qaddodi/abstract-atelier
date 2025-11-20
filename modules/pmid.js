import { CONFIG } from './config.js';
import { fetchWithRetry } from './utils.js';

const pmidMetadataCache = new Map();
const metadataQueue = [];
let metadataWorkerActive = false;

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
  const typeNodes = article.querySelectorAll('PublicationTypeList > PublicationType');
  const pubTypes = [...typeNodes].map(n => (n.textContent || '').trim()).filter(Boolean);

  const pickPrimaryType = types => {
    if (!types || !types.length) return '';
    for (const t of CONFIG.typePriority) {
      if (types.includes(t)) return t;
    }
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

const fetchPmidMetadata = pmid => {
  if (!pmid) return Promise.reject(new Error('Invalid PMID'));
  if (pmidMetadataCache.has(pmid)) return pmidMetadataCache.get(pmid);
  const promise = enqueueMetadataFetch(pmid);
  pmidMetadataCache.set(pmid, promise);
  promise.catch(() => pmidMetadataCache.delete(pmid));
  return promise;
};

export { extractUniquePMIDs, countPMIDMentions, fetchPmidMetadata };
