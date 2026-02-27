import { S } from './state.js';
import {
  W, H, GRAVITY, PLATFORM_X, PLATFORM_W, PLATFORM_Y, PLAYER_W, PLAYER_H,
  IFRAME_DURATION, CONTACT_KNOCKBACK,
  FART_CLOUD_RADIUS, FART_CLOUD_DURATION, FART_CLOUD_DPS, FART_CLOUD_TICK,
  SNOT_STORM_DURATION,
} from './constants.js';
import { playSound, playNoise, playVoice, quentinFartClip } from './audio.js';
import {
  evilSprite, evilSpriteLoaded, evilSprite2, evilSprite2Loaded,
  quentinPizzaSprite, quentinPizzaSpriteLoaded,
  snotCageSprite, snotCageSpriteLoaded,
  flashCanvas, flashCtx,
} from './sprites.js';
import { spawnParticles, spawnDamageNumber, addShake } from './effects.js';
import { rectsOverlap } from './utils.js';

// ============================================================
// BOSS SYSTEM — EVIL EGGTHONY / QUENTIN PIZZA
// ============================================================

export function isBossRound(r) {
  return r >= 3 && r % 3 === 0;
}

export function bossAppearance(r) {
  return Math.floor(r / 3);
}

export function createBoss(r) {
  const app = bossAppearance(r);
  const isQP = app >= 3;
  // QP resets scale: qpApp counts from 1 on first QP appearance
  const qpApp = isQP ? app - 2 : app;
  const scale = isQP ? 1 + (qpApp - 1) * 0.15 : 1 + (app - 1) * 0.2;
  const baseH = isQP ? 153 : 180;
  const baseW = isQP ? 153 : Math.round(180 * (818 / 1164)); // QP is square, evil egg uses aspect ratio
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const damage = isQP ? Math.min(30, 20 + (qpApp - 1) * 10) : 20 + (app - 1) * 10;
  return {
    x: W / 2 - w / 2,
    y: -h - 50,
    w, h,
    vx: 0,
    vy: 0,
    hp: 300 + (app - 1) * 200,
    maxHp: 300 + (app - 1) * 200,
    damage: damage,
    scoreValue: 1000 + (app - 1) * 500,
    speed: 100 + (app - 1) * 15,
    onPlatform: false,
    appearance: app,
    facingRight: true,
    flashTimer: 0,
    dying: false,
    deathTimer: 0,
    state: 'entering',
    attackCooldown: 2.0,
    chargeSpeed: isQP ? 320 + (qpApp - 1) * 20 : 350 + (app - 1) * 30,
    chargeTimer: 0,
    chargeDir: 1,
    poundTargetX: 0,
    poundTimer: 0,
    shockwaveTimer: 0,
    shockwaveActive: false,
    shockwaveX: 0,
    shockwaveRadius: 0,
    rage: false,
    animTimer: 0,
    isQuentinPizza: isQP,
    fartCooldown: 0,
    fartTimer: 0,
    freezeTimer: 0
  };
}

