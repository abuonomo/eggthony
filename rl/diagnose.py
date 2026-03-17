"""Diagnose what an RL agent has actually learned.

Tests specific skills by measuring behavior in controlled episodes.

Usage:
    uv run python rl/diagnose.py --model rl/models/checkpoint_12000000_steps.zip
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from eggthony_env import EggthonyEnv, _flatten_obs, ACTION_TABLE, OBS_DIM

# Action categories for analysis
MOVE_LEFT = {1, 4, 7, 10, 14, 17}
MOVE_RIGHT = {2, 5, 8, 11, 15, 18}
SHOOT = {6, 7, 8, 9, 10, 11, 13}
JUMP = {3, 4, 5, 9, 10, 11, 19}
SNOT = {16, 17, 18, 19}
IDLE = {0}
DOWN = {12, 13, 14, 15}


def load_model(path):
    from stable_baselines3 import PPO
    return PPO.load(str(path))


def run_episodes(model, n_episodes=20, frame_skip=4, max_start_round=1,
                 seed_base=9999, frame_stack=4):
    """Run episodes and collect detailed per-step data."""
    env = EggthonyEnv(frame_skip=frame_skip, seed=seed_base,
                      max_start_round=max_start_round)
    episodes = []

    frame_buf = collections.deque(
        [np.zeros(OBS_DIM, dtype=np.float32)] * frame_stack,
        maxlen=frame_stack,
    )

    for ep in range(n_episodes):
        obs_raw, info = env.reset()
        frame_buf.clear()
        for _ in range(frame_stack):
            frame_buf.append(np.zeros(OBS_DIM, dtype=np.float32))
        frame_buf.append(obs_raw)
        obs_stacked = np.concatenate(list(frame_buf))

        steps = []
        done = False
        while not done:
            if model is not None:
                action, _ = model.predict(obs_stacked, deterministic=False)
                action = int(action)
            else:
                action = np.random.randint(len(ACTION_TABLE))

            obs_raw, reward, done, trunc, step_info = env.step(action)
            frame_buf.append(obs_raw)
            obs_stacked = np.concatenate(list(frame_buf))

            steps.append({
                "action": action,
                "reward": reward,
                "obs": obs_raw,  # flattened 150-dim
            })

        episodes.append({
            "start_round": info.get("start_round", 1),
            "steps": steps,
            "final_round": step_info.get("round", 1),
            "final_score": step_info.get("score", 0),
            "length": len(steps),
        })

    env.close()
    return episodes


def analyze_actions(episodes):
    """What actions does the agent prefer?"""
    action_counts = collections.Counter()
    total = 0
    for ep in episodes:
        for s in ep["steps"]:
            action_counts[s["action"]] += 1
            total += 1

    print("\n=== ACTION DISTRIBUTION ===")
    for a in range(len(ACTION_TABLE)):
        pct = action_counts[a] / total * 100 if total > 0 else 0
        desc = _action_name(a)
        bar = "#" * int(pct * 2)
        print(f"  {a:2d} {desc:25s} {pct:5.1f}% {bar}")

    # Category breakdown
    cats = {
        "shoot": sum(action_counts[a] for a in SHOOT),
        "move_left": sum(action_counts[a] for a in MOVE_LEFT),
        "move_right": sum(action_counts[a] for a in MOVE_RIGHT),
        "jump": sum(action_counts[a] for a in JUMP),
        "snot": sum(action_counts[a] for a in SNOT),
        "idle": sum(action_counts[a] for a in IDLE),
        "down": sum(action_counts[a] for a in DOWN),
    }
    print("\n  Category breakdown:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {cat:12s} {count/total*100:5.1f}%")


def analyze_shooting(episodes):
    """Does the agent shoot more when enemies are present?"""
    shoot_with_enemies = 0
    shoot_without_enemies = 0
    total_with = 0
    total_without = 0

    for ep in episodes:
        for s in ep["steps"]:
            obs = s["obs"]
            # Check if any enemy slot is occupied (enemy x > 0)
            has_enemies = any(obs[16 + i * 8] > 0 for i in range(10))
            is_shooting = s["action"] in SHOOT
            if has_enemies:
                total_with += 1
                if is_shooting:
                    shoot_with_enemies += 1
            else:
                total_without += 1
                if is_shooting:
                    shoot_without_enemies += 1

    pct_with = shoot_with_enemies / total_with * 100 if total_with > 0 else 0
    pct_without = shoot_without_enemies / total_without * 100 if total_without > 0 else 0

    print("\n=== SHOOTING SKILL ===")
    print(f"  Shoots when enemies present:  {pct_with:.1f}% ({total_with} frames)")
    print(f"  Shoots when NO enemies:       {pct_without:.1f}% ({total_without} frames)")
    if pct_with > pct_without + 5:
        print("  --> LEARNED: shoots more when enemies are around")
    else:
        print("  --> NOT LEARNED: doesn't discriminate")


def analyze_powerup_seeking(episodes):
    """Does the agent move toward powerups when they spawn?"""
    moved_toward = 0
    moved_away = 0
    total_powerup_frames = 0

    for ep in episodes:
        for i, s in enumerate(ep["steps"][:-1]):
            obs = s["obs"]
            next_obs = ep["steps"][i + 1]["obs"]
            player_x = obs[0] * 480

            # Check each powerup slot
            for p in range(4):
                pu_x = obs[96 + p * 2] * 480  # powerup x
                if pu_x > 0:  # powerup exists
                    next_player_x = next_obs[0] * 480
                    dist_before = abs(player_x - pu_x)
                    dist_after = abs(next_player_x - pu_x)
                    total_powerup_frames += 1
                    if dist_after < dist_before:
                        moved_toward += 1
                    elif dist_after > dist_before:
                        moved_away += 1

    pct_toward = moved_toward / total_powerup_frames * 100 if total_powerup_frames > 0 else 0
    pct_away = moved_away / total_powerup_frames * 100 if total_powerup_frames > 0 else 0

    print("\n=== POWERUP SEEKING ===")
    print(f"  Frames with powerup visible: {total_powerup_frames}")
    print(f"  Moved toward powerup: {pct_toward:.1f}%")
    print(f"  Moved away from powerup: {pct_away:.1f}%")
    if pct_toward > pct_away + 5:
        print("  --> LEARNED: seeks powerups")
    elif abs(pct_toward - pct_away) <= 5:
        print("  --> NOT LEARNED: random movement relative to powerups")
    else:
        print("  --> ANTI-LEARNED: avoids powerups?!")


def analyze_damage_avoidance(episodes):
    """Does the agent move more when taking damage?"""
    move_after_hit = 0
    move_normal = 0
    total_hit_frames = 0
    total_normal_frames = 0

    for ep in episodes:
        for i, s in enumerate(ep["steps"][:-1]):
            obs = s["obs"]
            next_obs = ep["steps"][i + 1]["obs"]
            hp_now = obs[4]  # hp / 100
            hp_next = next_obs[4]
            is_moving = s["action"] not in IDLE
            took_damage = hp_next < hp_now - 0.001

            if took_damage:
                total_hit_frames += 1
                # Check if agent moves MORE in the frames after damage
                for j in range(i + 1, min(i + 10, len(ep["steps"]))):
                    if ep["steps"][j]["action"] not in IDLE:
                        move_after_hit += 1
                        break
            else:
                total_normal_frames += 1
                if is_moving:
                    move_normal += 1

    pct_move_after = move_after_hit / total_hit_frames * 100 if total_hit_frames > 0 else 0
    pct_move_normal = move_normal / total_normal_frames * 100 if total_normal_frames > 0 else 0

    print("\n=== DAMAGE RESPONSE ===")
    print(f"  Moves after taking damage: {pct_move_after:.1f}% ({total_hit_frames} hits)")
    print(f"  Moves normally:            {pct_move_normal:.1f}%")
    if pct_move_after > pct_move_normal + 5:
        print("  --> LEARNED: reacts to damage by moving")
    else:
        print("  --> NOT LEARNED: same movement regardless of damage")


def analyze_platform_usage(episodes):
    """Does the agent jump toward platforms?"""
    jumps_near_platform = 0
    jumps_no_platform = 0
    total_near = 0
    total_far = 0

    for ep in episodes:
        for s in ep["steps"]:
            obs = s["obs"]
            player_x = obs[0] * 480
            player_y = obs[1] * 854
            is_jumping = s["action"] in JUMP

            # Check platform slots
            has_nearby_platform = False
            for p in range(2):
                px = obs[141 + p * 3] * 480
                py = obs[142 + p * 3] * 854
                solid = obs[143 + p * 3]
                if px > 0 and solid > 0.5:
                    dist = ((player_x - px)**2 + (player_y - py)**2)**0.5
                    if dist < 150:
                        has_nearby_platform = True

            if has_nearby_platform:
                total_near += 1
                if is_jumping:
                    jumps_near_platform += 1
            else:
                total_far += 1
                if is_jumping:
                    jumps_no_platform += 1

    pct_near = jumps_near_platform / total_near * 100 if total_near > 0 else 0
    pct_far = jumps_no_platform / total_far * 100 if total_far > 0 else 0

    print("\n=== PLATFORM USAGE ===")
    print(f"  Jumps when platform nearby: {pct_near:.1f}% ({total_near} frames)")
    print(f"  Jumps when no platform:     {pct_far:.1f}% ({total_far} frames)")
    if pct_near > pct_far + 5:
        print("  --> LEARNED: jumps more near platforms")
    else:
        print("  --> NOT LEARNED: doesn't seek platforms")


def analyze_snot_usage(episodes):
    """Does the agent use snot rocket at all?"""
    snot_actions = 0
    total = 0
    snot_when_ready = 0
    total_ready = 0

    for ep in episodes:
        for s in ep["steps"]:
            obs = s["obs"]
            total += 1
            is_snot = s["action"] in SNOT
            if is_snot:
                snot_actions += 1
            # Check if snot is off cooldown
            snot_cd = obs[9]  # snotCooldown / 8
            if snot_cd < 0.01:
                total_ready += 1
                if is_snot:
                    snot_when_ready += 1

    pct_total = snot_actions / total * 100 if total > 0 else 0
    pct_ready = snot_when_ready / total_ready * 100 if total_ready > 0 else 0

    print("\n=== SNOT ROCKET ===")
    print(f"  Overall snot usage: {pct_total:.1f}%")
    print(f"  Uses snot when off cooldown: {pct_ready:.1f}% ({total_ready} ready frames)")
    if pct_ready > 5:
        print("  --> LEARNED: uses snot rocket intentionally")
    else:
        print("  --> NOT LEARNED: rarely/never uses snot")


def analyze_survival(episodes):
    """Basic survival stats."""
    lengths = [ep["length"] for ep in episodes]
    scores = [ep["final_score"] for ep in episodes]
    rounds_reached = [ep["final_round"] for ep in episodes]

    print("\n=== SURVIVAL ===")
    print(f"  Episodes: {len(episodes)}")
    print(f"  Avg length:  {np.mean(lengths):.0f} steps (min={min(lengths)}, max={max(lengths)})")
    print(f"  Avg score:   {np.mean(scores):.0f}")
    print(f"  Avg round:   {np.mean(rounds_reached):.1f}")
    print(f"  Round distribution: {dict(collections.Counter(rounds_reached))}")


def compare_to_random(model, n_episodes=20, frame_skip=4, max_start_round=1):
    """Compare model to random baseline."""
    print("\n=== VS RANDOM BASELINE ===")
    model_eps = run_episodes(model, n_episodes, frame_skip, max_start_round)
    random_eps = run_episodes(None, n_episodes, frame_skip, max_start_round)

    model_len = np.mean([e["length"] for e in model_eps])
    random_len = np.mean([e["length"] for e in random_eps])
    model_score = np.mean([e["final_score"] for e in model_eps])
    random_score = np.mean([e["final_score"] for e in random_eps])
    model_round = np.mean([e["final_round"] for e in model_eps])
    random_round = np.mean([e["final_round"] for e in random_eps])

    print(f"  {'':20s} {'Model':>10s} {'Random':>10s} {'Ratio':>8s}")
    print(f"  {'Avg episode length':20s} {model_len:10.0f} {random_len:10.0f} {model_len/random_len:8.1f}x")
    print(f"  {'Avg score':20s} {model_score:10.0f} {random_score:10.0f} {model_score/random_score if random_score else float('inf'):8.1f}x")
    print(f"  {'Avg round reached':20s} {model_round:10.1f} {random_round:10.1f} {model_round/random_round:8.1f}x")


def _action_name(a):
    names = [
        "idle", "left", "right", "jump", "left+jump", "right+jump",
        "shoot", "left+shoot", "right+shoot", "jump+shoot",
        "left+jump+shoot", "right+jump+shoot",
        "down", "down+shoot", "left+down", "right+down",
        "snot", "left+snot", "right+snot", "jump+snot",
    ]
    return names[a] if a < len(names) else f"action_{a}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diagnose RL agent skills")
    parser.add_argument("--model", type=str, required=True, help="Path to model")
    parser.add_argument("--episodes", type=int, default=30)
    parser.add_argument("--max-start-round", type=int, default=1,
                        help="Start round for eval (1 = easy, test basic skills)")
    args = parser.parse_args()

    print(f"Loading model: {args.model}")
    model = load_model(args.model)

    print(f"Running {args.episodes} episodes (start round ≤{args.max_start_round})...")
    episodes = run_episodes(model, args.episodes, max_start_round=args.max_start_round)

    analyze_survival(episodes)
    analyze_actions(episodes)
    analyze_shooting(episodes)
    analyze_powerup_seeking(episodes)
    analyze_damage_avoidance(episodes)
    analyze_platform_usage(episodes)
    analyze_snot_usage(episodes)
    compare_to_random(model, n_episodes=args.episodes,
                      max_start_round=args.max_start_round)

    print("\n=== DONE ===")
