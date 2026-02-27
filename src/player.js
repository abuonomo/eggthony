import { S } from './state.js';
import {
  W, H,
  GRAVITY, PLAYER_SPEED, JUMP_FORCE,
  PLATFORM_Y, PLATFORM_X, PLATFORM_W,
  PLAYER_W, PLAYER_H,
  SNOT_COOLDOWN, SNOT_MAX_CHARGE,
  WINGS_FLY_Y, WINGS_RISE_SPEED,
  SPIDER_DROP_Y, LIGHTNING_COOLDOWN,
  POOP_COOLDOWN,
} from './constants.js';
import {
  eggSprite, spriteLoaded,
  metalSprite, metalSpriteLoaded,
  muscleSprite, muscleSpriteLoaded,
  wingsSprite, wingsSpriteLoaded,
} from './sprites.js';
import { spawnParticles } from './effects.js';
import { playSound } from './audio.js';
import { fireLightning, firePoopBomb } from './weapons.js';
import { autoAimMouse } from './input.js';
import { drawGearOnPlayer } from './gear.js';

// ============================================================
// PLAYER UPDATE (physics, movement, jumping, collisions, timers)
// ============================================================
export function updatePlayer(dt) {
  const { player, keys, mouse, floatingPlatforms, particles } = S;

  // Attack: poop dropper while flying, lightning otherwise (left click only)
  if (S.gameState === 'playing' && player.hp > 0 && mouse.left) {
    if (player.wingsTimer > 0) {
      if (player.poopCooldown <= 0) {
        autoAimMouse();
        player.poopCooldown = POOP_COOLDOWN;
        firePoopBomb();
      }
    } else if (!S.campSpider || S.campSpider.state !== 'grabbed') {
      if (player.lightningCooldown <= 0) {
        autoAimMouse();
        const fireRateMult = player.spiderDropTimer > 0 ? 3 : 1;
        player.lightningCooldown = LIGHTNING_COOLDOWN / fireRateMult;
        fireLightning();
      }
    }
  }

  // Movement
  let moveX = 0;
  if (keys['a'] || keys['arrowleft']) moveX -= 1;
  if (keys['d'] || keys['arrowright']) moveX += 1;
  const gearSpeed = S.gear.totalBuffs ? S.gear.totalBuffs.speed : 0;
  player.vx = moveX * (PLAYER_SPEED + gearSpeed);

  if (player.spiderDropTimer > 0) {
    // Spider Drop mode — hang from ceiling, 3x fire rate
    player.spiderDropTimer -= dt;
    player.y = SPIDER_DROP_Y + Math.sin(performance.now() * 0.004) * 3;
    player.vy = 0;
    player.onGround = false;
    player.x += player.vx * dt;
    // End: drop back down
    if (player.spiderDropTimer <= 0) {
      player.spiderDropTimer = 0;
    }
  } else if (player.wingsTimer > 0) {
    // Flying mode — rise to target height, gentle bob
    const targetY = WINGS_FLY_Y;
    if (player.y + PLAYER_H / 2 > targetY) {
      player.vy = -WINGS_RISE_SPEED;
      player.y += player.vy * dt;
      if (player.y + PLAYER_H / 2 <= targetY) {
        player.y = targetY - PLAYER_H / 2;
        player.vy = 0;
      }
    } else {
      // Gentle sine bob at target height
      player.y = targetY - PLAYER_H / 2 + Math.sin(performance.now() * 0.003) * 4;
      player.vy = 0;
    }
    player.x += player.vx * dt;
    player.onGround = false;
  } else {
    // Jump (SSBM-style double jump)
    const jumpInput = keys[' '] || keys['arrowup'];
    const jumpMult = player.muscleTimer > 0 ? 1.5 : 1;
    const gearJump = S.gear.totalBuffs ? S.gear.totalBuffs.jumpForce : 0;
    const baseJump = JUMP_FORCE + gearJump;
    if (jumpInput && !player.jumpHeld) {
      if (player.onGround) {
        // Grounded jump — full force (super jump in muscle mode)
        player.vy = baseJump * jumpMult;
        player.onGround = false;
      } else if (player.airJumps > 0) {
        // Aerial double jump — slightly weaker, resets vertical momentum
        player.vy = baseJump * 0.85 * jumpMult;
        player.airJumps--;
      }
    }
    player.jumpHeld = jumpInput;

    // Gravity (fast-fall when holding down while airborne and falling)
    const holdingDown = keys['s'] || keys['arrowdown'];
    const fastFall = holdingDown && !player.onGround && player.vy > 0;
    if (fastFall) player.iframes = Math.max(player.iframes, 0.1); // Rolling iframes during dive
    player.vy += GRAVITY * (fastFall ? 1.8 : 1.0) * dt;

    // Apply velocity
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Platform collision
    const playerBottom = player.y + PLAYER_H;
    const playerCenterX = player.x + PLAYER_W / 2;
    if (playerBottom >= PLATFORM_Y && player.vy >= 0 &&
        playerCenterX > PLATFORM_X && playerCenterX < PLATFORM_X + PLATFORM_W &&
        player.y + PLAYER_H - player.vy * dt <= PLATFORM_Y + 10) {
      player.y = PLATFORM_Y - PLAYER_H;
      player.vy = 0;
      player.onGround = true;
      player.airJumps = 1;
      if (player.stompChain > 0 && player.snotStormTimer <= 0) {
        player.stompChain = 0;
      }
    } else {
      // Check floating platforms (one-way, player-only)
      let landedOnFloat = false;
      if (player.vy >= 0) {
        for (const fp of floatingPlatforms) {
          if (fp.phase !== 'solid' && fp.phase !== 'warning') continue;
          const fpTop = fp.y;
          const fpLeft = fp.x;
          const fpRight = fp.x + fp.w;
          // Player center must be over platform
          if (playerCenterX <= fpLeft || playerCenterX >= fpRight) continue;
          // Falling through top surface check
          if (playerBottom >= fpTop && player.y + PLAYER_H - player.vy * dt <= fpTop + 6) {
            // Drop-through: holding down while on or near this platform
            if (holdingDown) continue;
            player.y = fpTop - PLAYER_H;
            player.vy = 0;
            player.onGround = true;
            player.airJumps = 1;
            if (player.stompChain > 0 && player.snotStormTimer <= 0) {
              player.stompChain = 0;
            }
            landedOnFloat = true;
            break;
          }
        }
      }
      if (!landedOnFloat && playerBottom < PLATFORM_Y) {
        player.onGround = false;
      }
    }
  }

  // Clamp to platform horizontal bounds
  if (player.x < PLATFORM_X - 10) player.x = PLATFORM_X - 10;
  if (player.x + PLAYER_W > PLATFORM_X + PLATFORM_W + 10) player.x = PLATFORM_X + PLATFORM_W + 10 - PLAYER_W;

  // Fall off screen = death
  if (player.y > H + 100) {
    player.hp = 0;
  }

  // Facing direction based on mouse
  const pcx = player.x + PLAYER_W / 2;
  player.facingRight = mouse.x >= pcx;

  // Cooldowns
  player.lightningCooldown = Math.max(0, player.lightningCooldown - dt);
  player.iframes = Math.max(0, player.iframes - dt);
  player.flashTimer = Math.max(0, player.flashTimer - dt);
  player.metalTimer = Math.max(0, player.metalTimer - dt);
  player.muscleTimer = Math.max(0, player.muscleTimer - dt);
  player.slamCooldown = Math.max(0, player.slamCooldown - dt);
  const prevSnotCooldown = player.snotCooldown;
  player.snotCooldown = Math.max(0, player.snotCooldown - dt);
  if (prevSnotCooldown > 0 && player.snotCooldown <= 0) {
    S.snotReadyFlash = 2.0; // show "SNOT READY" for 2 seconds
  }
  const prevWingsTimer = player.wingsTimer;
  player.wingsTimer = Math.max(0, player.wingsTimer - dt);
  player.poopCooldown = Math.max(0, player.poopCooldown - dt);
  player.snotStormTimer = Math.max(0, player.snotStormTimer - dt);
  if (S.snotStormFlash > 0) S.snotStormFlash -= dt;
  // Wings expiry — spawn feather burst
  if (prevWingsTimer > 0 && player.wingsTimer <= 0) {
    const pcxW = player.x + PLAYER_W / 2;
    const pcyW = player.y + PLAYER_H / 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      particles.push({
        x: pcxW + Math.cos(angle) * 10,
        y: pcyW + Math.sin(angle) * 10,
        vx: Math.cos(angle) * 80 + (Math.random() - 0.5) * 40,
        vy: Math.sin(angle) * 80 - 30,
        life: 0.8, maxLife: 0.8,
        color: Math.random() < 0.5 ? '#ffdd88' : '#ffffff', size: 3
      });
    }
    playSound('platCrumble');
  }

  // Snot rocket hold-to-charge auto-fire at max charge
  if (player.snotHolding) {
    player.snotChargeTime += dt;
  }
}

