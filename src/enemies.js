import { S } from './state.js';
import {
  W, H, GRAVITY, PLATFORM_X, PLATFORM_W, PLATFORM_Y, PLAYER_W, PLAYER_H,
  IFRAME_DURATION, CONTACT_KNOCKBACK, ENEMY_TYPES,
  SNOT_STORM_DURATION,
} from './constants.js';
import { random } from './rng.js';
import { playSound, playNoise, playVoice } from './audio.js';
import {
  gruntSprite, gruntSpriteLoaded,
  spitterSprite, spitterSpriteLoaded,
  bruteSprite, bruteSpriteLoaded,
  snotCageSprite, snotCageSpriteLoaded,
  flashCanvas, flashCtx,
} from './sprites.js';
import { spawnParticles, spawnDamageNumber, addShake } from './effects.js';
import { rectsOverlap } from './utils.js';

// ============================================================
// ENEMIES
// ============================================================

export function getEnemySprite(type) {
  if (type === 'grunt' && gruntSpriteLoaded) return gruntSprite;
  if (type === 'spitter' && spitterSpriteLoaded) return spitterSprite;
  if (type === 'brute' && bruteSpriteLoaded) return bruteSprite;
  return null;
}

export function createEnemy(type, round) {
  const def = ENEMY_TYPES[type];
  const hpBonus = (round - 1) * 15;
  const w = def.baseW;
  const h = def.baseH;
  const spawnX = PLATFORM_X + random() * (PLATFORM_W - w);
  return {
    type,
    x: spawnX,
    y: -h - random() * 200,
    w, h,
    vx: 0,
    vy: 0,
    hp: def.baseHp + hpBonus,
    maxHp: def.baseHp + hpBonus,
    speed: def.speed,
    damage: def.damage,
    score: def.score,
    color: def.color,
    eyeColor: def.eyeColor,
    onPlatform: false,
    dying: false,
    deathTimer: 0,
    flashTimer: 0,
    shootCooldown: def.shootCooldown || 0,
    shootTimer: (def.shootCooldown || 0) * random(),
    charging: false,
    chargeTimer: 0,
    telegraphTimer: 0,
    telegraphAngle: 0,
    facingRight: random() > 0.5,
    animTimer: random() * Math.PI * 2,
    freezeTimer: 0
  };
}

export function spawnEnemyForRound(round) {
  let type = 'grunt';
  // Brutes: 15% at R5, +2.5% per round beyond 5, cap 30%
  const bruteChance = Math.min(0.30, 0.15 + (round - 5) * 0.025);
  if (round >= 5 && random() < bruteChance) {
    type = 'brute';
  } else if (round >= 3 && random() < 0.35) {
    type = 'spitter';
  }
  S.enemies.push(createEnemy(type, round));
}

