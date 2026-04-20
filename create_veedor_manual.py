
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def force_veedor():
    # DATOS DEL VEEDOR (Puedes cambiarlos aquí si quieres)
    username = "veedor1_test"
    password = "veedor123"
    tournament_id = 1 
    
    hashed_pw = generate_password_hash(password)
    
    with engine.begin() as conn:
        print(f"🚀 Intentando crear veedor '{username}'...")
        try:
            conn.execute(
                text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'veedor', :tid)"),
                {"u": username, "p": hashed_pw, "tid": tournament_id}
            )
            print("✅ ¡ÉXITO! Veedor creado en la base de datos.")
        except Exception as e:
            print(f"❌ ERROR FATAL: {e}")

if __name__ == "__main__":
    force_veedor()
