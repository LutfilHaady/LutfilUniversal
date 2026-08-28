---
presentationID: 1w5eInOemihmetsX1pjZDy2-b9jbl3A96_UVGzLHKdUE
title: "\"RL Fundamentals: The Math and Theory\""
---

# RL Fundamentals: The Math and Theory

This session goes beyond the intuitive framing and develops the formal machinery behind reinforcement learning.

---

## Formalizing the Problem: The MDP

Reinforcement learning is formalized as a **Markov Decision Process (MDP)**:

$$\mathcal{M} = (S, A, P, R, \gamma)$$

- $S$: state space
- $A$: action space
- $P(s' | s, a)$: transition probability
- $R(s, a, s')$: reward function
- $\gamma \in [0, 1)$: discount factor

---

## The MDP: Markov Property and Policy

The **Markov property**: the next state depends only on the current state and action, not on the history. This is a simplifying assumption that makes the math tractable.

A **policy** $\pi(a | s)$ is a probability distribution over actions given a state. A deterministic policy is $\pi(s) = a$.

---

## The Value Function V(s)

The **state value function** $V^\pi(s)$ is the expected return when starting from state $s$ and following policy $\pi$:

$$V^\pi(s) = \mathbb{E}_\pi \left[ \sum_{t=0}^{\infty} \gamma^t r_{t+1} \,\middle|\, s_0 = s \right]$$

- It answers: "how good is it to be in state $s$ if I follow $\pi$?"
- Different policies produce different value functions
- The **optimal value function** $V^*(s) = \max_\pi V^\pi(s)$ gives the best achievable return from $s$

---

## The Value Function V(s): Intuition

Intuition: a state near the goal has high value. A dead end has low value. A state at the start of a long episode has intermediate value.

---

## The Action-Value Function Q(s, a)

The **action-value function** (or Q-function) $Q^\pi(s, a)$ is the expected return from taking action $a$ in state $s$, then following $\pi$:

$$Q^\pi(s, a) = \mathbb{E}_\pi \left[ \sum_{t=0}^{\infty} \gamma^t r_{t+1} \,\middle|\, s_0 = s, a_0 = a \right]$$

Relationship to $V$:
$$V^\pi(s) = \sum_a \pi(a|s) \, Q^\pi(s, a)$$

---

## The Action-Value Function Q(s, a): Optimality

The optimal Q-function satisfies:
$$Q^*(s, a) = \max_\pi Q^\pi(s, a)$$

Why Q is useful: if you know $Q^*$, you can recover the optimal policy directly:
$$\pi^*(s) = \arg\max_a Q^*(s, a)$$

No model of the environment needed.

---

## The Bellman Equation

The Bellman equation gives a **recursive** definition of value. For $V^\pi$:

$$V^\pi(s) = \sum_a \pi(a|s) \sum_{s'} P(s'|s,a) \left[ R(s,a,s') + \gamma V^\pi(s') \right]$$

For the optimal value function:

$$V^*(s) = \max_a \sum_{s'} P(s'|s,a) \left[ R(s,a,s') + \gamma V^*(s') \right]$$

---

## The Bellman Equation: Why It Matters

The Bellman equation is useful because:
- It decomposes a hard global problem (compute value over all future steps) into a local consistency condition
- It forms the basis of **dynamic programming** and **temporal difference learning**
- Q-learning, DQN, and other methods are all implementing Bellman updates under the hood

---

## Temporal Difference Learning

Rather than waiting for the full episode to compute returns, **TD learning** updates value estimates at each step using the Bellman equation.

The **TD error** $\delta_t$ quantifies how much our current estimate violates the Bellman consistency condition:

$$\delta_t = r_{t+1} + \gamma V(s_{t+1}) - V(s_t)$$

The TD(0) update for $V$:

$$V(s_t) \leftarrow V(s_t) + \alpha \, \delta_t$$

---

## Temporal Difference Learning: Properties and Q-Learning

Properties:
- Updates online, after each step
- Bootstraps: uses the current estimate of $V(s_{t+1})$ rather than waiting for the full return
- Biased but low variance compared to Monte Carlo methods

Q-learning is the TD method applied to $Q$:

$$Q(s_t, a_t) \leftarrow Q(s_t, a_t) + \alpha \left[ r_{t+1} + \gamma \max_{a'} Q(s_{t+1}, a') - Q(s_t, a_t) \right]$$

---

## On-Policy vs. Off-Policy Methods

**On-policy**: the algorithm learns about and improves the policy it is currently using to collect data.

- Examples: SARSA, PPO, A3C
- Data must be collected with the current policy; old data becomes stale
- More sample-hungry but more stable in some settings

**Off-policy**: the algorithm can learn from data collected by a different policy (including old versions of itself or even a random policy).

- Examples: Q-learning, DQN, SAC
- Can reuse experience from a replay buffer
- More sample-efficient but harder to stabilize

---

## On-Policy vs. Off-Policy: Practical Implications

The distinction matters practically: off-policy methods can learn from a replay buffer (much more data per gradient update), but on-policy methods are generally easier to tune and less prone to divergence.

---

## The DQN Family

**DQN (Deep Q-Network)** applies Q-learning with a neural network to approximate $Q(s, a; \theta)$.

Two key stabilization tricks:

**1. Experience replay**
- Store transitions $(s, a, r, s')$ in a replay buffer
- Sample random mini-batches for training
- Breaks temporal correlations that cause divergence

---

## The DQN Family: Target Network and Extensions

**2. Target network**
- Maintain a separate "frozen" copy of the network for computing Bellman targets
- Update the target network periodically (not every step)
- Prevents the target from shifting every gradient update (chasing a moving target)

Extensions: Double DQN (reduces overestimation bias), Dueling DQN (separates value and advantage), Rainbow (combines multiple improvements).

DQN is off-policy. It works well for discrete action spaces.

---

## Policy Gradient: Full Derivation

Instead of learning a value function and deriving a policy, **policy gradient methods** directly optimize $J(\theta) = \mathbb{E}_{\pi_\theta}[G_0]$.

The policy gradient theorem gives:

$$\nabla_\theta J(\theta) = \mathbb{E}_{\pi_\theta} \left[ \nabla_\theta \log \pi_\theta(a_t|s_t) \cdot Q^{\pi_\theta}(s_t, a_t) \right]$$

**Derivation sketch**: Let $\tau = (s_0, a_0, r_1, \ldots)$ be a trajectory. Then:

$$J(\theta) = \int p_\theta(\tau) R(\tau) \, d\tau$$

$$\nabla_\theta J(\theta) = \int \nabla_\theta p_\theta(\tau) R(\tau) \, d\tau = \int p_\theta(\tau) \nabla_\theta \log p_\theta(\tau) R(\tau) \, d\tau$$

Since $\nabla_\theta \log p_\theta(\tau) = \sum_t \nabla_\theta \log \pi_\theta(a_t|s_t)$ (transition probabilities don't depend on $\theta$), we get the policy gradient theorem.

---

## Policy Gradient Methods: Advantage Formulation

Practical form using advantage $A(s,a) = Q(s,a) - V(s)$:

$$\nabla_\theta J(\theta) \approx \mathbb{E} \left[ \nabla_\theta \log \pi_\theta(a_t|s_t) \cdot A_t \right]$$

Using advantage instead of raw return reduces variance substantially because $V(s)$ serves as a **baseline**: it shifts the reward signal to have zero mean without changing the gradient in expectation.

Policy gradients handle continuous action spaces naturally and can learn stochastic policies.

---

## Generalized Advantage Estimation (GAE)

Computing $A_t$ accurately requires balancing bias and variance. **GAE** (Schulman et al., 2015) introduces a parameter $\lambda$ for this tradeoff.

Define the one-step TD error: $\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)$

Then the GAE estimate is:

$$\hat{A}_t^{GAE(\gamma, \lambda)} = \sum_{l=0}^{\infty} (\gamma\lambda)^l \delta_{t+l}$$

- $\lambda = 0$: reduces to TD(0) advantage $\delta_t$ (low variance, high bias)
- $\lambda = 1$: reduces to Monte Carlo advantage (high variance, low bias)
- Typical setting: $\lambda = 0.95$ with $\gamma = 0.99$

```python
def compute_gae(rewards, values, dones, gamma=0.99, lam=0.95):
    """Compute GAE advantages for a rollout buffer."""
    import numpy as np
    T = len(rewards)
    advantages = np.zeros(T, dtype=np.float32)
    last_gae = 0.0
    for t in reversed(range(T)):
        next_val = values[t + 1] if t < T - 1 else 0.0
        delta = rewards[t] + gamma * next_val * (1 - dones[t]) - values[t]
        last_gae = delta + gamma * lam * (1 - dones[t]) * last_gae
        advantages[t] = last_gae
    returns = advantages + values[:T]
    return advantages, returns
```

---

## Where PPO Sits

**Proximal Policy Optimization (PPO)** is a policy gradient method with one key modification: it constrains how much the policy is allowed to change in a single update.

The PPO clipped objective:

$$L^{CLIP}(\theta) = \mathbb{E}_t \left[ \min \left( r_t(\theta) \hat{A}_t, \, \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon) \hat{A}_t \right) \right]$$

where $r_t(\theta) = \frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{old}}(a_t|s_t)}$ is the probability ratio.

