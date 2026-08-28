"""ae_manager_heuristic.py — Rule-based AE for TIL-26 Bomberman (Novice).

Strategy (priority order each tick):
  1. EVADE: project all known bomb blasts (5x5 Chebyshev, timer T -> explodes in T ticks).
     If current or any unsafe-near tile triggers blast within next 2 ticks, move to a safe tile.
  2. BOMB ENEMY BASE: if Chebyshev <= blast_radius from a known enemy base AND have bomb AND
     can escape (legal FORWARD or BACKWARD that exits blast in 3 ticks) -> PLACE_BOMB.
  2b. BOMB ENEMY AGENTS (opportunistic): if >=2 enemies in blast and escape exists.
  3. NAVIGATE to closest target: live enemy base (+50) > mission (+5) > resource (+2) > recon (+1).
  4. FRONTIER explore unknown map border.
  5. LEAST-VISITED known tile.

Novice v3 extras (see novice_map_probe.py):
  - At episode reset, pre-load all 5 enemy base coords + indestructible wall edges from the
    fixed novice arena (seed 88). BFS can path to every base from tick 0.
  - Pickup targets use _pickup_tick: missions/resources/recons respawn every 40 ticks, so we
    may revisit the same tile after TILE_FILTER_TICKS (38) instead of banning forever.
  - Navigation BFS skips tiles inside an imminent bomb blast (_unsafe_now), not only evade.

World->Action: BFS returns world direction D; agent heading is H; rel = (D - H) % 4:
  rel == 0 -> FORWARD
  rel == 1 -> rotate RIGHT (next tick FORWARD)
  rel == 2 -> BACKWARD
  rel == 3 -> rotate LEFT (next tick FORWARD)

NOTE: class must be named ``AEManager`` (ae_server imports that name).
"""

from __future__ import annotations

import os
import sys
from collections import deque as dq
from typing import Optional

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ae_manager_rl import (  # noqa: E402
    CompassState,
    probe_novice_static_compass,
)
from novice_map_probe import probe_novice_map  # noqa: E402

from til_environment.helpers import view_to_world  # noqa: E402
from til_environment.observation import ViewChannel  # noqa: E402
from til_environment.types import Direction  # noqa: E402


GRID_SIZE = 16
BOMB_BLAST_R = 2          # Chebyshev radius (5x5 square)
BOMB_TIMER = 4            # ticks until explosion when placed
EVADE_LOOKAHEAD = 2       # consider blasts within this many ticks unsafe
TILE_RESPAWN_TICKS = 40   # static tiles respawn 40 ticks after collect (env upkeep)
TILE_FILTER_TICKS = 38    # treat as "ready" again 2 ticks before respawn for safety margin
VC_BEHIND = 2
VC_LEFT = 2

ACT_FORWARD = 0
ACT_BACKWARD = 1
ACT_LEFT = 2       # rotate counter-clockwise (heading + 3) % 4
ACT_RIGHT = 3      # rotate clockwise (heading + 1) % 4
ACT_STAY = 4
ACT_PLACE_BOMB = 5

CH_VISIBLE = 0
CH_TILE_RECON = 6
CH_TILE_MISSION = 7
CH_TILE_RESOURCE = 8
CH_ENEMY_AGENT = 10
CH_ALLY_BASE = 11
CH_ENEMY_BASE = 12
CH_ALLY_BOMB = 17
CH_ENEMY_BOMB = 18
CH_ALLY_BOMB_TIMER = 19
CH_ENEMY_BOMB_TIMER = 20

DIR_DELTAS = [(1, 0), (0, 1), (-1, 0), (0, -1)]  # Direction enum order


def _chebyshev(a: tuple[int, int], b: tuple[int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]))


def _in_grid(p: tuple[int, int]) -> bool:
    return 0 <= p[0] < GRID_SIZE and 0 <= p[1] < GRID_SIZE


