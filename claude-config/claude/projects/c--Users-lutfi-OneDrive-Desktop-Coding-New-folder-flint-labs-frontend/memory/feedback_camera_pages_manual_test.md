---
name: feedback-camera-pages-manual-test
description: "Camera-dependent pages (QR scanner) aren't reliably E2E-testable in headless Playwright — verify manually"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a3699ed7-c1f3-42cd-818d-c18db2fecf57
---

`/scan` and `/log/process-step` mount the `@yudiel/react-qr-scanner` `Scanner` (getUserMedia). The headless Playwright env has **no camera**, so the `Scanner` errors (caught by its `onError`, logged only) and makes those pages' submit timing non-deterministic under full-suite load — tests flake even though the underlying logic is correct.

**Why:** Proven 2026-06-05 — the process-step submit chain (POST `process_runs` → inputs → params → PATCH `AwaitingQC` → success screen) fires cleanly in isolation but the E2E test flaked as test #10/#11 under suite load. Not a product bug; an env limitation.

**How to apply:** Don't chase green on camera-page E2E flakes with force-clicks/inflated timeouts. Mark the camera-dependent submit assertions `test.skip` with a note and verify those flows manually in a real browser. The user prefers this. Non-camera behaviour on those pages (validation, lookups, gating) is still fine to assert. See [[project_backend_live]].
