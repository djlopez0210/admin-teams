from app import db, app
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE tournaments ADD COLUMN config JSON"))
        db.session.commit()
        print("✅ Added config column to tournaments table")
    except Exception as e:
        print(f"⚠️ Error or already exists: {e}")
        db.session.rollback()
