
from sqlalchemy import create_engine, text
import random

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def populate_all():
    with engine.begin() as conn:
        print("🔍 Buscando equipos sin jugadores...")
        # Obtener todos los equipos
        teams = conn.execute(text("SELECT id, name FROM teams")).fetchall()
        
        for team_id, team_name in teams:
            # Check if has players
            count = conn.execute(text("SELECT COUNT(*) FROM players WHERE team_id = :tid"), {"tid": team_id}).scalar()
            
            if count == 0:
                print(f"⚽ Poblando equipo: {team_name} (ID {team_id})...")
                for i in range(1, 12):
                    full_name = f"Jugador {i} - {team_name}"
                    doc = f"DOC-{team_id}-{i}-{random.randint(1000, 9999)}"
                    pos = random.choice(["Portero", "Defensa", "Mediocampista", "Delantero"])
                    
                    conn.execute(
                        text("INSERT INTO players (team_id, full_name, document_number, uniform_number, position, payment_status) VALUES (:tid, :fn, :dn, :un, :pos, 'PAID')"),
                        {"tid": team_id, "fn": full_name, "dn": doc, "un": i, "pos": pos}
                    )
                print(f"✅ Equipo {team_id} completo.")
        
        print("\n🚀 ¡BASE DE DATOS TOTALMENTE POBLADA!")

if __name__ == "__main__":
    populate_all()
