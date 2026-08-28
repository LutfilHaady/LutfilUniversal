# AE Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a rule-based AE agent for immediate submission, then replace it with a trained MaskablePPO policy for maximum score.

**Architecture:** Phase 1 — pure-Python rule-based agent in `ae/src/ae_manager.py`, no extra dependencies. Phase 2 — offline PPO training on GCP Workbench using `til_environment`, weights saved to `ae/models/ae_policy.zip`, loaded at inference time via `MaskablePPO.load()`.

**Tech Stack:** Python 3.11, stable-baselines3, sb3-contrib (MaskablePPO), PettingZoo, SuperSuit, PyTorch (CPU for inference), til_environment (training only).

> **Design corrections applied (2026-05-18):**
> 1. **Bomb escape path** — Priority 3 requires 2 confirmed backward cells clear (not just 1), matching the 3-step fuse + blast-radius-2 geometry.
> 2. **Training smoke test** — `train.py` accepts `--steps` flag; always run 10k steps first to validate the pipeline before committing to 5M.
> 3. **No self-play** — Removed self-play phase entirely to avoid rock-paper-scissors collapse. All 5M steps train against random opponents only.
> 4. **base_viewcone dropped** — Replaced 625-dim flattened base viewcone with a 3-dim summary (max enemy agent, max enemy bomb, max enemy bomb timer near base). OBS_DIM is now **892** (was 1514).

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `ae/src/ae_manager.py` | Modify | Phase 1: rule-based logic. Phase 2: PPO inference. |
| `ae/tests/conftest.py` | Create | Adds `ae/src/` to sys.path for test imports. |
| `ae/tests/test_ae_manager.py` | Create | Unit tests for rule-based priority logic. |
| `ae/tests/test_preprocessing.py` | Create | Unit tests for obs preprocessing function. |
| `ae/train/env_wrapper.py` | Create | Custom `gymnasium.Env` wrapping Bomberman (GCP Workbench only). |
| `ae/train/train.py` | Create | MaskablePPO training script (GCP Workbench only). |
| `ae/train/evaluate.py` | Create | Compare rule-based vs PPO over N episodes (GCP Workbench only). |
| `ae/requirements.txt` | Modify | Phase 2: add torch (CPU), stable-baselines3, sb3-contrib. |
| `ae/Dockerfile` | Modify | Phase 2: add `COPY models/ models/`. |

The `ae/train/` directory is **never copied into Docker** — it is training infrastructure only.

---

## Phase 1 — Rule-Based Agent

### Task 1: Test infrastructure and observation preprocessing

**Files:**
- Create: `ae/tests/conftest.py`
- Create: `ae/tests/test_preprocessing.py`
- Modify: `ae/src/ae_manager.py` (add `preprocess_obs` and channel constants)

- [ ] **Step 1.1: Create test conftest**

Create `ae/tests/conftest.py`:

```python
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
```

- [ ] **Step 1.2: Write failing tests for preprocessing**

Create `ae/tests/test_preprocessing.py`:

```python
import numpy as np
import pytest
from ae_manager import preprocess_obs


def _make_obs(**overrides):
    obs = {
        "agent_viewcone": [[[0.0] * 25 for _ in range(5)] for _ in range(7)],
        "base_viewcone":  [[[0.0] * 25 for _ in range(5)] for _ in range(5)],
        "direction": 0,
        "location": [8, 8],
        "base_location": [0, 0],
        "health": [60.0],
        "frozen_ticks": 0,
        "base_health": [100.0],
        "team_resources": [0.0],
        "team_bombs": 3,
        "step": 100,
        "action_mask": [1, 1, 1, 1, 1, 1],
    }
    obs.update(overrides)
    return obs


def test_output_shape():
    obs = preprocess_obs(_make_obs())
    assert obs.shape == (892,), f"Expected (892,), got {obs.shape}"


def test_output_dtype():
    obs = preprocess_obs(_make_obs())
    assert obs.dtype == np.float32


def test_direction_one_hot_zero():
    obs = preprocess_obs(_make_obs(direction=0))
    # Layout: agent_viewcone(875) + base_summary(3) = 878; direction starts at 878
    assert obs[878] == 1.0
    assert obs[879] == 0.0
    assert obs[880] == 0.0
    assert obs[881] == 0.0


def test_direction_one_hot_two():
    obs = preprocess_obs(_make_obs(direction=2))
    assert obs[878] == 0.0
    assert obs[880] == 1.0


def test_step_normalised():
    obs = preprocess_obs(_make_obs(step=200))
    # step is the last element (index 891)
    assert obs[-1] == pytest.approx(1.0)


def test_step_normalised_half():
    obs = preprocess_obs(_make_obs(step=100))
    assert obs[-1] == pytest.approx(0.5)


def test_health_normalised():
    obs = preprocess_obs(_make_obs(health=[30.0]))
    # health index: 878 (direction start) + 4 (direction) + 2 (loc) + 2 (bloc) = 886
    assert obs[886] == pytest.approx(0.5)


def test_location_normalised():
    obs = preprocess_obs(_make_obs(location=[15, 15]))
    # location at 878 + 4 = 882
    assert obs[882] == pytest.approx(1.0)
    assert obs[883] == pytest.approx(1.0)


def test_base_summary_enemy_detected():
    """base_summary[0] reflects max ENEMY_AGENT channel in base_viewcone."""
    obs_dict = _make_obs()
    # Place enemy agent in base_viewcone at center (2,2), channel 10 (ENEMY_AGENT)
    obs_dict["base_viewcone"][2][2][10] = 1.0
    obs = preprocess_obs(obs_dict)
    # base_summary starts at index 875
    assert obs[875] == pytest.approx(1.0)   # enemy agent present
    assert obs[876] == pytest.approx(0.0)   # no enemy bomb
```

- [ ] **Step 1.3: Run tests — expect ImportError (function not written yet)**

```bash
cd "C:\Users\lutfi\OneDrive\Desktop\Brainhack 2026"
python -m pytest ae/tests/test_preprocessing.py -v
```

Expected: `ImportError: cannot import name 'preprocess_obs' from 'ae_manager'`

