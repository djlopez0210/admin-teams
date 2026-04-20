import os
from sqlalchemy import text
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Minimal setup to use the same DB as the app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://root:root@football-db/football_db')
db = SQLAlchemy(app)

def seed():
    with app.app_context():
        print("🌱 Iniciando población de datos de prueba...")
        
        # 1. Crear Canchas
        db.session.execute(text("INSERT IGNORE INTO fields (name, address) VALUES ('Estadio Central', 'Calle 10 #5-20'), ('Cancha Sintética El GOL', 'Av. 68 con 13')"))
        
        # 2. Crear Árbitros
        db.session.execute(text("INSERT IGNORE INTO referees (full_name, document_number, phone) VALUES ('Juan Pérez', '123456', '3001234567'), ('Marta Díaz', '789012', '3109876543')"))
        
        # 3. Crear un Torneo de prueba si no existe
        db.session.execute(text("INSERT IGNORE INTO tournaments (name, slug, registration_open) VALUES ('Copa Relámpago 2026', 'copa-2026', 1)"))
        res = db.session.execute(text("SELECT id FROM tournaments WHERE slug='copa-2026'")).fetchone()
        t_id = res[0]
        
        # 4. Crear Equipos
        teams = [('Real Madrid FC', 'rm-fc'), ('Manchester City', 'mc-city'), ('Bayern Munich', 'bayern'), ('PSG', 'psg')]
        team_ids = []
        for name, slug in teams:
            db.session.execute(text("INSERT IGNORE INTO teams (name, slug, tournament_id) VALUES (:n, :s, :tid)"), {"n": name, "s": slug, "tid": t_id})
            res_team = db.session.execute(text("SELECT id FROM teams WHERE slug=:s"), {"s": slug}).fetchone()
            team_ids.append(res_team[0])
            
        # 5. Crear Jugadores para el Equipo 1 (Real Madrid)
        players_rm = [
            ('Thibaut Courtois', '111', 1), ('Vinícius Júnior', '777', 7), ('Jude Bellingham', '555', 5),
            ('Rodrygo Goes', '110', 11), ('Luka Modric', '101', 10)
        ]
        for name, doc, num in players_rm:
             db.session.execute(text("INSERT IGNORE INTO players (full_name, document_number, uniform_number, team_id, payment_status) VALUES (:n, :d, :u, :tid, 'PAID')"), 
                               {"n": name, "d": doc, "u": num, "tid": team_ids[0]})
        
        # 6. Crear Jugadores para el Equipo 2 (Man City)
        players_mc = [
            ('Erling Haaland', '999', 9), ('Kevin De Bruyne', '171', 17), ('Phil Foden', '474', 47),
            ('Bernardo Silva', '202', 20), ('Rodri', '161', 16)
        ]
        for name, doc, num in players_mc:
             db.session.execute(text("INSERT IGNORE INTO players (full_name, document_number, uniform_number, team_id, payment_status) VALUES (:n, :d, :u, :tid, 'PAID')"), 
                               {"n": name, "d": doc, "u": num, "tid": team_ids[1]})

        db.session.commit()
        print("✅ Población completada. 4 equipos, 10 jugadores, 2 árbitros y 2 canchas creados.")

if __name__ == "__main__":
    seed()
