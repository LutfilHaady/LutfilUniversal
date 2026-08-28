"""
ae_manager_rl.py — RL AE manager: compass hints + core frame stack for inference.

Each training iteration is a fresh PPO run under ae/src/models/<RUN_ID>/.
Bump DEFAULT_RL_RUN_ID (or set env TIL_RL_RUN_ID) when starting a new iteration.

Observation layout (training StackCoreAppendCompassWrapper and AEManager must match):
  [core_flat_t-3 | core_flat_t-2 | core_flat_t-1 | core_flat_t | compass_5]
  core_flat = gymnasium flatten of Bomberman dict obs (no compass keys).
  compass_5 = 4-d one-hot world Direction toward BFS target + 1-d normalized distance.
"""

from __future__ import annotations

import os
from collections import deque
from typing import Any

import numpy as np
from gymnasium.spaces import Box, Dict, Discrete
from gymnasium.spaces.utils import flatten, flatten_space
from pettingzoo.utils.env import AgentID
from pettingzoo.utils.wrappers.base import BaseWrapper

from til_environment.helpers import view_to_world
from til_environment.observation import ViewChannel
from til_environment.types import Direction

STACK_SIZE = 4
COMPASS_DIM = 5
COMPASS_KEYS = frozenset({"compass_direction", "compass_distance"})

# --- Active RL iteration: one PPO experiment per RUN_ID (PPO_5, PPO_6, …) ---
# Override on Jupyter without editing code: os.environ["TIL_RL_RUN_ID"] = "PPO_7"
DEFAULT_RL_RUN_ID = "PPO_7"
PRIMARY_AGENT = "agent_0"
PRIMARY_AGENT_IDX = 0
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_SRC_DIR, "..", ".."))
_MODELS_ROOT = os.path.join(_SRC_DIR, "models")


def active_rl_run_id() -> str:
    return os.environ.get("TIL_RL_RUN_ID", DEFAULT_RL_RUN_ID).strip()


def rl_run_dir(run_id: str | None = None) -> str:
    """Per-iteration checkpoint dir, e.g. ae/src/models/PPO_5/."""
    rid = active_rl_run_id() if run_id is None else run_id
    return os.path.join(_MODELS_ROOT, rid)


def rl_run_best_stem(run_id: str | None = None) -> str:
    return os.path.join(rl_run_dir(run_id), "best_model")


def rl_deploy_best_stem() -> str:
    """Docker / til build path (copy iteration best here before build)."""
    return os.path.join(_MODELS_ROOT, "best_model")


def ae_tensorboard_dir(run_id: str | None = None) -> str:
    rid = active_rl_run_id() if run_id is None else run_id
    return os.path.join(_REPO_ROOT, "ae_tensorboard", rid)


def ae_eval_log_dir(run_id: str | None = None) -> str:
    rid = active_rl_run_id() if run_id is None else run_id
    return os.path.join(_REPO_ROOT, "ae_eval_logs", rid)


def _make_deployment_eval_vec_wrapper():
    from stable_baselines3.common.vec_env import VecEnvWrapper

    class DeploymentEvalVecWrapper(VecEnvWrapper):
        """Train + eval: random opponents for agents 1..N-1; agent_0 reward on primary index."""

        def reset(self) -> np.ndarray:
            return self.venv.reset()

        def step_async(self, actions) -> None:
            actions = np.asarray(actions).copy()
            for i in range(1, self.num_envs):
                actions[i] = self.action_space.sample()
            self.venv.step_async(actions)

        def step_wait(self):
            obs, rewards, dones, infos = self.venv.step_wait()
            rewards = np.asarray(rewards, dtype=np.float32).copy()
            primary = float(rewards[PRIMARY_AGENT_IDX])
            out = np.zeros_like(rewards)
            out[PRIMARY_AGENT_IDX] = primary
            return obs, out, dones, infos

    return DeploymentEvalVecWrapper


def wrap_deployment_aligned(vec_env):
    """Train + eval: random opponents + agent_0 reward (qualifier / til test aligned)."""
    return _make_deployment_eval_vec_wrapper()(vec_env)


def wrap_deployment_eval(vec_env):
    """Alias for wrap_deployment_aligned (PPO_6 name)."""
    return wrap_deployment_aligned(vec_env)


