import pymysql
import json

db = pymysql.connect(
    host="127.0.0.1", port=3306,
    user="team_user", password="team_password",
    database="football_team"
)
cursor = db.cursor()
cursor.execute("SELECT id, name, slug, registration_pin FROM teams;")
rows = cursor.fetchall()
for r in rows:
    print(r)
db.close()