---

## PPO: Full Objective with Value Function and Entropy

In practice, the full PPO objective combines three terms:

$$L(\theta) = L^{CLIP}(\theta) - c_1 L^{VF}(\theta) + c_2 S[\pi_\theta](s_t)$$

- $L^{VF} = \mathbb{E}_t[(V_\theta(s_t) - V_t^{target})^2]$: value function loss (the critic)
- $S[\pi_\theta](s_t) = -\sum_a \pi_\theta(a|s_t) \log \pi_\theta(a|s_t)$: entropy bonus encouraging exploration
- $c_1 \approx 0.5$, $c_2 \approx 0.01$ are tunable coefficients

The entropy bonus prevents premature collapse to a deterministic policy.

---

## PPO: Why It Matters

Why this matters:
- Vanilla policy gradient steps can be too large, leading to catastrophic policy collapse
- PPO clips the update so it can't stray too far from the old policy in one step
- Much more stable than vanilla REINFORCE or A3C
- Default choice for most practical RL work: well-understood, open-source implementations, good performance

PPO is on-policy. It requires fresh data for each update.

---

## PPO: Policy and Value Network in PyTorch

```python
import torch
import torch.nn as nn
from torch.distributions import Categorical

class ActorCritic(nn.Module):
    def __init__(self, obs_dim: int, n_actions: int, hidden: int = 64):
        super().__init__()
        # Shared feature extractor
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, hidden),
            nn.Tanh(),
            nn.Linear(hidden, hidden),
            nn.Tanh(),
        )
        # Actor head: outputs action logits
        self.actor = nn.Linear(hidden, n_actions)
        # Critic head: outputs scalar state value
        self.critic = nn.Linear(hidden, 1)

    def forward(self, obs: torch.Tensor):
        features = self.shared(obs)
        logits = self.actor(features)
        value = self.critic(features).squeeze(-1)
        return Categorical(logits=logits), value

    def get_action_and_value(self, obs, action=None):
        dist, value = self.forward(obs)
        if action is None:
            action = dist.sample()
        return action, dist.log_prob(action), dist.entropy(), value
```