export function updateEnemies(dt) {
  const { player, enemies, enemyProjectiles, keys, particles } = S;
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.animTimer += dt * 3;
    e.flashTimer = Math.max(0, e.flashTimer - dt);

    if (e.dying) {
      e.deathTimer -= dt;
      if (e.deathTimer <= 0) {
        enemies.splice(i, 1);
      }
      continue;
    }

    // Freeze timer
    if (e.freezeTimer > 0) {
      e.freezeTimer -= dt;
      // Still apply gravity/platform when frozen (so they don't float)
      e.vy += GRAVITY * dt;
      e.y += e.vy * dt;
      if (e.y + e.h >= PLATFORM_Y && e.vy >= 0) {
        const ecx = e.x + e.w / 2;
        if (ecx > PLATFORM_X && ecx < PLATFORM_X + PLATFORM_W) {
          e.y = PLATFORM_Y - e.h;
          e.vy = 0;
          e.onPlatform = true;
        }
      }
      // Stomp check — player falling onto a frozen enemy
      if (player.vy > 0 && !e.dying && rectsOverlap(
          player.x, player.y, PLAYER_W, PLAYER_H,
          e.x, e.y, e.w, e.h
      )) {
        const playerFeet = player.y + PLAYER_H;
        const enemyTop = e.y;
        if (playerFeet < enemyTop + e.h * 0.5) {
          const knockDir = Math.sign(e.x + e.w/2 - (player.x + PLAYER_W/2)) || 1;
          // Power stomp: flick up at moment of impact (down-up cadence)
          const upHeld = keys['w'] || keys['arrowup'] || keys['joyup'];
          const stompDmg = upHeld ? 120 : 60;
          damageEnemy(i, stompDmg, knockDir * 100, 50);
          // Bounce: base -560, power stomp -680
          player.vy = upHeld ? -680 : -560;
          player.iframes = 0.8;
          if (upHeld) {
            spawnParticles(e.x + e.w/2, e.y, '#ffff00', 14, 200, 0.5);
            addShake(6, 0.15);
            spawnDamageNumber(e.x + e.w/2, e.y - 10, stompDmg, '#ffff00');
          } else {
            spawnParticles(e.x + e.w/2, e.y, '#66cc22', 10, 150, 0.4);
            addShake(4, 0.1);
          }
          playSound('stomp');
          // Snot Storm chain tracking
          player.stompChain++;
          if (player.stompChain >= 3) {
            player.snotStormTimer = SNOT_STORM_DURATION;
            player.stompChain = 0;
            addShake(8, 0.2);
            playSound('powerup');
            S.snotStormFlash = 1.5;
            // Ring of green particles around player
            const pcxS = player.x + PLAYER_W / 2;
            const pcyS = player.y + PLAYER_H / 2;
            for (let sp = 0; sp < 16; sp++) {
              const angle = (sp / 16) * Math.PI * 2;
              particles.push({
                x: pcxS + Math.cos(angle) * 30,
                y: pcyS + Math.sin(angle) * 30,
                vx: Math.cos(angle) * 120,
                vy: Math.sin(angle) * 120,
                life: 0.6, maxLife: 0.6,
                color: sp % 2 === 0 ? '#88ff44' : '#ccff88', size: 4
              });
            }
          }
        }
      }
      continue;
    }

    // Gravity
    e.vy += GRAVITY * dt;
    e.y += e.vy * dt;

    // Platform landing
    if (e.y + e.h >= PLATFORM_Y && e.vy >= 0) {
      const ecx = e.x + e.w / 2;
      if (ecx > PLATFORM_X && ecx < PLATFORM_X + PLATFORM_W) {
        e.y = PLATFORM_Y - e.h;
        e.vy = 0;
        e.onPlatform = true;
      }
    }

    // Fall off screen
    if (e.y > H + 200) {
      enemies.splice(i, 1);
      continue;
    }

    if (!e.onPlatform) continue;

    // AI behavior
    const dx = pcx - (e.x + e.w / 2);
    const dist = Math.abs(dx);
    e.facingRight = dx > 0;

    switch (e.type) {
      case 'grunt':
        e.vx = Math.sign(dx) * e.speed;
        e.x += e.vx * dt;
        break;

      case 'spitter': {
        const def = ENEMY_TYPES.spitter;
        if (dist > def.shootRange) {
          e.vx = Math.sign(dx) * e.speed;
          e.x += e.vx * dt;
          e.telegraphTimer = 0;
        } else {
          e.vx = 0;
          // Telegraph phase: charge up before firing
          if (e.telegraphTimer > 0) {
            e.telegraphTimer -= dt;
            e.telegraphAngle = Math.atan2(pcy - (e.y + e.h / 2), pcx - (e.x + e.w / 2));
            if (e.telegraphTimer <= 0) {
              // Fire!
              const angle = e.telegraphAngle;
              enemyProjectiles.push({
                x: e.x + e.w / 2,
                y: e.y + e.h / 2,
                vx: Math.cos(angle) * def.projectileSpeed,
                vy: Math.sin(angle) * def.projectileSpeed,
                damage: 15,
                life: 3,
                color: '#ff44ff',
                trail: []
              });
              playSound('spitterShoot');
            }
          } else {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              e.shootTimer = def.shootCooldown;
              e.telegraphTimer = 0.4;
              e.telegraphAngle = Math.atan2(pcy - (e.y + e.h / 2), pcx - (e.x + e.w / 2));
            }
          }
        }
        break;
      }

      case 'brute': {
        const def = ENEMY_TYPES.brute;
        if (!e.charging && dist < 200) {
          e.charging = true;
          e.chargeTimer = 0.3; // Wind-up
        }
        if (e.charging) {
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) {
            e.vx = Math.sign(dx) * def.chargeSpeed;
          } else {
            e.vx = 0; // Wind-up pause
          }
        } else {
          e.vx = Math.sign(dx) * e.speed * 0.6;
        }
        e.x += e.vx * dt;
        // Reset charge if far away
        if (dist > 300) e.charging = false;
        break;
      }
    }

    // Clamp to platform
    if (e.x < PLATFORM_X) { e.x = PLATFORM_X; }
    if (e.x + e.w > PLATFORM_X + PLATFORM_W) { e.x = PLATFORM_X + PLATFORM_W - e.w; }

    // Contact damage to player (frozen enemies deal no damage)
    if (player.iframes <= 0 && !e.dying && e.freezeTimer <= 0) {
      if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, e.x, e.y, e.w, e.h)) {
        if (player.metalTimer > 0) {
          // Metal mode: bounce enemies away instead
          const knockDir = Math.sign(e.x + e.w / 2 - (player.x + PLAYER_W / 2)) || 1;
          e.vx = knockDir * 400;
          e.vy = -250;
          damageEnemy(i, 40, knockDir * 400, -250);
          spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, '#aaccff', 6, 120, 0.3);
          playSound('hit');
        } else {
          const knockDir = Math.sign(player.x + PLAYER_W / 2 - (e.x + e.w / 2)) || 1;
          player.hp -= e.damage;
          player.iframes = IFRAME_DURATION;
          player.vx = knockDir * CONTACT_KNOCKBACK;
          player.vy = -380;
          player.knockbackTimer = 0.3;
          player.airJumps = 1; // reset air jump so player can escape knockback
          player.flashTimer = 0.15;
          spawnDamageNumber(player.x + PLAYER_W / 2, player.y, e.damage, '#ff4444');
          addShake(6, 0.15);
          playSound('hurt');
          if (random() < 0.3) playVoice('bad');
        }
      }
    }

    // Muscle mode AoE slam
    if (player.muscleTimer > 0 && player.slamCooldown <= 0 && !e.dying) {
      const ecx = e.x + e.w / 2;
      const ecy = e.y + e.h / 2;
      const slamDist = Math.hypot(ecx - pcx, ecy - pcy);
      if (slamDist < 60) {
        const knockDir = Math.sign(ecx - pcx) || 1;
        damageEnemy(i, 30, knockDir * 400, -300);
        // Shockwave ring particles
        for (let s = 0; s < 8; s++) {
          const angle = (s / 8) * Math.PI * 2;
          particles.push({
            x: pcx + Math.cos(angle) * 20,
            y: pcy + Math.sin(angle) * 20,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200 - 50,
            life: 0.3,
            maxLife: 0.3,
            color: '#cc66ff',
            size: 4
          });
        }
        spawnParticles(ecx, ecy, '#dd88ff', 6, 120, 0.3);
        addShake(5, 0.12);
        playSound('slam');
        player.slamCooldown = 0.4;
      }
    }
  }

  updateEnemyProjectiles(dt);
}

