# Eggthony RL Agent Guide

## Quick Start — Train an Agent

```bash
# 1. Install RL dependencies (one-time)
uv sync --extra rl

# 2. Train a PPO agent (~1-2 hours for 500k steps)
cd rl && uv run python train.py train

# 3. Evaluate the trained agent (prints scores)
cd rl && uv run python train.py eval
```

## Quick Start — Watch an Agent Play Live

Run two commands in separate terminals, then open the browser:

```bash
# Terminal 1: start the game server
npm run dev

# Terminal 2: start the agent (random policy by default)
uv run python rl/watch.py

# Then open in browser:
#   http://localhost:5173/?ai
```

To watch a trained model instead of random actions:
```bash
uv run python rl/watch.py --model rl/models/eggthony_ppo
```

## Quick Start — JS API (Custom Agents)

```js
import { createEnv } from './src/headless.js';

const env = createEnv({ seed: 42 });
let obs = env.reset();

while (true) {
  const action = myAgent(obs);  // your policy here
  const { obs: next, reward, done, info } = env.step(action);
  obs = next;
  if (done) break;
}
```

Run the built-in self-test to verify everything works:
```bash
node src/headless.js
```

## Environment API

### `createEnv({ seed })`
Returns an environment object. The `seed` (default 42) is used for the PRNG — same seed + same actions = identical episode, guaranteed.

### `env.reset() → obs`
Resets all game state, re-seeds the PRNG, starts round 1. Returns the initial observation.

### `env.step(action) → { obs, reward, done, info }`
Advances one simulation tick (1/60th of a second). Returns:
- **obs** — structured observation (see below)
- **reward** — scalar reward for this tick
- **done** — true when the player dies
- **info** — `{ score, round, tickCount, playerHp }`

---

## Action Space

Every field is optional (defaults to false/undefined). Actions are applied fresh each tick — there is no key "sticking".

| Field   | Type  | Description |
|---------|-------|-------------|
| `left`  | bool  | Move left |
| `right` | bool  | Move right |
| `jump`  | bool  | Jump (grounded) or double-jump (airborne, 1 per air trip) |
| `down`  | bool  | Fast-fall when airborne, drop through floating platforms |
| `shoot` | bool  | Fire lightning bolt toward `(aimX, aimY)`. Auto-aims at nearest enemy if aim not set. Fires poop bombs instead during wings mode. |
| `snot`  | bool  | Hold to charge snot rocket (right-click equivalent). Releases on unhold. 8s cooldown. |
| `aimX`  | float | Aim target X (0–480). Persistent until changed. Default: center (240). |
| `aimY`  | float | Aim target Y (0–854). Persistent until changed. Default: center (427). |

### Action tips
- **Lightning auto-aim** fires toward the nearest enemy if `aimX`/`aimY` aren't set — this is often good enough.
- **Snot rocket** requires holding `snot: true` for multiple ticks to charge, then releasing. Max charge at ~33 ticks (0.55s). Longer charge = longer range. Freezes enemies in AOE for 3s.
- **Jump** must be released between jumps — holding it continuously won't double-jump. Alternate `jump: true` / `jump: false` between ticks.
- **Fast-fall** (`down`) grants brief invincibility frames during the dive.

---

## Observation Space

```js
{
  player: {
    x, y,              // position (floats, pixels)
    vx, vy,            // velocity (pixels/sec)
    hp,                // current HP (0 = dead, max 100 base)
    onGround,          // bool
    facingRight,       // bool (follows aim direction)
    metalTimer,        // >0 means invincible metal mode (7s duration)
    muscleTimer,       // >0 means 1.5x jump + damage mode (6s duration)
    wingsTimer,        // >0 means flying mode — poop bombs replace lightning (8s)
    snotCooldown,      // >0 means snot rocket on cooldown (8s max)
    lightningCooldown, // >0 means lightning on cooldown (0.12s)
    iframes,           // >0 means invulnerable (0.8s after hit)
    airJumps,          // 1 = double jump available, 0 = used
    snotStormTimer,    // >0 means snot storm active (chain-stomp reward)
    spiderDropTimer,   // >0 means spider drop mode (3x fire rate from ceiling)
  },
  enemies: [{          // variable-length array, 0–20+ enemies
    x, y, vx, vy,
    hp,                // 0 when dying
    type,              // 'grunt' | 'spitter' | 'brute'
    frozen,            // bool (snot-frozen)
  }],
  boss: null | {       // present on boss rounds (every 3rd round)
    x, y,
    hp, maxHp,
    state,             // 'idle' | 'charge' | 'pound_jump' | 'pound_land' | 'fart_windup' | etc.
    isQP,              // true for Quentin Pizza boss (round 9+)
  },
  projectiles: {
    lightning: [{ x, y, vx, vy }],      // player's active bolts
    enemyProjectiles: [{ x, y, vx, vy }], // spitter projectiles to dodge
    snotRocket: null | { x, y },
  },
  powerups: {
    metalHat: null | { x, y },     // grants invincibility
    smoothie: null | { x, y },     // grants 1.5x jump + damage
    wingsItem: null | { x, y },    // grants flight + poop bombs
    chestplate: null | { x, y },   // spawns Dwyer ally
  },
  fartClouds: [{ x, y, radius }], // QP boss hazard, 12 DPS
  floatingPlatforms: [{ x, y, w, phase }], // 'solid' | 'warning' | 'fading'
  score,       // current score (int)
  round,       // current round (int, starts at 1)
  tickCount,   // ticks since episode start
  gameState,   // 'playing' | 'roundTransition' | 'gameOver' | 'gearDrop'
}
```

