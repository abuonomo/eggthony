"""Gymnasium environment wrapper for Eggthony headless sim."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import gymnasium as gym
import numpy as np

# 20 discrete macro-actions (movement + shoot combos + down/drop-through + snot)
ACTION_TABLE = [
    {},                                          # 0: idle
    {"left": True},                              # 1: left
    {"right": True},                             # 2: right
    {"jump": True},                              # 3: jump
    {"left": True, "jump": True},                # 4: left+jump
    {"right": True, "jump": True},               # 5: right+jump
    {"shoot": True},                             # 6: shoot
    {"left": True, "shoot": True},               # 7: left+shoot
    {"right": True, "shoot": True},              # 8: right+shoot
    {"jump": True, "shoot": True},               # 9: jump+shoot
    {"left": True, "jump": True, "shoot": True}, # 10: left+jump+shoot
    {"right": True, "jump": True, "shoot": True},# 11: right+jump+shoot
    {"down": True},                              # 12: drop through platform
    {"down": True, "shoot": True},               # 13: drop + shoot
    {"left": True, "down": True},                # 14: left + drop
    {"right": True, "down": True},               # 15: right + drop
    {"snot": True},                              # 16: fire snot rocket
    {"left": True, "snot": True},                # 17: left + snot
    {"right": True, "snot": True},               # 18: right + snot
    {"jump": True, "snot": True},                # 19: jump + snot
]

# Obs: player(16) + enemies(10*8) + boss(6) + powerups(4*2) + eprojs(5*4) + farts(3*3) + spider(3) + platforms(2*3) + meta(2) = 150
OBS_DIM = 150
MAX_ENEMIES = 10
MAX_ENEMY_PROJ = 5
MAX_FART_CLOUDS = 3
MAX_PLATFORMS = 2

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _flatten_obs(obs: dict) -> np.ndarray:
    """Flatten structured JSON obs into a fixed 98-float vector."""
    vec = []

    # Player (16 floats)
    p = obs["player"]
    vec.extend([
        p["x"] / 480.0, p["y"] / 854.0,
        p["vx"] / 400.0, p["vy"] / 800.0,
        p["hp"] / 100.0,
        1.0 if p["onGround"] else 0.0,
        min(p["metalTimer"] / 7.0, 1.0),
        min(p["muscleTimer"] / 6.0, 1.0),
        min(p["wingsTimer"] / 8.0, 1.0),
        min(p["snotCooldown"] / 8.0, 1.0),
        min(p["lightningCooldown"] / 0.12, 1.0),
        min(p["iframes"] / 0.8, 1.0),
        float(p["airJumps"]),
        min(p["snotStormTimer"] / 8.0, 1.0),
        min(p["spiderDropTimer"] / 4.0, 1.0),
        1.0 if p["facingRight"] else 0.0,
    ])

    # Enemies: 10 slots x 8 features (pos, vel, hp, type flags, frozen)
    enemies = obs.get("enemies", [])
    for i in range(MAX_ENEMIES):
        if i < len(enemies):
            e = enemies[i]
            vec.extend([
                e["x"] / 480.0, e["y"] / 854.0,
                e.get("vx", 0) / 400.0, e.get("vy", 0) / 800.0,
                e["hp"] / 200.0,
                1.0 if e.get("type") == "brute" else 0.0,
                1.0 if e.get("type") == "spitter" else 0.0,
                1.0 if e.get("frozen") else 0.0,
            ])
        else:
            vec.extend([0.0] * 8)

    # Boss (6 floats)
    boss = obs.get("boss")
    if boss:
        max_hp = boss.get("maxHp", 1)
        vec.extend([
            boss["x"] / 480.0, boss["y"] / 854.0,
            boss["hp"] / max_hp if max_hp > 0 else 0.0,
            1.0,  # boss present
            1.0 if boss.get("isQP") else 0.0,
            1.0 if boss.get("state") == "charge" else 0.0,
        ])
    else:
        vec.extend([0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

    # Powerups: 4 items x 2 coords
    powerups = obs.get("powerups", {})
    for key in ("metalHat", "smoothie", "wingsItem", "chestplate"):
        pu = powerups.get(key)
        if pu:
            vec.extend([pu["x"] / 480.0, pu["y"] / 854.0])
        else:
            vec.extend([0.0, 0.0])

    # Enemy projectiles: 5 slots x 4 features (pos + vel)
    eprojs = obs.get("projectiles", {}).get("enemyProjectiles", [])
    for i in range(MAX_ENEMY_PROJ):
        if i < len(eprojs):
            ep = eprojs[i]
            vec.extend([
                ep["x"] / 480.0, ep["y"] / 854.0,
                ep.get("vx", 0) / 400.0, ep.get("vy", 0) / 400.0,
            ])
        else:
            vec.extend([0.0, 0.0, 0.0, 0.0])

    # Fart clouds: 3 slots x 3 features (pos + radius)
    farts = obs.get("fartClouds", [])
    for i in range(MAX_FART_CLOUDS):
        if i < len(farts):
            f = farts[i]
            vec.extend([
                f["x"] / 480.0, f["y"] / 854.0,
                f.get("radius", 130) / 200.0,
            ])
        else:
            vec.extend([0.0, 0.0, 0.0])

    # Camp spider: 3 floats (camp timer, state, escape progress)
    spider = obs.get("campSpider", {})
    camp_timer = spider.get("campTimer", 0) / 4.0  # normalized to CAMP_SPIDER_DELAY
    spider_state = spider.get("state", "none")
    state_val = {"none": 0.0, "descending": 0.33, "grabbed": 0.67,
                 "retreating": 1.0}.get(spider_state, 0.0)
    escape_progress = spider.get("zapHits", 0) / 5.0  # CAMP_SPIDER_ZAPS_TO_ESCAPE
    vec.extend([camp_timer, state_val, escape_progress])

    # Floating platforms: 2 slots x 3 features (x, y, isSolid)
    platforms = obs.get("floatingPlatforms", [])
    for i in range(MAX_PLATFORMS):
        if i < len(platforms):
            plat = platforms[i]
            vec.extend([
                plat["x"] / 480.0, plat["y"] / 854.0,
                1.0 if plat.get("phase") == "solid" else 0.0,
            ])
        else:
            vec.extend([0.0, 0.0, 0.0])

    # Metadata (2 floats)
    vec.extend([obs.get("round", 1) / 20.0, obs.get("score", 0) / 10000.0])

    return np.array(vec, dtype=np.float32)


class EggthonyEnv(gym.Env):
    """Gymnasium wrapper around Eggthony headless Node.js sim."""

    metadata = {"render_modes": []}

    def __init__(self, frame_skip: int = 4, seed: int | None = None,
                 max_start_round: int = 1):
        super().__init__()
        self.action_space = gym.spaces.Discrete(len(ACTION_TABLE))
        self.observation_space = gym.spaces.Box(
            low=-5.0, high=5.0, shape=(OBS_DIM,), dtype=np.float32
        )
        self.frame_skip = frame_skip
        self._seed = seed if seed is not None else 42
        self._episode = 0
        self._max_start_round = max_start_round
        self._proc: subprocess.Popen | None = None

    def _start_process(self):
        self._proc = subprocess.Popen(
            ["node", str(PROJECT_ROOT / "rl" / "bridge.js")],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
        )

    def _send(self, msg: dict) -> dict:
        assert self._proc and self._proc.stdin and self._proc.stdout
        line = json.dumps(msg) + "\n"
        self._proc.stdin.write(line.encode())
        self._proc.stdin.flush()
        resp_line = self._proc.stdout.readline()
        if not resp_line:
            raise RuntimeError("bridge process closed unexpectedly")
        return json.loads(resp_line)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self._seed = seed

        self._episode += 1
        episode_seed = self._seed + self._episode

        # Restart process if dead
        if self._proc is None or self._proc.poll() is not None:
            if self._proc:
                self._proc.kill()
                self._proc.wait()
            self._start_process()

        if self._max_start_round > 1:
            # Weight towards harder rounds: 1-2 are trivial
            # Weights: r1=1, r2=1, r3=3, r4=3, r5=4, r6=4, r7=4
            rounds = list(range(1, self._max_start_round + 1))
            weights = [1 if r <= 2 else 3 if r <= 4 else 4 for r in rounds]
            total = sum(weights)
            probs = [w / total for w in weights]
            start_round = np.random.choice(rounds, p=probs)
        else:
            start_round = 1
        resp = self._send({"cmd": "reset", "seed": episode_seed,
                           "startRound": int(start_round)})
        obs = _flatten_obs(resp["obs"])
        return obs, {"start_round": start_round}

    def step(self, action: int):
        act = ACTION_TABLE[action]
        try:
            resp = self._send({"cmd": "step", "action": act, "n": self.frame_skip})
        except RuntimeError:
            obs_flat = np.zeros(OBS_DIM, dtype=np.float32)
            return obs_flat, -10.0, True, False, {"crash": True}

        obs_flat = _flatten_obs(resp["obs"])
        reward = resp.get("reward", 0.0)
        done = resp.get("done", False)
        info = resp.get("info", {})
        return obs_flat, reward, done, False, info

    def close(self):
        if self._proc and self._proc.poll() is None:
            try:
                self._send({"cmd": "close"})
            except Exception:
                pass
            self._proc.kill()
            self._proc.wait()
        self._proc = None