---

## PPO: Computing the Clipped Loss

```python
def ppo_loss(model, obs, actions, old_log_probs, advantages, returns,
             clip_eps=0.2, vf_coef=0.5, ent_coef=0.01):
    _, log_probs, entropy, values = model.get_action_and_value(obs, actions)

    # Probability ratio r_t(theta)
    ratio = torch.exp(log_probs - old_log_probs)

    # Clipped surrogate objective
    surr1 = ratio * advantages
    surr2 = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps) * advantages
    policy_loss = -torch.min(surr1, surr2).mean()

    # Value function loss
    value_loss = 0.5 * (values - returns).pow(2).mean()

    # Entropy bonus (negative because we maximize entropy)
    entropy_loss = -entropy.mean()

    total_loss = policy_loss + vf_coef * value_loss + ent_coef * entropy_loss
    return total_loss, policy_loss.item(), value_loss.item(), entropy.mean().item()
```

---

## PPO Training with stable-baselines3

For competition work, use `stable_baselines3` rather than implementing from scratch:

```python
import gymnasium as gym
import wandb
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback

class WandbCallback(BaseCallback):
    def _on_step(self) -> bool:
        if self.n_calls % 1000 == 0:
            wandb.log({
                "train/reward": self.locals["rewards"].mean(),
                "train/ep_len": self.locals.get("infos", [{}])[0].get("episode", {}).get("l", 0),
            }, step=self.num_timesteps)
        return True

wandb.init(project="autonomous-exploration", config={
    "algo": "PPO", "n_envs": 8, "total_timesteps": 2_000_000,
})

vec_env = make_vec_env("MiniGrid-FourRooms-v0", n_envs=8)
model = PPO(
    "MlpPolicy", vec_env,
    learning_rate=3e-4,
    n_steps=2048,
    batch_size=64,
    n_epochs=10,
    gamma=0.99,
    gae_lambda=0.95,
    clip_range=0.2,
    ent_coef=0.01,
    vf_coef=0.5,
    verbose=1,
)
model.learn(total_timesteps=2_000_000, callback=WandbCallback())
model.save("ppo_exploration")
```

