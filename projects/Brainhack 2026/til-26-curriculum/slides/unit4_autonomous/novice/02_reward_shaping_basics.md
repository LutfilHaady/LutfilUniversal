---
presentationID: 13vKZVWfhbHYqi6ia8k-To7zNDERP3s2f4urWCSSmkbQ
title: "\"Reward Shaping Basics\""
---

# Reward Shaping Basics

The reward function is one of the most consequential design decisions in any RL system.

---

## The Agent Only Optimizes What You Tell It To

This is the most important idea in reward design:

**The agent has no concept of your actual goal. It only maximizes the reward signal you provide.**

If you want the agent to explore a map efficiently:
- You have to define "efficient exploration" in terms of numbers
- There is no "common sense" fallback

---

## The Agent Only Optimizes What You Tell It To: Why It Matters

Example: if you give +1 reward every time the agent takes a step, it will learn to move around in circles forever. It's not being dumb. It's doing exactly what you asked.

The algorithm doesn't matter much if the reward is wrong. A mediocre algorithm with a good reward will beat a sophisticated algorithm with a bad reward.

---

## Sparse Rewards: Simple but Hard to Learn From

**Sparse reward**: the agent only receives a reward at a few specific moments, often just at the goal.

```python
def sparse_reward(new_state):
    if new_state.reached_goal:
        return 1.0
    return 0.0
```

Why this is appealing:
- Easy to define correctly
- No ambiguity about what you're optimizing

---

## Sparse Rewards: The Learning Problem

Why this is hard to learn from:
- Early in training, the agent reaches the goal almost never
- Almost every episode produces a return of 0
- The agent gets almost no useful gradient signal

For a small gridworld it may work. For a large map with a long episode, the agent may wander for millions of steps before accidentally stumbling onto the goal.

The gradient of the PPO objective $\nabla_\theta J(\theta) = \mathbb{E}[\nabla_\theta \log \pi_\theta(a|s) \cdot G_t]$ is nearly zero when $G_t \approx 0$ for almost all episodes.

---

## Dense Rewards: Guiding Learning Step by Step

**Dense reward**: the agent receives small reward signals throughout the episode, not just at the end.

```python
def dense_reward(prev_state, new_state):
    r = 0.0
    # Bonus for each new cell observed this step
    newly_seen = new_state.observed_cells - prev_state.observed_cells
    r += 0.1 * len(newly_seen)
    # No bonus for revisiting known cells
    # Terminal bonus when goal is reached
    if new_state.reached_goal:
        r += 1.0
    return r
```

Why this helps:
- The agent gets useful feedback on almost every step
- Learning signal is present even in failed episodes
- Faster convergence in practice

---

## Dense Rewards: What the Agent Learns

The agent can now tell that moving into unexplored territory is better than staying put, even if it never reaches the goal in early training.

---

## The Tradeoff: Dense Rewards Are Harder to Design

Dense rewards guide learning faster, but they introduce new risks.

The tradeoff:

| —                    | Sparse             | Dense                |
| -------------------- | ------------------ | -------------------- |
| Signal clarity       | High (unambiguous) | Lower (many signals) |
| Learning speed       | Slow               | Fast                 |
| Design difficulty    | Easy               | Hard                 |
| Risk of misalignment | Low                | Higher               |

---

## The Tradeoff: What It Means in Practice

With dense rewards, you're making many small claims about what "good behavior" looks like. Each of those claims is an opportunity to get something wrong.

A well-designed dense reward is better than sparse. A poorly designed dense reward can be worse than sparse.

---

## Reward Hacking: When the Agent Finds a Loophole

**Reward hacking** happens when the agent discovers a way to maximize reward that doesn't match your intended behavior.

Classic examples:
- A boat racing game agent learned to drive in circles collecting point pickups instead of finishing the race
- A simulated robot was rewarded for speed and learned to make itself very tall, then fall over (falling is fast)

---

## Reward Hacking: Exploration-Specific Examples

Exploration-specific examples:
- Agent receives reward for each step: learns to pace back and forth
- Agent receives reward for "discovering" cells: learns to revisit the boundary of known area
- Agent receives reward for proximity to walls: learns to hug one wall forever

If the reward can be gamed, a sufficiently trained agent will game it.

