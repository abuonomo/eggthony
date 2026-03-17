// ============================================================
// HEADLESS RL ENVIRONMENT — Gym-like step API
// ============================================================
// Must import shims before anything else
import './node-shims.js';

import { S, resetGameState } from './state.js';
import { seedRng } from './rng.js';
import { TICK_RATE, W, H, PLAYER_W, PLAYER_H, PLAYER_MAX_HP, SNOT_COOLDOWN, SNOT_MAX_CHARGE, PLATFORM_Y } from './constants.js';
import { initAmbientParticles, initBgDetails } from './world.js';
import { startRound } from './waves.js';
import { step, stepN } from './simulation.js';
import { fireSnotRocket } from './weapons.js';

function getObs() {
  const { player } = S;
  return {
    player: {
      x: player.x, y: player.y,
      vx: player.vx, vy: player.vy,
      hp: player.hp,
      onGround: player.onGround,
      facingRight: player.facingRight,
      metalTimer: player.metalTimer,
      muscleTimer: player.muscleTimer,
      wingsTimer: player.wingsTimer,
      snotCooldown: player.snotCooldown,
      lightningCooldown: player.lightningCooldown,
      iframes: player.iframes,
      airJumps: player.airJumps,
      snotStormTimer: player.snotStormTimer,
      spiderDropTimer: player.spiderDropTimer,
    },
    enemies: S.enemies.map(e => ({
      x: e.x, y: e.y, vx: e.vx, vy: e.vy,
      hp: e.hp, type: e.type, frozen: e.freezeTimer > 0,
    })),
    boss: S.boss ? {
      x: S.boss.x, y: S.boss.y,
      hp: S.boss.hp, maxHp: S.boss.maxHp,
      state: S.boss.state,
      isQP: !!S.boss.isQuentinPizza,
    } : null,
    projectiles: {
      lightning: S.lightningBolts.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
      enemyProjectiles: S.enemyProjectiles.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })),
      snotRocket: S.snotRocket ? { x: S.snotRocket.x, y: S.snotRocket.y } : null,
    },
    powerups: {
      metalHat: S.metalHat ? { x: S.metalHat.x, y: S.metalHat.y } : null,
      smoothie: S.smoothie ? { x: S.smoothie.x, y: S.smoothie.y } : null,
      wingsItem: S.wingsItem ? { x: S.wingsItem.x, y: S.wingsItem.y } : null,
      chestplate: S.chestplateItem ? { x: S.chestplateItem.x, y: S.chestplateItem.y } : null,
    },
    fartClouds: S.fartClouds.map(c => ({ x: c.x, y: c.y, radius: c.radius })),
    campSpider: {
      campTimer: S.campTimer || 0,
      state: S.campSpider ? S.campSpider.state : 'none',
      zapHits: S.campSpider ? S.campSpider.zapHits : 0,
    },
    floatingPlatforms: S.floatingPlatforms.map(p => ({ x: p.x, y: p.y, w: p.w, phase: p.phase })),
    score: S.score,
    round: S.round,
    tickCount: S.tickCount,
    gameState: S.gameState,
  };
}

