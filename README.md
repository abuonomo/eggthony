# Eggthony: Lightning Egg

A fast-paced 2D arena brawler built with HTML5 Canvas and ES6 modules. You play as Eggthony, a sentient egg armed with lightning bolts and booger mortars, fighting endless waves of increasingly dangerous enemies across three themed environments.

Inspired by Super Smash Bros. Melee's platform combat and classic arcade wave survival games.

## Play

### Development
```
npm install
npm run dev
```

### Production
```
npm run build
npm run preview
```

Works on desktop (keyboard + mouse) and mobile (touch controls auto-detected).

**Live:** [eggthony.com](https://eggthony.com)

## Controls

### Desktop
| Key | Action |
|-----|--------|
| A / D | Move left / right |
| W / Space | Jump (tap again mid-air for double jump) |
| S / Down | Drop through floating platforms / fast-fall |
| Left Click | Shoot lightning toward cursor |
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

**Snot Stomp** - Land on frozen enemies to stomp them. Hold W/Up for a power stomp (120 dmg vs 60 dmg). Chain 3 stomps to activate Snot Storm mode.

**Snot Storm** - Activated by 3 consecutive stomps. Lightning gains AOE splash damage, green visual effects, and enemies hit are briefly frozen. Lasts 8 seconds.

**Poop Bombs** - Available during Wings mode. Click to drop bombs that deal AOE damage on impact.

### Enemies

| Type | HP | Behavior | Appears |
|------|----|----------|---------|
| **Grunt** | 40+ | Walks toward you, contact damage | Round 1+ |
| **Spitter** | 30+ | Keeps distance, shoots magenta projectiles | Round 3+ |
| **Brute** | 120+ | Charges at high speed when close | Round 5+ |

All enemies gain +15 HP per round. Waves get larger (3 + round x 3 enemies) and spawn faster as rounds progress.

### Bosses

Bosses appear every 3rd round (3, 6, 9...). Scales in HP, damage, speed, and size with each appearance.

**Evil Eggthony** (rounds 3, 6) - The original boss. Grows larger and stronger each appearance.

**Quentin Pizza** (rounds 9+) - Replaces Evil Eggthony from the 3rd boss appearance onward. Square sprite, resets to base size on first appearance. Rips a fart immediately upon landing. Size and stats scale more gently than Evil Eggthony.

**Attacks:**
- **Charge** - Winds up then rushes across the platform at high speed, bouncing off edges
- **Ground Pound** - Jumps to your predicted position and slams down, creating an expanding shockwave ring
- **Fart Cloud** (QP only) - Releases a toxic cloud (130px radius) that deals damage over time for 4 seconds
- **Rage Mode** - Below 30% HP: faster attacks, shorter cooldowns, red aura intensifies

### Powerups

**Metal Hat** (silver dome) - 7 seconds of damage reflection. Enemy contact bounces them away and deals 40 damage back. Deflects projectiles.

**Blueberry Smoothie** (purple cup) - 6 seconds of muscle mode. Automatic AOE slam attacks hit nearby enemies for 30 damage with knockback.

**Wings** (golden wings) - 10 seconds of flight. Hover above the arena, drop poop bombs on enemies below.

**Chestplate** (golden armor) - Summons Dwyer, a Roman soldier companion who fights alongside you with a sword for 15 seconds. Dramatic drop entrance with AOE damage.

All powerups can be active simultaneously.

### Anti-Camping: Spider

Stay in one spot too long and a spider descends from the ceiling to grab you. Mash the attack button to escape. Escape near the top of the screen for Spider Drop mode: hang from the ceiling with 3x fire rate for 4 seconds.

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
- **Build:** Vite for dev server and production bundling

### Dev Menu

Hidden developer menu for testing: tap the top-left corner of the title screen 5 times quickly to open. Allows jumping directly to any round (1-15) with the correct theme loaded. Includes powerup toggles and local dev leaderboard controls.

## Project Structure

```
eggthony/
  index.html              # HTML shell (canvas + name input overlay)
  package.json            # Vite dev dependency
  vite.config.js          # Minimal Vite config
  src/
    main.js               # Entry: canvas setup, game loop, click handlers
    state.js              # Shared mutable state (S object), reset functions
    constants.js          # All constants, THEMES array
    audio.js              # Web Audio SFX, voice clips, music
    sprites.js            # Image loading, white-BG removal
    input.js              # Keyboard, mouse, touch handlers
    player.js             # Player physics and drawing
    boss.js               # Boss AI, fart clouds
    enemies.js            # Enemy spawn, AI, combat
    weapons.js            # Lightning, snot rocket, poop bombs
    powerups.js           # Metal hat, smoothie, wings, chestplate, dwyer
    effects.js            # Particles, damage numbers, screen shake, camp spider
    world.js              # Themes, backgrounds, platforms
    waves.js              # Round/wave system
    screens.js            # Title, HUD, game over, dev menu, leaderboard
    utils.js              # Collision helper
  public/
    CNAME                 # Custom domain config
    data/
      *.png               # Sprites
      sounds/             # Voice clips and music (M4A)
```