- [ ] **Step 1.4: Add channel constants and preprocess_obs to ae_manager.py**

Replace the entire contents of `ae/src/ae_manager.py` with:

```python
"""Manages the AE model."""

import numpy as np

# ---------------------------------------------------------------------------
# ViewChannel indices (matches til_environment/observation.py ViewChannel enum)
# ---------------------------------------------------------------------------
VISIBLE = 0
WALL_RIGHT, WALL_DOWN, WALL_LEFT, WALL_UP = 1, 2, 3, 4
TILE_EMPTY, TILE_RECON, TILE_MISSION, TILE_RESOURCE = 5, 6, 7, 8
ALLY_AGENT, ENEMY_AGENT = 9, 10
ALLY_BASE, ENEMY_BASE = 11, 12
ALLY_BOMB, ENEMY_BOMB = 17, 18
ALLY_BOMB_TIMER, ENEMY_BOMB_TIMER = 19, 20

# ---------------------------------------------------------------------------
# Action indices
# ---------------------------------------------------------------------------
FORWARD, BACKWARD, LEFT, RIGHT, STAY, PLACE_BOMB = 0, 1, 2, 3, 4, 5

# ---------------------------------------------------------------------------
# Viewcone geometry
# ---------------------------------------------------------------------------
AGENT_ROW = 2   # agent's row in 7×5 viewcone (0-indexed)
AGENT_COL = 2   # agent's col in 7×5 viewcone (0-indexed)
BLAST_RADIUS = 2
BOMB_DANGER_TIMER = 2
STUCK_THRESHOLD = 4


def preprocess_obs(obs: dict) -> np.ndarray:
    """Flatten and normalise observation dict into an 892-dim float32 vector.

    Layout (in order):
        agent_viewcone  7×5×25 = 875
        base_summary    3          (max enemy agent, max enemy bomb, max enemy bomb timer /3)
        direction       one-hot 4
        location        /15    2
        base_location   /15    2
        health          /60    1
        frozen_ticks    /3     1
        base_health     /100   1
        team_resources  /1.5   1
        team_bombs      /50    1
        step            /200   1
        ──────────────────────────
        Total                892

    base_viewcone (625 raw dims) is summarised into 3 values to avoid feeding
    41% noisy/static data to the MLP. The three values capture the only
    tactically relevant signals: whether enemies or their bombs are near the base.
    """
    vc  = np.array(obs["agent_viewcone"], dtype=np.float32).flatten()   # 875

    bvc = np.array(obs["base_viewcone"], dtype=np.float32)               # 5×5×25
    base_summary = np.array([
        float(bvc[..., 10].max()),          # ENEMY_AGENT: any enemy near base?
        float(bvc[..., 18].max()),          # ENEMY_BOMB: any enemy bomb near base?
        float(bvc[..., 20].max()) / 3.0,   # ENEMY_BOMB_TIMER: how urgent? (norm by fuse=3)
    ], dtype=np.float32)                                                  # 3

    direction = np.zeros(4, dtype=np.float32)
    direction[int(obs["direction"])] = 1.0                               # 4

    loc  = np.array(obs["location"],      dtype=np.float32) / 15.0      # 2
    bloc = np.array(obs["base_location"], dtype=np.float32) / 15.0      # 2

    health = np.array(obs["health"],        dtype=np.float32) / 60.0    # 1
    ft     = np.array([obs["frozen_ticks"]], dtype=np.float32) / 3.0    # 1
    bh     = np.array(obs["base_health"],   dtype=np.float32) / 100.0   # 1
    tr     = np.array(obs["team_resources"], dtype=np.float32) / 1.5    # 1
    tb     = np.array([obs["team_bombs"]],  dtype=np.float32) / 50.0    # 1
    step   = np.array([obs["step"]],        dtype=np.float32) / 200.0   # 1

    return np.concatenate([vc, base_summary, direction, loc, bloc, health, ft, bh, tr, tb, step])


class AEManager:

    def __init__(self):
        self.last_location = None
        self.stuck_counter = 0

    def ae(self, observation: dict[str, int | list]) -> int:
        return 0  # placeholder — replaced in Task 2
```

- [ ] **Step 1.5: Run tests — expect all to pass**

```bash
python -m pytest ae/tests/test_preprocessing.py -v
```

Expected output:
```
PASSED ae/tests/test_preprocessing.py::test_output_shape
PASSED ae/tests/test_preprocessing.py::test_output_dtype
PASSED ae/tests/test_preprocessing.py::test_direction_one_hot_zero
PASSED ae/tests/test_preprocessing.py::test_direction_one_hot_two
PASSED ae/tests/test_preprocessing.py::test_step_normalised
PASSED ae/tests/test_preprocessing.py::test_step_normalised_half
PASSED ae/tests/test_preprocessing.py::test_health_normalised
PASSED ae/tests/test_preprocessing.py::test_location_normalised
PASSED ae/tests/test_preprocessing.py::test_base_summary_enemy_detected
9 passed
```

- [ ] **Step 1.6: Commit**

```bash
git add ae/tests/conftest.py ae/tests/test_preprocessing.py ae/src/ae_manager.py
git commit -m "feat(ae): add obs preprocessing + test infrastructure"
```

---

### Task 2: Rule-based AEManager logic

**Files:**
- Modify: `ae/src/ae_manager.py`
- Create: `ae/tests/test_ae_manager.py`

- [ ] **Step 2.1: Write failing tests for rule-based logic**

Create `ae/tests/test_ae_manager.py`:

