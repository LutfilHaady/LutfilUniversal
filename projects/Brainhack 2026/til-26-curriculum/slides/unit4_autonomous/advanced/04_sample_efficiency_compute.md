---
presentationID: 1tXJiQsL9huxIfOcjUjXOwBGRmcP6C01ywvI34gM097I
title: "\"Sample Efficiency and Compute Discipline\""
---

# Sample Efficiency and Compute Discipline

RL training can consume enormous amounts of compute.

---

## Why RL Is Sample-Hungry

Three compounding reasons:

**1. Sparse rewards**
When reward only arrives at the end of an episode, the agent spends most of its experience collecting uninformative zero-reward transitions. The signal-to-noise ratio is low.

**2. High variance**
Returns vary enormously between episodes, especially early in training. Gradient estimates have high variance, requiring more samples to average out the noise.

---

## Why RL Is Sample-Hungry: Long-Horizon Credit Assignment

**3. Long-horizon credit assignment**
In a 200-step episode, the reward at step 200 must propagate back through 200 steps of updates before the action at step 1 receives useful gradient signal. Each propagation step introduces error.

Together: a task that a human could learn from 10 demonstrations might require an RL agent 1,000,000 environment steps. This is not a solvable problem, but it is a manageable one with the right engineering.

---

## Sample Efficiency Across Algorithm Families

Rough ordering from least to most sample-efficient:

| Algorithm Type | Typical Sample Need | Key Mechanism |
|---|---|---|
| Vanilla Policy Gradient | Very high | No replay, high variance |
| PPO (on-policy) | High | Variance reduction via GAE |
| DQN (off-policy) | Moderate | Experience replay |
| SAC (off-policy) | Lower | Replay + entropy regularization |
| TD3 (off-policy) | Lower | Replay + twin critics |
| Model-based RL (Dreamer, PETS) | Much lower | Learns environment model, plans in imagination |

---

## Sample Efficiency: Rules of Thumb

Rules of thumb:
- Off-policy methods are generally 5-10x more sample-efficient than on-policy for the same task
- Model-based methods can be 10-100x more sample-efficient, but are harder to implement correctly
- In practice, wall-clock time often matters more than sample count. A less sample-efficient algorithm that is 10x faster per step may win.

---

## Wall-Clock Efficiency vs. Sample Efficiency

These are different metrics, and conflating them causes confusion.

**Sample efficiency**: how many environment steps are needed to reach a target performance level.

**Wall-clock efficiency**: how much real time is needed to reach that level.

They diverge because:
- A complex algorithm may need fewer samples but takes 5x longer per gradient update
- A fast environment might make it better to run more samples of a simpler algorithm
- GPU utilization varies dramatically across implementations

---

## Wall-Clock Efficiency: Competition Math

In a competition with a 4-hour training window:

```
Available time: 4 hours = 14,400 seconds
Target env steps: 10,000,000

Required steps/second: 10M / 14,400 ≈ 700 steps/sec

If 1 env runs at 200 steps/sec:
  Need at least 700/200 = 3.5 envs -> use 4 or 8
  
If you want 16 parallel envs at 200 steps/sec:
  You'll get 200 * 16 * 14400 = 46M steps
  With budget to run 3-4 different reward configs
```

**Profile first. Optimize the bottleneck.**

---

## Replay Buffer: Core Data Structure

The replay buffer is the foundation of off-policy methods (DQN, SAC, TD3). A correct implementation is non-trivial.