export function createEnv(opts = {}) {
  const seed = opts.seed ?? 42;

  function reset(resetOpts = {}) {
    const startRnd = resetOpts.startRound ?? 1;
    seedRng(resetOpts.seed ?? seed);
    S.headless = true;
    S.gameState = 'playing';
    S.currentThemeIndex = startRnd >= 7 ? 2 : startRnd >= 4 ? 1 : 0;
    // Reset state not covered by resetGameState
    S.gear = { version: 1, inventory: [], equipped: { head: null, body: null, collar: null, accessory: null }, totalBuffs: { maxHp: 0, speed: 0, jumpForce: 0, damage: 0, dropLuck: 0 } };
    S.gearDropItem = null;
    S.gearDropTimer = 0;
    S.gameOverPhase = 'waiting';
    S.gameOverCooldown = 0;
    S.crownAnimActive = false;
    S.crownAnimTimer = 0;
    S.shakeX = 0; S.shakeY = 0; S.shakeDuration = 0; S.shakeIntensity = 0;
    S._zapHeld = false;
    S.goodClipToggle = false;
    S.devTapTimer = 0; S.devTapCount = 0;
    S.keys = {};
    S.mouse = { x: W / 2, y: H / 2, left: false, right: false };
    resetGameState(startRnd);
    initAmbientParticles();
    initBgDetails();
    startRound(startRnd);
    return getObs();
  }

  function applyAction(action) {
    S.keys = {};
    S.mouse.left = false;
    S.mouse.right = false;
    if (action.left) S.keys['a'] = true;
    if (action.right) S.keys['d'] = true;
    if (action.jump) S.keys[' '] = true;
    if (action.down) S.keys['s'] = true;
    if (action.shoot) S.mouse.left = true;
    if (action.aimX !== undefined) S.mouse.x = action.aimX;
    if (action.aimY !== undefined) S.mouse.y = action.aimY;

    // Snot rocket: instant max-charge fire when action.snot is true
    if (action.snot && S.player.snotCooldown <= 0 && !S.snotRocket) {
      fireSnotRocket(1.0);
      S.player.snotCooldown = SNOT_COOLDOWN;
    }
  }

  let prevMetal = 0, prevMuscle = 0, prevWings = 0, prevSpiderDrop = 0;
  let prevFrozenCount = 0;

  function envStep(action) {
    const prevScore = S.score;
    const prevHp = S.player.hp;
    const prevRound = S.round;

    applyAction(action);
    step();

    const done = S.player.hp <= 0 || S.gameState === 'gameOver' || S.gameState === 'gearDrop';
    const kills = S.score - prevScore; // score gained = kills happened

    // Reward: survival is king — avoid damage, stay alive, clear rounds
    let reward = 0;
    reward += kills * 0.01;             // kills matter but aren't the priority
    reward += 0.1;                      // survival bonus per tick
    if (S.player.hp < prevHp) reward -= (prevHp - S.player.hp) * 2; // taking 10 dmg = -20
    if (S.round > prevRound) reward += 100; // round completion is the real goal
    if (done) reward -= 200;                // death is catastrophic

    // Spider Drop reward — agent discovered the clutch escape
    if (S.player.spiderDropTimer > prevSpiderDrop && prevSpiderDrop <= 0) reward += 30;

    // Powerup pickups — reward grabbing items
    if (S.player.metalTimer > prevMetal && prevMetal <= 0) reward += 20;
    if (S.player.muscleTimer > prevMuscle && prevMuscle <= 0) reward += 20;
    if (S.player.wingsTimer > prevWings && prevWings <= 0) reward += 20;
    if (S.player.hp > prevHp) reward += 10; // healed (chestplate)

    // State-based rewards: reward OUTCOMES of good play, not specific actions
    // Kills during powerup buffs — discover aggressive play when buffed
    if (kills > 0 && S.player.metalTimer > 0) reward += kills * 0.05;
    if (kills > 0 && S.player.muscleTimer > 0) reward += kills * 0.05;
    if (kills > 0 && S.player.spiderDropTimer > 0) reward += kills * 0.05;

    // Multiple enemies frozen at once — discover snot grouping
    const frozenCount = S.enemies.filter(e => e.freezeTimer > 0 && !e.dying).length;
    if (frozenCount >= 2 && prevFrozenCount < 2) reward += 15;

    // Being on a floating platform when enemies exist — discover high ground
    const onFloatPlat = S.player.onGround && (S.player.y + PLAYER_H) < PLATFORM_Y - 10;
    if (onFloatPlat && S.enemies.length > 3) reward += 0.3;

    prevMetal = S.player.metalTimer;
    prevMuscle = S.player.muscleTimer;
    prevWings = S.player.wingsTimer;
    prevSpiderDrop = S.player.spiderDropTimer;
    prevFrozenCount = frozenCount;

    const obs = getObs();
    const info = {
      score: S.score,
      round: S.round,
      tickCount: S.tickCount,
      playerHp: S.player.hp,
    };
    return { obs, reward, done, info };
  }

  return { reset, step: envStep };
}

// Self-test when run directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('headless')) {
  console.log('Running headless self-test...');

  // Test 1: basic episode
  const env = createEnv({ seed: 42 });
  let obs = env.reset();
  console.log(`Reset: round=${obs.round}, hp=${obs.player.hp}, enemies=${obs.enemies.length}`);

  let totalReward = 0;
  let steps = 0;
  while (steps < 6000) {
    // Random agent: alternate between moving and shooting
    const action = {
      right: steps % 60 < 30,
      left: steps % 60 >= 30,
      jump: steps % 120 < 5,
      shoot: true,
      aimX: W / 2,
      aimY: 300,
    };
    const result = env.step(action);
    totalReward += result.reward;
    steps++;
    if (result.done) break;
  }
  console.log(`Episode done: steps=${steps}, score=${S.score}, round=${S.round}, reward=${totalReward.toFixed(1)}`);

  // Test 2: determinism
  const env2 = createEnv({ seed: 42 });
  env2.reset();
  for (let i = 0; i < 300; i++) {
    env2.step({ right: i % 60 < 30, left: i % 60 >= 30, jump: i % 120 < 5, shoot: true, aimX: W / 2, aimY: 300 });
  }
  const score1 = S.score;
  const hp1 = S.player.hp;
  const tick1 = S.tickCount;

  const env3 = createEnv({ seed: 42 });
  env3.reset();
  for (let i = 0; i < 300; i++) {
    env3.step({ right: i % 60 < 30, left: i % 60 >= 30, jump: i % 120 < 5, shoot: true, aimX: W / 2, aimY: 300 });
  }
  const score2 = S.score;
  const hp2 = S.player.hp;
  const tick2 = S.tickCount;

  const deterministic = score1 === score2 && hp1 === hp2 && tick1 === tick2;
  console.log(`Determinism test: score=${score1}==${score2}, hp=${hp1}==${hp2}, ticks=${tick1}==${tick2} → ${deterministic ? 'PASS' : 'FAIL'}`);

  console.log('Self-test complete.');
}
