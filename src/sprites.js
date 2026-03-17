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
export let willBossSprite = null, willBossSpriteLoaded = false;
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
  ['data/will/will_turtle.png',(s) => { willBossSprite = s; willBossSpriteLoaded = true; }],
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
export let deanBossSprite = null, deanBossSpriteLoaded = false;
export let willFishSprites = [];
export let willFishSpritesLoaded = false;

// Procedurally generate colorful fish on offscreen canvases
function generateFishCanvas(bodyColor, bellyColor, finColor, tailColor, eyeColor, stripeColors, size) {
  const w = size;
  const h = Math.round(size * 0.6);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // Expose dimensions so beam drawing can read them like Image.naturalWidth/naturalHeight
  c.naturalWidth = w;
  c.naturalHeight = h;
  const cx = c.getContext('2d');
  const midX = w * 0.48;
  const midY = h * 0.5;
  const bodyW = w * 0.35;
  const bodyH = h * 0.38;

  // Tail
  cx.fillStyle = tailColor;
  cx.beginPath();
  cx.moveTo(w * 0.12, midY);
  cx.lineTo(w * 0.01, h * 0.12);
  cx.lineTo(w * 0.24, midY * 0.78);
  cx.closePath();
  cx.fill();
  cx.beginPath();
  cx.moveTo(w * 0.12, midY);
  cx.lineTo(w * 0.01, h * 0.88);
  cx.lineTo(w * 0.24, midY * 1.22);
  cx.closePath();
  cx.fill();
  // Tail outline
  cx.strokeStyle = '#3a3a3a';
  cx.lineWidth = Math.max(1.5, size * 0.03);
  cx.beginPath();
  cx.moveTo(w * 0.24, midY * 0.78);
  cx.lineTo(w * 0.01, h * 0.12);
  cx.lineTo(w * 0.12, midY);
  cx.lineTo(w * 0.01, h * 0.88);
  cx.lineTo(w * 0.24, midY * 1.22);
  cx.stroke();

  // Body
  cx.fillStyle = bodyColor;
  cx.beginPath();
  cx.ellipse(midX, midY, bodyW, bodyH, 0, 0, Math.PI * 2);
  cx.fill();

  // Belly
  cx.fillStyle = bellyColor;
  cx.beginPath();
  cx.ellipse(midX + bodyW * 0.08, midY + bodyH * 0.3, bodyW * 0.7, bodyH * 0.4, 0, 0, Math.PI * 2);
  cx.fill();

  // Color stripes
  const stripeW = bodyW * 0.12;
  for (let i = 0; i < stripeColors.length; i++) {
    cx.fillStyle = stripeColors[i];
    const sx = midX - bodyW * 0.3 + i * (bodyW * 0.28);
    cx.beginPath();
    cx.ellipse(sx, midY, stripeW, bodyH * 0.75, 0, 0, Math.PI * 2);
    cx.fill();
  }

  // Dorsal fin
  cx.fillStyle = finColor;
  cx.beginPath();
  cx.moveTo(midX - bodyW * 0.15, midY - bodyH * 0.7);
  cx.quadraticCurveTo(midX + bodyW * 0.1, midY - bodyH * 1.25, midX + bodyW * 0.5, midY - bodyH * 0.5);
  cx.lineTo(midX - bodyW * 0.15, midY - bodyH * 0.3);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = '#3a3a3a';
  cx.lineWidth = Math.max(1.2, size * 0.025);
  cx.stroke();

  // Bottom fin
  cx.fillStyle = finColor;
  cx.beginPath();
  cx.moveTo(midX, midY + bodyH * 0.6);
  cx.quadraticCurveTo(midX + bodyW * 0.1, midY + bodyH * 1.1, midX + bodyW * 0.35, midY + bodyH * 0.6);
  cx.closePath();
  cx.fill();
  cx.stroke();

  // Body outline
  cx.strokeStyle = '#3a3a3a';
  cx.lineWidth = Math.max(1.5, size * 0.035);
  cx.beginPath();
  cx.ellipse(midX, midY, bodyW, bodyH, 0, 0, Math.PI * 2);
  cx.stroke();

  // Mouth
  cx.strokeStyle = '#3a3a3a';
  cx.lineWidth = Math.max(1.2, size * 0.025);
  cx.beginPath();
  cx.moveTo(midX + bodyW * 0.85, midY + bodyH * 0.05);
  cx.lineTo(midX + bodyW * 0.98, midY + bodyH * 0.2);
  cx.stroke();

  // Eye
  cx.fillStyle = '#e8e4e0';
  cx.beginPath();
  cx.arc(midX + bodyW * 0.55, midY - bodyH * 0.15, bodyH * 0.22, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = '#3a3a3a';
  cx.lineWidth = Math.max(1, size * 0.02);
  cx.stroke();
  cx.fillStyle = eyeColor;
  cx.beginPath();
  cx.arc(midX + bodyW * 0.58, midY - bodyH * 0.15, bodyH * 0.12, 0, Math.PI * 2);
  cx.fill();
  cx.fillStyle = '#2a2a2a';
  cx.beginPath();
  cx.arc(midX + bodyW * 0.6, midY - bodyH * 0.15, bodyH * 0.07, 0, Math.PI * 2);
  cx.fill();

  return c;
}

// Generate a variety of colorful fish
const FISH_DEFS = [
  { body: '#6a8caa', belly: '#9ab5c8', fin: '#a05a5a', tail: '#a05a5a', eye: '#2c3e50', stripes: ['#b89060', '#a05a5a'] },
  { body: '#a07850', belly: '#c8b898', fin: '#8a4a3a', tail: '#906840', eye: '#1a1a2e', stripes: ['#c8c0a8', '#b09858'] },
  { body: '#5a8a60', belly: '#98b89a', fin: '#b09850', tail: '#a08848', eye: '#2c3e50', stripes: ['#6a9a6a', '#5a8a7a'] },
  { body: '#7a5a8a', belly: '#b098b8', fin: '#a05878', tail: '#7a5a8a', eye: '#1a1a2e', stripes: ['#b888a8', '#6a7a9a'] },
  { body: '#a06060', belly: '#c8a098', fin: '#b08850', tail: '#8a4a4a', eye: '#2c3e50', stripes: ['#b890a0', '#c0a868'] },
  { body: '#b0a050', belly: '#d0c8a8', fin: '#a07840', tail: '#b09848', eye: '#1a1a2e', stripes: ['#a07070', '#7098a0'] },
  { body: '#508a7a', belly: '#90b8a8', fin: '#a06060', tail: '#4a7a6a', eye: '#2c3e50', stripes: ['#78b0a0', '#7898a8'] },
  { body: '#a05070', belly: '#c898a8', fin: '#b08848', tail: '#8a4060', eye: '#1a1a2e', stripes: ['#c0a868', '#9878a0'] },
];
const FISH_SIZE = 64;
willFishSprites = FISH_DEFS.map(d =>
  generateFishCanvas(d.body, d.belly, d.fin, d.tail, d.eye, d.stripes, FISH_SIZE)
);
willFishSpritesLoaded = willFishSprites.length > 0;

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
  ['data/dean_boss.png',               (s) => { deanBossSprite = s; deanBossSpriteLoaded = true; }],
];
for (const [src, cb] of preCroppedFiles) {
  const raw = new Image();
  raw.onload = () => autoCrop(raw, cb);
  raw.src = src;
}

// Fish sprites are now procedurally generated above (no PNG loading needed)

export let wingsPowerupSprite = null, wingsPowerupSpriteLoaded = false;
{
  const raw = new Image();
  raw.onload = () => removeWhiteBG(raw, (s) => { wingsPowerupSprite = s; wingsPowerupSpriteLoaded = true; });
  raw.src = 'data/wings_powerup.png';
}