def evaluate_deployment_policy(
    model,
    env,
    n_eval_episodes: int = 10,
    deterministic: bool = True,
    return_episode_rewards: bool = False,
):
    """
    Evaluate agent_0 return only (random opponents on other agents via DeploymentEvalVecWrapper).
    One full game per episode; avoids SB3 evaluate_policy splitting episodes across 6 agent slots.
    """
    episode_rewards: list[float] = []
    episode_lengths: list[int] = []
    for _ in range(n_eval_episodes):
        obs = env.reset()
        ep_reward = 0.0
        ep_len = 0
        states = None
        episode_starts = np.ones((env.num_envs,), dtype=bool)
        while True:
            actions, states = model.predict(
                obs,
                state=states,
                episode_start=episode_starts,
                deterministic=deterministic,
            )
            obs, rewards, dones, _infos = env.step(actions)
            ep_reward += float(rewards[PRIMARY_AGENT_IDX])
            ep_len += 1
            episode_starts = dones
            if bool(np.all(dones)):
                break
        episode_rewards.append(ep_reward)
        episode_lengths.append(ep_len)

    mean_reward = float(np.mean(episode_rewards))
    std_reward = float(np.std(episode_rewards))
    if return_episode_rewards:
        return episode_rewards, episode_lengths
    return mean_reward, std_reward


# Viewcone agent cell (behind=2, left=2 from default VisionConfig @ 077a4ef)
VC_BEHIND = 2
VC_LEFT = 2


def encode_compass(direction: int, distance: float, grid_size: int = 16) -> np.ndarray:
    """5-d compass: one-hot Direction + distance / (2 * grid_size)."""
    one_hot = np.zeros(4, dtype=np.float32)
    if 0 <= direction < 4:
        one_hot[direction] = 1.0
    norm_dist = min(float(distance) / float(2 * grid_size), 1.0)
    return np.concatenate([one_hot, np.array([norm_dist], dtype=np.float32)])


def _unwrap_bomberman(env: Any):
    cur = env
    while cur is not None:
        if cur.__class__.__name__ == "Bomberman":
            return cur
        cur = getattr(cur, "env", None)
    raise RuntimeError("Bomberman env not found in wrapper chain")


def build_core_obs_space(cfg=None):
    """Dict observation space from pinned Bomberman (no compass keys)."""
    from til_environment.bomberman_env import Bomberman
    from til_environment.config import default_config

    if cfg is None:
        cfg = default_config()
        cfg.env.novice = True
    return Bomberman(cfg=cfg).observation_space("agent_0")


def flatten_core_observation(obs: dict, core_space) -> np.ndarray:
    """Flatten raw Bomberman dict obs (as sent by til test) without compass keys."""
    typed = _typed_core_obs(obs)
    return flatten(core_space, typed)


def _typed_core_obs(obs: dict) -> dict:
    health = obs["health"]
    if not isinstance(health, np.ndarray):
        health = np.array([health], dtype=np.float32)
    elif health.ndim == 0:
        health = np.array([health], dtype=np.float32)
    base_health = obs["base_health"]
    if not isinstance(base_health, np.ndarray):
        base_health = np.array([base_health], dtype=np.float32)
    elif base_health.ndim == 0:
        base_health = np.array([base_health], dtype=np.float32)
    team_resources = obs["team_resources"]
    if not isinstance(team_resources, np.ndarray):
        team_resources = np.array([team_resources], dtype=np.float32)
    elif team_resources.ndim == 0:
        team_resources = np.array([team_resources], dtype=np.float32)

    return {
        "agent_viewcone": np.array(obs["agent_viewcone"], dtype=np.float32),
        "base_viewcone": np.array(obs["base_viewcone"], dtype=np.float32),
        "direction": int(obs["direction"]),
        "location": np.array(obs["location"], dtype=np.uint8),
        "base_location": np.array(obs["base_location"], dtype=np.uint8),
        "health": health.reshape(1).astype(np.float32),
        "frozen_ticks": int(obs["frozen_ticks"]),
        "base_health": base_health.reshape(1).astype(np.float32),
        "team_resources": team_resources.reshape(1).astype(np.float32),
        "team_bombs": int(obs["team_bombs"]),
        "step": int(obs["step"]),
        "action_mask": np.array(obs["action_mask"], dtype=np.uint8),
    }


def stack_core_append_compass(
    core_flat: np.ndarray,
    frames: deque,
    compass_dir: int,
    compass_dist: float,
    grid_size: int = 16,
) -> np.ndarray:
    """Update frame deque and return policy input vector."""
    if len(frames) == 0:
        for _ in range(STACK_SIZE - 1):
            frames.append(np.zeros_like(core_flat))
    frames.append(core_flat.copy())
    stacked = np.concatenate(list(frames))
    compass_vec = encode_compass(compass_dir, compass_dist, grid_size)
    return np.concatenate([stacked, compass_vec]).astype(np.float32)


