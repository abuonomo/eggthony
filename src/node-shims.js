// Browser global stubs for Node.js headless mode
// Only activates when running outside a browser (e.g. node src/headless.js)
if (typeof globalThis.window === 'undefined') {
  const noop = () => {};
  const noopObj = new Proxy({}, { get: () => noop });

  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    createElement: (tag) => {
      if (tag === 'canvas') return { getContext: () => noopObj, width: 0, height: 0, style: {} };
      return {};
    },
  };
  globalThis.Image = class Image {
    set src(_) { /* no-op */ }
    get naturalWidth() { return 1; }
    get naturalHeight() { return 1; }
    addEventListener() {}
    set onload(_) {}
  };
  globalThis.Audio = class Audio {
    constructor() { this.paused = true; this.ended = true; this.currentTime = 0; this.volume = 1; this.loop = false; this.preload = ''; }
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
    addEventListener() {}
    set onerror(_) {}
  };
  globalThis.AudioContext = class AudioContext { constructor() { this.state = 'suspended'; } resume() {} };
  globalThis.webkitAudioContext = globalThis.AudioContext;
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.performance = { now: () => 0 };
  globalThis.requestAnimationFrame = noop;
  globalThis.fetch = () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
  // 'ontouchstart' check for input.js
  // Not setting it means isMobile = false, which is correct for headless
}