export function updateBoss(dt) {
  const boss = S.boss;
  const player = S.player;
  const keys = S.keys;

  if (!boss || !S.bossActive) return;

  boss.animTimer += dt * 3;
  boss.flashTimer = Math.max(0, boss.flashTimer - dt);
  S.bossHPBarFlash = Math.max(0, S.bossHPBarFlash - dt);

  // Death animation
  if (boss.dying) {
    boss.deathTimer -= dt;
    if (boss.deathTimer <= 0) {
      S.score += Math.round(boss.scoreValue * (S.gear.totalBuffs ? S.gear.totalBuffs.scoreMult : 1));
      spawnDamageNumber(boss.x + boss.w / 2, boss.y, boss.scoreValue, '#ffdd00');
      S.bossDefeated = true;
      S.bossActive = false;
      S.boss = null;
    }
    return;
  }

  // Rage mode check
  if (!boss.rage && boss.hp <= boss.maxHp * 0.3) {
    boss.rage = true;
    addShake(8, 0.3);
    playSound('bossRoar');
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff2222', 20, 200, 0.6);
  }

  // Freeze
  if (boss.freezeTimer > 0) {
    boss.freezeTimer -= dt;
    // Update shockwave even while frozen
    if (boss.shockwaveActive) {
      boss.shockwaveRadius += 400 * dt;
      boss.shockwaveTimer -= dt;
      if (boss.shockwaveTimer <= 0) boss.shockwaveActive = false;
    }
    // Stomp check — player falling onto frozen boss
    if (player.vy > 0 && !boss.dying && rectsOverlap(
        player.x, player.y, PLAYER_W, PLAYER_H,
        boss.x, boss.y, boss.w, boss.h
    )) {
      const playerFeet = player.y + PLAYER_H;
      if (playerFeet < boss.y + boss.h * 0.4) {
        const upHeld = keys['w'] || keys['arrowup'] || keys['joyup'];
        const stompDmg = upHeld ? 120 : 60;
        damageBoss(stompDmg, 0, 0);
        player.vy = upHeld ? -680 : -560;
        player.iframes = 0.8;
        const bcx = boss.x + boss.w / 2;
        if (upHeld) {
          spawnParticles(bcx, boss.y, '#ffff00', 14, 200, 0.5);
          addShake(6, 0.15);
          spawnDamageNumber(bcx, boss.y - 10, stompDmg, '#ffff00');
        } else {
          spawnParticles(bcx, boss.y, '#66cc22', 10, 150, 0.4);
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
          const pcxS = player.x + PLAYER_W / 2;
          const pcyS = player.y + PLAYER_H / 2;
          for (let sp = 0; sp < 16; sp++) {
            const angle = (sp / 16) * Math.PI * 2;
            S.particles.push({
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
    return;
  }

  const rageMult = boss.rage ? 1.3 : 1.0;
  const cooldownMult = boss.rage ? 0.5 : 1.0;

  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  const bcx = boss.x + boss.w / 2;
  const bcy = boss.y + boss.h / 2;

  switch (boss.state) {
    case 'entering': {
      boss.vy += GRAVITY * 1.5 * dt;
      boss.y += boss.vy * dt;

      if (boss.y + boss.h >= PLATFORM_Y) {
        boss.y = PLATFORM_Y - boss.h;
        boss.vy = 0;
        boss.onPlatform = true;
        S.bossEntering = false;
        addShake(15, 0.4);
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, '#ffaa44', 30, 250, 0.6);
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, '#ff6622', 20, 200, 0.5);
        playSound('bossSlam');
        playNoise(0.2, 0.25);
        // QP immediately farts on landing
        if (boss.isQuentinPizza) {
          boss.state = 'fart_windup';
          boss.fartTimer = 0.4;
        } else {
          boss.state = 'idle';
          boss.attackCooldown = 1.5;
        }
      }
      break;
    }

    case 'idle': {
      const dx = pcx - bcx;
      boss.facingRight = dx > 0;
      boss.vx = Math.sign(dx) * boss.speed * rageMult * 0.6;
      boss.x += boss.vx * dt;

      if (boss.x < PLATFORM_X) boss.x = PLATFORM_X;
      if (boss.x + boss.w > PLATFORM_X + PLATFORM_W) boss.x = PLATFORM_X + PLATFORM_W - boss.w;

      // QP fart cooldown decay
      if (boss.isQuentinPizza && boss.fartCooldown > 0) {
        boss.fartCooldown -= dt;
      }

      boss.attackCooldown -= dt;
      if (boss.attackCooldown <= 0) {
        // QP: chance to fart instead of normal attack
        if (boss.isQuentinPizza && boss.fartCooldown <= 0 && Math.random() < 0.35) {
          boss.state = 'fart_windup';
          boss.fartTimer = 0.8;
          boss.vx = 0;
        } else {
          const dist = Math.abs(pcx - bcx);
          if (dist < 250 && Math.random() < 0.5) {
            boss.state = 'charge_windup';
            boss.chargeTimer = 0.5;
            boss.chargeDir = Math.sign(pcx - bcx) || 1;
            boss.vx = 0;
          } else {
            boss.state = 'pound_jump';
            boss.vy = -600;
            boss.onPlatform = false;
            boss.poundTargetX = pcx;
          }
        }
      }
      break;
    }

    case 'charge_windup': {
      boss.chargeTimer -= dt;
      boss.vx = 0;
      if (boss.chargeTimer <= 0) {
        boss.state = 'charge';
        boss.chargeTimer = 1.2;
        playSound('bossRoar');
      }
      break;
    }

    case 'charge': {
      boss.vx = boss.chargeDir * boss.chargeSpeed * rageMult;
      boss.x += boss.vx * dt;
      boss.chargeTimer -= dt;

      if (boss.x < PLATFORM_X) {
        boss.x = PLATFORM_X;
        boss.chargeTimer = 0;
      }
      if (boss.x + boss.w > PLATFORM_X + PLATFORM_W) {
        boss.x = PLATFORM_X + PLATFORM_W - boss.w;
        boss.chargeTimer = 0;
      }

      if (boss.chargeTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 2.0 * cooldownMult;
        boss.vx = 0;
      }
      break;
    }

    case 'pound_jump': {
      boss.vy += GRAVITY * dt;
      boss.y += boss.vy * dt;

      const targetDx = boss.poundTargetX - (boss.x + boss.w / 2);
      boss.x += targetDx * 3 * dt;

      if (boss.vy >= 0) {
        boss.state = 'pound_fall';
        boss.x = boss.poundTargetX - boss.w / 2;
        if (boss.x < PLATFORM_X) boss.x = PLATFORM_X;
        if (boss.x + boss.w > PLATFORM_X + PLATFORM_W) boss.x = PLATFORM_X + PLATFORM_W - boss.w;
      }
      break;
    }

    case 'pound_fall': {
      boss.vy += GRAVITY * 2.0 * dt;
      boss.y += boss.vy * dt;

      if (boss.y + boss.h >= PLATFORM_Y) {
        boss.y = PLATFORM_Y - boss.h;
        boss.vy = 0;
        boss.onPlatform = true;
        boss.state = 'pound_land';
        boss.poundTimer = 0.3;

        boss.shockwaveActive = true;
        boss.shockwaveX = boss.x + boss.w / 2;
        boss.shockwaveRadius = 0;
        boss.shockwaveTimer = 0.4;

        addShake(12, 0.3);
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, '#ffaa44', 25, 300, 0.5);
        playSound('bossSlam');
        playNoise(0.25, 0.2);

        const shockDist = Math.abs(pcx - (boss.x + boss.w / 2));
        if (shockDist < 120 && player.iframes <= 0 && player.wingsTimer <= 0) {
          if (player.metalTimer > 0) {
            const knockDir = Math.sign(pcx - (boss.x + boss.w / 2));
            player.vx = knockDir * 400;
            player.vy = -300;
            spawnParticles(pcx, pcy, '#aaccff', 6, 120, 0.3);
            playSound('hit');
          } else {
            const knockDir = Math.sign(pcx - (boss.x + boss.w / 2)) || 1;
            player.hp -= boss.damage;
            player.iframes = IFRAME_DURATION;
            player.vx = knockDir * 400;
            player.vy = -250;
            player.airJumps = 1; // reset air jump so player can escape knockback
            player.flashTimer = 0.15;
            spawnDamageNumber(pcx, player.y, boss.damage, '#ff4444');
            addShake(6, 0.15);
            playSound('hurt');
            if (Math.random() < 0.3) playVoice('bad');
          }
        }
      }
      break;
    }

    case 'pound_land': {
      boss.poundTimer -= dt;
      boss.vx = 0;
      if (boss.poundTimer <= 0) {
        // QP farts after landing from pound
        if (boss.isQuentinPizza && boss.fartCooldown <= 0) {
          boss.state = 'fart_windup';
          boss.fartTimer = 0.4;
        } else {
          boss.state = 'idle';
          boss.attackCooldown = 2.0 * cooldownMult;
        }
      }
      break;
    }

    case 'fart_windup': {
      boss.fartTimer -= dt;
      boss.vx = 0;
      if (boss.fartTimer <= 0) {
        // Spawn fart cloud at boss position
        S.fartClouds.push({
          x: boss.x + boss.w / 2,
          y: PLATFORM_Y - 10,
          radius: 0,
          maxRadius: FART_CLOUD_RADIUS,
          duration: FART_CLOUD_DURATION,
          timer: FART_CLOUD_DURATION,
          dps: FART_CLOUD_DPS,
          tickTimer: 0,
          expandTimer: 0.5
        });
        // Play fart sound
        quentinFartClip.currentTime = 0;
        quentinFartClip.play().catch(() => {});
        // Green particles
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y - 20, '#66cc22', 20, 180, 0.5);
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y - 20, '#88ff44', 10, 120, 0.4);
        addShake(6, 0.2);
        boss.state = 'fart_release';
        boss.fartTimer = 0.4;
      }
      break;
    }

    case 'fart_release': {
      boss.fartTimer -= dt;
      boss.vx = 0;
      if (boss.fartTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 2.0 * cooldownMult;
        boss.fartCooldown = 6.0;
      }
      break;
    }
  }

  // Update shockwave
  if (boss.shockwaveActive) {
    boss.shockwaveRadius += 400 * dt;
    boss.shockwaveTimer -= dt;
    if (boss.shockwaveTimer <= 0) {
      boss.shockwaveActive = false;
    }
  }

  // Contact damage to player
  if (boss.state !== 'entering' && !boss.dying && player.iframes <= 0) {
    if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, boss.x, boss.y, boss.w, boss.h)) {
      if (player.metalTimer > 0) {
        const knockDir = Math.sign(boss.x + boss.w / 2 - pcx);
        damageBoss(40, knockDir * 100, -50);
        spawnParticles(pcx, pcy, '#aaccff', 6, 120, 0.3);
        playSound('hit');
        player.iframes = 0.2;
      } else {
        const knockDir = Math.sign(pcx - (boss.x + boss.w / 2));
        player.hp -= boss.damage;
        player.iframes = IFRAME_DURATION;
        player.vx = knockDir * CONTACT_KNOCKBACK;
        player.vy = -200;
        player.airJumps = 1; // reset air jump so player can escape knockback
        player.flashTimer = 0.15;
        spawnDamageNumber(pcx, player.y, boss.damage, '#ff4444');
        addShake(6, 0.15);
        playSound('hurt');
        if (Math.random() < 0.3) playVoice('bad');
      }
    }
  }

  // Muscle mode AoE slam on boss
  if (player.muscleTimer > 0 && player.slamCooldown <= 0 && !boss.dying && boss.state !== 'entering') {
    const slamDist = Math.hypot(bcx - pcx, bcy - pcy);
    if (slamDist < 80) {
      const knockDir = Math.sign(bcx - pcx) || 1;
      damageBoss(30, knockDir * 100, -80);
      for (let s = 0; s < 8; s++) {
        const angle = (s / 8) * Math.PI * 2;
        S.particles.push({
          x: pcx + Math.cos(angle) * 20,
          y: pcy + Math.sin(angle) * 20,
          vx: Math.cos(angle) * 200,
          vy: Math.sin(angle) * 200 - 50,
          life: 0.3, maxLife: 0.3,
          color: '#cc66ff', size: 4
        });
      }
      spawnParticles(bcx, bcy, '#dd88ff', 6, 120, 0.3);
      addShake(5, 0.12);
      playSound('slam');
      player.slamCooldown = 0.4;
    }
  }
}

