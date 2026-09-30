"""Convert reports/Hard Coded Data/Fixtures/Fixtures.pdf into Fixtures.csv.

The PDF is a machine-generated spreadsheet export, so `pdftotext -layout` keeps
its columns separated by runs of 2+ spaces. The CSV is the committed input of
server/prisma/import-fixtures.ts (so the deployment VM does not need poppler).

Run: python scripts/convert-fixtures.py
"""
import csv
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "reports" / "Hard Coded Data" / "Fixtures"
HEADER = ["sport", "date", "time", "match", "category", "venue"]

text = subprocess.run(
    ["pdftotext", "-layout", str(DIR / "Fixtures.pdf"), "-"],
    check=True, capture_output=True, text=True, encoding="utf-8",
).stdout

rows = []
for line in text.splitlines():
    line = line.strip()
    if not line or line.startswith("Sport  "):
        continue
    cells = re.split(r"\s{2,}", line)
    if len(cells) != len(HEADER):
        raise SystemExit(f"Unexpected column count {len(cells)}: {line!r}")
    rows.append([c.strip() for c in cells])

with open(DIR / "Fixtures.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    w.writerows(rows)
print(f"Wrote {len(rows)} fixtures to {DIR / 'Fixtures.csv'}")
