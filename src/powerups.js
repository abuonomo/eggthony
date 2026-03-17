import { S } from './state.js';
import {
  W, H, GRAVITY, PLATFORM_X, PLATFORM_W, PLATFORM_Y, PLAYER_W, PLAYER_H,
  METAL_DURATION, HAT_SIZE, MUSCLE_DURATION, SMOOTHIE_SIZE,
  WINGS_DURATION, WINGS_SIZE, POOP_DAMAGE, POOP_AOE_RADIUS, POOP_GRAVITY, POOP_SIZE,
  CHESTPLATE_SIZE, DWYER_DURATION, DWYER_W, DWYER_H, DWYER_SPEED,
  DWYER_ATTACK_RANGE, DWYER_ATTACK_DAMAGE, DWYER_ATTACK_COOLDOWN,
  DWYER_LANDING_AOE_RADIUS, DWYER_LANDING_DAMAGE,
  CHRIS_DURATION, BEER_CAN_SIZE, CHRIS_W, CHRIS_H, CHRIS_SPEED,
  CHRIS_THROW_RANGE, CHRIS_THROW_DAMAGE, CHRIS_THROW_COOLDOWN,
  CHRIS_CHUG_TIME, CHRIS_SPLASH_RADIUS, CHRIS_SPLASH_DAMAGE,
  CHRIS_CAN_SPEED, CHRIS_CAN_GRAVITY, CHRIS_ENTRY_SPEED, CHRIS_CHARGE_DAMAGE,
  HEART_SIZE, HEART_HEAL, HEART_SPEED, HEART_Y_MIN, HEART_Y_MAX,
  PLAYER_MAX_HP,
} from './constants.js';
import { random } from './rng.js';
import { playSound, playNoise, playVoice, playClip, dwyerClip } from './audio.js';
import {
  metalHatSprite, metalHatSpriteLoaded,
  smoothieSprite, smoothieSpriteLoaded,
  wingsPowerupSprite, wingsPowerupSpriteLoaded,
  chestplateSprite, chestplateSpriteLoaded,
  dwyerSprite, dwyerSpriteLoaded,
  swordSprite, swordSpriteLoaded,
  beerCanSprite, beerCanSpriteLoaded,
  chrisSprite, chrisSpriteLoaded,
  chrisDrinkingSprite, chrisDrinkingSpriteLoaded,
  crushedCanSprite, crushedCanSpriteLoaded,
} from './sprites.js';
import { spawnParticles, spawnDamageNumber, addShake } from './effects.js';
import { rectsOverlap } from './utils.js';
import { damageEnemy } from './enemies.js';
import { damageBoss } from './boss.js';

// ============================================================
// METAL HAT POWERUP
// ============================================================
export function spawnMetalHat() {
  const x = PLATFORM_X + 40 + random() * (PLATFORM_W - 80);
  S.metalHat = {
    x,
    y: -HAT_SIZE,
    vy: 60 + random() * 40,
    bobTimer: random() * Math.PI * 2,
    landed: false,
    landY: 0
  };
}

export function updateMetalHat(dt) {
  const { player, enemies, boss } = S;

  if (!S.metalHat) {
    // Spawn chance: once every ~20s on average, only during combat
    S.hatSpawnTimer -= dt;
    if (S.hatSpawnTimer <= 0 && (enemies.length > 0 || (boss && !boss.dying))) {
      const luck = S.gear.totalBuffs ? S.gear.totalBuffs.dropLuck : 0;
      S.hatSpawnTimer = (15 + random() * 10) * (1 - luck);
      spawnMetalHat();
    }
    return;
  }

  const hat = S.metalHat;

  if (!hat.landed) {
    hat.y += hat.vy * dt;
    // Land on platform
    if (hat.y + HAT_SIZE >= PLATFORM_Y) {
      hat.y = PLATFORM_Y - HAT_SIZE;
      hat.landed = true;
      hat.landY = hat.y;
    }
  } else {
    // Bob gently
    hat.bobTimer += dt * 3;
    hat.y = hat.landY + Math.sin(hat.bobTimer) * 3;
  }

  // Pickup collision (rect overlap -- center distance fails because player is tall)
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, hat.x - 4, hat.y - 4, HAT_SIZE + 8, HAT_SIZE + 8)) {
    player.metalTimer = METAL_DURATION;
    S.metalHat = null;
    spawnParticles(pcx, pcy, '#ccddff', 20, 150, 0.5);
    spawnParticles(pcx, pcy, '#ffffff', 10, 100, 0.4);
    addShake(5, 0.15);
    playVoice('win', true);
    playSound('roundStart');
  }
}

export function drawMetalHat() {
  if (!S.metalHat) return;
  const ctx = S.ctx;
  const hat = S.metalHat;
  const x = hat.x;
  const y = hat.y;

  ctx.save();
  ctx.shadowColor = '#88aaff';
  ctx.shadowBlur = 15;

  if (metalHatSpriteLoaded) {
    ctx.drawImage(metalHatSprite, x, y, HAT_SIZE, HAT_SIZE);
  } else {
    // Procedural fallback
    const glowAlpha = 0.3 + 0.15 * Math.sin(performance.now() * 0.005);
    // Hat brim
    ctx.fillStyle = '#889';
    ctx.fillRect(x - 3, y + HAT_SIZE - 5, HAT_SIZE + 6, 5);
    // Hat dome
    ctx.fillStyle = '#aab';
    ctx.beginPath();
    ctx.ellipse(x + HAT_SIZE / 2, y + HAT_SIZE - 6, HAT_SIZE * 0.4, HAT_SIZE * 0.6, 0, Math.PI, 0);
    ctx.fill();
    // Shine
    ctx.fillStyle = `rgba(200,220,255,${glowAlpha})`;
    ctx.fillRect(x + 4, y + 4, 4, 6);
  }

  ctx.restore();
}

