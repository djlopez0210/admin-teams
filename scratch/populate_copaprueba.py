
import os
from sqlalchemy import text
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@localhost/football_team')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

def populate():
    with app.app_context():
        # 1. Target Tournament: copaprueba (Slug: copaprueba, ID likely 2)
        tournament = db.session.execute(text("SELECT id FROM tournaments WHERE slug = 'copaprueba'")).fetchone()
        if not tournament:
            print("Tournament 'copaprueba' not found. Creating it...")
            res = db.session.execute(text("INSERT INTO tournaments (name, slug, city, registration_open, win_points, draw_points, loss_points) VALUES ('Copa Prueba 2026', 'copaprueba', 'Bogotá', 1, 3, 1, 0)"))
            t_id = res.lastrowid
        else:
            t_id = tournament[0]
            # Clear old data for a fresh look if needed, but let's just add to it
        
        team_names = ["Trueno FC", "Halcones Dorados", "Relámpago", "Titanes", "Dragones del Sur", "Leones del Norte"]
        team_ids = []

        for name in team_names:
            slug = name.lower().replace(" ", "-")
            # Check if team exists
            existing = db.session.execute(text("SELECT id FROM teams WHERE slug = :s"), {"s": slug}).fetchone()
            if existing:
                team_ids.append(existing[0])
                continue
                
            res = db.session.execute(text("INSERT INTO teams (name, slug, tournament_id) VALUES (:n, :s, :tid)"), 
                                     {"n": name, "s": slug, "tid": t_id})
            team_id = res.lastrowid
            team_ids.append(team_id)
            
            # Create a user for the team
            pw = generate_password_hash("password123")
            db.session.execute(text("INSERT INTO users (username, password_hash, role, team_id) VALUES (:u, :p, 'admin', :tid)"),
                               {"u": f"admin_{slug}", "p": pw, "tid": team_id})
            
            # Add some players (5 per team)
            positions = ['Portero', 'Defensa', 'Mediocampista', 'Delantero']
            for i in range(1, 6):
                p_name = f"Jugador {i} - {name}"
                doc = f"DOC-{team_id}-{i}"
                db.session.execute(text("INSERT INTO players (team_id, full_name, document_number, uniform_number, position, payment_status) VALUES (:tid, :n, :d, :u, :p, 'Pagó')"),
                                   {"tid": team_id, "n": p_name, "d": doc, "u": i, "p": positions[i % 4]})

        # 2. Assign teams to a group (create group if not exists)
        phase_res = db.session.execute(text("INSERT INTO tournament_phases (tournament_id, name, phase_order) VALUES (:tid, 'Fase de Grupos', 1)"), {"tid": t_id})
        phase_id = phase_res.lastrowid
        
        group_res = db.session.execute(text("INSERT INTO tournament_groups (tournament_id, phase_id, name) VALUES (:tid, :pid, 'Grupo A')"), {"tid": t_id, "pid": phase_id})
        group_id = group_res.lastrowid
        
        for tid in team_ids:
            db.session.execute(text("INSERT IGNORE INTO group_teams (group_id, team_id) VALUES (:gid, :tid)"), {"gid": group_id, "tid": tid})

        # 3. Create some matches and results
        # Match 1: Trueno vs Halcones (2-1)
        db.session.execute(text("INSERT INTO matches (tournament_id, group_id, home_team_id, away_team_id, status, home_score, away_score) VALUES (:tid, :gid, :h, :a, 'COMPLETED', 2, 1)"),
                           {"tid": t_id, "gid": group_id, "h": team_ids[0], "a": team_ids[1]})
        m_id = db.session.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # Add events for match 1 (Goals)
        # Find a player from Trueno
        player_res = db.session.execute(text("SELECT id FROM players WHERE team_id = :tid LIMIT 2"), {"tid": team_ids[0]}).fetchall()
        for p in player_res:
            db.session.execute(text("INSERT INTO match_events (match_id, team_id, player_id, event_type, event_minute) VALUES (:mid, :tid, :pid, 'GOAL', 15)"),
                               {"mid": m_id, "tid": team_ids[0], "pid": p[0]})
        
        # Match 2: Relampago vs Titanes (0-0)
        db.session.execute(text("INSERT INTO matches (tournament_id, group_id, home_team_id, away_team_id, status, home_score, away_score) VALUES (:tid, :gid, :h, :a, 'COMPLETED', 0, 0)"),
                           {"tid": t_id, "gid": group_id, "h": team_ids[2], "a": team_ids[3]})

        db.session.commit()
        print("Data population successful!")

if __name__ == "__main__":
    populate()
