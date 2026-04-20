
from sqlalchemy import create_engine, text

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def fix():
    with engine.begin() as conn:
        print("🔍 Revisando estructura de 'users'...")
        try:
            # Intentar agregar tournament_id por si no existe
            conn.execute(text("ALTER TABLE users ADD COLUMN tournament_id INT"))
            print("✅ Columna tournament_id agregada.")
        except Exception as e:
            print(f"ℹ️ Columna tournament_id ya existía o error: {e}")

        try:
            # Intentar agregar role por si no existe
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20)"))
            print("✅ Columna role agregada.")
        except Exception as e:
            print(f"ℹ️ Columna role ya existía o error: {e}")

        print("🚀 ¡Estructura lista!")

if __name__ == "__main__":
    fix()