// ============================================================
// BLUEBERRY SMOOTHIE POWERUP
// ============================================================
export function spawnSmoothie() {
  const x = PLATFORM_X + 40 + random() * (PLATFORM_W - 80);
  S.smoothie = {
    x,
    y: -SMOOTHIE_SIZE,
    vy: 50 + random() * 40,
    bobTimer: random() * Math.PI * 2,
    landed: false,
    landY: 0
  };
}

export function updateSmoothie(dt) {
  const { player, enemies, boss } = S;

  if (!S.smoothie) {
    S.smoothieSpawnTimer -= dt;
    if (S.smoothieSpawnTimer <= 0 && (enemies.length > 0 || (boss && !boss.dying))) {
      const luck = S.gear.totalBuffs ? S.gear.totalBuffs.dropLuck : 0;
      S.smoothieSpawnTimer = (20 + random() * 10) * (1 - luck);
      spawnSmoothie();
    }
    return;
  }

  const s = S.smoothie;

  if (!s.landed) {
    s.y += s.vy * dt;
    if (s.y + SMOOTHIE_SIZE >= PLATFORM_Y) {
      s.y = PLATFORM_Y - SMOOTHIE_SIZE;
      s.landed = true;
      s.landY = s.y;
    }
  } else {
    s.bobTimer += dt * 3;
    s.y = s.landY + Math.sin(s.bobTimer) * 3;
  }

  // Pickup collision (rect overlap -- center distance fails because player is tall)
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, s.x - 4, s.y - 4, SMOOTHIE_SIZE + 8, SMOOTHIE_SIZE + 8)) {
    player.muscleTimer = MUSCLE_DURATION;
    player.slamCooldown = 0;
    S.smoothie = null;
    spawnParticles(pcx, pcy, '#cc66ff', 20, 150, 0.5);
    spawnParticles(pcx, pcy, '#8844ff', 10, 100, 0.4);
    addShake(5, 0.15);
    playVoice('win', true);
    playSound('smoothiePickup');
  }
}

export function drawSmoothie() {
  if (!S.smoothie) return;
  const ctx = S.ctx;
  const s = S.smoothie;
  const x = s.x;
  const y = s.y;
  const sz = SMOOTHIE_SIZE;

  ctx.save();
  ctx.shadowColor = '#aa66ff';
  ctx.shadowBlur = 15;

  if (smoothieSpriteLoaded) {
    ctx.drawImage(smoothieSprite, x, y, sz, sz);
  } else {
    // Procedural fallback
    const glowAlpha = 0.3 + 0.15 * Math.sin(performance.now() * 0.005);
    // Cup body (blue-purple gradient look)
    ctx.fillStyle = '#6633cc';
    ctx.fillRect(x + 2, y + sz * 0.3, sz - 4, sz * 0.65);
    // Cup top (lighter)
    ctx.fillStyle = '#8855ee';
    ctx.fillRect(x + 1, y + sz * 0.25, sz - 2, sz * 0.15);
    // Smoothie surface (blueberry color)
    ctx.fillStyle = '#5522aa';
    ctx.fillRect(x + 3, y + sz * 0.3, sz - 6, sz * 0.1);
    // Cup bottom (slightly narrower)
    ctx.fillStyle = '#5528bb';
    ctx.fillRect(x + 3, y + sz * 0.85, sz - 6, sz * 0.1);

    // Straw
    ctx.strokeStyle = '#ffccee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + sz * 0.6, y + sz * 0.3);
    ctx.lineTo(x + sz * 0.7, y);
    ctx.stroke();

    // Glow highlight
    ctx.fillStyle = `rgba(180,140,255,${glowAlpha})`;
    ctx.fillRect(x + 4, y + sz * 0.35, 3, 5);
  }

  ctx.restore();
}

// ============================================================
// WINGS POWERUP
// ============================================================
export function spawnWings() {
  const x = PLATFORM_X + 40 + random() * (PLATFORM_W - 80);
  S.wingsItem = {
    x,
    y: -WINGS_SIZE,
    vy: 50 + random() * 40,
    bobTimer: random() * Math.PI * 2,
    landed: false,
    landY: 0
  };
}

export function updateWings(dt) {
  const { player, enemies, boss } = S;

  if (!S.wingsItem) {
    S.wingsSpawnTimer -= dt;
    if (S.wingsSpawnTimer <= 0 && (enemies.length > 0 || (boss && !boss.dying))) {
      const luck = S.gear.totalBuffs ? S.gear.totalBuffs.dropLuck : 0;
      S.wingsSpawnTimer = (25 + random() * 15) * (1 - luck);
      spawnWings();
    }
    return;
  }

  const w = S.wingsItem;

  if (!w.landed) {
    w.y += w.vy * dt;
    if (w.y + WINGS_SIZE >= PLATFORM_Y) {
      w.y = PLATFORM_Y - WINGS_SIZE;
      w.landed = true;
      w.landY = w.y;
    }
  } else {
    w.bobTimer += dt * 3;
    w.y = w.landY + Math.sin(w.bobTimer) * 3;
  }

  // Pickup collision
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, w.x - 4, w.y - 4, WINGS_SIZE + 8, WINGS_SIZE + 8)) {
    player.wingsTimer = WINGS_DURATION;
    S.wingsItem = null;
    spawnParticles(pcx, pcy, '#ffdd88', 20, 150, 0.5);
    spawnParticles(pcx, pcy, '#ffffff', 10, 100, 0.4);
    addShake(5, 0.15);
    playVoice('win', true);
    playSound('wingsPickup');
  }
}

