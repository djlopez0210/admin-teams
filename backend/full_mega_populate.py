
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash
import random

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def mega_populate():
    with engine.begin() as conn:
        print("🧹 Limpiando base de datos...")
        # Desactivar llaves foráneas para limpieza total
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        
        tables = [
            "match_events", "match_lineups", "matches", "players", 
            "users", "teams", "tournaments", "referees", "fields",
            "activity_logs", "settings", "positions", "uniform_numbers"
        ]
        for table in tables:
            conn.execute(text(f"TRUNCATE TABLE {table}"))
        
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        print("✨ Base de datos limpia.")

        # 1. Crear Súper Admin
        print("👤 Creando SuperAdmin (dyck.lopez)...")
        hashed_pw = generate_password_hash('admin123')
        conn.execute(
            text("INSERT INTO users (username, password_hash, role) VALUES (:u, :p, 'superadmin')"),
            {"u": "dyck.lopez", "p": hashed_pw}
        )

        # 2. Crear Torneo
        print("🏆 Creando Torneo Pro 2024...")
        conn.execute(
            text("INSERT INTO tournaments (name, slug, city, description) VALUES (:n, :s, :c, :d)"),
            {"n": "Torneo Pro 2024", "s": "torneo-pro-2024", "c": "Ciudad Capital", "d": "El torneo más grande del año."}
        )
        tournament_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()

        # 3. Crear 3 Árbitros
        print("🏁 Creando Árbitros...")
        arbitros = ["Oscar Ruiz", "Wilmar Roldán", "Nestor Pitana"]
        for i, nombre in enumerate(arbitros):
            conn.execute(
                text("INSERT INTO referees (full_name, document_number, phone) VALUES (:n, :d, :p)"),
                {"n": nombre, "d": f"REF-{i+100}", "p": f"300{i}123456"}
            )

        # 4. Crear 3 Campos
        print("🏟️ Creando Campos de Juego...")
        campos = ["Estadio Principal", "Cancha Auxiliar 1", "Sede Norte"]
        for nombre in campos:
            conn.execute(
                text("INSERT INTO fields (name, address) VALUES (:n, :a)"),
                {"n": nombre, "a": f"Calle {random.randint(1,99)} # {random.randint(1,99)}"}
            )

        # 5. Crear 24 Equipos y sus Jugadores
        print("⚽ Creando 24 Equipos y 264 Jugadores...")
        nombres_equipos = [
            "Alianza", "Galácticos", "Titanes", "Furia", "Inter", "Milan", "Roma", "Napoli",
            "Leones", "Tigres", "Águilas", "Halcones", "Rojos", "Azules", "Verdes", "Blancos",
            "Ciclón", "Tormenta", "Trueno", "Relámpago", "Héroes", "Leyendas", "Cracks", "Astros"
        ]

        for i, nombre in enumerate(nombres_equipos):
            slug = f"{nombre.lower()}-{i+1}"
            conn.execute(
                text("INSERT INTO teams (name, slug, tournament_id) VALUES (:n, :s, :tid)"),
                {"n": nombre, "s": slug, "tid": tournament_id}
            )
            team_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()

            # 11 Jugadores por equipo
            for j in range(1, 12):
                p_name = f"Jugador {j} - {nombre}"
                doc = f"DOC-{team_id}-{j}"
                pos = random.choice(["Portero", "Defensa", "Mediocampista", "Delantero"])
                conn.execute(
                    text("INSERT INTO players (team_id, full_name, document_number, uniform_number, position, payment_status) VALUES (:tid, :fn, :dn, :un, :pos, 'PAID')"),
                    {"tid": team_id, "fn": p_name, "dn": doc, "un": j, "pos": pos}
                )

        print("\n🚀 ¡MEGA-POBLAMIENTO COMPLETADO!")
        print(f"✅ Torneo: 1 | Equipos: 24 | Jugadores: 264 | Árbitros: 3 | Campos: 3")
        print(f"👉 Acceso: dyck.lopez / admin123")

if __name__ == "__main__":
    mega_populate()
