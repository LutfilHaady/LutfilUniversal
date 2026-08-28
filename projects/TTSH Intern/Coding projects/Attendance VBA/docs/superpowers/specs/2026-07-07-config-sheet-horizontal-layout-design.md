# Config Sheet — Horizontal Layout for Growable Lists — Design Spec

Date: 2026-07-07

## Purpose

The Config sheet currently stacks its sections vertically in a single column (A): Grace
Period/Hours Unit, Department Schedule (`tblSchedule`), Verification Options
(`tblVerification`), Colour Legend, Recognized Roster Leave Codes (`tblRosterCodes`).
`tblVerification` sits directly above the Colour Legend section with only a 2-row gap —
adding more than a couple of new verification options would grow the table into the
Colour Legend's cells. This spec re-lays the sheet out so `tblVerification` and
`tblRosterCodes` (the two tables meant to be edited/extended by a manager over time) each
get their own column, with nothing else ever placed below them, so they can grow to any
number of rows without colliding with another section.

This is a pure layout change. `Helpers.LoadConfig`/`LoadRoster` locate `tblSchedule`,
`tblVerification`, and `tblRosterCodes` by name (`lo.Name = "tblVerification"`, etc.), not
by position, so no VBA code changes are required.

## New layout

Rows 1-4 (title, Grace Period, Hours Unit) are unchanged, spanning the top of the sheet.

From row 5 down, four independent column-blocks sit side by side, each starting at row 5
(section header) and row 6 (table header, where applicable):

| Block | Columns | Row 5 | Row 6 | Rows 7+ | Growth |
|---|---|---|---|---|---|
| Department Schedule | A-E | "DEPARTMENT SCHEDULE" | `tblSchedule` header | data (unchanged, 21 rows today) | occasional, out of scope |
| Verification Options | G (spacer F) | "VERIFICATION OPTIONS (for 'NO PUNCH - VERIFY' days)" | `tblVerification` header ("Option") | data | **unlimited** |
| Roster Leave Codes | I (spacer H) | "RECOGNIZED ROSTER LEAVE CODES (auto-fills Verification from the Roster sheet)" | `tblRosterCodes` header ("Code") | data | **unlimited** |
| Colour Legend | K/L (spacer J) | "COLOUR LEGEND (applied automatically by the macro)" | (no table header — plain text rows) | 4 fixed label/swatch rows (K = label, L = colour fill) | fixed, never grows |

Column F, H, J are left blank as visual gutters between blocks. Column widths for G, I, K
follow the existing A-column convention (~30 wide) so header text isn't clipped; L keeps
the existing swatch-column width (~14, matching the current B-column swatch width).

Because each block owns its own column with nothing beneath it anywhere on the sheet,
`tblVerification` and `tblRosterCodes` can grow to any number of rows without ever
reaching another section — no buffer-size guess involved, unlike the previous stacked
layout.

The Colour Legend's swatch fills (currently misplaced at `B41:B44`, 8 rows away from
their `A49:A52` labels — a preexisting bug, already fixed in a prior session by moving the
fills to `B49:B52`) move again as part of this layout change, from `B49:B52` to `L7:L10`,
alongside their relabeled `K7:K10` text.

## Documentation

`Attendance_Analyzer.xlsx`'s Instructions sheet gets two new steps, mirroring the existing
"Adding a new department" section:

- "Adding a new verification option" — go to Config, `tblVerification` (column G), type
  the new option in the row below the last one.
- "Adding a new roster leave code" — go to Config, `tblRosterCodes` (column I), type the
  new code in the row below the last one.

## Out of scope

- No change to `tblSchedule`'s columns/position (A-E) or to how departments are added.
- No VBA changes — this is a spreadsheet-only edit.
- No change to the Verification dropdown's behavior, the roster-code matching logic, or
  any classification/report-generation logic.

## Files touched

- `Attendance_Analyzer.xlsx` (tracked in this repo) — Config sheet cells rearranged into
  the column-block layout above; Instructions sheet gets the two new steps.
- `Attendance_Analyzer_Context.md` — update the Config sheet layout description to match.
