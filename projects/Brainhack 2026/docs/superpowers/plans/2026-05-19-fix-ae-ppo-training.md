# Fix AE PPO Training Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken PPO training where agent earned zero learning signal for 3M steps due to reward scaling bug and bad hyperparameters.

**Architecture:** Two files need changes — `env_wrapper.py` fixes the reward signal (root cause), `train.py` fixes hyperparameters to prevent policy thrashing. Changes are independent and can be verified separately before retraining.

**Tech Stack:** MaskablePPO (sb3-contrib), Stable-Baselines3, gymnasium, PettingZoo Bomberman

---

## Diagnosis Summary

- `ep_rew_mean = -0.04` for 200-step episodes = **-0.0002 per step**
- `STEP_PENALTY=-0.01` / `REWARD_SCALE=50` = -0.0002 ✓ — game gave **zero base reward every step**
- `clip_fraction=0.55` (should be ~0.1) — policy thrashing each update
- `approx_kl=0.35` (should be <0.02) — no `target_kl` to stop bad updates
- No `EvalCallback` — no way to see actual agent quality during training

---

## Files to Modify

- Modify: `ae/train/env_wrapper.py` — fix reward scaling and shaping constants
- Modify: `ae/train/train.py` — fix PPO hyperparameters, add EvalCallback

---

### Task 1: Fix Reward Scaling in env_wrapper.py

The `REWARD_SCALE=50` divides all rewards by 50, making them ~0.0002. PPO cannot learn from signals this small. Fix: set scale to 1.0 and tune penalties to be meaningful.

**File:** `ae/train/env_wrapper.py`

- [ ] **Step 1: Change the reward shaping constants**

Find this block (top of env_wrapper.py, ~line 30):
```python
# Reward shaping constants
STEP_PENALTY       = -0.01
STATIONARY_PENALTY = -0.02
REWARD_SCALE       = 50.0
```

Replace with:
```python
# Reward shaping constants
# REWARD_SCALE removed — game rewards are already in a reasonable range.
# Penalties are small negatives to discourage idling; game rewards dominate.
STEP_PENALTY       = -0.001   # tiny cost per step to discourage pure idling
STATIONARY_PENALTY = -0.005   # slightly stronger penalty for STAY action
```

- [ ] **Step 2: Update the _shape method to remove REWARD_SCALE**

Find this method (near bottom of env_wrapper.py):
```python
def _shape(self, base: float, action: int) -> float:
    shaped  = base
    shaped += STEP_PENALTY
    if action == STAY:
        shaped += STATIONARY_PENALTY
    return shaped / REWARD_SCALE
```

Replace with:
```python
def _shape(self, base: float, action: int) -> float:
    shaped  = base
    shaped += STEP_PENALTY
    if action == STAY:
        shaped += STATIONARY_PENALTY
    return shaped
```

- [ ] **Step 3: Verify the math on GCP Workbench**

Run the smoke test to confirm rewards are now non-trivial:
```bash
cd ~/lutfil
python - <<'EOF'
import sys
sys.path.insert(0, 'ae/train')
sys.path.insert(0, 'ae/src')
from env_wrapper import AETrainEnv
import numpy as np

env = AETrainEnv()
obs, _ = env.reset(seed=42)
print("obs shape:", obs.shape)  # expect (892,)

total_reward = 0
for i in range(200):
    mask = env.action_masks()
    valid = [j for j, v in enumerate(mask) if v]
    a = int(np.random.choice(valid))
    obs, r, term, trunc, _ = env.step(a)
    total_reward += r
    if term or trunc:
        break

print(f"Total episode reward (random agent): {total_reward:.4f}")
print(f"Per-step average: {total_reward/200:.4f}")
print("Expected: near 0 or slightly negative (not -0.04)")
env.close()
EOF
```

Expected output: total reward should be **not** exactly -0.04. If the game gives positive events (tile collection, base hits), you should see rewards above -0.2.

- [ ] **Step 4: Commit**
```bash
cd ~/lutfil
git add ae/train/env_wrapper.py
git commit -m "fix: remove REWARD_SCALE=50 that killed PPO learning signal"
```

---

### Task 2: Fix PPO Hyperparameters in train.py

