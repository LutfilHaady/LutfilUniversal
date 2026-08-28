"""Compare rule-based agent vs trained PPO model over N episodes.

Usage (from repo root on GCP Workbench):
    python ae/train/evaluate.py --model ae/models/ae_policy.zip --episodes 20

To evaluate a specific checkpoint instead of the final model:
    python ae/train/evaluate.py --model ae/models/ae_ckpt_3500000_steps.zip --episodes 20
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

import numpy as np
from til_environment.bomberman_env import Bomberman
from ae_manager import AEManager, preprocess_obs

CONTROLLED = "agent_0"
STAY = 4


def _random_action(obs_dict: dict) -> int:
    raw_mask = obs_dict.get("action_mask", [1] * 6)
    valid = [i for i, v in enumerate(raw_mask) if v]
    return int(np.random.choice(valid)) if valid else STAY


def run_rule_based(n_episodes: int) -> list[float]:
    rewards = []
    for ep in range(n_episodes):
        env = Bomberman()
        env.reset(seed=ep)
        mgr = AEManager()
        ep_reward = 0.0
        for agent in env.agent_iter():
            obs_dict, reward, term, trunc, _ = env.last()
            if agent == CONTROLLED:
                ep_reward += reward
            if term or trunc:
                env.step(None)
                continue
            action = mgr.ae(obs_dict) if agent == CONTROLLED else _random_action(obs_dict)
            env.step(action)
        env.close()
        rewards.append(ep_reward)
        print(f"[rule-based] ep {ep + 1:2d}/{n_episodes}  reward={ep_reward:7.1f}")
    return rewards


def run_ppo(model_path: str, n_episodes: int) -> list[float]:
    from sb3_contrib import MaskablePPO
    model = MaskablePPO.load(model_path)
    rewards = []
    for ep in range(n_episodes):
        env = Bomberman()
        env.reset(seed=ep)
        ep_reward = 0.0
        for agent in env.agent_iter():
            obs_dict, reward, term, trunc, _ = env.last()
            if agent == CONTROLLED:
                ep_reward += reward
            if term or trunc:
                env.step(None)
                continue
            if agent == CONTROLLED:
                obs_vec = preprocess_obs(obs_dict)
                mask    = np.array(obs_dict.get("action_mask", [1] * 6), dtype=bool)
                action, _ = model.predict(obs_vec, action_masks=mask, deterministic=True)
                action = int(action)
            else:
                action = _random_action(obs_dict)
            env.step(action)
        env.close()
        rewards.append(ep_reward)
        print(f"[ppo]        ep {ep + 1:2d}/{n_episodes}  reward={ep_reward:7.1f}")
    return rewards


def main():
    parser = argparse.ArgumentParser(description="Compare rule-based vs PPO agent.")
    parser.add_argument("--model",    required=True, help="Path to .zip model file")
    parser.add_argument("--episodes", type=int, default=20, help="Episodes per agent")
    args = parser.parse_args()

    print("=== Rule-based agent ===")
    rb_rewards = run_rule_based(args.episodes)
    rb_mean, rb_std = np.mean(rb_rewards), np.std(rb_rewards)
    print(f"Mean: {rb_mean:.2f}  Std: {rb_std:.2f}\n")

    print("=== PPO model ===")
    ppo_rewards = run_ppo(args.model, args.episodes)
    ppo_mean, ppo_std = np.mean(ppo_rewards), np.std(ppo_rewards)
    print(f"Mean: {ppo_mean:.2f}  Std: {ppo_std:.2f}\n")

    margin = (ppo_mean - rb_mean) / (abs(rb_mean) + 1e-8) * 100

    print("=== Verdict ===")
    print(f"Rule-based mean reward : {rb_mean:8.2f}")
    print(f"PPO mean reward        : {ppo_mean:8.2f}")
    print(f"PPO improvement        : {margin:+.1f}%")

    if margin > 10:
        print("\n→ PPO wins by >10%. Update ae_manager.py to load PPO model and resubmit.")
    elif margin > 0:
        print("\n→ PPO is slightly better but within noise. Consider training longer.")
    else:
        print("\n→ PPO did not beat rule-based. Keep rule-based or tune reward shaping.")


if __name__ == "__main__":
    main()
