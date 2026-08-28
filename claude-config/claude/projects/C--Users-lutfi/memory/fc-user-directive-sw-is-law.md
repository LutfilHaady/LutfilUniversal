---
name: fc-user-directive-sw-is-law
description: "User directive — the process flow doc is authoritative (\"law\"), do not second-guess or re-confirm its rules"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da3f087d-f863-40b9-b629-e67b1485da18
---

The user said "everything mentioned in the sw [process flow doc] is confirmed
and law, keep that in mind." Treat `docs/FC_Completion_Report_Process_Flow_for_Review.md`
as the settled spec for the FC Completion Report macro.

**Why:** User doesn't want to be re-asked about rules already written in the
process flow doc. They confirmed all 8 open questions in one go.

**How to apply:** Implement directly against the process flow doc's rules without
seeking re-confirmation. Only ask about things NOT covered by the doc (e.g.
actual staff names, output file naming). See [[fc-process-flow-confirmed]].