export function damageBoss(damage, knockX, knockY) {
  const boss = S.boss;
  if (!boss || boss.dying) return;
  boss.hp -= damage;
  boss.flashTimer = 0.1;
  S.bossHPBarFlash = 0.15;
  // Reduced knockback (boss is heavy)
  boss.x += knockX * 0.3 * (1 / 60);

  spawnDamageNumber(boss.x + boss.w / 2, boss.y, damage, '#ffff44');
  playSound('hit');

  if (boss.hp <= 0) {
    boss.dying = true;
    boss.deathTimer = 1.0;
    boss.vx = 0;
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff4422', 40, 350, 0.8);
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffaa44', 30, 300, 0.7);
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffdd00', 20, 250, 0.6);
    addShake(18, 0.6);
    playSound('bossDeath');
    playNoise(0.5, 0.3);
    playVoice('win', true);
  }
}

export function drawBoss() {
  const boss = S.boss;
  if (!boss || !S.bossActive) return;
  const ctx = S.ctx;

  const bcx = boss.x + boss.w / 2;
  const bcy = boss.y + boss.h / 2;

  if (boss.dying) {
    ctx.globalAlpha = Math.max(0, boss.deathTimer / 1.0);
    if (Math.floor(boss.deathTimer * 20) % 2 === 0) {
      ctx.globalAlpha *= 0.5;
    }
  }

  ctx.save();

  // Frozen boss: replace with snot cage
  if (boss.freezeTimer > 0 && !boss.dying && snotCageSpriteLoaded) {
    const cageSpr = snotCageSprite;
    const ratio = cageSpr.naturalWidth / cageSpr.naturalHeight;
    const drawH = boss.h + 24;
    const drawW = drawH * ratio;
    const drawX = bcx - drawW / 2;
    const feetY = boss.y + boss.h;
    const drawY = feetY - drawH;

    if (boss.flashTimer > 0) {
      const fw = Math.ceil(drawW);
      const fh = Math.ceil(drawH);
      if (flashCanvas.width < fw) flashCanvas.width = fw;
      if (flashCanvas.height < fh) flashCanvas.height = fh;
      flashCtx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
      flashCtx.globalCompositeOperation = 'source-over';
      flashCtx.drawImage(cageSpr, 0, 0, fw, fh);
      flashCtx.globalCompositeOperation = 'source-atop';
      flashCtx.fillStyle = `rgba(255,255,255,${boss.flashTimer * 5})`;
      flashCtx.fillRect(0, 0, fw, fh);
      ctx.drawImage(flashCanvas, 0, 0, fw, fh, drawX, drawY, drawW, drawH);
    } else {
      ctx.drawImage(cageSpr, drawX, drawY, drawW, drawH);
    }

    // Stomp target arrow
    const arrowBob = Math.sin(performance.now() * 0.008) * 5;
    const arrowY = boss.y - 18 + arrowBob;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u25BC', bcx, arrowY);

    ctx.restore();
    ctx.globalAlpha = 1;

    // Still draw shockwave ring if active
    if (boss.shockwaveActive) {
      const alpha = Math.max(0, boss.shockwaveTimer / 0.4);
      ctx.strokeStyle = `rgba(255,120,40,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.shockwaveX, PLATFORM_Y, boss.shockwaveRadius, Math.PI, 0);
      ctx.stroke();
    }
    return;
  }

  // Aura (green for QP, red for evil eggthony)
  const auraSize = boss.rage ? 1.4 : 1.15;
  const auraAlpha = boss.rage ? (0.25 + 0.15 * Math.sin(performance.now() * 0.01)) : 0.1;
  const auraGrad = ctx.createRadialGradient(bcx, bcy, boss.w * 0.3, bcx, bcy, boss.w * auraSize);
  if (boss.isQuentinPizza) {
    auraGrad.addColorStop(0, `rgba(80,200,20,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(80,200,20,0)');
  } else {
    auraGrad.addColorStop(0, `rgba(255,0,0,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(255,0,0,0)');
  }
  ctx.fillStyle = auraGrad;
  ctx.fillRect(bcx - boss.w * auraSize, bcy - boss.h * auraSize, boss.w * auraSize * 2, boss.h * auraSize * 2);

  // Fart windup telegraph
  if (boss.state === 'fart_windup') {
    const fartAlpha = 0.3 + 0.2 * Math.sin(performance.now() * 0.02);
    ctx.fillStyle = `rgba(80,200,30,${fartAlpha})`;
    ctx.beginPath();
    ctx.ellipse(bcx, PLATFORM_Y - 5, boss.w * 0.8, boss.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Charge telegraph arrows
  if (boss.state === 'charge_windup') {
    const arrowAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.015);
    ctx.fillStyle = `rgba(255,60,20,${arrowAlpha})`;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    if (boss.chargeDir > 0) {
      ctx.fillText('>>>', bcx + boss.w, bcy);
    } else {
      ctx.fillText('<<<', bcx - boss.w, bcy);
    }
  }

  // Draw sprite — QP -> quentinPizzaSprite, app>=2 -> evilSprite2, else evilSprite
  const useQP = boss.isQuentinPizza && quentinPizzaSpriteLoaded;
  const useSprite2 = !useQP && boss.appearance >= 2 && evilSprite2Loaded;
  const bossSprite = useQP ? quentinPizzaSprite : (useSprite2 ? evilSprite2 : evilSprite);
  if (useQP || useSprite2 || evilSpriteLoaded) {
    ctx.save();
    if (!boss.facingRight) {
      ctx.translate(bcx, bcy);
      ctx.scale(-1, 1);
      ctx.translate(-bcx, -bcy);
    }

    ctx.drawImage(bossSprite, boss.x, boss.y, boss.w, boss.h);

    if (boss.flashTimer > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,255,255,${boss.flashTimer * 5})`;
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    }

    if (boss.rage) {
      ctx.globalCompositeOperation = 'source-atop';
      const tint = 0.15 + 0.1 * Math.sin(performance.now() * 0.008);
      ctx.fillStyle = boss.isQuentinPizza ? `rgba(80,200,20,${tint})` : `rgba(255,0,0,${tint})`;
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    }

    ctx.restore();
  } else {
    ctx.fillStyle = boss.flashTimer > 0 ? '#ffffff' : (boss.rage ? '#cc2222' : '#882222');
    ctx.beginPath();
    ctx.ellipse(bcx, bcy + boss.h * 0.1, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    const eyeOff = boss.facingRight ? boss.w * 0.1 : -boss.w * 0.1;
    const eyeSize = Math.max(3, boss.w * 0.08);
    ctx.fillRect(bcx + eyeOff - eyeSize * 1.5, bcy - boss.h * 0.15, eyeSize, eyeSize);
    ctx.fillRect(bcx + eyeOff + eyeSize * 0.5, bcy - boss.h * 0.15, eyeSize, eyeSize);
  }

  // (Freeze visual now handled by snot cage early return above)

  // Shockwave ring
  if (boss.shockwaveActive) {
    const alpha = Math.max(0, boss.shockwaveTimer / 0.4);
    ctx.strokeStyle = `rgba(255,120,40,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.shockwaveX, PLATFORM_Y, boss.shockwaveRadius, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,200,60,${alpha * 0.5})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(boss.shockwaveX, PLATFORM_Y, boss.shockwaveRadius * 0.8, Math.PI, 0);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawBossHPBar() {
  const boss = S.boss;
  if (!boss || !S.bossActive || boss.dying) return;
  const ctx = S.ctx;

  const barX = 20;
  const barY = H - 40;
  const barW = W - 40;
  const barH = 18;

  ctx.fillStyle = '#220000';
  ctx.fillRect(barX, barY, barW, barH);

  const hpRatio = Math.max(0, boss.hp / boss.maxHp);
  const barColor = boss.rage ? '#ff2222' : '#cc2222';
  ctx.fillStyle = barColor;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  if (S.bossHPBarFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${S.bossHPBarFlash * 3})`;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }

  ctx.strokeStyle = boss.rage ? '#ff4444' : '#882222';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(boss.isQuentinPizza ? 'QUENTIN PIZZA' : 'EVIL EGGTHONY', barX + 6, barY + 13);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffcc44';
  ctx.fillText(`Lvl ${boss.appearance}`, barX + barW - 6, barY + 13);
}

// ============================================================
// FART CLOUD SYSTEM
// ============================================================
export function updateFartClouds(dt) {
  const player = S.player;
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  for (let i = S.fartClouds.length - 1; i >= 0; i--) {
    const c = S.fartClouds[i];
    c.timer -= dt;
    // Expand over first 0.5s
    if (c.expandTimer > 0) {
      c.expandTimer -= dt;
      c.radius = c.maxRadius * (1 - c.expandTimer / 0.5);
    } else {
      c.radius = c.maxRadius;
    }
    // DPS tick
    c.tickTimer -= dt;
    if (c.tickTimer <= 0) {
      c.tickTimer += FART_CLOUD_TICK;
      // Damage player if in cloud
      const dist = Math.hypot(pcx - c.x, pcy - c.y);
      if (dist < c.radius && player.iframes <= 0 && player.metalTimer <= 0 && player.wingsTimer <= 0) {
        const tickDmg = Math.round(c.dps * FART_CLOUD_TICK);
        player.hp -= tickDmg;
        player.flashTimer = 0.08;
        spawnDamageNumber(pcx, player.y, tickDmg, '#88cc22');
      }
    }
    // Ambient particles
    if (Math.random() < 0.3) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * c.radius * 0.8;
      S.particles.push({
        x: c.x + Math.cos(angle) * r,
        y: c.y + Math.sin(angle) * r - Math.random() * 20,
        vx: (Math.random() - 0.5) * 30,
        vy: -Math.random() * 40 - 10,
        life: 0.5, maxLife: 0.5,
        color: Math.random() < 0.5 ? '#66aa22' : '#88cc44',
        size: Math.random() * 3 + 1
      });
    }
    if (c.timer <= 0) {
      S.fartClouds.splice(i, 1);
    }
  }
}

export function drawFartClouds() {
  const ctx = S.ctx;
  for (const c of S.fartClouds) {
    const alpha = Math.min(1, c.timer / 1.0) * 0.5;
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
    grad.addColorStop(0, `rgba(80,160,20,${alpha})`);
    grad.addColorStop(0.6, `rgba(60,120,15,${alpha * 0.6})`);
    grad.addColorStop(1, 'rgba(40,80,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing blobs
    const pulse = 0.8 + 0.2 * Math.sin(performance.now() * 0.005 + c.x);
    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * Math.PI * 2 + performance.now() * 0.001;
      const br = c.radius * 0.4 * pulse;
      const bx = c.x + Math.cos(ba) * br;
      const by = c.y + Math.sin(ba) * br * 0.6;
      const blobGrad = ctx.createRadialGradient(bx, by, 0, bx, by, c.radius * 0.3);
      blobGrad.addColorStop(0, `rgba(100,180,30,${alpha * 0.4})`);
      blobGrad.addColorStop(1, 'rgba(60,120,15,0)');
      ctx.fillStyle = blobGrad;
      ctx.beginPath();
      ctx.arc(bx, by, c.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