```python
import pytest
from ae_manager import AEManager, FORWARD, BACKWARD, LEFT, RIGHT, STAY, PLACE_BOMB


def _make_obs(**overrides):
    """Base observation: empty viewcone, all actions legal."""
    viewcone = [[[0.0] * 25 for _ in range(5)] for _ in range(7)]
    viewcone[2][2][0] = 1.0   # VISIBLE: agent's own cell
    viewcone[2][2][5] = 1.0   # TILE_EMPTY: agent's own cell
    obs = {
        "agent_viewcone": viewcone,
        "base_viewcone":  [[[0.0] * 25 for _ in range(5)] for _ in range(5)],
        "direction": 0,
        "location": [8, 8],
        "base_location": [0, 0],
        "health": [60.0],
        "frozen_ticks": 0,
        "base_health": [100.0],
        "team_resources": [0.0],
        "team_bombs": 3,
        "step": 0,
        "action_mask": [1, 1, 1, 1, 1, 1],
    }
    obs.update(overrides)
    return obs


def _set_channel(viewcone, row, col, channel, value=1.0):
    viewcone[row][col][channel] = value


# ── Priority 1: frozen ────────────────────────────────────────────────────────

def test_frozen_returns_stay():
    mgr = AEManager()
    obs = _make_obs(frozen_ticks=2)
    assert mgr.ae(obs) == STAY


# ── Priority 2: bomb evasion ──────────────────────────────────────────────────

def test_evades_bomb_ahead():
    """Enemy bomb 1 step ahead with timer=2 → move BACKWARD."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 3, 2, 18, 1.0)   # ENEMY_BOMB at row 3 (1 ahead)
    _set_channel(vc, 3, 2, 20, 2.0)   # ENEMY_BOMB_TIMER = 2
    _set_channel(vc, 3, 2, 0,  1.0)   # VISIBLE
    assert mgr.ae(obs) == BACKWARD


def test_evades_bomb_behind():
    """Enemy bomb 1 step behind with timer=1 → move FORWARD."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 1, 2, 18, 1.0)   # ENEMY_BOMB at row 1 (1 behind)
    _set_channel(vc, 1, 2, 20, 1.0)   # ENEMY_BOMB_TIMER = 1
    _set_channel(vc, 1, 2, 0,  1.0)   # VISIBLE
    assert mgr.ae(obs) == FORWARD


def test_safe_bomb_high_timer_ignored():
    """Bomb with timer=4 is not dangerous — agent explores normally."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 3, 2, 18, 1.0)
    _set_channel(vc, 3, 2, 20, 4.0)   # timer=4 > BOMB_DANGER_TIMER=2
    _set_channel(vc, 3, 2, 0,  1.0)
    # No danger — falls through to exploration
    assert mgr.ae(obs) == FORWARD


# ── Priority 3: place bomb on adjacent enemy ──────────────────────────────────

def test_places_bomb_on_enemy_ahead():
    """Enemy 1 step ahead, bombs available, 2 clear backward cells → PLACE_BOMB."""
    mgr = AEManager()
    obs = _make_obs(team_bombs=2)
    vc = obs["agent_viewcone"]
    _set_channel(vc, 3, 2, 10, 1.0)   # ENEMY_AGENT at row 3 (1 ahead)
    _set_channel(vc, 3, 2, 0,  1.0)   # VISIBLE
    # Must mark both backward cells visible so escape path check passes
    _set_channel(vc, 1, 2, 0, 1.0)    # row 1 visible (1 step behind)
    _set_channel(vc, 0, 2, 0, 1.0)    # row 0 visible (2 steps behind)
    assert mgr.ae(obs) == PLACE_BOMB


def test_no_bomb_when_bombs_unavailable():
    """Enemy adjacent but team_bombs=0 → cannot place bomb."""
    mgr = AEManager()
    obs = _make_obs(team_bombs=0)
    vc = obs["agent_viewcone"]
    _set_channel(vc, 3, 2, 10, 1.0)
    _set_channel(vc, 3, 2, 0,  1.0)
    result = mgr.ae(obs)
    assert result != PLACE_BOMB


def test_no_bomb_when_escape_path_too_short():
    """Enemy ahead, bombs available, but only 1 backward cell visible → no bomb."""
    mgr = AEManager()
    obs = _make_obs(team_bombs=2)
    vc = obs["agent_viewcone"]
    _set_channel(vc, 3, 2, 10, 1.0)   # ENEMY_AGENT at row 3 (1 ahead)
    _set_channel(vc, 3, 2, 0,  1.0)   # VISIBLE
    _set_channel(vc, 1, 2, 0, 1.0)    # row 1 visible (1 step behind)
    # row 0 (2 steps behind) stays VISIBLE=0 → path too short
    result = mgr.ae(obs)
    assert result != PLACE_BOMB


# ── Priority 4: navigate to mission ──────────────────────────────────────────

def test_navigates_forward_to_mission_ahead():
    """Mission 2 steps ahead, same column → FORWARD."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 4, 2, 7, 1.0)    # TILE_MISSION at row 4, col 2
    _set_channel(vc, 4, 2, 0, 1.0)    # VISIBLE
    assert mgr.ae(obs) == FORWARD


def test_turns_left_toward_mission():
    """Mission ahead but to the left → turn LEFT first."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 4, 1, 7, 1.0)    # TILE_MISSION at row 4, col 1 (left)
    _set_channel(vc, 4, 1, 0, 1.0)    # VISIBLE
    assert mgr.ae(obs) == LEFT


def test_turns_right_toward_mission():
    """Mission ahead but to the right → turn RIGHT first."""
    mgr = AEManager()
    obs = _make_obs()
    vc = obs["agent_viewcone"]
    _set_channel(vc, 4, 3, 7, 1.0)    # TILE_MISSION at row 4, col 3 (right)
    _set_channel(vc, 4, 3, 0, 1.0)    # VISIBLE
    assert mgr.ae(obs) == RIGHT


# ── Priority 9: action_mask respected ────────────────────────────────────────

def test_respects_action_mask_on_forward():
    """FORWARD masked (wall ahead) → falls back to RIGHT."""
    mgr = AEManager()
    obs = _make_obs(action_mask=[0, 1, 1, 1, 1, 1])
    assert mgr.ae(obs) == RIGHT


# ── Stuck detection ───────────────────────────────────────────────────────────

def test_stuck_detection_forces_turn():
    """Same location for 4 steps → forces RIGHT turn."""
    mgr = AEManager()
    obs = _make_obs(location=[5, 5], action_mask=[0, 1, 1, 1, 1, 1])
    for _ in range(3):
        mgr.ae(obs)   # increment stuck counter
    result = mgr.ae(obs)
    assert result == RIGHT
```

