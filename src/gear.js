// ============================================================
// GEAR SYSTEM — Items, persistence, equip, buffs, rendering
// ============================================================
import { S } from './state.js';
import { PLAYER_W, PLAYER_H } from './constants.js';
import CATALOG from './gear_catalog.json';

// ============================================================
// SLOT & RARITY DEFINITIONS
// ============================================================
export const GEAR_SLOTS = ['head', 'body', 'collar', 'accessory'];

export const RARITY_COLORS = {
  common:    '#aaaaaa',
  uncommon:  '#44cc44',
  rare:      '#4488ff',
  legendary: '#ffaa00',
};

export const RARITY_WEIGHTS = {
  common:    { base: 70, perRound: -6 },
  uncommon:  { base: 25, perRound: 2 },
  rare:      { base: 4,  perRound: 3 },
  legendary: { base: 1,  perRound: 1 },
};

export const SLOT_NAMES = {
  head: 'Head',
  body: 'Body',
  collar: 'Collar',
  accessory: 'Accessory',
};

// ============================================================
// ITEM CATALOG — loaded from gear_catalog.json (single source of truth)
// ============================================================
export const GEAR_ITEMS = CATALOG;

// Draw order: back-to-front
const GEAR_DRAW_ORDER = ['collar', 'body', 'head', 'accessory'];

// ============================================================
// GEAR SPRITE LOADING
// ============================================================
const gearSprites = {}; // id -> Image
const gearSpritesLoaded = {}; // id -> boolean

export function loadGearSprites() {
  for (const [id, item] of Object.entries(GEAR_ITEMS)) {
    const img = new Image();
    img.src = item.sprite;
    gearSprites[id] = img;
    gearSpritesLoaded[id] = false;
    img.onload = () => { gearSpritesLoaded[id] = true; };
  }
}

// ============================================================
// PERSISTENCE (localStorage)
// ============================================================
const STORAGE_KEY = 'eggthonyGear';

function defaultGearState() {
  const equipped = {};
  GEAR_SLOTS.forEach(s => { equipped[s] = null; });
  return { version: 1, inventory: [], equipped };
}

export function loadGear() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.version === 1) {
        // Validate items still exist in catalog
        data.inventory = data.inventory.filter(id => GEAR_ITEMS[id]);
        for (const slot of GEAR_SLOTS) {
          if (data.equipped[slot] && !GEAR_ITEMS[data.equipped[slot]]) {
            data.equipped[slot] = null;
          }
        }
        S.gear = data;
        recalcBuffs();
        return;
      }
    }
  } catch { /* corrupt data, reset */ }
  S.gear = defaultGearState();
  recalcBuffs();
}

export function saveGear() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S.gear));
  } catch { /* storage full, silently fail */ }
}

// ============================================================
// EQUIP / UNEQUIP
// ============================================================
export function equipItem(itemId) {
  const item = GEAR_ITEMS[itemId];
  if (!item) return;
  if (!S.gear.inventory.includes(itemId)) return;
  // Unequip current item in that slot (stays in inventory)
  S.gear.equipped[item.slot] = itemId;
  recalcBuffs();
  saveGear();
}

export function unequipSlot(slot) {
  S.gear.equipped[slot] = null;
  recalcBuffs();
  saveGear();
}

// ============================================================
// BUFF CALCULATION
// ============================================================
export function recalcBuffs() {
  const buffs = { maxHp: 0, speed: 0, jumpForce: 0, damage: 0, dropLuck: 0 };
  for (const slot of GEAR_SLOTS) {
    const itemId = S.gear.equipped[slot];
    if (!itemId) continue;
    const item = GEAR_ITEMS[itemId];
    if (!item) continue;
    const b = item.buffs;
    if (b.maxHp) buffs.maxHp += b.maxHp;
    if (b.speed) buffs.speed += b.speed;
    if (b.jumpForce) buffs.jumpForce += b.jumpForce;
    if (b.damage) buffs.damage += b.damage;
    if (b.dropLuck) buffs.dropLuck += b.dropLuck;
  }
  S.gear.totalBuffs = buffs;
}

