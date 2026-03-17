"""Train a PPO agent on Eggthony using stable-baselines3."""

from __future__ import annotations

import argparse
from pathlib import Path

import json

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback

from eggthony_env import EggthonyEnv

MODELS_DIR = Path(__file__).parent / "models"
TB_LOG_DIR = Path(__file__).parent / "tb_logs"
STATS_FILE = Path(__file__).parent / "models" / "train_stats.json"


class StatsWriterCallback(BaseCallback):
    """Write training stats to a JSON file each rollout for live display."""

    def __init__(self, verbose=0):
        super().__init__(verbose)
        self._ep_rew = None
        self._ep_len = None

    def _on_step(self) -> bool:
        # Capture ep_info_buffer which Monitor populates with completed episodes
        if len(self.model.ep_info_buffer) > 0:
            self._ep_rew = round(
                sum(ep["r"] for ep in self.model.ep_info_buffer) / len(self.model.ep_info_buffer), 1
            )
            self._ep_len = round(
                sum(ep["l"] for ep in self.model.ep_info_buffer) / len(self.model.ep_info_buffer), 1
            )
        return True

    def _on_rollout_end(self) -> None:
        stats = {
            "timesteps": self.num_timesteps,
            "ep_rew_mean": self._ep_rew,
            "ep_len_mean": self._ep_len,
        }
        STATS_FILE.write_text(json.dumps(stats))


def make_env(seed: int = 42, frame_skip: int = 4, max_start_round: int = 1,
             use_v8: bool = False):
    def _init():
        from stable_baselines3.common.monitor import Monitor
        if use_v8:
            from eggthony_env_v8 import EggthonyV8Env
            return Monitor(EggthonyV8Env(frame_skip=frame_skip, seed=seed,
                                         max_start_round=max_start_round))
        return Monitor(EggthonyEnv(frame_skip=frame_skip, seed=seed,
                                   max_start_round=max_start_round))
    return _init


def train(total_timesteps: int = 500_000, n_envs: int = 1, frame_skip: int = 4,
          frame_stack: int = 4, max_start_round: int = 1,
          resume: str | None = None, save_freq: int = 100_000,
          use_v8: bool = False):
    MODELS_DIR.mkdir(exist_ok=True)
    TB_LOG_DIR.mkdir(exist_ok=True)

    from stable_baselines3.common.vec_env import DummyVecEnv, VecFrameStack
    env_fns = [make_env(seed=1000 * i, frame_skip=frame_skip,
                        max_start_round=max_start_round,
                        use_v8=use_v8) for i in range(n_envs)]
    env = DummyVecEnv(env_fns)
    if frame_stack > 1:
        env = VecFrameStack(env, n_stack=frame_stack)

    if resume:
        print(f"Resuming from {resume}")
        model = PPO.load(resume, env=env, tensorboard_log=str(TB_LOG_DIR))
    else:
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            gamma=0.999,
            ent_coef=0.01,
            verbose=1,
            tensorboard_log=str(TB_LOG_DIR),
            policy_kwargs=dict(net_arch=[256, 256]),
        )

    # Save a checkpoint every save_freq steps (per-env, so actual = save_freq * n_envs)
    checkpoint_cb = CheckpointCallback(
        save_freq=max(save_freq // n_envs, 1),
        save_path=str(MODELS_DIR),
        name_prefix="checkpoint",
        verbose=1,
    )

    stats_cb = StatsWriterCallback()

    print(f"Training PPO for {total_timesteps:,} steps (checkpoints every {save_freq:,})...")
    model.learn(total_timesteps=total_timesteps, callback=[checkpoint_cb, stats_cb],
                reset_num_timesteps=resume is None)

    save_path = MODELS_DIR / "eggthony_ppo"
    model.save(str(save_path))
    print(f"Model saved to {save_path}")

    env.close()


def evaluate(model_path: str | None = None, episodes: int = 5, frame_skip: int = 4,
             frame_stack: int = 4):
    if model_path is None:
        model_path = str(MODELS_DIR / "eggthony_ppo")

    model = PPO.load(model_path)

    from stable_baselines3.common.vec_env import DummyVecEnv, VecFrameStack
    env = DummyVecEnv([make_env(seed=0, frame_skip=frame_skip)])
    if frame_stack > 1:
        env = VecFrameStack(env, n_stack=frame_stack)

    for ep in range(episodes):
        obs = env.reset()
        total_reward = 0.0
        steps = 0
        done = False

        while not done:
            action, _ = model.predict(obs, deterministic=False)
            obs, reward, done_arr, info_arr = env.step(action)
            total_reward += reward[0]
            done = done_arr[0]
            steps += 1
        info = info_arr[0]

        print(f"Episode {ep + 1}: steps={steps}, reward={total_reward:.1f}, "
              f"score={info.get('score', '?')}, round={info.get('round', '?')}")

    env.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train/evaluate Eggthony RL agent")
    parser.add_argument("mode", choices=["train", "eval"], default="train", nargs="?")
    parser.add_argument("--timesteps", type=int, default=500_000)
    parser.add_argument("--envs", type=int, default=1)
    parser.add_argument("--frame-skip", type=int, default=4)
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--episodes", type=int, default=5)
    parser.add_argument("--max-start-round", type=int, default=1,
                        help="Curriculum: randomly start episodes at round 1..N")
    parser.add_argument("--frame-stack", type=int, default=4,
                        help="Number of frames to stack (1 = no stacking)")
    parser.add_argument("--resume", type=str, default=None,
                        help="Path to model to resume training from")
    parser.add_argument("--save-freq", type=int, default=500_000,
                        help="Save a checkpoint every N steps")
    parser.add_argument("--v8", action="store_true",
                        help="Use embedded V8 engine instead of Node subprocess")
    args = parser.parse_args()

    if args.mode == "train":
        train(total_timesteps=args.timesteps, n_envs=args.envs,
              frame_skip=args.frame_skip, frame_stack=args.frame_stack,
              max_start_round=args.max_start_round,
              resume=args.resume, save_freq=args.save_freq,
              use_v8=args.v8)
    else:
        evaluate(model_path=args.model, episodes=args.episodes,
                 frame_skip=args.frame_skip, frame_stack=args.frame_stack)