---

## Common Shaping Pitfalls

**1. Double-rewarding the same behavior**
Giving +0.1 for a new cell AND +0.5 for visiting a frontier cell that leads to new cells both incentivize exploration. This can over-weight exploration at the expense of other behaviors (like reaching the goal).

**2. Conflicting signals**
`reward += 0.01 per step` (encourages moving) combined with `reward -= 0.01 per step` (encourages efficiency) cancel out. Net reward: 0. The agent learns nothing.

---

## Common Shaping Pitfalls: Scale and Stationarity

**3. Rewards that encourage staying still**
Any reward that is maximized by not moving (e.g., penalizing actions near obstacles) can cause the agent to freeze. Always check: what's the optimal behavior for an agent that does nothing?

**4. Scale mismatch**
If your exploration bonus is +0.001 per new cell but your goal reward is +100, the agent will fixate on reaching the goal and ignore exploration entirely.

```python
# Diagnosing scale: print per-component rewards during training
def step_reward_debug(prev_state, new_state):
    discovery = 0.5 * len(new_state.observed - prev_state.observed)
    step_penalty = -0.01
    goal_bonus = 10.0 if new_state.reached_goal else 0.0
    total = discovery + step_penalty + goal_bonus
    print(f"discovery={discovery:.3f}  penalty={step_penalty:.3f}  goal={goal_bonus:.1f}  total={total:.3f}")
    return total
```

---

## Practical Heuristics for a Competition Setting

When your time is limited, these heuristics give the most reward-design return on investment:

**Distance to frontier**
- Reward the agent proportionally to how close it gets to unexplored cells
- Encourages movement toward unknown territory
- Simple to compute: `reward = -min_distance_to_frontier * scale`

---

## Practical Heuristics: Coverage and Exploration Bonus

**Coverage percentage**
- Reward based on total fraction of the map explored so far
- `reward = (cells_discovered / total_cells) * scale`
- Works well as a terminal or periodic bonus

**Count-based exploration bonus**
- Give a fixed bonus for each cell visited for the first time
- Count-based: $b(s) = 1 / \sqrt{N(s)}$ where $N(s)$ is the number of times cell $s$ has been visited
- The denominator reduces the bonus for cells revisited, naturally encouraging novelty

```python
import numpy as np

class CountBasedBonus:
    def __init__(self, grid_shape):
        self.counts = np.zeros(grid_shape, dtype=np.float32)

    def bonus(self, pos):
        row, col = pos
        self.counts[row, col] += 1
        return 1.0 / np.sqrt(self.counts[row, col])
```

---

## Frontier-Based Reward in Practice

A frontier cell is any unexplored cell adjacent to an explored cell.

```python
def get_frontier_cells(explored_map):
    """Return set of (row, col) cells on the exploration frontier."""
    frontiers = set()
    rows, cols = explored_map.shape
    for r in range(rows):
        for c in range(cols):
            if explored_map[r, c]:   # cell is explored
                for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        if not explored_map[nr, nc]:  # neighbor unexplored
                            frontiers.add((nr, nc))
    return frontiers

def manhattan(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def compute_frontier_reward(agent_pos, explored_map):
    frontiers = get_frontier_cells(explored_map)
    if not frontiers:
        return 0.0
    min_dist = min(manhattan(agent_pos, f) for f in frontiers)
    return -0.01 * min_dist  # reward is higher when agent is closer
```

Why this works:
- Agent is always pulled toward the boundary of its knowledge
- Naturally discourages backtracking into already-explored areas
- Pairs well with a discovery bonus

---

## Frontier-Based Reward: Watch Out For

Watch out for: large maps where the nearest frontier is always far away. The reward may be so negative that the agent prefers to do nothing. Normalize by map size or use a clipped version.

```python
def compute_frontier_reward_normalized(agent_pos, explored_map):
    frontiers = get_frontier_cells(explored_map)
    if not frontiers:
        return 0.0
    max_possible_dist = sum(explored_map.shape)  # rough upper bound
    min_dist = min(manhattan(agent_pos, f) for f in frontiers)
    normalized = min_dist / max_possible_dist     # 0 to 1
    return -0.1 * normalized                      # bounded reward
```

---

