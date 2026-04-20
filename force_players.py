
import os
from sqlalchemy import create_engine, text

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def check():
    with engine.begin() as conn:
        print("📊 ESTADO ACTUAL DE LA BASE DE DATOS:")
        
        # Contar equipos
        teams_count = conn.execute(text("SELECT COUNT(*) FROM teams")).scalar()
        print(f"🔹 Equipos: {teams_count}")
        
        # Contar jugadores
        players_count = conn.execute(text("SELECT COUNT(*) FROM players")).scalar()
        print(f"🔹 Jugadores: {players_count}")
        
        if players_count == 0:
            print("\n🚨 ¡ALERTA! No hay jugadores. Procediendo a recrearlos...")
        else:
            print("\n♻️ Re-poblando para asegurar datos frescos...")
            conn.execute(text("DELETE FROM players")) # Limpiamos para evitar duplicados

        # Re-poblar con IDs únicos garantizados
        res = conn.execute(text("SELECT id, name FROM teams"))
        teams = res.fetchall()
        
        for t in teams:
            tid, tname = t[0], t[1]
            print(f"✍️ Insertando 11 jugadores en: {tname}")
            for i in range(1, 12):
                # Usamos un documento que incluya el ID del equipo y el índice para evitar colisiones
                doc = f"DOC-{tid}-{i}-{os.urandom(2).hex()}"
                conn.execute(text("""
                    INSERT INTO players (team_id, full_name, document_number, uniform_number, position, payment_status) 
                    VALUES (:tid, :name, :doc, :num, 'Jugador', 'PAID')
                """), {
                    "tid": tid, 
                    "name": f"Jugador {i} de {tname}", 
                    "doc": doc, 
                    "num": i
                })
        
        print("\n✅ PROCESO TERMINADO. Ahora sí hay jugadores.")

if __name__ == "__main__":
    check()
