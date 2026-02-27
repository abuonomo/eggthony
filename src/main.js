// ============================================================
// EGGTHONY: LIGHTNING EGG — Main Entry Point
// ============================================================
import { S, resetPlayer, resetGameState } from './state.js';
import {
  W, H, TICK_RATE, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  PLATFORM_Y, THEMES, CROWN_ANIM_DURATION,
} from './constants.js';
import { ensureAudio, playSound, playNoise, playVoice, musicClip } from './audio.js';
import { spawnParticles, updateParticles, drawParticles,
         updateDamageNumbers, drawDamageNumbers, addShake,
         updateCampSpider, drawCampSpider } from './effects.js';
import { setupKeyboard, setupMouse, setupTouch, drawTouchHUD, isMobile } from './input.js';
import { updatePlayer, drawPlayer } from './player.js';
import { updateBoss, drawBoss, drawBossHPBar,
         updateFartClouds, drawFartClouds, isBossRound } from './boss.js';
import { updateEnemies, drawEnemies } from './enemies.js';
import { updateLightningBolts, drawLightningBolts,
         updateSnotRocket, drawSnotRocket, drawSnotCharging,
         updatePoopBombs, drawPoopBombs,
         drawSnotStormOverlay } from './weapons.js';
import { updateMetalHat, drawMetalHat,
         updateSmoothie, drawSmoothie,
         updateWings, drawWings,
         updateChestplate, drawChestplate,
         updateDwyer, drawDwyer } from './powerups.js';
import { getThemeIndex, initAmbientParticles, initBgDetails,
         updateAmbientParticles, drawBackground,
         drawPlatform, drawFloatingPlatforms,
         updateFloatingPlatforms } from './world.js';
import { startRound, updateWaves } from './waves.js';
import { drawHUD, drawTitleScreen, drawRoundTransition, drawGameOver,
         handleDevMenuClick, fetchLeaderboard, showNameInput, hideNameInput,
         initNameOverlay } from './screens.js';
import { loadGear, loadGearSprites, rollDrop, awardDrop, setPlayerSprite,
         drawEquipScreen, handleEquipScreenClick, drawGearDrop, GEAR_ITEMS } from './gear.js';
import { eggSprite, spriteLoaded } from './sprites.js';

// ============================================================
// CANVAS SETUP
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
S.canvas = canvas;
S.ctx = ctx;

canvas.width = W;
canvas.height = H;

// Dynamic sizing: maintain portrait aspect ratio
function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gameAspect = W / H;
  const screenAspect = vw / vh;

  let cw, ch;
  if (screenAspect > gameAspect) {
    ch = vh;
    cw = Math.floor(vh * gameAspect);
  } else {
    cw = vw;
    ch = Math.floor(vw / gameAspect);
  }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Prevent right-click context menu
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
// SETUP INPUT & LEADERBOARD
// ============================================================
setupKeyboard(canvas);
setupMouse(canvas);
setupTouch(canvas);
initNameOverlay();
fetchLeaderboard();

// Gear system init
loadGearSprites();
loadGear();
setPlayerSprite(eggSprite, spriteLoaded);
// Update sprite ref once loaded
eggSprite.addEventListener('load', () => setPlayerSprite(eggSprite, true));