export function updateEnemyProjectiles(dt) {
  const { player, enemyProjectiles } = S;

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    // Update trail
    if (!p.trail) p.trail = [];
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 4) p.trail.shift();
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
      enemyProjectiles.splice(i, 1);
      continue;
    }

    // Hit player
    if (player.iframes <= 0) {
      const dist = Math.hypot(p.x - (player.x + PLAYER_W / 2), p.y - (player.y + PLAYER_H / 2));
      if (dist < 24) {
        if (player.metalTimer > 0) {
          // Deflect projectile
          spawnParticles(p.x, p.y, '#aaccff', 5, 80, 0.2);
          playSound('hit');
        } else {
          player.hp -= p.damage;
          player.iframes = IFRAME_DURATION;
          player.flashTimer = 0.15;
          spawnDamageNumber(player.x + PLAYER_W / 2, player.y, p.damage, '#ff44ff');
          spawnParticles(p.x, p.y, '#ff44ff', 8, 80, 0.3);
          addShake(4, 0.1);
          playSound('hurt');
          if (random() < 0.3) playVoice('bad');
        }
        enemyProjectiles.splice(i, 1);
      }
    }
  }
}

export function drawEnemies() {
  const ctx = S.ctx;
  const { enemies, enemyProjectiles } = S;

  for (const e of enemies) {
    if (e.dying) {
      // Death fade
      ctx.globalAlpha = Math.max(0, e.deathTimer / 0.4);
    }

    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;

    // Frozen enemies: replace with snot cage sprite
    if (e.freezeTimer > 0 && !e.dying && snotCageSpriteLoaded) {
      const cageSpr = snotCageSprite;
      const ratio = cageSpr.naturalWidth / cageSpr.naturalHeight;
      const drawH = e.h + 24;
      const drawW = drawH * ratio;
      const drawX = cx - drawW / 2;
      const feetY = e.onPlatform ? PLATFORM_Y : e.y + e.h;
      const drawY = feetY - drawH;

      if (e.flashTimer > 0) {
        const fw = Math.ceil(drawW);
        const fh = Math.ceil(drawH);
        if (flashCanvas.width < fw) flashCanvas.width = fw;
        if (flashCanvas.height < fh) flashCanvas.height = fh;
        flashCtx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
        flashCtx.globalCompositeOperation = 'source-over';
        flashCtx.drawImage(cageSpr, 0, 0, fw, fh);
        flashCtx.globalCompositeOperation = 'source-atop';
        flashCtx.fillStyle = `rgba(255,255,255,${e.flashTimer * 5})`;
        flashCtx.fillRect(0, 0, fw, fh);
        ctx.drawImage(flashCanvas, 0, 0, fw, fh, drawX, drawY, drawW, drawH);
      } else {
        ctx.drawImage(cageSpr, drawX, drawY, drawW, drawH);
      }

      // HP bar
      if (e.hp < e.maxHp) {
        const barW = e.w;
        const barH = 4;
        ctx.fillStyle = '#440000';
        ctx.fillRect(e.x, e.y - 8, barW, barH);
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(e.x, e.y - 8, barW * (e.hp / e.maxHp), barH);
      }
      // Stomp target arrow
      const arrowBob = Math.sin(performance.now() * 0.008) * 4;
      const arrowY = e.y - 14 + arrowBob;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u25BC', cx, arrowY);

      ctx.globalAlpha = 1;
      continue;
    }

    const spr = getEnemySprite(e.type);
    if (spr) {
      // --- Sprite-based drawing ---
      ctx.save();
      if (!e.facingRight) {
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        ctx.translate(-cx, -cy);
      }
      // Aspect-ratio preservation, feet-aligned
      let drawW = e.w;
      let drawH = e.h;
      if (spr.naturalWidth && spr.naturalHeight) {
        const ratio = spr.naturalWidth / spr.naturalHeight;
        drawW = e.h * ratio;
      }
      const drawX = cx - drawW / 2;
      const drawY = e.y + e.h - drawH; // feet aligned

      if (e.flashTimer > 0) {
        // Use offscreen canvas so flash only affects sprite pixels
        const fw = Math.ceil(drawW);
        const fh = Math.ceil(drawH);
        if (flashCanvas.width < fw) flashCanvas.width = fw;
        if (flashCanvas.height < fh) flashCanvas.height = fh;
        flashCtx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
        flashCtx.globalCompositeOperation = 'source-over';
        flashCtx.drawImage(spr, 0, 0, fw, fh);
        flashCtx.globalCompositeOperation = 'source-atop';
        flashCtx.fillStyle = `rgba(255,255,255,${e.flashTimer * 5})`;
        flashCtx.fillRect(0, 0, fw, fh);
        ctx.drawImage(flashCanvas, 0, 0, fw, fh, drawX, drawY, drawW, drawH);
      } else {
        ctx.drawImage(spr, drawX, drawY, drawW, drawH);
      }
      ctx.restore();
    } else {
      // --- Procedural fallback ---
      ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy + e.h * 0.1, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!e.dying) {
        // Eyes
        ctx.fillStyle = e.eyeColor;
        const eyeOff = e.facingRight ? e.w * 0.1 : -e.w * 0.1;
        const eyeSize = Math.max(2, e.w * 0.1);
        ctx.fillRect(cx + eyeOff - eyeSize * 1.2, cy - e.h * 0.15, eyeSize, eyeSize);
        ctx.fillRect(cx + eyeOff + eyeSize * 0.3, cy - e.h * 0.15, eyeSize, eyeSize);

        // Mouth
        ctx.fillStyle = '#000';
        ctx.fillRect(cx + eyeOff - eyeSize, cy + e.h * 0.05, eyeSize * 2, eyeSize * 0.5);

        // Walking animation (bouncing legs)
        if (e.onPlatform && Math.abs(e.vx) > 1) {
          ctx.fillStyle = e.color;
          const legBob = Math.sin(e.animTimer * 5) * 3;
          ctx.fillRect(cx - e.w * 0.25, e.y + e.h - 4 + legBob, e.w * 0.15, 6);
          ctx.fillRect(cx + e.w * 0.1, e.y + e.h - 4 - legBob, e.w * 0.15, 6);
        }
      }
    }

    // Overlays drawn on top regardless of sprite/procedural
    if (!e.dying) {
      // HP bar
      if (e.hp < e.maxHp) {
        const barW = e.w;
        const barH = 4;
        ctx.fillStyle = '#440000';
        ctx.fillRect(e.x, e.y - 8, barW, barH);
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(e.x, e.y - 8, barW * (e.hp / e.maxHp), barH);
      }

      // Brute charge indicator
      if (e.type === 'brute' && e.charging && e.chargeTimer > 0) {
        ctx.fillStyle = `rgba(255,0,0,${0.5 + Math.sin(performance.now() * 0.02) * 0.5})`;
        ctx.beginPath();
        ctx.arc(cx, cy, e.w * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  // Spitter telegraph indicators
  for (const e of enemies) {
    if (e.type === 'spitter' && e.telegraphTimer > 0 && !e.dying) {
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const pulse = 0.4 + Math.sin(performance.now() * 0.025) * 0.4;

      // Pulsing glow ring around spitter
      ctx.strokeStyle = `rgba(255,68,255,${pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, e.w * 0.6 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      // Aim line (dotted)
      const angle = e.telegraphAngle;
      ctx.strokeStyle = `rgba(255,68,255,${pulse * 0.4})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(angle) * 120, ey + Math.sin(angle) * 120);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Enemy projectiles (with trails)
  for (const p of enemyProjectiles) {
    // Draw trail afterimages
    if (p.trail) {
      for (let t = 0; t < p.trail.length; t++) {
        const alpha = (t + 1) / (p.trail.length + 1) * 0.4;
        const radius = 8 * (t + 1) / (p.trail.length + 1);
        ctx.fillStyle = `rgba(255,68,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.trail[t].x, p.trail[t].y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Main projectile
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function damageEnemy(index, damage, knockX, knockY) {
  const { enemies } = S;
  const e = enemies[index];
  if (e.dying) return;
  e.hp -= damage;
  e.flashTimer = 0.1;
  e.vx += knockX;
  e.vy += knockY;

  spawnDamageNumber(e.x + e.w / 2, e.y, damage, '#ffff44');
  playSound('hit');

  if (e.hp <= 0) {
    e.dying = true;
    e.deathTimer = 0.4;
    S.score += e.score;
    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 15, 200, 0.5);
    addShake(4, 0.1);
    playSound('kill');
    playNoise(0.15, 0.15);
    if (random() < 0.25) {
      playVoice(S.goodClipToggle ? 'good1' : 'good2');
      S.goodClipToggle = !S.goodClipToggle;
    }
  }
}
