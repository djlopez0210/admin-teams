
import os
import random
from sqlalchemy import create_engine, text

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def populate():
    with engine.begin() as conn:
        print("🔍 Buscando equipos...")
        res = conn.execute(text("SELECT id, name FROM teams"))
        teams = res.fetchall()
        
        nombres = ["Juan", "Pedro", "Luis", "Carlos", "Andres", "Diego", "Mateo", "Santiago"]
        apellidos = ["Perez", "Rodriguez", "Gomez", "Lopez", "Martinez", "Garcia", "Hernandez"]
        posiciones = ["Portero", "Defensa", "Mediocampista", "Delantero"]

        for t in teams:
            team_id = t[0]
            team_name = t[1]
            print(f"⚽ Poblando equipo: {team_name} (ID: {team_id})")
            
            for i in range(1, 12):
                fname = f"{random.choice(nombres)} {random.choice(apellidos)}"
                doc = f"{team_id}{i}{random.randint(100, 999)}"
                # Insertamos jugadores de prueba
                try:
                    conn.execute(text("""
                        INSERT INTO players (team_id, full_name, document_number, uniform_number, position, payment_status) 
                        VALUES (:tid, :name, :doc, :num, :pos, 'PAID')
                    """), {
                        "tid": team_id, 
                        "name": f"{fname} - PRUEBA", 
                        "doc": doc, 
                        "num": i, 
                        "pos": random.choice(posiciones)
                    })
                except Exception as e:
                    print(f"   ⚠️ Saltado jugador {i} por duplicidad de documento")
        
        print("\n✅ ¡POBLACIÓN COMPLETADA! Todos los equipos tienen ahora jugadores de prueba.")

if __name__ == "__main__":
    populate()
