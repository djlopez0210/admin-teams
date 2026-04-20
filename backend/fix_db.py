from sqlalchemy import create_engine, text

# Usamos la misma URI que en app.py
DATABASE_URL = "mysql+pymysql://team_user:team_password@localhost:3307/football_team"
engine = create_engine(DATABASE_URL)

def run_migration():
    queries = [
        "ALTER TABLE matches ADD COLUMN match_day INT DEFAULT 1 AFTER match_date;",
    ]
    
    with engine.connect() as conn:
        for q in queries:
            try:
                conn.execute(text(q))
                conn.commit()
                print(f"Éxito: {q}")
            except Exception as e:
                print(f"Saltando (posiblemente ya existe): {e}")

if __name__ == "__main__":
    run_migration()
