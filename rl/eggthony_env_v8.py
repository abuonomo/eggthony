"""Gymnasium environment using embedded V8 (MiniRacer) — no subprocess IPC."""

from __future__ import annotations

import json
from pathlib import Path

import gymnasium as gym
import numpy as np

from eggthony_env import ACTION_TABLE, OBS_DIM, _flatten_obs

BUNDLE_PATH = Path(__file__).parent / "headless_bundle.js"

# JS helper: step N times with accumulated reward, return JSON
_SETUP_JS = """
var _actionTable = ACTION_TABLE_JSON;

function _stepN(actionIdx, n) {
    var act = _actionTable[actionIdx];
    var result;
    var totalReward = 0;
    for (var i = 0; i < n; i++) {
        result = _env.step(act);
        totalReward += result.reward;
        if (result.done) break;
    }
    result.reward = totalReward;
    return JSON.stringify(result);
}

function _reset(seed, startRound) {
    return JSON.stringify(_env.reset({seed: seed, startRound: startRound}));
}
"""


class EggthonyV8Env(gym.Env):
    """Gymnasium wrapper using embedded V8 — ~16x faster than subprocess."""

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

        # Boot V8
        from py_mini_racer import MiniRacer
        self._ctx = MiniRacer()
        bundle = BUNDLE_PATH.read_text()
        self._ctx.eval(bundle)
        self._ctx.eval("var _env = HeadlessSim.createEnv({seed: 42})")
        setup = _SETUP_JS.replace("ACTION_TABLE_JSON", json.dumps(ACTION_TABLE))
        self._ctx.eval(setup)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self._seed = seed

        self._episode += 1
        episode_seed = self._seed + self._episode

        if self._max_start_round > 1:
            rounds = list(range(1, self._max_start_round + 1))
            weights = [1 if r <= 2 else 3 if r <= 4 else 4 for r in rounds]
            total = sum(weights)
            probs = [w / total for w in weights]
            start_round = int(np.random.choice(rounds, p=probs))
        else:
            start_round = 1

        result = self._ctx.eval(f"_reset({episode_seed}, {start_round})")
        obs = json.loads(result)
        return _flatten_obs(obs), {"start_round": start_round}

    def step(self, action: int):
        result = self._ctx.eval(f"_stepN({int(action)}, {self.frame_skip})")
        parsed = json.loads(result)
        obs_flat = _flatten_obs(parsed["obs"])
        reward = parsed.get("reward", 0.0)
        done = parsed.get("done", False)
        info = parsed.get("info", {})
        return obs_flat, reward, done, False, info

    def close(self):
        self._ctx = None
