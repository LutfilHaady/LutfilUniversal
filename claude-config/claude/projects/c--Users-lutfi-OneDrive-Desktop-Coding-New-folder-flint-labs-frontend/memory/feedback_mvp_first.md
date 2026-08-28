---
name: feedback-mvp-first
description: User prefers shipping a minimal working version fast and deferring ambitious scope
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1da352ba-2d2f-429c-b300-0a6fbb0403fa
---

When scoping a feature, the user tends to start ambitious ("full custom rule builder") but then pulls back to "make a simple version that works, KIV the big one" — often under a near-term deadline (e.g. "MVP by tomorrow"). On the alerts feature (2026-06-04) they explicitly chose the full generic engine, then reversed to a minimal-schema MVP.

**Why:** They value working software shipped on time over completeness; ambitious designs are aspirational, not commitments.

**How to apply:** When a request sounds large, surface the effort/scope cost early and offer a phased MVP-first path. Keep DB/schema additions minimal. Explicitly list what's being KIV'd in the spec so the deferred scope is captured, not lost. Don't over-build. See [[project-alerts-mvp]].
