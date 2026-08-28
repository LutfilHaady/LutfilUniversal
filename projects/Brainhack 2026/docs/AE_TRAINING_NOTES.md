# AE Challenge — Training Notes & Environment Reference

> Living document. Update after each training run.

---

## Environment: Bomberman (til_environment)

### Game Overview
6-agent Bomberman-style game. We control `agent_0`. All other agents take random valid actions during training. Episodes are **200 steps** (always truncated, never terminated early in our setup so far).

### Action Space (6 discrete)
| Index | Action |
|-------|--------|
| 0 | FORWARD |
| 1 | BACKWARD |
| 2 | LEFT |
| 3 | RIGHT |
| 4 | STAY |
| 5 | PLACE_BOMB |

### Observation Space (892-dim flat float32 vector)
| Component | Dims | Notes |
|-----------|------|-------|
| agent_viewcone | 875 | 7×5×25 channels, flattened |
| base_summary | 3 | max enemy agent/bomb/timer near ally base |
| direction | 4 | one-hot |
| location | 2 | /15 normalized |
| base_location | 2 | /15 normalized |
| health | 1 | /60 |
| frozen_ticks | 1 | /3 |
| base_health | 1 | /100 |
| team_resources | 1 | /1.5 |
| team_bombs | 1 | /50 |
| step | 1 | /200 |

### Viewcone Channel Indices (7×5×25)
```python
VISIBLE = 0
WALL_RIGHT, WALL_DOWN, WALL_LEFT, WALL_UP = 1, 2, 3, 4
TILE_EMPTY, TILE_RECON, TILE_MISSION, TILE_RESOURCE = 5, 6, 7, 8
ALLY_AGENT, ENEMY_AGENT = 9, 10
ALLY_BASE, ENEMY_BASE = 11, 12
ALLY_BOMB, ENEMY_BOMB = 17, 18
ALLY_BOMB_TIMER, ENEMY_BOMB_TIMER = 19, 20
```
Agent sits at **row 2, col 2** in the 7×5 viewcone.

### Game Reward Structure (raw, from environment)
- **Negative**: taking damage, dying, losing base health
- **Positive**: collecting MISSION/RESOURCE tiles, damaging enemy base, recon tile exploration
- **Zero**: most steps (sparse — agent rarely encounters scoring events)
- Scale: roughly in the range [-10, +10] per event (exact values unconfirmed)

Scoring formula used by competition evaluator:
```python
score = total_reward / NUM_ROUNDS / MAX_SCORE  # MAX_SCORE = 1000
```

---

## Training Setup

### Files
| File | Purpose |
|------|---------|
| `ae/train/train.py` | Fresh training run from scratch |
| `ae/train/train_resume.py` | Resume from a checkpoint |
| `ae/train/env_wrapper.py` | Gym wrapper + reward shaping |
| `ae/src/ae_manager.py` | Inference — auto-loads PPO if `ae_policy.zip` exists |

### Model Location
- Checkpoints: `ae/models/ae_ckpt_{N}_steps.zip`
- Final model loaded by server: `ae/models/ae_policy.zip`

### Auto-selection Logic (`ae_manager.py`)
```python
# If ae_policy.zip exists → PPO inference
# Otherwise → rule-based fallback agent
```

---

## Reward Shaping (current: env_wrapper.py)

```python
STEP_PENALTY       = -0.001   # every step
STATIONARY_PENALTY = -0.005   # extra if action == STAY
TILE_BONUS         = 0.01     # per visible MISSION/RESOURCE tile within dist 3
RECON_BONUS        = 0.003    # per visible RECON tile within dist 3
ENEMY_BASE_BONUS   = 0.015    # per visible ENEMY_BASE tile within dist 3
```

Shaping is applied on the **new observation** after stepping (dense signal pointing toward scoring tiles).

### What Curriculum Says About Reward Design
From `til-26-curriculum/slides/unit4_autonomous/novice/02_reward_shaping_basics.md`:

- **Sparse rewards** are clean but give near-zero gradient signal early in training
- **Dense rewards** guide faster but risk reward hacking
- Key pitfalls: double-rewarding, conflicting signals, scale mismatch, stationary optima
- **Count-based bonus**: `b(s) = 1/√N(s)` encourages novelty without hand-crafting
- **Coverage delta reward**: reward the *change* in coverage per step, not the absolute total
- **Frontier distance**: closer to unexplored boundary = higher reward
- Always check: *what does a stationary agent earn?* If positive → standing bias exists

---

## PPO Hyperparameters (current)

```python
MaskablePPO(
    policy="MlpPolicy",
    learning_rate=1e-4,      # reduced from 3e-4 (was causing clip_fraction=0.55)
    n_steps=2048,
    batch_size=256,
    n_epochs=4,              # reduced from 10
    gamma=0.99,
    gae_lambda=0.95,
    clip_range=0.1,          # reduced from 0.2
    ent_coef=0.02,           # slightly higher for exploration
    target_kl=0.02,          # stops epoch early if KL diverges
    policy_kwargs=dict(net_arch=[256, 256]),  # reduced from [512, 512, 256]
)
```

