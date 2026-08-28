---
name: project-overview
description: DSTA BrainHack TIL-AI 2026 competition repo - what it is and what each challenge requires
metadata: 
  node_type: memory
  type: project
  originSessionId: e1c86748-9d8d-4cb3-89ec-15748c86c97a
---

DSTA BrainHack TIL-AI 2026 competition. The repo has 5 challenge tracks: ASR, CV, Noise, NLP, AE. Each has a Docker container that runs a model server; organizers POST observations and expect predictions back. The user is focused on the AE challenge.

**Why:** Competition on GCP, submission via `til build/test/submit <challenge>`.

**How to apply:** The `til` CLI on GCP handles Docker build/test/submit. Model files must be baked into Docker images. No internet access during evaluation.
