"""Custom gymnasium.Env wrapping Bomberman for single-agent MaskablePPO training.

Controls agent_0. All other agents take uniformly random valid actions.
This produces a Gym-compatible env with action_masks() for sb3_contrib.

Run smoke test from repo root on GCP Workbench:
    python - <<'EOF'
    import sys; sys.path.insert(0, 'ae/train')
    from env_wrapper import AETrainEnv
    import numpy as np
    env = AETrainEnv()
    obs, _ = env.reset(seed=42)
    print("obs shape:", obs.shape)   # expect (892,)
    for _ in range(5):
        a = int(np.argmax(env.action_masks()))
        obs, r, term, trunc, _ = env.step(a)
        print(f"  reward={r:.3f}  term={term}  trunc={trunc}")
    env.close()
    print("Smoke test passed.")
    EOF

Design note — why we do NOT use agent_iter():
    PettingZoo versions differ on whether AECIterator.__next__ automatically
    calls _was_dead_step(None) for terminated/truncated agents. If it does,
    and we also call step(None) ourselves, dead agents get double-stepped,
    which empties agent_order and crashes Bomberman.step() at is_first().
    We avoid this entirely by driving the loop via agent_selection directly.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import numpy as np
import gymnasium as gym
from til_environment.bomberman_env import Bomberman
from til_environment.config import default_config
from omegaconf import OmegaConf

CONTROLLED = "agent_0"
OBS_DIM    = 892   # 875 + 3 + 4 + 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1
N_ACTIONS  = 6
STAY       = 4

# ---------------------------------------------------------------------------
# Reward shaping constants
# ---------------------------------------------------------------------------
# Game facts (from til_environment/config.py):
#   - Bombs do NOT hurt friendly agents/bases (friendly fire disabled)
#   - Agents freeze for 3 steps on death, then respawn at full 60 HP
#   - Bomb: 20 dmg, blast_radius=2, timer=4. New bomb every ~15 steps.
#   - Raw game rewards: collect_mission=+5, collect_resource=+2,
#     collect_recon=+1, attack_damage(dealt)=+1/dmg, attack_kill=+15,
#     destroy_enemy_base=+50, attack_damage(received)=-1/dmg, base_destroyed=-50

# Step costs
STEP_PENALTY        = -0.001   # discourages pure idling
STATIONARY_PENALTY  = -0.005   # extra cost for STAY (not applied when frozen)

# Amplify real positive game events so tile collection dominates the signal
POSITIVE_AMPLIFIER  = 1.5      # shaped += base * 1.5 when base > 0 (total ×2.5)

# Viewcone channel indices
_CH_VISIBLE       = 0
_CH_TILE_RECON    = 6
_CH_TILE_MISSION  = 7
_CH_TILE_RESOURCE = 8
_CH_ENEMY_AGENT   = 10
_CH_ENEMY_BASE    = 12
_CH_ALLY_BOMB_TMR = 19
_CH_ENEMY_BOMB_TMR= 20
_AGENT_ROW        = 2   # agent sits at row 2, col 2 in the 7×5 viewcone
_AGENT_COL        = 2
_BLAST_RADIUS     = 2

# Proximity guidance — hint toward scoring tiles, not dominant signal
TILE_BONUS          = 0.006   # mission/resource tile visible within dist 3
RECON_BONUS         = 0.002   # recon tile visible within dist 3
ENEMY_BASE_BONUS    = 0.003   # enemy base visible (REDUCED: was 0.015, caused dangerous camping)

# Danger avoidance
FROZEN_PENALTY      = -0.05   # per step while frozen (agent just took fatal damage)
BOMB_DANGER_PENALTY = -0.03   # per step when ticking bomb is within blast radius

# Offensive bombing bonus — reward placing bomb when enemy agent is directly ahead
BOMB_NEAR_ENEMY_BONUS = 0.02


def _make_cfg():
    """Build config with render_mode=None so no pygame window is created.

    novice=True fixes the map to seed=88 every episode — matching the
    competition evaluation for the Novice track. Training on the fixed map
    lets the agent learn the specific layout it will be scored on.
    """
    cfg = default_config()
    return OmegaConf.merge(cfg, {"env": {"render_mode": None, "novice": True}})


def _preprocess(obs_dict: dict) -> np.ndarray:
    """Identical to ae/src/ae_manager.py::preprocess_obs — kept in sync manually."""
    vc  = np.array(obs_dict["agent_viewcone"], dtype=np.float32).flatten()   # 875

    bvc = np.array(obs_dict["base_viewcone"], dtype=np.float32)              # 5×5×25
    base_summary = np.array([
        float(bvc[..., 10].max()),          # ENEMY_AGENT near base
        float(bvc[..., 18].max()),          # ENEMY_BOMB near base
        float(bvc[..., 20].max()) / 3.0,   # ENEMY_BOMB_TIMER (norm by fuse=3)
    ], dtype=np.float32)                                                      # 3

    direction = np.zeros(4, dtype=np.float32)
    direction[int(obs_dict["direction"])] = 1.0

    loc  = np.array(obs_dict["location"],       dtype=np.float32) / 15.0
    bloc = np.array(obs_dict["base_location"],  dtype=np.float32) / 15.0
    h    = np.array(obs_dict["health"],         dtype=np.float32) / 60.0
    ft   = np.array([obs_dict["frozen_ticks"]], dtype=np.float32) / 3.0
    bh   = np.array(obs_dict["base_health"],    dtype=np.float32) / 100.0
    tr   = np.array(obs_dict["team_resources"], dtype=np.float32) / 1.5
    tb   = np.array([obs_dict["team_bombs"]],   dtype=np.float32) / 50.0
    step = np.array([obs_dict["step"]],         dtype=np.float32) / 200.0

    return np.concatenate([vc, base_summary, direction, loc, bloc, h, ft, bh, tr, tb, step])


class AETrainEnv(gym.Env):
    """Single-agent Gym wrapper around the 6-agent Bomberman environment.

    Controls agent_0. All other agents take random valid actions.
    Uses agent_selection directly — never uses agent_iter() to avoid
    version-dependent double-stepping of dead agents.
    """

    metadata = {}

    def __init__(self):
        super().__init__()
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(OBS_DIM,), dtype=np.float32
        )
        self.action_space = gym.spaces.Discrete(N_ACTIONS)
        self._mask = np.ones(N_ACTIONS, dtype=bool)
        self._env  = None
        self._cfg  = _make_cfg()

    # ------------------------------------------------------------------ #
    # Gym API                                                              #
    # ------------------------------------------------------------------ #

    def reset(self, seed=None, options=None):
        if self._env is not None:
            self._env.close()
        self._env = Bomberman(self._cfg)
        self._env.reset(seed=seed)

        # Advance to agent_0's turn (should be immediate — it's always first)
        ok = self._advance_to_agent0()
        if not ok:
            # Shouldn't happen right after reset; return zeros gracefully
            return np.zeros(OBS_DIM, dtype=np.float32), {}

        obs_dict = self._env.observe(CONTROLLED)
        self._mask = np.array(obs_dict.get("action_mask", [1] * N_ACTIONS), dtype=bool)
        return _preprocess(obs_dict), {}

    def step(self, action: int):
        # Submit agent_0's action (or None if it's already dead)
        cur_trunc = self._env.truncations.get(CONTROLLED, False)
        cur_term  = self._env.terminations.get(CONTROLLED, False)
        if cur_term or cur_trunc:
            self._env.step(None)
        else:
            self._env.step(int(action))

        raw_reward = float(self._env.rewards.get(CONTROLLED, 0.0))

        # Check if episode ended right after agent_0 stepped
        term  = self._env.terminations.get(CONTROLLED, False)
        trunc = self._env.truncations.get(CONTROLLED, False)
        if term or trunc:
            return np.zeros(OBS_DIM, dtype=np.float32), self._shape(raw_reward, action, None), term, trunc, {}

        # Advance other agents until agent_0's turn again
        ok = self._advance_to_agent0()
        if not ok:
            # Episode ended while stepping other agents
            return np.zeros(OBS_DIM, dtype=np.float32), self._shape(raw_reward, action, None), False, True, {}

        obs_dict = self._env.observe(CONTROLLED)
        self._mask = np.array(obs_dict.get("action_mask", [1] * N_ACTIONS), dtype=bool)
        shaped = self._shape(raw_reward, action, obs_dict)
        return _preprocess(obs_dict), shaped, False, False, {}

    def action_masks(self) -> np.ndarray:
        return self._mask.copy()

    def close(self):
        if self._env is not None:
            self._env.close()
            self._env = None

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _advance_to_agent0(self) -> bool:
        """Step all agents until agent_selection is agent_0.

        Returns True when it is agent_0's turn and it is alive.
        Returns False if the episode ended (no agents left or agent_0 dead).

        Uses agent_selection directly to avoid agent_iter() version issues.
        Safety limit: 6 agents × 2 = 12 iterations maximum.
        """
        for _ in range(12):
            if not self._env.agents:
                return False

            sel = self._env.agent_selection

            if sel == CONTROLLED:
                # Check if agent_0 is dead
                if (self._env.truncations.get(sel, False) or
                        self._env.terminations.get(sel, False)):
                    self._env.step(None)
                    return False
                return True

            # Another agent's turn — step with None if dead, random action if alive
            if (self._env.truncations.get(sel, False) or
                    self._env.terminations.get(sel, False)):
                self._env.step(None)
            else:
                stored = self._env.observations.get(sel, {})
                mask   = stored.get("action_mask", [1] * N_ACTIONS)
                valid  = [i for i, v in enumerate(mask) if v]
                a      = int(np.random.choice(valid)) if valid else STAY
                self._env.step(a)

        return False  # safety limit hit

    def _shape(self, base: float, action: int, obs_dict: dict | None) -> float:
        shaped = base

        # Amplify real positive game events (tile collection, kills, base hits).
        # Makes scoring the dominant learning signal over proximity bonuses.
        if base > 0:
            shaped += base * POSITIVE_AMPLIFIER

        # Step penalty — always applied
        shaped += STEP_PENALTY

        # Stationary penalty — skip when frozen (agent is already helpless)
        frozen_ticks = 0
        if obs_dict is not None:
            ft = obs_dict.get("frozen_ticks", 0)
            frozen_ticks = int(ft[0]) if hasattr(ft, "__len__") else int(ft)

        if action == STAY and frozen_ticks == 0:
            shaped += STATIONARY_PENALTY

        # Frozen penalty — agent took lethal damage and is paralysed
        if frozen_ticks > 0:
            shaped += FROZEN_PENALTY

        if obs_dict is not None:
            vc = obs_dict.get("agent_viewcone")
            if vc is not None:
                vc_arr = np.array(vc, dtype=np.float32)  # 7×5×25

                for row in range(7):
                    for col in range(5):
                        cell = vc_arr[row][col]
                        if cell[_CH_VISIBLE] < 0.5:
                            continue
                        dist = abs(row - _AGENT_ROW) + abs(col - _AGENT_COL)

                        # Bomb danger — ticking bomb within blast radius
                        if dist <= _BLAST_RADIUS:
                            ally_t  = cell[_CH_ALLY_BOMB_TMR]
                            enemy_t = cell[_CH_ENEMY_BOMB_TMR]
                            if (0 < ally_t <= 2) or (0 < enemy_t <= 2):
                                shaped += BOMB_DANGER_PENALTY

                        # Proximity guidance — tiles and enemy base
                        if dist <= 3:
                            if cell[_CH_TILE_MISSION] > 0 or cell[_CH_TILE_RESOURCE] > 0:
                                shaped += TILE_BONUS
                            if cell[_CH_TILE_RECON] > 0:
                                shaped += RECON_BONUS
                            if cell[_CH_ENEMY_BASE] > 0:
                                shaped += ENEMY_BASE_BONUS

                # Offensive bomb bonus — reward placing bomb when enemy is directly ahead
                if action == 5:  # PLACE_BOMB
                    ahead_cell = vc_arr[_AGENT_ROW + 1][_AGENT_COL]
                    if ahead_cell[_CH_VISIBLE] > 0.5 and ahead_cell[_CH_ENEMY_AGENT] > 0:
                        shaped += BOMB_NEAR_ENEMY_BONUS

        return shaped
