"""WebSocket server that lets an RL agent (or random policy) play Eggthony live in the browser.

Start this, then open http://localhost:5173/?ai in the browser.

Usage:
    uv run python rl/watch.py                                        # random agent
    uv run python rl/watch.py --model rl/models/eggthony_ppo        # specific model
    uv run python rl/watch.py --latest                               # auto-load newest checkpoint, hot-reloads
"""

from __future__ import annotations

import argparse
import asyncio
import collections
import json
import random
import sys
from pathlib import Path

import numpy as np
import websockets

sys.path.insert(0, str(Path(__file__).parent))
from eggthony_env import _flatten_obs, ACTION_TABLE, OBS_DIM

MODELS_DIR = Path(__file__).parent / "models"
STATS_FILE = Path(__file__).parent / "models" / "train_stats.json"

model = None
model_path_loaded = None
frame_stack_n = 4


def find_latest_model() -> Path | None:
    """Find the most recently modified .zip in the models dir."""
    zips = sorted(MODELS_DIR.glob("*.zip"), key=lambda p: p.stat().st_mtime)
    return zips[-1] if zips else None


def load_model(path: Path):
    global model, model_path_loaded
    from stable_baselines3 import PPO
    model = PPO.load(str(path))
    model_path_loaded = path
    print(f"[watch] Loaded model: {path.name}")


def maybe_reload_latest():
    """If a newer checkpoint exists, hot-reload it."""
    global model_path_loaded
    latest = find_latest_model()
    if latest and latest != model_path_loaded:
        load_model(latest)


def read_train_stats() -> dict | None:
    """Read latest training stats from JSON file."""
    try:
        if STATS_FILE.exists():
            return json.loads(STATS_FILE.read_text())
    except Exception:
        pass
    return None


def predict_action(obs_stacked: np.ndarray) -> int:
    """Pick an action given stacked obs. Uses loaded model or random."""
    if model is not None:
        action, _ = model.predict(obs_stacked, deterministic=False)
        return int(action)
    return random.randint(0, len(ACTION_TABLE) - 1)


async def handler(websocket, *, auto_reload: bool = False):
    print("[watch] Browser connected")
    episode = 0
    steps = 0
    # Ring buffer for frame stacking
    frame_buf = collections.deque(
        [np.zeros(OBS_DIM, dtype=np.float32)] * frame_stack_n,
        maxlen=frame_stack_n,
    )

    try:
        check_counter = 0
        async for message in websocket:
            msg = json.loads(message)
            obs = msg.get("obs")
            if obs is None:
                continue

            # Check for new model every 100 obs or on first obs
            if auto_reload:
                check_counter += 1
                if check_counter == 1 or check_counter % 100 == 0:
                    maybe_reload_latest()

            obs_flat = _flatten_obs(obs)
            frame_buf.append(obs_flat)
            obs_stacked = np.concatenate(list(frame_buf))

            action = predict_action(obs_stacked)
            resp = {"action": action}
            if model_path_loaded:
                resp["model"] = model_path_loaded.stem
            stats = read_train_stats()
            if stats:
                resp["train"] = stats
            await websocket.send(json.dumps(resp))
            steps += 1

            # On episode end, log, reset buffer, and check for newer model
            if obs.get("gameState") == "gameOver":
                episode += 1
                print(f"  Episode {episode} ended: steps={steps}, "
                      f"score={obs.get('score', '?')}, round={obs.get('round', '?')}")
                steps = 0
                for i in range(frame_stack_n):
                    frame_buf.append(np.zeros(OBS_DIM, dtype=np.float32))
                if auto_reload:
                    maybe_reload_latest()
    except websockets.ConnectionClosed:
        print("[watch] Browser disconnected")


async def main(host: str = "0.0.0.0", port: int = 8765, auto_reload: bool = False):
    print(f"[watch] Agent server on ws://{host}:{port}")
    mode = "latest (auto-reload)" if auto_reload else ("loaded model" if model else "random")
    print(f"[watch] Policy: {mode} (frame_stack={frame_stack_n})")
    print(f"[watch] Open http://localhost:5173/?ai in your browser")

    async with websockets.serve(
        lambda ws: handler(ws, auto_reload=auto_reload), host, port
    ):
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live RL agent viewer")
    parser.add_argument("--model", type=str, default=None,
                        help="Path to trained SB3 model (omit for random agent)")
    parser.add_argument("--latest", action="store_true",
                        help="Auto-load the newest checkpoint, hot-reload when new ones appear")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--frame-stack", type=int, default=4,
                        help="Number of frames to stack (must match training)")
    args = parser.parse_args()

    frame_stack_n = args.frame_stack
    auto_reload = False
    if args.latest:
        latest = find_latest_model()
        if latest:
            load_model(latest)
        else:
            print("[watch] No models found yet, starting with random policy")
        auto_reload = True
    elif args.model:
        load_model(Path(args.model))

    asyncio.run(main(port=args.port, auto_reload=auto_reload))