- [ ] **Step 2.2: Run tests — expect failures**

```bash
python -m pytest ae/tests/test_ae_manager.py -v
```

Expected: all tests fail because `AEManager.ae()` returns `0` unconditionally.

- [ ] **Step 2.3: Implement full rule-based AEManager.ae() and helpers**

Replace the `AEManager` class in `ae/src/ae_manager.py` (keep all the constants and `preprocess_obs` above it):

```python
class AEManager:

    def __init__(self):
        self.last_location = None
        self.stuck_counter = 0

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def ae(self, observation: dict) -> int:
        vc          = observation["agent_viewcone"]   # 7×5×25 list
        mask        = observation["action_mask"]       # [1,1,1,1,1,0]
        frozen      = observation["frozen_ticks"]
        team_bombs  = observation["team_bombs"]
        loc         = observation["location"]

        def ok(action: int) -> bool:
            return bool(mask[action])

        # Update stuck detection
        if self.last_location == loc:
            self.stuck_counter += 1
        else:
            self.stuck_counter = 0
            self.last_location = list(loc)

        # ── Priority 1: frozen ─────────────────────────────────────────
        if frozen > 0:
            return STAY

        # ── Priority 2: bomb evasion ───────────────────────────────────
        danger, bomb_row, _ = self._bomb_danger(vc)
        if danger:
            evade = FORWARD if bomb_row <= AGENT_ROW else BACKWARD
            if ok(evade):
                return evade

        # ── Priority 3: bomb adjacent enemy ───────────────────────────
        # Requires 2 confirmed backward cells clear: with blast_radius=2 and
        # timer=3 steps, the agent needs 3 steps of escape distance. We verify
        # the 2 visible backward cells; the 3rd is assumed clear if 2 are clear.
        if team_bombs > 0 and ok(PLACE_BOMB) and self._safe_to_bomb(vc, mask):
            ahead_cell = vc[AGENT_ROW + 1][AGENT_COL]
            if ahead_cell[ENEMY_AGENT] > 0:
                return PLACE_BOMB

        # ── Priority 4-6: navigate to nearest valuable tile ────────────
        target = self._nearest_tile(vc, [TILE_MISSION, TILE_RESOURCE, TILE_RECON])
        if target is not None:
            action = self._navigate(target[0], target[1], mask)
            if action is not None:
                return action

        # ── Priority 7: navigate to enemy base ────────────────────────
        target = self._nearest_tile(vc, [ENEMY_BASE])
        if target is not None:
            if team_bombs > 0 and ok(PLACE_BOMB):
                dr = abs(target[0] - AGENT_ROW)
                dc = abs(target[1] - AGENT_COL)
                if dr + dc <= 1:
                    return PLACE_BOMB
            action = self._navigate(target[0], target[1], mask)
            if action is not None:
                return action

        # ── Priority 8: stuck detection ────────────────────────────────
        if self.stuck_counter >= STUCK_THRESHOLD:
            self.stuck_counter = 0
            if ok(RIGHT):
                return RIGHT

        # ── Priority 9: default exploration ───────────────────────────
        if ok(FORWARD):
            return FORWARD
        if ok(RIGHT):
            return RIGHT
        if ok(LEFT):
            return LEFT
        return STAY

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _bomb_danger(self, vc: list) -> tuple:
        """Return (True, bomb_row, bomb_col) if agent is in blast range of a
        soon-detonating bomb; otherwise (False, -1, -1)."""
        for row in range(7):
            for col in range(5):
                cell = vc[row][col]
                for timer_ch in (ALLY_BOMB_TIMER, ENEMY_BOMB_TIMER):
                    timer = cell[timer_ch]
                    if 0 < timer <= BOMB_DANGER_TIMER:
                        dr = abs(AGENT_ROW - row)
                        dc = abs(AGENT_COL - col)
                        in_blast = (dr == 0 and dc <= BLAST_RADIUS) or \
                                   (dc == 0 and dr <= BLAST_RADIUS)
                        if in_blast:
                            return True, row, col
        return False, -1, -1

    def _safe_to_bomb(self, vc: list, mask: list) -> bool:
        """Return True only if BACKWARD is legal and 2 backward cells are visible.

        With blast_radius=2 and fuse=3, the agent must travel 3 cells to escape.
        We can only confirm rows 0-1 (2 cells behind) from the viewcone. Both
        must be visible (non-visible implies a wall is blocking that corridor).
        """
        if not mask[BACKWARD]:
            return False
        row1 = vc[1][AGENT_COL]   # 1 step behind
        row0 = vc[0][AGENT_COL]   # 2 steps behind
        return bool(row1[VISIBLE]) and bool(row0[VISIBLE])

    def _nearest_tile(self, vc: list, channels: list) -> tuple | None:
        """Return (row, col) of the nearest visible tile matching any channel."""
        best, best_dist = None, float("inf")
        for row in range(7):
            for col in range(5):
                cell = vc[row][col]
                if not cell[VISIBLE]:
                    continue
                for ch in channels:
                    if cell[ch] > 0:
                        dist = abs(row - AGENT_ROW) + abs(col - AGENT_COL)
                        if dist < best_dist:
                            best_dist = dist
                            best = (row, col)
        return best

    def _navigate(self, target_row: int, target_col: int, mask: list) -> int | None:
        """Return the best single action toward (target_row, target_col).

        Aligns column before row: turn left/right first, then move forward/back.
        Returns None if no valid action found.
        """
        def ok(a: int) -> bool:
            return bool(mask[a])

        if target_col < AGENT_COL and ok(LEFT):
            return LEFT
        if target_col > AGENT_COL and ok(RIGHT):
            return RIGHT
        if target_row > AGENT_ROW and ok(FORWARD):
            return FORWARD
        if target_row < AGENT_ROW and ok(BACKWARD):
            return BACKWARD
        return None
```

- [ ] **Step 2.4: Run all tests — expect all to pass**

```bash
python -m pytest ae/tests/ -v
```

Expected: all 18+ tests pass (includes new escape-path test).

- [ ] **Step 2.5: Commit**