class CompassState:
    """Map memory + Novice static tile cache; BFS compass toward objectives."""

    def __init__(self, grid_size: int = 16):
        self.grid_size = grid_size
        self.known_free: set[tuple[int, int]] = set()
        self.known_wall: set[tuple[int, int]] = set()
        self.seen_mission: set[tuple[int, int]] = set()
        self.seen_resource: set[tuple[int, int]] = set()
        self.seen_recon: set[tuple[int, int]] = set()
        self.static_missions: list[tuple[int, int]] = []
        self.static_resources: list[tuple[int, int]] = []
        self.static_recons: list[tuple[int, int]] = []

    def copy_static_from(self, other: CompassState) -> None:
        self.static_missions = list(other.static_missions)
        self.static_resources = list(other.static_resources)
        self.static_recons = list(other.static_recons)

    def reset_episode(self) -> None:
        self.known_free.clear()
        self.known_wall.clear()
        self.seen_mission.clear()
        self.seen_resource.clear()
        self.seen_recon.clear()

    def probe_static(self, bomber) -> None:
        reg = bomber.dynamics.registry
        self.static_missions = [
            (int(m.position[0]), int(m.position[1])) for m in reg.missions()
        ]
        self.static_resources = [
            (int(r.position[0]), int(r.position[1])) for r in reg.resources()
        ]
        self.static_recons = [
            (int(r.position[0]), int(r.position[1])) for r in reg.recons()
        ]

    def update_maps(self, obs: dict) -> None:
        loc = np.array(obs["location"], dtype=np.int64)
        direction = Direction(int(obs["direction"]))
        vc = np.array(obs["agent_viewcone"], dtype=np.float32)
        vc_l, vc_w = vc.shape[0], vc.shape[1]

        for i in range(vc_l):
            for j in range(vc_w):
                view_coord = np.array([i - VC_BEHIND, j - VC_LEFT], dtype=np.int64)
                world = view_to_world(loc, direction, view_coord)
                wx, wy = int(world[0]), int(world[1])
                if wx < 0 or wy < 0 or wx >= self.grid_size or wy >= self.grid_size:
                    continue
                key = (wx, wy)
                if vc[i, j, ViewChannel.VISIBLE] > 0.5:
                    self.known_free.add(key)
                wall_hit = any(
                    vc[i, j, ch] > 0.5
                    for ch in (
                        ViewChannel.WALL_RIGHT,
                        ViewChannel.WALL_DOWN,
                        ViewChannel.WALL_LEFT,
                        ViewChannel.WALL_UP,
                    )
                )
                if wall_hit:
                    self.known_wall.add(key)
                if vc[i, j, ViewChannel.TILE_MISSION] > 0.5:
                    self.seen_mission.add(key)
                if vc[i, j, ViewChannel.TILE_RESOURCE] > 0.5:
                    self.seen_resource.add(key)
                if vc[i, j, ViewChannel.TILE_RECON] > 0.5:
                    self.seen_recon.add(key)

    def _walkable(self, pos: tuple[int, int]) -> bool:
        x, y = pos
        if x < 0 or y < 0 or x >= self.grid_size or y >= self.grid_size:
            return False
        if pos in self.known_wall:
            return False
        return True

    def _bfs(self, start: tuple[int, int], targets: list[tuple[int, int]]):
        if not targets:
            return None, 0
        target_set = set(targets)
        if start in target_set:
            return 0, 0

        from collections import deque as dq

        parent: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
        first_dir: dict[tuple[int, int], int | None] = {start: None}
        queue = dq([start])
        deltas = [(1, 0), (0, 1), (-1, 0), (0, -1)]

        while queue:
            pos = queue.popleft()
            if pos in target_set:
                dist = abs(pos[0] - start[0]) + abs(pos[1] - start[1])
                cur = pos
                while parent[cur] is not None and parent[cur] != start:
                    cur = parent[cur]
                step = first_dir.get(cur, 0)
                return (step if step is not None else 0), dist

            for d, (dx, dy) in enumerate(deltas):
                nxt = (pos[0] + dx, pos[1] + dy)
                if nxt in parent or not self._walkable(nxt):
                    continue
                parent[nxt] = pos
                first_dir[nxt] = d if pos == start else first_dir[pos]
                queue.append(nxt)

        return None, 0

    def _frontier_targets(self) -> list[tuple[int, int]]:
        out = []
        for x, y in self.known_free:
            for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                nxt = (x + dx, y + dy)
                if (
                    0 <= nxt[0] < self.grid_size
                    and 0 <= nxt[1] < self.grid_size
                    and nxt not in self.known_free
                    and nxt not in self.known_wall
                ):
                    out.append(nxt)
        return out

    def compute_compass(self, obs: dict) -> tuple[int, float]:
        loc = obs["location"]
        start = (int(loc[0]), int(loc[1]))
        self.update_maps(obs)

        target_groups = [
            self.static_missions or list(self.seen_mission),
            self.static_resources or list(self.seen_resource),
            self.static_recons or list(self.seen_recon),
            list(self.seen_mission),
            list(self.seen_resource),
            list(self.seen_recon),
            self._frontier_targets(),
        ]

        for targets in target_groups:
            if not targets:
                continue
            direction, dist = self._bfs(start, targets)
            if direction is not None:
                return int(direction), float(dist)

        return int(obs["direction"]), float(self.grid_size)

    def compass_fields(self, obs: dict) -> tuple[int, float]:
        d, dist = self.compute_compass(obs)
        return d, dist