```python
import numpy as np
from collections import deque
import random

class ReplayBuffer:
    def __init__(self, capacity: int, obs_dim: int, action_dim: int = 1):
        self.capacity = capacity
        self.ptr = 0
        self.size = 0
        # Pre-allocate numpy arrays for efficiency
        self.obs      = np.zeros((capacity, obs_dim), dtype=np.float32)
        self.next_obs = np.zeros((capacity, obs_dim), dtype=np.float32)
        self.actions  = np.zeros((capacity, action_dim), dtype=np.int64)
        self.rewards  = np.zeros(capacity, dtype=np.float32)
        self.dones    = np.zeros(capacity, dtype=np.float32)

    def add(self, obs, action, reward, next_obs, done):
        self.obs[self.ptr]      = obs
        self.next_obs[self.ptr] = next_obs
        self.actions[self.ptr]  = action
        self.rewards[self.ptr]  = reward
        self.dones[self.ptr]    = float(done)
        self.ptr  = (self.ptr + 1) % self.capacity
        self.size = min(self.size + 1, self.capacity)

    def sample(self, batch_size: int):
        idx = np.random.randint(0, self.size, size=batch_size)
        return (
            self.obs[idx], self.actions[idx], self.rewards[idx],
            self.next_obs[idx], self.dones[idx],
        )

    def __len__(self):
        return self.size
```

---

## Prioritized Experience Replay (PER)

Uniform sampling from the replay buffer treats all transitions equally. **PER** (Schaul et al., 2015) samples transitions proportional to their TD error magnitude, giving more weight to surprising transitions.

