const APP_CONFIG = {
  pubmedBaseUrl: 'https://pubmed.ncbi.nlm.nih.gov/',
  eutilsBaseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=',
  pubmedSearchUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  fetchRetries: 3,
  metadataQueueDelay: 360,
  scrollDuration: 520,
  popupMaxWidth: 640,
  popupPad: 16,
  debounceDelay: 120,
  saveDebounce: 300,
  sidebarUpdateDebounce: 160,
  highlightDebounce: 60
};

const CONFIG = {
  ...APP_CONFIG,
  pmidPattern: /(\[\s*PMID\s*:\s*(\d{7,9})\s*\])|(?:PMID\s*:\s*(\d{7,9}))|(?:PMID\s+(\d{7,9}))|(?:PMID(\d{7,9}))|\b(\d{7,9})\b/g,
  typePriority: [
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
  typeAbbreviations: {
    'Randomized Controlled Trial': 'RCT',
    'Clinical Trial, Phase I': 'CT P1',
    'Clinical Trial, Phase II': 'CT P2',
    'Clinical Trial, Phase III': 'CT P3',
    'Clinical Trial, Phase IV': 'CT P4',
    'Clinical Trial': 'CT',
    'Systematic Review': 'SR',
    'Meta-Analysis': 'MA',
    'Practice Guideline': 'Guideline',
    Guideline: 'Guideline',
    'Comparative Study': 'Comp Study',
    'Observational Study': 'Obs Study',
    'Cohort Studies': 'Cohort',
    'Cross-Sectional Studies': 'X-Sectional',
    'Multicenter Study': 'Multicenter',
    'Case Reports': 'Case Rep',
    'Evaluation Study': 'Eval Study',
    'Validation Study': 'Validation',
    Editorial: 'Editorial',
    Letter: 'Letter',
    Comment: 'Comment',
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
  viewMode: 'abstract-atelier:view-mode',
  abstractPanel: 'abstract-atelier:abstract-panel'
};

const MEDIA_QUERIES = {
  mobile: '(max-width: 767px)'
};

const media = {
  mobile: typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MEDIA_QUERIES.mobile) : { matches: false }
};

const isMobile = () => !!(media.mobile && media.mobile.matches);

const onMobileChange = handler => {
  if (!media.mobile || !handler) return;
  if (typeof media.mobile.addEventListener === 'function') {
    media.mobile.addEventListener('change', handler);
  } else if (typeof media.mobile.addListener === 'function') {
    media.mobile.addListener(handler);
  }
};

export { CONFIG, ICONS, STORAGE_KEYS, media, isMobile, onMobileChange };
