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
