# TIL-26 AE Heuristic — Handoff Doc

> Branch: `lutfil` · Best board score: **0.443** (`bigtgang-ae:lutfil-heur-v4-hybrid`)
> True expected value: **~0.42** (0.443 was the lucky tail of a noisy distribution)
> Submit noise floor: **±0.025**

---

## 1. 60-second snapshot

- **Game:** Bomberman, 16×16 novice fixed map (seed 88), 6 teams × 1 agent, 200 ticks × 6 rounds per match.
- **Score formula:** `total_reward(agent_0) / 6 / 1000`. So ~500 reward/round ≈ 0.5 board.
- **Reward sources:** `destroy_enemy_base +50`, `attack_kill +15`, `collect_mission +5`, `collect_resource +2`, `attack_damage +1`, `collect_recon +1`, `own_base_destroyed -50`.
- **Our agent:** rule-based heuristic (`ae/src/ae_manager_heuristic.py`). PPO was attempted earlier and parked (board scored 0.000-0.003).
- **Board ≠ local test:** `til test` uses random opponents (~0.50 local). Real board opponents are competitive (~0.42 board). The retention gap is the real signal.

---

## 2. Pinning the 0.443 code

The actual code that scored 0.443 is the **pure farmer4 baseline** at commit `16a3b8a` of the `lutfil` branch:

```bash
git clone https://github.com/lamemario/til-26.git
cd til-26
git submodule update --init
git checkout 16a3b8a -- ae/src/ae_manager_heuristic.py
```

Other "scoring tags" in the registry that contain the same farmer4 code:
- `bigtgang-ae:lutfil-heur-v3-farmer` (0.411)
- `bigtgang-ae:lutfil-heur-v4-hybrid` (0.443) ← team's recorded high
- `bigtgang-ae:lutfil-heur-farmer4-rerun2` (0.393)

Same code, three different submissions, scores spanning 0.05. That's the noise floor.

---

## 3. Agent architecture (priority chain)

Each tick the agent does in order, returning the first action that applies:

```
ae(observation) →
  step==0? → _reset_episode (per round) ; cross-round state preserved
  parse observation: location, direction, action_mask, viewcone, base info
  update internal state: bomb timers, scanned tiles, walls, enemy positions
  
  1) EVADE: if in any bomb's imminent blast, BFS to nearest safe tile
  2) BOMB ENEMY BASE: if 5×5 blast covers a live enemy base + escape exists + own base safe
  2b) BOMB ENEMY AGENTS: if ≥2 enemies in blast + escape exists + own base safe
  3) NAVIGATE: BFS to highest-reward target
       priority: nearby enemy bases (≤4 BFS) > missions > resources > recons > far bases
  4) FRONTIER: drive toward known tile adjacent to unknown
  5) LEAST-VISITED known tile
  Fallback: _safe_legal — any legal action, prefer movement
```

Key invariants:
- **LEFT/RIGHT are ROTATIONS, not strafes.** `_action_for_world_dir` maps BFS direction → rotation or forward.
- **Walls are EDGES, not tile occupants.** `_wall_edges: set[(x, y, dir)]` is bidirectional.
- **`_pickup_tick[tile] = step`** — tile re-eligible after `TILE_FILTER_TICKS=38` (env respawn = 40).
- **`_edge_bfs(avoid_unsafe=True/False)`** — navigation uses True (skip blast); evade uses False (must traverse blast to escape).
- **`_bomb_safe_for_own_base(loc)`** — never bomb if your team base is in the resulting 5×5 blast.
- **`_novice_map`** — pre-seeded enemy bases + indestructible wall edges. Disable via `TIL_PRESEED_MAP=0`.

---

## 4. Experiments tried and what we learned

### Settled findings

