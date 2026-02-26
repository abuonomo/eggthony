import { S } from './state.js';
import {
  W, H, PLAYER_W, PLAYER_H, PLATFORM_Y,
  CAMP_SPIDER_DELAY, CAMP_SPIDER_DESCEND, CAMP_SPIDER_ZAPS_TO_ESCAPE,
  CAMP_SPIDER_ESCAPE_DMG, CAMP_RADIUS, SPIDER_DROP_DURATION,
  SPIDER_DROP_CLUTCH_Y, SPIDER_DROP_Y,
} from './constants.js';
import { playSound, playVoice } from './audio.js';
import { spiderSprite, spiderSpriteLoaded } from './sprites.js';

// ============================================================
// PARTICLES
// ============================================================
export function spawnParticles(x, y, color, count, speed, life) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * speed;
    S.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - Math.random() * 100,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      color,
      size: Math.random() * 4 + 2
    });
  }
}

export function updateParticles(dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
    if (p.life <= 0) S.particles.splice(i, 1);
  }
}

export function drawParticles() {
  const { ctx } = S;
  for (const p of S.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// DAMAGE NUMBERS
// ============================================================
export function spawnDamageNumber(x, y, amount, color) {
  S.damageNumbers.push({
    x, y,
    text: String(Math.round(amount)),
    color: color || '#ff4444',
    life: 1.0,
    vy: -80
  });
}

export function updateDamageNumbers(dt) {
  for (let i = S.damageNumbers.length - 1; i >= 0; i--) {
    const d = S.damageNumbers[i];
    d.y += d.vy * dt;
    d.vy *= 0.95;
    d.life -= dt;
    if (d.life <= 0) S.damageNumbers.splice(i, 1);
  }
}

export function drawDamageNumbers() {
  const { ctx } = S;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  for (const d of S.damageNumbers) {
    const alpha = Math.max(0, d.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.fillText(d.text, d.x + 1, d.y + 1);
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, d.x, d.y);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// SCREEN SHAKE
// ============================================================
export function addShake(intensity, duration) {
  S.shakeIntensity = Math.max(S.shakeIntensity, intensity);
  S.shakeDuration = Math.max(S.shakeDuration, duration);
}

// ============================================================
// CAMP SPIDER
// ============================================================
export function updateCampSpider(dt) {
  const { player, keys } = S;
  const pcx = player.x + PLAYER_W / 2;
  const onFloatPlat = player.onGround && (player.y + PLAYER_H) < PLATFORM_Y - 10;

  if (onFloatPlat || !player.onGround || Math.abs(pcx - S.campX) > CAMP_RADIUS) {
    S.campTimer = 0;
    S.campX = pcx;
    if (S.campSpider && S.campSpider.state !== 'grabbed') {
      S.campSpider.state = 'retreating';
    }
  } else {
    S.campTimer += dt;
  }

  if (!S.campSpider && S.campTimer >= CAMP_SPIDER_DELAY) {
    S.campSpider = {
      state: 'descending',
      x: pcx,
      y: -40,
      targetY: player.y - 10,
      grabTimer: 0,
      zapHits: 0
    };
    playSound('spiderWarn');
  }

  if (!S.campSpider) return;
  const sp = S.campSpider;

  switch (sp.state) {
    case 'descending':
      sp.x = pcx;
      sp.targetY = player.y - 10;
      sp.y += (sp.targetY - sp.y) / CAMP_SPIDER_DESCEND * dt * 2;
      if (Math.abs(sp.y - sp.targetY) < 8) {
        sp.state = 'grabbed';
        sp.grabTimer = 0;
        sp.zapHits = 0;
      }
      break;

    case 'grabbed':
      sp.grabTimer += dt;
      const wiggle = Math.sin(performance.now() * 0.015) * 8;
      player.x = sp.x - PLAYER_W / 2 + wiggle;
      player.y -= 120 * dt;
      sp.y = player.y - 10;
      player.vy = 0;
      player.onGround = false;

      // Mash ZAP to escape
      if (S.mouse.left && !S._zapHeld) {
        sp.zapHits++;
        S._zapHeld = true;
        spawnParticles(sp.x, sp.y, '#ffffff', 5, 80, 0.4);
        playSound('lightning');
        if (sp.zapHits >= CAMP_SPIDER_ZAPS_TO_ESCAPE) {
          // Escape!
          sp.state = 'retreating';
          S.campTimer = 0;
          if (player.y > SPIDER_DROP_CLUTCH_Y) {
            // Normal escape
            player.vy = -300;
          } else {
            // Clutch escape — reward with Spider Drop!
            spiderDropReward();
          }
        }
      } else if (!S.mouse.left) {
        S._zapHeld = false;
      }

      if (player.y < -PLAYER_H - 20) {
        player.hp = 0;
        S.campSpider = null;
        return;
      }
      break;

    case 'retreating':
      sp.y -= 400 * dt;
      if (sp.y < -60) {
        S.campSpider = null;
      }
      break;
  }
}

export function drawCampSpider() {
  if (!S.campSpider) return;
  const { ctx } = S;
  const sp = S.campSpider;

  ctx.save();
  ctx.strokeStyle = 'rgba(200,200,200,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sp.x, 0);
  ctx.lineTo(sp.x, sp.y);
  ctx.stroke();

  const bob = Math.sin(performance.now() * 0.008) * 3;
  const spW = 80;
  const spH = spiderSpriteLoaded ? spW * (spiderSprite.naturalHeight / spiderSprite.naturalWidth) : 44;

  if (spiderSpriteLoaded) {
    ctx.drawImage(spiderSprite, sp.x - spW / 2, sp.y + bob - spH / 2, spW, spH);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y + bob, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(sp.x - 5, sp.y + bob - 5, 3, 0, Math.PI * 2);
    ctx.arc(sp.x + 5, sp.y + bob - 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sp.state === 'grabbed') {
    const progress = sp.zapHits / CAMP_SPIDER_ZAPS_TO_ESCAPE;
    const barW = 50;
    const barH = 6;
    const barX = sp.x - barW / 2;
    const barY = sp.y + bob - spH / 2 - 16;
    ctx.fillStyle = '#440000';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    const flashAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
    ctx.fillStyle = `rgba(255,255,100,${flashAlpha})`;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MASH ZAP!', sp.x, barY - 6);
  }

  ctx.restore();
}

// ============================================================
// SPIDER DROP REWARD ACTIVATION
// ============================================================
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
