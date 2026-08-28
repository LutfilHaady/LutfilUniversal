"""Train a MaskablePPO policy for the AE challenge.

Run from the repo root on GCP Workbench:

    # Always run smoke test first to validate pipeline (~2 minutes):
    python ae/train/train.py --steps 10000

    # Full training run (~4-6 hours on GPU):
    python ae/train/train.py

Checkpoints saved to ae/models/ every 500k steps.
Final model saved to ae/models/ae_policy.zip.

Common failure modes and fixes:
    CUDA out of memory  → reduce N_ENVS (try 4 instead of 8)
    NaN in policy loss  → reduce learning_rate to 1e-4
    Env hangs / no step → add print() inside _advance_to_controlled in env_wrapper.py
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv, VecMonitor
from stable_baselines3.common.callbacks import CheckpointCallback, EvalCallback
from sb3_contrib import MaskablePPO
from env_wrapper import AETrainEnv

MODELS_DIR    = os.path.join(os.path.dirname(__file__), "..", "models")
N_ENVS        = 8           # reduce to 4 if OOM
DEFAULT_STEPS = 5_000_000   # ~4-6 hours on GPU
SAVE_FREQ     = 500_000     # checkpoint every N steps

os.makedirs(MODELS_DIR, exist_ok=True)


def make_env(rank: int):
    def _init():
        return AETrainEnv()
    return _init


def main():
    parser = argparse.ArgumentParser(description="Train MaskablePPO for AE challenge.")
    parser.add_argument(
        "--steps", type=int, default=DEFAULT_STEPS,
        help="Total training steps (default 5M; use 10000 for smoke test)",
    )
    parser.add_argument(
        "--dummy", action="store_true",
        help="Use DummyVecEnv (single process, cleaner tracebacks) instead of SubprocVecEnv",
    )
    args = parser.parse_args()
    total_steps = args.steps

    print(f"Training MaskablePPO for {total_steps:,} steps with {N_ENVS} envs...")

    # DummyVecEnv: single process, easier debugging. SubprocVecEnv: faster training.
    # Use --dummy for smoke tests; remove it for the full overnight run.
    VecEnvCls = DummyVecEnv if args.dummy else SubprocVecEnv
    vec_env = VecEnvCls([make_env(i) for i in range(N_ENVS)])
    vec_env = VecMonitor(vec_env)  # logs episode reward / length automatically

    model = MaskablePPO(
        policy="MlpPolicy",
        env=vec_env,
        learning_rate=1e-4,     # reduced from 3e-4 — was causing clip_fraction=0.55
        n_steps=2048,
        batch_size=256,
        n_epochs=4,             # reduced from 10 — fewer passes per rollout
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.1,         # tighter clip — was 0.2, target clip_fraction ~0.1
        ent_coef=0.1,           # high entropy — fixed map causes premature convergence
        target_kl=0.05,         # relaxed from 0.02 — allow more policy change per update
        verbose=1,
        tensorboard_log=os.path.join(MODELS_DIR, "tb_logs"),
        policy_kwargs=dict(net_arch=[256, 256]),  # smaller net — 512x512x256 is overkill
    )

    checkpoint_cb = CheckpointCallback(
        save_freq=max(1, SAVE_FREQ // N_ENVS),  # per-env steps
        save_path=MODELS_DIR,
        name_prefix="ae_ckpt",
    )

    # EvalCallback: runs 5 episodes every 50k steps against a fresh env.
    # Logs eval/mean_reward to TensorBoard — this is the real quality signal.
    eval_env = DummyVecEnv([make_env(99)])
    eval_env = VecMonitor(eval_env)
    eval_cb = EvalCallback(
        eval_env,
        eval_freq=max(1, 50_000 // N_ENVS),   # every ~50k global steps
        n_eval_episodes=5,
        deterministic=True,
        verbose=1,
    )

    model.learn(
        total_timesteps=total_steps,
        callback=[checkpoint_cb, eval_cb],
        progress_bar=True,
    )

    final_path = os.path.join(MODELS_DIR, "ae_policy")
    model.save(final_path)
    print(f"\nSaved final model to {final_path}.zip")

    vec_env.close()
    eval_env.close()


if __name__ == "__main__":
    main()
