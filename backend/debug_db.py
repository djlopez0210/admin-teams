import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@db/football_team')
engine = create_engine(DATABASE_URL)

def debug():
    with engine.connect() as conn:
        print("--- TABLES ---")
        res = conn.execute(text("SHOW TABLES"))
        for row in res:
            table = row[0]
            print(f"\nTable: {table}")
            res_cols = conn.execute(text(f"DESCRIBE {table}"))
            for col in res_cols:
                print(f"  Column: {col[0]} ({col[1]})")
        
        print("\n--- USERS ---")
        try:
            res_users = conn.execute(text("SELECT username, role FROM users"))
            for row in res_users:
                print(f" User: {row[0]}, Role: {row[1]}")
        except Exception as e:
            print(f" Error querying users: {e}")

if __name__ == "__main__":
    debug()
