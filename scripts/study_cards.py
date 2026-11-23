def replace_cards(db, first_grade, last_grade, rows):
    db.execute("""CREATE TABLE IF NOT EXISTS study_card(id TEXT PRIMARY KEY, grade INTEGER, term INTEGER,
              subject TEXT, unit TEXT, title TEXT, scenes TEXT, prompt TEXT, options TEXT,
              answer INTEGER, explain TEXT, resource TEXT)""")
    db.execute("DELETE FROM study_card WHERE grade BETWEEN ? AND ? AND subject IN ('chinese','math','english')", (first_grade, last_grade))
    db.executemany("INSERT INTO study_card VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    db.execute("CREATE INDEX IF NOT EXISTS study_card_book ON study_card(grade,term,subject)")