def probe_novice_static_compass(grid_size: int = 16) -> CompassState:
    """
    Novice static mission/resource/recon positions (episode seed 88 via dynamics).
    Shared by CompassDictWrapper and AEManager — do not use reset(seed=19).
    """
    from til_environment.bomberman_env import Bomberman
    from til_environment.config import default_config

    cfg = default_config()
    cfg.env.novice = True
    bomber = Bomberman(cfg=cfg)
    bomber.reset()
    state = CompassState(grid_size)
    state.probe_static(bomber)
    bomber.close()
    return state


class CompassDictWrapper(BaseWrapper):
    """Inject live compass_direction / compass_distance into the dict observation."""

    def __init__(self, env):
        super().__init__(env)
        self._compass_states: dict[AgentID, CompassState] = {}
        self._static_cache: CompassState | None = None
        self._static_probed = False
        bomber = _unwrap_bomberman(self.env)
        self._grid_size = int(bomber.grid_size)

    def reset(self, seed=None, options=None):
        self._compass_states = {}
        ret = super().reset(seed=seed, options=options)
        bomber = _unwrap_bomberman(self.env)
        if bool(bomber.cfg.env.novice) and not self._static_probed:
            self._static_cache = probe_novice_static_compass(self._grid_size)
            self._static_probed = True
        return ret

    def _state_for(self, agent: AgentID) -> CompassState:
        if agent not in self._compass_states:
            st = CompassState(self._grid_size)
            if self._static_cache is not None:
                st.copy_static_from(self._static_cache)
            self._compass_states[agent] = st
        return self._compass_states[agent]

    def observation_space(self, agent):
        base = super().observation_space(agent)
        return Dict(
            {
                **base.spaces,
                "compass_direction": Discrete(4),
                "compass_distance": Box(0.0, float(2 * self._grid_size), shape=(1,), dtype=np.float32),
            }
        )

    def observe(self, agent):
        obs = dict(super().observe(agent))
        if obs.get("step", 0) == 0:
            self._state_for(agent).reset_episode()
        comp_dir, comp_dist = self._state_for(agent).compass_fields(obs)
        obs["compass_direction"] = comp_dir
        obs["compass_distance"] = np.array([comp_dist], dtype=np.float32)
        return obs


class StackCoreAppendCompassWrapper(BaseWrapper):
    """
    Flatten core dict obs, stack STACK_SIZE frames, append current compass (5-d).
    """

    def __init__(self, env):
        super().__init__(env)
        bomber = _unwrap_bomberman(env)
        self._grid_size = int(bomber.grid_size)
        self._core_space = bomber.observation_space("agent_0")
        self._core_dim = int(flatten_space(self._core_space).shape[0])
        self._obs_dim = STACK_SIZE * self._core_dim + COMPASS_DIM
        self._frames: dict[AgentID, deque] = {}

    def observation_space(self, agent):
        return Box(
            -np.inf,
            np.inf,
            shape=(self._obs_dim,),
            dtype=np.float32,
        )

    def reset(self, seed=None, options=None):
        self._frames = {}
        return super().reset(seed=seed, options=options)

    def observe(self, agent):
        obs = dict(super().observe(agent))
        compass_dir = int(obs.pop("compass_direction"))
        compass_dist = float(np.asarray(obs.pop("compass_distance")).reshape(-1)[0])
        core_flat = flatten(self._core_space, obs)

        if agent not in self._frames:
            self._frames[agent] = deque(maxlen=STACK_SIZE)
        out = stack_core_append_compass(
            core_flat, self._frames[agent], compass_dir, compass_dist, self._grid_size
        )
        return out


