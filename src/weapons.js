import { S } from './state.js';
import {
  W, H, GRAVITY, PLATFORM_X, PLATFORM_W, PLATFORM_Y, PLAYER_W, PLAYER_H,
  LIGHTNING_SPEED, LIGHTNING_DAMAGE, LIGHTNING_COOLDOWN,
  SNOT_COOLDOWN, SNOT_MAX_CHARGE, SNOT_MIN_RANGE, SNOT_MAX_RANGE,
  SNOT_FREEZE_DURATION, SNOT_AOE_RADIUS, SNOT_ARC_PEAK,
  SNOT_STORM_DURATION, SNOT_STORM_AOE, SNOT_STORM_AOE_DMG,
  POOP_DAMAGE, POOP_AOE_RADIUS, POOP_COOLDOWN, POOP_SIZE, POOP_GRAVITY,
  SPIDER_DROP_DURATION, SPIDER_DROP_CLUTCH_Y, SPIDER_DROP_Y,
} from './constants.js';
import { spawnParticles, spawnDamageNumber, addShake } from './effects.js';
import { playSound, playNoise, snotSniffleClip, snotLaunchClip } from './audio.js';
import { rectsOverlap } from './utils.js';
import { damageEnemy } from './enemies.js';
import { damageBoss } from './boss.js';

// ============================================================
// LIGHTNING PROJECTILES
// ============================================================

function generateLightningSegments() {
  const segs = [];
  for (let i = 0; i < 5; i++) {
    segs.push({ ox: (Math.random() - 0.5) * 10, oy: (Math.random() - 0.5) * 10 });
  }
  return segs;
}

export function fireLightning() {
  const { player, mouse } = S;
  const cx = player.x + PLAYER_W / 2;
  const cy = player.y + PLAYER_H / 2;
  const angle = Math.atan2(mouse.y - cy, mouse.x - cx);
  const isStorm = player.snotStormTimer > 0;
  const speed = isStorm ? LIGHTNING_SPEED * 0.6 : LIGHTNING_SPEED;
  S.lightningBolts.push({
    x: cx,
    y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: isStorm ? 2.0 : 1.5,
    snotStorm: isStorm,
    segments: generateLightningSegments()
  });
  playSound('lightning');
}

export function updateLightningBolts(dt) {
  const { lightningBolts, enemies, boss, bossActive, player, particles } = S;

  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const b = lightningBolts[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // Regenerate jitter
    for (const s of b.segments) {
      s.ox = (Math.random() - 0.5) * 12;
      s.oy = (Math.random() - 0.5) * 12;
    }

    // Off screen or expired
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      lightningBolts.splice(i, 1);
      continue;
    }

    // Hit enemies
    let boltConsumed = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.dying) continue;
      const ecx = e.x + e.w / 2;
      const ecy = e.y + e.h / 2;
      const dist = Math.hypot(b.x - ecx, b.y - ecy);
      if (dist < e.w / 2 + 10) {
        damageEnemy(j, LIGHTNING_DAMAGE, b.vx * 0.3, -100);
        const hitColor = player.snotStormTimer > 0 ? '#88ff44' : '#77ccff';
        spawnParticles(b.x, b.y, hitColor, 5, 100, 0.3);
        // Snot Storm AOE splash
        if (player.snotStormTimer > 0) {
          for (let k = enemies.length - 1; k >= 0; k--) {
            if (k === j || enemies[k].dying) continue;
            const ek = enemies[k];
            const adist = Math.hypot(b.x - (ek.x + ek.w/2), b.y - (ek.y + ek.h/2));
            if (adist < SNOT_STORM_AOE) {
              damageEnemy(k, SNOT_STORM_AOE_DMG, 0, -50);
              ek.freezeTimer = Math.max(ek.freezeTimer, 1.0);
            }
          }
          // Big snotty explosion burst
          spawnParticles(b.x, b.y, '#88ff44', 18, 200, 0.5);
          spawnParticles(b.x, b.y, '#66cc22', 8, 120, 0.6);
          // AOE radius ring
          for (let r = 0; r < 10; r++) {
            const a = (r / 10) * Math.PI * 2;
            particles.push({
              x: b.x + Math.cos(a) * SNOT_STORM_AOE * 0.5,
              y: b.y + Math.sin(a) * SNOT_STORM_AOE * 0.5,
              vx: Math.cos(a) * 60,
              vy: Math.sin(a) * 60,
              life: 0.3, maxLife: 0.3,
              color: '#aaff66', size: 3
            });
          }
        }
        lightningBolts.splice(i, 1);
        boltConsumed = true;
        break;
      }
    }

    // Hit boss
    if (!boltConsumed && boss && bossActive && !boss.dying && boss.state !== 'entering') {
      const bcx = boss.x + boss.w / 2;
      const bcy = boss.y + boss.h / 2;
      const dist = Math.hypot(b.x - bcx, b.y - bcy);
      if (dist < boss.w / 2 + 10) {
        damageBoss(LIGHTNING_DAMAGE, b.vx * 0.3, -100);
        const hitColor = player.snotStormTimer > 0 ? '#88ff44' : '#77ccff';
        spawnParticles(b.x, b.y, hitColor, 5, 100, 0.3);
        if (player.snotStormTimer > 0) {
          if (boss) boss.freezeTimer = Math.max(boss.freezeTimer, 0.5);
          spawnParticles(b.x, b.y, '#88ff44', 18, 200, 0.5);
          spawnParticles(b.x, b.y, '#66cc22', 8, 120, 0.6);
          for (let r = 0; r < 10; r++) {
            const a = (r / 10) * Math.PI * 2;
            particles.push({
              x: b.x + Math.cos(a) * SNOT_STORM_AOE * 0.5,
              y: b.y + Math.sin(a) * SNOT_STORM_AOE * 0.5,
              vx: Math.cos(a) * 60,
              vy: Math.sin(a) * 60,
              life: 0.3, maxLife: 0.3,
              color: '#aaff66', size: 3
            });
          }
        }
        lightningBolts.splice(i, 1);
      }
    }
  }
}

