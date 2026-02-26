# CLAUDE.md

## Project Overview
Eggthony: Lightning Egg — single-file HTML5 Canvas arena brawler. All game code lives in `index.html` (~3700 lines of JS). No frameworks, no build step, no dependencies.

## Architecture
- **Single file:** `index.html` contains all HTML, CSS, and JavaScript
- **Resolution:** 480x854 (portrait), fixed 60 FPS timestep via accumulator
- **Rendering:** Canvas 2D with pixelated upscaling
- **Audio:** Web Audio API procedural SFX (`playSound()` switch) + M4A voice clips in `data/sounds/`
- **Sprites:** PNG files in `data/`, loaded via `Image()` objects

## Key Constants & Layout (index.html)
- Game area: W=480, H=854
- Main platform: PLATFORM_Y=520, PLATFORM_X=20, PLATFORM_W=440, PLATFORM_H=24
- Player: 56x128, speed 260, jump -560, gravity 1400, 100 HP
- Lightning: 15 dmg, 0.12s cooldown, 700 speed
- Snot rocket: 8s cooldown, 120px AOE, 3s freeze
- Floating platforms: 100x12, 5s solid + 1.5s warning, max 2 alive, 4s spawn CD
- Boss: every 3rd round, scales +200 HP/+10 dmg/+15 speed per appearance

## Code Organization (top to bottom)
1. Canvas setup & sizing (~1-60)
2. Audio engine & playSound switch (~64-210)
3. Voice clips (~216-256)
4. Sprite loading (~258-280)
5. Input handling — keyboard, mouse, touch (~282-630)
6. Game constants (~638-680)
7. Floating platform constants & slots (~651-680)
8. Theme definitions (3 themes) (~680-730)
9. Game state variables (~730-760)
10. Boss creation & update (~800-1200)
11. Boss drawing (~1200-1400)
12. Background & ambient drawing (~1400-1580)
13. Main platform drawing + floating platform drawing (~1580-1810)
14. Particles & damage numbers (~1810-1880)
15. Player creation, update, drawing (~1880-2120)
16. Snot rocket system (~2120-2500)
17. Floating platform update (~2380-2440)
18. Enemy system (~2600-2820)
19. Powerups — metal hat & smoothie (~2820-3100)
20. Wave/round system (~3100-3170)
21. HUD drawing (~3170-3420)
22. Title/transition/gameover screens (~3420-3530)
23. Click handlers (game state resets) (~3530-3600)
24. Main game loop, update(), draw() (~3600-3760)

## Important Patterns
- **Themes:** `getTheme()` returns current theme object with colors, decorStyle, ambientType. All drawing functions read from theme.
- **Player collision:** Main platform first, then floating platforms (one-way, drop-through with S/Down). Enemies/boss only use PLATFORM_Y.
- **Powerup modes:** `player.metalTimer > 0` = metal mode, `player.muscleTimer > 0` = muscle mode. Both can overlap.
- **Boss phases:** idle → charge or pound_jump → pound_land → shockwave → idle. Rage at ≤30% HP.
- **Enemy types:** grunt (basic), spitter (ranged), brute (charging). Type determined at spawn by round-based probability.
- **State resets:** Game restart clears state in TWO click handlers (title and gameOver) plus `startRound()`. All three must stay in sync.

## Adding New Features
- New sounds: add case to `playSound()` switch (~line 88)
- New enemies: add to `spawnEnemyForRound()` and `updateEnemies()`/`drawEnemies()`
- New powerups: follow metal hat / smoothie pattern (spawn timer, update, draw, player state)
- New themes: add entry to THEMES array, implement decorStyle in `drawPlatform()`
- State resets: update BOTH click handlers AND `startRound()` when adding persistent state