// ============================================================
// PLAYER DRAWING
// ============================================================
export function drawPlayer() {
  const ctx = S.ctx;
  const { player, particles } = S;
  const px = player.x;
  const py = player.y;

  // Iframes flicker (not during metal, muscle, or wings mode)
  if (player.metalTimer <= 0 && player.muscleTimer <= 0 && player.wingsTimer <= 0 && player.spiderDropTimer <= 0 && player.iframes > 0 && Math.floor(player.iframes * 15) % 2 === 0) return;
  const isMetal = player.metalTimer > 0;
  const isMuscle = player.muscleTimer > 0;
  const isFlying = player.wingsTimer > 0;

  ctx.save();
  const cx = px + PLAYER_W / 2;
  const cy = py + PLAYER_H / 2;

  // Flash white on hit
  if (player.flashTimer > 0) {
    ctx.globalCompositeOperation = 'source-over';
  }

  // Muscle mode aura ring (drawn behind player)
  if (isMuscle) {
    const auraPhase = performance.now() * 0.006;
    const auraRadius = 60 + Math.sin(auraPhase) * 5;
    const auraAlpha = 0.15 + 0.08 * Math.sin(auraPhase * 2);
    ctx.strokeStyle = `rgba(200,100,255,${auraAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Inner glow ring
    ctx.strokeStyle = `rgba(255,150,255,${auraAlpha * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius - 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Wings mode golden aura ring (drawn behind player)
  if (isFlying && !isMetal) {
    const auraPhase = performance.now() * 0.005;
    const auraRadius = 55 + Math.sin(auraPhase) * 6;
    const auraAlpha = 0.2 + 0.1 * Math.sin(auraPhase * 2);
    ctx.strokeStyle = `rgba(255,220,100,${auraAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,180,${auraAlpha * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius - 5, 0, Math.PI * 2);
    ctx.stroke();
    // Spawn feather particles while flying
    if (Math.random() < 0.15) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + PLAYER_H / 2,
        vx: (Math.random() - 0.5) * 30,
        vy: 20 + Math.random() * 30,
        life: 0.6, maxLife: 0.6,
        color: Math.random() < 0.5 ? '#ffdd88' : '#fff8e0', size: 2
      });
    }
  }

  // Spider Drop mode — web thread + purple aura
  if (player.spiderDropTimer > 0) {
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
    // Blink warning when about to expire
    if (player.spiderDropTimer < 1.5 && Math.floor(player.spiderDropTimer * 6) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
  }

  // Draw sprite
  const useMetalSprite = isMetal && metalSpriteLoaded;
  const useMuscleSprite = isMuscle && !isMetal && muscleSpriteLoaded;
  const useWingsSprite = isFlying && !isMetal && !useMuscleSprite && wingsSpriteLoaded;
  const currentSprite = useMetalSprite ? metalSprite : (useMuscleSprite ? muscleSprite : (useWingsSprite ? wingsSprite : eggSprite));
  if (spriteLoaded) {
    ctx.save();
    if (!player.facingRight) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
    }
    // Blink warning when metal is about to expire
    if (isMetal && player.metalTimer < 2 && Math.floor(player.metalTimer * 8) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    // Blink warning when muscle is about to expire
    if (isMuscle && !isMetal && player.muscleTimer < 2 && Math.floor(player.muscleTimer * 8) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    // Blink warning when wings are about to expire
    if (isFlying && !isMetal && !isMuscle && player.wingsTimer < 2 && Math.floor(player.wingsTimer * 8) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    // Draw sprite at correct aspect ratio (centered on hitbox)
    let drawW = PLAYER_W;
    let drawH = PLAYER_H;
    if (currentSprite.naturalWidth && currentSprite.naturalHeight) {
      const spriteRatio = currentSprite.naturalWidth / currentSprite.naturalHeight;
      drawW = PLAYER_H * spriteRatio;
    }
    const drawX = px + PLAYER_W / 2 - drawW / 2;
    const drawY = py + PLAYER_H - drawH; // align feet
    ctx.drawImage(currentSprite, drawX, drawY, drawW, drawH);

    // Draw gear on player (between base sprite and shimmer overlays)
    drawGearOnPlayer(drawX, drawY, drawW, drawH);

    ctx.globalAlpha = 1;

    // Expanded rect for shimmer to cover gear too
    const shimX = drawX - 30, shimY = drawY - 30;
    const shimW = drawW + 60, shimH = drawH + 60;

    // Metal shimmer
    if (isMetal) {
      ctx.globalCompositeOperation = 'source-atop';
      const shimmer = 0.15 + 0.1 * Math.sin(performance.now() * 0.008);
      ctx.fillStyle = `rgba(200,220,255,${shimmer})`;
      ctx.fillRect(shimX, shimY, shimW, shimH);
    }

    // Muscle shimmer (pink/purple)
    if (isMuscle && !isMetal) {
      ctx.globalCompositeOperation = 'source-atop';
      const shimmer = 0.15 + 0.1 * Math.sin(performance.now() * 0.01);
      ctx.fillStyle = `rgba(220,130,255,${shimmer})`;
      ctx.fillRect(shimX, shimY, shimW, shimH);
    }

    // Wings golden shimmer
    if (isFlying && !isMetal && !isMuscle) {
      ctx.globalCompositeOperation = 'source-atop';
      const shimmer = 0.12 + 0.08 * Math.sin(performance.now() * 0.007);
      ctx.fillStyle = `rgba(255,220,100,${shimmer})`;
      ctx.fillRect(shimX, shimY, shimW, shimH);
    }

    // White flash overlay
    if (player.flashTimer > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,255,255,${player.flashTimer * 3})`;
      ctx.fillRect(shimX, shimY, shimW, shimH);
    }
    ctx.restore();

  } else {
    // Fallback egg shape
    ctx.fillStyle = player.flashTimer > 0 ? '#fff' : '#f5e6c8';
    ctx.beginPath();
    ctx.ellipse(cx, cy, PLAYER_W / 2, PLAYER_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    const eyeOff = player.facingRight ? 5 : -5;
    ctx.fillRect(cx + eyeOff - 3, cy - 10, 3, 4);
    ctx.fillRect(cx + eyeOff + 5, cy - 10, 3, 4);
  }

  // "SNOT READY" flash above head
  if (S.snotReadyFlash > 0) {
    S.snotReadyFlash -= 1 / 60;
    const alpha = S.snotReadyFlash > 1.5 ? (2.0 - S.snotReadyFlash) * 2 : Math.min(1, S.snotReadyFlash / 1.5);
    const bob = Math.sin(performance.now() * 0.006) * 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = `rgba(170,255,50,${alpha})`;
    ctx.shadowColor = '#aaff33';
    ctx.shadowBlur = 6;
    ctx.fillText('SNOT READY!', cx, py - 10 + bob);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.restore();
}
