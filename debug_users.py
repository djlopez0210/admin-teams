
import os
from sqlalchemy import create_engine, text

# Conexión directa a la DB del contenedor
engine = create_engine('mysql+pymysql://team_user:team_password@db/football_team')

def debug():
    with engine.connect() as conn:
        print("\n📊 ESTRUCTURA DE LA TABLA 'users':")
        res = conn.execute(text("DESCRIBE users"))
        for col in res.fetchall():
            print(f"🔹 Columna: {col[0]} | Tipo: {col[1]}")
        
        print("\n👥 CONTENIDO DEL USUARIO 'superadmin':")
        res = conn.execute(text("SELECT id, username, password_hash, role FROM users WHERE username = 'superadmin'"))
        user = res.fetchone()
        if user:
            print(f"✅ Encontrado: ID={user[0]} | User={user[1]} | Role={user[3]}")
            print(f"🔐 Hash: {user[2][:20]}...")
        else:
            print("❌ No se encontró el usuario 'superadmin'")

if __name__ == "__main__":
    debug()
