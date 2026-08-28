import numpy as np
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
    # Both backward cells visible — escape path confirmed
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
    _set_channel(vc, 1, 2, 0, 1.0)
    _set_channel(vc, 0, 2, 0, 1.0)
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


# ── PPO AEManager (mock) ──────────────────────────────────────────────────────

class _MockModel:
    """Stub that always returns action 0 (FORWARD)."""
    def predict(self, obs, action_masks=None, deterministic=True):
        return np.array(0), None


class _FakeMaskablePPO:
    """Minimal stand-in for MaskablePPO when sb3_contrib is not installed."""
    @staticmethod
    def load(path):
        return _MockModel()


def test_ppo_manager_returns_valid_action(monkeypatch):
    """PPOAEManager calls model.predict and returns its action."""
    import ae_manager as am

    monkeypatch.setattr("ae_manager.MaskablePPO", _FakeMaskablePPO)
    mgr = am.PPOAEManager(model_path="fake/path.zip")
    obs = _make_obs()
    result = mgr.ae(obs)
    assert result == FORWARD


def test_ppo_manager_respects_mask(monkeypatch):
    """PPOAEManager passes action_mask to model.predict."""
    import ae_manager as am

    received_masks = []

    class _MaskCapture:
        def predict(self, obs, action_masks=None, deterministic=True):
            received_masks.append(action_masks.tolist())
            return np.array(0), None

    class _FakePPOCapture:
        @staticmethod
        def load(path):
            return _MaskCapture()

    monkeypatch.setattr("ae_manager.MaskablePPO", _FakePPOCapture)
    mgr = am.PPOAEManager(model_path="fake/path.zip")
    obs = _make_obs(action_mask=[1, 0, 1, 0, 1, 0])
    mgr.ae(obs)
    assert received_masks[0] == [True, False, True, False, True, False]
