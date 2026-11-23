"""Refresh offline lessons from a local Course Studio content directory."""
from study_cards import replace_cards
import argparse
import json
import sqlite3
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

DB = Path(__file__).resolve().parents[1] / "data" / "shanghai.sqlite"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("content", type=Path)
    folder = parser.parse_args().content
    rows = []
    for subject in ("chinese", "math", "english"):
        for card in json.loads((folder / (subject + ".json")).read_text(encoding="utf-8-sig")):
            options = card["choices"]
            if len(set(options)) != len(options) or not 2 <= len(options) <= 4 or not 0 <= card["answer"] < len(options):
                raise ValueError(card["id"])
            url = urlsplit(card.get("officialUrl") or "")
            resource = (parse_qs(url.query).get("resource") or [None])[0] if url.hostname == "basic.sh.smartedu.cn" else None
            rows.append((card["id"], card["grade"], card["term"], subject, card["unit"],
                         card["title"], json.dumps(card["scenes"], ensure_ascii=False), card["question"],
                         json.dumps(options, ensure_ascii=False), card["answer"], card["explanation"], resource))
    expected = {(g, t, s) for g in range(2, 7) for t in (1, 2) for s in ("chinese", "math", "english")}
    actual = {(row[1], row[2], row[3]) for row in rows}
    if actual != expected:
        raise ValueError(f"Course Studio snapshot incomplete: missing {sorted(expected - actual)}")
    with sqlite3.connect(DB) as db:
        db.execute("BEGIN")
        replace_cards(db,2,6,rows)
    print(f"{len(rows)} offline lessons imported")


if __name__ == "__main__":
    main()