export function drawLightningBolts() {
  const ctx = S.ctx;
  for (const b of S.lightningBolts) {
    const storm = b.snotStorm;
    const angle = Math.atan2(b.vy, b.vx);
    const len = storm ? 28 : 20;
    ctx.save();
    ctx.strokeStyle = storm ? '#ccff88' : '#ffffff';
    ctx.lineWidth = storm ? 5 : 3;
    ctx.shadowColor = storm ? '#88ff44' : '#4488ff';
    ctx.shadowBlur = storm ? 22 : 15;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(angle) * len, b.y - Math.sin(angle) * len);
    for (const s of b.segments) {
      const jScale = storm ? 1.6 : 1;
      ctx.lineTo(b.x + s.ox * jScale, b.y + s.oy * jScale);
    }
    ctx.lineTo(b.x + Math.cos(angle) * 5, b.y + Math.sin(angle) * 5);
    ctx.stroke();

    // Glow core
    ctx.strokeStyle = storm ? '#eeffcc' : '#aaddff';
    ctx.lineWidth = storm ? 2 : 1;
    ctx.stroke();
    ctx.restore();

    // Glow dot at tip
    ctx.fillStyle = storm ? 'rgba(136,255,68,0.9)' : 'rgba(150,200,255,0.8)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, storm ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Snot drip trail for storm bolts
    if (storm) {
      ctx.fillStyle = 'rgba(100,200,40,0.4)';
      ctx.beginPath();
      ctx.arc(b.x - Math.cos(angle) * 10, b.y - Math.sin(angle) * 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - Math.cos(angle) * 20, b.y - Math.sin(angle) * 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// SNOT ROCKET (Mortar — Hold & Release Arc System)
// ============================================================

export function calcSnotLanding(chargeRatio) {
  const { player } = S;
  const cx = player.x + PLAYER_W / 2;
  const dir = player.facingRight ? 1 : -1;
  const range = SNOT_MIN_RANGE + (SNOT_MAX_RANGE - SNOT_MIN_RANGE) * chargeRatio;
  let landX = cx + dir * range;
  // Clamp to platform bounds
  landX = Math.max(PLATFORM_X, Math.min(PLATFORM_X + PLATFORM_W, landX));
  return landX;
}

export function calcSnotArc(chargeRatio) {
  const { player } = S;
  const cx = player.x + PLAYER_W / 2;
  const cy = player.y + PLAYER_H * 0.35; // launch from nose
  const landX = calcSnotLanding(chargeRatio);
  const landY = PLATFORM_Y;
  // Solve for vx, vy to create parabolic arc with given peak height
  const dx = landX - cx;
  const dy = landY - cy;
  // Peak should be SNOT_ARC_PEAK above the higher of launch/landing
  const peakY = Math.min(cy, landY) - SNOT_ARC_PEAK;
  // Time to reach peak from launch: vy = sqrt(2 * g * (cy - peakY))
  const riseDist = cy - peakY;
  const vy0 = -Math.sqrt(Math.max(0, 2 * GRAVITY * riseDist));
  // Time to peak: t_peak = -vy0 / g
  const tPeak = -vy0 / GRAVITY;
  // Fall distance from peak to landing
  const fallDist = landY - peakY;
  // Time from peak to landing: t_fall = sqrt(2 * fallDist / g)
  const tFall = Math.sqrt(Math.max(0, 2 * fallDist / GRAVITY));
  const totalTime = tPeak + tFall;
  // Horizontal velocity
  const vx0 = totalTime > 0 ? dx / totalTime : 0;
  return { cx, cy, landX, landY, vx: vx0, vy: vy0, totalTime };
}

export function fireSnotRocket(chargeRatio) {
  const arc = calcSnotArc(chargeRatio);
  S.snotRocket = {
    x: arc.cx,
    y: arc.cy,
    vx: arc.vx,
    vy: arc.vy,
    landX: arc.landX,
    size: 10,
    trail: []
  };
}

function snotAOEFreeze(cx, cy) {
  const { enemies, boss, bossActive, particles } = S;

  // Freeze all enemies in radius
  for (const e of enemies) {
    if (e.dying) continue;
    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const dist = Math.hypot(cx - ecx, cy - ecy);
    if (dist < SNOT_AOE_RADIUS) {
      e.freezeTimer = SNOT_FREEZE_DURATION;
    }
  }
  // Freeze boss (shorter duration, use closest point on boss hitbox)
  if (boss && bossActive && !boss.dying && boss.state !== 'entering') {
    const bcx = Math.max(boss.x, Math.min(cx, boss.x + boss.w));
    const bcy = Math.max(boss.y, Math.min(cy, boss.y + boss.h));
    const dist = Math.hypot(cx - bcx, cy - bcy);
    if (dist < SNOT_AOE_RADIUS) {
      boss.freezeTimer = SNOT_FREEZE_DURATION * 0.5;
    }
  }
  // Visual effects
  spawnParticles(cx, cy, '#88dd44', 25, 200, 0.6);
  spawnParticles(cx, cy, '#66bb22', 15, 150, 0.5);
  addShake(5, 0.15);
  // Splat ring
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    particles.push({
      x: cx + Math.cos(angle) * 15,
      y: cy + Math.sin(angle) * 15,
      vx: Math.cos(angle) * 180,
      vy: Math.sin(angle) * 180 - 40,
      life: 0.4, maxLife: 0.4,
      color: '#aaee44', size: 5
    });
  }
}

export function updateSnotRocket(dt) {
  if (!S.snotRocket) return;
  const s = S.snotRocket;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.vy += GRAVITY * dt; // standard gravity for consistent arc

  // Trail particles
  s.trail.push({ x: s.x, y: s.y, life: 0.3, maxLife: 0.3 });
  for (let i = s.trail.length - 1; i >= 0; i--) {
    s.trail[i].life -= dt;
    if (s.trail[i].life <= 0) s.trail.splice(i, 1);
  }

  // Off screen
  if (s.x < -50 || s.x > W + 50 || s.y > H + 50) {
    S.snotRocket = null;
    return;
  }

  // Hit platform (mortar always lands on floor — no mid-air enemy collision)
  if (s.y + s.size >= PLATFORM_Y) {
    snotAOEFreeze(s.x, PLATFORM_Y);
    S.snotRocket = null;
  }
}

export function drawSnotRocket() {
  const ctx = S.ctx;
  if (!S.snotRocket) return;
  const s = S.snotRocket;

  // Trail
  for (const t of s.trail) {
    const alpha = Math.max(0, t.life / t.maxLife) * 0.5;
    ctx.fillStyle = `rgba(120,200,50,${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Booger blob
  ctx.save();
  ctx.shadowColor = '#88dd44';
  ctx.shadowBlur = 12;

  // Main blob
  ctx.fillStyle = '#88cc22';
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#bbee66';
  ctx.beginPath();
  ctx.arc(s.x - 2, s.y - 2, s.size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Drip blobs
  ctx.fillStyle = '#77bb11';
  ctx.beginPath();
  ctx.arc(s.x + s.size * 0.6, s.y + s.size * 0.4, s.size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawSnotCharging() {
  const ctx = S.ctx;
  const { player } = S;
  if (!player.snotHolding) return;
  // Sniffling visual — green particles gathering at nose
  const cx = player.x + PLAYER_W / 2 + (player.facingRight ? 10 : -10);
  const cy = player.y + PLAYER_H * 0.35;
  const progress = Math.min(player.snotChargeTime / SNOT_MAX_CHARGE, 1);

  // Growing booger at nose
  const blobSize = 3 + progress * 6;
  ctx.fillStyle = '#88cc22';
  ctx.beginPath();
  ctx.arc(cx, cy, blobSize, 0, Math.PI * 2);
  ctx.fill();

  // Snot strands drawing in
  ctx.strokeStyle = `rgba(120,200,50,${0.3 + progress * 0.4})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const angle = (performance.now() * 0.005 + i * 2.1);
    const dist = 25 * (1 - progress);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  // Arc preview
  drawSnotArcPreview(progress);
}

export function drawSnotArcPreview(chargeRatio) {
  const ctx = S.ctx;
  const arc = calcSnotArc(chargeRatio);
  const steps = 24;

  // Draw dotted parabolic path
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(136,204,34,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * arc.totalTime;
    const px = arc.cx + arc.vx * t;
    const py = arc.cy + arc.vy * t + 0.5 * GRAVITY * t * t;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // AOE radius circle at landing point (translucent green)
  ctx.fillStyle = 'rgba(136,204,34,0.08)';
  ctx.beginPath();
  ctx.arc(arc.landX, PLATFORM_Y, SNOT_AOE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(136,204,34,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(arc.landX, PLATFORM_Y, SNOT_AOE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair at landing point
  const crossSize = 8;
  ctx.strokeStyle = 'rgba(136,204,34,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(arc.landX - crossSize, PLATFORM_Y);
  ctx.lineTo(arc.landX + crossSize, PLATFORM_Y);
  ctx.moveTo(arc.landX, PLATFORM_Y - crossSize);
  ctx.lineTo(arc.landX, PLATFORM_Y + crossSize);
  ctx.stroke();
  // Crosshair circle
  ctx.beginPath();
  ctx.arc(arc.landX, PLATFORM_Y, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// SNOT STORM (activated by 3x stomp chain)
// ============================================================

export function drawSnotStormOverlay() {
  const ctx = S.ctx;
  const { player } = S;
  if (player.snotStormTimer <= 0) return;
  const ratio = player.snotStormTimer / SNOT_STORM_DURATION;
  // Flash faster when about to end (last 30%)
  let alpha;
  if (ratio < 0.3) {
    // Rapid flashing — frequency increases as it runs out
    const flashSpeed = 0.006 + (1 - ratio / 0.3) * 0.025;
    const flash = 0.5 + 0.5 * Math.sin(performance.now() * flashSpeed);
    alpha = 0.08 + flash * 0.2;
  } else {
    alpha = 0.12 + 0.04 * Math.sin(performance.now() * 0.003);
  }
  // Green vignette on all edges — thicker booger drips
  const edgeW = 30;
  // Top edge
  const gTop = ctx.createLinearGradient(0, 0, 0, edgeW);
  gTop.addColorStop(0, `rgba(80,180,30,${alpha * 1.5})`);
  gTop.addColorStop(0.5, `rgba(100,200,40,${alpha * 0.5})`);
  gTop.addColorStop(1, 'rgba(100,200,40,0)');
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, W, edgeW);
  // Bottom edge
  const gBot = ctx.createLinearGradient(0, H, 0, H - edgeW);
  gBot.addColorStop(0, `rgba(80,180,30,${alpha * 1.5})`);
  gBot.addColorStop(0.5, `rgba(100,200,40,${alpha * 0.5})`);
  gBot.addColorStop(1, 'rgba(100,200,40,0)');
  ctx.fillStyle = gBot;
  ctx.fillRect(0, H - edgeW, W, edgeW);
  // Left edge
  const gLeft = ctx.createLinearGradient(0, 0, edgeW, 0);
  gLeft.addColorStop(0, `rgba(80,180,30,${alpha * 1.5})`);
  gLeft.addColorStop(0.5, `rgba(100,200,40,${alpha * 0.5})`);
  gLeft.addColorStop(1, 'rgba(100,200,40,0)');
  ctx.fillStyle = gLeft;
  ctx.fillRect(0, 0, edgeW, H);
  // Right edge
  const gRight = ctx.createLinearGradient(W, 0, W - edgeW, 0);
  gRight.addColorStop(0, `rgba(80,180,30,${alpha * 1.5})`);
  gRight.addColorStop(0.5, `rgba(100,200,40,${alpha * 0.5})`);
  gRight.addColorStop(1, 'rgba(100,200,40,0)');
  ctx.fillStyle = gRight;
  ctx.fillRect(W - edgeW, 0, edgeW, H);
  // Booger drip blobs along top edge
  const t = performance.now() * 0.001;
  ctx.fillStyle = `rgba(90,190,35,${alpha * 1.8})`;
  for (let i = 0; i < 8; i++) {
    const bx = (i / 8) * W + 30;
    const dripLen = 8 + 12 * Math.sin(t * 1.2 + i * 2.1);
    const blobR = 4 + 2 * Math.sin(t * 0.8 + i * 1.7);
    ctx.beginPath();
    ctx.arc(bx, dripLen, blobR, 0, Math.PI * 2);
    ctx.fill();
    // Drip strand
    ctx.strokeStyle = `rgba(90,190,35,${alpha * 1.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + Math.sin(t + i) * 3, dripLen * 0.5, bx, dripLen);
    ctx.stroke();
  }
}

// ============================================================
// POOP BOMBS (Wings mode weapon)
// ============================================================

export function firePoopBomb() {
  const { player, mouse } = S;
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H;
  // Slight horizontal nudge toward mouse X
  const dx = mouse.x - pcx;
  const nudge = Math.sign(dx) * Math.min(Math.abs(dx) * 0.3, 60);
  S.poopBombs.push({
    x: pcx,
    y: pcy,
    vx: nudge,
    vy: 40,
    active: true
  });
  playSound('poopDrop');
}

function poopAOEDamage(cx, cy) {
  const { enemies, boss, particles } = S;

  playSound('poopSplat');
  addShake(4, 0.1);

  // Brown/green splat particles
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.5, maxLife: 0.5,
      color: Math.random() < 0.5 ? '#8B6914' : '#6B8E23',
      size: 3 + Math.random() * 3
    });
  }

  // Damage enemies in radius
  for (const e of enemies) {
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.hypot(ex - cx, ey - cy);
    if (dist < POOP_AOE_RADIUS) {
      e.hp -= POOP_DAMAGE;
      spawnDamageNumber(ex, e.y, POOP_DAMAGE, '#8B6914');
      e.flashTimer = 0.1;
      if (e.hp <= 0 && !e.dying) {
        e.dying = true;
        e.deathTimer = 0.4;
        S.score += e.type === 'brute' ? 30 : e.type === 'spitter' ? 20 : 10;
      }
    }
  }

  // Damage boss in radius (use closest point on boss hitbox)
  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = Math.max(boss.x, Math.min(cx, boss.x + boss.w));
    const by = Math.max(boss.y, Math.min(cy, boss.y + boss.h));
    const dist = Math.hypot(bx - cx, by - cy);
    if (dist < POOP_AOE_RADIUS) {
      const knockDir = Math.sign(bx - cx) || 1;
      damageBoss(POOP_DAMAGE, knockDir * 30, -20);
    }
  }
}

export function updatePoopBombs(dt) {
  const { poopBombs, enemies, boss, particles } = S;

  for (let i = poopBombs.length - 1; i >= 0; i--) {
    const b = poopBombs[i];
    if (!b.active) { poopBombs.splice(i, 1); continue; }

    b.vy += POOP_GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Trail particles
    if (Math.random() < 0.4) {
      particles.push({
        x: b.x + (Math.random() - 0.5) * 6,
        y: b.y - 2,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 0.3, maxLife: 0.3,
        color: Math.random() < 0.5 ? '#8B6914' : '#6B8E23', size: 2
      });
    }

    // Direct hit enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.dying) continue;
      if (Math.abs(b.x - (e.x + e.w / 2)) < e.w / 2 + POOP_SIZE &&
          Math.abs(b.y - (e.y + e.h / 2)) < e.h / 2 + POOP_SIZE) {
        b.active = false;
        poopAOEDamage(b.x, b.y);
        break;
      }
    }
    if (!b.active) continue;

    // Direct hit boss
    if (boss && !boss.dying && boss.state !== 'entering') {
      if (b.x > boss.x && b.x < boss.x + boss.w &&
          b.y > boss.y && b.y < boss.y + boss.h) {
        b.active = false;
        poopAOEDamage(b.x, b.y);
        continue;
      }
    }

    // Hit platform
    if (b.y >= PLATFORM_Y) {
      b.active = false;
      poopAOEDamage(b.x, PLATFORM_Y);
    }

    // Off screen
    if (b.y > H + 50 || b.x < -50 || b.x > W + 50) {
      poopBombs.splice(i, 1);
    }
  }
}

export function drawPoopBombs() {
  const ctx = S.ctx;
  for (const b of S.poopBombs) {
    if (!b.active) continue;
    ctx.save();
    // Glow
    ctx.shadowColor = '#8B6914';
    ctx.shadowBlur = 8;
    // Brown ellipse body
    ctx.fillStyle = '#6B4226';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, POOP_SIZE * 0.7, POOP_SIZE, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.ellipse(b.x - 2, b.y - 3, POOP_SIZE * 0.3, POOP_SIZE * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// SPIDER DROP REWARD (clutch escape from camp spider)
// ============================================================
// Note: The spider drop timer countdown and player positioning
// during spider drop mode are handled in the player update
// (updatePlayer). The spider drop is activated in effects.js
// (updateCampSpider) when the player escapes with a clutch.
// These functions provide the visual rendering for the state.

export function updateSpiderDrop(dt) {
  // Spider drop timer is decremented in updatePlayer as part of
  // the player cooldowns block (player.spiderDropTimer -= dt).
  // This function is a no-op stub kept for architectural symmetry
  // so the main loop can call updateSpiderDrop consistently.
}

export function drawSpiderDrop() {
  const ctx = S.ctx;
  const { player } = S;
  if (player.spiderDropTimer <= 0) return;

  const cx = player.x + PLAYER_W / 2;
  const cy = player.y + PLAYER_H / 2;
  const py = player.y;

  // Web thread from ceiling
  ctx.strokeStyle = 'rgba(200,200,200,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, py);
  ctx.stroke();

  // Purple spider aura
  const auraPhase = performance.now() * 0.007;
  const auraRadius = 50 + Math.sin(auraPhase) * 5;
  const auraAlpha = 0.2 + 0.1 * Math.sin(auraPhase * 2);
  ctx.strokeStyle = `rgba(180,60,255,${auraAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
  ctx.stroke();
}

// ============================================================
// SPIDER DROP REWARD ACTIVATION
// ============================================================
// Called from updateCampSpider when clutch escape triggers.
// The actual activation is in effects.js; this export lets
// other modules trigger it if needed.

export function spiderDropReward() {
  const { player } = S;
  player.spiderDropTimer = SPIDER_DROP_DURATION;
  player.y = SPIDER_DROP_Y;
  player.vy = 0;
  player.onGround = false;
  spawnParticles(player.x + PLAYER_W / 2, player.y, '#ff44ff', 20, 250, 0.6);
  addShake(10, 0.25);
  playSound('powerup');
}