---

## Comparing Algorithm Families

| Algorithm  | Family                   | Action Space | Sample Efficiency | Stability       |
| ---------- | ------------------------ | ------------ | ----------------- | --------------- |
| Q-learning | Value-based              | Discrete     | Moderate          | Moderate        |
| DQN        | Value-based              | Discrete     | Good (replay)     | Requires tuning |
| PPO        | Policy gradient          | Both         | Lower             | High            |
| SAC        | Actor-critic, off-policy | Continuous   | High              | High            |
| TD3        | Actor-critic, off-policy | Continuous   | High              | High            |
| A3C/A2C    | Policy gradient          | Both         | Lower             | Moderate        |

---

## Comparing Algorithm Families: General Guidance

General guidance:
- Discrete actions, limited compute: DQN or PPO
- Continuous actions: PPO or SAC or TD3
- Need to reuse data aggressively: off-policy (DQN, SAC, TD3)
- Need stability and easier debugging: PPO

SAC maximizes entropy explicitly: $J(\pi) = \sum_t \mathbb{E}[r_t + \alpha \mathcal{H}(\pi(\cdot|s_t))]$ where $\alpha$ is the temperature parameter, auto-tuned during training.

---

## Algorithm Selection for the Task

For autonomous exploration in a competition setting, the relevant constraints are:

1. **Action space**: typically discrete (up/down/left/right), favors DQN or PPO
2. **Episode length**: can be long, which increases variance in policy gradient estimates
3. **Reward density**: if you use shaped rewards, both DQN and PPO work. Sparse rewards favor methods that can reuse data (DQN)

---

## Algorithm Selection: Recommendation

4. **Training time**: PPO is easier to get running quickly. DQN requires careful replay buffer tuning
5. **Multi-agent**: if multiple agents are present, PPO generalizes more naturally to MAPPO

Starting recommendation: **PPO with a shaped reward and GAE ($\lambda=0.95$)**. It's the most commonly used algorithm in robotics and game AI for good reason. You can switch if you identify a specific bottleneck.

```python
# Quick experiment: compare PPO vs DQN on your env
from stable_baselines3 import PPO, DQN

for Algo, name in [(PPO, "PPO"), (DQN, "DQN")]:
    model = Algo("MlpPolicy", env, verbose=0)
    model.learn(total_timesteps=500_000)
    # Evaluate and log
```

---

## What to Take Away

The formal machinery behind RL:

- $V^\pi(s)$: expected return from $s$ under $\pi$. $Q^\pi(s,a)$: expected return from $(s,a)$ under $\pi$
- Bellman equation: value functions satisfy a recursive consistency condition
- TD error: $\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)$, the core learning signal
- On-policy (PPO): learns from current data, stable, less sample-efficient
- Off-policy (DQN, SAC): can reuse past data, more sample-efficient, harder to stabilize

---

## What to Take Away: GAE, PPO, and Starting Point

- GAE: $\hat{A}_t = \sum_l (\gamma\lambda)^l \delta_{t+l}$, blends bias and variance via $\lambda$
- PPO full objective: $L^{CLIP} - c_1 L^{VF} + c_2 S[\pi_\theta]$
- Entropy bonus $c_2 S[\pi_\theta]$ prevents premature determinism
- DQN: Q-learning + neural network + experience replay + target network
- PPO: policy gradient + clipped update + entropy regularization
- For most practical work starting from scratch: begin with PPO via stable-baselines3

The equations here are not decorative. Understanding them lets you debug training failures from first principles.