`clip_fraction=0.55` means 55% of actions exceed the clip range — the policy is changing wildly each update. Fix: lower learning rate, fewer epochs per update, add `target_kl` to stop updates early when the policy drifts too far.

**File:** `ae/train/train.py`

- [ ] **Step 1: Update the MaskablePPO constructor**

Find this block in `main()`:
```python
model = MaskablePPO(
    policy="MlpPolicy",
    env=vec_env,
    learning_rate=3e-4,
    n_steps=2048,
    batch_size=256,
    n_epochs=10,
    gamma=0.99,
    gae_lambda=0.95,
    clip_range=0.2,
    ent_coef=0.01,          # entropy bonus keeps exploration alive
    verbose=1,
    tensorboard_log=os.path.join(MODELS_DIR, "tb_logs"),
    policy_kwargs=dict(net_arch=[512, 512, 256]),
)
```

Replace with:
```python
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
    ent_coef=0.02,          # slightly higher entropy to encourage exploration
    target_kl=0.02,         # stop epoch early if KL diverges — was missing
    verbose=1,
    tensorboard_log=os.path.join(MODELS_DIR, "tb_logs"),
    policy_kwargs=dict(net_arch=[256, 256]),  # smaller net — 512x512x256 is overkill
)
```

- [ ] **Step 2: Add EvalCallback for proper reward tracking**

Find the imports at the top of train.py:
```python
from stable_baselines3.common.callbacks import CheckpointCallback
```

Replace with:
```python
from stable_baselines3.common.callbacks import CheckpointCallback, EvalCallback
from stable_baselines3.common.vec_env import DummyVecEnv as EvalVecEnv
```

- [ ] **Step 3: Wire up EvalCallback in main()**

Find this block just before `model.learn(...)`:
```python
checkpoint_cb = CheckpointCallback(
    save_freq=max(1, SAVE_FREQ // N_ENVS),  # per-env steps
    save_path=MODELS_DIR,
    name_prefix="ae_ckpt",
)

model.learn(
    total_timesteps=total_steps,
    callback=[checkpoint_cb],
    progress_bar=True,
)
```

Replace with:
```python
checkpoint_cb = CheckpointCallback(
    save_freq=max(1, SAVE_FREQ // N_ENVS),  # per-env steps
    save_path=MODELS_DIR,
    name_prefix="ae_ckpt",
)

# EvalCallback: runs 5 episodes every 50k steps against a fresh env.
# Logs eval/mean_reward to TensorBoard — this is the real quality signal.
eval_env = EvalVecEnv([make_env(99)])
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
```

- [ ] **Step 4: Run smoke test to confirm no errors**

```bash
cd ~/lutfil
python ae/train/train.py --steps 10000 --dummy 2>&1 | tail -30
```

Expected: runs to completion, prints a table with `ep_rew_mean` that is NOT stuck at -0.04, no errors.

- [ ] **Step 5: Commit**
```bash
cd ~/lutfil
git add ae/train/train.py
git commit -m "fix: PPO hyperparams — lr 3e-4→1e-4, epochs 10→4, add target_kl and EvalCallback"
```

---

### Task 3: Retrain and Monitor

- [ ] **Step 1: Start training in background**
```bash
cd ~/lutfil
nohup python ae/train/train.py > ae/models/train2.log 2>&1 &
echo "PID: $!"
```
Save the PID printed so you can kill it if needed.

- [ ] **Step 2: Watch the first 500k steps in the log**
```bash
tail -f ~/lutfil/ae/models/train2.log
```

After ~500k steps, you should see:
- `ep_rew_mean` above -0.04 (even -0.01 is progress)
- `clip_fraction` below 0.2
- `approx_kl` below 0.05
- `eval/mean_reward` appearing in logs (from EvalCallback)

If `ep_rew_mean` is still exactly -0.04 after 500k steps → the game rewards are still 0. In that case the Bomberman base rewards might need investigation (the agent never reaches any tiles).

- [ ] **Step 3: After training, copy best checkpoint and submit**
```bash
cd ~/lutfil
cp ae/models/ae_ckpt_3000000_steps.zip ae/models/ae_policy.zip  # adjust step count
til build ae
til submit ae
```
