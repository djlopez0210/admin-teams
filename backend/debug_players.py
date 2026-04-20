
from sqlalchemy import create_engine, text

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def check_players():
    print("🔍 Consultando jugadores del Equipo 1...")
    try:
        with engine.connect() as conn:
            # Primero ver si la tabla existe y qué columnas tiene
            print("📋 Estructura de la tabla 'players':")
            columns = conn.execute(text("SHOW COLUMNS FROM players"))
            for col in columns:
                print(f"  - {col[0]} ({col[1]})")
            
            # Intentar la consulta real
            print("\n🏃 Ejecutando SELECT...")
            result = conn.execute(text("SELECT * FROM players WHERE team_id = 1")).fetchall()
            print(f"✅ ÉXITO: Se encontraron {len(result)} jugadores.")
            for row in result[:2]: # Mostrar solo 2 para no saturar
                print(f"  Row: {row}")
                
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    check_players()
