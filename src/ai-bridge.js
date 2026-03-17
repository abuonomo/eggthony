// ============================================================
// AI BRIDGE — WebSocket link for RL agent to control the game
// Activate by loading the game with ?ai in the URL
// ============================================================
import { S, resetGameState } from './state.js';
import { SNOT_COOLDOWN } from './constants.js';
import { initAmbientParticles, initBgDetails } from './world.js';
import { startRound } from './waves.js';
import { fireSnotRocket } from './weapons.js';

const ACTION_TABLE = [
  {},                                           // 0: idle
  { a: true },                                  // 1: left
  { d: true },                                  // 2: right
  { ' ': true },                                // 3: jump
  { a: true, ' ': true },                       // 4: left+jump
  { d: true, ' ': true },                       // 5: right+jump
  { shoot: true },                              // 6: shoot
  { a: true, shoot: true },                     // 7: left+shoot
  { d: true, shoot: true },                     // 8: right+shoot
  { ' ': true, shoot: true },                   // 9: jump+shoot
  { a: true, ' ': true, shoot: true },          // 10: left+jump+shoot
  { d: true, ' ': true, shoot: true },          // 11: right+jump+shoot
  { s: true },                                  // 12: drop through platform
  { s: true, shoot: true },                     // 13: drop + shoot
  { a: true, s: true },                         // 14: left + drop
  { d: true, s: true },                         // 15: right + drop
  { snot: true },                               // 16: fire snot rocket
  { a: true, snot: true },                      // 17: left + snot
  { d: true, snot: true },                      // 18: right + snot
  { ' ': true, snot: true },                    // 19: jump + snot
];

let ws = null;
let currentAction = {};
let frameCount = 0;
const FRAME_SKIP = 4;
let autoRestartDelay = 0;
let currentModelName = '';
let trainStats = null;

export const aiActive = new URLSearchParams(location.search).has('ai');

export function initAIBridge() {
  if (!aiActive) return;
  connect();
}

function connect() {
  // Use Vite proxy path when on non-default port or external host (e.g. ngrok)
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/ai-ws`;
  document.title = '[AI] Connecting...';
  ws = new WebSocket(wsUrl);
  ws.onopen = () => { document.title = '[AI] Connected!'; };
  ws.onerror = () => { document.title = '[AI] WS ERROR'; };
  ws.onclose = () => {
    document.title = '[AI] Reconnecting...';
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.action !== undefined) {
      currentAction = ACTION_TABLE[msg.action] || {};
    }
    if (msg.model) {
      currentModelName = msg.model;
    }
    if (msg.train) {
      trainStats = msg.train;
    }
  };
}

function getObs() {
  const { player } = S;
  return {
    player: {
      x: player.x, y: player.y, vx: player.vx, vy: player.vy,
      hp: player.hp, onGround: player.onGround, facingRight: player.facingRight,
      metalTimer: player.metalTimer, muscleTimer: player.muscleTimer,
      wingsTimer: player.wingsTimer, snotCooldown: player.snotCooldown,
      lightningCooldown: player.lightningCooldown, iframes: player.iframes,
      airJumps: player.airJumps, snotStormTimer: player.snotStormTimer,
      spiderDropTimer: player.spiderDropTimer,
    },
    enemies: S.enemies.map(e => ({
      x: e.x, y: e.y, vx: e.vx, vy: e.vy,
      hp: e.hp, type: e.type, frozen: e.freezeTimer > 0,
    })),
    boss: S.boss ? {
      x: S.boss.x, y: S.boss.y, hp: S.boss.hp, maxHp: S.boss.maxHp,
      state: S.boss.state, isQP: !!S.boss.isQuentinPizza,
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
    campSpider: {
      campTimer: S.campTimer || 0,
      state: S.campSpider ? S.campSpider.state : 'none',
      zapHits: S.campSpider ? S.campSpider.zapHits : 0,
    },
    floatingPlatforms: S.floatingPlatforms.map(p => ({ x: p.x, y: p.y, w: p.w, phase: p.phase })),
    score: S.score, round: S.round, tickCount: S.tickCount, gameState: S.gameState,
  };
}

function restartGame() {
  // Skip leaderboard input
  const nameOverlay = document.getElementById('nameOverlay');
  if (nameOverlay) nameOverlay.style.display = 'none';
  S.leaderboardInputActive = false;
  S.crownAnimActive = false;
  S.crownAnimTimer = 0;
  S.gameOverPhase = 'waiting';
  S.gameState = 'playing';
  resetGameState(1);
  S.currentThemeIndex = 0;
  initAmbientParticles();
  initBgDetails();
  startRound(1);
}

// Draw model name + training stats overlay at the bottom of the screen
export function aiDrawOverlay() {
  if (!aiActive) return;
  const ctx = S.ctx;
  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';

  const lines = [];
  if (currentModelName) lines.push(`AI: ${currentModelName}`);
  if (trainStats) {
    const steps = trainStats.timesteps ? `${(trainStats.timesteps / 1e6).toFixed(1)}M` : '?';
    const rew = trainStats.ep_rew_mean != null ? trainStats.ep_rew_mean.toFixed(0) : '?';
    const len = trainStats.ep_len_mean != null ? trainStats.ep_len_mean.toFixed(0) : '?';
    lines.push(`steps: ${steps}  rew: ${rew}  len: ${len}`);
  }
  if (lines.length === 0) return;

  const lineH = 14;
  const totalH = lines.length * lineH + 4;
  const maxW = Math.max(...lines.map(t => ctx.measureText(t).width)) + 16;
  const y0 = 854 - totalH;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(240 - maxW / 2, y0, maxW, totalH);
  ctx.fillStyle = '#0f0';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 240, y0 + 12 + i * lineH);
  }
  ctx.restore();
}

// Called before each simulation tick from the game loop
export function aiBeforeUpdate() {
  if (!aiActive) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Auto-start from title
  if (S.gameState === 'title') {
    restartGame();
    return;
  }

  // Auto-restart on death / gear drop
  if (S.gameState === 'gameOver' || S.gameState === 'gearDrop') {
    autoRestartDelay++;
    if (autoRestartDelay > 90) { // ~1.5s so death screen is visible
      autoRestartDelay = 0;
      restartGame();
    }
    return;
  }

  // Skip during round transitions
  if (S.gameState !== 'playing') return;

  // Apply current action to input state
  S.keys = {};
  S.mouse.left = false;
  S.mouse.right = false;
  const act = currentAction;
  if (act.a) S.keys['a'] = true;
  if (act.d) S.keys['d'] = true;
  if (act[' ']) S.keys[' '] = true;
  if (act.s) S.keys['s'] = true;
  if (act.shoot) S.mouse.left = true;
  if (act.snot && S.player.snotCooldown <= 0 && !S.snotRocket) {
    fireSnotRocket(1.0);
    S.player.snotCooldown = SNOT_COOLDOWN;
  }

  frameCount++;

  // Send obs every FRAME_SKIP ticks
  if (frameCount % FRAME_SKIP === 0) {
    ws.send(JSON.stringify({ obs: getObs() }));
  }
}