// ============================================================
// CLICK HANDLER (state transitions)
// ============================================================
canvas.addEventListener('click', (e) => {
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (W / rect.width);
  const cy = (e.clientY - rect.top) * (H / rect.height);

  if (S.gameState === 'equipScreen') {
    handleEquipScreenClick(cx, cy);
    return;
  }

  if (S.gameState === 'gearDrop') {
    if (S.gearDropTimer > 1.0) {
      S.gearReturnState = 'gameOver';
      S.gearSelectedSlot = GEAR_ITEMS[S.gearDropItem]?.slot || 'head';
      S.gameState = 'equipScreen';
      S.gameOverCooldown = 1.5;
    }
    return;
  }

  if (S.gameState === 'title') {
    if (S.devMenuOpen) {
      handleDevMenuClick(cx, cy);
      return;
    }

    // Top-left 80x80 zone → dev menu tap counter
    if (cx < 80 && cy < 80) {
      S.devTapCount++;
      S.devTapTimer = 1.0;
      if (S.devTapCount >= 5) {
        S.devMenuOpen = true;
        S.devTapCount = 0;
      }
      return;
    }

    // GEAR button on title (bottom-right) — only if player has gear
    if (S.gear.inventory.length > 0) {
      const gearBtnX = W - 110, gearBtnY = PLATFORM_Y - 90, gearBtnW = 100, gearBtnH = 36;
      if (cx >= gearBtnX && cx <= gearBtnX + gearBtnW && cy >= gearBtnY && cy <= gearBtnY + gearBtnH) {
        S.gearReturnState = 'title';
        S.gearSelectedSlot = 'head';
        S.gameState = 'equipScreen';
        return;
      }
    }

    // Normal start
    S.gameState = 'playing';
    playVoice('start', true);
    musicClip.currentTime = 0;
    musicClip.play().catch(() => {});
    resetGameState(1);
    S.currentThemeIndex = 0;
    initAmbientParticles();
    initBgDetails();
    startRound(1);
  } else if (S.gameState === 'gameOver' && S.gameOverPhase === 'showing') {
    // GEAR button on game over (bottom-left area) — only if player has gear
    if (S.gear.inventory.length > 0) {
      const goGearX = 14, goGearY = H - 60, goGearW = 80, goGearH = 36;
      if (cx >= goGearX && cx <= goGearX + goGearW && cy >= goGearY && cy <= goGearY + goGearH) {
        S.gearReturnState = 'gameOver';
        S.gearSelectedSlot = 'head';
        S.gameState = 'equipScreen';
        return;
      }
    }

    hideNameInput();
    S.crownAnimActive = false;
    S.crownAnimTimer = 0;
    S.gameOverPhase = 'waiting';
    S.gameState = 'playing';
    musicClip.currentTime = 0;
    musicClip.play().catch(() => {});
    resetGameState(1);
    S.currentThemeIndex = 0;
    initAmbientParticles();
    initBgDetails();
    startRound(1);
  }
});

// ============================================================
// MAIN GAME LOOP (fixed timestep)
// ============================================================
function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  let dt = (now - S.lastTime) / 1000;
  S.lastTime = now;
  if (dt > 0.1) dt = 0.1;

  S.accumulator += dt;

  while (S.accumulator >= TICK_RATE) {
    update(TICK_RATE);
    S.accumulator -= TICK_RATE;
  }

  draw();
}