```bash
git add ae/src/ae_manager.py ae/tests/test_ae_manager.py
git commit -m "feat(ae): implement rule-based agent with bomb evasion and tile navigation"
```

---

### Task 3: Phase 1 Docker build and submission

**Files:**
- No code changes needed — rule-based agent uses only built-in Python + fastapi/uvicorn

- [ ] **Step 3.1: Verify requirements.txt is sufficient**

The rule-based `AEManager` uses only Python builtins. No numpy import is needed in `ae_manager.py` for Phase 1 — `preprocess_obs` uses numpy but is not called by the rule-based `ae()`. Confirm `ae/requirements.txt` still reads:

```
fastapi
uvicorn[standard]
```

If it already has those two lines, nothing to change.

- [ ] **Step 3.2: Build Docker image (on GCP Workbench)**

```bash
til build ae
```

Expected: image builds successfully.

- [ ] **Step 3.3: Test locally (on GCP Workbench)**

```bash
til test ae
```

Expected: test script runs, agent returns valid integer actions, no crashes.

- [ ] **Step 3.4: Submit Phase 1**

```bash
til submit ae
```

Expected: submission notification in Discord. This is your safe baseline score.

---

## Phase 2 — PPO Training Pipeline

> All tasks from here run on **GCP Workbench** (Linux, GPU). The `ae/train/` directory is never copied into Docker.

### Task 4: Environment wrapper

**Files:**
- Create: `ae/train/env_wrapper.py`

- [ ] **Step 4.1: Install training dependencies on GCP Workbench**

```bash
pip install pettingzoo supersuit sb3-contrib stable-baselines3
```

These are already available if you ran `pip install -r requirements-dev.txt` from the repo root. If not, install them now.

- [ ] **Step 4.2: Create ae/train/ directory**

```bash
mkdir -p ae/train
touch ae/train/__init__.py
```

- [ ] **Step 4.3: Write env_wrapper.py**

Create `ae/train/env_wrapper.py`:

```python
"""Custom gymnasium.Env wrapping Bomberman for single-agent MaskablePPO training.

Controls agent_0. All other agents take uniformly random valid actions.
This produces a Gym-compatible env with action_masks() for sb3_contrib.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import numpy as np
import gymnasium as gym
from til_environment.bomberman_env import Bomberman

CONTROLLED = "agent_0"
OBS_DIM    = 892   # 875 + 3 + 4 + 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1
N_ACTIONS  = 6
STAY       = 4

# Reward shaping constants
STEP_PENALTY       = -0.01
STATIONARY_PENALTY = -0.02
EXPLORE_BONUS      = 0.10
REWARD_SCALE       = 50.0


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
    """Single-agent Gym wrapper around the 6-agent Bomberman environment."""

    metadata = {}

    def __init__(self):
        super().__init__()
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(OBS_DIM,), dtype=np.float32
        )
        self.action_space = gym.spaces.Discrete(N_ACTIONS)
        self._mask    = np.ones(N_ACTIONS, dtype=bool)
        self._visited = set()
        self._env     = None
        self._iter    = None

    # ------------------------------------------------------------------ #
    # Gym API                                                              #
    # ------------------------------------------------------------------ #

    def reset(self, seed=None, options=None):
        if self._env is not None:
            self._env.close()
        self._env     = Bomberman()
        self._visited = set()
        self._env.reset(seed=seed)
        self._iter = iter(self._env.agent_iter())

        obs, mask = self._advance_to_controlled()
        self._mask = mask
        return obs, {}

    def step(self, action: int):
        # Submit action for controlled agent
        self._env.step(int(action))
        raw_reward = float(self._env.rewards.get(CONTROLLED, 0.0))

        # Check episode end
        term  = self._env.terminations.get(CONTROLLED, False)
        trunc = self._env.truncations.get(CONTROLLED, False)

        if term or trunc:
            shaped = self._shape(raw_reward, action, None)
            return np.zeros(OBS_DIM, dtype=np.float32), shaped, term, trunc, {}

        obs, mask = self._advance_to_controlled()
        self._mask = mask
        shaped = self._shape(raw_reward, action, obs)
        return obs, shaped, False, False, {}

    def action_masks(self) -> np.ndarray:
        return self._mask.copy()

    def close(self):
        if self._env is not None:
            self._env.close()
            self._env = None

    # ------------------------------------------------------------------ #
    # Internal helpers                                                      #
    # ------------------------------------------------------------------ #

    def _advance_to_controlled(self):
        """Step other agents with random valid actions until agent_0's turn."""
        for agent in self._iter:
            obs_dict, _, term, trunc, _ = self._env.last()

            if agent == CONTROLLED:
                mask = np.array(
                    obs_dict.get("action_mask", [1] * N_ACTIONS), dtype=bool
                )
                return _preprocess(obs_dict), mask

            if term or trunc:
                self._env.step(None)
            else:
                raw_mask = obs_dict.get("action_mask", [1] * N_ACTIONS)
                valid    = [i for i, v in enumerate(raw_mask) if v]
                a        = int(np.random.choice(valid)) if valid else STAY
                self._env.step(a)

        return np.zeros(OBS_DIM, dtype=np.float32), np.ones(N_ACTIONS, dtype=bool)

    def _shape(self, base: float, action: int, obs) -> float:
        shaped  = base
        shaped += STEP_PENALTY

        if action == STAY:
            shaped += STATIONARY_PENALTY

        if obs is not None:
            loc = tuple(self._env.agents)  # proxy: any new state = new position
            loc_key = tuple(self._env.rewards.keys())
            if loc_key not in self._visited:
                self._visited.add(loc_key)
                shaped += EXPLORE_BONUS

        return shaped / REWARD_SCALE
```

- [ ] **Step 4.4: Smoke-test the wrapper on GCP Workbench**

