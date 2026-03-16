// ============================================================
// GAME CONSTANTS
// ============================================================

// Aspect ratio / resolution
export const W_ASPECT = 480, H_ASPECT = 854;
export const W = 480, H = 854;

// Physics
export const GRAVITY = 1400;
export const PLAYER_SPEED = 260;
export const JUMP_FORCE = -560;

// Platform
export const PLATFORM_Y = 520;
export const PLATFORM_X = 0;
export const PLATFORM_W = W;
export const PLATFORM_H = 24;

// Player
export const PLAYER_W = 56;
export const PLAYER_H = 128;
export const PLAYER_MAX_HP = 100;
export const IFRAME_DURATION = 0.8;
export const CONTACT_DAMAGE = 10;
export const CONTACT_KNOCKBACK = 300;

// Floating platforms
export const FLOAT_PLAT_W = 100;
export const FLOAT_PLAT_H = 12;
export const FLOAT_PLAT_LIFETIME = 5.0;
export const FLOAT_PLAT_WARN_TIME = 1.5;
export const FLOAT_PLAT_FADE_IN = 0.4;
export const FLOAT_PLAT_SPAWN_CD = 4.0;
export const FLOAT_PLAT_MAX = 2;

export const FLOAT_PLAT_SLOTS = [
  { x: 60, y: 430 },
  { x: 190, y: 345 },
  { x: 320, y: 430 },
  { x: 120, y: 345 },
  { x: 260, y: 345 },
];

// Lightning
export const LIGHTNING_SPEED = 700;
export const LIGHTNING_DAMAGE = 15;
export const LIGHTNING_COOLDOWN = 0.12;

// Wings
export const WINGS_DURATION = 8;
export const WINGS_SIZE = 40;
export const WINGS_FLY_Y = 80;
export const WINGS_RISE_SPEED = 400;

// Poop bombs
export const POOP_DAMAGE = 22;
export const POOP_AOE_RADIUS = 90;
export const POOP_COOLDOWN = 0.45;
export const POOP_SIZE = 12;
export const POOP_GRAVITY = 800;

// Dwyer ally
export const DWYER_DURATION = 10;
export const CHESTPLATE_SIZE = 40;
export const DWYER_W = 90, DWYER_H = 130;
export const DWYER_SPEED = 240;
export const DWYER_ATTACK_RANGE = 70;
export const DWYER_ATTACK_DAMAGE = 18;
export const DWYER_ATTACK_COOLDOWN = 0.6;
export const DWYER_LANDING_AOE_RADIUS = 200;
export const DWYER_LANDING_DAMAGE = 35;

// Eager Chris ally
export const CHRIS_DURATION = 12;
export const BEER_CAN_SIZE = 56;
export const CHRIS_W = 80, CHRIS_H = 120;
export const CHRIS_SPEED = 270;
export const CHRIS_THROW_RANGE = 260;
export const CHRIS_THROW_DAMAGE = 28;
export const CHRIS_THROW_COOLDOWN = 0.7;
export const CHRIS_CHUG_TIME = 0.35;
export const CHRIS_SPLASH_RADIUS = 80;
export const CHRIS_SPLASH_DAMAGE = 18;
export const CHRIS_CAN_SPEED = 380;
export const CHRIS_CAN_GRAVITY = 260;
export const CHRIS_ENTRY_SPEED = 500;
export const CHRIS_CHARGE_DAMAGE = 30;

// Snot Storm
export const SNOT_STORM_DURATION = 8.0;
export const SNOT_STORM_AOE = 80;
export const SNOT_STORM_AOE_DMG = 10;

// Snot Rocket
export const SNOT_COOLDOWN = 8.0;
export const SNOT_MAX_CHARGE = 0.55;
export const SNOT_MIN_RANGE = 60;
export const SNOT_MAX_RANGE = 380;
export const SNOT_FREEZE_DURATION = 3.0;
export const SNOT_AOE_RADIUS = 120;
export const SNOT_ARC_PEAK = 150;

