
import os
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash

engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def restore_dyck():
    with engine.begin() as conn:
        print("🛠 Reseteando clave para dyck.lopez...")
        pass_hash = generate_password_hash('admin123')
        
        # Actualizamos el hash de tu usuario original
        conn.execute(text("UPDATE users SET password_hash = :h WHERE username = 'dyck.lopez'"), {"h": pass_hash})
        print("✅ ¡LISTO! Ya puedes entrar con:")
        print("   Usuario: dyck.lopez")
        print("   Clave: admin123")

if __name__ == "__main__":
    restore_dyck()