---

## Reward Signal

The default reward (defined in `headless.js:envStep`) per tick is:

| Component | Value | Notes |
|-----------|-------|-------|
| Score delta | `S.score - prevScore` | +100 per grunt, +150 per spitter, +300 per brute, +1000+ per boss |
| Survival bonus | +0.01 | Per tick, encourages staying alive |
| HP loss penalty | -0.1 per HP lost | Discourages taking hits |
| Round completion | +50 | When round number increases |
| Death penalty | -10 | On episode end |

You can replace the reward function entirely by modifying `envStep` in `headless.js`, or by wrapping the env and computing your own reward from `obs`/`info`.

---

## Game Mechanics Reference

### Arena
- **Resolution:** 480 wide x 854 tall (portrait)
- **Main platform:** Full-width at Y=520, 24px thick
- **Floating platforms:** 100x12, spawn every 4s (max 2), last 5s then crumble. One-way (jump through from below, hold `down` to drop through).
- **Death zone:** Falling below Y=954 (off-screen bottom) is instant death.

### Player
- **Size:** 56x128 pixels
- **Speed:** 260 px/s horizontal
- **Jump:** -560 initial velocity, gravity 1400 px/s^2
- **HP:** 100 (base). Hit → 0.8s invincibility frames.
- **Knockback:** Hits apply 300 px/s knockback. Player can't control movement during knockback (~0.15s).

### Weapons
- **Lightning:** 15 damage, 0.12s cooldown (fires ~8/sec), 700 px/s projectile speed. Auto-aims at nearest enemy.
- **Snot rocket:** 8s cooldown. Hold right-click to charge (0.55s max). 120px AOE freeze for 3s. Longer charge = longer range.
- **Poop bombs (wings mode only):** 22 damage, 90px AOE, 0.45s cooldown. Arc trajectory with gravity.

### Enemy Types
| Type | HP | Speed | Damage | Score | Behavior |
|------|-----|-------|--------|-------|----------|
| Grunt | 40 | 80 | 10 | 100 | Walks toward player, contact damage |
| Spitter | 30 | 50 | 8 | 150 | Ranged, fires projectiles at 250px range |
| Brute | 120 | 120 | 25 | 300 | Charges at 300 px/s, high damage |

Enemy HP scales +5 per round.

### Powerups (spawn on timers, walk into to collect)
| Powerup | Effect | Duration |
|---------|--------|----------|
| Metal Hat | Invincibility, reflect contact damage | 7s |
| Smoothie | 1.5x jump force, 1.5x stomp damage | 6s |
| Wings | Flight mode at Y=80, poop bombs replace lightning | 8s |
| Chestplate | Spawns Dwyer ally (melee fighter, 18 dmg, 0.6s attacks) | 10s |
| Beer Can | Spawns Chris ally (throws cans, charges through enemies) | 12s |

### Boss Rounds (every 3rd round: 3, 6, 9, 12...)
- Scales +200 HP, +10 damage, +15 speed per appearance
- **Evil Eggthony (rounds 3, 6):** Charges, ground pounds with shockwaves
- **Quentin Pizza (round 9+):** All of the above plus fart clouds (130px radius, 12 DPS for 4s)
- Boss score: 1000 + 500 per appearance

### Camp Spider (anti-camping mechanic)
Standing still for 4s summons a spider that grabs the player and drags them off-screen (death). Mash `shoot` (5 clicks) to escape. Escaping near the ceiling triggers "Spider Drop" mode (3x fire rate for 4s).

### Round Progression
- Round N spawns `3 + N*3` enemies
- Spawn interval: `max(0.4, 1.5 - round * 0.1)` seconds
- Killing all enemies → 2s transition → next round with +20 HP heal (+50 before boss rounds)
- Themes change at rounds 4 (Xeno Jungle) and 7 (Volcanic Core) — cosmetic only

---

## Coordinate System

