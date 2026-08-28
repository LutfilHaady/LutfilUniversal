# IT Assets Workbook Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx` — a copy of the source workbook with all 5 department sheets unified to one canonical schema, Excel Tables, live lookup/classification formulas, a Power-Query-driven `MASTER` sheet, a rebuilt `OVERVIEW`, and a new `Data Issues` / `Notes` sheet — while the source file stays untouched.

**Architecture:** Excel COM automation (`win32com.client`), driven from Python, in three scripts: `extract.py` (read + normalize source data, pure Python, no COM), `build.py` (COM: copy source → rewrite dept sheets → formulas/validation/Power Query/protection/OVERVIEW/new sheets), `verify.py` (COM: open the built file and assert correctness). No VBA in the output file.

**Tech Stack:** Python 3.12, `openpyxl` 3.1.5 (read-only inspection only), `pywin32` (COM automation — confirmed working, Excel 16.0), no third-party Excel-writer libraries for the build step (COM only, to support Power Query creation and the legacy form control).

## Global Constraints

- Source file `July 2026 FC IT Assets Management list (Cost centre checked).xlsx` must never be opened for writing — read-only inspection (openpyxl) or COM `Workbooks.Open(..., ReadOnly=True)` only, followed immediately by `SaveAs` to the new filename before any mutation.
- All COM scripts must `xl.Quit()` in a `finally` block and set `DisplayAlerts = False` during the session to avoid orphaned `EXCEL.EXE` processes or blocking dialogs.
- Canonical schema is exactly the 23 columns in this order (from `docs/superpowers/specs/2026-07-17-it-assets-rebuild-design.md`):
  `Asset ID, Dept Ref No., Asset Group, User, Asset Type, Asset Category, ITD Tag No., Serial No., Finance Asset Tag, Host Name, Location, Nickname, Topaz Installation, NGEMR EUD Deployment, Deployment Date, TDR Status, TDR Updated Date, Reprint Needed (Nov 2024), Cost Centre, Status, Last Updated, Remarks, TDR Remarks`
- Asset Category canonical values: `Laptop, Tablet, Monitor + CPU, CPU, Printer, Document Scanner, Topaz Signature Pad, Nets Machine, Other (Review)`.
- Total source asset rows = 171 across the 5 dept sheets (verified against the live file — see Task 1). Every row must be accounted for as either an asset row or a junk/notes row; none may be silently dropped.

---

## Verified Source Facts (re-checked against the live workbook this session — use these, don't re-derive)

**Sheet names (exact, case-sensitive):**
`OVERVIEW`, `A1 L5 (Peixin)`, `ICH PSO(Sylvia)`, `PSO Office mTTSH Infligh (Yati)`, `AO+NCID (Fatris)`, `EDFC (Guo wei)`, `Condemned`, `Dirty Laptop`, `Fixed Asset list`.

**Dept sheet column mapping** (header row 2, data starts row 3; column letters verified against live headers):

| Dept | Sheet name | Code | Data rows | no | user | asset_type | itd_tag | serial | finance_tag | host | location | nickname | topaz | ngemr | deploy_date | tdr_status | tdr_updated | reprint | remarks1 | remarks2 | cost_centre | last_updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 L5 (Peixin) | `A1 L5 (Peixin)` | A1L5 | 3-30 | A | B | C | D | E | F | G | H | I | J | M | N | O | P | R | L | Q | S | K |
| ICH PSO (Sylvia) | `ICH PSO(Sylvia)` | ICHPSO | 3-29 | A | B | C | D | E | F | G | H | I | — | — | — | — | — | — | L | M | N | J |
| PSO Office (Yati) | `PSO Office mTTSH Infligh (Yati)` | PSOINF | 3-43 | A | B | C | D | E | F | G | H | I | — | — | — | — | — | — | K | L | M | J |
| AO+NCID (Fatris) | `AO+NCID (Fatris)` | AONCID | 3-54 | A | B | C | D | E | F | G | H | I | — | L | M | N | O | P | K | Q | R | J |
| EDFC (Guo wei) | `EDFC (Guo wei)` | EDFC | 3-25 | A | B | C | D | E | F | G | H | I | — | — | — | — | — | — | K | L | M | J |