class AEManager:
    """Rule-based AE. Persistent map memory + BFS + bomb evasion + base attack."""

    BOMBS_TO_RETIRE_BASE: int = 5  # base max_health=100, bomb attack=20

    def __init__(self) -> None:
        self._compass = CompassState(GRID_SIZE)
        self._enemy_bases: set[tuple[int, int]] = set()
        # world (x,y) -> remaining ticks until explosion (0 = explodes this tick)
        self._bombs: dict[tuple[int, int], int] = {}
        # Wall *edges*: (x, y, dir) means tile (x,y) has a wall on its `dir` side
        # (so you cannot move from (x,y) in direction dir or from the neighbor back into (x,y)).
        # dir is Direction enum: 0=RIGHT, 1=DOWN, 2=LEFT, 3=UP.
        self._wall_edges: set[tuple[int, int, int]] = set()
        # Tile content: 0=unknown, 1=free/known-no-tile, 2=recon, 3=mission, 4=resource,
        # tracked just for exploration awareness.
        self._known_tiles: set[tuple[int, int]] = set()
        self._last_step: int = -1
        self._static_probed: bool = False
        # Anti-loop: detect tile + heading repeating (no progress)
        self._recent_states: list[tuple[tuple[int, int], int]] = []
        self._stuck_unstick_dir: int = 0  # alternates 0/1 to break ties
        # Visit counts (for tie-breaking exploration toward less-visited tiles)
        self._visits: dict[tuple[int, int], int] = {}
        # Tick at which we last stepped onto each tile this episode.
        # Static items respawn every TILE_RESPAWN_TICKS = 40 ticks, so a tile is
        # only "spent" (filter from BFS targets) if the gap is < TILE_FILTER_TICKS.
        self._pickup_tick: dict[tuple[int, int], int] = {}
        # Current step within the episode (for respawn timing).
        self._tick: int = 0
        # Ticks until we may place another bomb (avoids piling bombs in own blast).
        self._bomb_cooldown: int = 0
        # Bombs placed within blast range of each enemy base — used to retire
        # bases we've already pummeled (base max_health=100, bomb attack=20 →
        # 5 hits destroys it, plus we never get a "destroyed" signal).
        self._bombs_dropped_on: dict[tuple[int, int], int] = {}
        # Permanently-retired bases (collected destroy-reward already / dead).
        self._dead_bases: set[tuple[int, int]] = set()
        # Transient: enemy agents seen on the most recent viewcone scan.
        self._enemy_agents_now: set[tuple[int, int]] = set()
        # Cross-round memory (NOT reset between rounds; manager persists across all 6).
        # _round_idx: 0 before any round, 1 after round 1 ends, etc.
        # _base_kill_count: total times WE marked each base dead across history.
        # Used in _priority_target_lists to deprioritize bases we never killed
        # (probably contested/unreachable) after we have enough rounds of data.
        self._round_idx: int = 0
        self._base_kill_count: dict[tuple[int, int], int] = {}
        # Novice static map cache from probe_novice_map() — bases + wall edges for seed 88.
        # Loaded once per AEManager lifetime; same layout every episode on novice track.
        self._novice_map = None  # type: ignore[var-annotated]
        # First obs each episode: remove my_base from _enemy_bases (probe lists all 6 teams).
        self._own_base_filtered: bool = False
        self._my_base: tuple[int, int] = (0, 0)

    # ─────────────────────── entry point ───────────────────────
    def ae(self, observation: dict) -> int:
        loc = np.array(observation["location"], dtype=np.int64)
        loc_t = (int(loc[0]), int(loc[1]))
        heading = int(observation["direction"])
        action_mask = np.asarray(observation["action_mask"], dtype=np.int8)
        team_bombs = int(observation["team_bombs"])
        viewcone = np.asarray(observation["agent_viewcone"], dtype=np.float32)
        step = int(observation.get("step", 0))
        my_base = (int(observation["base_location"][0]), int(observation["base_location"][1]))
        # Sentinel inputs: base_viewcone (separate vision centered on our base) +
        # base_health (HP for triggering defensive mode).
        base_view_raw = observation.get("base_viewcone")
        base_view = (
            np.asarray(base_view_raw, dtype=np.float32)
            if base_view_raw is not None
            else None
        )
        base_health_raw = observation.get("base_health")
        try:
            base_health = float(np.asarray(base_health_raw).flatten()[0]) if base_health_raw is not None else 100.0
        except (IndexError, TypeError):
            base_health = 100.0
        self._my_base = my_base  # used by bomb safety checks (own_base_destroyed = -50)

        # New episode detection: step==0 or step decreased
        if step == 0 or (self._last_step >= 0 and step < self._last_step):
            self._reset_episode()
        self._last_step = step

        # Lazy static probe (Novice: all mission/resource/recon tile coords from seed 88).
        # Complements novice_map_probe (bases + walls). Runs once per container lifetime.
        if not self._static_probed:
            try:
                static = probe_novice_static_compass(GRID_SIZE)
                self._compass.copy_static_from(static)
            except Exception:
                pass
            self._static_probed = True

        # Drop our own base from the pre-seeded enemy-base set on the first
        # observation of each episode (my_base is in obs but not in the probe).
        if not self._own_base_filtered:
            self._enemy_bases.discard(my_base)
            self._own_base_filtered = True

        # Update global state
        self._compass.update_maps(observation)
        self._tick_bombs()
        self._scan_viewcone(viewcone, loc, heading, my_base)
        if base_view is not None:
            self._scan_base_viewcone(base_view, my_base)
        if self._bomb_cooldown > 0:
            self._bomb_cooldown -= 1

        # Track recent (loc, heading) to detect loops
        self._recent_states.append((loc_t, heading))
        if len(self._recent_states) > 12:
            self._recent_states.pop(0)

        # Mark current tile as recently-collected (timestamp -> tick).
        # Tiles become eligible targets again after TILE_FILTER_TICKS ticks.
        self._tick = step
        self._pickup_tick[loc_t] = step

        # 1) EVADE
        evade = self._evade_action(loc_t, heading, action_mask)
        if evade is not None:
            return evade

        # 1b) BASE SENTINEL — defend our base when actively under attack.
        # Differs from past failed "engage attackers" attempts: triggers ONLY
        # when (a) base_health < 100 (real damage taken, not speculation) AND
        # (b) base_viewcone reveals a bomb whose LOS-blast actually covers our
        # base AND (c) we are within 5 BFS steps. Then we path toward the bomb
        # tile — if we land adjacent next tick, the normal BOMB-on-ENEMY logic
        # may chain-detonate or kill the planter coming to inspect, denying
        # the opponent's +50.
        if base_health < 100.0:
            threat = self._bomb_threatening_my_base()
            if threat is not None and _chebyshev(loc_t, threat) <= 6:
                world_dir = self._edge_bfs(loc_t, [threat])
                if world_dir is not None:
                    act = self._action_for_world_dir(world_dir, heading, action_mask)
                    if act is not None:
                        return act

        # 2) BOMB ENEMY BASE
        # Bomb only if: have bomb, adjacent to live enemy base, cooldown elapsed,
        # we haven't already dumped BOMBS_TO_RETIRE_BASE bombs on this base,
        # no existing ally bomb already inside this base's blast zone,
        # and we have a clear escape route.
        if (
            team_bombs > 0
            and self._live_enemy_bases()
            and self._bomb_cooldown == 0
            and action_mask[ACT_PLACE_BOMB] == 1
        ):
            target_base = self._enemy_base_in_blast(loc_t)
            if (
                target_base is not None
                and not self._existing_bomb_threatens(target_base)
                and self._bomb_safe_for_own_base(loc_t)
            ):
                escape = self._escape_dir_from_blast(loc_t, heading, action_mask)
                if escape is not None:
                    self._bombs_dropped_on[target_base] = (
                        self._bombs_dropped_on.get(target_base, 0) + 1
                    )
                    if self._bombs_dropped_on[target_base] >= self.BOMBS_TO_RETIRE_BASE:
                        if target_base not in self._dead_bases:
                            # First time killing this base THIS round — record
                            # for cross-round priority filtering.
                            self._base_kill_count[target_base] = (
                                self._base_kill_count.get(target_base, 0) + 1
                            )
                        self._dead_bases.add(target_base)
                    self._bomb_cooldown = BOMB_TIMER + 1
                    return ACT_PLACE_BOMB

        # 2b) OPPORTUNISTIC BOMB-ON-ENEMY-AGENT
        # If 2+ enemy agents are in our blast (Cheb <= 2), bomb has cooldown 0,
        # mask allows it, and we have a clear escape route — drop a bomb.
        # Reward: +15 per kill, +1 per damage tick. Even 1 kill is +15 reward.
        # Require >=2 enemies to avoid wasting bombs that should hit bases.
        if (
            team_bombs > 0
            and self._bomb_cooldown == 0
            and action_mask[ACT_PLACE_BOMB] == 1
            and not self._enemy_base_in_blast(loc_t)  # base bomb already had priority
        ):
            blast = self._blast_cells(loc_t)
            enemies_in_blast = sum(
                1 for e in self._enemy_agents_now if e in blast and e != loc_t
            )
            # Threshold >=1: re-attempt of v3.0 idea, this time WITHOUT the
            # near-our-base trigger that previously regressed. Pure map-wide
            # bomb-on-enemy. One kill = +15 reward; combined with denial of
            # the enemy's next bomb/pickup, plausibly net positive even after
            # the lost pickup ticks while we evade our own bomb.
            bomb_agents = enemies_in_blast >= 1
            if bomb_agents and self._bomb_safe_for_own_base(loc_t):
                escape = self._escape_dir_from_blast(loc_t, heading, action_mask)
                if escape is not None:
                    self._bomb_cooldown = BOMB_TIMER + 1
                    return ACT_PLACE_BOMB

        # NOTE: Base defense changes tested but caused regression on the board:
        # - Lowered bomb threshold near base: 0.430 → 0.396 (real opponents evade)
        # - "Engage base attackers" navigation priority: 0.430 → 0.392 (wastes ticks)
        # Reverted both. Pure v3b heuristic scores 0.430 — biggest known win.

        # Track visit counts for exploration tie-breaking
        self._visits[loc_t] = self._visits.get(loc_t, 0) + 1

        # 3) NAVIGATE by priority
        for targets in self._priority_target_lists(loc_t):
            if not targets:
                continue
            world_dir = self._edge_bfs(loc_t, list(targets))
            if world_dir is not None:
                act = self._action_for_world_dir(world_dir, heading, action_mask)
                if act is not None:
                    return act

        # 4) FRONTIER — drive toward least-visited known tile adjacent to unknown
        frontier = self._compute_frontier()
        if frontier:
            world_dir = self._edge_bfs(loc_t, frontier)
            if world_dir is not None:
                act = self._action_for_world_dir(world_dir, heading, action_mask)
                if act is not None:
                    return act

        # 5) Last-resort exploration: pick least-visited reachable tile
        least_visited = self._least_visited_target(loc_t)
        if least_visited:
            world_dir = self._edge_bfs(loc_t, [least_visited])
            if world_dir is not None:
                act = self._action_for_world_dir(world_dir, heading, action_mask)
                if act is not None:
                    return act

        return self._safe_legal(action_mask)

    # ─────────────────────── BFS / frontiers ───────────────────────

    def _edge_aware_walkable(self, src: tuple[int, int], d: int) -> bool:
        """Can the agent move from tile `src` in direction `d` (Direction code)?
        Considers grid bounds + recorded wall edges.
        """
        dx, dy = DIR_DELTAS[d]
        nxt = (src[0] + dx, src[1] + dy)
        if not _in_grid(nxt):
            return False
        if (src[0], src[1], d) in self._wall_edges:
            return False
        return True

    def _edge_bfs(
        self,
        start: tuple[int, int],
        targets: list[tuple[int, int]],
        avoid_unsafe: bool = True,
    ) -> Optional[int]:
        """BFS with edge-aware walls. Returns Direction code (0..3) of the first move
        on the shortest path from `start` to any cell in `targets`. None if unreachable.

        avoid_unsafe (default True): skip neighbors currently inside a bomb blast
            that fires within EVADE_LOOKAHEAD ticks. Used for navigation BFS.
            Evade BFS MUST pass False — otherwise when we stand on a blast tile,
            every escape path crosses a blast neighbor and BFS dead-ends → STAY → die.
            (This was the v3 regression: shared _unsafe_now skip killed evasion.)
        """
        if not targets:
            return None
        target_set = set(targets)
        if start in target_set:
            return None  # already on a target — caller chose poorly
        parent: dict[tuple[int, int], tuple[int, int]] = {start: start}
        first_dir: dict[tuple[int, int], Optional[int]] = {start: None}
        depth: dict[tuple[int, int], int] = {start: 0}
        queue = dq([start])
        while queue:
            pos = queue.popleft()
            if pos in target_set:
                return first_dir.get(pos)
            arrive_step = depth[pos] + 1
            for d in range(4):
                if not self._edge_aware_walkable(pos, d):
                    continue
                dx, dy = DIR_DELTAS[d]
                nxt = (pos[0] + dx, pos[1] + dy)
                if nxt in parent:
                    continue
                # Time-layered safety: would `nxt` be in any bomb's blast at the
                # exact tick we'd arrive (current tick + arrive_step)? Walking
                # through a 'currently dangerous' tile is fine if the bomb has
                # already cleared by arrival; conversely a 'currently safe' tile
                # is unsafe if a bomb catches it then.
                if avoid_unsafe and self._unsafe_at(nxt, arrive_step):
                    continue
                parent[nxt] = pos
                first_dir[nxt] = d if pos == start else first_dir[pos]
                depth[nxt] = arrive_step
                queue.append(nxt)
        return None

    def _compute_frontier(self) -> list[tuple[int, int]]:
        """Known free tiles adjacent (via an open edge) to an unknown tile."""
        out: list[tuple[int, int]] = []
        for tile in self._known_tiles:
            for d in range(4):
                if not self._edge_aware_walkable(tile, d):
                    continue
                dx, dy = DIR_DELTAS[d]
                nxt = (tile[0] + dx, tile[1] + dy)
                if nxt not in self._known_tiles:
                    out.append(tile)
                    break
        return out

    def _least_visited_target(self, here: tuple[int, int]) -> Optional[tuple[int, int]]:
        if not self._known_tiles:
            return None
        # Pick the known tile with the smallest visit count (ties broken by distance).
        candidates = sorted(
            self._known_tiles - {here},
            key=lambda p: (
                self._visits.get(p, 0),
                abs(p[0] - here[0]) + abs(p[1] - here[1]),
            ),
        )
        return candidates[0] if candidates else None

    # ─────────────────────── helpers ───────────────────────

    def _reset_episode(self) -> None:
        # Increment cross-round counter if a round actually ran (tick > 0 means
        # we processed at least one step before this reset). _round_idx and
        # _base_kill_count are NOT cleared — they persist across all 6 rounds.
        if self._tick > 0:
            self._round_idx += 1
        self._compass.reset_episode()
        self._enemy_bases.clear()
        self._bombs.clear()
        self._wall_edges.clear()
        self._known_tiles.clear()
        self._visits.clear()
        self._pickup_tick.clear()
        self._tick = 0
        self._recent_states.clear()
        self._bomb_cooldown = 0
        self._bombs_dropped_on.clear()
        self._dead_bases.clear()
        self._enemy_agents_now.clear()
        self._own_base_filtered = False

        # ── Pre-seed the static novice layout (BFS knows full corridors from t=0) ──
        # Only when TIL_PRESEED_MAP=1 (default). Set TIL_PRESEED_MAP=0 to A/B test without
        # seed-88 walls/bases if board eval uses a non-novice layout.
        # Only seed indestructible edges so that destructible walls (which a stray
        # enemy bomb might destroy) are discovered live via viewcone. Indestructibles
        # never change, so we trust them forever.
        if not self._novice_preseed_enabled():
            return
        if self._novice_map is None:
            try:
                self._novice_map = probe_novice_map()
            except Exception:
                self._novice_map = None

        if self._novice_map is not None:
            self._wall_edges.update(self._novice_map.indestructible_edges)
            # Seed ALL 6 bases as enemies; we'll drop our own once we get my_base.
            for b in self._novice_map.bases:
                self._enemy_bases.add(b)

    def _scan_base_viewcone(
        self, base_view: np.ndarray, my_base: tuple[int, int]
    ) -> None:
        """Scan our base's circular vision view for enemy bombs and agents.
        Adds to self._bombs / self._enemy_agents_now any threats visible from
        the base even if our own viewcone doesn't see them.

        base_view shape: (2R+1, 2R+1, NUM_CHANNELS). world coord of view[i,j]
        is (base.x + i - R, base.y + j - R).
        """
        if base_view.size == 0 or base_view.ndim < 3:
            return
        side = base_view.shape[0]
        radius = (side - 1) // 2
        bx, by = my_base
        for i in range(side):
            for j in range(side):
                wx = bx + i - radius
                wy = by + j - radius
                if not _in_grid((wx, wy)):
                    continue
                cell = base_view[i, j]
                if cell[CH_VISIBLE] <= 0.5:
                    continue
                # Enemy bomb seen from base
                if cell[CH_ENEMY_BOMB] > 0.5:
                    timer = int(round(float(cell[CH_ENEMY_BOMB_TIMER])))
                    timer = max(0, min(BOMB_TIMER, timer))
                    prev = self._bombs.get((wx, wy))
                    # Keep the shorter (more imminent) timer if conflicting.
                    if prev is None or timer < prev:
                        self._bombs[(wx, wy)] = timer
                elif cell[CH_ALLY_BOMB] > 0.5:
                    timer = int(round(float(cell[CH_ALLY_BOMB_TIMER])))
                    timer = max(0, min(BOMB_TIMER, timer))
                    prev = self._bombs.get((wx, wy))
                    if prev is None or timer < prev:
                        self._bombs[(wx, wy)] = timer
                # Enemy agent seen from base
                if cell[CH_ENEMY_AGENT] > 0.5:
                    self._enemy_agents_now.add((wx, wy))

    def _bomb_threatening_my_base(self) -> Optional[tuple[int, int]]:
        """Return the closest tracked bomb whose LOS-blast covers our base,
        or None if no bomb threatens us. Uses wall-aware _blast_cells."""
        threats = [
            bpos
            for bpos in self._bombs
            if self._my_base in self._blast_cells(bpos)
        ]
        if not threats:
            return None
        return min(threats, key=lambda b: _chebyshev(b, self._my_base))

    def _tick_bombs(self) -> None:
        new_bombs: dict[tuple[int, int], int] = {}
        for pos, t in self._bombs.items():
            t_new = t - 1
            if t_new >= 0:
                new_bombs[pos] = t_new
        self._bombs = new_bombs

    def _scan_viewcone(
        self,
        viewcone: np.ndarray,
        loc: np.ndarray,
        heading: int,
        my_base: tuple[int, int],
    ) -> None:
        """Update enemy_bases, missions, resources, recons, bombs, wall edges,
        and current enemy-agent positions (reset each call — agents move)."""
        self._enemy_agents_now: set[tuple[int, int]] = set()
        vc_l, vc_w = viewcone.shape[0], viewcone.shape[1]
        head_dir = Direction(heading)
        for i in range(vc_l):
            for j in range(vc_w):
                vc_coord = np.array([i - VC_BEHIND, j - VC_LEFT], dtype=np.int64)
                world = view_to_world(loc, head_dir, vc_coord)
                wx, wy = int(world[0]), int(world[1])
                if not _in_grid((wx, wy)):
                    continue
                cell = viewcone[i, j]
                visible = cell[CH_VISIBLE] > 0.5
                if visible:
                    self._known_tiles.add((wx, wy))

                # Tile-content objectives (track in compass for BFS prioritization)
                if cell[CH_TILE_MISSION] > 0.5:
                    self._compass.seen_mission.add((wx, wy))
                if cell[CH_TILE_RESOURCE] > 0.5:
                    self._compass.seen_resource.add((wx, wy))
                if cell[CH_TILE_RECON] > 0.5:
                    self._compass.seen_recon.add((wx, wy))

                # Enemy base (static for the episode)
                if cell[CH_ENEMY_BASE] > 0.5 and (wx, wy) != my_base:
                    self._enemy_bases.add((wx, wy))

                # Enemy agent (transient, tracked per tick for opportunistic bombing)
                if cell[CH_ENEMY_AGENT] > 0.5:
                    self._enemy_agents_now.add((wx, wy))

                # Bombs: prefer enemy timer, fallback ally timer
                if cell[CH_ENEMY_BOMB] > 0.5:
                    timer = int(round(float(cell[CH_ENEMY_BOMB_TIMER])))
                    timer = max(0, min(BOMB_TIMER, timer))
                    self._bombs[(wx, wy)] = timer
                elif cell[CH_ALLY_BOMB] > 0.5:
                    timer = int(round(float(cell[CH_ALLY_BOMB_TIMER])))
                    timer = max(0, min(BOMB_TIMER, timer))
                    self._bombs[(wx, wy)] = timer

                # ── WALL EDGES ──
                # Each direction d has a WALL_d channel meaning "the edge of this tile
                # on side d is a wall". Walls are bidirectional, so the neighbor on the
                # other side has the opposite-side wall too — record both for cheap lookup.
                for d, ch in (
                    (0, ViewChannel.WALL_RIGHT),
                    (1, ViewChannel.WALL_DOWN),
                    (2, ViewChannel.WALL_LEFT),
                    (3, ViewChannel.WALL_UP),
                ):
                    if cell[ch] > 0.5:
                        self._wall_edges.add((wx, wy, d))
                        # Reciprocal edge on neighbor
                        dx, dy = DIR_DELTAS[d]
                        nx, ny = wx + dx, wy + dy
                        if _in_grid((nx, ny)):
                            opp = (d + 2) % 4
                            self._wall_edges.add((nx, ny, opp))

    @staticmethod
    def _supercover_line(
        ox: int, oy: int, tx: int, ty: int
    ) -> list[tuple[int, int]]:
        """Mirror of til_environment.helpers.supercover_line — list of tiles
        the straight line from (ox,oy) to (tx,ty) passes through (in order)."""
        dx, dy = tx - ox, ty - oy
        nx, ny = abs(dx), abs(dy)
        sx = 1 if dx > 0 else -1 if dx < 0 else 0
        sy = 1 if dy > 0 else -1 if dy < 0 else 0
        px, py = ox, oy
        tiles = [(px, py)]
        ix = iy = 0
        while ix < nx or iy < ny:
            if (1 + 2 * ix) * ny == (1 + 2 * iy) * nx:
                px += sx; py += sy; ix += 1; iy += 1
            elif (1 + 2 * ix) * ny < (1 + 2 * iy) * nx:
                px += sx; ix += 1
            else:
                py += sy; iy += 1
            tiles.append((px, py))
        return tiles

    def _los_to_tile(self, ox: int, oy: int, tx: int, ty: int) -> bool:
        """Mirror of env's LOS check. True if blast from (ox,oy) reaches (tx,ty)
        without a wall edge blocking. Uses our scanned `_wall_edges`.
        Note: walls we haven't scanned yet → optimistic LOS (over-includes tile).
        For pre-seeded indestructibles + viewcone-scanned destructibles in our
        active area, this matches the env exactly.

        Direction encoding (matches env): 0=RIGHT(+x), 1=DOWN(+y), 2=LEFT(-x), 3=UP(-y)
        """
        if tx == ox and ty == oy:
            return True
        path = self._supercover_line(ox, oy, tx, ty)
        for i in range(len(path) - 1):
            cx, cy = path[i]
            mx, my = path[i + 1]
            ddx, ddy = mx - cx, my - cy
            if ddx != 0 and ddy != 0:
                h_dir = 0 if ddx > 0 else 2
                v_dir = 1 if ddy > 0 else 3
                h_blocked = (
                    (cx, cy, h_dir) in self._wall_edges
                    or (mx, cy, v_dir) in self._wall_edges
                )
                v_blocked = (
                    (cx, cy, v_dir) in self._wall_edges
                    or (cx, my, h_dir) in self._wall_edges
                )
                if h_blocked and v_blocked:
                    return False
            else:
                d_val = 0 if ddx == 1 else 1 if ddy == 1 else 2 if ddx == -1 else 3
                if (cx, cy, d_val) in self._wall_edges:
                    return False
        return True

    def _blast_cells(self, bomb_pos: tuple[int, int]) -> set[tuple[int, int]]:
        """Tiles damaged by a bomb at `bomb_pos`. Filters Chebyshev 5x5 by LOS
        (walls block blast — matches env's _directional_blast)."""
        ox, oy = bomb_pos
        out: set[tuple[int, int]] = set()
        for dx in range(-BOMB_BLAST_R, BOMB_BLAST_R + 1):
            for dy in range(-BOMB_BLAST_R, BOMB_BLAST_R + 1):
                p = (ox + dx, oy + dy)
                if not _in_grid(p):
                    continue
                if self._los_to_tile(ox, oy, p[0], p[1]):
                    out.add(p)
        return out

    def _unsafe_at(self, tile: tuple[int, int], step: int) -> bool:
        """Time-layered safety check: is `tile` in any bomb's blast at the
        tick `now + step`? A bomb with timer T explodes at tick T from now,
        so its blast cells are unsafe at exactly step == T. Before that the
        bomb hasn't gone off; after that the blast is already gone.

        This is the key piece of time-layered BFS — a path that passes through
        a tile that's 'currently dangerous' is fine if the bomb will already
        have exploded (and cleared) by the time we'd arrive there. Conversely
        a tile that looks safe now becomes unsafe later if a bomb's about to
        catch it. Static _unsafe_now checks would miss both cases.
        """
        for bpos, t in self._bombs.items():
            if t == step and tile in self._blast_cells(bpos):
                return True
        return False

    def _unsafe_now(self, tile: tuple[int, int]) -> bool:
        """True if any tracked bomb will explode within EVADE_LOOKAHEAD ticks AND tile is in its blast."""
        for bpos, t in self._bombs.items():
            if t <= EVADE_LOOKAHEAD and tile in self._blast_cells(bpos):
                return True
        return False

    def _evade_action(
        self, loc: tuple[int, int], heading: int, mask: np.ndarray
    ) -> Optional[int]:
        """If we're inside a bomb blast within EVADE_LOOKAHEAD, find the nearest
        truly safe tile via edge-aware BFS and return the action that progresses
        toward it. Fallback to one-step greedy if BFS finds nothing.
        """
        if not self._unsafe_now(loc):
            return None
        # BFS for the nearest tile that is safe (no current/imminent blast).
        safe_targets: list[tuple[int, int]] = []
        for x in range(GRID_SIZE):
            for y in range(GRID_SIZE):
                p = (x, y)
                if p == loc:
                    continue
                if not self._unsafe_now(p):
                    safe_targets.append(p)
        if safe_targets:
            # avoid_unsafe=False: evade MUST be allowed to traverse blast tiles
            # to find an exit — otherwise BFS dead-ends and we STAY in our own bomb.
            world_dir = self._edge_bfs(loc, safe_targets, avoid_unsafe=False)
            if world_dir is not None:
                act = self._action_for_world_dir(world_dir, heading, mask)
                if act is not None:
                    return act
        # Fallback: one-step greedy on neighbors.
        candidates: list[tuple[float, int]] = []
        for action in (ACT_FORWARD, ACT_BACKWARD, ACT_LEFT, ACT_RIGHT, ACT_STAY):
            if mask[action] == 0:
                continue
            next_tile = self._project_tile(loc, heading, action)
            score = self._safety_score(next_tile)
            candidates.append((score, action))
        if not candidates:
            return None
        candidates.sort(reverse=True)
        return candidates[0][1]

    def _project_tile(
        self, loc: tuple[int, int], heading: int, action: int
    ) -> tuple[int, int]:
        """Where we end up after taking `action` from `loc` facing `heading`.

        FORWARD/BACKWARD move 1 tile; LEFT/RIGHT/STAY do not change location.
        """
        if action == ACT_FORWARD:
            dx, dy = DIR_DELTAS[heading]
            return (loc[0] + dx, loc[1] + dy)
        if action == ACT_BACKWARD:
            dx, dy = DIR_DELTAS[(heading + 2) % 4]
            return (loc[0] + dx, loc[1] + dy)
        return loc

    def _safety_score(self, tile: tuple[int, int]) -> float:
        """Higher = safer. Out-of-grid = -inf; in current blast = -1; otherwise = min(timer)."""
        if not _in_grid(tile):
            return float("-inf")
        worst: float = float("inf")
        for bpos, t in self._bombs.items():
            if tile in self._blast_cells(bpos):
                worst = min(worst, float(t))
        if worst == float("inf"):
            return float("inf")
        # also penalize tile being a wall (will collide; can't move)
        if tile in self._compass.known_wall:
            return float("-inf")
        return worst

    def _live_enemy_bases(self) -> set[tuple[int, int]]:
        return self._enemy_bases - self._dead_bases

    @staticmethod
    def _novice_preseed_enabled() -> bool:
        """Seed-88 wall/base map only when TIL_PRESEED_MAP=1 (default on)."""
        return os.environ.get("TIL_PRESEED_MAP", "1").strip() == "1"

    def _bomb_safe_for_own_base(self, bomb_loc: tuple[int, int]) -> bool:
        """False if our team base sits inside the 5x5 blast (own_base_destroyed = -50)."""
        return self._my_base not in self._blast_cells(bomb_loc)

    def _nearest_live_base_cheb(self, loc: tuple[int, int]) -> int:
        """Chebyshev distance to closest live enemy base, or 99 if none."""
        live = self._live_enemy_bases()
        if not live:
            return 99
        return min(_chebyshev(loc, b) for b in live)

    def _enemy_base_in_blast(self, loc: tuple[int, int]) -> Optional[tuple[int, int]]:
        """Return the closest LIVE enemy base whose tile we would damage by bombing at `loc`.
        Wall-aware: uses LOS-filtered _blast_cells so walls correctly block."""
        blast = self._blast_cells(loc)
        candidates = [b for b in self._live_enemy_bases() if b in blast]
        if not candidates:
            return None
        candidates.sort(key=lambda b: _chebyshev(loc, b))
        return candidates[0]

    def _existing_bomb_threatens(self, base: tuple[int, int]) -> bool:
        """True if any known bomb's LOS-filtered blast covers `base` (redundant new bomb)."""
        for bpos in self._bombs:
            if base in self._blast_cells(bpos):
                return True
        return False

    def _escape_dir_from_blast(
        self, loc: tuple[int, int], heading: int, mask: np.ndarray
    ) -> Optional[int]:
        """Return an action that, starting now, would let us be Chebyshev > BOMB_BLAST_R
        from the bomb we are ABOUT to drop, within BOMB_TIMER-1 ticks.

        Simple model: assume we drop here, then move 3 tiles in some direction.
        If FORWARD or BACKWARD is legal and not blocked, that's enough (3 tiles > radius 2).
        """
        for action in (ACT_FORWARD, ACT_BACKWARD):
            if mask[action] == 0:
                continue
            next_tile = self._project_tile(loc, heading, action)
            if not _in_grid(next_tile):
                continue
            if next_tile in self._compass.known_wall:
                continue
            return action
        return None

    def _enemy_bases_within(
        self, start: tuple[int, int], max_steps: int
    ) -> list[tuple[int, int]]:
        """Bounded safe-BFS: return live enemy bases reachable within max_steps."""
        live = self._live_enemy_bases()
        if not live:
            return []
        seen = {start: 0}
        queue = dq([start])
        found: list[tuple[int, int]] = []
        while queue:
            pos = queue.popleft()
            dist = seen[pos]
            if pos in live:
                found.append(pos)
            if dist >= max_steps:
                continue
            for d in range(4):
                if not self._edge_aware_walkable(pos, d):
                    continue
                dx, dy = DIR_DELTAS[d]
                nxt = (pos[0] + dx, pos[1] + dy)
                if nxt in seen:
                    continue
                if self._unsafe_now(nxt):
                    continue
                seen[nxt] = dist + 1
                queue.append(nxt)
        return found

    def _priority_target_lists(
        self, loc: tuple[int, int]
    ) -> list[list[tuple[int, int]]]:
        """Targets in priority order. Farmer strategy with wider detour:

        - Nearby enemy bases (<=4 steps): opportunistic detour, +50 if we land it.
        - Missions (+5), resources (+2), recons (+1) — re-eligible after respawn.
        - Far enemy bases: only chased if nothing else is reachable.

        Detour radius locked at 4: 0.443 board high. 6 and 8 both regressed in
        local smoke (cross-map base hunts crash exploration, drop bomb counts,
        and balloon score variance). Do not widen.
        """
        cur = self._tick

        def _ready(p: tuple[int, int]) -> bool:
            last = self._pickup_tick.get(p)
            return last is None or (cur - last) >= TILE_FILTER_TICKS

        def _filter(positions) -> list[tuple[int, int]]:
            return [p for p in positions if _ready(p)]

        nearby_bases = self._enemy_bases_within(loc, max_steps=4)
        far_bases = [b for b in self._live_enemy_bases() if b not in nearby_bases]

        # Cross-round filter: in round 3+ (after 2 rounds of data), any base we
        # never killed in past rounds is probably contested or unreachable from
        # spawn — demote it from "nearby" to "far" so we farm pickups instead
        # of repeatedly failing to grab it.
        if self._round_idx >= 2:
            killed_ever = set(self._base_kill_count.keys())
            proven_nearby = [b for b in nearby_bases if b in killed_ever]
            unproven_nearby = [b for b in nearby_bases if b not in killed_ever]
            # Only apply the filter if we still have at least one proven target;
            # otherwise keep the original list so we don't give up entirely.
            if proven_nearby:
                nearby_bases = proven_nearby
                far_bases = far_bases + unproven_nearby

        return [
            nearby_bases,
            _filter(self._compass.static_missions),
            _filter(self._compass.seen_mission),
            _filter(self._compass.static_resources),
            _filter(self._compass.seen_resource),
            _filter(self._compass.static_recons),
            _filter(self._compass.seen_recon),
            far_bases,
        ]

    def _action_for_world_dir(
        self, world_dir: int, heading: int, mask: np.ndarray
    ) -> Optional[int]:
        """Pick an action that progresses toward world_dir.

        Strategy (in priority order):
        - rel == 0: FORWARD if legal; else rotate toward an unblocked side.
        - rel == 1: rotate RIGHT (clockwise).
        - rel == 2: rotate (target is behind; rotating twice puts target in front and
                    keeps viewcone facing where we're going. BACKWARD is an emergency
                    fallback if rotation is somehow blocked).
        - rel == 3: rotate LEFT (counter-clockwise).

        LEFT and RIGHT validators always return True in the env, so rotation
        almost always succeeds.
        """
        rel = (world_dir - heading) % 4

        if rel == 0:
            if mask[ACT_FORWARD] == 1:
                return ACT_FORWARD
            # FORWARD blocked by wall: rotate to find a way around.
            return self._unstick_rotation(mask)

        if rel == 1:
            return ACT_RIGHT if mask[ACT_RIGHT] == 1 else (
                ACT_LEFT if mask[ACT_LEFT] == 1 else (
                    ACT_FORWARD if mask[ACT_FORWARD] == 1 else None))

        if rel == 2:
            # Prefer rotation to face target; flip side per call to avoid coupling.
            self._stuck_unstick_dir ^= 1
            first = ACT_RIGHT if self._stuck_unstick_dir == 0 else ACT_LEFT
            second = ACT_LEFT if first == ACT_RIGHT else ACT_RIGHT
            if mask[first] == 1:
                return first
            if mask[second] == 1:
                return second
            # Rotations both masked (shouldn't happen) — fall back to BACKWARD/FORWARD
            if mask[ACT_BACKWARD] == 1:
                return ACT_BACKWARD
            if mask[ACT_FORWARD] == 1:
                return ACT_FORWARD
            return None

        # rel == 3
        return ACT_LEFT if mask[ACT_LEFT] == 1 else (
            ACT_RIGHT if mask[ACT_RIGHT] == 1 else (
                ACT_FORWARD if mask[ACT_FORWARD] == 1 else None))

    def _unstick_rotation(self, mask: np.ndarray) -> Optional[int]:
        """FORWARD is blocked — rotate to a perpendicular heading and try again next tick."""
        self._stuck_unstick_dir ^= 1
        first = ACT_RIGHT if self._stuck_unstick_dir == 0 else ACT_LEFT
        second = ACT_LEFT if first == ACT_RIGHT else ACT_RIGHT
        if mask[first] == 1:
            return first
        if mask[second] == 1:
            return second
        if mask[ACT_BACKWARD] == 1:
            return ACT_BACKWARD
        return None

    def _safe_legal(self, mask: np.ndarray) -> int:
        # Prefer non-stationary: FORWARD > rotate RIGHT > rotate LEFT > BACKWARD > STAY > BOMB
        for action in (ACT_FORWARD, ACT_RIGHT, ACT_LEFT, ACT_BACKWARD, ACT_STAY, ACT_PLACE_BOMB):
            if mask[action] == 1:
                return action
        return ACT_STAY