export function drawWings() {
  if (!S.wingsItem) return;
  const ctx = S.ctx;
  const w = S.wingsItem;
  const x = w.x;
  const y = w.y;
  const sz = WINGS_SIZE;

  ctx.save();
  ctx.shadowColor = '#ffcc44';
  ctx.shadowBlur = 15;

  if (wingsPowerupSpriteLoaded) {
    ctx.drawImage(wingsPowerupSprite, x, y, sz, sz);
  } else {
    // Procedural fallback -- golden wing shape
    const glowAlpha = 0.3 + 0.15 * Math.sin(performance.now() * 0.005);
    ctx.fillStyle = '#ffdd66';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(x + sz / 2, y + sz * 0.4);
    ctx.quadraticCurveTo(x, y, x + 2, y + sz * 0.7);
    ctx.quadraticCurveTo(x + sz * 0.3, y + sz * 0.6, x + sz / 2, y + sz * 0.4);
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(x + sz / 2, y + sz * 0.4);
    ctx.quadraticCurveTo(x + sz, y, x + sz - 2, y + sz * 0.7);
    ctx.quadraticCurveTo(x + sz * 0.7, y + sz * 0.6, x + sz / 2, y + sz * 0.4);
    ctx.fill();
    // Center body
    ctx.fillStyle = '#ffe088';
    ctx.beginPath();
    ctx.arc(x + sz / 2, y + sz * 0.5, sz * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Glow highlight
    ctx.fillStyle = `rgba(255,255,200,${glowAlpha})`;
    ctx.fillRect(x + sz * 0.3, y + sz * 0.3, 4, 5);
  }

  ctx.restore();
}

// ============================================================
// CHESTPLATE POWERUP + DWYER ALLY
// ============================================================
export function spawnChestplate() {
  const x = PLATFORM_X + 40 + random() * (PLATFORM_W - 80);
  S.chestplateItem = {
    x,
    y: -CHESTPLATE_SIZE,
    vy: 55 + random() * 40,
    bobTimer: random() * Math.PI * 2,
    landed: false,
    landY: 0
  };
}

export function updateChestplate(dt) {
  const { player, enemies, boss, round } = S;

  if (!S.chestplateItem) {
    S.chestplateSpawnTimer -= dt;
    if (S.chestplateSpawnTimer <= 0 && round >= 4 && !S.dwyer && !S.chris && !S.beerCanItem && (enemies.length > 0 || (boss && !boss.dying))) {
      const luck = S.gear.totalBuffs ? S.gear.totalBuffs.dropLuck : 0;
      S.chestplateSpawnTimer = (30 + random() * 15) * (1 - luck);
      if (random() < 0.5) {
        spawnChestplate();
      } else {
        spawnBeerCan();
      }
    }
    return;
  }

  const c = S.chestplateItem;

  if (!c.landed) {
    c.y += c.vy * dt;
    if (c.y + CHESTPLATE_SIZE >= PLATFORM_Y) {
      c.y = PLATFORM_Y - CHESTPLATE_SIZE;
      c.landed = true;
      c.landY = c.y;
    }
  } else {
    c.bobTimer += dt * 3;
    c.y = c.landY + Math.sin(c.bobTimer) * 3;
  }

  // Pickup collision
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, c.x - 4, c.y - 4, CHESTPLATE_SIZE + 8, CHESTPLATE_SIZE + 8)) {
    S.dwyer = createDwyer();
    S.chestplateItem = null;
    const pcx = player.x + PLAYER_W / 2;
    const pcy = player.y + PLAYER_H / 2;
    spawnParticles(pcx, pcy, '#ddaa44', 12, 120, 0.4);
    addShake(3, 0.1);
    playClip(dwyerClip);
    playSound('roundStart');
  }
}

export function drawChestplate() {
  if (!S.chestplateItem) return;
  const ctx = S.ctx;
  const c = S.chestplateItem;
  const x = c.x;
  const y = c.y;
  const sz = CHESTPLATE_SIZE;

  ctx.save();
  ctx.shadowColor = '#ddaa44';
  ctx.shadowBlur = 15;

  if (chestplateSpriteLoaded) {
    ctx.drawImage(chestplateSprite, x, y, sz, sz);
  } else {
    // Procedural fallback -- golden chestplate
    const glowAlpha = 0.3 + 0.15 * Math.sin(performance.now() * 0.005);
    ctx.fillStyle = '#bb8833';
    ctx.fillRect(x + 4, y + 6, sz - 8, sz - 10);
    ctx.fillStyle = '#ddaa44';
    ctx.fillRect(x + 6, y + 8, sz - 12, sz - 14);
    ctx.fillStyle = `rgba(255,220,120,${glowAlpha})`;
    ctx.fillRect(x + 8, y + 10, 5, 6);
  }

  ctx.restore();
}

// ============================================================
// DWYER ALLY
// ============================================================
export function createDwyer() {
  const { player } = S;
  // Pick a landing X near center of platform (avoid edges)
  const landX = PLATFORM_X + 60 + random() * (PLATFORM_W - 120);
  return {
    x: landX,
    y: -DWYER_H - 60,   // start way above screen
    vx: 0,
    vy: 0,
    w: DWYER_W,
    h: DWYER_H,
    timer: DWYER_DURATION,
    facingRight: player.facingRight || true,
    attackCooldown: 0,
    attacking: false,
    attackTimer: 0,
    onPlatform: false,
    // Dramatic entrance state
    entering: true,
    landingShockwave: 0,  // 0 = not yet, >0 = expanding ring timer
    entryTrailTimer: 0
  };
}

function dwyerLandingAOE() {
  const { enemies, boss, particles } = S;
  const d = S.dwyer;
  const cx = d.x + d.w / 2;
  const cy = PLATFORM_Y;

  // Massive screen shake
  addShake(18, 0.5);
  playSound('slam');
  playNoise(0.3, 0.25);

  // Huge particle explosion -- gold, red, white
  spawnParticles(cx, cy, '#ffdd44', 35, 300, 0.8);
  spawnParticles(cx, cy, '#cc3333', 25, 250, 0.7);
  spawnParticles(cx, cy, '#ffffff', 15, 200, 0.5);
  // Ground dust ring
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const speed = 150 + random() * 200;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.4 - 60,
      life: 0.7, maxLife: 0.7,
      color: random() < 0.5 ? '#ddaa44' : '#aa7733',
      size: 3 + random() * 4
    });
  }

  // Damage all enemies in AOE
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.hypot(ex - cx, ey - cy);
    if (dist < DWYER_LANDING_AOE_RADIUS) {
      const knockDir = ex > cx ? 1 : -1;
      const knockScale = 1 - dist / DWYER_LANDING_AOE_RADIUS;
      damageEnemy(i, DWYER_LANDING_DAMAGE, knockDir * 300 * knockScale, -200 * knockScale);
    }
  }

  // Damage boss in AOE
  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = boss.x + boss.w / 2;
    const by = boss.y + boss.h / 2;
    const dist = Math.hypot(bx - cx, by - cy);
    if (dist < DWYER_LANDING_AOE_RADIUS) {
      const knockDir = bx > cx ? 1 : -1;
      damageBoss(DWYER_LANDING_DAMAGE, knockDir * 200, 0);
    }
  }

  // Start shockwave ring visual
  d.landingShockwave = 0.5;
  d.shockwaveX = cx;
  d.shockwaveY = cy;
}