```bash
cd /path/to/til-26   # repo root on GCP Workbench
python - <<'EOF'
import sys
sys.path.insert(0, 'ae/train')
from env_wrapper import AETrainEnv
import numpy as np

env = AETrainEnv()
obs, info = env.reset(seed=42)
print("obs shape:", obs.shape)      # expect (892,)
print("obs dtype:", obs.dtype)      # expect float32
print("mask:", env.action_masks())  # expect array of True/False

for _ in range(5):
    action = int(np.argmax(env.action_masks()))  # pick first legal action
    obs, reward, term, trunc, _ = env.step(action)
    print(f"  reward={reward:.3f}  term={term}  trunc={trunc}")

env.close()
print("Smoke test passed.")
EOF
```

Expected output: 5 reward lines, no exceptions, "Smoke test passed."

- [ ] **Step 4.5: Commit**

```bash
git add ae/train/__init__.py ae/train/env_wrapper.py
git commit -m "feat(ae): add AETrainEnv gym wrapper for MaskablePPO training"
```

---

### Task 5: Training script

**Files:**
- Create: `ae/train/train.py`

- [ ] **Step 5.1: Write train.py**

Create `ae/train/train.py`:

```python
"""Train a MaskablePPO policy for the AE challenge.

Run from the repo root on GCP Workbench:
    # Smoke test first (always do this before the full run):
    python ae/train/train.py --steps 10000

    # Full training run:
    python ae/train/train.py

Checkpoints saved to ae/models/ every 500k steps.
Final model saved to ae/models/ae_policy.zip.

Common failure modes:
    OOM error        → reduce N_ENVS (try 4)
    NaN policy loss  → reduce learning_rate to 1e-4
    Env never steps  → check _advance_to_controlled prints in env_wrapper
"""

import sys, os, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

import numpy as np
from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor
from stable_baselines3.common.callbacks import CheckpointCallback
from sb3_contrib import MaskablePPO
from env_wrapper import AETrainEnv

MODELS_DIR  = os.path.join(os.path.dirname(__file__), "..", "models")
N_ENVS      = 8          # reduce to 4 if OOM
DEFAULT_STEPS = 5_000_000  # ~4-6 hours on GPU
SAVE_FREQ   = 500_000    # steps between checkpoints

os.makedirs(MODELS_DIR, exist_ok=True)


def make_env(rank: int):
    def _init():
        env = AETrainEnv()
        return env
    return _init


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=DEFAULT_STEPS,
                        help="Total training steps (use 10000 for smoke test)")
    args = parser.parse_args()
    total_steps = args.steps

    print(f"Training MaskablePPO for {total_steps:,} steps with {N_ENVS} envs...")

    # Vectorised environment — SubprocVecEnv runs each env in a separate process
    vec_env = SubprocVecEnv([make_env(i) for i in range(N_ENVS)])
    vec_env = VecMonitor(vec_env)  # wraps to log episode reward/length

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
        ent_coef=0.01,
        verbose=1,
        tensorboard_log=os.path.join(MODELS_DIR, "tb_logs"),
        policy_kwargs=dict(net_arch=[512, 512, 256]),
    )

    # Save a checkpoint every SAVE_FREQ steps
    checkpoint_cb = CheckpointCallback(
        save_freq=SAVE_FREQ // N_ENVS,  # per-env steps
        save_path=MODELS_DIR,
        name_prefix="ae_ckpt",
    )

    model.learn(
        total_timesteps=total_steps,
        callback=[checkpoint_cb],
        progress_bar=True,
    )

    final_path = os.path.join(MODELS_DIR, "ae_policy")
    model.save(final_path)
    print(f"\nSaved final model to {final_path}.zip")

    vec_env.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 5.2: Run smoke test first (10k steps)**

Always run the smoke test before committing to the full 5M-step run. It catches OOM errors, import issues, and env bugs in ~2 minutes.

```bash
# From repo root on GCP Workbench
python ae/train/train.py --steps 10000
```

Expected output:
```
Training MaskablePPO for 10,000 steps with 8 envs...
Using cuda device
...
Saved final model to ae/models/ae_policy.zip
```

If it crashes:
- `CUDA out of memory` → edit `N_ENVS = 4` in train.py and retry
- `NaN` in loss → edit `learning_rate=1e-4` in the `MaskablePPO(...)` call and retry
- `StopIteration` or env hangs → check `_advance_to_controlled` in env_wrapper.py

Only proceed to Step 5.3 once the smoke test completes without error.

- [ ] **Step 5.3: Start full training run**

```bash
# From repo root on GCP Workbench
python ae/train/train.py
```

Expected output (first few lines):
```
Training MaskablePPO for 5,000,000 steps with 8 envs...
Using cuda device
Logging to ae/models/tb_logs/...
---------------------------------
| rollout/            |         |
|    ep_len_mean      | 200     |
|    ep_rew_mean      | -0.xxx  |
| time/               |         |
|    fps              | xxxx    |
...
```

Let this run in the background. Open a second terminal for the next task.

- [ ] **Step 5.4: Commit training script**

```bash
git add ae/train/train.py
git commit -m "feat(ae): add MaskablePPO training script"
```

---

### Task 6: Evaluation script

**Files:**
- Create: `ae/train/evaluate.py`

- [ ] **Step 6.1: Write evaluate.py**

Create `ae/train/evaluate.py`:

```python
"""Compare rule-based agent vs trained PPO model over N episodes.

Usage (from repo root on GCP Workbench):
    python ae/train/evaluate.py --model ae/models/ae_policy.zip --episodes 20
"""

import sys, os, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

import numpy as np
from til_environment.bomberman_env import Bomberman
from ae_manager import AEManager, preprocess_obs

CONTROLLED = "agent_0"
STAY = 4


def run_rule_based(n_episodes: int) -> list[float]:
    rewards = []
    for ep in range(n_episodes):
        env = Bomberman()
        env.reset(seed=ep)
        mgr = AEManager()
        ep_reward = 0.0
        for agent in env.agent_iter():
            obs_dict, reward, term, trunc, _ = env.last()
            if agent == CONTROLLED:
                ep_reward += reward
            if term or trunc:
                env.step(None)
                continue
            if agent == CONTROLLED:
                action = mgr.ae(obs_dict)
            else:
                raw_mask = obs_dict.get("action_mask", [1] * 6)
                valid = [i for i, v in enumerate(raw_mask) if v]
                action = int(np.random.choice(valid)) if valid else STAY
            env.step(action)
        env.close()
        rewards.append(ep_reward)
        print(f"[rule-based] ep {ep+1}/{n_episodes}  reward={ep_reward:.1f}")
    return rewards