function update(dt) {
  // Dev menu tap timer decay
  if (S.devTapTimer > 0) {
    S.devTapTimer -= dt;
    if (S.devTapTimer <= 0) { S.devTapTimer = 0; S.devTapCount = 0; }
  }

  updateAmbientParticles(dt);
  updateParticles(dt);
  updateDamageNumbers(dt);

  // Theme fade transition
  if (S.themeFading) {
    S.themeFadeAlpha += dt * 3;
    if (S.themeFadeAlpha >= 1) {
      S.themeFadeAlpha = 1;
      const newIdx = getThemeIndex(S.round);
      if (newIdx !== S.currentThemeIndex) {
        S.currentThemeIndex = newIdx;
        initAmbientParticles();
        initBgDetails();
      }
      S.themeFading = false;
    }
  } else if (S.themeFadeAlpha > 0) {
    S.themeFadeAlpha -= dt * 2;
    if (S.themeFadeAlpha < 0) S.themeFadeAlpha = 0;
  }

  // Screen shake decay
  if (S.shakeDuration > 0) {
    S.shakeDuration -= dt;
    S.shakeX = (Math.random() - 0.5) * S.shakeIntensity * 2;
    S.shakeY = (Math.random() - 0.5) * S.shakeIntensity * 2;
    S.shakeIntensity *= 0.9;
  } else {
    S.shakeX = 0; S.shakeY = 0; S.shakeIntensity = 0;
  }

  if (S.gameOverCooldown > 0) {
    S.gameOverCooldown -= dt;
    if (S.gameOverCooldown <= 0 && S.gameState === 'gameOver' && S.gameOverPhase === 'waiting') {
      showNameInput();
    }
  }

  if (S.crownAnimActive) {
    const prevT = S.crownAnimTimer;
    S.crownAnimTimer += dt;
    if (prevT < 1.5 && S.crownAnimTimer >= 1.5) {
      const eggY = H / 2 - 20 - 180 / 2;
      spawnParticles(W / 2, eggY - 8, '#ffd700', 15, 180, 1.2);
      spawnParticles(W / 2, eggY - 8, '#ffee88', 10, 140, 1.0);
    }
    if (S.crownAnimTimer >= CROWN_ANIM_DURATION + 1.0) {
      S.crownAnimActive = false;
    }
  }

  if (S.gameState === 'paused') return;
  if (S.gameState === 'equipScreen') return;

  // Gear drop animation timer
  if (S.gameState === 'gearDrop') {
    S.gearDropTimer += dt;
    return;
  }

  if (S.gameState === 'playing') {
    updatePlayer(dt);
    updateEnemies(dt);
    updateLightningBolts(dt);
    updateBoss(dt);
    updateFartClouds(dt);
    updateSnotRocket(dt);
    updateMetalHat(dt);
    updateSmoothie(dt);
    updateWings(dt);
    updatePoopBombs(dt);
    updateChestplate(dt);
    updateDwyer(dt);
    updateCampSpider(dt);
    updateWaves(dt);
    updateFloatingPlatforms(dt);

    // Check death
    if (S.player.hp <= 0) {
      musicClip.pause();
      S.dwyer = null;
      S.campSpider = null;
      S.campTimer = 0;
      spawnParticles(S.player.x + PLAYER_W / 2, S.player.y + PLAYER_H / 2, '#f5e6c8', 30, 300, 1.0);
      addShake(12, 0.4);
      playSound('gameOver');
      playNoise(0.3, 0.2);
      playVoice('lose', true);

      // Roll for gear drop
      const drop = rollDrop(S.round);
      if (drop) {
        awardDrop(drop);
        S.gearDropItem = drop;
        S.gearDropTimer = 0;
        S.gameState = 'gearDrop';
      } else {
        S.gameState = 'gameOver';
        S.gameOverCooldown = 1.5;
      }
    }

    // "Bad" voice when HP drops below 25%
    const lowHpMax = PLAYER_MAX_HP + (S.gear.totalBuffs ? S.gear.totalBuffs.maxHp : 0);
    if (!S.lowHpTriggered && S.player.hp > 0 && S.player.hp <= lowHpMax * 0.25) {
      S.lowHpTriggered = true;
      playVoice('bad', true);
    }
  } else if (S.gameState === 'roundTransition') {
    S.transitionTimer -= dt;
    if (S.transitionTimer <= 0) {
      const prevThemeIdx = S.currentThemeIndex;
      S.round++;
      const newThemeIdx = getThemeIndex(S.round);
      if (newThemeIdx !== prevThemeIdx) {
        S.themeAnnouncement = THEMES[newThemeIdx].name;
        S.themeFading = true;
        S.themeFadeAlpha = 0;
      }
      const healAmount = isBossRound(S.round) ? 50 : 20;
      const gearMaxHp = S.gear.totalBuffs ? S.gear.totalBuffs.maxHp : 0;
      S.player.hp = Math.min(PLAYER_MAX_HP + gearMaxHp, S.player.hp + healAmount);
      startRound(S.round);
      S.gameState = 'playing';
    }
  }
}

function draw() {
  // Show cursor on menu screens, hide during gameplay
  const menuState = S.gameState === 'title' || S.gameState === 'equipScreen' || S.gameState === 'gameOver' || S.gameState === 'gearDrop';
  canvas.style.cursor = menuState ? 'default' : 'none';

  ctx.save();
  ctx.translate(S.shakeX, S.shakeY);

  // Background
  drawBackground();
  drawPlatform();
  drawFloatingPlatforms();

  if (S.gameState === 'equipScreen') {
    drawEquipScreen();
    ctx.restore();
    return;
  }

  if (S.gameState === 'title') {
    drawTitleScreen();
  } else {
    drawMetalHat();
    drawSmoothie();
    drawWings();
    drawChestplate();
    drawEnemies();
    drawDwyer();
    drawBoss();
    drawFartClouds();
    drawPlayer();
    drawSnotCharging();
    drawLightningBolts();
    drawSnotRocket();
    drawPoopBombs();
    drawCampSpider();
    drawParticles();
    drawDamageNumbers();
    drawHUD();
    drawBossHPBar();
    drawSnotStormOverlay();
    if (isMobile) drawTouchHUD();

    if (S.gameState === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px monospace';
      ctx.fillText('PAUSED', W / 2, H / 2 - 10);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Press ESC to resume', W / 2, H / 2 + 30);
    } else if (S.gameState === 'roundTransition') {
      drawRoundTransition();
    } else if (S.gameState === 'gearDrop') {
      drawGearDrop();
    } else if (S.gameState === 'gameOver') {
      drawGameOver();
    }
  }

  // Theme fade-to-black overlay
  if (S.themeFadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${S.themeFadeAlpha})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  ctx.restore();
}

// Start the loop
S.lastTime = performance.now();
requestAnimationFrame(gameLoop);
