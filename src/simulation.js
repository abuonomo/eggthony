// ============================================================
// SIMULATION — extracted update() for both browser and headless
// ============================================================
import { S } from './state.js';
import { random } from './rng.js';
import {
  W, H, TICK_RATE, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  THEMES, CROWN_ANIM_DURATION,
} from './constants.js';
import { audioCtx, playSound, playNoise, playVoice, musicClip } from './audio.js';
import { spawnParticles, updateParticles,
         updateDamageNumbers, addShake,
         updateCampSpider } from './effects.js';
import { updatePlayer } from './player.js';
import { updateBoss, updateFartClouds, isBossRound } from './boss.js';
import { updateEnemies } from './enemies.js';
import { updateLightningBolts, updateSnotRocket, updatePoopBombs } from './weapons.js';
import { updateMetalHat, updateSmoothie, updateWings,
         updateChestplate, updateDwyer,
         updateBeerCan, updateChris, updateChrisCans,
         updateHeart } from './powerups.js';
import { getThemeIndex, initAmbientParticles, initBgDetails,
         updateAmbientParticles, updateFloatingPlatforms } from './world.js';
import { startRound, updateWaves } from './waves.js';
import { rollDrop, awardDrop } from './gear.js';

// Lazy import to avoid circular dep — showNameInput is browser-only
let _showNameInput = null;
export function setShowNameInput(fn) { _showNameInput = fn; }

export function update(dt) {
  S.tickCount++;

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
    S.shakeX = (random() - 0.5) * S.shakeIntensity * 2;
    S.shakeY = (random() - 0.5) * S.shakeIntensity * 2;
    S.shakeIntensity *= 0.9;
  } else {
    S.shakeX = 0; S.shakeY = 0; S.shakeIntensity = 0;
  }

  if (S.gameOverCooldown > 0) {
    S.gameOverCooldown -= dt;
    if (S.gameOverCooldown <= 0 && S.gameState === 'gameOver' && S.gameOverPhase === 'waiting') {
      if (!S.headless && _showNameInput) _showNameInput();
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
    updateBeerCan(dt);
    updateChris(dt);
    updateChrisCans(dt);
    updateHeart(dt);
    updateCampSpider(dt);
    updateWaves(dt);
    updateFloatingPlatforms(dt);

    if (S.devInvulnerable) {
      const maxHp = PLAYER_MAX_HP + (S.gear.totalBuffs ? S.gear.totalBuffs.maxHp : 0);
      if (S.player.hp < maxHp) S.player.hp = maxHp;
      S.player.iframes = Math.max(S.player.iframes, 0.1);
    }

    // Check death
    if (S.player.hp <= 0) {
      if (audioCtx) musicClip.pause();
      S.dwyer = null;
      S.chris = null;
      S.chrisCans = [];
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

// Single fixed-timestep tick
export function step() {
  update(TICK_RATE);
}

// Multi-tick helper
export function stepN(n) {
  for (let i = 0; i < n; i++) update(TICK_RATE);
}
