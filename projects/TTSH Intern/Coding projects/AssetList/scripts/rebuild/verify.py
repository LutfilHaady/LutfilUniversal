import os
import sys
from com_utils import excel_session
from mapping import SHEETS, CANONICAL_COLUMNS
from extract import read_raw_rows, normalize_rows

SRC = "../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx"
OUT = os.path.abspath("../../July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx")


def check(label, condition):
    print(("PASS: " if condition else "FAIL: ") + label)
    return condition


def force_refresh_master(wb):
    master = wb.Worksheets("MASTER")
    master.Unprotect()
    lo = master.ListObjects("tbl_MASTER")
    lo.QueryTable.Refresh(False)
    master.Protect(
        Password="",
        AllowInsertingRows=True,
        AllowDeletingRows=True,
        AllowSorting=True,
        AllowFiltering=True,
    )
    return lo.DataBodyRange.Rows.Count


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
                    print("  formula error:", sheet["name"], cell.Address, cell.Value)
            id_col = CANONICAL_COLUMNS.index("Asset ID") + 1
            r = 3
            while ws.Cells(r, id_col).Value:
                all_ids.append(ws.Cells(r, id_col).Value)
                r += 1
        ok &= check("zero formula errors across dept sheets", errors_found == 0)
        ok &= check("Asset ID unique across all dept sheets", len(all_ids) == len(set(all_ids)))
        ok &= check(f"162 asset rows written (found {len(all_ids)})", len(all_ids) == 162)

        master_rows = force_refresh_master(wb)
        ok &= check(f"MASTER has 162 rows after forced refresh (found {master_rows})", master_rows == 162)

        ov = wb.Worksheets("OVERVIEW")
        total = sum(ov.Cells(r, 7).Value or 0 for r in range(2, 11))
        ok &= check(f"OVERVIEW total sums to 162 (found {total})", total == 162)

        di = wb.Worksheets("Data Issues")
        di_rows = di.UsedRange.Rows.Count - 1
        ok &= check(f"Data Issues has 39 rows (found {di_rows})", di_rows == 39)

        notes = wb.Worksheets("Notes")
        notes_rows = notes.UsedRange.Rows.Count - 1
        ok &= check(f"Notes has 9 rows (found {notes_rows})", notes_rows == 9)

        a1l5 = wb.Worksheets("A1 L5 (Peixin)")
        ok &= check("A1 L5 Group Box control preserved", a1l5.Shapes.Count >= 1)

        wb.Close(SaveChanges=False)

    if not ok:
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
