# Eggthony: Lightning Egg

A fast-paced 2D arena brawler built entirely in a single HTML file. You play as Eggthony, a sentient egg armed with lightning bolts and booger mortars, fighting endless waves of increasingly dangerous enemies across three themed environments.

Inspired by Super Smash Bros. Melee's platform combat and classic arcade wave survival games.

## Play

Open `index.html` in any modern browser. No build step, no dependencies, no server required.

Works on desktop (keyboard + mouse) and mobile (touch controls auto-detected).

## Controls

### Desktop
| Key | Action |
|-----|--------|
| A / D | Move left / right |
| W / Space | Jump (tap again mid-air for double jump) |
| S / Down | Drop through floating platforms |
| Left / Right Click | Shoot lightning toward cursor |
| Hold Q or E | Charge snot rocket mortar, release to fire |
| Escape | Pause / unpause |

### Mobile
- **Left side drag** - Virtual joystick for movement
- **JUMP button** - Jump (tap again for double jump)
- **ZAP button** - Shoot lightning (auto-aims at nearest enemy)
- **SNOT button** - Hold to charge booger mortar, release to fire

## Game Mechanics

### Combat

**Lightning** - Your primary attack. Rapid-fire bolts aimed at the cursor (or auto-aimed on mobile). 15 damage per bolt, 0.12s cooldown. No resource cost.

**Snot Rocket** - Hold Q/E to charge a booger mortar. A trajectory arc and AOE circle preview where it will land. On impact, freezes all enemies in a 120px radius for 3 seconds. 8 second cooldown. The longer you hold, the farther it flies (60-380px range).

### Enemies

| Type | HP | Behavior | Appears |
|------|----|----------|---------|
| **Grunt** | 40+ | Walks toward you, contact damage | Round 1+ |
| **Spitter** | 30+ | Keeps distance, shoots magenta projectiles | Round 3+ |
| **Brute** | 120+ | Charges at high speed when close | Round 5+ |

All enemies gain +15 HP per round. Waves get larger (3 + round x 3 enemies) and spawn faster as rounds progress.

### Boss: Evil Eggthony

Appears every 3rd round (3, 6, 9...). Scales in HP, damage, speed, and size with each appearance.

**Attacks:**
- **Charge** - Winds up then rushes across the platform at high speed, bouncing off edges
- **Ground Pound** - Jumps to your predicted position and slams down, creating an expanding shockwave ring
- **Rage Mode** - Below 30% HP: faster attacks, shorter cooldowns, red aura intensifies

### Powerups

**Metal Hat** (silver dome) - 7 seconds of damage reflection. Enemy contact bounces them away and deals 40 damage back. Deflects projectiles. Spawns every 15-25 seconds.

**Blueberry Smoothie** (purple cup) - 6 seconds of muscle mode. Automatic AOE slam attacks hit nearby enemies for 30 damage with knockback. Spawns every 20-30 seconds.

Both powerups can be active simultaneously.

### Floating Platforms

Ephemeral one-way platforms spawn at preset positions above the main stage (Battlefield-style). Up to 2 at a time, lasting ~6.5 seconds each.

- **Low platforms** (y=430) - Reachable with a single jump
- **High platforms** (y=345) - Reachable with a double jump, or a single jump from a low platform
- Hold S/Down to drop through them
- Enemies and boss ignore floating platforms entirely
- Platforms blink and shake for 1.5s before crumbling

### Environments

The arena changes theme every 3 rounds:

| Theme | Rounds | Vibe |
|-------|--------|------|
| **Space Station** | 1-3 | Twinkling stars, steel platform with rivets, cyan underglow |
| **Xeno Jungle** | 4-6 | Falling spores, hanging vines, root-covered platform, green fog |
| **Volcanic Core** | 7+ | Rising embers, stalactites, lava veins, orange underglow |

Transitions use a fade-to-black effect with theme announcement.

### Scoring

- Grunt kill: 100 pts
- Spitter kill: 150 pts
- Brute kill: 300 pts
- Boss kill: 1000-2500 pts (scales with appearance)

## Technical Details

- **Resolution:** 480x854 internal (portrait 9:16), scales to viewport
- **Rendering:** HTML5 Canvas 2D, pixelated upscaling
- **Frame rate:** Fixed 60 FPS with accumulator-based timestep
- **Audio:** All SFX procedurally generated via Web Audio API oscillators. Voice clips are pre-recorded M4A files.
- **Architecture:** Single-file (`index.html`, ~3700 lines). No frameworks, no build tools, no external dependencies.

## Project Structure

```
eggthony/
  index.html          # Entire game (HTML + JS + CSS)
  data/
    eggthony.png      # Player sprite
    metal_eggthony.png# Metal powerup variant
    muscle_eggthony.png# Muscle powerup variant
    evil_eggthony.png # Boss sprite
    grunt.PNG         # Grunt enemy sprite
    brute.PNG         # Brute enemy sprite
    spitter.PNG       # Spitter enemy sprite
    metal_hat.PNG     # Metal hat powerup icon
    smoothie.PNG      # Smoothie powerup icon
    sounds/           # Voice clips and ambient audio (M4A)
```
