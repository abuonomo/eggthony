// Mulberry32 seeded PRNG — drop-in Math.random() replacement
let _seed = Date.now() >>> 0;

export function seedRng(seed) {
  _seed = seed >>> 0;
}

export function random() {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
