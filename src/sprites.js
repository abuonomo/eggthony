// ============================================================
// SPRITE LOADING
// ============================================================

export const eggSprite = new Image();
eggSprite.src = 'data/eggthony.png';
export let spriteLoaded = false;
eggSprite.onload = () => { spriteLoaded = true; };

export const metalSprite = new Image();
metalSprite.src = 'data/metal_eggthony.png';
export let metalSpriteLoaded = false;
metalSprite.onload = () => { metalSpriteLoaded = true; };

export const muscleSprite = new Image();
muscleSprite.src = 'data/muscle_eggthony.png';
export let muscleSpriteLoaded = false;
muscleSprite.onload = () => { muscleSpriteLoaded = true; };

export const evilSprite = new Image();
evilSprite.src = 'data/evil_eggthony.png';
export let evilSpriteLoaded = false;
evilSprite.onload = () => { evilSpriteLoaded = true; };

export const evilSprite2 = new Image();
evilSprite2.src = 'data/evil_eggthony_2.png';
export let evilSprite2Loaded = false;
evilSprite2.onload = () => { evilSprite2Loaded = true; };

function removeWhiteBG(img, callback) {
  const c = document.createElement('canvas');
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= 240 && d[i + 1] >= 240 && d[i + 2] >= 240) d[i + 3] = 0;
  }
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  cx.putImageData(id, 0, 0);
  const cropped = cx.getImageData(minX, minY, cropW, cropH);
  const c2 = document.createElement('canvas');
  c2.width = cropW;
  c2.height = cropH;
  c2.getContext('2d').putImageData(cropped, 0, 0);
  const out = new Image();
  out.onload = () => callback(out);
  out.src = c2.toDataURL();
}

function removeDarkBG(img, callback) {
  const c = document.createElement('canvas');
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, w, h);
  const d = id.data;
  // Strip neutral grey background — tight tolerance to preserve dark hair, jeans, outlines
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r < 160 && g < 160 && b < 160 &&
        Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15) {
      d[i + 3] = 0;
    }
  }
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  cx.putImageData(id, 0, 0);
  const cropped = cx.getImageData(minX, minY, cropW, cropH);
  const c2 = document.createElement('canvas');
  c2.width = cropW;
  c2.height = cropH;
  c2.getContext('2d').putImageData(cropped, 0, 0);
  const out = new Image();
  out.onload = () => callback(out);
  out.src = c2.toDataURL();
}

// Reusable offscreen canvas for sprite flash effects
export const flashCanvas = document.createElement('canvas');
export const flashCtx = flashCanvas.getContext('2d');

// Enemy & powerup sprites (white-BG stripped at load time)
export let gruntSprite = null, gruntSpriteLoaded = false;
export let spitterSprite = null, spitterSpriteLoaded = false;
export let bruteSprite = null, bruteSpriteLoaded = false;
export let metalHatSprite = null, metalHatSpriteLoaded = false;
export let smoothieSprite = null, smoothieSpriteLoaded = false;
export let dwyerSprite = null, dwyerSpriteLoaded = false;
export let chestplateSprite = null, chestplateSpriteLoaded = false;
export let swordSprite = null, swordSpriteLoaded = false;
export let quentinPizzaSprite = null, quentinPizzaSpriteLoaded = false;
export let snotCageSprite = null, snotCageSpriteLoaded = false;
export let spiderSprite = null, spiderSpriteLoaded = false;
export let beerCanSprite = null, beerCanSpriteLoaded = false;

const spriteFiles = [
  ['data/grunt.png',           (s) => { gruntSprite = s; gruntSpriteLoaded = true; }],
  ['data/spitter.png',         (s) => { spitterSprite = s; spitterSpriteLoaded = true; }],
  ['data/brute.png',           (s) => { bruteSprite = s; bruteSpriteLoaded = true; }],
  ['data/metal_hat.png',       (s) => { metalHatSprite = s; metalHatSpriteLoaded = true; }],
  ['data/smoothie.png',        (s) => { smoothieSprite = s; smoothieSpriteLoaded = true; }],
  ['data/dwyer_soldier.png',   (s) => { dwyerSprite = s; dwyerSpriteLoaded = true; }],
  ['data/chesplate.png',       (s) => { chestplateSprite = s; chestplateSpriteLoaded = true; }],
  ['data/sword.png',           (s) => { swordSprite = s; swordSpriteLoaded = true; }],
  ['data/quentin_pizza.png',   (s) => { quentinPizzaSprite = s; quentinPizzaSpriteLoaded = true; }],
  ['data/snot_cage.png',       (s) => { snotCageSprite = s; snotCageSpriteLoaded = true; }],
  ['data/spider.png',          (s) => { spiderSprite = s; spiderSpriteLoaded = true; }],
  ['data/beer_can.png',        (s) => { beerCanSprite = s; beerCanSpriteLoaded = true; }],
];
for (const [src, cb] of spriteFiles) {
  const raw = new Image();
  raw.onload = () => removeWhiteBG(raw, cb);
  raw.src = src;
}

export let wingsSprite = null;
export let wingsSpriteLoaded = false;
{
  const raw = new Image();
  raw.onload = () => removeWhiteBG(raw, (s) => { wingsSprite = s; wingsSpriteLoaded = true; });
  raw.src = 'data/eggthony_wings.png';
}

export let chrisSprite = null, chrisSpriteLoaded = false;
export let chrisDrinkingSprite = null, chrisDrinkingSpriteLoaded = false;
export let crushedCanSprite = null, crushedCanSpriteLoaded = false;

// Auto-crop to non-transparent bounding box (no color stripping)
function autoCrop(img, callback) {
  const c = document.createElement('canvas');
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, w, h);
  const d = id.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = cx.getImageData(minX, minY, cropW, cropH);
  const c2 = document.createElement('canvas');
  c2.width = cropW;
  c2.height = cropH;
  c2.getContext('2d').putImageData(cropped, 0, 0);
  const out = new Image();
  out.onload = () => callback(out);
  out.src = c2.toDataURL();
}

// Chris sprites — already have transparent backgrounds, just auto-crop
const preCroppedFiles = [
  ['data/eager_chris_holding_can.png', (s) => { chrisSprite = s; chrisSpriteLoaded = true; }],
  ['data/eager_chris_drinking.png',    (s) => { chrisDrinkingSprite = s; chrisDrinkingSpriteLoaded = true; }],
  ['data/beer_can_crushed.png',        (s) => { crushedCanSprite = s; crushedCanSpriteLoaded = true; }],
];
for (const [src, cb] of preCroppedFiles) {
  const raw = new Image();
  raw.onload = () => autoCrop(raw, cb);
  raw.src = src;
}

export let wingsPowerupSprite = null, wingsPowerupSpriteLoaded = false;
{
  const raw = new Image();
  raw.onload = () => removeWhiteBG(raw, (s) => { wingsPowerupSprite = s; wingsPowerupSpriteLoaded = true; });
  raw.src = 'data/wings_powerup.png';
}
