// ============================================================
// EGGTHONY: LIGHTNING EGG — Main Entry Point
// ============================================================
import { S, resetPlayer, resetGameState } from './state.js';
import {
  W, H, TICK_RATE, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  PLATFORM_Y, THEMES, CROWN_ANIM_DURATION,
} from './constants.js';
import { ensureAudio, playSound, playNoise, playVoice, musicClip } from './audio.js';
import { drawParticles, drawDamageNumbers, drawCampSpider } from './effects.js';
import { setupKeyboard, setupMouse, setupTouch, drawTouchHUD, isMobile } from './input.js';
import { drawPlayer } from './player.js';
import { drawBoss, drawBossHPBar, drawFartClouds } from './boss.js';
import { drawEnemies } from './enemies.js';
import { drawLightningBolts, drawSnotRocket, drawSnotCharging,
         drawPoopBombs, drawSnotStormOverlay } from './weapons.js';
import { drawMetalHat, drawSmoothie, drawWings, drawChestplate,
         drawDwyer, drawBeerCan, drawChris, drawChrisCans } from './powerups.js';
import { initAmbientParticles, initBgDetails,
         drawBackground, drawPlatform, drawFloatingPlatforms } from './world.js';
import { startRound } from './waves.js';
import { drawHUD, drawTitleScreen, drawRoundTransition, drawGameOver,
         drawPauseScreen, handlePauseClick,
         handleDevMenuClick, fetchLeaderboard, showNameInput, hideNameInput,
         initNameOverlay } from './screens.js';
import { loadGear, loadGearSprites, setPlayerSprite,
         drawEquipScreen, handleEquipScreenClick, drawGearDrop, GEAR_ITEMS } from './gear.js';
import { eggSprite, spriteLoaded } from './sprites.js';
import { update, setShowNameInput } from './simulation.js';

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
initAmbientParticles();
initBgDetails();

// Gear system init
loadGearSprites();
loadGear();
setPlayerSprite(eggSprite, spriteLoaded);
// Update sprite ref once loaded
eggSprite.addEventListener('load', () => setPlayerSprite(eggSprite, true));

// Wire up showNameInput for simulation
setShowNameInput(showNameInput);

// ============================================================
// CLICK HANDLER (state transitions)
// ============================================================
canvas.addEventListener('click', (e) => {
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (W / rect.width);
  const cy = (e.clientY - rect.top) * (H / rect.height);

  if (S.gameState === 'paused') {
    handlePauseClick(cx, cy);
    return;
  }

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

    // Start button hit test
    const startBtnW = 200, startBtnH = 50;
    const startBtnX = W / 2 - startBtnW / 2;
    const startBtnY = PLATFORM_Y - 70;
    if (cx < startBtnX || cx > startBtnX + startBtnW || cy < startBtnY || cy > startBtnY + startBtnH) {
      return;
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

function draw() {
  // Show cursor on menu screens, hide during gameplay
  const menuState = S.gameState === 'title' || S.gameState === 'equipScreen' || S.gameState === 'gameOver' || S.gameState === 'gearDrop' || S.gameState === 'paused';
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
    drawChris();
    drawBeerCan();
    drawBoss();
    drawFartClouds();
    drawPlayer();
    drawSnotCharging();
    drawLightningBolts();
    drawSnotRocket();
    drawPoopBombs();
    drawChrisCans();
    drawCampSpider();
    drawParticles();
    drawDamageNumbers();
    drawHUD();
    drawBossHPBar();
    drawSnotStormOverlay();
    if (isMobile) drawTouchHUD();

    if (S.gameState === 'paused') {
      drawPauseScreen();
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
