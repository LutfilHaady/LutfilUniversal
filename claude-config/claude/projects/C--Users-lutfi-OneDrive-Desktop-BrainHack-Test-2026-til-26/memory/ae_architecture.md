---
name: ae-architecture
description: "AE challenge technical setup - game, observation space, PPO training pipeline, known path bug"
metadata: 
  node_type: memory
  type: project
  originSessionId: e1c86748-9d8d-4cb3-89ec-15748c86c97a
---

**The game:** Bomberman-style, 16x16 grid, 6 teams (1 agent + 1 base each), 200 steps/episode. Observation: 7x5x25 viewcone + scalars. 6 actions: FORWARD(0), BACKWARD(1), LEFT(2), RIGHT(3), STAY(4), PLACE_BOMB(5).

**Key rewards:** destroy_enemy_base=+50, own_base_destroyed=-50, collect_mission=+5, collect_resource=+2.

**Current agent stack:**
- `ae/src/ae_manager.py` → re-exports `AEManager` from `ae_manager_rl.py`
- `ae/src/ae_manager_rl.py` → loads trained PPO model, flattens obs with gymnasium's `flatten()`
- `ae/src/ae_manager_classical.py` → rule-based fallback (bomb avoidance, base attack, resource collection)
- `ae/src/train_rl.py` → PPO_4 training: lr=3e-5, n_steps=4096, batch=256, ent_coef=0.05, vf_coef=1.0, 2M steps

**Training pipeline:** PettingZoo AEC → FlattenDictWrapper → pad_obs → aec_to_parallel → pettingzoo_env_to_vec_env → concat_vec_envs → VecMonitor → PPO (parameter sharing: 6 agents share 1 brain).

**KNOWN PATH BUG:** `train_rl.py` saves models to `./ae/src/models/PPO_4/best_model.zip` but `ae_manager_rl.py` looks for `<src_dir>/models/best_model.zip` (no PPO_4 subdir). After training, must either:
1. Copy `PPO_4/best_model.zip` → `models/best_model.zip`, OR
2. Update the path in `ae_manager_rl.py` to include the run subdir.

**Current state:** `ae/src/models/` is empty — no trained model. Falls back to random play.

**How to apply:** When touching the AE training pipeline, remember the path mismatch. Any trained model must land at `ae/src/models/best_model.zip` for the Docker container to find it.
