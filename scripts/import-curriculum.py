"""Refresh the public Shanghai Air Classroom catalogue in one SQLite transaction."""
import json
import sqlite3
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://www.sh.smartedu.cn/smile-index-service/api/"
SUBJECTS = {"语文": "chinese", "数学": "math", "英语": "english"}
GRADES = {f"{v}年级": i for i, v in enumerate("〇一二三四五六") if i >= 2}


def api(route, body):
    request = Request(API + route, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=35) as response:
                payload = json.load(response)
            if not payload["success"]:
                raise ValueError(payload["message"])
            return payload["data"]
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def nodes(tree, path=()):
    for item in tree:
        here = (*path, item["name"].strip())
        yield item["id"], here
        yield from nodes(item.get("children", []), here)


def collect():
    rows, topics, books = [], [], []
    for section in api("kzktnew/common/indexPanel", {})["chainList"]:
        for grade in section["children"]:
            if grade["name"] not in GRADES:
                continue
            for term in grade["children"]:
                for subject in term["children"]:
                    if subject["name"] not in SUBJECTS:
                        continue
                    for edition in subject["children"]:
                        key = (GRADES[grade["name"]], 1 if term["name"] == "第一学期" else 2,
                               SUBJECTS[subject["name"]], edition["name"])
                        ids = dict(sectionId=section["id"], gradeId=grade["id"], subjectId=subject["id"])
                        tree = api("kzktnew/point/tree", dict(**ids, semesterNo=term["id"], unitId=edition["id"]))
                        points = list(nodes(tree))
                        topics.extend((*key, node, " › ".join(path)) for node, path in points)
                        params = dict(**ids, volumeId=term["id"], editionId=edition["id"],
                                      isShowNotStudy=0, pointIdList=[], length=30)
                        entries = {}
                        page = 1
                        while True:
                            result = api("index/kzktNewResource/page", dict(**params, start=page))
                            for lesson in result["list"]:
                                entries[lesson["id"]] = lesson["resourceName"].strip()
                            if page * result["pageSize"] >= int(result["total"]):
                                break
                            page += 1
                        if len(entries) != int(result["total"]) or not points or not entries:
                            raise ValueError(f"Incomplete published catalogue: {key}, {len(entries)}, {result['total']}")
                        books.append((*key, len(points), len(entries)))
                        rows.extend((*key, resource, name, ids["subjectId"]) for resource, name in entries.items())
                        print(key, len(points), len(entries), flush=True)
    if len(set(b[:3] for b in books)) != 30:
        raise ValueError("Expected all 30 grade/semester/subject combinations")
    return books, topics, rows


def main():
    books, topics, rows = collect()
    with sqlite3.connect(ROOT / "data" / "shanghai.sqlite") as db:
        db.execute("BEGIN")
        for name in ["book", "topic", "lesson"]:
            db.execute(f"DROP TABLE IF EXISTS {name}")
        base = "grade INTEGER NOT NULL, term INTEGER NOT NULL, subject TEXT NOT NULL, edition TEXT NOT NULL"
        db.execute(f"CREATE TABLE book ({base}, nodes INTEGER, lessons INTEGER, PRIMARY KEY(grade,term,subject,edition))")
        db.execute(f"CREATE TABLE topic ({base}, id TEXT, path TEXT, PRIMARY KEY(grade,term,subject,edition,id))")
        db.execute(f"CREATE TABLE lesson ({base}, id TEXT, title TEXT, course TEXT, PRIMARY KEY(grade,term,subject,edition,id))")
        db.executemany("INSERT INTO book VALUES (?,?,?,?,?,?)", books)
        db.executemany("INSERT INTO topic VALUES (?,?,?,?,?,?)", topics)
        db.executemany("INSERT INTO lesson VALUES (?,?,?,?,?,?,?)", rows)


if __name__ == "__main__":
    main()
