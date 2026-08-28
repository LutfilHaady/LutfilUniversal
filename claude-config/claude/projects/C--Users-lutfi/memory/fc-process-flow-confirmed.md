---
name: fc-process-flow-confirmed
description: All 8 process flow questions (Q1-Q8) for FC Completion Report confirmed by user on 2026-06-18 — the process flow doc is now authoritative
metadata: 
  node_type: memory
  type: project
  originSessionId: da3f087d-f863-40b9-b629-e67b1485da18
---

All 8 questions in `docs/FC_Completion_Report_Process_Flow_for_Review.md` were
confirmed on 2026-06-18. The user stated: "everything mentioned in the sw is
confirmed and law, keep that in mind."

**Why:** These answers unblock the remaining implementation (EM/EL split,
BuildOutput, MainMacro). The process flow doc is the authoritative spec — do not
re-ask these questions.

**How to apply:** Treat the process flow doc as settled. Implement directly
against its rules. The only remaining blockers are CLAUDE.md data blanks (staff
names, output naming).

Additional note from Q7: when falling back from blank "Latest CCF Creation User"
to "FC Created By", **highlight** the affected rows rather than falling back
silently.