// Metal Hat
export const METAL_DURATION = 7;
export const HAT_SIZE = 40;

// Smoothie
export const MUSCLE_DURATION = 6;
export const SMOOTHIE_SIZE = 36;

// Fart clouds
export const FART_CLOUD_RADIUS = 130;
export const FART_CLOUD_DURATION = 4;
export const FART_CLOUD_DPS = 12;
export const FART_CLOUD_TICK = 0.5;

// Boss
export const CROWN_ANIM_DURATION = 3.0;

// Wave balancing
export const MAX_ALIVE_ENEMIES_BASE = 6;
export const MAX_ALIVE_ENEMIES_CAP = 12;

// Camp spider
export const CAMP_SPIDER_DELAY = 4.0;
export const CAMP_SPIDER_DESCEND = 1.5;
export const CAMP_SPIDER_GRAB_TIME = 2.0;
export const CAMP_SPIDER_ZAPS_TO_ESCAPE = 5;
export const CAMP_SPIDER_ESCAPE_DMG = 30;
export const CAMP_RADIUS = 60;
export const SPIDER_DROP_DURATION = 4.0;
export const SPIDER_DROP_CLUTCH_Y = 150;
export const SPIDER_DROP_Y = 60;

// Timing
export const TICK_RATE = 1 / 60;

// Leaderboard
export const LEADERBOARD_API = 'https://eggthony-leaderboard.eggthony.workers.dev';

// ============================================================
// THEMED ENVIRONMENTS
// ============================================================
export const THEMES = [
  {
    name: 'SPACE STATION',
    minRound: 1,
    bgTop: '#08081a',
    bgBottom: '#0e0e28',
    platformColor: '#3a4555',
    platformHighlight: '#4e5e72',
    platformDark: '#252e3a',
    pillarColor: '#2e3844',
    pillarWidth: 8,
    underglowColor: [60, 120, 200],
    decorStyle: 'rivets',
    ambientType: 'stars',
    ambientCount: 200,
    nebulaColor: 'rgba(30,60,120,0.08)',
  },
  {
    name: 'XENO JUNGLE',
    minRound: 4,
    bgTop: '#040e08',
    bgBottom: '#0a1a10',
    platformColor: '#2a3a28',
    platformHighlight: '#3a4e36',
    platformDark: '#1a2618',
    pillarColor: '#2a2018',
    pillarWidth: 12,
    underglowColor: [40, 180, 60],
    decorStyle: 'roots',
    ambientType: 'spores',
    ambientCount: 70,
  },
  {
    name: 'VOLCANIC CORE',
    minRound: 7,
    bgTop: '#1a0808',
    bgBottom: '#0e0400',
    platformColor: '#2a1a18',
    platformHighlight: '#3e2824',
    platformDark: '#180e0c',
    pillarColor: '#221210',
    pillarWidth: 10,
    underglowColor: [220, 120, 20],
    decorStyle: 'cracks',
    ambientType: 'embers',
    ambientCount: 45,
  }
];

// ============================================================
// ENEMY TYPES
// ============================================================
export const ENEMY_TYPES = {
  grunt: {
    color: '#44cc44',
    eyeColor: '#ff0000',
    baseHp: 40,
    baseW: 56,
    baseH: 64,
    speed: 80,
    damage: 10,
    score: 100
  },
  spitter: {
    color: '#cc44cc',
    eyeColor: '#ffff00',
    baseHp: 30,
    baseW: 48,
    baseH: 56,
    speed: 50,
    damage: 8,
    score: 150,
    shootRange: 250,
    shootCooldown: 2.0,
    projectileSpeed: 200
  },
  brute: {
    color: '#cc6622',
    eyeColor: '#ff4444',
    baseHp: 90,
    baseW: 72,
    baseH: 74,
    speed: 120,
    damage: 18,
    score: 300,
    chargeSpeed: 260
  }
};