## Coverage Reward in Practice

```python
def compute_coverage_reward(explored_cells, total_cells, prev_coverage):
    current_coverage = len(explored_cells) / total_cells
    delta = current_coverage - prev_coverage
    return delta * 10.0  # reward the change in coverage, not the total
```

Key design choice: reward the **change** in coverage per step, not the absolute total.
- Rewarding the absolute total gives huge reward early (easy to explore nearby cells) and tiny reward later (every new cell is a small fraction of total)
- Rewarding the delta keeps the signal consistent throughout the episode

---

## Coverage Reward: The Payoff

This avoids the "easy early gains, no incentive late" problem.

Mathematically, if coverage is $C_t$ at step $t$, the total reward from coverage over an episode is:

$$\sum_{t=0}^{T} \Delta C_t \cdot \text{scale} = (C_T - C_0) \cdot \text{scale}$$

The agent gets rewarded for the **net exploration progress** across the episode, not for the rate at which it was easy to explore.

---

## Putting a Reward Together

A reasonable starting reward for exploration:

```python
class ExplorationReward:
    def __init__(self, total_cells, discovery_weight=0.5,
                 step_penalty=0.01, goal_bonus=10.0):
        self.total_cells = total_cells
        self.discovery_weight = discovery_weight
        self.step_penalty = step_penalty
        self.goal_bonus = goal_bonus
        self.prev_observed = set()

    def __call__(self, new_state):
        r = 0.0

        # Discovery bonus: reward for cells seen for the first time
        newly_discovered = new_state.observed - self.prev_observed
        r += self.discovery_weight * len(newly_discovered)
        self.prev_observed = new_state.observed.copy()

        # Small step penalty (encourages efficiency)
        r -= self.step_penalty

        # Goal bonus
        if new_state.reached_goal:
            r += self.goal_bonus

        return r
```

---

## Putting a Reward Together: Iteration

Start simple. Run a few episodes, watch what the agent does, and adjust. Treat reward design as iterative debugging.

```python
import wandb

# Log reward components during training for debugging
wandb.log({
    "reward/discovery": discovery_reward,
    "reward/step_penalty": -step_penalty,
    "reward/goal": goal_bonus,
    "reward/total": total_reward,
    "metrics/coverage_pct": coverage,
    "metrics/episode_length": ep_len,
})
```

Tracking each reward component separately makes it easy to spot when one component dominates or when two components cancel each other out.

---

## Diagnosing a Bad Reward

If your agent is behaving unexpectedly, ask:

1. **What is the optimal reward-maximizing behavior given my reward function?** Write it out explicitly.
2. **Does that match what I actually want?** If not, the reward is wrong.
3. **Is the reward scale balanced?** Print the magnitude of each reward component across a few episodes.

---

## Diagnosing a Bad Reward: More Checks

4. **Does the agent have an incentive to do nothing?** Simulate a stationary agent and compute its return.
5. **Is there a reward-hacking loop?** Watch the agent's trajectory in the first 50 steps.

```python
# Check: what does a stationary agent earn?
def simulate_stationary_agent(reward_fn, env, n_steps=200):
    obs, _ = env.reset()
    total = 0.0
    for _ in range(n_steps):
        # Agent always takes action 0 (stays in place or bumps wall)
        obs, reward, terminated, truncated, _ = env.step(0)
        total += reward
        if terminated or truncated:
            break
    print(f"Stationary agent return: {total:.3f}")
    # If this is positive, the reward has a standing bias.
```

Debugging rewards is debugging. Use the same systematic approach you'd use for code.

---

## What to Take Away

Reward design is a first-class engineering problem:

- The agent maximizes exactly what you specify, nothing more
- Sparse rewards are clean but slow. Dense rewards are fast but require care
- Reward hacking is expected, not a bug in the algorithm
- Common pitfalls: double-rewarding, conflicting signals, scale mismatch, stationary optima
- Count-based bonus: $b(s) = 1/\sqrt{N(s)}$ naturally encourages novelty without hand-crafting
- For exploration: discovery bonuses, delta coverage, and frontier distance are proven starting points
- Log each reward component separately with wandb for fast debugging

Start with the simplest reward that could plausibly work. Observe behavior. Refine.
