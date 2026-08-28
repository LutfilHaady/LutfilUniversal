"""Resume MaskablePPO training from the last saved checkpoint.

Run from the repo root on GCP Workbench:
    python ae/train/train_resume.py

Hyperparameter changes vs original run:
    gamma    0.99  → 0.995  tiles can be 50-100 steps away; higher gamma gives
                             better long-term credit assignment
    ent_coef 0.02  → 0.05   policy was collapsing too fast; more entropy forces
                             exploration needed to discover tile locations
    n_epochs 4     → 6      KL was only 0.002 (well below target_kl=0.02);
                             safe to extract more learning per rollout
    n_steps  2048  → 4096   covers ~20 full episodes per env per update (was 10)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv, VecMonitor
from stable_baselines3.common.callbacks import CheckpointCallback, EvalCallback
from sb3_contrib import MaskablePPO
from env_wrapper import AETrainEnv

MODELS_DIR   = os.path.join(os.path.dirname(__file__), "..", "models")
CKPT_PATH    = os.path.join(MODELS_DIR, "ae_ckpt_2000000_steps.zip")
N_ENVS       = 8
SAVE_FREQ    = 500_000
REMAIN_STEPS = 3_000_000   # 5M total - 2M already done

# Updated hyperparameters — overrides whatever was saved in the checkpoint
NEW_HYPERPARAMS = dict(
    learning_rate = 1e-4,
    n_steps       = 4096,   # increased from 2048
    batch_size    = 256,
    n_epochs      = 6,      # increased from 4
    gamma         = 0.995,  # increased from 0.99
    gae_lambda    = 0.95,
    clip_range    = 0.1,
    ent_coef      = 0.05,   # increased from 0.02
    target_kl     = 0.02,
)


def make_env(rank: int):
    def _init():
        return AETrainEnv()
    return _init


if __name__ == "__main__":
    print(f"Resuming from {CKPT_PATH} ...")
    print("New hyperparameters:", NEW_HYPERPARAMS)

    vec_env = SubprocVecEnv([make_env(i) for i in range(N_ENVS)])
    vec_env = VecMonitor(vec_env)

    # custom_objects overrides the saved hyperparameters in the checkpoint
    model = MaskablePPO.load(CKPT_PATH, env=vec_env, custom_objects=NEW_HYPERPARAMS)
    print("Checkpoint loaded with updated hyperparameters.")

    checkpoint_cb = CheckpointCallback(
        save_freq=max(1, SAVE_FREQ // N_ENVS),
        save_path=MODELS_DIR,
        name_prefix="ae_ckpt",
    )

    eval_env = DummyVecEnv([make_env(99)])
    eval_env = VecMonitor(eval_env)
    eval_cb = EvalCallback(
        eval_env,
        eval_freq=max(1, 50_000 // N_ENVS),
        n_eval_episodes=5,
        deterministic=True,
        verbose=1,
    )

    model.learn(
        total_timesteps=REMAIN_STEPS,
        callback=[checkpoint_cb, eval_cb],
        progress_bar=True,
        reset_num_timesteps=False,
    )

    final_path = os.path.join(MODELS_DIR, "ae_policy")
    model.save(final_path)
    print(f"\nSaved final model to {final_path}.zip")

    vec_env.close()
    eval_env.close()
