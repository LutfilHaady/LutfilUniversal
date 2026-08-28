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
