"""Novice-map static probe.

The novice track uses a FIXED arena (seed 88 in Dynamics.reset). We can spin
up the env once on import and cache:

  * the 6 base positions (one per team)
  * every indestructible wall edge (in our internal (x, y, dir) format)
  * every destructible wall edge   (dumped for reference; NOT pre-seeded in BFS
    because opponents may destroy them mid-game — viewcone updates those live)

Static missions / resources / recons are already probed by
``ae_manager_rl.probe_novice_static_compass`` — we reuse that to avoid drift.

Why this is legal: the novice spec on the wiki literally says
    "For the Novice track, the map used in the environment will be held fixed."
"""

from __future__ import annotations

from dataclasses import dataclass, field

from til_environment.types import Direction


@dataclass
class NoviceMap:
    """Cached static layout for the Novice arena (seed 88)."""

    bases: list[tuple[int, int]] = field(default_factory=list)
    indestructible_edges: set[tuple[int, int, int]] = field(default_factory=set)
    destructible_edges: set[tuple[int, int, int]] = field(default_factory=set)


_CACHE: NoviceMap | None = None


def _expand_edge(ax: int, ay: int, direction_value: int) -> list[tuple[int, int, int]]:
    """Walls are bidirectional: a wall on the RIGHT edge of (ax, ay) is also
    on the LEFT edge of (ax+1, ay). Return both forms for cheap lookup.
    direction_value follows the ``Direction`` enum: 0=RIGHT, 1=DOWN, 2=LEFT, 3=UP.
    """
    out: list[tuple[int, int, int]] = [(ax, ay, direction_value)]
    deltas = {0: (1, 0), 1: (0, 1), 2: (-1, 0), 3: (0, -1)}
    dx, dy = deltas[direction_value]
    bx, by = ax + dx, ay + dy
    if 0 <= bx < 16 and 0 <= by < 16:
        out.append((bx, by, (direction_value + 2) % 4))
    return out


def probe_novice_map() -> NoviceMap:
    """Spin the env up once on the deterministic novice seed and dump the layout."""
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    from til_environment.bomberman_env import Bomberman
    from til_environment.config import default_config

    cfg = default_config()
    cfg.env.novice = True
    bomber = Bomberman(cfg=cfg)
    bomber.reset()

    cache = NoviceMap()

    # All 6 bases — we'll filter out our own once we see our first observation.
    for base in bomber.dynamics.registry.bases():
        cache.bases.append((int(base.position[0]), int(base.position[1])))

    # Every wall edge in the arena.  Each WallEdge has canonical (ax, ay, dir).
    for edge in bomber.dynamics.arena_state.wall_edges.values():
        for tup in _expand_edge(int(edge.ax), int(edge.ay), int(edge.direction.value)):
            if edge.destructible:
                cache.destructible_edges.add(tup)
            else:
                cache.indestructible_edges.add(tup)

    bomber.close()
    _CACHE = cache
    return cache