export function updateDwyer(dt) {
  if (!S.dwyer) return;
  const d = S.dwyer;
  const { player, enemies, boss, particles } = S;

  // Shockwave ring timer (visual only, ticks even during entering)
  if (d.landingShockwave > 0) {
    d.landingShockwave -= dt;
  }

  // === ENTERING STATE: falling from sky ===
  if (d.entering) {
    // Accelerate downward (fast dramatic drop)
    d.vy += 2800 * dt;
    d.y += d.vy * dt;

    // Trail particles while falling
    d.entryTrailTimer -= dt;
    if (d.entryTrailTimer <= 0 && d.y > -DWYER_H) {
      d.entryTrailTimer = 0.02;
      const cx = d.x + d.w / 2;
      particles.push({
        x: cx + (random() - 0.5) * 20,
        y: d.y + d.h,
        vx: (random() - 0.5) * 40,
        vy: -80 - random() * 60,
        life: 0.35, maxLife: 0.35,
        color: random() < 0.5 ? '#ffdd44' : '#ff6633',
        size: 3 + random() * 3
      });
    }

    // Land on platform
    if (d.y + d.h >= PLATFORM_Y) {
      d.y = PLATFORM_Y - d.h;
      d.vy = 0;
      d.onPlatform = true;
      d.entering = false;
      dwyerLandingAOE();
    }
    return;
  }

  d.timer -= dt;
  if (d.timer <= 0) {
    // Despawn with poof particles
    spawnParticles(d.x + d.w / 2, d.y + d.h / 2, '#ddaa44', 15, 150, 0.5);
    spawnParticles(d.x + d.w / 2, d.y + d.h / 2, '#cc3333', 8, 100, 0.4);
    S.dwyer = null;
    return;
  }

  // Attack cooldown
  if (d.attackCooldown > 0) d.attackCooldown -= dt;
  if (d.attackTimer > 0) d.attackTimer -= dt;

  // Gravity
  d.vy += 1400 * dt;
  d.y += d.vy * dt;

  // Land on main platform
  if (d.y + d.h >= PLATFORM_Y) {
    d.y = PLATFORM_Y - d.h;
    d.vy = 0;
    d.onPlatform = true;
  }

  // Find nearest target (enemy or boss)
  let targetX = null;
  let targetY = null;
  let targetDist = Infinity;
  let targetIsEnemy = false;
  let targetIndex = -1;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.abs(ex - (d.x + d.w / 2));
    if (dist < targetDist) {
      targetDist = dist;
      targetX = ex;
      targetY = ey;
      targetIsEnemy = true;
      targetIndex = i;
    }
  }

  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = boss.x + boss.w / 2;
    const dist = Math.abs(bx - (d.x + d.w / 2));
    if (dist < targetDist) {
      targetDist = dist;
      targetX = bx;
      targetY = boss.y + boss.h / 2;
      targetIsEnemy = false;
      targetIndex = -1;
    }
  }

  // Movement: follow player if no target nearby, or approach target
  const dwyerCx = d.x + d.w / 2;
  if (targetX !== null && targetDist < 300) {
    // Move toward target
    if (targetDist > DWYER_ATTACK_RANGE) {
      const dir = targetX > dwyerCx ? 1 : -1;
      d.vx = dir * DWYER_SPEED;
      d.facingRight = dir > 0;
    } else {
      // In attack range -- stop and attack
      d.vx = 0;
      d.facingRight = targetX > dwyerCx;

      if (d.attackCooldown <= 0) {
        d.attacking = true;
        d.attackTimer = 0.3;
        d.attackCooldown = DWYER_ATTACK_COOLDOWN;

        if (targetIsEnemy && targetIndex >= 0) {
          const e = enemies[targetIndex];
          const knockDir = e.x + e.w / 2 > dwyerCx ? 1 : -1;
          damageEnemy(targetIndex, DWYER_ATTACK_DAMAGE, knockDir * 150, -80);
        } else if (boss && !boss.dying) {
          const knockDir = boss.x + boss.w / 2 > dwyerCx ? 1 : -1;
          damageBoss(DWYER_ATTACK_DAMAGE, knockDir * 100, 0);
        }

        playSound('punch');
        spawnParticles(
          dwyerCx + (d.facingRight ? 30 : -30),
          d.y + d.h * 0.4,
          '#ffcc44', 5, 80, 0.2
        );
      }
    }
  } else {
    // Follow player
    const playerCx = player.x + PLAYER_W / 2;
    const followDist = Math.abs(playerCx - dwyerCx);
    if (followDist > 50) {
      const dir = playerCx > dwyerCx ? 1 : -1;
      d.vx = dir * DWYER_SPEED;
      d.facingRight = dir > 0;
    } else {
      d.vx = 0;
    }
  }

  d.x += d.vx * dt;

  // Clamp to platform edges
  if (d.x < PLATFORM_X) d.x = PLATFORM_X;
  if (d.x + d.w > PLATFORM_X + PLATFORM_W) d.x = PLATFORM_X + PLATFORM_W - d.w;
}

