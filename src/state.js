import {
  W, H, PLATFORM_Y, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  METAL_DURATION, MUSCLE_DURATION, WINGS_DURATION,
} from './constants.js';
import { random } from './rng.js';

// ============================================================
// SHARED MUTABLE STATE
// ============================================================
export const S = {
  // Canvas (set in main.js)
  canvas: null,
  ctx: null,

  // Headless / RL
  headless: false,
  tickCount: 0,

  // Game state
  gameState: 'title',
  score: 0,
  round: 1,
  roundTimer: 0,
  transitionTimer: 0,
  gameOverCooldown: 0,
  gameOverPhase: 'waiting',
  titleBlink: 0,
  snotReadyFlash: 0,
  snotStormFlash: 0,

  // Crown animation
  crownAnimActive: false,
  crownAnimTimer: 0,

  // Dev menu
  devMenuOpen: false,
  devTapCount: 0,
  devTapTimer: 0,
  devSpawnPowerup: '',
  devPowerupDrop: false,
  devLeaderboard: typeof localStorage !== 'undefined' && localStorage.getItem('eggthonyDevLB') === 'true',

  // Leaderboard
  leaderboardDesktop: [],
  leaderboardMobile: [],
  leaderboardInputActive: false,

  // Input
  keys: {},
  mouse: { x: W / 2, y: H / 2, left: false, right: false },
  _zapHeld: false,

  // Screen shake
  shakeX: 0,
  shakeY: 0,
  shakeDuration: 0,
  shakeIntensity: 0,

  // Themes
  currentThemeIndex: 0,
  themeFadeAlpha: 0,
  themeFading: false,
  themeAnnouncement: '',

  // Player
  player: {
    x: W / 2 - PLAYER_W / 2,
    y: PLATFORM_Y - PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facingRight: true,
    hp: PLAYER_MAX_HP,
    iframes: 0,
    lightningCooldown: 0,
    flashTimer: 0,
    metalTimer: 0,
    muscleTimer: 0,
    slamCooldown: 0,
    snotCooldown: 0,
    snotHolding: false,
    snotChargeTime: 0,
    airJumps: 1,
    jumpHeld: false,
    wingsTimer: 0,
    spiderDropTimer: 0,
    poopCooldown: 0,
    stompChain: 0,
    snotStormTimer: 0,
    knockbackTimer: 0,
  },

  // Boss
  boss: null,
  bossActive: false,
  bossEntering: false,
  bossDefeated: false,
  bossHPBarFlash: 0,
  fartClouds: [],

  // Enemies
  enemies: [],
  enemyProjectiles: [],

  // Weapons
  lightningBolts: [],
  snotRocket: null,
  poopBombs: [],

  // Particles & effects
  particles: [],
  damageNumbers: [],
  ambientParticles: [],
  bgDetails: {},

  // Floating platforms
  floatingPlatforms: [],
  floatPlatSpawnTimer: 3.0,
  occupiedSlots: new Set(),

  // Powerup items
  metalHat: null,
  hatSpawnTimer: 0,
  smoothie: null,
  smoothieSpawnTimer: 20 + random() * 10,
  wingsItem: null,
  wingsSpawnTimer: 25 + random() * 15,
  chestplateItem: null,
  chestplateSpawnTimer: 30 + random() * 15,
  dwyer: null,
  chris: null,
  beerCanItem: null,
  chrisCans: [],

  // Gear system
  gear: { version: 1, inventory: [], equipped: { head: null, body: null, collar: null, accessory: null }, totalBuffs: { maxHp: 0, speed: 0, jumpForce: 0, damage: 0, dropLuck: 0 } },
  gearSelectedSlot: 'head',
  gearReturnState: 'title',
  gearDropItem: null,
  gearDropTimer: 0,

  // Camp spider
  campTimer: 0,
  campX: W / 2,
  campSpider: null,
  spiderZapReady: false,

  // Wave system
  waveEnemiesRemaining: 0,
  waveSpawnTimer: 0,
  waveEnemiesSpawned: 0,
  waveEnemiesTotal: 0,

  // Audio flags
  lowHpTriggered: false,
  goodClipToggle: false,

  // Game loop timing
  accumulator: 0,
  lastTime: 0,
};

export function resetPlayer() {
  const { player } = S;
  player.x = W / 2 - PLAYER_W / 2;
  player.y = PLATFORM_Y - PLAYER_H;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.hp = PLAYER_MAX_HP + (S.gear.totalBuffs ? S.gear.totalBuffs.maxHp : 0);
  player.iframes = 0;
  player.lightningCooldown = 0;
  player.flashTimer = 0;
  player.metalTimer = 0;
  player.muscleTimer = 0;
  player.slamCooldown = 0;
  player.snotCooldown = 0;
  player.snotHolding = false;
  player.snotChargeTime = 0;
  player.airJumps = 1;
  player.jumpHeld = false;
  player.wingsTimer = 0;
  player.spiderDropTimer = 0;
  player.poopCooldown = 0;
  player.stompChain = 0;
  player.snotStormTimer = 0;
  player.knockbackTimer = 0;
  S.lowHpTriggered = false;
  S.snotStormFlash = 0;
}

// Consolidated game reset — replaces the 3 duplicate reset blocks
export function resetGameState(r) {
  S.tickCount = 0;
  S.score = 0;
  S.round = r;
  S.enemies = [];
  S.enemyProjectiles = [];
  S.lightningBolts = [];
  S.particles = [];
  S.damageNumbers = [];
  S.metalHat = null;
  S.hatSpawnTimer = 15 + random() * 10;
  S.smoothie = null;
  S.smoothieSpawnTimer = 20 + random() * 10;
  S.wingsItem = null;
  S.wingsSpawnTimer = 25 + random() * 15;
  S.poopBombs = [];
  S.chestplateItem = null;
  S.chestplateSpawnTimer = 30 + random() * 15;
  S.dwyer = null;
  S.chris = null;
  S.beerCanItem = null;
  S.chrisCans = [];
  S.campSpider = null;
  S.campTimer = 0;
  S.boss = null;
  S.bossActive = false;
  S.bossEntering = false;
  S.bossDefeated = false;
  S.bossHPBarFlash = 0;
  S.snotRocket = null;
  S.fartClouds = [];
  S.floatingPlatforms = [];
  S.occupiedSlots = new Set();
  S.floatPlatSpawnTimer = 3.0;
  S.themeFadeAlpha = 0;
  S.themeFading = false;
  S.themeAnnouncement = '';
  resetPlayer();
}
