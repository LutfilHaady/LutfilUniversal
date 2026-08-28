"""
ae_manager.py — Entry point for the AE Docker container.

ae_server.py imports AEManager from this file.

Selection (env var ``TIL_AE_AGENT``):
    "heuristic"  — rule-based AE (default). Local smoke: score ~0.572 on Novice.
    "rl"         — PPO checkpoint from models/best_model.zip.
    "classical"  — original tiny baseline (viewcone-only).

Heuristic is the current production agent. Switch with:
    docker run -e TIL_AE_AGENT=rl ...
"""

import os

_AGENT = os.environ.get("TIL_AE_AGENT", "heuristic").strip().lower()

if _AGENT == "rl":
    from ae_manager_rl import AEManager  # noqa: F401
elif _AGENT == "classical":
    from ae_manager_classical import AEManager  # noqa: F401
else:
    from ae_manager_heuristic import AEManager  # noqa: F401
