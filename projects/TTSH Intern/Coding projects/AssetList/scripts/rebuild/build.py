import os
import sys
from com_utils import excel_session
from mapping import SHEETS, CANONICAL_COLUMNS, ASSET_CATEGORIES
from extract import read_raw_rows, normalize_rows, read_plain_comments, find_duplicate_serials


def copy_source_to_output(source_path, output_path):
    source_path = os.path.abspath(source_path)
    output_path = os.path.abspath(output_path)
    if os.path.exists(output_path):
        os.remove(output_path)
    with excel_session() as xl:
        wb = xl.Workbooks.Open(source_path, ReadOnly=True)
        wb.SaveAs(output_path, FileFormat=51)  # xlOpenXMLWorkbook (.xlsx)
        wb.Close(SaveChanges=False)


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
# Cost Centre and Status are formulas, added in Task 5 - skipped here.


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


THREADED_COMMENTS = [
    # (dept_code, source_row, field, author, text)
    ("A1L5", 25, "user", "Leow Jia Min Charmaine (TTSH)", "Where is this laptop located?"),
    ("EDFC", 3, "itd_tag", "Wee Geik Siau (TTSH)", "Old -903PC197563"),
    ("EDFC", 3, "serial", "Wee Geik Siau (TTSH)", "Old- PC17QP9S"),
    ("EDFC", 3, "finance_tag", "Wee Geik Siau (TTSH)", "Old-51031184-0/2019"),
    ("EDFC", 3, "host", "Wee Geik Siau (TTSH)", "Old - TTSAX2197563PNS"),
]


def add_comments(wb, asset_rows_by_dept, extra_comments):
    row_index = {}  # (dept_code, source_row) -> new row number
    for dept_code, rows in asset_rows_by_dept.items():
        for offset, row in enumerate(rows):
            row_index[(dept_code, row["source_row"])] = 3 + offset

    field_to_col = {"user": "D", "itd_tag": "G", "serial": "H", "finance_tag": "I", "host": "J"}
    sheet_by_code = {s["code"]: s["name"] for s in SHEETS}

    for dept_code, source_row, field, author, text in THREADED_COMMENTS + extra_comments:
        new_row = row_index.get((dept_code, source_row))
        if new_row is None:
            continue  # source row turned out to be junk; nothing to attach to
        ws = wb.Worksheets(sheet_by_code[dept_code])
        cell = ws.Range(f"{field_to_col[field]}{new_row}")
        cell.AddComment(f"{author}: {text}")


def _col_letter(idx):
    letters = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


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


def add_category_validation(wb, asset_rows_by_dept):
    cat_col_letter = _col_letter(CANONICAL_COLUMNS.index("Asset Category") + 1)
    formula1 = ",".join(ASSET_CATEGORIES)
    for sheet in SHEETS:
        n = len(asset_rows_by_dept.get(sheet["code"], []))
        ws = wb.Worksheets(sheet["name"])
        headroom = 15
        rng = ws.Range(f"{cat_col_letter}3:{cat_col_letter}{3 + n + headroom}")
        rng.Validation.Delete()
        # xlValidateList=3, xlValidAlertStop=1, Operator=xlBetween=1 (unused for list type
        # but win32com's late-bound Add() needs it passed explicitly or it errors).
        rng.Validation.Add(Type=3, AlertStyle=1, Operator=1, Formula1=formula1)


DEPT_TABLE_NAMES = ["tbl_A1L5", "tbl_ICHPSO", "tbl_PSOINF", "tbl_AONCID", "tbl_EDFC"]

MASTER_QUERY_M = (
    "let\n"
    "    Source = Excel.CurrentWorkbook(),\n"
    "    DeptTables = Table.SelectRows(Source, each List.Contains({"
    + ", ".join(f'"{n}"' for n in DEPT_TABLE_NAMES)
    + "}, [Name])),\n"
    "    Combined = Table.Combine(DeptTables[Content])\n"
    "in\n"
    "    Combined"
)