**Target healthy metrics:**
| Metric | Target | Bad sign |
|--------|--------|----------|
| `approx_kl` | <0.02 | >0.05 |
| `clip_fraction` | ~0.08-0.12 | >0.2 |
| `explained_variance` | >0.5, climbing | <0 |
| `ep_rew_mean` | improving | flat |
| `eval/mean_reward` | improving | stuck |

---

## Training History

### Run 1 (Broken — May 18)
- **Checkpoints**: `ae_ckpt_500k` to `ae_ckpt_3M` (May 18 dates)
- **Problem**: `REWARD_SCALE=50` divided all rewards by 50 → per-step signal = -0.0002
- **Symptoms**: `ep_rew_mean` stuck at exactly -0.04, `clip_fraction=0.55`, `approx_kl=0.35`
- **Result**: Model learned nothing. **DO NOT USE these checkpoints.**

### Run 2 (Fixed — May 19, cut short)
- **Script**: `train.py` with fixed params
- **Checkpoint saved**: `ae_ckpt_500000_steps.zip` (May 19)
- **Progress at cutoff**: `ep_rew_mean` improved from -0.406 → -0.214 over 573k steps
- **Cut**: GCP instance idle timeout
- **GPU**: Yes (417 fps)

### Run 3 (Resumed from 500k — May 20)
- **Script**: `train_resume.py` (from 500k checkpoint)
- **Log**: `train4.log` → `MaskablePPO_9` in TensorBoard
- **Progress at plateau**: `ep_rew_mean` reached -0.201, `eval/mean_reward` stuck at -0.2 from 500k–2.1M steps
- **Interpretation**: Agent learned to **survive** (no deaths = just step penalty) but never discovered scoring tiles
- **Cut**: GCP idle timeout at ~2.1M steps
- **Good checkpoint**: `ae_ckpt_2000000_steps.zip`

### Run 4 (Current — resuming from 2M with new reward shaping)
- **Script**: `train_resume.py` (from 2M checkpoint)
- **Log**: `train5.log`
- **Change**: Added `TILE_BONUS`, `RECON_BONUS`, `ENEMY_BASE_BONUS` to `env_wrapper.py`
- **Expected**: `ep_rew_mean` should break above -0.2 as agent seeks tiles
- **Watch for**: `eval/mean_reward` > -0.2 = agent is scoring

---

## What to Watch in TensorBoard

**Most important:**
- `eval/mean_reward` — if > -0.2, agent is scoring. This is the real quality signal.

**Health checks:**
- `rollout/ep_rew_mean` — training reward (includes shaping noise)
- `train/approx_kl` — should stay <0.02
- `train/clip_fraction` — should stay <0.15
- `train/explained_variance` — should be >0.5 and climbing

**Red flags:**
- `eval/mean_reward` flat at -0.2 to 5M → need more/different reward shaping
- `approx_kl` spikes >0.05 → policy destabilizing
- `ep_rew_mean` going down → something wrong

---

## Submission Workflow

```bash
# 1. Copy best checkpoint
cp ae/models/ae_ckpt_XXXXX_steps.zip ae/models/ae_policy.zip

# 2. Build and test
til build ae
til test ae

# 3. Submit
til submit ae
```

**Scoring**: `score = rewards / NUM_ROUNDS / 1000` — first submission scored 0.000 (broken model).

---

## Key Pitfalls Learned

1. **REWARD_SCALE**: Dividing rewards by 50 killed all learning signal. Never scale rewards to be tiny.
2. **GCP idle timeout**: Always run training in `tmux` or with a keepalive loop:
   ```bash
   while true; do echo "keepalive $(date)"; sleep 60; done
   ```
3. **SubprocVecEnv requires `if __name__ == "__main__":`** guard — without it, multiprocessing forkserver crashes.
4. **`ep_rew_mean` ≠ `eval/mean_reward`**: Training reward is noisy (includes shaping + stochastic policy). Eval reward (deterministic, 5 episodes) is ground truth.
5. **Survival plateau**: Agent can get stuck learning to survive (-0.2) without discovering positive rewards. Fix: dense shaping toward tile locations.

---

## Next Steps If Still Plateaued After 5M Steps

From curriculum recommendations:
1. **Count-based exploration bonus**: `reward += 1/sqrt(N(s))` for first visit to each map tile
2. **Coverage delta reward**: track explored tiles per episode, reward the delta
3. **Curriculum**: train first against stationary opponents, then random, then stronger opponents
4. **Longer training**: 10M+ steps if compute allows
5. **Larger network or LSTM**: partial observability means memory could help