// ============================================================
// DROP SYSTEM
// ============================================================
export function rollDrop(round) {
  // Drop probability: 20% at round 1, +10% per round, max 80%
  const prob = Math.min(0.8, 0.2 + (round - 1) * 0.1);
  if (Math.random() > prob) return null;

  // Build weighted pool filtered by minRound
  const pool = [];
  for (const item of Object.values(GEAR_ITEMS)) {
    if (round < item.minRound) continue;
    // Rarity weighting shifts with round
    const rw = RARITY_WEIGHTS[item.rarity];
    const weight = Math.max(1, rw.base + rw.perRound * (round - 1)) * item.dropWeight;
    pool.push({ id: item.id, weight });
  }
  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

// Duplicates are silently discarded — this naturally makes completing
// your collection harder as your inventory fills up (e.g. owning 3 of 4
// items means only 25% of successful rolls yield something new).
export function awardDrop(itemId) {
  if (!S.gear.inventory.includes(itemId)) {
    S.gear.inventory.push(itemId);
  }
  saveGear();
}

// ============================================================
// GET CURRENT SPRITE VARIANT KEY
// ============================================================
function getSpriteVariant() {
  const { player } = S;
  if (player.metalTimer > 0) return 'metal';
  if (player.muscleTimer > 0) return 'muscle';
  if (player.wingsTimer > 0) return 'wings';
  return 'default';
}

// ============================================================
// RENDER GEAR ON PLAYER
// ============================================================
// Called inside drawPlayer()'s inner ctx.save/restore (facing flip already applied).
// drawX, drawY, drawW, drawH are the player sprite's actual draw rect.
export function drawGearOnPlayer(drawX, drawY, drawW, drawH) {
  const ctx = S.ctx;
  const variant = getSpriteVariant();
  const pcx = drawX + drawW / 2;  // Player center X
  const topY = drawY;             // Player top Y
  const scale = drawH / PLAYER_H; // Scale factor for non-standard sizes (title screen, equip preview)

  for (const slot of GEAR_DRAW_ORDER) {
    const itemId = S.gear.equipped[slot];
    if (!itemId) continue;
    const item = GEAR_ITEMS[itemId];
    if (!item) continue;
    if (!gearSpritesLoaded[itemId]) continue;

    const anchor = item.anchors[variant] || item.anchors.default;
    const gw = item.drawW * scale;
    const gh = item.drawH * scale;
    const gx = pcx + anchor.x * scale - gw / 2;
    const gy = topY + anchor.y * scale - gh / 2;

    if (anchor.flipH) {
      ctx.save();
      ctx.translate(gx + gw / 2, gy);
      ctx.scale(-1, 1);
      ctx.drawImage(gearSprites[itemId], -gw / 2, 0, gw, gh);
      ctx.restore();
    } else {
      ctx.drawImage(gearSprites[itemId], gx, gy, gw, gh);
    }
  }
}

// ============================================================
// EQUIP SCREEN DRAWING
// ============================================================
const EQUIP_LAYOUT = {
  slotStartY: 80,
  slotH: 52,
  slotGap: 4,
  invStartY: 520,
  invCols: 5,
  invCellSize: 60,
  invGap: 8,
};

export function drawEquipScreen() {
  const ctx = S.ctx;
  const { gear } = S;
  const W = S.canvas.width;
  const H = S.canvas.height;

  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('GEAR', W / 2, 40);

  // Subtitle
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Tap slot to select, tap item to equip', W / 2, 60);

  // Slot buttons (left side)
  const slotX = 14;
  const slotW = 180;
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    const slot = GEAR_SLOTS[i];
    const sy = EQUIP_LAYOUT.slotStartY + i * (EQUIP_LAYOUT.slotH + EQUIP_LAYOUT.slotGap);
    const isSelected = S.gearSelectedSlot === slot;

    ctx.fillStyle = isSelected ? '#1a2a3a' : '#151520';
    ctx.fillRect(slotX, sy, slotW, EQUIP_LAYOUT.slotH);
    ctx.strokeStyle = isSelected ? '#4488ff' : '#333';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(slotX, sy, slotW, EQUIP_LAYOUT.slotH);

    ctx.textAlign = 'left';
    ctx.fillStyle = isSelected ? '#4488ff' : '#888';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(SLOT_NAMES[slot], slotX + 8, sy + 18);

    const equippedId = gear.equipped[slot];
    if (equippedId && GEAR_ITEMS[equippedId]) {
      const item = GEAR_ITEMS[equippedId];
      ctx.fillStyle = RARITY_COLORS[item.rarity];
      ctx.font = '11px monospace';
      ctx.fillText(item.name, slotX + 8, sy + 36);

      // Draw small gear sprite
      if (gearSpritesLoaded[equippedId]) {
        ctx.drawImage(gearSprites[equippedId], slotX + slotW - 40, sy + 6, 32, 32);
      }
    } else {
      ctx.fillStyle = '#444';
      ctx.font = '11px monospace';
      ctx.fillText('Empty', slotX + 8, sy + 36);
    }
  }

  // Character preview (right side)
  const previewX = slotX + slotW + 20;
  const previewW = W - previewX - 14;
  const previewH = 380;
  const previewY = EQUIP_LAYOUT.slotStartY;
  ctx.fillStyle = '#0d0d20';
  ctx.fillRect(previewX, previewY, previewW, previewH);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(previewX, previewY, previewW, previewH);

  // Draw Eggthony in preview (centered, larger)
  const { eggSprite, spriteLoaded } = getPlayerSprites();
  if (spriteLoaded) {
    const scale = 1.8;
    const pW = PLAYER_W * scale;
    const pH = PLAYER_H * scale;
    const pX = previewX + previewW / 2 - pW / 2;
    const pY = previewY + previewH / 2 - pH / 2 + 20;
    ctx.drawImage(eggSprite, pX, pY, pW, pH);
    drawGearOnPlayer(pX, pY, pW, pH);
  }

  // Buff summary
  const buffY = previewY + previewH + 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#88ff44';
  ctx.font = 'bold 11px monospace';
  const b = gear.totalBuffs || {};
  const buffParts = [];
  if (b.maxHp) buffParts.push(`+${b.maxHp} HP`);
  if (b.speed) buffParts.push(`+${b.speed} SPD`);
  if (b.jumpForce) buffParts.push(`+${Math.abs(b.jumpForce)} JMP`);
  if (b.damage) buffParts.push(`+${b.damage} DMG`);
  if (b.dropLuck) buffParts.push(`+${Math.round(b.dropLuck * 100)}% DROPS`);
  ctx.fillText(buffParts.length > 0 ? buffParts.join('  ') : 'No buffs equipped', W / 2, buffY);

  // Inventory grid (filtered to selected slot)
  const selectedSlot = S.gearSelectedSlot || 'head';
  const invItems = gear.inventory.filter(id => {
    const item = GEAR_ITEMS[id];
    return item && item.slot === selectedSlot;
  });

  const invY = EQUIP_LAYOUT.invStartY;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${SLOT_NAMES[selectedSlot]} Inventory`, W / 2, invY - 6);

  const cellSize = EQUIP_LAYOUT.invCellSize;
  const gap = EQUIP_LAYOUT.invGap;
  const cols = EQUIP_LAYOUT.invCols;
  const gridW = cols * cellSize + (cols - 1) * gap;
  const gridStartX = (W - gridW) / 2;

  if (invItems.length === 0) {
    ctx.fillStyle = '#444';
    ctx.font = '12px monospace';
    ctx.fillText('No items for this slot', W / 2, invY + 40);
  }

  for (let i = 0; i < invItems.length; i++) {
    const itemId = invItems[i];
    const item = GEAR_ITEMS[itemId];
    if (!item) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridStartX + col * (cellSize + gap);
    const cy = invY + row * (cellSize + gap) + 8;
    const isEquipped = gear.equipped[selectedSlot] === itemId;

    ctx.fillStyle = isEquipped ? '#1a2a1a' : '#151520';
    ctx.fillRect(cx, cy, cellSize, cellSize);
    ctx.strokeStyle = isEquipped ? '#88ff44' : RARITY_COLORS[item.rarity];
    ctx.lineWidth = isEquipped ? 2 : 1;
    ctx.strokeRect(cx, cy, cellSize, cellSize);

    // Gear sprite
    if (gearSpritesLoaded[itemId]) {
      ctx.drawImage(gearSprites[itemId], cx + 6, cy + 4, cellSize - 12, cellSize - 20);
    }

    // Name
    ctx.textAlign = 'center';
    ctx.fillStyle = RARITY_COLORS[item.rarity];
    ctx.font = '8px monospace';
    ctx.fillText(item.name, cx + cellSize / 2, cy + cellSize - 4);
  }

  // Back button
  const backW = 120, backH = 36;
  const backX = W / 2 - backW / 2;
  const backY = H - 50;
  ctx.fillStyle = '#333';
  ctx.fillRect(backX, backY, backW, backH);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(backX, backY, backW, backH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('BACK', W / 2, backY + 23);
}

// ============================================================
// EQUIP SCREEN CLICK HANDLER
// ============================================================
export function handleEquipScreenClick(cx, cy) {
  const { gear } = S;
  const W = S.canvas.width;
  const H = S.canvas.height;

  // Slot buttons
  const slotX = 14;
  const slotW = 180;
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    const slot = GEAR_SLOTS[i];
    const sy = EQUIP_LAYOUT.slotStartY + i * (EQUIP_LAYOUT.slotH + EQUIP_LAYOUT.slotGap);
    if (cx >= slotX && cx <= slotX + slotW && cy >= sy && cy <= sy + EQUIP_LAYOUT.slotH) {
      if (S.gearSelectedSlot === slot && gear.equipped[slot]) {
        // Tap again on equipped slot to unequip
        unequipSlot(slot);
      } else {
        S.gearSelectedSlot = slot;
      }
      return true;
    }
  }

  // Inventory grid
  const selectedSlot = S.gearSelectedSlot || 'head';
  const invItems = gear.inventory.filter(id => {
    const item = GEAR_ITEMS[id];
    return item && item.slot === selectedSlot;
  });

  const cellSize = EQUIP_LAYOUT.invCellSize;
  const gap = EQUIP_LAYOUT.invGap;
  const cols = EQUIP_LAYOUT.invCols;
  const gridW = cols * cellSize + (cols - 1) * gap;
  const gridStartX = (W - gridW) / 2;
  const invY = EQUIP_LAYOUT.invStartY;

  for (let i = 0; i < invItems.length; i++) {
    const itemId = invItems[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = gridStartX + col * (cellSize + gap);
    const iy = invY + row * (cellSize + gap) + 8;
    if (cx >= ix && cx <= ix + cellSize && cy >= iy && cy <= iy + cellSize) {
      if (gear.equipped[selectedSlot] === itemId) {
        unequipSlot(selectedSlot);
      } else {
        equipItem(itemId);
      }
      return true;
    }
  }

  // Back button
  const backW = 120, backH = 36;
  const backX = W / 2 - backW / 2;
  const backY = H - 50;
  if (cx >= backX && cx <= backX + backW && cy >= backY && cy <= backY + backH) {
    const dest = S.gearReturnState || 'title';
    S.gameState = dest;
    // If returning to gameOver and cooldown already expired, re-trigger it
    if (dest === 'gameOver' && S.gameOverCooldown <= 0 && S.gameOverPhase === 'waiting') {
      S.gameOverCooldown = 0.1;
    }
    return true;
  }

  return false;
}

// ============================================================
// GEAR DROP NOTIFICATION SCREEN
// ============================================================
export function drawGearDrop() {
  const ctx = S.ctx;
  const W = S.canvas.width;
  const H = S.canvas.height;
  const itemId = S.gearDropItem;
  const item = GEAR_ITEMS[itemId];
  if (!item) return;

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);

  // Animate drop-in
  const t = S.gearDropTimer || 0;
  const slideIn = Math.min(1, t / 0.5);
  const ease = 1 - Math.pow(1 - slideIn, 3);

  ctx.save();
  ctx.textAlign = 'center';

  // Title
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('GEAR DROP!', W / 2, 120 * ease);

  // Rarity label
  ctx.fillStyle = RARITY_COLORS[item.rarity];
  ctx.font = 'bold 18px monospace';
  ctx.fillText(item.rarity.toUpperCase(), W / 2, 160 * ease);

  // Item sprite (big)
  const spriteSize = 120;
  const spriteX = W / 2 - spriteSize / 2;
  const spriteY = H / 2 - spriteSize / 2 - 40;
  if (gearSpritesLoaded[itemId]) {
    // Glow effect
    ctx.shadowColor = RARITY_COLORS[item.rarity];
    ctx.shadowBlur = 20 + Math.sin(t * 4) * 10;
    ctx.drawImage(gearSprites[itemId], spriteX, spriteY * ease + (1 - ease) * -100, spriteSize, spriteSize);
    ctx.shadowBlur = 0;
  }

  // Item name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(item.name, W / 2, H / 2 + 40);

  // Slot
  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText(`Slot: ${SLOT_NAMES[item.slot]}`, W / 2, H / 2 + 65);

  // Buff description
  ctx.fillStyle = '#88ff44';
  ctx.font = 'bold 14px monospace';
  const buffTexts = [];
  if (item.buffs.maxHp) buffTexts.push(`+${item.buffs.maxHp} Max HP`);
  if (item.buffs.speed) buffTexts.push(`+${item.buffs.speed} Speed`);
  if (item.buffs.jumpForce) buffTexts.push(`+${Math.abs(item.buffs.jumpForce)} Jump`);
  if (item.buffs.damage) buffTexts.push(`+${item.buffs.damage} Damage`);
  if (item.buffs.dropLuck) buffTexts.push(`+${Math.round(item.buffs.dropLuck * 100)}% Drops`);
  ctx.fillText(buffTexts.join('  '), W / 2, H / 2 + 90);

  // Continue prompt
  if (t > 1.0) {
    const alpha = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Tap to continue', W / 2, H - 80);
  }

  ctx.restore();
}

// ============================================================
// HELPER: get base player sprites (avoids circular import)
// ============================================================
let _eggSprite = null;
let _spriteLoaded = false;

export function setPlayerSprite(sprite, loaded) {
  _eggSprite = sprite;
  _spriteLoaded = loaded;
}

function getPlayerSprites() {
  return { eggSprite: _eggSprite, spriteLoaded: _spriteLoaded };
}
