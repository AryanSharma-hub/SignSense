// jsdom lacks a few browser APIs the app touches.
if (!window.matchMedia) {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
if (!window.cancelAnimationFrame) window.cancelAnimationFrame = (id) => clearTimeout(id);