```
(0,0) ────────────────── (480,0)
  │                          │
  │     Floating plats       │
  │     ~Y=345-430           │
  │                          │
  │  ┌──────────────────┐    │
  │  │  Main Platform   │ Y=520
  │  └──────────────────┘    │
  │                          │
(0,854) ──────────────── (480,854)
```

- Y increases downward (standard canvas)
- Player origin is top-left of hitbox
- Player center: `(x + 28, y + 64)`

---

## Determinism

Same seed + same action sequence = bit-identical episode. This is guaranteed by:
- Seeded Mulberry32 PRNG replacing all `Math.random()` calls
- `performance.now()` replaced with tick counter in all update logic
- Fixed 1/60s timestep (no frame-rate variation)

Use different seeds for training diversity:
```js
const env = createEnv({ seed: episodeNumber });
```

---

## Flattening Observations for Neural Networks

The observation is a structured JS object. You'll need to flatten it to a fixed-size tensor. Suggested approach:

```js
function flattenObs(obs) {
  const vec = [];
  // Player state (16 floats)
  const p = obs.player;
  vec.push(p.x / 480, p.y / 854, p.vx / 400, p.vy / 800,
           p.hp / 100, p.onGround ? 1 : 0, p.metalTimer / 7,
           p.muscleTimer / 6, p.wingsTimer / 8, p.snotCooldown / 8,
           p.lightningCooldown / 0.12, p.iframes / 0.8,
           p.airJumps, p.snotStormTimer / 8,
           p.spiderDropTimer / 4, p.facingRight ? 1 : 0);

  // Enemies — pad/truncate to fixed count (e.g., 10 slots x 5 features)
  const MAX_ENEMIES = 10;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = obs.enemies[i];
    if (e) {
      vec.push(e.x / 480, e.y / 854, e.hp / 200,
               e.type === 'brute' ? 1 : 0, e.frozen ? 1 : 0);
    } else {
      vec.push(0, 0, 0, 0, 0); // empty slot
    }
  }

  // Boss (6 floats)
  if (obs.boss) {
    vec.push(obs.boss.x / 480, obs.boss.y / 854,
             obs.boss.hp / obs.boss.maxHp, 1,
             obs.boss.isQP ? 1 : 0,
             obs.boss.state === 'charge' ? 1 : 0);
  } else {
    vec.push(0, 0, 0, 0, 0, 0);
  }

  // Powerup positions (8 floats — 4 powerups x 2 coords, 0 if absent)
  for (const key of ['metalHat', 'smoothie', 'wingsItem', 'chestplate']) {
    const pu = obs.powerups[key];
    vec.push(pu ? pu.x / 480 : 0, pu ? pu.y / 854 : 0);
  }

  // Enemy projectiles — pad to 5 slots x 2 coords
  const MAX_PROJ = 5;
  for (let i = 0; i < MAX_PROJ; i++) {
    const p = obs.projectiles.enemyProjectiles[i];
    vec.push(p ? p.x / 480 : 0, p ? p.y / 854 : 0);
  }

  // Metadata
  vec.push(obs.round / 20, obs.score / 10000);

  return new Float32Array(vec); // 92 floats with these settings
}
```

---

## Performance

On an M-series Mac, `node src/headless.js` runs ~300k ticks/sec (5000 episodes/sec for a typical 60-tick episode). A full 6000-tick episode completes in ~20ms.

The simulation is single-threaded JS. For parallel training, spawn multiple Node processes with different seeds.

---

## Modifying the Reward

Edit `envStep` in `src/headless.js`. You have access to the full game state `S` for custom reward shaping. Examples:

```js
// Distance-to-nearest-enemy reward (encourages engagement)
const nearest = Math.min(...S.enemies.map(e =>
  Math.hypot(e.x - S.player.x, e.y - S.player.y)));
reward += nearest < 100 ? 0.05 : -0.01;

// Penalize standing still (anti-camping, supplements the spider)
if (Math.abs(S.player.vx) < 10) reward -= 0.02;
```

---

## File Map

| File | Role |
|------|------|
| `src/headless.js` | Headless env — `createEnv`, `reset`, `step`, reward, obs |
| `src/simulation.js` | Extracted `update(dt)` — the full game tick |
| `src/ai-bridge.js` | Browser-side WebSocket client for live agent viewing |
| `src/rng.js` | Seeded PRNG — `random()`, `seedRng(n)` |
| `src/node-shims.js` | Browser global stubs for Node.js |
| `src/state.js` | `S` object — all mutable game state |
| `src/constants.js` | All game constants (dimensions, physics, timers) |
| `rl/bridge.js` | Node.js JSON-lines bridge (stdin/stdout) for Python training |
| `rl/eggthony_env.py` | Gymnasium `Env` wrapper — `Discrete(12)` actions, `Box(92,)` obs |
| `rl/train.py` | PPO training/eval script (stable-baselines3) |
| `rl/watch.py` | WebSocket server for live browser viewing |
