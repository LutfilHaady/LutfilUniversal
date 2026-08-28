---
name: feedback-test-background
description: Always run Playwright tests in background mode — foreground runs block and appear to hang
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f7f523bd-6f58-4ad4-a43f-6ab53bee0127
---

Always run `npx playwright test` with `run_in_background: true`. Foreground runs hang silently (no streaming output) and the user thinks Claude is stuck.

**Why:** The test suite takes 5-10 minutes. Foreground Bash calls show no output until completion, making it look frozen.

**How to apply:** Every `npx playwright test` call should use `run_in_background: true`. Continue working or communicate with the user while waiting.
