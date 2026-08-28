"""Evaluate all ae_ckpt_*.zip checkpoints locally and rank them.

Run from the repo root on GCP Workbench:
    python ae/eval_checkpoints.py

Requirements: sb3-contrib, til_environment (from til-26-ae submodule)
"""

import glob
import os
import sys

import numpy as np
from sb3_contrib import MaskablePPO
from til_environment import bomberman_env
from til_environment.config import default_config
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Import observation preprocessor from ae_manager
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from ae_manager import preprocess_obs

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()
TEAM_TRACK = os.getenv("TEAM_TRACK", "open")
NUM_ROUNDS = 6
MAX_SCORE = 1000
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


def evaluate(model, novice: bool, num_rounds: int = NUM_ROUNDS) -> float:
    config = default_config()
    config.env.novice = novice
    env = bomberman_env.basic_env(env_wrappers=[], cfg=config)
    controlled = env.possible_agents[0]
    total_reward = 0.0

    for _ in range(num_rounds):
        env.reset()
        for agent in env.agent_iter(max_iter=1200):
            observation, reward, termination, truncation, info = env.last()
            total_reward += env.rewards[controlled]

            if termination or truncation:
                action = None
            elif agent == controlled:
                obs_vec = preprocess_obs({
                    k: v if type(v) in (int, float) else v.tolist()
                    for k, v in observation.items()
                })
                mask = np.array(observation["action_mask"], dtype=bool)
                action, _ = model.predict(obs_vec, action_masks=mask, deterministic=True)
                action = int(action)
            else:
                action = env.action_space(agent).sample()
            env.step(action)

    env.close()
    return total_reward / num_rounds / MAX_SCORE


def main():
    novice = TEAM_TRACK == "novice"
    checkpoints = sorted(glob.glob(os.path.join(MODELS_DIR, "ae_ckpt_*.zip")))

    if not checkpoints:
        print(f"No checkpoints found in {MODELS_DIR}")
        sys.exit(1)

    print(f"Found {len(checkpoints)} checkpoints. Evaluating {NUM_ROUNDS} rounds each...\n")
    results = []

    for ckpt in checkpoints:
        name = os.path.basename(ckpt)
        print(f"  Loading {name}...")
        model = MaskablePPO.load(ckpt)
        score = evaluate(model, novice)
        results.append((score, name))
        print(f"  {name}: {score:.4f}")

    results.sort(reverse=True)
    print("\n=== Ranking ===")
    for rank, (score, name) in enumerate(results, 1):
        print(f"  {rank}. {name}: {score:.4f}")

    best_name = results[0][1]
    best_path = os.path.join(MODELS_DIR, best_name)
    dest_path = os.path.join(MODELS_DIR, "ae_policy.zip")
    print(f"\nBest checkpoint: {best_name}")
    print(f"To use it, run:\n  cp {best_path} {dest_path}")


if __name__ == "__main__":
    main()