| Tag | Change | Board | Verdict |
|---|---|---|---|
| `lutfil-heur-v2` | bases-first navigation | 0.430 | indistinguishable from farmer4 |
| `lutfil-heur-v3-farmer` | bases as 4-tile detour, pickups #1 | 0.411 | **the baseline (mean ~0.42)** |
| `lutfil-heur-v4-hybrid` | same as v3-farmer (cached image) | **0.443** | **team's recorded high — lucky tail** |
| `lutfil-heur-farmer5` | detour radius 5 instead of 4 | 0.383 | slightly worse |
| `lutfil-heur-bombwalls` | bomb destructible walls when stuck | 0.398 | noise |
| `lutfil-heur-endgame` | tick ≥160 drop base detour | 0.386 | borderline regression |
| `lutfil-heur-farmer4-rerun2` | pure farmer4 again | 0.393 | confirms noise band |
| `lutfil-heur-bomb1` | bomb-on-1-enemy (down from 2) | 0.386-0.410 | noise |
| `lutfil-heur-losblast` | wall-aware blast LOS in `_blast_cells` | 0.395 | noise |
| `lutfil-heur-memory` | LOS everywhere + cross-round base kill memory | 0.404 | noise |
| `lutfil-heur-sentinel` | base_viewcone + base_health defensive trigger | TBD | latest submit |

**Headline:** detour=4 sweep (3, 4, 5, 6, 8) all landed in the noise band. The peak is real but the magnitude is within ±0.025 of every neighbor. Don't over-tune scalar parameters via single submits.

### Listed failures from the prior handoff (do NOT repeat)
- Lowered bomb threshold near our base: 0.430 → 0.396
- "Engage base attackers" navigation priority: 0.430 → 0.392

### What the env actually does (verified by reading source)
- **Blast cells = 5×5 Chebyshev filtered by LOS** (walls block). See `til_environment/dynamics.py:566` `_directional_blast`.
- **Agents that would destroy themselves are FROZEN, not killed.** Self-bombs cost lost ticks, not -X reward.
- **The obs has `base_viewcone` (separate vision from our base) and `base_health`** — we ignored both until the last submission. This is the biggest unexploited info.
- **No `scout` field is constructed in the actual obs** despite being documented in `types.py` — appears legacy.

---

## 5. Open ideas (not yet tested or partially tested)

Ranked by my estimate of EV per effort. Each effort estimate is "engineering time", expected delta is per single submit on top of farmer4 (~0.42 baseline).

### Tier S — would change the game

1. **Time-layered BFS.** Currently `_unsafe_now(tile)` is a static check. Make it `_unsafe_at(tile, t)` so BFS step N checks "is this tile in blast at tick now+N?" — take direct paths through tiles that will clear by arrival; avoid paths that look safe now but will be blasted later. The competitive Bomberman literature (top CodinGame agent) uses exactly this. ~30 lines. **+0.03 to +0.07 expected.**

2. **Behavioral cloning + PPO fine-tune.** Use the heuristic as a teacher: roll it out N×10000 times, record `(obs, action)` pairs from the highest-scoring episodes, train a small neural net to imitate, then PPO-fine-tune against the heuristic itself as opponent. The previous PPO attempt failed because it trained vs random opponents — heuristic as opponent is closer to board reality. Multi-day project. **+0.05 to +0.15 or -0.40.**

### Tier A — meaningful structural changes

3. **Track enemy positions across ticks → predict & skip contested pickups.** Each tick, record visible enemies; for each pickup we'd target, drop it if any enemy is closer and heading toward it. ~30 lines. **+0.01 to +0.03.**

4. **Hand-coded opening playbook.** Seed 88 is fixed. Spawn corners are predictable (~6 possibilities). Pre-compute optimal first 20-tick sequences for each spawn → straight-line beeline to nearest base + bomb + escape, no BFS overhead. Currently we waste 5-10 ticks orienting. ~50 lines. **+0.03 to +0.07.**

5. **Bomb chaining.** When placing a bomb on a base, if an existing ally bomb is about to expire in the same blast zone, place INSIDE that bomb's blast so they detonate together = compound damage in one tick. ~20 lines. **+0.02 to +0.04.**

