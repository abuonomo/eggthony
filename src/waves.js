import { S } from './state.js';
import { SNOT_STORM_DURATION } from './constants.js';
import { playSound, playVoice } from './audio.js';
import { createBoss, isBossRound } from './boss.js';
import { spawnEnemyForRound } from './enemies.js';

// ============================================================
// WAVE SYSTEM
// ============================================================
export function startRound(r) {
  S.round = r;
  if (isBossRound(r)) {
    S.waveEnemiesTotal = 0;
    S.waveEnemiesSpawned = 0;
    S.waveEnemiesRemaining = 0;
    S.waveSpawnTimer = 0;
    S.boss = createBoss(r);
    S.bossActive = true;
    S.bossEntering = true;
    S.bossDefeated = false;
    playSound('bossRoar');
    playVoice('boss', true);
  } else {
    S.waveEnemiesTotal = 3 + r * 3;
    S.waveEnemiesSpawned = 0;
    S.waveEnemiesRemaining = S.waveEnemiesTotal;
    S.waveSpawnTimer = 0;
  }
  // Reset floating platforms
  S.floatingPlatforms = [];
  S.occupiedSlots = new Set();
  S.floatPlatSpawnTimer = 3.0;
  S.fartClouds = [];
  S.campSpider = null;
  S.campTimer = 0;
  playSound('roundStart');
}

export function updateWaves(dt) {
  if (S.gameState !== 'playing') return;

  // Boss round: check for boss defeated
  if (S.bossActive) {
    if (S.bossDefeated) {
      S.enemyProjectiles = [];
      S.gameState = 'roundTransition';
      S.transitionTimer = 2.0;
      playVoice('win', true);
    }
    return;
  }

  // Spawn enemies
  const spawnInterval = Math.max(0.4, 1.5 - S.round * 0.1);
  if (S.waveEnemiesSpawned < S.waveEnemiesTotal) {
    S.waveSpawnTimer -= dt;
    if (S.waveSpawnTimer <= 0) {
      spawnEnemyForRound(S.round);
      S.waveEnemiesSpawned++;
      S.waveSpawnTimer = spawnInterval;
    }
  }

  // Check round completion: all spawned and all dead/off-screen
  const aliveEnemies = S.enemies.filter(e => !e.dying).length;
  if (S.waveEnemiesSpawned >= S.waveEnemiesTotal && aliveEnemies === 0 && !S.campSpider) {
    // Clear any remaining enemy projectiles
    S.enemyProjectiles = [];
    S.gameState = 'roundTransition';
    S.transitionTimer = 2.0;
    // Voice clip: milestone rounds get "win", others get alternating "good"
    if (S.round % 5 === 0) {
      playVoice('win', true);
    } else {
      playVoice(S.goodClipToggle ? 'good1' : 'good2');
      S.goodClipToggle = !S.goodClipToggle;
    }
  }
}
