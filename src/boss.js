import { S } from './state.js';
import {
  W, H, GRAVITY, PLATFORM_X, PLATFORM_W, PLATFORM_Y, PLAYER_W, PLAYER_H,
  IFRAME_DURATION, CONTACT_KNOCKBACK,
  FART_CLOUD_RADIUS, FART_CLOUD_DURATION, FART_CLOUD_DPS, FART_CLOUD_TICK,
  SNOT_STORM_DURATION,
} from './constants.js';
import { random } from './rng.js';
import { playSound, playNoise, playVoice, playClip, playWillVoice, quentinFartClip, deanJamClip, melodicaClip, stampClip, gargleClip } from './audio.js';
import {
  evilSprite, evilSpriteLoaded, evilSprite2, evilSprite2Loaded,
  quentinPizzaSprite, quentinPizzaSpriteLoaded,
  deanBossSprite, deanBossSpriteLoaded,
  willBossSprite, willBossSpriteLoaded,
  willFishSprites,
  snotCageSprite, snotCageSpriteLoaded,
  flashCanvas, flashCtx,
} from './sprites.js';
import { spawnParticles, spawnDamageNumber, addShake } from './effects.js';
import { rectsOverlap } from './utils.js';

// ============================================================
// BOSS SYSTEM — EVIL EGGTHONY / QUENTIN PIZZA / DEAN / WILL THE TORTOISE
// ============================================================

export function isBossRound(r) {
  return r >= 3 && r % 3 === 0;
}

export function bossAppearance(r) {
  return Math.floor(r / 3);
}

export function createBoss(r) {
  const app = bossAppearance(r);
  const isWill = r === 12;
  const isDean = app === 2 && !isWill; // Level 6 (first time, r===6)
  const isQP = app >= 3 && !isWill;
  // QP resets scale: qpApp counts from 1 on first QP appearance
  const qpApp = isQP ? app - 2 : app;
  const scale = isWill ? 1.0 : (isDean ? 1.0 : (isQP ? 1 + (qpApp - 1) * 0.15 : 1 + (app - 1) * 0.2));
  const baseH = isWill ? 170 : (isDean ? 160 : (isQP ? 153 : 180));
  const baseW = isWill ? baseH : (isDean ? 100 : (isQP ? 153 : Math.round(180 * (818 / 1164)))); // Will + QP are square, Dean is narrow, egg uses aspect ratio
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const damage = isWill ? 28 : (isQP ? Math.min(30, 20 + (qpApp - 1) * 10) : 20 + (app - 1) * 10);
  const hp = isWill ? 1300 : (isDean ? 800 : 300 + (app - 1) * 200);
  const speed = isWill ? 42 : 100 + (app - 1) * 15;
  const chargeSpeed = isWill ? 440 : (isQP ? 320 + (qpApp - 1) * 20 : 350 + (app - 1) * 30);
  return {
    x: W / 2 - w / 2,
    y: -h - 50,
    w, h,
    vx: 0,
    vy: 0,
    hp: hp,
    maxHp: hp,
    damage: damage,
    scoreValue: isWill ? 3200 : 1000 + (app - 1) * 500,
    speed: speed,
    onPlatform: false,
    appearance: app,
    facingRight: true,
    flashTimer: 0,
    dying: false,
    deathTimer: 0,
    state: 'entering',
    attackCooldown: 2.0,
    chargeSpeed: chargeSpeed,
    chargeTimer: 0,
    chargeDir: 1,
    spinBounces: 0,
    willBeamTimer: 0,
    willBeamTick: 0,
    willBeamCooldown: 0,
    willBeamDirX: 1,
    willBeamDirY: 0,
    willBeamLen: 320,
    willBeamHitDelay: 0,
    willBeamBreakTimer: 0,
    willBeamMashMeter: 0,
    willBeamPlayerCaught: false,
    willMashPrevLeft: false,
    willMashPrevRight: false,
    willMashPrevJump: false,
    willSkyFishTimer: 0.8 + random() * 0.8,
    willSkyFish: [],
    poundTargetX: 0,
    poundTimer: 0,
    shockwaveTimer: 0,
    shockwaveActive: false,
    shockwaveX: 0,
    shockwaveRadius: 0,
    rage: false,
    animTimer: 0,
    isWill: isWill,
    isQuentinPizza: isQP,
    isDean: isDean,
    fartCooldown: 0,
    fartTimer: 0,
    freezeTimer: 0
  };
}

