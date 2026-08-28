# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a DSTA BrainHack TIL-AI 2026 competition repository. It contains five AI challenges, each deployed as an independent Docker-based FastAPI microservice. The `til` CLI (available on GCP Workbench) handles build, test, and submission.

## Development Commands

```bash
# Install development dependencies (run from repo root)
pip install -r requirements-dev.txt

# Initialize git submodules (required once)
git submodule update --init

# Build, test, submit a challenge (on GCP Workbench via `til` CLI)
til build asr
til test asr
til submit asr

# Run a test script directly (assumes the Docker container is already running on the expected port)
cd test && python test_asr.py
cd test && python test_nlp.py
```

Environment variables (`TEAM_NAME`, `TEAM_TRACK`) are read from a `.env` file in the repo root.

## Architecture

Each challenge (`asr/`, `cv/`, `noise/`, `nlp/`, `ae/`) follows the same pattern:
- `src/*_manager.py` — implement your model here (`__init__` loads the model; the main method runs inference)
- `src/*_server.py` — FastAPI server; generally do not modify
- `Dockerfile` — Docker image build
- `requirements.txt` — container dependencies only

The `test/` directory contains scoring scripts that send HTTP requests to a running container and compute the evaluation metric locally.

### Service ports

| Challenge | Port | Route |
|-----------|------|-------|
| ASR       | 5001 | `/asr` |
| CV        | 5002 | `/cv` |
| Noise     | 5003 | `/noise` |
| NLP       | 5004 | `/nlp` |
| AE        | 5005 | `/ae`, `/reset` |

### Challenge-specific notes

**ASR** — Receives base64-encoded WAV audio; returns transcript strings. Scored by WER (English/Malay/Tamil) and CER (Chinese), averaged across 4 languages.

**CV** — Receives base64-encoded JPEG images; returns COCO-format bounding box predictions `[x, y, w, h]` with `category_id`. Scored by COCO mAP@.5:.05:.95.

**Noise** — Receives JPEG images; returns adversarially noised versions as base64 strings. Scored by a fairness-based pass rate using SSIM and bbox-level quality metrics (config: `test/noise_eval/eval_thresholds_v2.yaml`).

**NLP** — RAG-based QA system. The first request to `/nlp` carries a `documents` list (corpus load); the server returns `"loading"` or `"loaded"` — the evaluator polls until `"loaded"`. Subsequent requests carry `question` keys. Scored by answer equivalence using a fine-tuned encoder at `test/models/nlp_eval_512`.

**AE** — Bomberman-style agent. Receives `observation` dicts (viewcone, direction, location, scout, step); returns an integer `action`. The `/reset` endpoint reinitializes `AEManager` between rounds. The `til_environment` package (from the `til-26-ae` git submodule) provides the training/test environment.

### Git submodules

- `til-26-ae/` — provides the `til_environment` package (installed via `-e ./til-26-ae` in `requirements-dev.txt`). Do not modify.
- `til-26-finals/` — pulled in for semifinals/finals. Do not modify.
