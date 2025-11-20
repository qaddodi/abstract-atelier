import { CONFIG } from './config.js';

const $ = (selector, scope = document) => scope.querySelector(selector);

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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

export { $, debounce, easeOutCubic, animateScrollTo, fetchWithRetry };