export function updateBoss(dt) {
  const boss = S.boss;
  const player = S.player;
  const keys = S.keys;

  if (!boss || !S.bossActive) {
    if (!gargleClip.paused) {
      gargleClip.pause();
      gargleClip.currentTime = 0;
    }
    return;
  }

  boss.animTimer += dt * 3;
  boss.flashTimer = Math.max(0, boss.flashTimer - dt);
  S.bossHPBarFlash = Math.max(0, S.bossHPBarFlash - dt);
  if (boss.isWill) boss.willBeamPlayerCaught = false;
  const beamGargling = boss.isWill && boss.state === 'will_beam_fire' && !boss.dying && boss.freezeTimer <= 0;
  if (beamGargling) {
    if (gargleClip.paused) {
      gargleClip.currentTime = 0;
      gargleClip.play().catch(() => {});
    }
  } else if (!gargleClip.paused) {
    gargleClip.pause();
    gargleClip.currentTime = 0;
  }

  // Death animation
  if (boss.dying) {
    boss.deathTimer -= dt;
    if (boss.deathTimer <= 0) {
      S.score += boss.scoreValue;
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
    if (boss.isWill) playWillVoice(true);
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.isWill ? '#88cc44' : '#ff2222', 20, 200, 0.6);
  }

  const updateWillSkyFish = () => {
    if (!boss.isWill) return;
    if (!Array.isArray(boss.willSkyFish)) boss.willSkyFish = [];
    const fishPool = willFishSprites;
    const maxFish = 90;
    const spawnActive = !boss.dying && boss.state !== 'entering';

    boss.willSkyFishTimer -= dt;
    if (spawnActive && boss.willSkyFishTimer <= 0) {
      const baseInterval = boss.rage ? 0.5 : 0.7;
      boss.willSkyFishTimer = baseInterval + random() * 0.7;
      const spriteIndex = fishPool.length > 0 ? Math.floor(random() * fishPool.length) : -1;
      const fishSprite = spriteIndex >= 0 ? fishPool[spriteIndex] : null;
      const w = fishSprite ? (20 + random() * 16) : (18 + random() * 8);
      const h = fishSprite
        ? w * ((fishSprite.naturalHeight || fishSprite.height || w) / (fishSprite.naturalWidth || fishSprite.width || w))
        : w * 0.55;
      boss.willSkyFish.push({
        x: PLATFORM_X + 14 + random() * (PLATFORM_W - 28),
        y: -40 - random() * 120,
        vx: (random() - 0.5) * 28,
        vy: 70 + random() * 65,
        rot: random() * Math.PI * 2,
        rotV: (random() - 0.5) * 2.8,
        w, h,
        spriteIndex: spriteIndex,
        landed: false,
        hitPlayer: false,
        damage: Math.max(4, Math.round(boss.damage * 0.3)),
      });
    }

    const getSupportY = (fish) => {
      let supportY = PLATFORM_Y - fish.h * 0.42;
      for (let i = 0; i < boss.willSkyFish.length; i++) {
        const other = boss.willSkyFish[i];
        if (!other || other === fish || !other.landed) continue;
        const xDist = Math.abs(fish.x - other.x);
        const overlapX = (fish.w + other.w) * 0.32;
        if (xDist > overlapX) continue;
        const stackedY = other.y - (fish.h + other.h) * 0.34;
        if (stackedY < supportY) supportY = stackedY;
      }
      return supportY;
    };

    const pcx = player.x + PLAYER_W / 2;
    const pcy = player.y + PLAYER_H / 2;
    for (let i = boss.willSkyFish.length - 1; i >= 0; i--) {
      const fish = boss.willSkyFish[i];
      if (!fish) continue;

      if (!fish.landed) {
        fish.vy += GRAVITY * 0.28 * dt;
        if (fish.vy > 230) fish.vy = 230;
        fish.x += fish.vx * dt;
        fish.y += fish.vy * dt;
        fish.rot += fish.rotV * dt;

        if (fish.x < PLATFORM_X + fish.w * 0.35) {
          fish.x = PLATFORM_X + fish.w * 0.35;
          fish.vx = Math.abs(fish.vx) * 0.25;
        } else if (fish.x > PLATFORM_X + PLATFORM_W - fish.w * 0.35) {
          fish.x = PLATFORM_X + PLATFORM_W - fish.w * 0.35;
          fish.vx = -Math.abs(fish.vx) * 0.25;
        }

        const supportY = getSupportY(fish);
        if (fish.y >= supportY) {
          fish.y = supportY;
          fish.landed = true;
          fish.vx = 0;
          fish.vy = 0;
          fish.rotV = 0;
          fish.rot = (random() - 0.5) * 0.45;
          if (random() < 0.18) spawnParticles(fish.x, fish.y, '#8fbf58', 2, 40, 0.15);
        } else if (!fish.hitPlayer && rectsOverlap(
            player.x, player.y, PLAYER_W, PLAYER_H,
            fish.x - fish.w * 0.45, fish.y - fish.h * 0.45, fish.w * 0.9, fish.h * 0.9
        )) {
          fish.hitPlayer = true;
          if (!S.devInvulnerable && player.iframes <= 0 && player.wingsTimer <= 0) {
            if (player.metalTimer > 0) {
              fish.vx *= -0.2;
              fish.vy = -Math.abs(fish.vy) * 0.2;
              spawnParticles(pcx, pcy, '#aaccff', 5, 90, 0.2);
              playSound('hit');
            } else {
              const hitDmg = fish.damage;
              const knockDir = Math.sign(pcx - fish.x) || 1;
              player.hp -= hitDmg;
              player.iframes = Math.max(player.iframes, 0.35);
              player.vx = knockDir * 220;
              player.vy = -180;
              player.knockbackTimer = 0.16;
              player.flashTimer = 0.12;
              spawnDamageNumber(pcx, player.y, hitDmg, '#b8df72');
              addShake(4, 0.08);
              playSound('hurt');
            }
          }
        }
      }
    }

    if (boss.willSkyFish.length > maxFish) {
      const overflow = boss.willSkyFish.length - maxFish;
      for (let i = 0; i < overflow; i++) {
        const landedIndex = boss.willSkyFish.findIndex((f) => f && f.landed);
        if (landedIndex >= 0) boss.willSkyFish.splice(landedIndex, 1);
        else boss.willSkyFish.shift();
      }
    }
  };

  updateWillSkyFish();

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

  if (boss.isWill && boss.willBeamCooldown > 0) {
    boss.willBeamCooldown = Math.max(0, boss.willBeamCooldown - dt);
  }
  if (boss.isWill && boss.willBeamBreakTimer > 0) {
    boss.willBeamBreakTimer = Math.max(0, boss.willBeamBreakTimer - dt);
  }

  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  const bcx = boss.x + boss.w / 2;
  const bcy = boss.y + boss.h / 2;
  const getWillMouthPos = () => ({
    x: boss.x + (boss.facingRight ? boss.w * 0.64 : boss.w * 0.36),
    y: boss.y + boss.h * 0.36
  });
  const triggerWillStompImpact = () => {
    boss.shockwaveActive = true;
    boss.shockwaveX = boss.x + boss.w / 2;
    boss.shockwaveRadius = 0;
    boss.shockwaveTimer = 0.4;

    addShake(13, 0.32);
    spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, '#a4c860', 28, 300, 0.5);
    playClip(stampClip);
    playNoise(0.25, 0.2);
    if (random() < 0.8) playWillVoice();

    const playerFeetY = player.y + PLAYER_H;
    const onMainStage = player.onGround && playerFeetY >= PLATFORM_Y - 4;
    // Horizontal splash only applies near main-stage height, not on high floating platforms.
    const nearMainStageHeight = playerFeetY >= PLATFORM_Y - 48;
    const closeHoriz = nearMainStageHeight && Math.abs(pcx - (boss.x + boss.w / 2)) <= 120;
    const stompHitsPlayer = onMainStage || closeHoriz;
    if (!stompHitsPlayer || player.iframes > 0 || player.wingsTimer > 0) return;

    const knockDir = Math.sign(pcx - (boss.x + boss.w / 2)) || 1;
    if (player.metalTimer > 0) {
      player.vx = knockDir * 400;
      player.vy = -300;
      spawnParticles(pcx, pcy, '#aaccff', 6, 120, 0.3);
      playSound('hit');
    } else {
      player.hp -= boss.damage;
      player.iframes = IFRAME_DURATION;
      player.vx = knockDir * 400;
      player.vy = -250;
      player.knockbackTimer = 0.3;
      player.airJumps = 1;
      player.flashTimer = 0.15;
      spawnDamageNumber(pcx, player.y, boss.damage, '#ff4444');
      addShake(6, 0.15);
      playSound('hurt');
      if (random() < 0.3) playVoice('bad');
    }
  };

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
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, boss.isWill ? '#a4c860' : '#ffaa44', 30, 250, 0.6);
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, boss.isWill ? '#5d7a29' : '#ff6622', 20, 200, 0.5);
        playSound('bossSlam');
        playNoise(0.2, 0.25);
        // QP immediately farts on landing
        if (boss.isQuentinPizza) {
          boss.state = 'fart_windup';
          boss.fartTimer = 0.4;
        } else if (boss.isDean) {
          playClip(deanJamClip);
          boss.state = 'idle';
          boss.attackCooldown = 1.5;
        } else {
          boss.state = 'idle';
          boss.attackCooldown = 1.5;
          if (boss.isWill) playWillVoice(true);
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

      // Dean random jam line
      if (boss.isDean && random() < dt * 0.15) {
        playClip(deanJamClip);
      }

      // QP fart cooldown decay
      if (boss.isQuentinPizza && boss.fartCooldown > 0) {
        boss.fartCooldown -= dt;
      }

      boss.attackCooldown -= dt;
      if (boss.attackCooldown <= 0) {
        // Dean: chance to sonic boom
        if (boss.isDean && Math.random() < 0.4) {
          boss.state = 'sonic_boom_windup';
          boss.chargeTimer = 0.8;
          boss.vx = 0;
        } else if (boss.isWill) {
          const useBeam = boss.willBeamCooldown <= 0 && random() < (boss.rage ? 0.45 : 0.35);
          if (useBeam) {
            boss.state = 'will_beam_windup';
            boss.willBeamTimer = boss.rage ? 0.45 : 0.6;
            boss.vx = 0;
            if (random() < 0.7) playWillVoice();
          } else {
            boss.state = 'will_stomp_windup';
            boss.poundTimer = boss.rage ? 0.45 : 0.55;
            boss.vx = 0;
            if (random() < 0.65) playWillVoice();
          }
        // QP: chance to fart instead of normal attack
        } else if (boss.isQuentinPizza && boss.fartCooldown <= 0 && random() < 0.35) {
          boss.state = 'fart_windup';
          boss.fartTimer = 0.8;
          boss.vx = 0;
        } else {
          const dist = Math.abs(pcx - bcx);
          if (dist < 250 && random() < 0.5) {
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

    case 'sonic_boom_windup': {
      boss.chargeTimer -= dt;
      boss.vx = 0;
      if (boss.chargeTimer <= 0) {
        boss.state = 'sonic_boom_release';
        boss.chargeTimer = 0.5;
        playClip(melodicaClip); // Play the melodica for the sonic impact

        // Spawn sonic boom projectile/shockwave
        const dir = boss.facingRight ? 1 : -1;
        S.enemyProjectiles.push({
          x: boss.facingRight ? boss.x + boss.w : boss.x,
          y: boss.y + boss.h / 2,
          vx: dir * 750, // slightly faster
          vy: 0,
          damage: 30, // slightly more damage
          life: 2.5,
          color: '#00ffff',
          radius: 120, // much taller
          isSonicBoom: true,
          knockbackX: dir * 2200, // massive knockback
          knockbackY: -700
        });
        addShake(15, 0.4);
      }
      break;
    }
    case 'sonic_boom_release': {
      boss.chargeTimer -= dt;
      boss.vx = 0;
      if (boss.chargeTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 2.0 * cooldownMult;
      }
      break;
    }

    case 'will_beam_windup': {
      boss.vx = 0;
      const mouth = getWillMouthPos();
      const toPlayerX = pcx - mouth.x;
      const toPlayerY = pcy - mouth.y;
      const toPlayerLen = Math.hypot(toPlayerX, toPlayerY);
      if (toPlayerLen > 1) {
        boss.willBeamDirX = toPlayerX / toPlayerLen;
        boss.willBeamDirY = toPlayerY / toPlayerLen;
        // Extend beam to the screen edge
        const edgeDists = [];
        if (boss.willBeamDirX > 0.01) edgeDists.push((W - mouth.x) / boss.willBeamDirX);
        if (boss.willBeamDirX < -0.01) edgeDists.push(-mouth.x / boss.willBeamDirX);
        if (boss.willBeamDirY > 0.01) edgeDists.push((H - mouth.y) / boss.willBeamDirY);
        if (boss.willBeamDirY < -0.01) edgeDists.push(-mouth.y / boss.willBeamDirY);
        const edgeDist = edgeDists.length > 0 ? Math.min(...edgeDists) : 500;
        boss.willBeamLen = Math.max(200, edgeDist + 40);
      }
      boss.facingRight = toPlayerX >= 0;
      boss.willBeamMashMeter = Math.max(0, boss.willBeamMashMeter - dt * 0.6);
      boss.willBeamTimer -= dt;
      if (boss.willBeamTimer <= 0) {
        boss.state = 'will_beam_fire';
        boss.willBeamTimer = boss.rage ? 1.8 : 1.5;
        boss.willBeamHitDelay = 0.16;
        boss.willBeamTick = 0;
        boss.willBeamCooldown = boss.rage ? 3.8 : 4.8;
        boss.willBeamBreakTimer = 0;
        boss.willBeamMashMeter = 0;
        boss.willMashPrevLeft = false;
        boss.willMashPrevRight = false;
        boss.willMashPrevJump = false;
        playWillVoice(true);
      }
      break;
    }

    case 'will_beam_fire': {
      boss.vx = 0;
      boss.willBeamTimer -= dt;
      boss.willBeamHitDelay = Math.max(0, boss.willBeamHitDelay - dt);
      boss.willBeamTick -= dt;

      const mouth = getWillMouthPos();
      boss.facingRight = boss.willBeamDirX >= 0;

      const beamEndX = mouth.x + boss.willBeamDirX * boss.willBeamLen;
      const beamEndY = mouth.y + boss.willBeamDirY * boss.willBeamLen;
      const segDx = beamEndX - mouth.x;
      const segDy = beamEndY - mouth.y;
      const segLenSq = segDx * segDx + segDy * segDy;
      const t = segLenSq > 0
        ? Math.max(0, Math.min(1, ((pcx - mouth.x) * segDx + (pcy - mouth.y) * segDy) / segLenSq))
        : 0;
      const closestX = mouth.x + segDx * t;
      const closestY = mouth.y + segDy * t;
      const distToBeam = Math.hypot(pcx - closestX, pcy - closestY);
      const inBeam = boss.willBeamHitDelay <= 0 && distToBeam <= 42;
      boss.willBeamPlayerCaught = inBeam;

      const leftHeld = !!(keys['a'] || keys['arrowleft']);
      const rightHeld = !!(keys['d'] || keys['arrowright']);
      const jumpHeld = !!(keys[' '] || keys['arrowup'] || keys['w']);
      const leftTap = leftHeld && !boss.willMashPrevLeft;
      const rightTap = rightHeld && !boss.willMashPrevRight;
      const jumpTap = jumpHeld && !boss.willMashPrevJump;
      if (leftTap || rightTap || jumpTap) {
        boss.willBeamMashMeter += (leftTap || rightTap ? 0.22 : 0) + (jumpTap ? 0.16 : 0);
      }
      boss.willMashPrevLeft = leftHeld;
      boss.willMashPrevRight = rightHeld;
      boss.willMashPrevJump = jumpHeld;
      boss.willBeamMashMeter = Math.max(0, boss.willBeamMashMeter - dt * 0.75);
      if (boss.willBeamMashMeter >= 1.0 && boss.willBeamBreakTimer <= 0) {
        boss.willBeamBreakTimer = 0.45;
        boss.willBeamMashMeter = 0;
        const awayX = pcx - mouth.x;
        const awayY = pcy - mouth.y;
        const awayLen = Math.hypot(awayX, awayY) || 1;
        player.vx += (awayX / awayLen) * 240;
        player.vy += (awayY / awayLen) * 220;
        player.iframes = Math.max(player.iframes, 0.18);
        spawnParticles(pcx, pcy, '#b6ff72', 8, 140, 0.25);
      }

      if (inBeam && boss.willBeamBreakTimer <= 0) {
        const pullX = mouth.x - pcx;
        const pullY = mouth.y - pcy;
        const pullLen = Math.hypot(pullX, pullY) || 1;
        const resist = Math.min(0.7, boss.willBeamMashMeter * 0.6);
        const pullScale = Math.max(0.45, 1 - resist);
        player.vx += (pullX / pullLen) * 1050 * pullScale * dt;
        player.vy += (pullY / pullLen) * 860 * pullScale * dt;

        if (player.iframes <= 0 && player.wingsTimer <= 0 && player.metalTimer <= 0 && boss.willBeamTick <= 0) {
          const beamDmg = Math.max(2, Math.round(boss.damage * 0.2));
          player.hp -= beamDmg;
          player.iframes = 0.2;
          player.flashTimer = 0.08;
          spawnDamageNumber(pcx, player.y, beamDmg, '#99dd66');
          playSound('hurt');
          boss.willBeamTick = 0.22;
        }

        if (random() < 0.12) {
          spawnParticles(pcx, pcy, '#88cc55', 1, 80, 0.2);
        }
      }

      if (boss.willBeamTimer <= 0) {
        boss.state = 'will_beam_recover';
        boss.willBeamTimer = boss.rage ? 0.22 : 0.32;
        boss.willBeamBreakTimer = 0;
        boss.willMashPrevLeft = false;
        boss.willMashPrevRight = false;
        boss.willMashPrevJump = false;
      }
      break;
    }

    case 'will_beam_recover': {
      boss.vx = 0;
      boss.willBeamTimer -= dt;
      if (boss.willBeamTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 1.0 * cooldownMult;
      }
      break;
    }

    case 'will_stomp_windup': {
      boss.poundTimer -= dt;
      boss.vx = 0;
      if (boss.poundTimer <= 0) {
        boss.state = 'will_stomp_hop';
        boss.vy = boss.rage ? -280 : -240;
        boss.onPlatform = false;
      }
      break;
    }

    case 'will_stomp_hop': {
      boss.vx = 0;
      boss.vy += GRAVITY * 1.8 * dt;
      boss.y += boss.vy * dt;
      if (boss.y + boss.h >= PLATFORM_Y) {
        boss.y = PLATFORM_Y - boss.h;
        boss.vy = 0;
        boss.onPlatform = true;
        triggerWillStompImpact();
        boss.state = 'will_stomp_recover';
        boss.poundTimer = boss.rage ? 0.25 : 0.35;
      }
      break;
    }

    case 'will_stomp_recover': {
      boss.poundTimer -= dt;
      boss.vx = 0;
      if (boss.poundTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 1.1 * cooldownMult;
      }
      break;
    }

    case 'shell_windup': {
      boss.chargeTimer -= dt;
      boss.vx = 0;
      if (boss.chargeTimer <= 0) {
        boss.state = 'shell_spin';
        boss.chargeTimer = boss.rage ? 1.9 : 1.5;
        boss.spinBounces = boss.rage ? 2 : 1;
        playSound('bossRoar');
        playWillVoice(true);
      }
      break;
    }

    case 'shell_spin': {
      boss.vx = boss.chargeDir * boss.chargeSpeed * rageMult * 1.15;
      boss.x += boss.vx * dt;
      boss.chargeTimer -= dt;

      if (random() < 0.35) {
        spawnParticles(boss.x + boss.w / 2, boss.y + boss.h * 0.8, '#77963d', 1, 120, 0.15);
      }

      let bounced = false;
      if (boss.x < PLATFORM_X) {
        boss.x = PLATFORM_X;
        bounced = true;
      } else if (boss.x + boss.w > PLATFORM_X + PLATFORM_W) {
        boss.x = PLATFORM_X + PLATFORM_W - boss.w;
        bounced = true;
      }

      if (bounced) {
        if (boss.spinBounces > 0) {
          boss.spinBounces -= 1;
          boss.chargeDir *= -1;
          addShake(4, 0.08);
          playSound('bossSlam');
          if (random() < 0.75) playWillVoice();
        } else {
          boss.chargeTimer = 0;
        }
      }

      if (boss.chargeTimer <= 0) {
        boss.state = 'idle';
        boss.attackCooldown = 1.4 * cooldownMult;
        boss.vx = 0;
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
        spawnParticles(boss.x + boss.w / 2, PLATFORM_Y, boss.isWill ? '#a4c860' : '#ffaa44', 25, 300, 0.5);
        playSound('bossSlam');
        playNoise(0.25, 0.2);
        if (boss.isWill && random() < 0.8) playWillVoice();

        const shockDist = Math.abs(pcx - (boss.x + boss.w / 2));
        const stompHitsPlayer = boss.isWill ? player.onGround : (shockDist < 120);
        if (stompHitsPlayer && player.iframes <= 0 && player.wingsTimer <= 0) {
          if (player.metalTimer > 0) {
            const knockDir = Math.sign(pcx - (boss.x + boss.w / 2)) || 1;
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
            player.knockbackTimer = 0.3;
            player.airJumps = 1; // reset air jump so player can escape knockback
            player.flashTimer = 0.15;
            spawnDamageNumber(pcx, player.y, boss.damage, '#ff4444');
            addShake(6, 0.15);
            playSound('hurt');
            if (random() < 0.3) playVoice('bad');
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
        playClip(quentinFartClip);
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
    // Will uses a tighter contact box so jumping over the top is less punishing.
    const contactX = boss.isWill ? boss.x + boss.w * 0.22 : boss.x;
    const contactY = boss.isWill ? boss.y + boss.h * 0.24 : boss.y;
    const contactW = boss.isWill ? boss.w * 0.56 : boss.w;
    const contactH = boss.isWill ? boss.h * 0.74 : boss.h;
    if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, contactX, contactY, contactW, contactH)) {
      if (player.metalTimer > 0) {
        const knockDir = Math.sign(boss.x + boss.w / 2 - pcx) || 1;
        damageBoss(40, knockDir * 100, -50);
        spawnParticles(pcx, pcy, '#aaccff', 6, 120, 0.3);
        playSound('hit');
        player.iframes = 0.2;
      } else {
        const touchDamage = (boss.isWill && boss.state === 'shell_spin') ? Math.round(boss.damage * 1.35) : boss.damage;
        const contactKnockback = (boss.isWill && boss.state === 'shell_spin') ? CONTACT_KNOCKBACK * 1.2 : CONTACT_KNOCKBACK;
        const knockDir = Math.sign(pcx - (boss.x + boss.w / 2)) || 1;
        player.hp -= touchDamage;
        player.iframes = IFRAME_DURATION;
        player.vx = knockDir * contactKnockback;
        player.vy = -380;
        player.knockbackTimer = 0.3;
        player.airJumps = 1; // reset air jump so player can escape knockback
        player.flashTimer = 0.15;
        spawnDamageNumber(pcx, player.y, touchDamage, '#ff4444');
        addShake(6, 0.15);
        playSound('hurt');
        if (random() < 0.3) playVoice('bad');
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
  let dealtDamage = damage;
  // Shell spin grants heavy damage reduction to emphasize tortoise armor.
  if (boss.isWill && boss.state === 'shell_spin') {
    dealtDamage = Math.max(1, Math.round(damage * 0.45));
  }
  boss.hp -= dealtDamage;
  boss.flashTimer = 0.1;
  S.bossHPBarFlash = 0.15;
  // Reduced knockback (boss is heavy)
  boss.x += knockX * 0.3 * (1 / 60);

  spawnDamageNumber(boss.x + boss.w / 2, boss.y, dealtDamage, '#ffff44');
  playSound('hit');

  if (boss.hp <= 0) {
    boss.dying = true;
    boss.deathTimer = 1.0;
    boss.vx = 0;
    if (boss.isDean) {
      deanJamClip.pause();
      deanJamClip.currentTime = 0;
    }
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

  // Aura (olive for Will, green for QP, red for evil eggthony, cyan for Dean)
  const auraSize = boss.rage ? 1.4 : 1.15;
  const auraAlpha = boss.rage ? (0.25 + 0.15 * Math.sin(performance.now() * 0.01)) : 0.1;
  const auraGrad = ctx.createRadialGradient(bcx, bcy, boss.w * 0.3, bcx, bcy, boss.w * auraSize);
  if (boss.isWill) {
    auraGrad.addColorStop(0, `rgba(125,170,60,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(125,170,60,0)');
  } else if (boss.isQuentinPizza) {
    auraGrad.addColorStop(0, `rgba(80,200,20,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(80,200,20,0)');
  } else if (boss.isDean) {
    auraGrad.addColorStop(0, `rgba(0,255,255,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(0,255,255,0)');
  } else {
    auraGrad.addColorStop(0, `rgba(255,0,0,${auraAlpha})`);
    auraGrad.addColorStop(1, 'rgba(255,0,0,0)');
  }
  ctx.fillStyle = auraGrad;
  ctx.fillRect(bcx - boss.w * auraSize, bcy - boss.h * auraSize, boss.w * auraSize * 2, boss.h * auraSize * 2);

  // Fart windup telegraph
  if (boss.isQuentinPizza && boss.state === 'fart_windup') {
    const fartAlpha = 0.3 + 0.2 * Math.sin(performance.now() * 0.02);
    ctx.fillStyle = `rgba(80,200,30,${fartAlpha})`;
    ctx.beginPath();
    ctx.ellipse(bcx, PLATFORM_Y - 5, boss.w * 0.8, boss.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (boss.isWill && boss.state === 'will_stomp_windup') {
    const stompAlpha = 0.35 + 0.25 * Math.sin(performance.now() * 0.03);
    ctx.strokeStyle = `rgba(180,220,110,${stompAlpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bcx, PLATFORM_Y, 95, Math.PI, 0);
    ctx.stroke();
  }

  const drawWillSkyFish = () => {
    if (!boss.isWill || !Array.isArray(boss.willSkyFish) || boss.willSkyFish.length <= 0) return;
    const fishPool = willFishSprites;
    const fishToDraw = boss.willSkyFish.slice().sort((a, b) => a.y - b.y);

    for (const fish of fishToDraw) {
      const drawW = fish.w;
      const drawH = fish.h;
      const fishSprite = fish.spriteIndex >= 0 ? fishPool[fish.spriteIndex % fishPool.length] : null;
      ctx.save();
      ctx.translate(fish.x, fish.y);
      ctx.rotate(fish.rot || 0);
      ctx.globalAlpha = fish.landed ? 0.92 : 1;
      if (fishSprite) {
        ctx.drawImage(fishSprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      } else {
        ctx.fillStyle = fish.landed ? '#89b34c' : '#9cca58';
        ctx.beginPath();
        ctx.ellipse(0, 0, drawW * 0.5, drawH * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const drawWillBeamFish = () => {
    if (!(boss.isWill && (boss.state === 'will_beam_windup' || boss.state === 'will_beam_fire'))) return;
    const mouthX = boss.x + (boss.facingRight ? boss.w * 0.64 : boss.w * 0.36);
    const mouthY = boss.y + boss.h * 0.36;
    const dirX = boss.willBeamDirX || (boss.facingRight ? 1 : -1);
    const dirY = boss.willBeamDirY || 0;
    const beamLen = boss.willBeamLen || 320;
    const beamAngle = Math.atan2(dirY, dirX);
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.02);
    const fishPool = willFishSprites;

    ctx.save();
    ctx.translate(mouthX, mouthY);
    ctx.rotate(beamAngle);
    if (fishPool.length <= 0) {
      ctx.fillStyle = `rgba(120,200,70,0.15)`;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + pulse * 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (boss.state === 'will_beam_windup') {
      for (let i = 0; i < 14; i++) {
        const fish = fishPool[i % fishPool.length];
        const orbitR = 8 + (i % 5) * 2 + pulse * 6;
        const orbitA = performance.now() * 0.004 + i * 0.45;
        const fx = Math.cos(orbitA) * orbitR;
        const fy = Math.sin(orbitA) * orbitR * 0.65;
        const w = 16 + (i % 3) * 4;
        const h = w * (fish.naturalHeight / fish.naturalWidth);
        ctx.drawImage(fish, fx - w * 0.55, fy - h * 0.5, w, h);
      }
    } else {
      // Dense, overlapping fish copies packed across the full beam.
      const spacing = 8;
      const lanes = 5;
      const laneOffsets = [-24, -12, 0, 12, 24];
      const fishCount = Math.ceil(beamLen / spacing) + 4;
      const flow = (performance.now() * 0.09) % spacing;

      ctx.globalAlpha = 0.94;
      for (let lane = 0; lane < lanes; lane++) {
        const laneY = laneOffsets[lane];
        for (let i = 0; i < fishCount; i++) {
          const fish = fishPool[(i + lane * 3) % fishPool.length];
          const x = i * spacing - flow - 36 + lane * 1.5;
          if (x < -70 || x > beamLen + 24) continue;
          const y = laneY + Math.sin((i + lane * 0.8) * 0.7 + performance.now() * 0.01) * 2.5;
          const w = 20 + ((i + lane) % 4) * 5;
          const h = w * (fish.naturalHeight / fish.naturalWidth);
          ctx.save();
          ctx.translate(x, y);
          // Fish travel toward Will's mouth (negative local X), so flip to face that way.
          ctx.scale(-1, 1);
          ctx.drawImage(fish, -w * 0.45, -h * 0.5, w, h);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // Charge telegraph arrows
  if (boss.state === 'charge_windup' || boss.state === 'shell_windup') {
    const arrowAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.015);
    ctx.fillStyle = boss.state === 'shell_windup' ? `rgba(120,180,60,${arrowAlpha})` : `rgba(255,60,20,${arrowAlpha})`;
    ctx.font = boss.state === 'shell_windup' ? 'bold 20px monospace' : 'bold 30px monospace';
    ctx.textAlign = 'center';
    if (boss.state === 'shell_windup') {
      ctx.fillText('SPIN!', bcx, boss.y - 8);
    } else {
      if (boss.chargeDir > 0) {
        ctx.fillText('>>>', bcx + boss.w, bcy);
      } else {
        ctx.fillText('<<<', bcx - boss.w, bcy);
      }
    }
  }

  // Sonic Boom telegraph
  if (boss.state === 'sonic_boom_windup') {
    const boomAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.03);
    ctx.fillStyle = `rgba(0,255,255,${boomAlpha})`;
    ctx.beginPath();
    const boomX = boss.facingRight ? boss.x + boss.w : boss.x;
    ctx.arc(boomX, bcy, 20 + Math.sin(performance.now() * 0.05) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWillSkyFish();

  // Draw sprite — Will -> willBossSprite, Dean -> deanBossSprite, QP -> quentinPizzaSprite, app>=2 -> evilSprite2, else evilSprite
  const useWill = boss.isWill && willBossSpriteLoaded;
  const useDean = !useWill && boss.isDean && deanBossSpriteLoaded;
  const useQP = !useWill && !useDean && boss.isQuentinPizza && quentinPizzaSpriteLoaded;
  const useSprite2 = !useWill && !useDean && !useQP && boss.appearance >= 2 && evilSprite2Loaded;
  const bossSprite = useWill ? willBossSprite : (useDean ? deanBossSprite : (useQP ? quentinPizzaSprite : (useSprite2 ? evilSprite2 : evilSprite)));
  if (useWill || useDean || useQP || useSprite2 || evilSpriteLoaded) {
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
      ctx.fillStyle = boss.isWill ? `rgba(130,180,60,${tint})` : (boss.isQuentinPizza ? `rgba(80,200,20,${tint})` : (boss.isDean ? `rgba(0,255,255,${tint})` : `rgba(255,0,0,${tint})`));
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    }

    ctx.restore();
  } else {
    if (boss.flashTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else if (boss.isWill) {
      ctx.fillStyle = boss.rage ? '#91b651' : '#5f7b34';
    } else {
      ctx.fillStyle = boss.rage ? '#cc2222' : '#882222';
    }
    ctx.beginPath();
    ctx.ellipse(bcx, bcy + boss.h * 0.1, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boss.isWill ? '#1a230e' : '#ff0000';
    const eyeOff = boss.facingRight ? boss.w * 0.1 : -boss.w * 0.1;
    const eyeSize = Math.max(3, boss.w * 0.08);
    ctx.fillRect(bcx + eyeOff - eyeSize * 1.5, bcy - boss.h * 0.15, eyeSize, eyeSize);
    ctx.fillRect(bcx + eyeOff + eyeSize * 0.5, bcy - boss.h * 0.15, eyeSize, eyeSize);
  }

  // Draw fish beam after Will sprite so it can occlude his face.
  drawWillBeamFish();

  if (boss.isWill && boss.state === 'shell_spin') {
    const ringAlpha = 0.2 + 0.2 * Math.sin(performance.now() * 0.03);
    ctx.strokeStyle = `rgba(180,220,110,${ringAlpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(bcx, bcy + boss.h * 0.1, boss.w * 0.6, boss.h * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
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
  const barColor = boss.isWill ? (boss.rage ? '#9ecb58' : '#6c8f3a') : (boss.rage ? '#ff2222' : '#cc2222');
  ctx.fillStyle = barColor;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  if (S.bossHPBarFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${S.bossHPBarFlash * 3})`;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }

  ctx.strokeStyle = boss.isWill ? (boss.rage ? '#b9e86d' : '#87ad50') : (boss.rage ? '#ff4444' : '#882222');
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  const bossName = boss.isWill ? 'WILL THE TORTOISE' : (boss.isQuentinPizza ? 'QUENTIN PIZZA' : (boss.isDean ? 'DEAN' : 'EVIL EGGTHONY'));
  ctx.fillText(bossName, barX + 6, barY + 13);

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
    if (random() < 0.3) {
      const angle = random() * Math.PI * 2;
      const r = random() * c.radius * 0.8;
      S.particles.push({
        x: c.x + Math.cos(angle) * r,
        y: c.y + Math.sin(angle) * r - random() * 20,
        vx: (random() - 0.5) * 30,
        vy: -random() * 40 - 10,
        life: 0.5, maxLife: 0.5,
        color: random() < 0.5 ? '#66aa22' : '#88cc44',
        size: random() * 3 + 1
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