export function drawDwyer() {
  if (!S.dwyer) return;
  const ctx = S.ctx;
  const d = S.dwyer;

  // Blink warning when about to expire (not during entering)
  if (!d.entering && d.timer < 2 && Math.floor(d.timer * 8) % 2 === 0) return;

  ctx.save();

  const dx = d.x;
  const dy = d.y;

  // Entry drop: draw speed lines behind Dwyer while falling
  if (d.entering && d.y > -DWYER_H) {
    ctx.save();
    const trailAlpha = Math.min(1, d.vy / 600);
    ctx.strokeStyle = `rgba(255,200,60,${trailAlpha * 0.6})`;
    ctx.lineWidth = 3;
    const cx = dx + d.w / 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 12, dy - 5);
      ctx.lineTo(cx + i * 12, dy - 40 - random() * 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw sprite or procedural fallback
  if (dwyerSpriteLoaded) {
    ctx.save();
    if (!d.facingRight) {
      ctx.translate(dx + d.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(dwyerSprite, 0, 0, d.w, d.h);
    } else {
      ctx.drawImage(dwyerSprite, dx, dy, d.w, d.h);
    }
    ctx.restore();
  } else {
    // Procedural fallback -- cube-ish Roman soldier
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(dx + 12, dy + 12, d.w - 24, d.h - 24);
    ctx.fillStyle = '#ddaa44';
    ctx.fillRect(dx + 18, dy + 5, d.w - 36, 20); // helmet
    ctx.fillStyle = '#fff';
    const eyeX = d.facingRight ? dx + d.w - 30 : dx + 18;
    ctx.fillRect(eyeX, dy + 38, 10, 10);
  }

  // Sword -- swings during attack, held at side otherwise
  if (!d.entering) {
    const swordSize = 50;
    const pivotX = d.facingRight ? dx + d.w - 10 : dx + 10;
    const pivotY = dy + d.h * 0.4;
    const flipX = d.facingRight ? 1 : -1;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.scale(flipX, 1);

    if (d.attackTimer > 0) {
      // Swing arc: rotate from raised (-90deg) to slashed forward (+30deg)
      const swingProgress = 1 - d.attackTimer / 0.3;
      const swingAngle = -Math.PI * 0.5 + swingProgress * Math.PI * 0.65;
      ctx.rotate(swingAngle);

      // Slash trail arc behind the sword
      const trailAlpha = d.attackTimer / 0.3 * 0.6;
      ctx.strokeStyle = `rgba(255,220,100,${trailAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, swordSize * 0.8, -Math.PI * 0.5, swingAngle, false);
      ctx.stroke();
    } else {
      // Idle: held down at a slight angle
      ctx.rotate(Math.PI * 0.15);
    }

    if (swordSpriteLoaded) {
      ctx.drawImage(swordSprite, -6, -swordSize + 8, swordSize, swordSize);
    } else {
      // Procedural fallback -- simple blade shape
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(-3, -swordSize + 8, 6, swordSize * 0.65);
      ctx.fillStyle = '#ddaa44';
      ctx.fillRect(-5, -swordSize + 8 + swordSize * 0.65, 10, 8);
    }

    ctx.restore();
  }

  // Landing shockwave ring
  if (d.landingShockwave > 0) {
    const t = 1 - d.landingShockwave / 0.5; // 0->1 as ring expands
    const radius = DWYER_LANDING_AOE_RADIUS * t;
    const alpha = (1 - t) * 0.8;
    ctx.save();
    // Outer ring
    ctx.strokeStyle = `rgba(255,200,60,${alpha})`;
    ctx.lineWidth = 4 + (1 - t) * 6;
    ctx.beginPath();
    ctx.arc(d.shockwaveX, d.shockwaveY, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Inner glow ring
    ctx.strokeStyle = `rgba(255,255,200,${alpha * 0.5})`;
    ctx.lineWidth = 2 + (1 - t) * 3;
    ctx.beginPath();
    ctx.arc(d.shockwaveX, d.shockwaveY, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    // Ground flash
    if (t < 0.3) {
      const flashAlpha = (0.3 - t) / 0.3 * 0.4;
      ctx.fillStyle = `rgba(255,220,100,${flashAlpha})`;
      ctx.fillRect(d.shockwaveX - DWYER_LANDING_AOE_RADIUS, d.shockwaveY - 8, DWYER_LANDING_AOE_RADIUS * 2, 16);
    }
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================
// BEER CAN PICKUP + EAGER CHRIS ALLY
// ============================================================
export function spawnBeerCan() {
  const x = PLATFORM_X + 40 + random() * (PLATFORM_W - 80);
  S.beerCanItem = {
    x,
    y: -BEER_CAN_SIZE,
    vy: 55 + random() * 40,
    bobTimer: random() * Math.PI * 2,
    landed: false,
    landY: 0
  };
}

export function updateBeerCan(dt) {
  if (!S.beerCanItem) return;

  const b = S.beerCanItem;
  const { player } = S;

  if (!b.landed) {
    b.y += b.vy * dt;
    if (b.y + BEER_CAN_SIZE >= PLATFORM_Y) {
      b.y = PLATFORM_Y - BEER_CAN_SIZE;
      b.landed = true;
      b.landY = b.y;
    }
  } else {
    b.bobTimer += dt * 3;
    b.y = b.landY + Math.sin(b.bobTimer) * 3;
  }

  // Pickup collision
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, b.x - 4, b.y - 4, BEER_CAN_SIZE + 8, BEER_CAN_SIZE + 8)) {
    S.chris = createChris();
    S.beerCanItem = null;
    const pcx = player.x + PLAYER_W / 2;
    const pcy = player.y + PLAYER_H / 2;
    spawnParticles(pcx, pcy, '#dd8822', 12, 120, 0.4);
    addShake(3, 0.1);
    playVoice('chris', true);
    playSound('roundStart');
  }
}

export function drawBeerCan() {
  if (!S.beerCanItem) return;
  const ctx = S.ctx;
  const b = S.beerCanItem;
  const x = b.x;
  const y = b.y;
  const sz = BEER_CAN_SIZE;

  ctx.save();
  ctx.shadowColor = '#dd8822';
  ctx.shadowBlur = 15;

  if (beerCanSpriteLoaded) {
    // Preserve aspect ratio — source is 2:3 (taller than wide)
    const aspect = beerCanSprite.naturalWidth / beerCanSprite.naturalHeight;
    const drawW = sz * aspect;
    ctx.drawImage(beerCanSprite, x + (sz - drawW) / 2, y, drawW, sz);
  } else {
    // Procedural fallback — tall can shape
    const canW = sz * 0.6;
    const canX = x + (sz - canW) / 2;
    ctx.fillStyle = '#cc7700';
    ctx.fillRect(canX, y + 2, canW, sz - 4);
    ctx.fillStyle = '#ddaa44';
    ctx.fillRect(canX + 2, y + 4, canW - 4, 6);
    ctx.fillStyle = '#eebb55';
    ctx.fillRect(canX + 4, y + sz * 0.3, 4, 5);
  }

  ctx.restore();
}

// ============================================================
// EAGER CHRIS ALLY
// ============================================================
export function createChris() {
  const { player } = S;
  // Spawn on opposite side from player
  const playerCx = player.x + PLAYER_W / 2;
  const fromLeft = playerCx > W / 2;
  const startX = fromLeft ? -CHRIS_W : W;
  // Target: charge about 2/3 across the platform
  const targetX = fromLeft
    ? PLATFORM_X + PLATFORM_W * 0.37 + random() * (PLATFORM_W * 0.17)
    : PLATFORM_X + PLATFORM_W * 0.47 + random() * (PLATFORM_W * 0.17);

  return {
    x: startX,
    y: PLATFORM_Y - CHRIS_H,
    vx: 0,
    w: CHRIS_W,
    h: CHRIS_H,
    timer: CHRIS_DURATION,
    facingRight: fromLeft,
    attackCooldown: 0,
    chugging: false,
    chugTimer: 0,
    // Charging entry state
    entering: true,
    entryTarget: targetX,
    entryTrailTimer: 0,
  };
}

function chrisChargeHit(chris) {
  const { enemies, boss, particles } = S;
  const cx = chris.x + chris.w / 2;
  const cy = chris.y + chris.h / 2;

  // Damage enemies Chris runs through
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dying) continue;
    if (rectsOverlap(chris.x, chris.y, chris.w, chris.h, e.x, e.y, e.w, e.h)) {
      const knockDir = chris.facingRight ? 1 : -1;
      damageEnemy(i, CHRIS_CHARGE_DAMAGE, knockDir * 250, -150);
    }
  }

  // Damage boss
  if (boss && !boss.dying && boss.state !== 'entering') {
    if (rectsOverlap(chris.x, chris.y, chris.w, chris.h, boss.x, boss.y, boss.w, boss.h)) {
      const knockDir = chris.facingRight ? 1 : -1;
      damageBoss(CHRIS_CHARGE_DAMAGE, knockDir * 150, 0);
    }
  }
}

export function updateChris(dt) {
  if (!S.chris) return;
  const c = S.chris;
  const { player, enemies, boss, particles } = S;

  // === ENTERING STATE: charging from side ===
  if (c.entering) {
    const speed = CHRIS_ENTRY_SPEED * (c.facingRight ? 1 : -1);
    c.x += speed * dt;

    // Dust trail particles
    c.entryTrailTimer -= dt;
    if (c.entryTrailTimer <= 0) {
      c.entryTrailTimer = 0.03;
      const trailX = c.facingRight ? c.x : c.x + c.w;
      particles.push({
        x: trailX + (random() - 0.5) * 10,
        y: c.y + c.h - 5,
        vx: (c.facingRight ? -1 : 1) * (40 + random() * 30),
        vy: -20 - random() * 30,
        life: 0.3, maxLife: 0.3,
        color: random() < 0.5 ? '#aa8855' : '#ccaa77',
        size: 2 + random() * 3
      });
    }

    // Hit enemies during charge
    chrisChargeHit(c);

    // Check if reached target
    if ((c.facingRight && c.x >= c.entryTarget) || (!c.facingRight && c.x <= c.entryTarget)) {
      c.x = c.entryTarget;
      c.entering = false;
      addShake(6, 0.2);
      spawnParticles(c.x + c.w / 2, c.y + c.h, '#aa8855', 10, 100, 0.3);
    }
    return;
  }

  c.timer -= dt;
  if (c.timer <= 0) {
    // Despawn with poof
    spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#dd8822', 15, 150, 0.5);
    spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffaa44', 8, 100, 0.4);
    S.chris = null;
    return;
  }

  // Attack cooldown
  if (c.attackCooldown > 0) c.attackCooldown -= dt;

  // Chugging timer
  if (c.chugging) {
    c.chugTimer -= dt;
    if (c.chugTimer <= 0) {
      c.chugging = false;
      // Throw the crushed can
      throwCrushedCan(c);
      playSound('beerThrow');
      c.attackCooldown = CHRIS_THROW_COOLDOWN;
    }
    return; // Don't move while chugging
  }

  // Find nearest target
  let targetX = null;
  let targetDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const dist = Math.abs(ex - (c.x + c.w / 2));
    if (dist < targetDist) {
      targetDist = dist;
      targetX = ex;
    }
  }

  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = boss.x + boss.w / 2;
    const dist = Math.abs(bx - (c.x + c.w / 2));
    if (dist < targetDist) {
      targetDist = dist;
      targetX = bx;
    }
  }

  const chrisCx = c.x + c.w / 2;

  if (targetX !== null && targetDist < 400) {
    if (targetDist > CHRIS_THROW_RANGE) {
      // Move toward target
      const dir = targetX > chrisCx ? 1 : -1;
      c.x += dir * CHRIS_SPEED * dt;
      c.facingRight = dir > 0;
    } else if (c.attackCooldown <= 0) {
      // In throw range and ready — start chugging
      c.facingRight = targetX > chrisCx;
      c.chugging = true;
      c.chugTimer = CHRIS_CHUG_TIME;
      playSound('beerGulp');
    } else {
      // In range but on cooldown — strafe a bit to reposition
      c.facingRight = targetX > chrisCx;
      const playerCx = player.x + PLAYER_W / 2;
      const driftDir = playerCx > chrisCx ? 1 : -1;
      c.x += driftDir * CHRIS_SPEED * 0.4 * dt;
    }
  } else {
    // Follow player loosely
    const playerCx = player.x + PLAYER_W / 2;
    const followDist = Math.abs(playerCx - chrisCx);
    if (followDist > 80) {
      const dir = playerCx > chrisCx ? 1 : -1;
      c.x += dir * CHRIS_SPEED * dt;
      c.facingRight = dir > 0;
    }
  }

  // Clamp to platform edges
  if (c.x < PLATFORM_X) c.x = PLATFORM_X;
  if (c.x + c.w > PLATFORM_X + PLATFORM_W) c.x = PLATFORM_X + PLATFORM_W - c.w;
}

function throwCrushedCan(chris) {
  // Find nearest target for aiming
  const { enemies, boss } = S;
  const cx = chris.x + chris.w / 2;
  const cy = chris.y + chris.h * 0.3;
  let targetX = cx + (chris.facingRight ? CHRIS_THROW_RANGE : -CHRIS_THROW_RANGE);
  let targetY = PLATFORM_Y - 30;
  let bestDist = Infinity;

  for (const e of enemies) {
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.hypot(ex - cx, ey - cy);
    if (dist < bestDist) {
      bestDist = dist;
      targetX = ex;
      targetY = ey;
    }
  }

  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = boss.x + boss.w / 2;
    const by = boss.y + boss.h / 2;
    const dist = Math.hypot(bx - cx, by - cy);
    if (dist < bestDist) {
      targetX = bx;
      targetY = by;
    }
  }

  // Fixed-arc throw: guarantee a visible arc regardless of distance
  const dx = targetX - cx;
  const dy = targetY - cy;
  const arcHeight = Math.max(120, Math.abs(dx) * 0.4);
  // Launch upward to reach arcHeight above start
  const vy = -Math.sqrt(2 * CHRIS_CAN_GRAVITY * arcHeight);
  // Time up to peak, then down from peak to target y
  const tUp = Math.abs(vy) / CHRIS_CAN_GRAVITY;
  const fallFromPeak = arcHeight + dy; // total fall distance from peak to target
  const tDown = Math.sqrt(2 * Math.max(0, fallFromPeak) / CHRIS_CAN_GRAVITY);
  const totalTime = tUp + tDown;
  const vx = dx / (totalTime || 0.5);

  S.chrisCans.push({
    x: cx,
    y: cy,
    vx,
    vy,
    spin: 0,
    spinSpeed: (random() - 0.5) * 20,
    alive: true,
  });
}

export function updateChrisCans(dt) {
  const { enemies, boss, particles } = S;

  for (let i = S.chrisCans.length - 1; i >= 0; i--) {
    const can = S.chrisCans[i];
    can.vy += CHRIS_CAN_GRAVITY * dt;
    can.x += can.vx * dt;
    can.y += can.vy * dt;
    can.spin += can.spinSpeed * dt;

    // Check collision with enemies
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.dying) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dist = Math.hypot(ex - can.x, ey - can.y);
      if (dist < 30) {
        hit = true;
        beerSplashDamage(can.x, can.y);
        break;
      }
    }

    // Check collision with boss
    if (!hit && boss && !boss.dying && boss.state !== 'entering') {
      if (can.x >= boss.x && can.x <= boss.x + boss.w &&
          can.y >= boss.y && can.y <= boss.y + boss.h) {
        hit = true;
        beerSplashDamage(can.x, can.y);
      }
    }

    // Hit ground
    if (!hit && can.y >= PLATFORM_Y) {
      hit = true;
      beerSplashDamage(can.x, PLATFORM_Y);
    }

    // Off screen
    if (!hit && (can.x < -50 || can.x > W + 50 || can.y > H + 50)) {
      hit = true;
    }

    if (hit) {
      S.chrisCans.splice(i, 1);
    }
  }
}

function beerSplashDamage(x, y) {
  const { enemies, boss } = S;
  playSound('beerSplash');

  // Amber splash particles
  spawnParticles(x, y, '#dd8822', 12, 120, 0.4);
  spawnParticles(x, y, '#ffaa44', 8, 80, 0.3);

  // Direct hit damage to enemies in splash radius
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dying) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.hypot(ex - x, ey - y);
    if (dist < CHRIS_SPLASH_RADIUS) {
      const knockDir = ex > x ? 1 : -1;
      const dmg = dist < 30 ? CHRIS_THROW_DAMAGE : CHRIS_SPLASH_DAMAGE;
      damageEnemy(i, dmg, knockDir * 120, -80);
    }
  }

  // Damage boss
  if (boss && !boss.dying && boss.state !== 'entering') {
    const bx = boss.x + boss.w / 2;
    const by = boss.y + boss.h / 2;
    const dist = Math.hypot(bx - x, by - y);
    if (dist < CHRIS_SPLASH_RADIUS) {
      const knockDir = bx > x ? 1 : -1;
      const dmg = dist < 30 ? CHRIS_THROW_DAMAGE : CHRIS_SPLASH_DAMAGE;
      damageBoss(dmg, knockDir * 80, 0);
    }
  }
}

export function drawChris() {
  if (!S.chris) return;
  const ctx = S.ctx;
  const c = S.chris;

  // Blink warning when about to expire (not during entering)
  if (!c.entering && c.timer < 2 && Math.floor(c.timer * 8) % 2 === 0) return;

  ctx.save();

  const dx = c.x;
  // Anchor feet to platform
  const dy = PLATFORM_Y - c.h;

  // Use drinking sprite while chugging, otherwise normal sprite
  const sprite = c.chugging ? chrisDrinkingSprite : chrisSprite;
  const spriteReady = c.chugging ? chrisDrinkingSpriteLoaded : chrisSpriteLoaded;

  if (spriteReady) {
    // Draw preserving aspect ratio, anchored to platform bottom
    const aspect = sprite.naturalWidth / sprite.naturalHeight;
    const drawH = c.h;
    const drawW = drawH * aspect;
    const drawX = dx + (c.w - drawW) / 2;
    ctx.save();
    if (!c.facingRight) {
      ctx.translate(drawX + drawW, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, drawW, drawH);
    } else {
      ctx.drawImage(sprite, drawX, dy, drawW, drawH);
    }
    ctx.restore();
  } else {
    // Procedural fallback — dude shape
    ctx.fillStyle = c.chugging ? '#dd8822' : '#cc6644';
    ctx.fillRect(dx + 12, dy + 12, c.w - 24, c.h - 24);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(dx + 20, dy + 8, c.w - 40, 24); // head
    ctx.fillStyle = '#fff';
    const eyeX = c.facingRight ? dx + c.w - 32 : dx + 20;
    ctx.fillRect(eyeX, dy + 16, 8, 8);
    if (c.chugging) {
      // Beer can in hand
      ctx.fillStyle = '#ddaa44';
      ctx.fillRect(c.facingRight ? dx + c.w - 10 : dx - 6, dy + 20, 16, 24);
    }
  }

  // Dust trail during entry charge
  if (c.entering) {
    ctx.save();
    const trailAlpha = 0.5;
    ctx.strokeStyle = `rgba(170,136,85,${trailAlpha})`;
    ctx.lineWidth = 2;
    const baseX = c.facingRight ? dx : dx + c.w;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(baseX, dy + c.h - 10 + i * 8);
      ctx.lineTo(baseX + (c.facingRight ? -30 : 30) - random() * 15, dy + c.h - 10 + i * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================
// HEALTH HEART PICKUP
// ============================================================
export function updateHeart(dt) {
  const { player, enemies, boss } = S;

  if (!S.heartItem) {
    S.heartSpawnTimer -= dt;
    if (S.heartSpawnTimer <= 0 && player.hp < PLAYER_MAX_HP && (enemies.length > 0 || (boss && !boss.dying))) {
      const luck = S.gear.totalBuffs ? S.gear.totalBuffs.dropLuck : 0;
      S.heartSpawnTimer = (25 + random() * 15) * (1 - luck);
      // Spawn from left or right edge, floating near top of screen
      const fromLeft = random() < 0.5;
      S.heartItem = {
        x: fromLeft ? -HEART_SIZE : W + HEART_SIZE,
        y: HEART_Y_MIN + random() * (HEART_Y_MAX - HEART_Y_MIN),
        dir: fromLeft ? 1 : -1,
        bobTimer: random() * Math.PI * 2,
      };
    }
    return;
  }

  const h = S.heartItem;
  h.x += h.dir * HEART_SPEED * dt;
  h.bobTimer += dt * 5;

  // Off screen — missed it
  if ((h.dir > 0 && h.x > W + HEART_SIZE) || (h.dir < 0 && h.x < -HEART_SIZE)) {
    S.heartItem = null;
    return;
  }

  // Pickup collision
  const bobY = h.y + Math.sin(h.bobTimer) * 6;
  if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, h.x - HEART_SIZE / 2, bobY - HEART_SIZE / 2, HEART_SIZE, HEART_SIZE)) {
    const heal = Math.min(HEART_HEAL, PLAYER_MAX_HP - player.hp);
    player.hp += heal;
    spawnDamageNumber(player.x + PLAYER_W / 2, player.y, '+' + heal, '#44ff44');
    spawnParticles(h.x, bobY, '#ff4466', 12, 100, 0.4);
    spawnParticles(h.x, bobY, '#ff88aa', 6, 60, 0.3);
    addShake(3, 0.08);
    playSound('powerup');
    S.heartItem = null;
  }
}

export function drawHeart() {
  if (!S.heartItem) return;
  const ctx = S.ctx;
  const h = S.heartItem;
  const bobY = h.y + Math.sin(h.bobTimer) * 6;
  const x = h.x;
  const y = bobY;
  const sz = HEART_SIZE;

  ctx.save();

  // Glow
  ctx.shadowColor = '#ff4466';
  ctx.shadowBlur = 12;

  // Draw heart shape
  const topY = y - sz * 0.3;
  const pulse = 1 + Math.sin(h.bobTimer * 2) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.translate(-x, -y);

  ctx.fillStyle = '#ff2244';
  ctx.beginPath();
  ctx.moveTo(x, y + sz * 0.25);
  // Left bump
  ctx.bezierCurveTo(x - sz * 0.5, y - sz * 0.25, x - sz * 0.5, topY, x, topY + sz * 0.15);
  // Right bump
  ctx.bezierCurveTo(x + sz * 0.5, topY, x + sz * 0.5, y - sz * 0.25, x, y + sz * 0.25);
  ctx.fill();

  // Shine highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - sz * 0.15, topY + sz * 0.2, sz * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

export function drawChrisCans() {
  if (S.chrisCans.length === 0) return;
  const ctx = S.ctx;

  for (const can of S.chrisCans) {
    ctx.save();
    ctx.translate(can.x, can.y);
    ctx.rotate(can.spin);

    if (crushedCanSpriteLoaded) {
      // Preserve aspect ratio — source is portrait (taller than wide)
      const canH = 42;
      const aspect = crushedCanSprite.naturalWidth / crushedCanSprite.naturalHeight;
      const canW = canH * aspect;
      ctx.drawImage(crushedCanSprite, -canW / 2, -canH / 2, canW, canH);
    } else {
      // Procedural fallback — tall crushed can
      ctx.fillStyle = '#cc7700';
      ctx.fillRect(-12, -18, 24, 36);
      ctx.fillStyle = '#ddaa44';
      ctx.fillRect(-10, -14, 20, 28);
    }

    ctx.restore();
  }
}
