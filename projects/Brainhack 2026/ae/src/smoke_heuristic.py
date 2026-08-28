"""smoke_heuristic.py — Local episode rollouts of the heuristic AE vs random opponents.

Run from repo root:
  python ae/src/smoke_heuristic.py [n_episodes]

Mirrors `til test` semantics: agent_0 = our agent, others = random. Reports per-episode
agent_0 reward + summary stats. NO Docker, NO GCP — sanity check before pushing to GCP.
"""

from __future__ import annotations

import os
import statistics
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ae_manager_heuristic import AEManager  # noqa: E402

from til_environment.bomberman_env import basic_env  # noqa: E402
from til_environment.config import default_config  # noqa: E402


PRIMARY_AGENT = "agent_0"


def make_env():
    cfg = default_config()
    cfg.env.novice = True
    return basic_env(cfg=cfg, env_wrappers=[])


def random_action(env, agent: str) -> int:
    """Match organizer's test_ae.py: full Discrete(6) sample, no mask filtering.
    Random opponents can attempt illegal moves; the env treats wall-collide,
    invalid-bomb, etc. as no-ops or rewardless events.
    """
    return int(env.action_space(agent).sample())


def run_episode(
    env, manager: AEManager, seed: int | None = None, debug: bool = False
) -> tuple[float, int, dict]:
    if seed is not None:
        env.reset(seed=seed)
        # PettingZoo env.reset(seed=) does NOT propagate to per-agent action_space
        # RNGs. Without this, opponent random actions are non-reproducible across
        # runs even with identical map seeds. Seed each agent's action space with
        # a deterministic offset so re-runs sample identical opponent sequences.
        for i, agent in enumerate(env.possible_agents):
            env.action_space(agent).seed(seed * 1000 + i)
    else:
        env.reset()
    primary_reward = 0.0
    ep_len = 0
    action_hist = [0] * 6
    visited: set[tuple[int, int]] = set()
    bases_seen_log = -1
    last_obs: dict | None = None
    for agent in env.agent_iter():
        obs, reward, terminated, truncated, info = env.last()
        if agent == PRIMARY_AGENT:
            primary_reward += float(reward)
            if terminated or truncated:
                action = None
            else:
                action = int(manager.ae(obs))
                action_hist[action] += 1
                loc = tuple(int(x) for x in obs["location"])
                visited.add(loc)
                ep_len += 1
                last_obs = obs
                if debug and len(manager._enemy_bases) > bases_seen_log:
                    bases_seen_log = len(manager._enemy_bases)
                    print(f"    [t={ep_len:>3} loc={loc} dir={int(obs['direction'])} "
                          f"reward={primary_reward:+.1f}] bases_known={sorted(manager._enemy_bases)}")
        else:
            if terminated or truncated:
                action = None
            else:
                action = random_action(env, agent)
        env.step(action)
    info = {
        "action_hist": action_hist,
        "tiles_visited": len(visited),
        "bases_known_end": len(manager._enemy_bases),
        "missions_seen_end": len(manager._compass.seen_mission),
        "resources_seen_end": len(manager._compass.seen_resource),
        "recons_seen_end": len(manager._compass.seen_recon),
        "static_missions": len(manager._compass.static_missions),
        "static_resources": len(manager._compass.static_resources),
        "static_recons": len(manager._compass.static_recons),
        "known_free": len(manager._known_tiles),
        "known_wall_edges": len(manager._wall_edges),
    }
    return primary_reward, ep_len, info


def main():
    n_episodes = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    debug_first = "--debug" in sys.argv
    # Episode N uses seed = base_seed + N so re-runs are identical. Lets us A/B
    # parameter tweaks on the same opponent action sequences + spawn layouts.
    base_seed = 1000

    print("=" * 64)
    print(f"  Heuristic AE smoke - {n_episodes} episodes (agent_0 vs Discrete(6) random)")
    print("  (Matches test_ae.py: 6 rounds per match -> board score = sum / 6 / 1000)")
    print("=" * 64)
    print()

    env = make_env()
    manager = AEManager()

    rewards: list[float] = []
    lengths: list[int] = []
    last_info: dict = {}
    t0 = time.time()
    for ep in range(1, n_episodes + 1):
        debug = debug_first and ep == 1
        r, n, info = run_episode(env, manager, seed=base_seed + ep, debug=debug)
        rewards.append(r)
        lengths.append(n)
        last_info = info
        score = r / 1 / 1000
        hist = info["action_hist"]
        print(
            f"  Episode {ep:>3}: reward={r:>+8.2f}  len={n:>4}  score~{score:>+7.4f}  "
            f"tiles={info['tiles_visited']:>3}  "
            f"acts=F{hist[0]} B{hist[1]} L{hist[2]} R{hist[3]} S{hist[4]} bomb{hist[5]}  "
            f"bases={info['bases_known_end']} miss={info['missions_seen_end']}/"
            f"{info['static_missions']} res={info['resources_seen_end']}/"
            f"{info['static_resources']} rec={info['recons_seen_end']}/"
            f"{info['static_recons']}"
        )
    elapsed = time.time() - t0
    env.close()

    # Board-equivalent score: 6 consecutive rounds counted, summed, /6/1000.
    # If we ran exactly 6 episodes, the average reward IS the board score.
    # If fewer, we still report mean/1000 as the per-round estimate.

    print()
    print("-" * 64)
    print(f"  Episodes: {len(rewards)}   Wall: {elapsed:.1f}s   "
          f"({elapsed/len(rewards):.1f}s/ep)")
    print(f"  Reward:  mean={statistics.mean(rewards):+.2f}   "
          f"median={statistics.median(rewards):+.2f}   "
          f"min={min(rewards):+.2f}   max={max(rewards):+.2f}   "
          f"std={statistics.pstdev(rewards):+.2f}")
    print(f"  Score:   mean={statistics.mean(rewards)/1/1000:+.4f}   "
          f"median={statistics.median(rewards)/1/1000:+.4f}   "
          f"max={max(rewards)/1/1000:+.4f}")
    print(f"  Positive episodes: {sum(1 for r in rewards if r > 0)}/{len(rewards)}")
    if last_info:
        print(f"  Last ep map: known_tiles={last_info['known_free']:>4} "
              f"wall_edges={last_info['known_wall_edges']:>4} "
              f"tiles_visited={last_info['tiles_visited']:>3}/256")
    print("-" * 64)
    print()
    print("Baselines to beat (10x til test, board score):")
    print("  Classical (existing):  local mean -0.085")
    print("  PPO_5:                 local +0.04 to +0.11   board 0.003")
    print("  PPO_6:                 local mean +0.064      board 0.000")
    print("  PPO_7 (DEAD):          local mean -0.025      not submitted")
    print()


if __name__ == "__main__":
    main()
