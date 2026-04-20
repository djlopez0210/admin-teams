
from sqlalchemy import create_engine, text
import random

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def auto_generate_groups(tournament_id, num_groups=4):
    with engine.begin() as conn:
        print(f"🎲 Iniciando sorteo para Torneo ID: {tournament_id}")
        
        # 1. Crear la Fase 1
        conn.execute(
            text("INSERT INTO tournament_phases (tournament_id, name, phase_order, phase_type) VALUES (:tid, 'Fase de Grupos', 1, 'ROUND_ROBIN')"),
            {"tid": tournament_id}
        )
        phase_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # 2. Obtener todos los equipos del torneo
        teams = conn.execute(
            text("SELECT id, name FROM teams WHERE tournament_id = :tid"), 
            {"tid": tournament_id}
        ).fetchall()
        
        team_list = list(teams)
        random.shuffle(team_list)
        
        if not team_list:
            print("❌ No hay equipos en este torneo.")
            return

        # 3. Crear grupos y asignar equipos
        teams_per_group = len(team_list) // num_groups
        group_names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        
        for i in range(num_groups):
            g_name = f"Grupo {group_names[i]}"
            conn.execute(
                text("INSERT INTO tournament_groups (phase_id, name) VALUES (:pid, :n)"),
                {"pid": phase_id, "n": g_name}
            )
            group_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
            
            # Asignar segmento de equipos
            start = i * teams_per_group
            # Asegurar que el último grupo tome los sobrantes si los hay
            end = (i + 1) * teams_per_group if i < num_groups - 1 else len(team_list)
            
            group_teams = team_list[start:end]
            for t_id, t_name in group_teams:
                conn.execute(
                    text("INSERT INTO group_teams (group_id, team_id) VALUES (:gid, :tid)"),
                    {"gid": group_id, "tid": t_id}
                )
                print(f"✅ {t_name} -> {g_name}")

        print(f"\n🚀 ¡Sorteo completado! Phase ID: {phase_id}")

if __name__ == "__main__":
    # Buscamos el ID del primer torneo (el que creamos con el mega-populate)
    res = engine.connect().execute(text("SELECT id FROM tournaments ORDER BY id DESC LIMIT 1")).scalar()
    if res:
        auto_generate_groups(res, num_groups=4)
    else:
        print("❌ No se encontró ningún torneo activo.")