def smoke_obs_dim_match() -> int:
    """Assert training env obs dim == AEManager policy input dim; return dim."""
    from til_environment.bomberman_env import basic_env
    from til_environment.config import default_config

    cfg = default_config()
    cfg.env.novice = True
    env = basic_env(
        cfg=cfg,
        env_wrappers=[CompassDictWrapper, StackCoreAppendCompassWrapper],
    )
    from pettingzoo.utils.conversions import aec_to_parallel
    import supersuit as ss
    from stable_baselines3.common.vec_env import VecMonitor

    env = ss.pad_observations_v0(env)
    env = ss.pad_action_space_v0(env)
    env = aec_to_parallel(env)
    env = ss.pettingzoo_env_to_vec_env_v1(env)
    env = ss.concat_vec_envs_v1(env, 1, 1, base_class="stable_baselines3")
    env = VecMonitor(env)
    env.reset()
    train_dim = int(env.observation_space.shape[0])

    mgr = AEManager()
    assert train_dim == mgr.observation_dim, (
        f"obs dim mismatch: train={train_dim} inference={mgr.observation_dim}"
    )
    env.close()
    print(f"[smoke] obs dim OK: {train_dim}")
    return train_dim


class AEManager:
    """AE Manager: PPO policy with compass + 4-frame core stack (matches training)."""

    def __init__(self):
        from til_environment.config import default_config

        cfg = default_config()
        cfg.env.novice = True
        self._core_space = build_core_obs_space(cfg)
        self._core_dim = int(flatten_space(self._core_space).shape[0])
        self._observation_dim = STACK_SIZE * self._core_dim + COMPASS_DIM
        self._grid_size = int(cfg.env.grid_size)

        self._compass = CompassState(self._grid_size)
        self._frames: deque = deque(maxlen=STACK_SIZE)
        self._static_probed = False

        try:
            from stable_baselines3 import PPO

            run_id = active_rl_run_id()
            iteration_best = rl_run_best_stem()
            deploy_best = rl_deploy_best_stem()

            if os.path.exists(deploy_best + ".zip"):
                self.model = PPO.load(deploy_best)
                print(f"Loaded deploy best from {deploy_best}")
            elif os.path.exists(iteration_best + ".zip"):
                self.model = PPO.load(iteration_best)
                print(f"Loaded {run_id} best from {iteration_best}")
            else:
                print("WARNING: No trained model found! Using random fallback.")
                self.model = None
        except Exception as e:
            print(f"WARNING: Could not load model: {e}")
            self.model = None

    @property
    def observation_dim(self) -> int:
        return self._observation_dim

    def _maybe_probe_static(self, observation: dict) -> None:
        if self._static_probed:
            return
        self._static_probed = True
        static = probe_novice_static_compass(self._grid_size)
        self._compass.copy_static_from(static)

    def build_policy_observation(self, observation: dict) -> np.ndarray:
        """Raw dict from til test → stacked core + live compass."""
        if int(observation.get("step", 0)) == 0:
            self._frames.clear()
            self._compass.reset_episode()
            self._maybe_probe_static(observation)

        core_flat = flatten_core_observation(observation, self._core_space)
        comp_dir, comp_dist = self._compass.compass_fields(observation)
        return stack_core_append_compass(
            core_flat, self._frames, comp_dir, comp_dist, self._grid_size
        )

    def ae(self, observation: dict) -> int:
        if self.model is None:
            import random

            legal = [i for i, m in enumerate(observation["action_mask"]) if m == 1]
            return random.choice(legal) if legal else 4

        flat_obs = self.build_policy_observation(observation)
        action, _ = self.model.predict(flat_obs, deterministic=True)
        action = int(action)

        if observation["action_mask"][action] == 0:
            legal = [i for i, m in enumerate(observation["action_mask"]) if m == 1]
            if legal:
                for preferred in [0, 2, 3, 1, 4]:
                    if preferred in legal:
                        return preferred
                return legal[0]
            return 4
        return action