def run_ppo(model_path: str, n_episodes: int) -> list[float]:
    from sb3_contrib import MaskablePPO
    model = MaskablePPO.load(model_path)
    rewards = []
    for ep in range(n_episodes):
        env = Bomberman()
        env.reset(seed=ep)
        ep_reward = 0.0
        for agent in env.agent_iter():
            obs_dict, reward, term, trunc, _ = env.last()
            if agent == CONTROLLED:
                ep_reward += reward
            if term or trunc:
                env.step(None)
                continue
            if agent == CONTROLLED:
                obs_vec = preprocess_obs(obs_dict)
                mask    = np.array(obs_dict.get("action_mask", [1]*6), dtype=bool)
                action, _ = model.predict(obs_vec, action_masks=mask, deterministic=True)
                action = int(action)
            else:
                raw_mask = obs_dict.get("action_mask", [1]*6)
                valid = [i for i, v in enumerate(raw_mask) if v]
                action = int(np.random.choice(valid)) if valid else STAY
            env.step(action)
        env.close()
        rewards.append(ep_reward)
        print(f"[ppo]        ep {ep+1}/{n_episodes}  reward={ep_reward:.1f}")
    return rewards


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",    required=True, help="Path to ae_policy.zip")
    parser.add_argument("--episodes", type=int, default=20)
    args = parser.parse_args()

    print("=== Rule-based agent ===")
    rb_rewards  = run_rule_based(args.episodes)
    print(f"\nMean: {np.mean(rb_rewards):.2f}  Std: {np.std(rb_rewards):.2f}")

    print("\n=== PPO model ===")
    ppo_rewards = run_ppo(args.model, args.episodes)
    print(f"\nMean: {np.mean(ppo_rewards):.2f}  Std: {np.std(ppo_rewards):.2f}")

    rb_mean  = np.mean(rb_rewards)
    ppo_mean = np.mean(ppo_rewards)
    margin   = (ppo_mean - rb_mean) / (abs(rb_mean) + 1e-8) * 100

    print(f"\n=== Verdict ===")
    print(f"Rule-based mean reward: {rb_mean:.2f}")
    print(f"PPO mean reward:        {ppo_mean:.2f}")
    print(f"PPO improvement:        {margin:+.1f}%")
    if margin > 10:
        print("→ PPO wins by >10%. Swap ae_manager.py to use PPO model.")
    else:
        print("→ PPO did not beat rule-based by 10%. Keep rule-based or train longer.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6.2: Run evaluation after training completes**

```bash
python ae/train/evaluate.py --model ae/models/ae_policy.zip --episodes 20
```

Expected output (after sufficient training):
```
=== Rule-based agent ===
[rule-based] ep 1/20  reward=xx.x
...
Mean: xx.xx  Std: xx.xx

=== PPO model ===
[ppo]        ep 1/20  reward=xx.x
...
Mean: xx.xx  Std: xx.xx

=== Verdict ===
Rule-based mean reward: xx.xx
PPO mean reward:        xx.xx
PPO improvement:        +xx.x%
→ PPO wins by >10%. Swap ae_manager.py to use PPO model.
```

If PPO does not win, return to Task 5 — extend training time (`TOTAL_STEPS`) or tune reward shaping. Use the best checkpoint from `ae/models/ae_ckpt_*.zip` rather than the final if the final diverged.

- [ ] **Step 6.3: Commit**

```bash
git add ae/train/evaluate.py
git commit -m "feat(ae): add rule-based vs PPO evaluation script"
```

---

### Task 7: PPO AEManager + Phase 2 Docker + submission

**Files:**
- Modify: `ae/src/ae_manager.py`
- Modify: `ae/requirements.txt`
- Modify: `ae/Dockerfile`

- [ ] **Step 7.1: Write tests for PPO AEManager**

Add to `ae/tests/test_ae_manager.py`:

```python
# ── PPO AEManager ─────────────────────────────────────────────────────────────
# These tests use a mock model to avoid needing actual weights.

class _MockModel:
    """Stub that always returns action 0 (FORWARD)."""
    def predict(self, obs, action_masks=None, deterministic=True):
        return np.array(0), None


def test_ppo_manager_returns_valid_action(monkeypatch):
    """PPO AEManager calls model.predict and returns its action."""
    import ae_manager as am

    # Patch MaskablePPO.load to return our mock
    monkeypatch.setattr(
        "ae_manager.MaskablePPO.load",
        lambda path: _MockModel(),
    )

    mgr = am.PPOAEManager(model_path="fake/path.zip")
    obs = _make_obs()
    result = mgr.ae(obs)
    assert result == FORWARD


def test_ppo_manager_respects_mask(monkeypatch):
    """PPO AEManager passes action_mask to model.predict."""
    import ae_manager as am

    received_masks = []

    class _MaskCapture:
        def predict(self, obs, action_masks=None, deterministic=True):
            received_masks.append(action_masks.tolist())
            return np.array(0), None

    monkeypatch.setattr("ae_manager.MaskablePPO.load", lambda path: _MaskCapture())
    mgr = am.PPOAEManager(model_path="fake/path.zip")
    obs = _make_obs(action_mask=[1, 0, 1, 0, 1, 0])
    mgr.ae(obs)
    assert received_masks[0] == [True, False, True, False, True, False]
```

- [ ] **Step 7.2: Run new tests — expect ImportError (PPOAEManager not written yet)**

```bash
python -m pytest ae/tests/test_ae_manager.py::test_ppo_manager_returns_valid_action -v
```

Expected: `ImportError: cannot import name 'PPOAEManager'`

- [ ] **Step 7.3: Add PPOAEManager and update AEManager to ae_manager.py**

Add at the bottom of `ae/src/ae_manager.py` (after the existing `AEManager` class):

```python
# ---------------------------------------------------------------------------
# PPO inference manager (Phase 2)
# ---------------------------------------------------------------------------

try:
    from sb3_contrib import MaskablePPO as _MaskablePPO
    MaskablePPO = _MaskablePPO
except ImportError:
    MaskablePPO = None  # not installed in Phase 1 image


class PPOAEManager:
    """Loads a trained MaskablePPO model and runs inference per step."""

    def __init__(self, model_path: str = "../models/ae_policy"):
        if MaskablePPO is None:
            raise RuntimeError("sb3-contrib is not installed. Run Phase 2 Dockerfile.")
        self.model = MaskablePPO.load(model_path)

    def ae(self, observation: dict) -> int:
        obs_vec = preprocess_obs(observation)
        mask    = np.array(observation["action_mask"], dtype=bool)
        action, _ = self.model.predict(obs_vec, action_masks=mask, deterministic=True)
        return int(action)
```

Then update the `ae_server.py`-facing class name by replacing `AEManager` in `ae/src/ae_manager.py` to select between rule-based and PPO based on whether model weights exist:

Replace the `AEManager` class definition (the `__init__` and `ae` methods only — keep all the constants and helpers):

```python
class AEManager:
    """Auto-selects PPO if model weights are present, else rule-based."""

    _MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "ae_policy")

    def __init__(self):
        if os.path.exists(self._MODEL_PATH + ".zip") and MaskablePPO is not None:
            self._impl = PPOAEManager(self._MODEL_PATH)
        else:
            self._impl = _RuleBasedAgent()

    def ae(self, observation: dict) -> int:
        return self._impl.ae(observation)
```

Then rename the existing rule-based implementation class to `_RuleBasedAgent` (replacing `class AEManager:` with `class _RuleBasedAgent:`) and add the import at the top of the file:

```python
import os
```

> **Note:** The full file after this task should have this top-level structure:
> 1. `import os` + `import numpy as np`
> 2. Channel constants
> 3. `preprocess_obs()`
> 4. `_RuleBasedAgent` class (renamed from the original `AEManager`)
> 5. `MaskablePPO` import try/except
> 6. `PPOAEManager` class
> 7. `AEManager` class (the auto-selector)

- [ ] **Step 7.4: Run all tests**

```bash
python -m pytest ae/tests/ -v
```

Expected: all tests pass (PPO tests use monkeypatched mock model).

- [ ] **Step 7.5: Copy best model weights to ae/models/ (on GCP Workbench)**

Use the model that scored best in the evaluation from Task 6:

```bash
# If the final model won:
cp ae/models/ae_policy.zip ae/models/ae_policy.zip   # already there

# If a checkpoint won (e.g. step 3_500_000):
cp ae/models/ae_ckpt_3500000_steps.zip ae/models/ae_policy.zip
```

- [ ] **Step 7.6: Update ae/requirements.txt for Phase 2**

Replace the contents of `ae/requirements.txt`:

```
fastapi
uvicorn[standard]
torch --index-url https://download.pytorch.org/whl/cpu
stable-baselines3
sb3-contrib
```

> `torch` CPU-only is used because the Dockerfile base is `python:3.11-slim` (no CUDA). MLP inference does not require GPU.

- [ ] **Step 7.7: Update ae/Dockerfile to copy model weights**

Edit `ae/Dockerfile` — add one line after `COPY src .`:

```dockerfile
# Dockerfile for building the AE image.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_ROOT_USER_ACTION=ignore
WORKDIR /workspace

RUN pip install -U pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src .
COPY models/ models/

CMD uvicorn ae_server:app --port 5005 --host 0.0.0.0
```

- [ ] **Step 7.8: Build Phase 2 Docker image**

```bash
til build ae
```

Expected: image builds successfully. First build will be slow (torch download ~800MB). Subsequent builds use layer cache.

- [ ] **Step 7.9: Test Phase 2 image**

```bash
til test ae
```

Expected: test script runs, PPO model is loaded (check startup log: should NOT see "No model found, using rule-based"), returns valid actions.

- [ ] **Step 7.10: Submit Phase 2**

```bash
til submit ae
```

Expected: new submission notification. Check leaderboard for score improvement over Phase 1 rule-based submission.

- [ ] **Step 7.11: Commit**

```bash
git add ae/src/ae_manager.py ae/requirements.txt ae/Dockerfile
git commit -m "feat(ae): add PPO inference manager + Phase 2 Docker config"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| Rule-based agent with priority ordering | Task 2 |
| Bomb evasion with 1-2 step lookahead | Task 2 (`_bomb_danger`) |
| Bomb placement requires 2 confirmed backward cells clear | Task 2 (`_safe_to_bomb`) |
| Observation preprocessing (892-dim, base_viewcone → 3-dim summary) | Task 1 |
| Direction one-hot, normalized scalars | Task 1 |
| action_mask always respected | Task 2 (all actions gated through `ok()`) |
| AETrainEnv gym wrapper | Task 4 |
| Reward shaping (step penalty, stationary penalty, explore bonus, /50 normalization) | Task 4 (`_shape()`) |
| MaskablePPO training script | Task 5 |
| Checkpoint every 500k steps | Task 5 |
| Smoke test before full training run | Task 5 (Step 5.2) |
| Random opponents throughout (no self-play) | Task 4 (`_advance_to_controlled()`) |
| Evaluation comparison rule-based vs PPO | Task 6 |
| 10% threshold for swap decision | Task 6 (`evaluate.py`) |
| Model weights in ae/models/ (git-ignored) | Task 7 |
| COPY models/ in Dockerfile | Task 7 |
| torch CPU-only for inference | Task 7 |
| Auto-select PPO vs rule-based on init | Task 7 (`AEManager.__init__`) |

**All spec requirements covered.**

**Type consistency check:** `preprocess_obs` is defined in Task 1 and called in Task 7 (`PPOAEManager.ae`) and in `env_wrapper.py` (Task 4) — all use the same signature `preprocess_obs(obs: dict) -> np.ndarray`. ✓

`MaskablePPO.load()` used in `PPOAEManager.__init__` and `evaluate.py` — both use the same SB3 API. ✓

`action_masks()` method on `AETrainEnv` matches what `MaskablePPO` expects from sb3_contrib. ✓