6. **Bomb-then-camp.** After dropping bomb at a base, instead of leaving, escape just outside blast then return to drop a second bomb when cooldown clears. Guarantees the kill if base has health left. ~30 lines. **+0.02 to +0.05.**

### Tier B — small tweaks

7. **STAY ablation.** Force ROTATE_LEFT instead of STAY when no other option. Smoke shows 0-4 STAYs/ep. ~5 lines. **+0.005 to +0.015.**

8. **EVADE relaxation.** `EVADE_LOOKAHEAD: 2 → 1`. We bail on goals earlier than necessary. ~1 line. **+0.02 to +0.06 IF doesn't cause self-kills, otherwise -0.10+.**

9. **Strict bomb chain safety.** Never place a bomb whose tile is already inside another bomb's blast (would chain-kill us). ~15 lines. **+0.01 to +0.03.**

10. **Suicide bomb gambit.** Last 10 ticks: trade our base for an enemy base (+50 enemy ≥ -50 own + ~+10 damage). ~20 lines. **+0.01 to +0.03.**

---

## 6. Gotchas that wasted submits

- **`git pull` silently fails if there are uncommitted local edits.** Symptom: "Your local changes to the following files would be overwritten by merge." Build then runs on STALE code, submitting wrong logic. Always `git status` BEFORE pull/build. We lost at least 2 submits to this.
- **`git checkout <commit> -- <file>` stages the file**, which then survives subsequent `git pull` operations (silently overrides whatever you pull). Discard with `git reset HEAD -- <file>; git checkout -- <file>`.
- **Local smoke (`smoke_heuristic.py`) is vs random opponents** — useless for fine-tuning. Use only as a crash check.
- **Same code re-submitted can score within ±0.025** — don't chase tweaks under that delta with a single submit.
- **Submit budget is shared with the team** — pick changes that should move the score by >0.05 to be detectable.

---

## 7. Workflow if you take over

```bash
# Sanity check (always run before pulling on your env):
git status

# Pull latest:
git pull

# Local crash check (~30 sec):
python ae/src/smoke_heuristic.py 3

# Build:
cd ae && docker build --no-cache -t bigtgang-ae:<yourname>-<vN> .

# Verify the right code is in the image:
docker run --rm bigtgang-ae:<yourname>-<vN> python -c \
  "from ae_manager import AEManager; m=AEManager(); print(type(m).__module__)"
# Expect: ae_manager_heuristic

# Submit only if smoke didn't crash:
cd ~/<workdir> && til submit ae <yourname>-<vN>
```

Decision rule: only submit changes that look meaningfully different in smoke (e.g., bomb count or base count clearly shifted), OR are structural changes worth measuring on the board even if smoke is flat.

---

## 8. Files

| File | Purpose |
|---|---|
| `ae/src/ae_manager_heuristic.py` | THE AGENT — all heuristic logic |
| `ae/src/ae_manager.py` | Dispatcher (env var `TIL_AE_AGENT=heuristic|rl|classical`) |
| `ae/src/ae_server.py` | FastAPI `/ae` endpoint, do not modify |
| `ae/src/novice_map_probe.py` | Probes seed-88 layout (bases + walls) |
| `ae/src/smoke_heuristic.py` | Local rollouts (Docker-free) |
| `ae/Dockerfile` | `ENV TIL_PRESEED_MAP=1` toggles novice pre-seed |
| `ae/train/train.py`, `train_resume.py` | PPO training stack (parked) |
| `til-26-ae/til_environment/dynamics.py` | Env mechanics (read this for exploits) |
| `til-26-ae/til_environment/observation.py` | Obs construction (line 573 = `build_radius_view`) |
| `til-26-ae/til_environment/config.py` → `RewardsConfig` | Reward values |

Good luck. The agent is mechanically solid — the remaining gap to 0.55+ is opponent-aware logic (time-layered safety, opponent prediction, base_viewcone exploitation), not parameter tweaking.
