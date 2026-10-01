"""Convert reports/Hard Coded Data/Fixtures/Convoquer_Local_Colleges_Participants.pdf
into CSVs for the organiser "Import participants" page.

The PDF holds one table per college (MIET, Central University, ASCOMS, GMC Jammu,
SKUAST, IIM Jammu, GCET, SMVDU) with differing columns: name, Aadhaar number,
and an institute ID. Aadhaar numbers are personal data the website does not
need, so they are recognised and DROPPED — they never reach the CSV.

Outputs (same folder):
  Local Colleges - Participant Import.csv    rows that have an institute ID (importable)
  Local Colleges - ID Conflicts.csv          one ID given to two different people (review)
  Local Colleges - Missing IDs.csv           people the PDF lists without an ID. The import
                                             requires a rollNumber on every row, so these
                                             cannot be uploaded until an ID is supplied.

Requires: pip install pdfplumber.   Run: python scripts/convert-local-contingent.py
"""
import csv
import re
from difflib import SequenceMatcher
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "reports" / "Hard Coded Data" / "Fixtures"
SRC = DIR / "Convoquer_Local_Colleges_Participants.pdf"

# Heading text on the PDF page -> Institute.name as the import expects it.
COLLEGES = {
    "MIET": "MIET",
    "Central University of Jammu": "Central University of Jammu",
    "ASCOMS": "ASCOMS",
    "GMC Jammu": "GMC Jammu",
    "SHER-E-KASHMIR": "Sher-e-Kashmir University of Agricultural Sciences and Technology",
    "IIM JAMMU": "IIM Jammu",
    "GCET Jammu": "GCET",
    "SMVDU": "SMVDU",
}
HEADER_WORDS = ("name", "aadhar", "aadhaar", "s. no", "student", "enrollment", "entry no", "institute")


def clean(cell):
    return re.sub(r"\s+", " ", (cell or "").replace("\n", " ")).strip()


def is_aadhaar(cell):
    digits = re.sub(r"[\s-]", "", cell)
    return digits.isdigit() and len(digits) == 12


def is_header(cells):
    joined = " ".join(c.lower() for c in cells)
    return any(w in joined for w in HEADER_WORDS) and not re.search(r"\d{4}", joined)


def college_of(page_text, current):
    lines = [l.strip() for l in page_text.split("\n") if l.strip()]
    if not lines:
        return current
    first = lines[0]
    if first.startswith("Name Of Instititute"):
        first = first[len("Name Of Instititute"):].strip()
        first = re.sub(r"\s+AADHAR NUMBER$", "", first, flags=re.I)
    for key, canonical in COLLEGES.items():
        if first.lower().startswith(key.lower()):
            return canonical
    return current


def main():
    importable, missing = [], []
    college = None
    with pdfplumber.open(SRC) as pdf:
        for page in pdf.pages:
            college = college_of(page.extract_text() or "", college)
            tables = page.extract_tables()
            if not tables:
                continue
            table = max(tables, key=len)  # the participant table, not the 3-row header block
            for raw in table:
                cells = [clean(c) for c in raw]
                if not any(cells) or is_header(cells):
                    continue
                if re.fullmatch(r"\d{1,3}", cells[0]):  # leading S. No.
                    cells = cells[1:]
                name, rest = cells[0], cells[1:]
                if not name or not re.search(r"[A-Za-z]", name) or name.lower() in ("name", "student name"):
                    continue
                role = "PLAYER"
                if re.search(r"\(\s*c\s*\)\s*$", name, re.I):
                    role = "CAPTAIN"
                    name = re.sub(r"\(\s*c\s*\)\s*$", "", name, flags=re.I).strip()
                # The ID is the first non-empty cell that is not an Aadhaar number.
                roll = next((c for c in rest if c and not is_aadhaar(c)), "")
                # "S-No 96" / "PG Medicine" (GMC) are list positions or departments, not IDs.
                if re.match(r"\s*(s\W{0,2}no\b|pg medicine)", roll, re.I):
                    roll = ""
                row = {
                    "name": name, "college": college, "rollNumber": roll, "sport": "", "team": "",
                    "gender": "", "contactNumber": "", "role": role, "category": "ATHLETE",
                }
                (importable if roll else missing).append(row)

    # The import rejects duplicate (college, roll number) rows. For a repeated ID:
    #   - the same person (identical or spelling-variant name): keep one, the fuller name;
    #   - a different person: a source-data conflict — neither is imported, both go to
    #     the review file so a human decides whose ID it is.
    seen, unique, merged, conflicts = {}, [], [], []
    for r in importable:
        key = (r["college"].lower(), r["rollNumber"].lower())
        first = seen.get(key)
        if first is None:
            seen[key] = r
            unique.append(r)
        elif same_person(first["name"], r["name"]):
            if len(r["name"]) > len(first["name"]):
                first["name"] = r["name"]
            merged.append((r, first))
        else:
            conflicts.append((first, r))
    clashing = {id(a) for a, _ in conflicts}
    unique = [r for r in unique if id(r) not in clashing]

    fields = ["name", "college", "rollNumber", "sport", "team", "gender", "contactNumber", "role", "category"]
    for fname, rows in (("Local Colleges - Participant Import.csv", unique), ("Local Colleges - Missing IDs.csv", missing)):
        with open(DIR / fname, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
    with open(DIR / "Local Colleges - ID Conflicts.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["college", "rollNumber", "name_1", "name_2"])
        for a, b in conflicts:
            w.writerow([a["college"], a["rollNumber"], a["name"], b["name"]])

    by = {}
    for r in unique:
        by[r["college"]] = by.get(r["college"], 0) + 1
    print("Importable rows:", len(unique))
    for k, v in by.items():
        print(f"  {k}: {v}")
    print("Missing an ID (not importable):", len(missing))
    print("Same person listed twice (merged):", len(merged))
    print("Same ID, DIFFERENT people (review, not imported):", len(conflicts))
    for a, b in conflicts:
        print(f"  - {a['college']} | {a['rollNumber']}: '{a['name']}' vs '{b['name']}'")


def same_person(a, b):
    """True for identical names and obvious variants (Kaur/Kour, 'Janhvi' vs 'Janhvi Nishad')."""
    na = re.sub(r"[^a-z ]", "", a.lower()).split()
    nb = re.sub(r"[^a-z ]", "", b.lower()).split()
    if not na or not nb:
        return False
    if na == nb or SequenceMatcher(None, " ".join(na), " ".join(nb)).ratio() >= 0.8:
        return True
    short, long_ = (na, nb) if len(na) <= len(nb) else (nb, na)

    def alike(x, y):  # same word, a prefix of it, or a one-letter typo
        return x.startswith(y) or y.startswith(x) or SequenceMatcher(None, x, y).ratio() >= 0.75

    return all(alike(long_[i], short[i]) for i in range(len(short)))


if __name__ == "__main__":
    main()
