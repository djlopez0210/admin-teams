import os
from sqlalchemy import text, create_engine
from datetime import datetime, timedelta

# Database Configuration from environment or defaults
DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@db/football_team?charset=utf8mb4')

def seed_demo():
    print("Iniciando carga de datos Demo para el Motor de Torneos...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # 1. Crear Torneo
            t_slug = "copa-demo-2026"
            conn.execute(text("INSERT IGNORE INTO tournaments (name, slug, win_points, draw_points, format_type) VALUES (:name, :slug, :w, :d, :f)"), 
                        {"name": "Copa Demo 2026", "slug": t_slug, "w": 3, "d": 1, "f": "liga"})
            conn.commit()
            
            result = conn.execute(text("SELECT id FROM tournaments WHERE slug = :slug"), {"slug": t_slug}).fetchone()
            tournament_id = result[0]
            
            # 2. Crear Equipos Demo
            teams_data = [
                ("Real Florida FC", "real-florida", "Felipe Guerrero", "#00f2fe"),
                ("Titanes del Norte", "titanes", "Carlos Ruiz", "#facc15"),
                ("Fénix Dorado", "fenix", "Andrés Montoya", "#fb923c"),
                ("Rayo Valcano", "rayo", "Luis Perea", "#ef4444")
            ]
            
            team_ids = []
            for name, slug, delegate, color in teams_data:
                # Insert team linked to tournament
                conn.execute(text("""
                    INSERT IGNORE INTO teams (name, slug, tournament_id, delegate_name) 
                    VALUES (:name, :slug, :tid, :delegate)
                """), {"name": name, "slug": slug, "tid": tournament_id, "delegate": delegate})
                conn.commit()
                
                tid = conn.execute(text("SELECT id FROM teams WHERE slug = :slug"), {"slug": slug}).fetchone()[0]
                team_ids.append(tid)
                
                # Initialize settings for team colors if not exists
                conn.execute(text("INSERT IGNORE INTO settings (team_id, team_name, primary_color) VALUES (:tid, :name, :color)"),
                            {"tid": tid, "name": name, "color": color})
                conn.commit()

                # Initialize positions for each demo team
                default_positions = [
                    'Portero', 'Defensa Central', 'Lateral Izquierdo', 'Lateral Derecho',
                    'Mediocampista Defensivo', 'Mediocampista Central', 'Mediocampista Ofensivo',
                    'Extremo Izquierdo', 'Extremo Derecho', 'Delantero', 'Delantero Móvil'
                ]
                for pos_name in default_positions:
                    conn.execute(text("INSERT IGNORE INTO positions (team_id, name) VALUES (:tid, :name)"),
                                {"tid": tid, "name": pos_name})

                # Initialize uniform numbers 1-50
                for n in range(1, 51):
                    conn.execute(text("INSERT IGNORE INTO uniform_numbers (team_id, number, is_available) VALUES (:tid, :n, TRUE)"),
                                {"tid": tid, "n": n})
                conn.commit()

            print(f"Equipos creados: {len(team_ids)}")

            # 3. Crear Partidos (Fixtures)
            # Round 1 (Played)
            matches = [
                (team_ids[0], team_ids[1], 2, 1, 'jugado'),
                (team_ids[2], team_ids[3], 0, 0, 'jugado'),
                # Round 2 (Scheduled)
                (team_ids[0], team_ids[2], 0, 0, 'programado'),
                (team_ids[1], team_ids[3], 0, 0, 'programado')
            ]
            
            for i, (h, a, sh, sa, status) in enumerate(matches):
                round_num = 1 if i < 2 else 2
                match_date = datetime.now() + timedelta(days=i)
                existing = conn.execute(text("""
                    SELECT id FROM matches WHERE tournament_id = :tid AND home_team_id = :h AND away_team_id = :a AND round_number = :rn
                """), {"tid": tournament_id, "h": h, "a": a, "rn": round_num}).fetchone()
                if not existing:
                    conn.execute(text("""
                        INSERT INTO matches (tournament_id, home_team_id, away_team_id, home_score, away_score, status, round_number, match_date)
                        VALUES (:tid, :h, :a, :sh, :sa, :status, :rn, :dt)
                    """), {"tid": tournament_id, "h": h, "a": a, "sh": sh, "sa": sa, "status": status, "rn": round_num, "dt": match_date})
            
            conn.commit()
            print("Partidos generados exitosamente.")
            print(f"Demo listo! Visita: http://localhost:3000/{t_slug}/stats")

        except Exception as e:
            print(f"Error durante el seed: {e}")
            conn.rollback()

if __name__ == "__main__":
    seed_demo()
