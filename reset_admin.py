
import os
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash

# Conexión para adentro de Docker
engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def reset():
    # Usamos .begin() para que haga COMMIT automático al final
    with engine.begin() as conn:
        print("🔍 LISTA DE USUARIOS ACTUALES:")
        res = conn.execute(text("SELECT username, role FROM users"))
        for u in res.fetchall():
            print(f"👤 [{u[1]}] {u[0]}")
        
        print("\n🛠 CREANDO/ACTUALIZANDO SUPERADMIN...")
        pass_hash = generate_password_hash('admin123')
        
        # Primero borramos si existe algo corrupto y luego insertamos limpio
        conn.execute(text("DELETE FROM users WHERE username = 'superadmin'"))
        conn.execute(text("INSERT INTO users (username, password_hash, role) VALUES ('superadmin', :h, 'superadmin')"), {"h": pass_hash})
        
        print("✅ ¡ÉXITO! Usuario 'superadmin' listo con clave 'admin123'")

if __name__ == "__main__":
    reset()
