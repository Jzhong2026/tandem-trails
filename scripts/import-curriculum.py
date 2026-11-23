"""Refresh the public Shanghai Air Classroom catalogue in one SQLite transaction."""
from concurrent.futures import ThreadPoolExecutor
import json
import sqlite3
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://www.sh.smartedu.cn/smile-index-service/api/"
SUBJECTS = {"语文": "chinese", "数学": "math", "英语": "english"}
GRADES = {f"{v}年级": i for i, v in enumerate("〇一二三四五六七八九") if i >= 2}


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


def editions():
    terms = {"第一学期": 1, "第二学期": 2, "跨学期": 0}
    for section in api("kzktnew/common/indexPanel", {})["chainList"]:
        if section["name"] not in ("小学", "初中"):
            continue
        for grade_node in section["children"]:
            grade = GRADES.get(grade_node["name"])
            if grade is None:
                continue
            for term in grade_node["children"]:
                for subject in term["children"]:
                    label = subject["name"]
                    if grade < 6 and label not in SUBJECTS:
                        continue
                    for edition in subject["children"]:
                        key = (grade, terms[term["name"]], SUBJECTS.get(label, label), edition["name"])
                        ids = (section["id"], grade_node["id"], subject["id"], term["id"], edition["id"])
                        yield key, ids


def collect_edition(entry):
    key, (section, grade, subject, term, edition) = entry
    ids = dict(sectionId=section, gradeId=grade, subjectId=subject)
    tree = api("kzktnew/point/tree", dict(**ids, semesterNo=term, unitId=edition))
    topics = [[*key, node, " › ".join(path)] for node, path in nodes(tree)]
    params = dict(**ids, volumeId=term, editionId=edition, isShowNotStudy=0, pointIdList=[], length=30)
    lessons = {}
    page = 1
    while True:
        result = api("index/kzktNewResource/page", dict(**params, start=page))
        total = int(result["total"])
        for row in result["list"]:
            lessons[row["id"]] = row["resourceName"].strip()
        if page * int(result["pageSize"]) >= total:
            break
        page += 1
    if len(lessons) != total:
        raise ValueError(f"Incomplete course {key}: expected {total}, received {len(lessons)}")
    return [*key, len(topics), len(lessons)], topics, [[*key, i, name, subject] for i,name in lessons.items()]


def collect():
    books, topics, rows = [], [], []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for book, branch, lessons in pool.map(collect_edition, editions()):
            books.append(book)
            topics.extend(branch)
            rows.extend(lessons)
            print(book, flush=True)
    expected = {(g, t, s) for g in range(2, 10) for t in (1, 2) for s in SUBJECTS.values()}
    if not expected.issubset({tuple(b[:3]) for b in books if b[-1] > 0}):
        raise ValueError("Missing grade, term or core subject")
    return books, topics, rows


def install(books, topics, rows):
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
    install(*collect())