Priority: $p_i = |\delta_i| + \epsilon$ where $\delta_i = r + \gamma \max_{a'} Q(s', a') - Q(s, a)$ and $\epsilon$ is a small constant for numerical stability.

Sampling probability: $P(i) = p_i^\alpha / \sum_j p_j^\alpha$ where $\alpha \in [0, 1]$ controls how much prioritization is used.

```python
import numpy as np

class PrioritizedReplayBuffer(ReplayBuffer):
    def __init__(self, capacity, obs_dim, alpha=0.6, beta=0.4):
        super().__init__(capacity, obs_dim)
        self.alpha = alpha
        self.beta = beta    # importance sampling correction
        self.priorities = np.zeros(capacity, dtype=np.float32)
        self.max_priority = 1.0

    def add(self, obs, action, reward, next_obs, done):
        super().add(obs, action, reward, next_obs, done)
        # New transitions get maximum priority
        self.priorities[self.ptr - 1] = self.max_priority

    def sample(self, batch_size):
        probs = self.priorities[:self.size] ** self.alpha
        probs /= probs.sum()
        idx = np.random.choice(self.size, size=batch_size, p=probs, replace=False)
        # Importance sampling weights to correct for prioritization bias
        weights = (self.size * probs[idx]) ** (-self.beta)
        weights /= weights.max()
        return (
            self.obs[idx], self.actions[idx], self.rewards[idx],
            self.next_obs[idx], self.dones[idx],
            idx, weights.astype(np.float32),
        )

    def update_priorities(self, idx, td_errors):
        priorities = np.abs(td_errors) + 1e-6
        self.priorities[idx] = priorities
        self.max_priority = max(self.max_priority, priorities.max())
```

---

## Vectorized Environments

The single most impactful throughput optimization for on-policy methods:

**Vectorized environments** run $N$ copies of the environment in parallel, generating $N$ transitions per step.

- PyTorch/JAX implementations can run 32, 64, or 256 environments simultaneously
- CPU-based: use Python multiprocessing (e.g., `gymnasium.vector.AsyncVectorEnv`)
- GPU-based: environments implemented in CUDA can run thousands in parallel (e.g., Isaac Gym, Brax)

---

## Vectorized Environments: Effect on Training

Effect on training:
- PPO typically needs a minimum batch size for stable gradient estimates
- More parallel envs = larger batches = better gradient estimates per update
- With 64 envs, you fill a 2048-step rollout buffer in 32 steps instead of 2048

Practical target: aim for at least 16-32 parallel environments. The returns diminish beyond a certain point (usually when you hit CPU or memory limits).

```python
import gymnasium as gym
from gymnasium.vector import AsyncVectorEnv

def make_env(env_id, seed):
    def _init():
        env = gym.make(env_id)
        env.reset(seed=seed)
        return env
    return _init

n_envs = 32
envs = AsyncVectorEnv([make_env("MiniGrid-FourRooms-v0", seed=i) for i in range(n_envs)])
obs, info = envs.reset()
print(obs.shape)   # (32, obs_dim) -- batch of observations

# Step all envs simultaneously
actions = np.array([envs.single_action_space.sample() for _ in range(n_envs)])
obs, rewards, terminated, truncated, infos = envs.step(actions)
```

---

## Profiling a Training Loop

Before optimizing, measure. A training loop has four main phases:

1. **Environment step**: run the simulator, get next state and reward
2. **Forward pass**: run the policy network to get action probabilities
3. **Backward pass**: compute gradients and update weights
4. **Data transfer**: move observations from CPU (env) to GPU (model) and back

---

## Profiling: Typical Breakdown and Implication

Typical breakdown for a CPU environment with a small policy network:
- Environment step: 60-80% of wall time
- Data transfer (CPU to GPU): 10-20%
- Forward + backward pass: 5-15%

This means: the bottleneck is almost always the environment, not the GPU. Adding a faster GPU will not help until the environment is fast enough to feed it.

---

## Identifying Your Bottleneck

```python
import time
import torch

t_env, t_transfer, t_forward, t_backward = 0.0, 0.0, 0.0, 0.0
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

for step in range(num_steps):
    t0 = time.perf_counter()
    obs, reward, done, _, info = env.step(action)
    t_env += time.perf_counter() - t0

    t0 = time.perf_counter()
    obs_tensor = torch.tensor(obs, dtype=torch.float32).to(device)
    t_transfer += time.perf_counter() - t0

    t0 = time.perf_counter()
    with torch.no_grad():
        dist, value = policy(obs_tensor)
        action = dist.sample().cpu().item()
    t_forward += time.perf_counter() - t0

if step % 1000 == 0:
    total = t_env + t_transfer + t_forward + t_backward
    print(f"env={t_env/total:.1%}  transfer={t_transfer/total:.1%}  "
          f"forward={t_forward/total:.1%}  backward={t_backward/total:.1%}")
```

---

## Identifying Your Bottleneck: How to Read the Output

Print the breakdown every 1000 steps. The largest number tells you where to focus.

GPU utilization: `nvidia-smi dmon -s u` in a separate terminal. If utilization is below 50%, the GPU is waiting for data.

---

## Environment Speed Optimization

If the environment is your bottleneck (it usually is):

**Reduce observation size**
- Large observations (e.g., full RGB images) are slow to generate and transfer
- Use the smallest observation that contains the necessary information
- Prefer structured observations (position, local map patch) over raw pixels when possible

**Avoid Python overhead in the env step**
- NumPy operations are fast; Python loops are not
- Profile the environment's `step()` function specifically

---

## Environment Speed Optimization: Parallelism and Rewriting

**Parallelize**
- `AsyncVectorEnv` runs environments in separate processes, true parallelism
- `SyncVectorEnv` is simpler but doesn't parallelize across CPUs

**Write a faster environment**
- If the bottleneck is a complex simulation, rewrite the inner loop in C++ or use a compiled framework
- For gridworlds: a fully NumPy or JAX implementation can be 100x faster than a pure Python one

```python
# NumPy-based gridworld step: no Python loops
def fast_step(state, action, grid, n_rows, n_cols):
    dr = np.array([-1, 1, 0, 0])
    dc = np.array([0, 0, -1, 1])
    new_r = np.clip(state[:, 0] + dr[action], 0, n_rows - 1)
    new_c = np.clip(state[:, 1] + dc[action], 0, n_cols - 1)
    blocked = grid[new_r, new_c] == 1
    state[~blocked, 0] = new_r[~blocked]
    state[~blocked, 1] = new_c[~blocked]
    return state
```

---

## GPU and Data Transfer Optimization

If GPU utilization is low:

**Batch observations before transferring**
- Don't transfer single observations. Collect a full rollout buffer, then transfer in one batch
- `torch.tensor(obs_batch).to(device)` once, not N times

**Use pinned memory**
- `torch.tensor(obs).pin_memory().to(device, non_blocking=True)` overlaps transfer with computation

---

## GPU Optimization: Dtype and Network Profiling

**Minimize observation dtype size**
- `float32` is standard. `float16` cuts transfer size in half at the cost of reduced precision
- `uint8` for discrete observations (e.g., local map tiles) is much smaller than float

**Profile the network, not just the environment**
- Small policy networks (2-3 layers, 64-256 units) are often bottlenecked by data transfer, not compute
- Larger networks (deep CNNs) may actually benefit from GPU optimization

```python
# Transfer an entire rollout buffer at once instead of step by step
obs_buffer = np.zeros((n_steps, n_envs, obs_dim), dtype=np.float32)
# ... collect rollout ...
obs_tensor = torch.from_numpy(obs_buffer).to(device)   # single transfer
```

---

## Hyperparameter Search with Optuna

Manual tuning is slow. **Optuna** provides a principled framework for hyperparameter search with pruning (stopping bad trials early).

```python
import optuna
from stable_baselines3 import PPO
from stable_baselines3.common.evaluation import evaluate_policy

def objective(trial):
    lr        = trial.suggest_float("lr", 1e-5, 1e-3, log=True)
    n_steps   = trial.suggest_categorical("n_steps", [512, 1024, 2048])
    batch_sz  = trial.suggest_categorical("batch_size", [32, 64, 128])
    gae_lam   = trial.suggest_float("gae_lambda", 0.9, 0.99)
    ent_coef  = trial.suggest_float("ent_coef", 1e-4, 0.05, log=True)

    env = gym.make("MiniGrid-FourRooms-v0")
    model = PPO(
        "MlpPolicy", env,
        learning_rate=lr,
        n_steps=n_steps,
        batch_size=batch_sz,
        gae_lambda=gae_lam,
        ent_coef=ent_coef,
        verbose=0,
    )
    model.learn(total_timesteps=300_000)

    mean_reward, _ = evaluate_policy(model, env, n_eval_episodes=20)
    return mean_reward

study = optuna.create_study(direction="maximize",
                            pruner=optuna.pruners.MedianPruner())
study.optimize(objective, n_trials=50, n_jobs=4)
print("Best params:", study.best_params)
```

---

## Optuna: Pruning Unpromising Trials

Optuna's `MedianPruner` stops a trial if its intermediate performance falls below the median of completed trials at the same step count. This saves compute when a configuration is clearly underperforming.

```python
# Report intermediate values so the pruner can act
model.learn(
    total_timesteps=300_000,
    callback=lambda locals_, globals_: trial.report(
        locals_["infos"][0].get("episode", {}).get("r", 0),
        step=locals_["self"].num_timesteps,
    ),
)
# Check for pruning
if trial.should_prune():
    raise optuna.TrialPruned()
```

With 4 parallel workers and median pruning, you can explore 50 hyperparameter configurations in roughly the time it would take to run 15 manually.

---

## Practical Tips: Observation and Action Space Design

Observation and action space choices affect both sample efficiency and compute:

**Observations**
- Include only what the agent needs to act. A 20x20 local map patch is better than a 100x100 full map if the agent only needs local context
- Normalize observations to roughly zero mean, unit variance. RL is sensitive to scale
- If using a map representation, use efficient encodings (e.g., one-hot or binary flags per cell type)

---

## Practical Tips: Action Space and Reward Normalization

**Action space**
- Smaller action spaces are easier to explore. If you don't need diagonal movement, don't include it
- Hierarchical action spaces (macro-actions, subgoals) reduce the effective horizon
- Avoid action masking unless necessary; it complicates gradient computation

**Reward normalization**
- Normalize rewards to a fixed range (e.g., divide by running std) to stabilize gradient scale
- PPO is particularly sensitive to reward scale

```python
class RunningMeanStd:
    def __init__(self, shape=()):
        self.mean = np.zeros(shape, dtype=np.float64)
        self.var  = np.ones(shape, dtype=np.float64)
        self.count = 1e-4

    def update(self, x):
        batch_mean = np.mean(x, axis=0)
        batch_var  = np.var(x, axis=0)
        batch_count = x.shape[0]
        self.mean, self.var, self.count = self._update_mean_var(
            self.mean, self.var, self.count,
            batch_mean, batch_var, batch_count,
        )

    def normalize(self, x):
        return np.clip((x - self.mean) / np.sqrt(self.var + 1e-8), -10, 10)
```

---

## Practical Compute Budget Planning

For a competition training run, work backwards from your time limit:

```
Available time: 4 hours = 14,400 seconds
Target env steps: 10,000,000

Required steps/second: 10M / 14,400 ≈ 700 steps/sec

If 1 env runs at 200 steps/sec:
  Need at least 700/200 = 3.5 envs -> use 4 or 8
  
If you want 16 parallel envs at 200 steps/sec:
  You'll get 200 * 16 * 14400 = 46M steps
  With budget to run 3-4 different reward configs
```

---

## Practical Compute Budget Planning: Strategy

Plan: instrument early, measure your baseline steps/sec, compute how many trials you can run, and allocate time for reward and hyperparameter exploration.

A single 10M-step run that takes all your time is less likely to win than three 3M-step runs with different reward designs, followed by a final run with the best config.

**Allocation heuristic:**

| Phase | Time | Goal |
|---|---|---|
| Baseline profiling | 30 min | Measure steps/sec, identify bottleneck |
| Reward iteration (3-4 configs) | 2 hours | Identify best reward design |
| Hyperparameter sweep (Optuna) | 1 hour | Tune LR, GAE lambda, ent_coef |
| Final run (best config) | 30 min | Maximize steps with best setup |

---

## Wandb for Experiment Tracking

Track every experiment or debugging will become impossible after a few runs.

```python
import wandb
from stable_baselines3.common.callbacks import BaseCallback

class WandbCallback(BaseCallback):
    def __init__(self, config):
        super().__init__()
        wandb.init(project="til-exploration", config=config)

    def _on_step(self) -> bool:
        if self.n_calls % 500 == 0:
            wandb.log({
                "train/mean_reward": np.mean([ep["r"] for ep in self.model.ep_info_buffer]),
                "train/mean_ep_length": np.mean([ep["l"] for ep in self.model.ep_info_buffer]),
                "train/fps": self.model.logger.name_to_value.get("time/fps", 0),
                "train/policy_entropy": self.model.logger.name_to_value.get("train/entropy_loss", 0),
            }, step=self.num_timesteps)
        return True

    def _on_training_end(self):
        wandb.finish()
```

After 5 runs, you will thank yourself for tracking hyperparameters, reward curves, and episode statistics systematically.

---

## What to Take Away

Sample efficiency and compute are engineering problems, not just research ones:

- RL is sample-hungry because of sparse rewards, high variance, and long credit assignment horizons
- Wall-clock efficiency and sample efficiency are different metrics; measure both
- Replay buffer: pre-allocate numpy arrays, size to at least 100k transitions for off-policy methods
- PER: sample $\propto |\delta_i|^\alpha$, correct with importance sampling weights $w_i \propto (N \cdot P(i))^{-\beta}$
- Vectorized environments are the highest-leverage single optimization
- Profile before optimizing: the bottleneck is usually the environment, not the GPU

---

## What to Take Away: Design and Planning

- Observation and action space design affects both efficiency and learning speed
- Plan your compute budget explicitly: steps/sec × available time = your sample budget
- Optuna + MedianPruner: explore 50 hyperparameter configs for the cost of ~15 manual runs
- Wandb: log every experiment from the start; debugging without it is guesswork

The agent that wins is the one that ran the most useful experiments in the available time, not the one with the most complex algorithm.