(ICH PSO column K is a genuinely blank header between Last Updated and Remarks — skip it, don't map it.)

**Row-count check:** (30-3+1)+(29-3+1)+(43-3+1)+(54-3+1)+(25-3+1) = 28+27+41+52+23 = **171**. Matches the number this plan's Task 1 must assert.

**Asset Group block ranges** (only A1L5, ICHPSO, EDFC have no internal blocks — `Asset Group` stays blank for those three):

| Sheet | Rows | Asset Group label | Junk? |
|---|---|---|---|
| PSOINF | 3-18 | `Laptops & Tablets` | no |
| PSOINF | 19-26 | `Scanners` | no |
| PSOINF | 27-36 | `Signature Pads` | no |
| PSOINF | 37-43 | *(n/a — junk)* | **yes → Notes** |
| AONCID | 3-17 | `NCID Inflight / Common User` | no |
| AONCID | 18-19 | `Lenovo x12 Detachable` | no |
| AONCID | 20-37 | `Scanners & Signature Pads` | no |
| AONCID | 38-52 | `2026 Inventory` | no |
| AONCID | 53-54 | *(n/a — junk)* | **yes → Notes** |

**Junk-row rule (verified against live data):** a row is junk if `asset_type`, `itd_tag`, and `serial` are ALL blank/None. This correctly captures PSOINF rows 37-43 (7 rows, though only 41 and 43 have actual note text — the rest are fully blank spacer rows, still moved to Notes for cleanliness) and AONCID rows 53-54 (2 rows). Total junk = 9, total asset rows = 171 - 9 = **162**.

**Lookup sheets:**
- `Fixed Asset list`, header row 1, 140 data rows: `E`=Asset Tag No., `G`=Inventory No., `H`=Serial No., `I`=Cost Centre. Cost Centre formulas key on `H` (Serial No.), not ITD Tag No.
- `Condemned`, header row 1, 6 data rows (rows 2-7): `E`=Serial No.
- `Dirty Laptop`, header row 1, 17 data rows (rows 2-18): `B`=SERIAL #.

**Threaded/plain comments to reinject** (text verified in prior session, cell positions below are the ORIGINAL positions — Task 4 maps each to its NEW column in the canonical schema):
- `A1 L5 (Peixin)!B25` (User column, unchanged position = new col D `User`) — Leow Jia Min Charmaine (TTSH): "Where is this laptop located?"
- `EDFC (Guo wei)!D3` (old ITD Tag col → new col G `ITD Tag No.`) — Wee Geik Siau (TTSH): "Old -903PC197563"
- `EDFC (Guo wei)!E3` (old Serial col → new col H `Serial No.`) — Wee Geik Siau (TTSH): "Old- PC17QP9S"
- `EDFC (Guo wei)!F3` (old Finance Tag col → new col I `Finance Asset Tag`) — Wee Geik Siau (TTSH): "Old-51031184-0/2019"
- `EDFC (Guo wei)!G3` (old Host col → new col J `Host Name`) — Wee Geik Siau (TTSH): "Old - TTSAX2197563PNS"
- `EDFC (Guo wei)!G4`, `G5` (old Host col row 4/5 → new col J, rows 4/5) — legacy plain comments, text read live in Task 4 (openpyxl can read plain, non-threaded comments directly — no hardcoded text needed, unlike the threaded ones above).
- `EDFC (Guo wei)!D12`, `D13` (old ITD Tag col rows 12/13 → new col G, rows 12/13) — legacy plain comments, text read live in Task 4.

**Legacy form control:** `A1 L5 (Peixin)` has a Group Box (`Group Box 1`) anchored near row 30. Preserved automatically by the SaveAs-copy approach in Task 3 as long as Task 4 does not delete/replace the sheet, only its cell contents.

---

### Task 1: Mapping constants + extraction of raw rows

**Files:**
- Create: `scripts/rebuild/mapping.py`
- Create: `scripts/rebuild/extract.py`
- Test: run `extract.py` directly (`python scripts/rebuild/extract.py`) — it prints its own assertions.

**Interfaces:**
- Produces: `mapping.SHEETS` (list of dicts: `name`, `code`, `first`, `last`, `cols` dict), `mapping.LOOKUPS` (dict), `mapping.BLOCKS` (dict of dept code → list of `(first, last, label, is_junk)` tuples).
- Produces: `extract.read_raw_rows(source_path: str) -> list[dict]` — one dict per source row with keys `dept_code`, `source_row`, plus every field name from the mapping (`no`, `user`, `asset_type`, `itd_tag`, `serial`, `finance_tag`, `host`, `location`, `nickname`, `topaz`, `ngemr`, `deploy_date`, `tdr_status`, `tdr_updated`, `reprint`, `remarks1`, `remarks2`, `cost_centre`, `last_updated` — `None` for fields the dept doesn't have).

- [ ] **Step 1: Write `scripts/rebuild/mapping.py`**

```python
SHEETS = [
    {"name": "A1 L5 (Peixin)", "code": "A1L5", "first": 3, "last": 30,
     "cols": {"no": "A", "user": "B", "asset_type": "C", "itd_tag": "D", "serial": "E",
              "finance_tag": "F", "host": "G", "location": "H", "nickname": "I", "topaz": "J",
              "last_updated": "K", "remarks1": "L", "ngemr": "M", "deploy_date": "N",
              "tdr_status": "O", "tdr_updated": "P", "remarks2": "Q", "reprint": "R",
              "cost_centre": "S"}},
    {"name": "ICH PSO(Sylvia)", "code": "ICHPSO", "first": 3, "last": 29,
     "cols": {"no": "A", "user": "B", "asset_type": "C", "itd_tag": "D", "serial": "E",
              "finance_tag": "F", "host": "G", "location": "H", "nickname": "I",
              "last_updated": "J", "remarks1": "L", "remarks2": "M", "cost_centre": "N"}},
    {"name": "PSO Office mTTSH Infligh (Yati)", "code": "PSOINF", "first": 3, "last": 43,
     "cols": {"no": "A", "user": "B", "asset_type": "C", "itd_tag": "D", "serial": "E",
              "finance_tag": "F", "host": "G", "location": "H", "nickname": "I",
              "last_updated": "J", "remarks1": "K", "remarks2": "L", "cost_centre": "M"}},
    {"name": "AO+NCID (Fatris)", "code": "AONCID", "first": 3, "last": 54,
     "cols": {"no": "A", "user": "B", "asset_type": "C", "itd_tag": "D", "serial": "E",
              "finance_tag": "F", "host": "G", "location": "H", "nickname": "I",
              "last_updated": "J", "remarks1": "K", "ngemr": "L", "deploy_date": "M",
              "tdr_status": "N", "tdr_updated": "O", "reprint": "P", "remarks2": "Q",
              "cost_centre": "R"}},
    {"name": "EDFC (Guo wei)", "code": "EDFC", "first": 3, "last": 25,
     "cols": {"no": "A", "user": "B", "asset_type": "C", "itd_tag": "D", "serial": "E",
              "finance_tag": "F", "host": "G", "location": "H", "nickname": "I",
              "last_updated": "J", "remarks1": "K", "remarks2": "L", "cost_centre": "M"}},
]

ALL_FIELDS = ["no", "user", "asset_type", "itd_tag", "serial", "finance_tag", "host",
              "location", "nickname", "topaz", "ngemr", "deploy_date", "tdr_status",
              "tdr_updated", "reprint", "remarks1", "remarks2", "cost_centre", "last_updated"]

LOOKUPS = {
    "fixed_asset_list": {"sheet": "Fixed Asset list", "header_row": 1, "last_row": 140,
                          "serial_col": "H", "cost_centre_col": "I"},
    "condemned": {"sheet": "Condemned", "header_row": 1, "last_row": 7, "serial_col": "E"},
    "dirty_laptop": {"sheet": "Dirty Laptop", "header_row": 1, "last_row": 18, "serial_col": "B"},
}

# (first_row, last_row, label, is_junk) per dept code. Depts not listed here have a single
# implicit block covering their whole range, with a blank Asset Group label.
BLOCKS = {
    "PSOINF": [
        (3, 18, "Laptops & Tablets", False),
        (19, 26, "Scanners", False),
        (27, 36, "Signature Pads", False),
        (37, 43, "", True),
    ],
    "AONCID": [
        (3, 17, "NCID Inflight / Common User", False),
        (18, 19, "Lenovo x12 Detachable", False),
        (20, 37, "Scanners & Signature Pads", False),
        (38, 52, "2026 Inventory", False),
        (53, 54, "", True),
    ],
}

CANONICAL_COLUMNS = [
    "Asset ID", "Dept Ref No.", "Asset Group", "User", "Asset Type", "Asset Category",
    "ITD Tag No.", "Serial No.", "Finance Asset Tag", "Host Name", "Location", "Nickname",
    "Topaz Installation", "NGEMR EUD Deployment", "Deployment Date", "TDR Status",
    "TDR Updated Date", "Reprint Needed (Nov 2024)", "Cost Centre", "Status", "Last Updated",
    "Remarks", "TDR Remarks",
]

ASSET_CATEGORIES = ["Laptop", "Tablet", "Monitor + CPU", "CPU", "Printer", "Document Scanner",
                     "Topaz Signature Pad", "Nets Machine", "Other (Review)"]
```

- [ ] **Step 2: Write `scripts/rebuild/extract.py` with `read_raw_rows`**

```python
import openpyxl
from mapping import SHEETS, ALL_FIELDS

def read_raw_rows(source_path: str) -> list[dict]:
    wb = openpyxl.load_workbook(source_path, data_only=True)
    rows = []
    for sheet in SHEETS:
        ws = wb[sheet["name"]]
        for r in range(sheet["first"], sheet["last"] + 1):
            row = {"dept_code": sheet["code"], "source_row": r}
            for field in ALL_FIELDS:
                col = sheet["cols"].get(field)
                row[field] = ws[f"{col}{r}"].value if col else None
            rows.append(row)
    return rows

if __name__ == "__main__":
    rows = read_raw_rows("../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx")
    assert len(rows) == 171, f"expected 171 raw rows, got {len(rows)}"
    by_dept = {}
    for row in rows:
        by_dept[row["dept_code"]] = by_dept.get(row["dept_code"], 0) + 1
    expected = {"A1L5": 28, "ICHPSO": 27, "PSOINF": 41, "AONCID": 52, "EDFC": 23}
    assert by_dept == expected, f"expected {expected}, got {by_dept}"
    print("OK: 171 raw rows,", by_dept)
```

- [ ] **Step 3: Run it**

Run: `cd scripts/rebuild && python extract.py`
Expected output: `OK: 171 raw rows, {'A1L5': 28, 'ICHPSO': 27, 'PSOINF': 41, 'AONCID': 52, 'EDFC': 23}`

- [ ] **Step 4: Commit**

```bash
git add scripts/rebuild/mapping.py scripts/rebuild/extract.py
git commit -m "feat: add source mapping and raw-row extraction for assets rebuild"
```

---

### Task 2: Clean, classify, group, and assign Asset IDs

**Files:**
- Modify: `scripts/rebuild/extract.py`

**Interfaces:**
- Consumes: `read_raw_rows()` output from Task 1.
- Produces: `normalize_rows(raw_rows: list[dict]) -> tuple[list[dict], list[dict]]` returning `(asset_rows, junk_rows)`. Each `asset_row` adds keys: `asset_group` (str), `asset_category` (str, one of `mapping.ASSET_CATEGORIES`), `asset_id` (str, e.g. `"A1L5-001"`), plus cleaned `serial` and `itd_tag` (whitespace + `\xa0` stripped). `junk_rows` keep the original raw fields, unmodified, plus `dept_code`/`source_row`.
- Produces: `classify_category(asset_type: str | None) -> str` — pure function, keyword-based.

- [ ] **Step 1: Add `classify_category` and `clean_text`**

```python
def clean_text(value):
    if value is None:
        return None
    text = str(value).replace("\xa0", "").strip()
    return text if text else None

def classify_category(asset_type):
    text = (asset_type or "").lower()
    has = lambda kw: kw in text
    if has("laptop"):
        return "Laptop"
    if has("tablet") or has("ipad"):
        return "Tablet"
    if has("monitor") and has("cpu"):
        return "Monitor + CPU"
    if has("cpu") or has("desktop"):
        return "CPU"
    if has("printer"):
        return "Printer"
    if has("scanner"):
        return "Document Scanner"
    if has("topaz") or has("signature pad") or has("singnature pad") or has("sign pad"):
        return "Topaz Signature Pad"
    if has("nets"):
        return "Nets Machine"
    return "Other (Review)"
```

- [ ] **Step 2: Add block/junk lookup and `normalize_rows`**

```python
from mapping import BLOCKS

def _block_for(dept_code, source_row):
    for first, last, label, is_junk in BLOCKS.get(dept_code, []):
        if first <= source_row <= last:
            return label, is_junk
    return "", False

def normalize_rows(raw_rows):
    asset_rows, junk_rows = [], []
    counters = {}
    for row in raw_rows:
        # _block_for already encodes junk status from the verified row ranges in
        # mapping.BLOCKS (PSOINF 37-43, AONCID 53-54); depts with no BLOCKS entry
        # always return is_junk=False.
        label, is_junk = _block_for(row["dept_code"], row["source_row"])
        if is_junk:
            junk_rows.append(row)
            continue
        row = dict(row)
        row["serial"] = clean_text(row["serial"])
        row["itd_tag"] = clean_text(row["itd_tag"])
        row["asset_group"] = label
        row["asset_category"] = classify_category(row["asset_type"])
        n = counters.get(row["dept_code"], 0) + 1
        counters[row["dept_code"]] = n
        row["asset_id"] = f"{row['dept_code']}-{n:03d}"
        asset_rows.append(row)
    return asset_rows, junk_rows
```

- [ ] **Step 3: Extend the `__main__` block with assertions**

```python
    asset_rows, junk_rows = normalize_rows(rows)
    assert len(junk_rows) == 9, f"expected 9 junk rows, got {len(junk_rows)}"
    assert len(asset_rows) == 162, f"expected 162 asset rows, got {len(asset_rows)}"
    ids = [r["asset_id"] for r in asset_rows]
    assert len(ids) == len(set(ids)), "Asset IDs are not unique"
    cats = {}
    for r in asset_rows:
        cats[r["asset_category"]] = cats.get(r["asset_category"], 0) + 1
    print("OK: 162 asset rows, 9 junk rows, IDs unique")
    print("Category counts:", cats)
```

- [ ] **Step 4: Run it**

Run: `cd scripts/rebuild && python extract.py`
Expected output includes: `OK: 162 asset rows, 9 junk rows, IDs unique` and a `Category counts:` line whose values sum to 162. Manually eyeball the `Other (Review)` count — the design doc records 10 from the prior session's classifier; a different count here is expected (this is a new classifier) and is fine, it just means Task 8's Data Issues sheet lists whatever this run actually finds.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebuild/extract.py
git commit -m "feat: clean, classify, group, and assign asset IDs during extraction"
```

---

### Task 3: Copy source workbook to the output file via COM

**Files:**
- Create: `scripts/rebuild/com_utils.py`
- Create: `scripts/rebuild/build.py`

**Interfaces:**
- Produces: `com_utils.excel_session()` — context manager yielding a COM `Application` object, `DisplayAlerts=False`, `Visible=False`, guaranteed `Quit()` on exit.
- Produces: `build.copy_source_to_output(source_path: str, output_path: str) -> None` — opens source read-only, `SaveAs` to `output_path`, closes both.

- [ ] **Step 1: Write `scripts/rebuild/com_utils.py`**

```python
import contextlib
import win32com.client

@contextlib.contextmanager
def excel_session(visible=False):
    xl = win32com.client.Dispatch("Excel.Application")
    xl.Visible = visible
    xl.DisplayAlerts = False
    try:
        yield xl
    finally:
        xl.DisplayAlerts = False
        xl.Quit()
```

- [ ] **Step 2: Write `copy_source_to_output` in `scripts/rebuild/build.py`**

```python
import os
from com_utils import excel_session

def copy_source_to_output(source_path, output_path):
    source_path = os.path.abspath(source_path)
    output_path = os.path.abspath(output_path)
    if os.path.exists(output_path):
        os.remove(output_path)
    with excel_session() as xl:
        wb = xl.Workbooks.Open(source_path, ReadOnly=True)
        wb.SaveAs(output_path, FileFormat=51)  # xlOpenXMLWorkbook (.xlsx)
        wb.Close(SaveChanges=False)

if __name__ == "__main__":
    SRC = "../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx"
    OUT = "../../July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx"
    copy_source_to_output(SRC, OUT)
    print("OK: copied to", OUT)
```

- [ ] **Step 3: Run it and verify the copy opens cleanly**

Run: `cd scripts/rebuild && python build.py`
Expected output: `OK: copied to ...(Rebuild).xlsx`, and the file exists on disk (`ls` the AssetList folder). Then run a second check:

```bash
python -c "
from com_utils import excel_session
with excel_session() as xl:
    wb = xl.Workbooks.Open(r'C:\Users\lutfi\OneDrive\Desktop\TTSH Intern\Coding projects\AssetList\July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx')
    print(sorted(ws.Name for ws in wb.Worksheets))
    wb.Close(SaveChanges=False)
"
```

Expected: the same 9 sheet names as the source, printed with no COM exception (a repair prompt would raise a COM error or hang here since `DisplayAlerts=False` suppresses the dialog but the open would still throw on real corruption).

- [ ] **Step 4: Commit**

```bash
git add scripts/rebuild/com_utils.py scripts/rebuild/build.py
git commit -m "feat: add COM session helper and source-to-output copy step"
```

---

### Task 4: Rebuild the 5 dept sheets with canonical schema + data + comments

**Files:**
- Modify: `scripts/rebuild/build.py`

**Interfaces:**
- Consumes: `extract.read_raw_rows`, `extract.normalize_rows`, `mapping.SHEETS`, `mapping.CANONICAL_COLUMNS`.
- Produces: `rewrite_dept_sheet(wb, sheet_code: str, sheet_name: str, asset_rows: list[dict]) -> None`, called once per dept inside `build_all(output_path)`.

- [ ] **Step 1: Add the canonical-column write function**

```python
from mapping import SHEETS, CANONICAL_COLUMNS

FIELD_TO_COLUMN = {
    "asset_id": "Asset ID", "no": "Dept Ref No.", "asset_group": "Asset Group",
    "user": "User", "asset_type": "Asset Type", "asset_category": "Asset Category",
    "itd_tag": "ITD Tag No.", "serial": "Serial No.", "finance_tag": "Finance Asset Tag",
    "host": "Host Name", "location": "Location", "nickname": "Nickname",
    "topaz": "Topaz Installation", "ngemr": "NGEMR EUD Deployment",
    "deploy_date": "Deployment Date", "tdr_status": "TDR Status",
    "tdr_updated": "TDR Updated Date", "reprint": "Reprint Needed (Nov 2024)",
    "last_updated": "Last Updated", "remarks1": "Remarks", "remarks2": "TDR Remarks",
}
# Cost Centre and Status are formulas, added in Task 5 — skipped here.

def rewrite_dept_sheet(wb, sheet_name, asset_rows):
    ws = wb.Worksheets(sheet_name)
    ws.Cells.Clear()  # clears values/formats but not shapes/form controls
    # SaveAs copied the original hidden-column state (e.g. A1L5 J,M,O,R); the
    # canonical schema has no hidden columns (design decision 6), and Clear()
    # does not reset column visibility, so it must be done explicitly.
    ws.Columns.Hidden = False
    for col_idx, header in enumerate(CANONICAL_COLUMNS, start=1):
        ws.Cells(2, col_idx).Value = header
    for row_offset, row in enumerate(asset_rows):
        r = 3 + row_offset
        for field, header in FIELD_TO_COLUMN.items():
            col_idx = CANONICAL_COLUMNS.index(header) + 1
            ws.Cells(r, col_idx).Value = row.get(field)
    return len(asset_rows)
```

- [ ] **Step 2: Add comment reinjection (threaded text hardcoded per the plan's Verified Source Facts; EDFC plain comments read live from the pre-copy source before it's cleared)**

```python
THREADED_COMMENTS = [
    # (dept_code, source_row, field, author, text)
    ("A1L5", 25, "user", "Leow Jia Min Charmaine (TTSH)", "Where is this laptop located?"),
    ("EDFC", 3, "itd_tag", "Wee Geik Siau (TTSH)", "Old -903PC197563"),
    ("EDFC", 3, "serial", "Wee Geik Siau (TTSH)", "Old- PC17QP9S"),
    ("EDFC", 3, "finance_tag", "Wee Geik Siau (TTSH)", "Old-51031184-0/2019"),
    ("EDFC", 3, "host", "Wee Geik Siau (TTSH)", "Old - TTSAX2197563PNS"),
]

def add_comments(wb, asset_rows_by_dept):
    row_index = {}  # (dept_code, source_row) -> new row number
    for dept_code, rows in asset_rows_by_dept.items():
        for offset, row in enumerate(rows):
            row_index[(dept_code, row["source_row"])] = 3 + offset

    field_to_col = {"user": "D", "itd_tag": "G", "serial": "H", "finance_tag": "I", "host": "J"}
    sheet_by_code = {s["code"]: s["name"] for s in SHEETS}

    for dept_code, source_row, field, author, text in THREADED_COMMENTS:
        new_row = row_index.get((dept_code, source_row))
        if new_row is None:
            continue  # source row turned out to be junk; nothing to attach to
        ws = wb.Worksheets(sheet_by_code[dept_code])
        cell = ws.Range(f"{field_to_col[field]}{new_row}")
        cell.AddComment(f"{author}: {text}")
```

Legacy plain comments on `EDFC!G4`, `G5`, `D12`, `D13` (source rows 4, 5, 12, 13, fields `host`, `host`, `itd_tag`, `itd_tag`) must be read from the **pre-copy source file** (openpyxl can read plain comments) before `rewrite_dept_sheet` clears the sheet, then passed into `THREADED_COMMENTS`-style reinjection using the same `row_index` mapping. Read them in `extract.py`:

```python
def read_plain_comments(source_path):
    import openpyxl
    wb = openpyxl.load_workbook(source_path)
    ws = wb["EDFC (Guo wei)"]
    out = []
    for cell_ref, source_row, field in [("G4", 4, "host"), ("G5", 5, "host"),
                                         ("D12", 12, "itd_tag"), ("D13", 13, "itd_tag")]:
        c = ws[cell_ref]
        if c.comment:
            out.append(("EDFC", source_row, field, c.comment.author or "Unknown", c.comment.text.strip()))
    return out
```

- [ ] **Step 3: Wire up `build_all` and run**

```python
import sys
sys.path.insert(0, ".")
from extract import read_raw_rows, normalize_rows, read_plain_comments

def build_all(source_path, output_path):
    copy_source_to_output(source_path, output_path)
    raw_rows = read_raw_rows(source_path)
    asset_rows, junk_rows = normalize_rows(raw_rows)
    plain_comments = read_plain_comments(source_path)
    global THREADED_COMMENTS
    THREADED_COMMENTS = THREADED_COMMENTS + plain_comments

    asset_rows_by_dept = {}
    for row in asset_rows:
        asset_rows_by_dept.setdefault(row["dept_code"], []).append(row)

    with excel_session() as xl:
        wb = xl.Workbooks.Open(output_path)
        for sheet in SHEETS:
            rewrite_dept_sheet(wb, sheet["name"], asset_rows_by_dept.get(sheet["code"], []))
        add_comments(wb, asset_rows_by_dept)
        wb.Save()
        wb.Close(SaveChanges=True)
    return asset_rows, junk_rows

if __name__ == "__main__":
    SRC = "../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx"
    OUT = "../../July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx"
    asset_rows, junk_rows = build_all(SRC, OUT)
    print(f"OK: wrote {len(asset_rows)} asset rows across 5 dept sheets, {len(junk_rows)} junk rows set aside")
```

Run: `cd scripts/rebuild && python build.py`
Expected output: `OK: wrote 162 asset rows across 5 dept sheets, 9 junk rows set aside`

- [ ] **Step 4: Manually spot-check in Excel**

Open the `(Rebuild).xlsx` file in real Excel (not COM — actually open it). Confirm: no repair prompt on open; `A1 L5 (Peixin)` still shows its Group Box control near the bottom of the data; row 2 headers match `CANONICAL_COLUMNS` on all 5 dept sheets; `A1 L5 (Peixin)!D<row for source row 25>` shows the Charmaine comment.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebuild/build.py scripts/rebuild/extract.py
git commit -m "feat: rewrite dept sheets to canonical schema and reinject comments"
```

---

### Task 5: Excel Tables + Cost Centre / Status / Asset Category formulas

**Files:**
- Modify: `scripts/rebuild/build.py`

**Interfaces:**
- Consumes: dept sheets already populated by Task 4.
- Produces: `add_tables_and_formulas(wb, asset_rows_by_dept) -> None`, called from `build_all` after `add_comments`.

- [ ] **Step 1: Add the formula-writing + table-creation function**

```python
def add_tables_and_formulas(wb, asset_rows_by_dept):
    cat_col = CANONICAL_COLUMNS.index("Asset Category") + 1
    type_col = CANONICAL_COLUMNS.index("Asset Type") + 1
    serial_col = CANONICAL_COLUMNS.index("Serial No.") + 1
    cc_col = CANONICAL_COLUMNS.index("Cost Centre") + 1
    status_col = CANONICAL_COLUMNS.index("Status") + 1
    type_letter = _col_letter(type_col)
    serial_letter = _col_letter(serial_col)

    cat_formula = (
        '=IFERROR(IF(ISNUMBER(SEARCH("laptop",{t})),"Laptop",'
        'IF(ISNUMBER(SEARCH("tablet",{t})),"Tablet",'
        'IF(AND(ISNUMBER(SEARCH("monitor",{t})),ISNUMBER(SEARCH("cpu",{t}))),"Monitor + CPU",'
        'IF(OR(ISNUMBER(SEARCH("cpu",{t})),ISNUMBER(SEARCH("desktop",{t}))),"CPU",'
        'IF(ISNUMBER(SEARCH("printer",{t})),"Printer",'
        'IF(ISNUMBER(SEARCH("scanner",{t})),"Document Scanner",'
        'IF(OR(ISNUMBER(SEARCH("topaz",{t})),ISNUMBER(SEARCH("signature pad",{t}))),"Topaz Signature Pad",'
        'IF(ISNUMBER(SEARCH("nets",{t})),"Nets Machine","Other (Review)")))))))),"Other (Review)")'
    )
    cc_formula = '=IFERROR(VLOOKUP({s},\'Fixed Asset list\'!$H:$I,2,FALSE),"")'
    status_formula = (
        '=IF(COUNTIF(Condemned!$E:$E,{s})>0,"Condemned",'
        'IF(COUNTIF(\'Dirty Laptop\'!$B:$B,{s})>0,"Dirty",'
        '"Active"))'
    )

    for sheet in SHEETS:
        ws = wb.Worksheets(sheet["name"])
        n = len(asset_rows_by_dept.get(sheet["code"], []))
        if n == 0:
            continue
        for offset in range(n):
            r = 3 + offset
            t_ref, s_ref = f"{type_letter}{r}", f"{serial_letter}{r}"
            ws.Cells(r, cat_col).Formula = cat_formula.format(t=t_ref)
            ws.Cells(r, cc_col).Formula = cc_formula.format(s=s_ref)
            ws.Cells(r, status_col).Formula = status_formula.format(s=s_ref)

        ws.AutoFilterMode = False
        for lo in list(ws.ListObjects):
            lo.Delete()
        last_col_letter = _col_letter(len(CANONICAL_COLUMNS))
        table_range = ws.Range(f"A2:{last_col_letter}{2 + n}")
        lo = ws.ListObjects.Add(1, table_range, None, 1)  # xlSrcRange=1, xlYes=1
        lo.Name = f"tbl_{sheet['code']}"

def _col_letter(idx):
    letters = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters
```

- [ ] **Step 2: Convert lookup sheets to Tables (structured refs for the formulas above to stay robust if rows are added)**

```python
def convert_lookup_sheets_to_tables(wb):
    specs = [("Fixed Asset list", "tbl_FixedAssetList", 1, 140, 12),
             ("Condemned", "tbl_Condemned", 1, 7, 11),
             ("Dirty Laptop", "tbl_DirtyLaptop", 1, 18, 11)]
    for name, table_name, header_row, last_row, last_col in specs:
        ws = wb.Worksheets(name)
        ws.AutoFilterMode = False
        for lo in list(ws.ListObjects):
            lo.Delete()
        rng = ws.Range(ws.Cells(header_row, 1), ws.Cells(last_row, last_col))
        lo = ws.ListObjects.Add(1, rng, None, 1)
        lo.Name = table_name
```

- [ ] **Step 3: Wire into `build_all`, insert after `add_comments(wb, ...)`**

```python
        add_comments(wb, asset_rows_by_dept)
        convert_lookup_sheets_to_tables(wb)
        add_tables_and_formulas(wb, asset_rows_by_dept)
        wb.Save()
```

- [ ] **Step 4: Run and verify no formula errors**

Run: `cd scripts/rebuild && python build.py`

Then run a verification snippet:

```bash
python -c "
from com_utils import excel_session
from mapping import SHEETS, CANONICAL_COLUMNS
with excel_session() as xl:
    wb = xl.Workbooks.Open(r'C:\Users\lutfi\OneDrive\Desktop\TTSH Intern\Coding projects\AssetList\July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx')
    errors = 0
    for s in SHEETS:
        ws = wb.Worksheets(s['name'])
        used = ws.UsedRange
        for cell in used:
            if isinstance(cell.Value, str) and cell.Value.startswith('#'):
                errors += 1
                print(s['name'], cell.Address, cell.Value)
    print('Formula error count:', errors)
    wb.Close(SaveChanges=False)
"
```

Expected: `Formula error count: 0`. If nonzero, the printed `(sheet, address, value)` lines identify exactly which cells to fix (most likely cause: a `VLOOKUP`/`COUNTIF` referencing a table before it exists — reorder `convert_lookup_sheets_to_tables` ahead of `add_tables_and_formulas`, which Step 3 already does).

- [ ] **Step 5: Commit**

```bash
git add scripts/rebuild/build.py
git commit -m "feat: add Tables, Asset Category/Cost Centre/Status formulas"
```

---

### Task 6: Data validation dropdown on Asset Category

**Files:**
- Modify: `scripts/rebuild/build.py`

**Interfaces:**
- Consumes: dept sheets with Tables from Task 5.
- Produces: `add_category_validation(wb, asset_rows_by_dept) -> None`.

- [ ] **Step 1: Add the function**

```python
from mapping import ASSET_CATEGORIES

def add_category_validation(wb, asset_rows_by_dept):
    cat_col_letter = _col_letter(CANONICAL_COLUMNS.index("Asset Category") + 1)
    formula1 = ",".join(ASSET_CATEGORIES)
    for sheet in SHEETS:
        n = len(asset_rows_by_dept.get(sheet["code"], []))
        ws = wb.Worksheets(sheet["name"])
        headroom = 15
        rng = ws.Range(f"{cat_col_letter}3:{cat_col_letter}{3 + n + headroom}")
        rng.Validation.Delete()
        rng.Validation.Add(Type=3, AlertStyle=1, Formula1=formula1)  # xlValidateList, xlValidAlertStop
```

- [ ] **Step 2: Wire into `build_all`, after `add_tables_and_formulas(...)`**

```python
        add_tables_and_formulas(wb, asset_rows_by_dept)
        add_category_validation(wb, asset_rows_by_dept)
        wb.Save()
```

- [ ] **Step 3: Run and manually verify in Excel**

Run: `cd scripts/rebuild && python build.py`

Open the file in real Excel, click a blank `Asset Category` cell within the headroom rows below the last asset row on any dept sheet, confirm a dropdown arrow appears listing the 9 canonical categories.

- [ ] **Step 4: Commit**

```bash
git add scripts/rebuild/build.py
git commit -m "feat: add Asset Category dropdown validation"
```

---

### Task 7: Power Query MASTER sheet + protection

**Files:**
- Modify: `scripts/rebuild/build.py`

**Interfaces:**
- Consumes: `tbl_A1L5`, `tbl_ICHPSO`, `tbl_PSOINF`, `tbl_AONCID`, `tbl_EDFC` from Task 5.
- Produces: `add_master_query(wb) -> None`, `protect_master_sheet(wb) -> None`.

- [ ] **Step 1: Add the Power Query creation function**

```python
MASTER_QUERY_M = '''
let
    Source = Excel.CurrentWorkbook(),
    DeptTables = Table.SelectRows(Source, each Text.StartsWith([Name], "tbl_") and [Name] <> "tbl_FixedAssetList" and [Name] <> "tbl_Condemned" and [Name] <> "tbl_DirtyLaptop"),
    Combined = Table.Combine(DeptTables[Content])
in
    Combined
'''.strip()

def add_master_query(wb):
    for q in list(wb.Queries):
        if q.Name == "MASTER":
            q.Delete()
    wb.Queries.Add(Name="MASTER", Formula=MASTER_QUERY_M)

    if "MASTER" in [ws.Name for ws in wb.Worksheets]:
        wb.Worksheets("MASTER").Delete()
    ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
    ws.Name = "MASTER"

    conn = wb.Connections.Add2(
        Name="Query - MASTER",
        Description="",
        ConnectionString='OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location=MASTER;Extended Properties=""',
        CommandText="SELECT * FROM [MASTER]",
        lCmdtype=2,
        CreateModelConnection=False,
        ImportRelationships=False,
    )
    wb.Worksheets("MASTER").ListObjects.Add(
        SourceType=4,  # xlSrcExternal
        Source=conn,
        Destination=wb.Worksheets("MASTER").Range("A1"),
    ).Name = "tbl_MASTER"
```

**Note for the implementer running this task:** `Workbook.Connections.Add2` / `ListObjects.Add` wiring for a Power-Query-backed table is version-sensitive across Excel builds and is the one step in this plan most likely to need interactive trial-and-error against the installed Excel 16.0 rather than working first try. If `Connections.Add2` raises a COM error (wrong argument count/order is the most common symptom across Excel versions), fall back to the manual discovery in Step 2 below — it keeps everything else in the pipeline scripted and only requires one 10-second manual action, done once, to learn this machine's exact connection-string shape.

- [ ] **Step 2: Fallback — one-time manual discovery if Step 1's COM call fails**

Open the `(Rebuild).xlsx` file in real Excel, go to Data > Get Data > From Other Sources > Blank Query, paste `MASTER_QUERY_M`'s body into the Advanced Editor, name the query `MASTER`, choose "Close & Load To > Table > New Worksheet" targeting a sheet named `MASTER`. Save and close. Then run:

```bash
python -c "
from com_utils import excel_session
with excel_session() as xl:
    wb = xl.Workbooks.Open(r'C:\Users\lutfi\OneDrive\Desktop\TTSH Intern\Coding projects\AssetList\July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx')
    conn = wb.Connections(1)
    print(conn.OLEDBConnection.Connection)
    wb.Close(SaveChanges=False)
"
```

Copy the printed connection string literally into `add_master_query`'s `ConnectionString=` argument, replacing the guessed one from Step 1, so future re-runs of `build.py` from a fresh copy stay fully scripted.

- [ ] **Step 3: Set refresh-on-open and add protection**

```python
def finalize_master(wb):
    conn = wb.Connections("Query - MASTER")
    conn.OLEDBConnection.RefreshOnFileOpen = True

def protect_master_sheet(wb):
    ws = wb.Worksheets("MASTER")
    ws.Protect(
        Password="",
        AllowInsertingRows=True,
        AllowDeletingRows=True,
        AllowSorting=True,
        AllowFiltering=True,
    )
```

- [ ] **Step 4: Wire into `build_all`, after `add_category_validation(...)`**

```python
        add_category_validation(wb, asset_rows_by_dept)
        add_master_query(wb)
        finalize_master(wb)
        protect_master_sheet(wb)
        wb.Save()
```

- [ ] **Step 5: Verify refresh works end-to-end**

Open the file in real Excel. Data > Refresh All. Confirm `MASTER` shows 162 rows (163 with header) and 23 columns matching `CANONICAL_COLUMNS`. Add a throwaway row to any dept table (e.g. `tbl_A1L5`), Refresh All again, confirm it appears in `MASTER`; delete it, refresh again, confirm it disappears.

- [ ] **Step 6: Commit**

```bash
git add scripts/rebuild/build.py
git commit -m "feat: add MASTER Power Query sheet with refresh-on-open and protection"
```

---

### Task 8: Rebuild OVERVIEW, add Data Issues and Notes sheets

**Files:**
- Modify: `scripts/rebuild/build.py`
- Modify: `scripts/rebuild/extract.py`

**Interfaces:**
- Consumes: `asset_rows`, `junk_rows` from Task 2; `mapping.ASSET_CATEGORIES`.
- Produces: `find_duplicate_serials(asset_rows: list[dict]) -> list[tuple[str, list[str]]]` (serial → list of `"DEPT r<row>"` locations, only where count > 1), `rebuild_overview(wb, asset_rows_by_dept) -> None`, `add_data_issues_sheet(wb, asset_rows, dup_serials) -> None`, `add_notes_sheet(wb, junk_rows) -> None`.

- [ ] **Step 1: Add `find_duplicate_serials` to `extract.py`**

```python
def find_duplicate_serials(asset_rows):
    by_serial = {}
    for row in asset_rows:
        if not row["serial"]:
            continue
        by_serial.setdefault(row["serial"], []).append(f"{row['dept_code']} r{row['source_row']}")
    return [(serial, locs) for serial, locs in by_serial.items() if len(locs) > 1]
```

Add to the `__main__` block: `dups = find_duplicate_serials(asset_rows); print("Duplicate serials:", len(dups))` — expected `9` per the design doc (§3.3), though this run's exact whitespace-cleaned serials may surface the `XSXV00530`/`X5XV000530` typo pair too if you choose to fuzzy-match; this plan does exact-match only, so expect **9**, and note the typo pair separately by hand in Step 3 below.

- [ ] **Step 2: Add `rebuild_overview`**

```python
def rebuild_overview(wb, asset_rows_by_dept):
    from mapping import ASSET_CATEGORIES, SHEETS
    ws = wb.Worksheets("OVERVIEW")
    ws.Cells.Clear()
    ws.Cells(1, 1).Value = "Asset Category"
    for col_idx, sheet in enumerate(SHEETS, start=2):
        ws.Cells(1, col_idx).Value = sheet["code"]
    ws.Cells(1, len(SHEETS) + 2).Value = "Total"
    for row_idx, category in enumerate(ASSET_CATEGORIES, start=2):
        ws.Cells(row_idx, 1).Value = category
        for col_idx, sheet in enumerate(SHEETS, start=2):
            table_ref = f"tbl_{sheet['code']}[Asset Category]"
            col_letter = _col_letter(col_idx)
            ws.Cells(row_idx, col_idx).Formula = (
                f'=COUNTIF({table_ref},{col_letter}$1&"")'
                if False else
                f'=COUNTIF(tbl_{sheet["code"]}[Asset Category],$A{row_idx})'
            )
        total_col = len(SHEETS) + 2
        first_data_col, last_data_col = _col_letter(2), _col_letter(1 + len(SHEETS))
        ws.Cells(row_idx, total_col).Formula = f"=SUM({first_data_col}{row_idx}:{last_data_col}{row_idx})"
```

- [ ] **Step 3: Add `add_data_issues_sheet` and `add_notes_sheet`**

```python
def add_data_issues_sheet(wb, asset_rows, dup_serials):
    if "Data Issues" in [ws.Name for ws in wb.Worksheets]:
        wb.Worksheets("Data Issues").Delete()
    ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
    ws.Name = "Data Issues"
    ws.Cells(1, 1).Value = "Issue"
    ws.Cells(1, 2).Value = "Detail"
    r = 2
    for serial, locs in dup_serials:
        ws.Cells(r, 1).Value = "Duplicate serial number"
        ws.Cells(r, 2).Value = f"{serial}: {', '.join(locs)}"
        r += 1
    ws.Cells(r, 1).Value = "Possible typo'd serial (not exact-matched above)"
    ws.Cells(r, 2).Value = "XSXV00530 (AO+NCID r48) vs X5XV000530 (AO+NCID r22) — likely same scanner, dropped/swapped characters"
    r += 1
    ws.Cells(r, 1).Value = "Possible re-inventory, needs Fatris to confirm"
    ws.Cells(r, 2).Value = "AO+NCID rows 38-54 (2026-01..2026-17 block) may duplicate assets already listed in rows 20-37 (e.g. serial X5XV000534 appears in both)"
    r += 1
    ws.Cells(r, 1).Value = "Empty Cost Centre for entire sheet"
    ws.Cells(r, 2).Value = "PSO Office (Yati) — all rows, pre-existing in source"
    r += 1
    review_rows = [row for row in asset_rows if row["asset_category"] == "Other (Review)"]
    for row in review_rows:
        ws.Cells(r, 1).Value = "Asset Category needs manual review"
        ws.Cells(r, 2).Value = f"{row['asset_id']} ({row['dept_code']} r{row['source_row']}): asset_type={row['asset_type']!r}"
        r += 1

def add_notes_sheet(wb, junk_rows):
    if "Notes" in [ws.Name for ws in wb.Worksheets]:
        wb.Worksheets("Notes").Delete()
    ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
    ws.Name = "Notes"
    ws.Cells(1, 1).Value = "Dept"
    ws.Cells(1, 2).Value = "Source Row"
    ws.Cells(1, 3).Value = "User"
    ws.Cells(1, 4).Value = "Text"
    r = 2
    for row in junk_rows:
        text = row.get("user") or row.get("asset_type") or ""
        ws.Cells(r, 1).Value = row["dept_code"]
        ws.Cells(r, 2).Value = row["source_row"]
        ws.Cells(r, 3).Value = row.get("user")
        ws.Cells(r, 4).Value = text
        r += 1
```

- [ ] **Step 4: Wire into `build_all`, after `protect_master_sheet(wb)`**

```python
        protect_master_sheet(wb)
        dup_serials = find_duplicate_serials(asset_rows)
        rebuild_overview(wb, asset_rows_by_dept)
        add_data_issues_sheet(wb, asset_rows, dup_serials)
        add_notes_sheet(wb, junk_rows)
        wb.Save()
```

- [ ] **Step 5: Run and check row counts**

Run: `cd scripts/rebuild && python build.py`

Then verify: `Data Issues` sheet has 9 duplicate-serial rows + 1 typo note + 1 re-inventory note + 1 empty-cost-centre note + N "Other (Review)" rows; `Notes` sheet has 9 rows (matches `junk_rows` count from Task 2); `OVERVIEW` totals column sums to 162 across all 9 category rows.

- [ ] **Step 6: Commit**

```bash
git add scripts/rebuild/build.py scripts/rebuild/extract.py
git commit -m "feat: rebuild OVERVIEW as formulas, add Data Issues and Notes sheets"
```

---

### Task 9: Full verification suite

**Files:**
- Create: `scripts/rebuild/verify.py`

**Interfaces:**
- Consumes: the finished `(Rebuild).xlsx`, `extract.read_raw_rows`/`normalize_rows` for the source-of-truth comparison.
- Produces: a standalone script exiting non-zero on any failed assertion, printing a pass/fail line per check.

- [ ] **Step 1: Write `scripts/rebuild/verify.py`**

```python
import sys
from com_utils import excel_session
from mapping import SHEETS, CANONICAL_COLUMNS
from extract import read_raw_rows, normalize_rows

SRC = "../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx"
OUT = "../../July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx"

def check(label, condition):
    print(("PASS: " if condition else "FAIL: ") + label)
    return condition

def main():
    raw_rows = read_raw_rows(SRC)
    asset_rows, junk_rows = normalize_rows(raw_rows)
    ok = True

    with excel_session() as xl:
        wb = xl.Workbooks.Open(OUT)
        ok &= check("workbook opened without error", wb is not None)

        for sheet in SHEETS:
            ws = wb.Worksheets(sheet["name"])
            headers = [ws.Cells(2, c + 1).Value for c in range(len(CANONICAL_COLUMNS))]
            ok &= check(f"{sheet['name']} headers match canonical schema", headers == CANONICAL_COLUMNS)

        all_ids = []
        errors_found = 0
        for sheet in SHEETS:
            ws = wb.Worksheets(sheet["name"])
            used = ws.UsedRange
            for cell in used:
                if isinstance(cell.Value, str) and cell.Value.startswith("#"):
                    errors_found += 1
            id_col = CANONICAL_COLUMNS.index("Asset ID") + 1
            r = 3
            while ws.Cells(r, id_col).Value:
                all_ids.append(ws.Cells(r, id_col).Value)
                r += 1
        ok &= check("zero formula errors across dept sheets", errors_found == 0)
        ok &= check("Asset ID unique across all dept sheets", len(all_ids) == len(set(all_ids)))
        ok &= check(f"162 asset rows written (found {len(all_ids)})", len(all_ids) == 162)

        wb.RefreshAll()
        xl.CalculateUntilAsyncQueriesDone()
        master = wb.Worksheets("MASTER")
        master_rows = master.UsedRange.Rows.Count - 1
        ok &= check(f"MASTER has 162 rows after refresh (found {master_rows})", master_rows == 162)

        wb.Close(SaveChanges=False)

    if not ok:
        sys.exit(1)
    print("ALL CHECKS PASSED")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `cd scripts/rebuild && python verify.py`
Expected output: a `PASS:` line for every check, ending in `ALL CHECKS PASSED`. Any `FAIL:` line points at exactly which check regressed — fix the corresponding Task (schema mismatch → Task 4, formula errors → Task 5, MASTER row count → Task 7) and re-run `build.py` then `verify.py` again.

- [ ] **Step 3: Manual add/remove row test (not automatable from a closed-workbook script — do this live)**

Open `(Rebuild).xlsx` in real Excel. Add a test row to `tbl_A1L5` (any values). Data > Refresh All. Confirm the row appears in `MASTER`. Delete the row from `tbl_A1L5`. Refresh All again. Confirm it's gone from `MASTER`. Undo/remove your test row before closing.

- [ ] **Step 4: Commit**

```bash
git add scripts/rebuild/verify.py
git commit -m "feat: add end-to-end verification script for rebuilt workbook"
```

---

## Out of Scope (per the design doc)

- Resolving the 9 duplicate serials or the AO+NCID 2026-block question with the dept owners — tracked on `Data Issues`, not resolved here.
- Adding a `Sub-team` column to AO+NCID for full OVERVIEW automation — needs Fatris.
- Notifying staff about the layout change before rollout — organizational, not a build step.
