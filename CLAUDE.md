# CLAUDE.md

## Project Overview
Eggthony: Lightning Egg — HTML5 Canvas arena brawler built with ES6 modules and Vite.

## Architecture
- **Build:** Vite dev server + production bundler (`npm run dev` / `npm run build`)
- **Resolution:** 480x854 (portrait), fixed 60 FPS timestep via accumulator
- **Rendering:** Canvas 2D with pixelated upscaling
- **Audio:** Web Audio API procedural SFX (`playSound()` switch) + M4A voice clips in `public/data/sounds/`
- **Sprites:** PNG files in `public/data/`, loaded via `Image()` objects
- **State:** Single shared `S` object in `state.js` — all modules import `S` and read/write directly

## Key Constants & Layout
- Game area: W=480, H=854
- Main platform: PLATFORM_Y=520, PLATFORM_X=20, PLATFORM_W=440, PLATFORM_H=24
- Player: 56x128, speed 260, jump -560, gravity 1400, 100 HP
- Lightning: 15 dmg, 0.12s cooldown, 700 speed
- Snot rocket: 8s cooldown, 120px AOE, 3s freeze
- Floating platforms: 100x12, 5s solid + 1.5s warning, max 2 alive, 4s spawn CD
- Boss: every 3rd round, scales +200 HP/+10 dmg/+15 speed per appearance
- QP Boss (app >= 3): size resets to 1.0, scale growth 0.15/app, dmg capped at 30, charge 320 base
- Fart cloud: 130px radius, 4s duration, 12 DPS (0.5s tick)

## Code Organization (src/ modules)

| File | Lines | Purpose |
|------|-------|---------|
| `main.js` | ~270 | Entry point: canvas setup, resize, game loop, update/draw orchestration, click handlers |
| `state.js` | ~210 | Single exported `S` object with ALL mutable game state, `resetPlayer()`, `resetGameState()` |
| `constants.js` | ~210 | All const values: dimensions, physics, durations, THEMES array |
| `audio.js` | ~290 | audioCtx, playSound (20 types), playNoise, playVoice, all Audio clips |
| `sprites.js` | ~115 | All Image() loading, removeWhiteBG, flash canvas |
| `input.js` | ~430 | Keyboard/mouse/touch handlers, autoAimMouse, drawTouchHUD |
| `player.js` | ~380 | updatePlayer, drawPlayer |
| `boss.js` | ~760 | createBoss, updateBoss, damageBoss, drawBoss, fart clouds |
| `enemies.js` | ~530 | spawn, update, draw, damageEnemy, enemy projectiles |
| `weapons.js` | ~710 | Lightning, snot rocket, poop bombs, snot storm overlay |
| `powerups.js` | ~910 | Metal hat, smoothie, wings, chestplate+dwyer |
| `effects.js` | ~220 | Particles, damage numbers, screen shake, camp spider |
| `world.js` | ~650 | Themes, ambient particles, backgrounds, platforms |
| `waves.js` | ~80 | startRound, updateWaves, round progression |
| `screens.js` | ~650 | Title, transition, gameOver, HUD, dev menu, leaderboard |
| `utils.js` | ~5 | rectsOverlap |

## Important Patterns
- **Shared state:** All modules import `S` from `state.js`. `S.ctx`, `S.player`, `S.enemies`, etc.
- **Draw functions:** Use `const ctx = S.ctx;` at the top for convenience.
- **Themes:** `getTheme()` returns current theme object with colors, decorStyle, ambientType.
- **Player collision:** Main platform first, then floating platforms (one-way, drop-through with S/Down).
- **Powerup modes:** `player.metalTimer > 0` = metal mode, `player.muscleTimer > 0` = muscle mode. Both can overlap.
- **Boss phases:** idle → charge or pound_jump → pound_land → shockwave → idle. Rage at ≤30% HP. QP also has fart_windup → fart_release.
- **QP boss:** `boss.isQuentinPizza` flag. Uses `qpApp` (app - 2) for size/damage scaling.
- **Dev menu:** Hidden on title screen. Tap top-left 80x80 zone 5x to open.
- **Enemy types:** grunt (basic), spitter (ranged), brute (charging).
- **State resets:** Consolidated into `resetGameState(round)` in `state.js`.

## Workspace & Repo Structure
- The git repo is `eggthony/` — NOT the parent `eggthony-workspace/` directory
- `eggthony-workspace/` is just a working directory that contains the repo and other workspace files (e.g. `.claude/`)
- The only branch is `main`. Do not create or use `master`
- All git commands (commit, push, etc.) should run inside `eggthony/`
- Assets live in `public/data/` (served as `/data/` by Vite)

## Adding New Features
- New sounds: add case to `playSound()` switch in `src/audio.js`
- New enemies: add to `spawnEnemyForRound()` in `src/enemies.js`
- New powerups: follow metal hat pattern in `src/powerups.js` (spawn timer, update, draw, player state)
- New themes: add entry to THEMES array in `src/constants.js`, implement decorStyle in `src/world.js`
- State resets: update `resetGameState()` in `src/state.js` when adding persistent state
- New player abilities: add to `src/player.js` (update/draw) and `src/input.js` (controls)