def add_master_query(wb):
    for q in list(wb.Queries):
        if q.Name == "MASTER":
            q.Delete()
    wb.Queries.Add(Name="MASTER", Formula=MASTER_QUERY_M)

    if "MASTER" in [ws.Name for ws in wb.Worksheets]:
        wb.Worksheets("MASTER").Delete()
    ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
    ws.Name = "MASTER"

    conn_string = ('OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;'
                   'Location=MASTER;Extended Properties=""')
    ws = wb.Worksheets("MASTER")
    conn = wb.Connections.Add2(
        "Query - MASTER", "", conn_string, "SELECT * FROM [MASTER]", 2, False, False,
    )
    lo = ws.ListObjects.Add(
        0,  # xlSrcExternal (NOT 4 - that's xlSrcModel, the Power Pivot data model)
        conn,
        None,
        1,  # xlYes
        ws.Range("A1"),
    )
    lo.Name = "tbl_MASTER"
    lo.QueryTable.Refresh(False)
    return lo


def finalize_master(lo):
    lo.QueryTable.WorkbookConnection.OLEDBConnection.RefreshOnFileOpen = True


def protect_master_sheet(wb):
    ws = wb.Worksheets("MASTER")
    ws.Protect(
        Password="",
        AllowInsertingRows=True,
        AllowDeletingRows=True,
        AllowSorting=True,
        AllowFiltering=True,
    )


def rebuild_overview(wb, asset_rows_by_dept):
    from mapping import ASSET_CATEGORIES

    ws = wb.Worksheets("OVERVIEW")
    ws.Cells.Clear()
    ws.Cells(1, 1).Value = "Asset Category"
    for col_idx, sheet in enumerate(SHEETS, start=2):
        ws.Cells(1, col_idx).Value = sheet["code"]
    total_col = len(SHEETS) + 2
    ws.Cells(1, total_col).Value = "Total"
    first_data_col, last_data_col = _col_letter(2), _col_letter(1 + len(SHEETS))
    for row_idx, category in enumerate(ASSET_CATEGORIES, start=2):
        ws.Cells(row_idx, 1).Value = category
        for col_idx, sheet in enumerate(SHEETS, start=2):
            ws.Cells(row_idx, col_idx).Formula = (
                f'=COUNTIF(tbl_{sheet["code"]}[Asset Category],$A{row_idx})'
            )
        ws.Cells(row_idx, total_col).Formula = f"=SUM({first_data_col}{row_idx}:{last_data_col}{row_idx})"


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
    ws.Cells(r, 2).Value = ("XSXV00530 (AO+NCID r48) vs X5XV000530 (AO+NCID r22) - likely same "
                             "scanner, dropped/swapped characters")
    r += 1
    ws.Cells(r, 1).Value = "Possible re-inventory, needs Fatris to confirm"
    ws.Cells(r, 2).Value = ("AO+NCID rows 38-54 (2026-01..2026-17 block) may duplicate assets "
                             "already listed in rows 20-37 (e.g. serial X5XV000534 appears in both)")
    r += 1
    ws.Cells(r, 1).Value = "Empty Cost Centre for entire sheet"
    ws.Cells(r, 2).Value = "PSO Office (Yati) - all rows, pre-existing in source"
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


def build_all(source_path, output_path):
    output_path = os.path.abspath(output_path)
    copy_source_to_output(source_path, output_path)
    raw_rows = read_raw_rows(source_path)
    asset_rows, junk_rows = normalize_rows(raw_rows)
    plain_comments = read_plain_comments(source_path)

    asset_rows_by_dept = {}
    for row in asset_rows:
        asset_rows_by_dept.setdefault(row["dept_code"], []).append(row)

    with excel_session() as xl:
        wb = xl.Workbooks.Open(output_path)
        for sheet in SHEETS:
            rewrite_dept_sheet(wb, sheet["name"], asset_rows_by_dept.get(sheet["code"], []))
        add_comments(wb, asset_rows_by_dept, plain_comments)
        convert_lookup_sheets_to_tables(wb)
        add_tables_and_formulas(wb, asset_rows_by_dept)
        add_category_validation(wb, asset_rows_by_dept)
        lo = add_master_query(wb)
        finalize_master(lo)
        protect_master_sheet(wb)
        dup_serials = find_duplicate_serials(asset_rows)
        rebuild_overview(wb, asset_rows_by_dept)
        add_data_issues_sheet(wb, asset_rows, dup_serials)
        add_notes_sheet(wb, junk_rows)
        wb.Save()
        wb.Close(SaveChanges=True)
    return asset_rows, junk_rows


if __name__ == "__main__":
    SRC = "../../July 2026 FC IT Assets Management list (Cost centre checked).xlsx"
    OUT = "../../July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx"
    asset_rows, junk_rows = build_all(SRC, OUT)
    print(f"OK: wrote {len(asset_rows)} asset rows across 5 dept sheets, {len(junk_rows)} junk rows set aside")
