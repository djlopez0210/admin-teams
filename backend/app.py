import os
import io
import re
import json
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, send_file
import pandas as pd
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import text
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import tournament_engine

# Cargar .env tanto de la ruta actual como del directorio del script backend
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@localhost:3307/football_team?charset=utf8mb4')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.getenv('SECRET_KEY', 'dev_secret_key_123')

db = SQLAlchemy(app)

# Upload Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'webp', 'svg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload limit

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

with app.app_context():
    try:
        # Essential Tables (Baseline)
        db.session.execute(text("CREATE TABLE IF NOT EXISTS tournaments (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), slug VARCHAR(100) UNIQUE, city VARCHAR(100), description TEXT, rules_pdf_url TEXT, registration_open BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS teams (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), slug VARCHAR(100) UNIQUE, tournament_id INT, delegate_document VARCHAR(50), delegate_name VARCHAR(100), delegate_email VARCHAR(100), registration_pin VARCHAR(20), logo_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS referees (id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100), document_number VARCHAR(50) UNIQUE, phone VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS matches (id INT AUTO_INCREMENT PRIMARY KEY, tournament_id INT, match_date DATETIME, home_team_id INT, away_team_id INT, referee_id INT, veedor_id INT, location VARCHAR(255), status VARCHAR(50) DEFAULT 'SCHEDULED', home_score INT DEFAULT 0, away_score INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS players (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, full_name VARCHAR(100), document_number VARCHAR(50) UNIQUE, uniform_number INT, position VARCHAR(50), payment_status VARCHAR(50) DEFAULT 'Pendiente', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS fields (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), address TEXT)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS match_lineups (match_id INT, player_id INT, team_id INT, PRIMARY KEY (match_id, player_id))"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS match_events (id INT AUTO_INCREMENT PRIMARY KEY, match_id INT, team_id INT, player_id INT, event_type VARCHAR(50), event_minute INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS activity_logs (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, action VARCHAR(100), details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS settings (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, team_name VARCHAR(100), team_logo_url TEXT, favicon_url TEXT)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS positions (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, name VARCHAR(50))"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS uniform_numbers (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, number INT, is_available BOOLEAN DEFAULT 1)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE, password_hash VARCHAR(255), role VARCHAR(20), team_id INT, tournament_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS player_history (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, player_id INT, document_number VARCHAR(50), full_name VARCHAR(100), uniform_number INT, primary_position_id INT, secondary_position_id INT, payment_status VARCHAR(50), payment_amount DECIMAL(10,2), registered_date DATETIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS team_costs (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT, description VARCHAR(255), amount DECIMAL(10,2), is_mandatory BOOLEAN DEFAULT 1)"))
        
        # New Tables for Phases and Groups
        db.session.execute(text("CREATE TABLE IF NOT EXISTS tournament_phases (id INT AUTO_INCREMENT PRIMARY KEY, tournament_id INT, name VARCHAR(100), phase_order INT DEFAULT 1, phase_type VARCHAR(50) DEFAULT 'ROUND_ROBIN', is_double_round BOOLEAN DEFAULT 0, status VARCHAR(50) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS tournament_groups (id INT AUTO_INCREMENT PRIMARY KEY, tournament_id INT, phase_id INT, name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS group_teams (group_id INT, team_id INT, points INT DEFAULT 0, goals_for INT DEFAULT 0, goals_against INT DEFAULT 0, matches_played INT DEFAULT 0, PRIMARY KEY (group_id, team_id))"))

        # Player match ratings (veedor-assigned score per player per match)
        db.session.execute(text("CREATE TABLE IF NOT EXISTS player_match_ratings (id INT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, player_id INT NOT NULL, team_id INT, rating DECIMAL(3,1), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_match_player (match_id, player_id))"))

        # Global player card template (drag & drop editor)
        db.session.execute(text("CREATE TABLE IF NOT EXISTS card_templates (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) DEFAULT 'default', canvas_width INT DEFAULT 613, canvas_height INT DEFAULT 860, background_url TEXT, elements JSON, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))

        # Communities Module Tables
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS communities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                slug VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                city VARCHAR(100),
                logo_url TEXT,
                cover_url TEXT,
                creator_id INT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                player_id INT NULL,
                document_number VARCHAR(50) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(150),
                position VARCHAR(50),
                jersey_number INT NULL,
                role VARCHAR(50) DEFAULT 'MEMBER',
                status VARCHAR(50) DEFAULT 'ACTIVE',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_community_player (community_id, document_number)
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                question VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                expires_at DATETIME NULL,
                created_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_poll_options (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                option_text VARCHAR(255) NOT NULL,
                votes_count INT DEFAULT 0
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_poll_votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                option_id INT NOT NULL,
                voter_identifier VARCHAR(100) NOT NULL,
                voter_name VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_poll_voter (poll_id, voter_identifier)
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_matches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                title VARCHAR(150) NOT NULL,
                match_date DATETIME,
                location VARCHAR(255),
                team_a_name VARCHAR(100) DEFAULT 'Equipo A',
                team_b_name VARCHAR(100) DEFAULT 'Equipo B',
                team_a_score INT DEFAULT 0,
                team_b_score INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'SCHEDULED',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_match_roster (
                id INT AUTO_INCREMENT PRIMARY KEY,
                match_id INT NOT NULL,
                community_player_id INT NOT NULL,
                team_side VARCHAR(10) NOT NULL,
                goals INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_match_player_roster (match_id, community_player_id)
            )
        """))

        # Schema Upgrades (Add missing columns safely)
        existing_columns = db.session.execute(text("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = 'teams' AND table_schema = (SELECT DATABASE())")).fetchall()
        column_names = [row[0] for row in existing_columns]
        
        team_cols = [
            ('tournament_id', 'INT'),
            ('delegate_document', 'VARCHAR(50)'),
            ('delegate_name', 'VARCHAR(100)'),
            ('delegate_email', 'VARCHAR(100)'),
            ('delegate_phone', 'VARCHAR(20)'),
            ('delegate_address', 'TEXT'),
            ('delegate_city', 'VARCHAR(100)'),
            ('registration_pin', 'VARCHAR(20)'),
            ('logo_url', 'TEXT')
        ]
        for col, col_type in team_cols:
            if col not in column_names:
                try:
                    db.session.execute(text(f"ALTER TABLE teams ADD COLUMN {col} {col_type}"))
                    db.session.commit()
                    print(f"✅ Added missing column to teams: {col}")
                except Exception as ex:
                    print(f"⚠️ Could not add column {col} to teams: {ex}")
                    db.session.rollback()
        # Safe Player columns upgrade
        existing_player_cols = db.session.execute(text("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = 'players' AND table_schema = (SELECT DATABASE())")).fetchall()
        player_col_names = [row[0] for row in existing_player_cols]
        
        player_safe_cols = [
            ('team_id', 'INT'),
            ('uniform_number', 'INT'),
            ('position', 'VARCHAR(50)'),
            ('primary_position_id', 'INT'),
            ('secondary_position_id', 'INT'),
            ('payment_status', "VARCHAR(50) DEFAULT 'Pendiente'")
        ]
        for col, col_type in player_safe_cols:
            if col not in player_col_names:
                try:
                    db.session.execute(text(f"ALTER TABLE players ADD COLUMN {col} {col_type}"))
                    db.session.commit()
                    print(f"✅ Added missing column to players: {col}")
                except Exception as ex:
                    print(f"⚠️ Could not add column {col} to players: {ex}")
                    db.session.rollback()

        upgrades = [
            # Phases
            "ALTER TABLE tournament_phases ADD COLUMN is_double_round BOOLEAN DEFAULT 0",
            # Tournaments
            "ALTER TABLE tournaments ADD COLUMN rules_pdf_url TEXT",
            "ALTER TABLE tournaments ADD COLUMN registration_open BOOLEAN DEFAULT 1",
            "ALTER TABLE tournaments ADD COLUMN image_url TEXT AFTER description",
            "ALTER TABLE tournaments ADD COLUMN win_points INT DEFAULT 3",
            "ALTER TABLE tournaments ADD COLUMN draw_points INT DEFAULT 1",
            "ALTER TABLE tournaments ADD COLUMN loss_points INT DEFAULT 0",
            "ALTER TABLE tournaments ADD COLUMN format_type VARCHAR(50) DEFAULT 'league'",
            "ALTER TABLE tournaments ADD COLUMN config JSON",
            # Referees
            "ALTER TABLE referees ADD COLUMN tournament_id INT",
            "ALTER TABLE referees ADD COLUMN age INT",
            "ALTER TABLE referees ADD COLUMN address VARCHAR(255)",
            # Teams
            "ALTER TABLE teams ADD COLUMN tournament_id INT",
            "ALTER TABLE teams ADD COLUMN delegate_document VARCHAR(50)",
            "ALTER TABLE teams ADD COLUMN delegate_name VARCHAR(100)",
            "ALTER TABLE teams ADD COLUMN delegate_email VARCHAR(100)",
            "ALTER TABLE teams ADD COLUMN delegate_phone VARCHAR(20)",
            "ALTER TABLE teams ADD COLUMN delegate_address TEXT",
            "ALTER TABLE teams ADD COLUMN delegate_city VARCHAR(100)",
            "ALTER TABLE teams ADD COLUMN registration_pin VARCHAR(20)",
            "ALTER TABLE teams ADD COLUMN logo_url TEXT",
            # Settings
            "ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
            # Team Costs
            "ALTER TABLE team_costs ADD COLUMN item_name VARCHAR(255)",
            # Players
            "ALTER TABLE players MODIFY COLUMN payment_status VARCHAR(50) DEFAULT 'Pendiente'",
            "ALTER TABLE players ADD COLUMN document_type VARCHAR(50) AFTER team_id",
            "ALTER TABLE players ADD COLUMN address VARCHAR(255)",
            "ALTER TABLE players ADD COLUMN neighborhood VARCHAR(100)",
            "ALTER TABLE players ADD COLUMN phone VARCHAR(20)",
            "ALTER TABLE players ADD COLUMN eps VARCHAR(100)",
            "ALTER TABLE players ADD COLUMN uniform_size VARCHAR(10)",
            "ALTER TABLE players ADD COLUMN primary_position_id INT",
            "ALTER TABLE players ADD COLUMN secondary_position_id INT",
            "ALTER TABLE players ADD COLUMN payment_amount DECIMAL(10,2) DEFAULT 0",
            "ALTER TABLE players ADD COLUMN last_registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            # Player Profile (card module)
            "ALTER TABLE players ADD COLUMN first_name VARCHAR(100)",
            "ALTER TABLE players ADD COLUMN last_name VARCHAR(100)",
            "ALTER TABLE players ADD COLUMN email VARCHAR(150)",
            "ALTER TABLE players ADD COLUMN birth_date DATE",
            "ALTER TABLE players ADD COLUMN tertiary_position_id INT",
            "ALTER TABLE players ADD COLUMN preferred_foot VARCHAR(20)",
            "ALTER TABLE players ADD COLUMN blood_type VARCHAR(5)",
            "ALTER TABLE players ADD COLUMN nationality VARCHAR(100)",
            "ALTER TABLE players ADD COLUMN photo_url TEXT",
            "ALTER TABLE players ADD COLUMN photo_cutout_url TEXT",
            # Users (player self-service login)
            "ALTER TABLE users ADD COLUMN tournament_id INT",
            "ALTER TABLE users ADD COLUMN player_id INT",
            "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0",
            # Matches
            "ALTER TABLE matches MODIFY COLUMN status VARCHAR(50) DEFAULT 'SCHEDULED'",
            "ALTER TABLE matches ADD COLUMN phase_id INT AFTER tournament_id",
            "ALTER TABLE matches ADD COLUMN group_id INT AFTER phase_id",
            "ALTER TABLE matches ADD COLUMN match_day INT DEFAULT 1",
            "ALTER TABLE matches ADD COLUMN referee VARCHAR(100) AFTER location",
            "ALTER TABLE matches ADD COLUMN veedor_id INT AFTER referee_id",
            # Group Teams Stats
            "ALTER TABLE group_teams ADD COLUMN points INT DEFAULT 0",
            "ALTER TABLE group_teams ADD COLUMN goals_for INT DEFAULT 0",
            "ALTER TABLE group_teams ADD COLUMN goals_against INT DEFAULT 0",
            "ALTER TABLE group_teams ADD COLUMN matches_played INT DEFAULT 0",
            # Shared Player Base & Community Support
            "ALTER TABLE players MODIFY COLUMN team_id INT NULL",
        ]

        for q in upgrades:
            try:
                db.session.execute(text(q))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Ensure players index allows the same document in multiple teams (unique per team_id + document_number)
        try:
            db.session.execute(text("ALTER TABLE players DROP INDEX document_number"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(text("ALTER TABLE players ADD UNIQUE KEY uniq_team_player (team_id, document_number)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Default card template row (the "global" template = lowest id)
        res = db.session.execute(text("SELECT COUNT(*) FROM card_templates")).scalar()
        if res == 0:
            db.session.execute(text("INSERT INTO card_templates (name, elements) VALUES ('default', :els)"), {"els": json.dumps([])})
            db.session.commit()
            print("🎴 Default card template created")

        # Default Superadmin
        res = db.session.execute(text("SELECT COUNT(*) FROM users WHERE username = 'superadmin'")).scalar()
        if res == 0:
            hp = generate_password_hash('admin123')
            db.session.execute(text("INSERT INTO users (username, password_hash, role) VALUES ('superadmin', :hp, 'superadmin')"), {"hp": hp})
            db.session.commit()
            print("👤 Default superadmin created: superadmin / admin123")
        else:
            # Update password for safety if it already exists
            hp = generate_password_hash('admin123')
            db.session.execute(text("UPDATE users SET password_hash = :hp WHERE username = 'superadmin'"), {"hp": hp})
            db.session.commit()

        db.session.commit()
        print("✅ Backend fully initialized and migrated.")
    except Exception as e:
        print(f"⚠️ Initialization Error: {e}")
        db.session.rollback()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def sanitize_int(val):
    if val is None or val == '': return None
    try: return int(val)
    except: return None

# Helper function to Log Activity
def log_activity(team_id, action, details=None):
    try:
        db.session.execute(
            text("INSERT INTO activity_logs (team_id, action, details) VALUES (:team, :action, :details)"),
            {"team": team_id, "action": action, "details": details}
        )
        db.session.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")

def resolve_app_url(req=None):
    """
    Resuelve la URL pública del frontend.
    Prioridad:
    1. Variable de entorno APP_URL si está definida y NO es localhost/127.0.0.1.
    2. Cabeceras HTTP Origin o Referer de la petición actual (detecta automáticamente el dominio de producción).
    3. Cabeceras de Proxy inverso (X-Forwarded-Host / Host).
    4. Fallback a APP_URL del .env o https://eloncepro.com si no se detecta.
    """
    env_url = os.getenv('APP_URL', '').strip().rstrip('/')
    if env_url and 'localhost' not in env_url and '127.0.0.1' not in env_url:
        return env_url

    r = req
    if not r:
        try:
            from flask import has_request_context, request as flask_req
            if has_request_context():
                r = flask_req
        except Exception:
            r = None

    if r:
        origin = r.headers.get('Origin')
        if origin and 'localhost' not in origin and '127.0.0.1' not in origin:
            return origin.rstrip('/')

        referer = r.headers.get('Referer')
        if referer:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                if parsed.netloc and 'localhost' not in parsed.netloc and '127.0.0.1' not in parsed.netloc:
                    return f"{parsed.scheme}://{parsed.netloc}".rstrip('/')
            except Exception:
                pass

        fwd_host = r.headers.get('X-Forwarded-Host') or r.headers.get('Host')
        fwd_proto = r.headers.get('X-Forwarded-Proto', 'https' if r.is_secure else 'http')
        if fwd_host and 'localhost' not in fwd_host and '127.0.0.1' not in fwd_host:
            return f"{fwd_proto}://{fwd_host}".rstrip('/')

    return env_url or 'http://localhost:3000'

def send_team_welcome_email(to_email, delegate_name, team_name, slug, admin_user, admin_pass, pin=None, app_url=None):
    if not to_email or '@' not in str(to_email):
        return

    to_email = str(to_email).strip()
    platform_name = os.getenv('PLATFORM_NAME', 'ElOncePro')
    if not app_url:
        app_url = resolve_app_url()
    app_url = app_url.rstrip('/')
    admin_login_url = f"{app_url}/login"
    registration_url = f"{app_url}/{slug}/registro"
    
    subject = f"⚽ ¡Bienvenido a {platform_name}! Tu equipo {team_name} fue registrado con éxito"
    
    pin_block_html = f"""
    <div style="background: #f8fafc; border-left: 4px solid #00f2fe; padding: 12px 16px; margin-top: 14px; border-radius: 4px;">
        <span style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">PIN de Registro de Jugadores:</span>
        <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 3px; margin-top: 4px;">{pin}</div>
    </div>
    """ if pin else ""

    pin_plain = f"\nPIN de Registro: {pin}" if pin else ""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a {platform_name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
            <div style="font-size: 40px; margin-bottom: 8px;">⚽</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #00f2fe; letter-spacing: -0.5px;">¡Bienvenido a {platform_name}!</h1>
            <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 15px;">Tu equipo ha quedado correctamente registrado</p>
        </div>
        <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 15px;">
            <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                Hola {delegate_name or 'Representante'},
            </div>
            <p style="margin: 0 0 20px 0;">
                ¡Nos emociona darte la bienvenida a nuestra plataforma! Tu equipo <strong style="color: #0f172a;">{team_name}</strong> ya se encuentra activado y listo para competir.
            </p>

            <!-- Card Credenciales Admin -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 12px;">
                    🔐 Tus Credenciales de Administrador de Equipo
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="color: #64748b; font-size: 14px;">Panel de Acceso:</span> 
                    <a href="{admin_login_url}" style="color: #0284c7; font-weight: 600; text-decoration: none;">{admin_login_url}</a>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="color: #64748b; font-size: 14px;">Usuario:</span> 
                    <strong style="font-family: monospace; font-size: 15px; color: #0f172a; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{admin_user}</strong>
                </div>
                <div>
                    <span style="color: #64748b; font-size: 14px;">Contraseña:</span> 
                    <strong style="font-family: monospace; font-size: 15px; color: #0f172a; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{admin_pass}</strong>
                </div>
            </div>

            <!-- Card Enlace para Jugadores -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 8px;">
                    👥 Enlace de Inscripción para tus Jugadores
                </div>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">
                    Comparte este link oficial con los integrantes de tu equipo para que completen su registro:
                </p>
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
                    <a href="{registration_url}" style="color: #0284c7; font-weight: 600; text-decoration: none; word-break: break-all;">
                        {registration_url}
                    </a>
                </div>
                {pin_block_html}
            </div>

            <div style="text-align: center; margin: 28px 0 12px 0;">
                <a href="{admin_login_url}" style="display: inline-block; background: #00f2fe; color: #0b1329; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 242, 254, 0.3);">
                    Ingresar al Panel de Control
                </a>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0;">
            Mensaje automático generado por {platform_name}.<br>
            Si tienes dudas o inquietudes, comunícate con la organización del torneo.
        </div>
    </div>
</body>
</html>"""

    plain_text = f"""¡Bienvenido a {platform_name}!

Hola {delegate_name or 'Representante'},
Tu equipo "{team_name}" ha sido correctamente registrado en nuestra plataforma.

--- CREDENCIALES DE ADMINISTRACIÓN ---
Panel de Acceso: {admin_login_url}
Usuario: {admin_user}
Contraseña: {admin_pass}

--- LINK DE INSCRIPCIÓN PARA JUGADORES ---
Comparte este enlace con tus jugadores:
{registration_url}{pin_plain}

¡Muchos éxitos!
{platform_name}
"""

    smtp_host = os.getenv('SMTP_HOST', '').strip()
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER', '').strip()
    smtp_pass = os.getenv('SMTP_PASS', '').strip().replace(' ', '')
    smtp_use_tls = os.getenv('SMTP_USE_TLS', 'true').lower() in ('true', '1', 'yes')
    from_email = os.getenv('SMTP_FROM_EMAIL', smtp_user or 'noreply@plataformadeportiva.com').strip()
    from_name = os.getenv('SMTP_FROM_NAME', platform_name).strip()

    # If no SMTP configured, print log in server console
    if not smtp_host:
        print("\n" + "="*62)
        print("📬 [SIMULACIÓN ENVÍO DE CORREO] Equipo Registrado")
        print(f"Para: {to_email} ({delegate_name or 'Representante'})")
        print(f"Asunto: {subject}")
        print(f"Equipo: {team_name} | Slug: {slug}")
        print(f"Usuario Admin: {admin_user} | Contraseña: {admin_pass}")
        print(f"Link Registro Jugadores: {registration_url}")
        if pin:
            print(f"PIN: {pin}")
        print("="*62)
        print("💡 Para envíos reales vía internet, configura en tu archivo .env:")
        print("   SMTP_HOST=smtp.gmail.com")
        print("   SMTP_PORT=587")
        print("   SMTP_USER=tu_correo@gmail.com")
        print("   SMTP_PASS=tu_password_de_aplicacion\n")
        return

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = to_email

        msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            if smtp_use_tls:
                server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.send_message(msg)
        server.quit()
        print(f"✅ Correo de bienvenida enviado exitosamente a {to_email}")
    except Exception as ex:
        print(f"⚠️ Error al enviar correo de bienvenida a {to_email}: {ex}")

def send_team_welcome_email_async(to_email, delegate_name, team_name, slug, admin_user, admin_pass, pin=None, app_url=None):
    try:
        t = threading.Thread(
            target=send_team_welcome_email,
            args=(to_email, delegate_name, team_name, slug, admin_user, admin_pass, pin, app_url),
            daemon=True
        )
        t.start()
    except Exception as e:
        print(f"Error starting email thread: {e}")

def send_player_welcome_email(to_email, player_name, team_name, uniform_number, position_name, delegate_name=None, team_logo_url=None, tournament_name=None):
    if not to_email or '@' not in str(to_email):
        return

    platform_name = "ElOncePro"
    signer_name = (delegate_name or '').strip() or team_name
    subject = f"⚽ ¡Bienvenido a {team_name}! Tu dorsal y ficha oficial están listos"

    logo_html = ""
    if team_logo_url:
        logo_html = f'<img src="{team_logo_url}" alt="{team_name}" style="max-height: 80px; max-width: 140px; margin-bottom: 12px; object-fit: contain; border-radius: 8px;">'
    else:
        logo_html = '<div style="font-size: 44px; margin-bottom: 8px;">⚽</div>'

    tournament_html = ""
    tournament_plain = ""
    if tournament_name:
        tournament_html = f'''
            <div style="margin-bottom: 10px; color: #475569; font-size: 14px;">
                <strong style="color: #0f172a;">Competencia / Torneo:</strong> {tournament_name}
            </div>
        '''
        tournament_plain = f"\nCompetencia / Torneo: {tournament_name}"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
            {logo_html}
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #00f2fe; letter-spacing: -0.5px;">¡Bienvenido a {team_name}!</h1>
            <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 15px;">Tu dorsal y ficha oficial están listos</p>
        </div>
        <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 15px;">
            <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 14px;">
                ¡Hola, {player_name or 'Jugador'}!
            </div>
            <p style="margin: 0 0 24px 0; color: #334155; line-height: 1.6;">
                ¡Nos alegra darte la bienvenida a la familia de <strong style="color: #0f172a;">{team_name}</strong>! A partir de hoy formas parte de nuestro equipo. Viviremos grandes experiencias y trabajaremos juntos por la victoria.
            </p>

            <!-- Card Ficha Oficial de Jugador (Sin documento) -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #cbd5e1; border-radius: 12px; padding: 22px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 16px;">
                    📋 Ficha Oficial de Jugador
                </div>
                
                <div style="text-align: center; margin: 8px 0 20px 0;">
                    <div style="display: inline-block; background: #0b1329; color: #00f2fe; font-size: 26px; font-weight: 900; padding: 8px 24px; border-radius: 10px; border: 2px solid #00f2fe; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(0, 242, 254, 0.25);">
                        DORSAL #{uniform_number or '-'}
                    </div>
                </div>

                <div style="margin-bottom: 10px; color: #475569; font-size: 14px;">
                    <strong style="color: #0f172a;">Equipo:</strong> {team_name}
                </div>
                <div style="margin-bottom: 10px; color: #475569; font-size: 14px;">
                    <strong style="color: #0f172a;">Posición en el campo:</strong> {position_name or 'Sin definir'}
                </div>
                {tournament_html}
            </div>

            <!-- Cierre y Firma Oficial -->
            <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; line-height: 1.6;">
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #0f172a; font-size: 15px;">
                    Prepárate para dar lo mejor de ti. ¡Nos vemos en la cancha!
                </p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                    Cuerpo Técnico y Directiva de <strong style="color: #0f172a;">{signer_name}</strong>
                </p>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0;">
            Mensaje oficial generado por {platform_name} para {team_name}.<br>
            ¡Muchos éxitos en la temporada!
        </div>
    </div>
</body>
</html>"""

    plain_text = f"""¡Bienvenido a {team_name}!

¡Hola, {player_name or 'Jugador'}!
¡Nos alegra darte la bienvenida a la familia de {team_name}! A partir de hoy formas parte de nuestro equipo. Viviremos grandes experiencias y trabajaremos juntos por la victoria.

--- FICHA OFICIAL DE JUGADOR ---
Equipo: {team_name}
Dorsal Asignado: #{uniform_number or '-'}
Posición en el campo: {position_name or 'Sin definir'}{tournament_plain}

Prepárate para dar lo mejor de ti. ¡Nos vemos en la cancha!
Cuerpo Técnico y Directiva de {signer_name}

Generado automáticamente por {platform_name}
"""

    smtp_host = os.getenv('SMTP_HOST', '').strip()
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER', '').strip()
    smtp_pass = os.getenv('SMTP_PASS', '').strip().replace(' ', '')
    smtp_use_tls = os.getenv('SMTP_USE_TLS', 'true').lower() in ('true', '1', 'yes')
    from_email = os.getenv('SMTP_FROM_EMAIL', smtp_user or 'noreply@eloncepro.com').strip()
    from_name = os.getenv('SMTP_FROM_NAME', platform_name).strip()

    if not smtp_host:
        print("\n" + "="*62)
        print("📬 [SIMULACIÓN ENVÍO DE CORREO] Bienvenida a Jugador")
        print(f"Para: {to_email} ({player_name})")
        print(f"Asunto: {subject}")
        print(f"Equipo: {team_name} | Dorsal: #{uniform_number} | Posición: {position_name}")
        if tournament_name:
            print(f"Torneo: {tournament_name}")
        print(f"Firma:  {signer_name} Director tècnico")
        print( {team_name} )
        print("="*62 + "\n")
        return

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = to_email

        msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            if smtp_use_tls:
                server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.send_message(msg)
        server.quit()
        print(f"✅ Correo de bienvenida a jugador enviado exitosamente a {to_email}")
    except Exception as ex:
        print(f"⚠️ Error al enviar correo de bienvenida a jugador {to_email}: {ex}")

def send_player_welcome_email_async(to_email, player_name, team_name, uniform_number, position_name, delegate_name=None, team_logo_url=None, tournament_name=None):
    if not to_email or '@' not in str(to_email):
        return
    try:
        t = threading.Thread(
            target=send_player_welcome_email,
            args=(to_email, player_name, team_name, uniform_number, position_name, delegate_name, team_logo_url, tournament_name),
            daemon=True
        )
        t.start()
    except Exception as e:
        print(f"Error starting player email thread: {e}")

def get_team_id_from_slug(slug):
    if not slug:
        return None
    if isinstance(slug, int) or (isinstance(slug, str) and slug.isdigit()):
        row = db.session.execute(text("SELECT id FROM teams WHERE id = :id"), {"id": int(slug)}).fetchone()
        if row:
            return row[0]
    result = db.session.execute(text("SELECT id FROM teams WHERE slug = :slug"), {"slug": slug}).fetchone()
    return result[0] if result else None

def get_tournament_id_from_slug(slug):
    result = db.session.execute(text("SELECT id FROM tournaments WHERE slug = :slug"), {"slug": slug}).fetchone()
    return result[0] if result else None

def slugify(text_val):
    if not text_val:
        return 'comunidad'
    s = text_val.lower().strip()
    s = re.sub(r'[àáâãäå]', 'a', s)
    s = re.sub(r'[èéêë]', 'e', s)
    s = re.sub(r'[ìíîï]', 'i', s)
    s = re.sub(r'[òóôõö]', 'o', s)
    s = re.sub(r'[ùúûü]', 'u', s)
    s = re.sub(r'[ñ]', 'n', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def check_player_tournament_conflict(document_number, target_team_id):
    """
    Regla de Torneo: Un jugador puede pertenecer a más de un equipo en la plataforma,
    pero NUNCA a dos equipos que compartan el mismo torneo.
    Retorna (True, mensaje_conflicto) si hay conflicto, (False, None) si es válido.
    """
    if not document_number or not target_team_id:
        return False, None

    doc_str = str(document_number).split('.')[0].strip()
    if not doc_str:
        return False, None

    target_team = db.session.execute(
        text("SELECT tournament_id, name FROM teams WHERE id = :tid"),
        {"tid": target_team_id}
    ).fetchone()

    if not target_team or not target_team[0]:
        return False, None

    target_tournament_id = target_team[0]

    conflict_row = db.session.execute(
        text("""
            SELECT tm.id, tm.name as team_name, tr.name as tournament_name
            FROM players p
            JOIN teams tm ON p.team_id = tm.id
            JOIN tournaments tr ON tm.tournament_id = tr.id
            WHERE p.document_number = :doc
              AND tm.id != :target_team_id
              AND tm.tournament_id = :tournament_id
            LIMIT 1
        """),
        {
            "doc": doc_str,
            "target_team_id": target_team_id,
            "tournament_id": target_tournament_id
        }
    ).fetchone()

    if conflict_row:
        other_team_name = conflict_row[1]
        tournament_name = conflict_row[2]
        return True, (
            f"Regla de torneo: El jugador con documento {doc_str} ya se encuentra inscrito en el equipo "
            f"'{other_team_name}' que compite en el torneo '{tournament_name}'. "
            f"Un jugador no puede pertenecer a dos equipos dentro del mismo torneo."
        )

    return False, None

def process_player_excel_import(file_storage, target_community_id=None, target_team_id=None):
    """
    Lee un archivo Excel (.xlsx, .xls) o CSV y procesa la inscripción masiva de jugadores.
    Aplica la regla de torneo si target_team_id está definido.
    Vincula o registra en la base global compartida.
    """
    try:
        filename = getattr(file_storage, 'filename', '') or ''
        filename = filename.lower()
        if filename.endswith('.csv'):
            df = pd.read_csv(file_storage)
        else:
            df = pd.read_excel(file_storage)
    except Exception as read_err:
        return {"success": False, "error": f"Error al leer el archivo Excel: {str(read_err)}"}

    if df.empty:
        return {"success": False, "error": "El archivo Excel está vacío"}

    col_map = {}
    for col in df.columns:
        norm = str(col).lower().strip()
        norm = re.sub(r'[àáâãäå]', 'a', norm)
        norm = re.sub(r'[èéêë]', 'e', norm)
        norm = re.sub(r'[ìíîï]', 'i', norm)
        norm = re.sub(r'[òóôõö]', 'o', norm)
        norm = re.sub(r'[ùúûü]', 'u', norm)
        norm = re.sub(r'[^a-z0-9_]+', '_', norm).strip('_')

        if norm in ['documento', 'doc', 'cedula', 'identificacion', 'document_number']:
            col_map['document_number'] = col
        elif norm in ['nombre_completo', 'full_name', 'jugador']:
            col_map['full_name'] = col
        elif norm in ['nombres', 'nombre', 'first_name']:
            col_map['first_name'] = col
        elif norm in ['apellidos', 'apellido', 'last_name']:
            col_map['last_name'] = col
        elif norm in ['posicion', 'position', 'puesto']:
            col_map['position'] = col
        elif norm in ['telefono', 'celular', 'phone', 'tel']:
            col_map['phone'] = col
        elif norm in ['email', 'correo', 'correo_electronico']:
            col_map['email'] = col
        elif norm in ['fecha_nacimiento', 'nacimiento', 'birth_date']:
            col_map['birth_date'] = col
        elif norm in ['dorsal', 'numero', 'jersey_number', 'uniform_number']:
            col_map['jersey_number'] = col
        elif norm in ['eps', 'salud']:
            col_map['eps'] = col
        elif norm in ['pie_habil', 'pie', 'preferred_foot']:
            col_map['preferred_foot'] = col
        elif norm in ['tipo_sangre', 'sangre', 'blood_type']:
            col_map['blood_type'] = col

    has_name = ('full_name' in col_map) or ('first_name' in col_map)
    if 'document_number' not in col_map or not has_name:
        return {
            "success": False,
            "error": "El archivo debe contener al menos la columna 'documento' y las columnas de nombre ('nombres' y 'apellidos' o 'nombre_completo')."
        }

    total_rows = len(df)
    imported = 0
    updated = 0
    errors = []

    for idx, row in df.iterrows():
        row_num = idx + 2
        raw_doc = row.get(col_map['document_number'])
        raw_name = row.get(col_map['full_name']) if 'full_name' in col_map else None
        raw_fn = row.get(col_map['first_name']) if 'first_name' in col_map else None
        raw_ln = row.get(col_map['last_name']) if 'last_name' in col_map else None

        if pd.isna(raw_doc) or str(raw_doc).strip() == '':
            errors.append({"row": row_num, "error": "Número de documento vacío"})
            continue

        doc_str = str(raw_doc).split('.')[0].strip()

        fn_str = str(raw_fn).strip() if raw_fn is not None and not pd.isna(raw_fn) else ''
        ln_str = str(raw_ln).strip() if raw_ln is not None and not pd.isna(raw_ln) else ''

        if fn_str or ln_str:
            name_str = f"{fn_str} {ln_str}".strip()
        else:
            name_str = str(raw_name).strip() if raw_name is not None and not pd.isna(raw_name) else ''
            parts = name_str.split(' ')
            fn_str = parts[0] if parts else ''
            ln_str = ' '.join(parts[1:]) if len(parts) > 1 else ''

        if not name_str:
            errors.append({"row": row_num, "document": doc_str, "error": "Nombres/Apellidos vacíos"})
            continue

        pos_str = str(row.get(col_map.get('position', ''))).strip() if col_map.get('position') and not pd.isna(row.get(col_map['position'])) else None
        phone_str = str(row.get(col_map.get('phone', ''))).split('.')[0].strip() if col_map.get('phone') and not pd.isna(row.get(col_map['phone'])) else None
        email_str = str(row.get(col_map.get('email', ''))).strip() if col_map.get('email') and not pd.isna(row.get(col_map['email'])) else None
        raw_jersey = row.get(col_map.get('jersey_number', '')) if col_map.get('jersey_number') else None
        jersey_num = sanitize_int(raw_jersey) if raw_jersey is not None and not pd.isna(raw_jersey) else None
        eps_str = str(row.get(col_map.get('eps', ''))).strip() if col_map.get('eps') and not pd.isna(row.get(col_map['eps'])) else None
        foot_str = str(row.get(col_map.get('preferred_foot', ''))).strip() if col_map.get('preferred_foot') and not pd.isna(row.get(col_map['preferred_foot'])) else None
        blood_str = str(row.get(col_map.get('blood_type', ''))).strip() if col_map.get('blood_type') and not pd.isna(row.get(col_map['blood_type'])) else None

        raw_birth = row.get(col_map.get('birth_date', '')) if col_map.get('birth_date') else None
        birth_val = None
        if raw_birth is not None and not pd.isna(raw_birth):
            try:
                if isinstance(raw_birth, (datetime, pd.Timestamp)):
                    birth_val = raw_birth.strftime('%Y-%m-%d')
                else:
                    birth_val = pd.to_datetime(str(raw_birth)).strftime('%Y-%m-%d')
            except Exception:
                birth_val = None

        if target_team_id:
            conflict, conflict_msg = check_player_tournament_conflict(doc_str, target_team_id)
            if conflict:
                errors.append({
                    "row": row_num,
                    "document": doc_str,
                    "name": name_str,
                    "error": conflict_msg
                })
                continue

            try:
                exist_team = db.session.execute(
                    text("SELECT id FROM players WHERE team_id = :team AND document_number = :doc"),
                    {"team": target_team_id, "doc": doc_str}
                ).fetchone()

                if exist_team:
                    db.session.execute(
                        text("""
                            UPDATE players SET full_name = :name, first_name = :fn, last_name = :ln,
                                   phone = COALESCE(:phone, phone),
                                   email = COALESCE(:email, email), eps = COALESCE(:eps, eps),
                                   position = COALESCE(:pos, position), uniform_number = COALESCE(:unif, uniform_number),
                                   birth_date = COALESCE(:birth, birth_date), preferred_foot = COALESCE(:foot, preferred_foot),
                                   blood_type = COALESCE(:blood, blood_type)
                            WHERE id = :id
                        """),
                        {
                            "name": name_str, "fn": fn_str, "ln": ln_str, "phone": phone_str, "email": email_str, "eps": eps_str,
                            "pos": pos_str, "unif": jersey_num, "birth": birth_val, "foot": foot_str,
                            "blood": blood_str, "id": exist_team[0]
                        }
                    )
                    updated += 1
                else:
                    global_p = db.session.execute(
                        text("SELECT photo_url, photo_cutout_url FROM players WHERE document_number = :doc AND photo_url IS NOT NULL LIMIT 1"),
                        {"doc": doc_str}
                    ).fetchone()
                    photo_url = global_p[0] if global_p else None
                    cutout_url = global_p[1] if global_p else None

                    db.session.execute(
                        text("""
                            INSERT INTO players (team_id, document_number, full_name, first_name, last_name, phone, email, eps,
                                                position, uniform_number, birth_date, preferred_foot, blood_type,
                                                photo_url, photo_cutout_url)
                            VALUES (:team, :doc, :name, :fn, :ln, :phone, :email, :eps, :pos, :unif, :birth, :foot, :blood, :photo, :cutout)
                        """),
                        {
                            "team": target_team_id, "doc": doc_str, "name": name_str, "fn": fn_str, "ln": ln_str, "phone": phone_str,
                            "email": email_str, "eps": eps_str, "pos": pos_str, "unif": jersey_num,
                            "birth": birth_val, "foot": foot_str, "blood": blood_str,
                            "photo": photo_url, "cutout": cutout_url
                        }
                    )
                    imported += 1
            except Exception as e:
                errors.append({"row": row_num, "document": doc_str, "name": name_str, "error": str(e)})

        elif target_community_id:
            try:
                global_p = db.session.execute(
                    text("SELECT id FROM players WHERE document_number = :doc LIMIT 1"),
                    {"doc": doc_str}
                ).fetchone()

                player_id = None
                if global_p:
                    player_id = global_p[0]
                    db.session.execute(
                        text("""
                            UPDATE players SET full_name = :name, first_name = :fn, last_name = :ln,
                                   phone = COALESCE(:phone, phone), email = COALESCE(:email, email),
                                   eps = COALESCE(:eps, eps), position = COALESCE(:pos, position),
                                   birth_date = COALESCE(:birth, birth_date),
                                   preferred_foot = COALESCE(:foot, preferred_foot),
                                   blood_type = COALESCE(:blood, blood_type)
                            WHERE id = :id
                        """),
                        {
                            "name": name_str, "fn": fn_str, "ln": ln_str, "phone": phone_str, "email": email_str, "eps": eps_str,
                            "pos": pos_str, "birth": birth_val, "foot": foot_str, "blood": blood_str,
                            "id": player_id
                        }
                    )
                else:
                    res_p = db.session.execute(
                        text("""
                            INSERT INTO players (document_number, full_name, first_name, last_name, phone, email, eps,
                                                position, birth_date, preferred_foot, blood_type)
                            VALUES (:doc, :name, :fn, :ln, :phone, :email, :eps, :pos, :birth, :foot, :blood)
                        """),
                        {
                            "doc": doc_str, "name": name_str, "fn": fn_str, "ln": ln_str, "phone": phone_str, "email": email_str,
                            "eps": eps_str, "pos": pos_str, "birth": birth_val, "foot": foot_str,
                            "blood": blood_str
                        }
                    )
                    player_id = res_p.lastrowid

                exist_comm = db.session.execute(
                    text("SELECT id FROM community_players WHERE community_id = :comm AND document_number = :doc"),
                    {"comm": target_community_id, "doc": doc_str}
                ).fetchone()

                if exist_comm:
                    db.session.execute(
                        text("""
                            UPDATE community_players SET full_name = :name, phone = :phone,
                                   email = :email, position = :pos, jersey_number = :jersey, player_id = :pid
                            WHERE id = :id
                        """),
                        {
                            "name": name_str, "phone": phone_str, "email": email_str,
                            "pos": pos_str, "jersey": jersey_num, "pid": player_id, "id": exist_comm[0]
                        }
                    )
                    updated += 1
                else:
                    db.session.execute(
                        text("""
                            INSERT INTO community_players (community_id, player_id, document_number, full_name, phone, email, position, jersey_number)
                            VALUES (:comm, :pid, :doc, :name, :phone, :email, :pos, :jersey)
                        """),
                        {
                            "comm": target_community_id, "pid": player_id, "doc": doc_str, "name": name_str,
                            "phone": phone_str, "email": email_str, "pos": pos_str, "jersey": jersey_num
                        }
                    )
                    imported += 1
            except Exception as e:
                errors.append({"row": row_num, "document": doc_str, "name": name_str, "error": str(e)})

    db.session.commit()
    return {
        "success": True,
        "total": total_rows,
        "imported": imported,
        "updated": updated,
        "errors": errors
    }

# Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# --- POSITIONS ---

@app.route('/api/<string:team_slug>/positions', methods=['GET'])
@app.route('/api/teams/<string:team_slug>/positions', methods=['GET'])
def get_positions(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    result = db.session.execute(text("SELECT id, name FROM positions WHERE team_id = :team"), {"team": team_id})
    positions = [{"id": row[0], "name": row[1]} for row in result]
    return jsonify(positions)

@app.route('/api/positions', methods=['GET'])
def get_positions_admin():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    result = db.session.execute(text("SELECT id, name FROM positions WHERE team_id = :team"), {"team": team_id})
    positions = [{"id": row[0], "name": row[1]} for row in result]
    return jsonify(positions)

@app.route('/api/positions', methods=['POST'])
def create_position():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    try:
        db.session.execute(text("INSERT INTO positions (team_id, name) VALUES (:team, :name)"), {"team": team_id, "name": name})
        db.session.commit()
        log_activity(team_id, "CREATE_POSITION", f"Created position: {name}")
        return jsonify({"message": "Position created"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route('/api/positions/<int:pos_id>', methods=['DELETE'])
def delete_position(pos_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        db.session.execute(text("DELETE FROM positions WHERE id = :id AND team_id = :team"), {"id": pos_id, "team": team_id})
        db.session.commit()
        log_activity(team_id, "DELETE_POSITION", f"Deleted position ID: {pos_id}")
        return jsonify({"message": "Position deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route('/api/positions/<int:pos_id>', methods=['PUT'])
def update_position(pos_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    try:
        db.session.execute(
            text("UPDATE positions SET name = :name WHERE id = :id AND team_id = :team"),
            {"name": name, "id": pos_id, "team": team_id}
        )
        db.session.commit()
        log_activity(team_id, "UPDATE_POSITION", f"Updated position ID {pos_id} to: {name}")
        return jsonify({"message": "Position updated"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# --- UNIFORM NUMBERS ---

@app.route('/api/<string:team_slug>/uniform-numbers/available', methods=['GET'])
@app.route('/api/teams/<string:team_slug>/uniform-numbers/available', methods=['GET'])
def get_available_numbers(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    result = db.session.execute(text("SELECT number FROM uniform_numbers WHERE team_id = :team AND is_available = TRUE ORDER BY number"), {"team": team_id})
    numbers = [row[0] for row in result]
    return jsonify(numbers)

@app.route('/api/uniform-numbers', methods=['GET'])
def get_all_numbers():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    result = db.session.execute(text("SELECT number, is_available FROM uniform_numbers WHERE team_id = :team ORDER BY number"), {"team": team_id})
    numbers = [{"number": row[0], "is_available": bool(row[1])} for row in result]
    return jsonify(numbers)

# --- PLAYERS ---

@app.route('/api/<string:team_slug>/players/check-document', methods=['POST'])
@app.route('/api/teams/<string:team_slug>/players/check-document', methods=['POST'])
def check_document(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    data = request.json or {}
    doc_number = data.get('document_number')
    if not doc_number:
        return jsonify({"error": "Document number is required"}), 400

    doc_str = str(doc_number).split('.')[0].strip()

    # 1. Regla de Torneo: Validar si ya está en otro equipo del mismo torneo
    conflict, conflict_msg = check_player_tournament_conflict(doc_str, team_id)
    if conflict:
        return jsonify({
            "status": "bloqueado_torneo",
            "message": conflict_msg
        }), 200

    # 2. Comprobar si ya está registrado en este mismo equipo
    result = db.session.execute(
        text("SELECT last_registration_date FROM players WHERE team_id = :team AND document_number = :doc"),
        {"team": team_id, "doc": doc_str}
    ).fetchone()

    if not result:
        # Buscar en la base global compartida si existe el jugador
        global_p = db.session.execute(
            text("""
                SELECT document_type, full_name, first_name, last_name, phone, email,
                       address, neighborhood, eps, birth_date, preferred_foot, blood_type,
                       nationality, photo_url, photo_cutout_url, position, primary_position_id
                FROM players
                WHERE document_number = :doc
                ORDER BY (photo_url IS NOT NULL) DESC, created_at DESC
                LIMIT 1
            """),
            {"doc": doc_str}
        ).fetchone()

        if global_p:
            fn = global_p[2] or ''
            ln = global_p[3] or ''
            full = global_p[1] or ''
            if not fn and not ln and full:
                parts = full.strip().split(' ')
                fn = parts[0]
                ln = ' '.join(parts[1:]) if len(parts) > 1 else ''

            player_dict = {
                "document_number": doc_str,
                "document_type": global_p[0] or 'Cédula de Ciudadanía',
                "full_name": full or (f"{fn} {ln}".strip()),
                "first_name": fn,
                "last_name": ln,
                "phone": global_p[4] or '',
                "email": global_p[5] or '',
                "address": global_p[6] or '',
                "neighborhood": global_p[7] or '',
                "eps": global_p[8] or '',
                "birth_date": global_p[9].strftime('%Y-%m-%d') if global_p[9] else '',
                "preferred_foot": global_p[10] or '',
                "blood_type": global_p[11] or '',
                "nationality": global_p[12] or '',
                "photo_url": global_p[13] or '',
                "photo_cutout_url": global_p[14] or '',
                "position": global_p[15] or '',
                "primary_position_id": global_p[16]
            }
            return jsonify({
                "status": "disponible_global",
                "message": "Jugador encontrado en la base de datos. Datos cargados automáticamente.",
                "player_data": player_dict
            }), 200

        return jsonify({"status": "disponible", "message": "Documento no registrado"}), 200

    last_reg = result[0]
    days_passed = (datetime.now() - last_reg).days

    if days_passed < 15:
        return jsonify({
            "status": "bloqueado",
            "days_remaining": 15 - days_passed,
            "message": f"Este documento ya está registrado en este equipo. Podrá registrarse nuevamente en {15 - days_passed} días"
        }), 200
    else:
        return jsonify({
            "status": "puede_re_registrar",
            "message": "Puede volver a registrarse y actualizar sus datos."
        }), 200

@app.route('/api/<string:team_slug>/players', methods=['POST'])
@app.route('/api/teams/<string:team_slug>/players', methods=['POST'])
def register_player(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    try:
        data = request.json or {}
        doc_num = data.get('document_number')
        if not doc_num:
            return jsonify({"error": "Número de documento es requerido"}), 400

        doc_str = str(doc_num).split('.')[0].strip()

        # Validar Regla de Torneo
        conflict, conflict_msg = check_player_tournament_conflict(doc_str, team_id)
        if conflict:
            return jsonify({"error": conflict_msg}), 400

        # 0. Sanitize and Extract
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        full_name = data.get('full_name')

        if (first_name or last_name):
            full_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
        elif full_name:
            parts = full_name.strip().split(' ')
            first_name = parts[0]
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
        else:
            full_name = 'Sin nombre'
            first_name = 'Sin nombre'
            last_name = ''

        doc_type = data.get('document_type') or 'Otro'
        unif_size = data.get('uniform_size') or 'M'

        primary_pos_id = sanitize_int(data.get('primary_position_id'))
        secondary_pos_id = sanitize_int(data.get('secondary_position_id'))
        uniform_num = sanitize_int(data.get('uniform_number'))

        payment_status = 'Pendiente'
        payment_amount = 0.0

        if not uniform_num or not primary_pos_id:
            return jsonify({"error": "Número de uniforme y posición principal son requeridos"}), 400

        # 1. Check existing in this team
        sql_check = "SELECT id, last_registration_date, uniform_number FROM players WHERE team_id = :team AND document_number = :doc"
        existing_row = db.session.execute(text(sql_check), {"team": team_id, "doc": doc_str}).fetchone()

        if existing_row:
            player_id = existing_row[0]
            last_reg = existing_row[1]
            old_uniform = existing_row[2]

            if (datetime.now() - last_reg).days < 15:
                days_left = 15 - (datetime.now() - last_reg).days
                return jsonify({"error": f"Bloqueado. Podrá registrarse en {days_left} días"}), 400

            curr_row = db.session.execute(text("SELECT * FROM players WHERE id = :id"), {"id": player_id}).fetchone()
            if curr_row:
                db.session.execute(
                    text("""INSERT INTO player_history 
                         (team_id, player_id, document_number, full_name, uniform_number, primary_position_id, secondary_position_id, payment_status, payment_amount, registered_date)
                         VALUES (:team, :pid, :doc, :name, :unif, :p1, :p2, :ps, :pa, :reg)"""),
                    {
                        "team": team_id, "pid": player_id, "doc": curr_row[3], "name": curr_row[4],
                        "unif": curr_row[10], "p1": curr_row[11], 
                        "p2": curr_row[12], "ps": curr_row[13], "pa": curr_row[14], "reg": curr_row[15]
                    }
                )

            if uniform_num != old_uniform:
                db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": old_uniform})

            db.session.execute(
                text("""UPDATE players SET 
                     document_type = :type, full_name = :name, first_name = :fn, last_name = :ln,
                     address = :addr, neighborhood = :barrio,
                     phone = :phone, eps = :eps, uniform_size = :size, uniform_number = :unif,
                     primary_position_id = :p1, secondary_position_id = :p2, 
                     last_registration_date = CURRENT_TIMESTAMP
                     WHERE id = :id AND team_id = :team"""),
                {
                    "type": doc_type, "name": full_name, "fn": first_name, "ln": last_name,
                    "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size, 
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "id": player_id, "team": team_id
                }
            )
        else:
            # Buscar en la base global si existe para heredar fotos y atributos del jugador
            global_p = db.session.execute(
                text("SELECT photo_url, photo_cutout_url, first_name, last_name, email, birth_date, preferred_foot, blood_type, nationality FROM players WHERE document_number = :doc AND photo_url IS NOT NULL LIMIT 1"),
                {"doc": doc_str}
            ).fetchone()

            photo_url = data.get('photo_url') or (global_p[0] if global_p else None)
            cutout_url = data.get('photo_cutout_url') or (global_p[1] if global_p else None)
            first_name = first_name or (global_p[2] if global_p else None)
            last_name = last_name or (global_p[3] if global_p else None)
            email = data.get('email') or (global_p[4] if global_p else None)
            birth_date = data.get('birth_date') or (global_p[5].strftime('%Y-%m-%d') if global_p and global_p[5] else None)
            foot = data.get('preferred_foot') or (global_p[6] if global_p else None)
            blood = data.get('blood_type') or (global_p[7] if global_p else None)
            nat = data.get('nationality') or (global_p[8] if global_p else None)

            res = db.session.execute(
                text("""INSERT INTO players
                     (team_id, document_type, document_number, full_name, address, neighborhood, phone, eps, uniform_size, uniform_number, primary_position_id, secondary_position_id, payment_status, payment_amount,
                      first_name, last_name, email, birth_date, preferred_foot, blood_type, nationality, photo_url, photo_cutout_url)
                     VALUES (:team, :type, :doc, :name, :addr, :barrio, :phone, :eps, :size, :unif, :p1, :p2, :ps, :pa,
                             :fn, :ln, :em, :bd, :ft, :bt, :nat, :ph, :co)"""),
                {
                    "team": team_id, "type": doc_type, "doc": doc_str, "name": full_name, "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size,
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "ps": payment_status, "pa": payment_amount,
                    "fn": first_name, "ln": last_name, "em": email, "bd": birth_date, "ft": foot, "bt": blood,
                    "nat": nat, "ph": photo_url, "co": cutout_url
                }
            )
            player_id = res.lastrowid

        db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": uniform_num})
        db.session.commit()
        log_activity(team_id, "REGISTER_PLAYER", f"Player {full_name} registered (Doc: {doc_str})")

        # Enviar correo de bienvenida al jugador si tiene email registrado
        try:
            target_email = data.get('email') or email
            if not target_email and player_id:
                row_mail = db.session.execute(text("SELECT email FROM players WHERE id = :id"), {"id": player_id}).fetchone()
                if row_mail and row_mail[0]:
                    target_email = row_mail[0]

            if target_email and '@' in str(target_email):
                t_row = db.session.execute(
                    text("""
                        SELECT t.name, t.logo_url, t.delegate_name, tr.name as tournament_name
                        FROM teams t
                        LEFT JOIN tournaments tr ON t.tournament_id = tr.id
                        WHERE t.id = :tid
                    """),
                    {"tid": team_id}
                ).fetchone()

                pos_name = "Sin definir"
                if primary_pos_id:
                    pos_row = db.session.execute(text("SELECT name FROM positions WHERE id = :pid"), {"pid": primary_pos_id}).fetchone()
                    if pos_row and pos_row[0]:
                        pos_name = pos_row[0]
                elif data.get('position'):
                    pos_name = data.get('position')

                if t_row:
                    send_player_welcome_email_async(
                        to_email=str(target_email).strip(),
                        player_name=full_name,
                        team_name=t_row[0],
                        uniform_number=uniform_num,
                        position_name=pos_name,
                        delegate_name=t_row[2],
                        team_logo_url=t_row[1],
                        tournament_name=t_row[3]
                    )
        except Exception as mail_err:
            print(f"⚠️ Error preparando correo de bienvenida al jugador: {mail_err}")

        return jsonify({"message": "Player registered successfully", "player_id": player_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/players', methods=['GET'])
def list_players():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    
    sql = """
        SELECT p.*, pos1.name as primary_pos_name, pos2.name as secondary_pos_name
        FROM players p
        JOIN positions pos1 ON p.primary_position_id = pos1.id
        LEFT JOIN positions pos2 ON p.secondary_position_id = pos2.id
        WHERE p.team_id = :team
        ORDER BY p.created_at DESC
    """
    result = db.session.execute(text(sql), {"team": team_id})
    columns = result.keys()
    players = [dict(zip(columns, row)) for row in result]
    return jsonify(players)

@app.route('/api/players/<int:p_id>', methods=['PUT'])
def update_player(p_id):
    team_id = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')
    
    data = request.json
    try:
        # Check if player exists and belongs to team
        curr = db.session.execute(text("SELECT team_id, uniform_number, full_name FROM players WHERE id = :id"), {"id": p_id}).fetchone()
        if not curr:
            return jsonify({"error": "Player not found"}), 404
        
        player_team_id = curr[0]
        if user_role == 'superadmin':
            effective_team_id = team_id or player_team_id
        else:
            if not team_id or str(player_team_id) != str(team_id):
                return jsonify({"error": "Unauthorized"}), 401
            effective_team_id = team_id
        
        old_uniform = curr[1]
        new_uniform = sanitize_int(data.get('uniform_number'))
        
        # Handle uniform change
        if new_uniform != old_uniform:
            # Check if new number is available
            avail = db.session.execute(
                text("SELECT is_available FROM uniform_numbers WHERE team_id = :team AND number = :n"),
                {"team": effective_team_id, "n": new_uniform}
            ).fetchone()
            if not avail or not avail[0]:
                return jsonify({"error": f"El número {new_uniform} no está disponible"}), 400
            
            # Swap
            db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE team_id = :team AND number = :n"), {"team": effective_team_id, "n": old_uniform})
            db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE team_id = :team AND number = :n"), {"team": effective_team_id, "n": new_uniform})

        # Full profile fields (Parte A): first/last name drive full_name when provided
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        if first_name or last_name:
            full_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
        else:
            full_name = data.get('full_name')

        # Update player data
        db.session.execute(
            text("""UPDATE players SET
                 document_type = :type, document_number = :doc, full_name = :name,
                 phone = :phone, eps = :eps, uniform_size = :size, uniform_number = :unif,
                 primary_position_id = :p1, secondary_position_id = :p2,
                 first_name = :first_name, last_name = :last_name, email = :email,
                 address = :address, birth_date = :birth_date, tertiary_position_id = :p3,
                 preferred_foot = :preferred_foot, blood_type = :blood_type, nationality = :nationality
                 WHERE id = :id AND team_id = :team"""),
            {
                "type": data.get('document_type'), "doc": data.get('document_number'),
                "name": full_name, "phone": data.get('phone'),
                "eps": data.get('eps'), "size": data.get('uniform_size'),
                "unif": new_uniform, "p1": sanitize_int(data.get('primary_position_id')),
                "p2": sanitize_int(data.get('secondary_position_id')),
                "first_name": first_name, "last_name": last_name, "email": data.get('email'),
                "address": data.get('address'), "birth_date": data.get('birth_date') or None,
                "p3": sanitize_int(data.get('tertiary_position_id')),
                "preferred_foot": data.get('preferred_foot'), "blood_type": data.get('blood_type'),
                "nationality": data.get('nationality'),
                "id": p_id, "team": effective_team_id
            }
        )

        db.session.commit()
        log_activity(effective_team_id, "EDIT_PLAYER", f"Information updated for player: {curr[2]} (ID: {p_id})")

        # Provision player self-service login (Parte F.2) — idempotent upsert, isolated
        # from the profile save above: username (document_number) is only guaranteed
        # unique per-team, while users.username is globally unique, so a rare cross-team
        # document collision must not roll back the player edit that already succeeded.
        doc_number = data.get('document_number')
        if doc_number:
            try:
                existing_user = db.session.execute(text("SELECT id FROM users WHERE player_id = :pid"), {"pid": p_id}).fetchone()
                if not existing_user:
                    hp = generate_password_hash(doc_number)
                    db.session.execute(
                        text("""INSERT INTO users (username, password_hash, role, team_id, player_id, must_change_password)
                             VALUES (:u, :hp, 'player', :team, :pid, 1)"""),
                        {"u": doc_number, "hp": hp, "team": effective_team_id, "pid": p_id}
                    )
                else:
                    db.session.execute(text("UPDATE users SET username = :u WHERE player_id = :pid"), {"u": doc_number, "pid": p_id})
                db.session.commit()
            except Exception as prov_err:
                db.session.rollback()
                print(f"⚠️ Could not provision player login for player {p_id}: {prov_err}")

        return jsonify({"message": "Player updated successfully"})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/players/<int:p_id>', methods=['DELETE'])
def delete_player(p_id):
    team_id = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')
    
    player = db.session.execute(text("SELECT team_id, uniform_number FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player:
        return jsonify({"error": "Player not found"}), 404
        
    player_team_id = player[0]
    if user_role == 'superadmin':
        effective_team_id = team_id or player_team_id
    else:
        if not team_id or str(player_team_id) != str(team_id):
            return jsonify({"error": "Unauthorized"}), 401
        effective_team_id = team_id

    unif = player[1]
    db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE team_id = :team AND number = :n"), {"team": effective_team_id, "n": unif})
    db.session.execute(text("DELETE FROM players WHERE id = :id AND team_id = :team"), {"id": p_id, "team": effective_team_id})
    db.session.commit()
    log_activity(effective_team_id, "DELETE_PLAYER", f"Deleted player ID: {p_id}")
    return jsonify({"message": "Player deleted"})

@app.route('/api/players/<int:p_id>/history', methods=['GET'])
def get_player_history(p_id):
    team_id = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')
    
    player = db.session.execute(text("SELECT team_id, document_number FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player: return jsonify({"error": "Player not found"}), 404
    
    player_team_id = player[0]
    if user_role == 'superadmin':
        effective_team_id = team_id or player_team_id
    else:
        if not team_id or str(player_team_id) != str(team_id):
            return jsonify({"error": "Unauthorized"}), 401
        effective_team_id = team_id
    
    result = db.session.execute(
        text("SELECT * FROM player_history WHERE team_id = :team AND document_number = :doc ORDER BY registered_date DESC"),
        {"team": effective_team_id, "doc": player[1]}
    )
    columns = result.keys()
    history = [dict(zip(columns, row)) for row in result]
    return jsonify(history)

CARD_DATA_SQL = """
    SELECT p.*,
       pos1.name as primary_position_name, pos2.name as secondary_position_name, pos3.name as tertiary_position_name,
       t.name as team_name, t.logo_url as team_logo,
       (SELECT COUNT(DISTINCT ml.match_id) FROM match_lineups ml WHERE ml.player_id = p.id) as matches_played,
       (SELECT COUNT(*) FROM match_events me WHERE me.player_id = p.id AND me.event_type = 'GOAL') as goals_total,
       (SELECT COUNT(*) FROM match_events me WHERE me.player_id = p.id AND me.event_type = 'YELLOW_CARD') as yellow_cards,
       (SELECT COUNT(*) FROM match_events me WHERE me.player_id = p.id AND me.event_type = 'RED_CARD') as red_cards,
       (SELECT AVG(rating) FROM player_match_ratings pmr WHERE pmr.player_id = p.id) as avg_rating
    FROM players p
    LEFT JOIN positions pos1 ON p.primary_position_id = pos1.id
    LEFT JOIN positions pos2 ON p.secondary_position_id = pos2.id
    LEFT JOIN positions pos3 ON p.tertiary_position_id = pos3.id
    LEFT JOIN teams t ON p.team_id = t.id
"""

def row_to_card_data(row, columns):
    r = dict(zip(columns, row))
    avg_rating = r.get('avg_rating')
    return {
        "id": r.get('id'),
        "full_name": r.get('full_name'), "first_name": r.get('first_name'), "last_name": r.get('last_name'),
        "uniform_number": r.get('uniform_number'), "document_number": r.get('document_number'),
        "phone": r.get('phone'), "email": r.get('email'), "address": r.get('address'),
        "birth_date": r.get('birth_date').isoformat() if r.get('birth_date') else None,
        "primary_position_name": r.get('primary_position_name'),
        "secondary_position_name": r.get('secondary_position_name'),
        "tertiary_position_name": r.get('tertiary_position_name'),
        "preferred_foot": r.get('preferred_foot'), "blood_type": r.get('blood_type'),
        "eps": r.get('eps'), "nationality": r.get('nationality'),
        "team_name": r.get('team_name'), "team_logo": r.get('team_logo'),
        "photo": r.get('photo_url'), "photo_cutout": r.get('photo_cutout_url') or r.get('photo_url'),
        "matches_played": r.get('matches_played') or 0,
        "goals_total": r.get('goals_total') or 0,
        "yellow_cards": r.get('yellow_cards') or 0,
        "red_cards": r.get('red_cards') or 0,
        "avg_rating": round(float(avg_rating), 1) if avg_rating is not None else None,
    }

@app.route('/api/players/<int:p_id>/card-data', methods=['GET'])
def get_player_card_data(p_id):
    team_id = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')

    if user_role == 'superadmin':
        player = db.session.execute(text("SELECT team_id FROM players WHERE id = :id"), {"id": p_id}).fetchone()
        if not player:
            return jsonify({"error": "Player not found"}), 404
        effective_team_id = team_id or player[0]
    else:
        if not team_id: return jsonify({"error": "Unauthorized"}), 401
        effective_team_id = team_id

    result = db.session.execute(text(CARD_DATA_SQL + " WHERE p.id = :id AND p.team_id = :team"), {"id": p_id, "team": effective_team_id})
    row = result.fetchone()
    if not row:
        return jsonify({"error": "Player not found"}), 404
    return jsonify(row_to_card_data(row, result.keys()))

@app.route('/api/teams/<int:team_id>/players/card-data', methods=['GET'])
def get_team_card_data(team_id):
    header_team = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')
    if user_role != 'superadmin' and (not header_team or str(header_team) != str(team_id)):
        return jsonify({"error": "Unauthorized"}), 401

    result = db.session.execute(text(CARD_DATA_SQL + " WHERE p.team_id = :team ORDER BY p.uniform_number ASC"), {"team": team_id})
    columns = result.keys()
    return jsonify([row_to_card_data(row, columns) for row in result.fetchall()])

@app.route('/api/players/<int:p_id>/payment', methods=['PATCH'])
def update_payment(p_id):
    team_id = request.headers.get('X-Team-ID')
    user_role = request.headers.get('X-User-Role')

    player = db.session.execute(text("SELECT team_id FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player: return jsonify({"error": "Player not found"}), 404
    
    player_team_id = player[0]
    if user_role == 'superadmin':
        effective_team_id = team_id or player_team_id
    else:
        if not team_id or str(player_team_id) != str(team_id):
            return jsonify({"error": "Unauthorized"}), 401
        effective_team_id = team_id

    try:
        data = request.json
        status = data.get('payment_status')
        amount = data.get('payment_amount')
        
        db.session.execute(
            text("UPDATE players SET payment_status = :status, payment_amount = :amount WHERE id = :id AND team_id = :team"),
            {"status": status, "amount": amount, "id": p_id, "team": effective_team_id}
        )
        db.session.commit()
        log_activity(effective_team_id, "UPDATE_PAYMENT", f"Updated payment for player ID {p_id} to {status} (${amount})")
        return jsonify({"message": "Payment updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- STATS & LOGS ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    
    total_players = db.session.execute(text("SELECT COUNT(*) FROM players WHERE team_id = :team"), {"team": team_id}).scalar()
    available_nums = db.session.execute(text("SELECT COUNT(*) FROM uniform_numbers WHERE team_id = :team AND is_available = TRUE"), {"team": team_id}).scalar()
    
    revenue_row = db.session.execute(text("SELECT COALESCE(SUM(payment_amount), 0) FROM players WHERE team_id = :team"), {"team": team_id}).fetchone()
    revenue = float(revenue_row[0]) if revenue_row else 0.0
    
    res_costs = db.session.execute(text("SELECT SUM(amount) FROM team_costs WHERE team_id = :team AND is_mandatory = 1"), {"team": team_id}).fetchone()
    total_fee_per_player = float(res_costs[0]) if res_costs and res_costs[0] else 0
    
    total_expected = total_players * total_fee_per_player
    total_pending = total_expected - revenue

    pos_stats_sql = """
        SELECT pos.name, COUNT(p.id) as count
        FROM positions pos
        LEFT JOIN players p ON pos.id = p.primary_position_id AND p.team_id = :team
        WHERE pos.team_id = :team
        GROUP BY pos.id
    """
    pos_stats = db.session.execute(text(pos_stats_sql), {"team": team_id})
    by_position = {row[0]: row[1] for row in pos_stats}
    
    return jsonify({
        "total_players": total_players, "available_numbers": available_nums,
        "total_revenue": revenue, "total_pending": total_pending, "total_expected": total_expected,
        "fees": {"total_mandatory": total_fee_per_player}, "players_by_position": by_position
    })

# --- TOURNAMENT ENGINE ---

@app.route('/api/tournaments', methods=['POST'])
def create_tournament():
    # Only superadmin can create tournaments
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
        
    slug = name.lower().replace(" ", "-") # Basic slug
    
    try:
        # 1. Create tournament
        result = db.session.execute(
            text("""INSERT INTO tournaments 
                 (name, slug, identification, representative_name, representative_phone, representative_address, 
                  city, description, image_url, rules_pdf_url, win_points, draw_points, loss_points, 
                  start_date, end_date, primary_color, secondary_color) 
                 VALUES (:n, :s, :iden, :rep_n, :rep_p, :rep_a, :city, :desc, :img, :pdf, :w, :d, :l, :sd, :ed, :pc, :sc)"""),
            {
                "n": name, "s": slug, 
                "iden": data.get('identification'),
                "rep_n": data.get('representative_name'),
                "rep_p": data.get('representative_phone'),
                "rep_a": data.get('representative_address'),
                "city": data.get('city'), 
                "desc": data.get('description'), "img": data.get('image_url'),
                "pdf": data.get('rules_pdf_url'),
                "w": data.get('win_points', 3), "d": data.get('draw_points', 1), "l": data.get('loss_points', 0),
                "sd": data.get('start_date'), "ed": data.get('end_date'),
                "pc": data.get('primary_color', '#38bdf8'),
                "sc": data.get('secondary_color', '#0ea5e9')
            }
        )
        t_id = result.lastrowid

        # 2. Create Tournament Admin User
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        if admin_user and admin_pass:
            # Clean up if user already exists (to avoid Duplicate Key error)
            db.session.execute(text("DELETE FROM users WHERE username = :u"), {"u": admin_user})
            
            pass_hash = generate_password_hash(admin_pass)
            db.session.execute(
                text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'tournament_admin', :tid)"),
                {"u": admin_user, "p": pass_hash, "tid": t_id}
            )

        db.session.commit()
        return jsonify({"message": "Tournament created successfully", "id": t_id}), 201
    except Exception as e:
        db.session.rollback()
        print(f"ERROR CREATING TOURNAMENT: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<int:t_id>', methods=['PUT'])
def update_tournament(t_id):
    data = request.json
    try:
        # Update tournament data
        db.session.execute(
            text("""UPDATE tournaments 
                 SET name = :n, identification = :iden, representative_name = :rep_n, 
                     representative_phone = :rep_p, representative_address = :rep_a,
                     city = :city, description = :desc, image_url = :img, rules_pdf_url = :pdf,
                     win_points = :w, draw_points = :d, loss_points = :l,
                     start_date = :sd, end_date = :ed,
                     primary_color = :pc, secondary_color = :sc
                 WHERE id = :id"""),
            {
                "id": t_id, 
                "n": data.get('name'), 
                "iden": data.get('identification'),
                "rep_n": data.get('representative_name'),
                "rep_p": data.get('representative_phone'),
                "rep_a": data.get('representative_address'),
                "city": data.get('city'), 
                "desc": data.get('description'), "img": data.get('image_url'),
                "pdf": data.get('rules_pdf_url'),
                "w": data.get('win_points'), "d": data.get('draw_points'), "l": data.get('loss_points'),
                "sd": data.get('start_date'), "ed": data.get('end_date'),
                "pc": data.get('primary_color'), "sc": data.get('secondary_color')
            }
        )

        # Update or create Admin User
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        if admin_user:
            # Check if this tournament already has an admin
            existing_user = db.session.execute(text("SELECT id FROM users WHERE tournament_id = :tid"), {"tid": t_id}).scalar()
            
            if existing_user:
                if admin_pass: # Only update password if provided
                    pass_hash = generate_password_hash(admin_pass)
                    db.session.execute(text("UPDATE users SET username = :u, password_hash = :p WHERE id = :uid"), {"u": admin_user, "p": pass_hash, "uid": existing_user})
                else: # Only update username
                    db.session.execute(text("UPDATE users SET username = :u WHERE id = :uid"), {"u": admin_user, "uid": existing_user})
            else:
                if admin_pass:
                    # Clean up if this username is already taken elsewhere to avoid collisions
                    db.session.execute(text("DELETE FROM users WHERE username = :u"), {"u": admin_user})
                    
                    pass_hash = generate_password_hash(admin_pass)
                    db.session.execute(
                        text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'tournament_admin', :tid)"),
                        {"u": admin_user, "p": pass_hash, "tid": t_id}
                    )

        db.session.commit()
        return jsonify({"message": "Tournament updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/lookup/<string:identification>', methods=['GET'])
def lookup_tournament_entity(identification):
    try:
        # Get the latest tournament data for this identification
        row = db.session.execute(
            text("""SELECT representative_name, representative_phone, representative_address, city 
                 FROM tournaments WHERE identification = :iden 
                 ORDER BY created_at DESC LIMIT 1"""),
            {"iden": identification}
        ).fetchone()
        
        if row:
            return jsonify({
                "representative_name": row[0],
                "representative_phone": row[1],
                "representative_address": row[2],
                "city": row[3]
            }), 200
        return jsonify({"message": "No data found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments', methods=['GET'])
def list_tournaments():
    sql = """
        SELECT t.*, u.username as admin_username 
        FROM tournaments t 
        LEFT JOIN users u ON t.id = u.tournament_id AND u.role = 'tournament_admin'
        ORDER BY t.created_at DESC
    """
    result = db.session.execute(text(sql))
    columns = result.keys()
    tournaments = [dict(zip(columns, row)) for row in result]
    return jsonify(tournaments)

@app.route('/api/teams/<int:t_id>/tournament', methods=['PUT'])
def assign_team_to_tournament(t_id):
    # Security: Only superadmin or owner (simplified check for now)
    data = request.json
    tournament_id = data.get('tournament_id')
    try:
        db.session.execute(
            text("UPDATE teams SET tournament_id = :tid WHERE id = :id"),
            {"tid": tournament_id, "id": t_id}
        )
        db.session.commit()
        return jsonify({"message": "Team assigned to tournament"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/teams/<int:team_id>/players', methods=['GET'])
def get_team_players(team_id):
    try:
        sql = """
            SELECT p.*, pos1.name as primary_pos_name
            FROM players p
            LEFT JOIN positions pos1 ON p.primary_position_id = pos1.id
            WHERE p.team_id = :t
            ORDER BY p.id ASC
        """
        res = db.session.execute(text(sql), {"t": team_id})
        columns = res.keys()
        players = []
        for r in res:
            p_dict = dict(zip(columns, r))
            p_dict["uniform_number"] = p_dict.get("uniform_number") or '-'
            p_dict["position"] = p_dict.get("primary_pos_name") or p_dict.get("position") or '-'
            players.append(p_dict)
        return jsonify(players), 200
    except Exception as e:
        print(f"WARN GET_TEAM_PLAYERS JOIN query failed ({e}), falling back...")
        try:
            res_fb = db.session.execute(text("SELECT * FROM players WHERE team_id = :t"), {"t": team_id})
            columns = res_fb.keys()
            players_fb = []
            for r in res_fb:
                p_dict = dict(zip(columns, r))
                p_dict["uniform_number"] = p_dict.get("uniform_number") or '-'
                p_dict["position"] = p_dict.get("position") or '-'
                players_fb.append(p_dict)
            return jsonify(players_fb), 200
        except Exception as e2:
            print(f"FATAL ERROR GET_TEAM_PLAYERS: {e2}")
            return jsonify([]), 200

@app.route('/api/tournaments/<string:slug>', methods=['GET'])
def get_tournament(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    row = db.session.execute(
        text("SELECT id, name, slug, city, description, image_url, rules_pdf_url, win_points, draw_points, loss_points, format_type, primary_color, secondary_color FROM tournaments WHERE id = :id"),
        {"id": t_id}
    ).fetchone()
    
    if (row):
        cols = ['id', 'name', 'slug', 'city', 'description', 'image_url', 'rules_pdf_url', 'win_points', 'draw_points', 'loss_points', 'format_type', 'primary_color', 'secondary_color']
        return jsonify(dict(zip(cols, row)))
    return jsonify({"error": "Data not found"}), 404

# --- FIELDS ROUTES ---
@app.route('/api/referees', methods=['GET'])
def get_referees():
    try:
        # Global query: ignore tournament context
        result = db.session.execute(text("SELECT id, full_name, phone, address, document_number FROM referees")).fetchall()
        referees = [{"id": row.id, "full_name": row.full_name, "phone": row.phone, "address": row.address, "document_number": row.document_number} for row in result]
        return jsonify(referees), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fields', methods=['GET'])
def get_fields():
    try:
        result = db.session.execute(text("SELECT id, name, address FROM fields")).fetchall()
        fields = [{"id": row.id, "name": row.name, "address": row.address} for row in result]
        return jsonify(fields), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fields', methods=['POST'])
def create_field():
    data = request.json
    try:
        db.session.execute(text(
            "INSERT INTO fields (name, address) VALUES (:name, :address)"
        ), {"name": data['name'], "address": data.get('address', '')})
        db.session.commit()
        return jsonify({"message": "Field created"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/fields/<int:field_id>', methods=['PUT'])
def update_field(field_id):
    data = request.json
    try:
        db.session.execute(text(
            "UPDATE fields SET name = :name, address = :address WHERE id = :id"
        ), {"name": data['name'], "address": data.get('address', ''), "id": field_id})
        db.session.commit()
        return jsonify({"message": "Field updated"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<string:slug>/stats', methods=['GET'])
def get_tournament_stats(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    # Standings are already calculated in get_tournament_phases, but let's provide a summary
    # Scorers, Fairplay, etc. will need data from match_events table (to be implemented)
    return jsonify({"message": "Stats summarized"}), 200

# --- TOURNAMENT WIZARD ---

@app.route('/api/tournaments/<int:t_id>/wizard-config', methods=['POST'])
def save_wizard_config(t_id):
    data = request.json
    try:
        # 1. Update tournament config JSON
        import json
        db.session.execute(
            text("UPDATE tournaments SET config = :config WHERE id = :tid"),
            {"config": json.dumps(data), "tid": t_id}
        )
        
        # 2. Dynamic Phase Generation
        # Advancement Mode Logic
        if data.get("advancement_mode") == "multi_cup":
            for cup in data.get("cups", []):
                # Check if phase already exists
                exists = db.session.execute(
                    text("SELECT id FROM tournament_phases WHERE tournament_id = :tid AND name = :name"),
                    {"tid": t_id, "name": cup["name"]}
                ).fetchone()
                
                if not exists:
                    # Create Knockout Phase for this cup
                    res = db.session.execute(
                        text("INSERT INTO tournament_phases (tournament_id, name, phase_order, phase_type) VALUES (:tid, :name, 2, 'KNOCKOUT')"),
                        {"tid": t_id, "name": cup["name"]}
                    )
                    phase_id = res.lastrowid
                    
                    # Create a default group for this knockout phase
                    db.session.execute(
                        text("INSERT INTO tournament_groups (phase_id, name) VALUES (:pid, 'Llave Principal')"),
                        {"pid": phase_id}
                    )
        
        elif data.get("advancement_mode") == "single_knockout":
            name = "Fase Final"
            exists = db.session.execute(
                text("SELECT id FROM tournament_phases WHERE tournament_id = :tid AND name = :name"),
                {"tid": t_id, "name": name}
            ).fetchone()
            
            if not exists:
                res = db.session.execute(
                    text("INSERT INTO tournament_phases (tournament_id, name, phase_order, phase_type) VALUES (:tid, :name, 2, 'KNOCKOUT')"),
                    {"tid": t_id, "name": name}
                )
                phase_id = res.lastrowid
                db.session.execute(
                    text("INSERT INTO tournament_groups (phase_id, name) VALUES (:pid, 'Llave Única')"),
                    {"pid": phase_id}
                )
        
        db.session.commit()
        
        # 3. Handle Auto-Start (Group Drawing and Match Generation)
        if data.get("auto_start"):
            # Get phase 1 (usually the first one or named 'Fase de Grupos')
            p1 = db.session.execute(
                text("SELECT id FROM tournament_phases WHERE tournament_id = :tid ORDER BY phase_order ASC LIMIT 1"),
                {"tid": t_id}
            ).fetchone()
            
            if p1:
                # 1. Create the groups
                group_ids = []
                for i in range(data.get("group_count", 1)):
                    res = db.session.execute(
                        text("INSERT INTO tournament_groups (phase_id, name) VALUES (:pid, :name)"),
                        {"pid": p1[0], "name": f"Grupo {chr(65+i)}"}
                    )
                    group_ids.append(res.lastrowid)
                
                # 2. Get registered teams
                res = db.session.execute(
                    text("SELECT id, name FROM teams WHERE tournament_id = :tid"),
                    {"tid": t_id}
                )
                teams = [{"id": row[0], "name": row[1]} for row in res.fetchall()]
                
                # 3. Distribute teams
                if teams and group_ids:
                    distribution = tournament_engine.distribute_teams_to_groups(teams, group_ids)
                    
                    for gid, g_teams in distribution.items():
                        for team in g_teams:
                            db.session.execute(
                                text("INSERT INTO group_teams (group_id, team_id) VALUES (:gid, :tid)"),
                                {"gid": gid, "tid": team['id']}
                            )
                        
                        # 4. Generate Round Robin Matches
                        matches = tournament_engine.generate_round_robin(gid, g_teams)
                        for m in matches:
                            db.session.execute(
                                text("""
                                    INSERT INTO matches (tournament_id, phase_id, group_id, round, home_team_id, away_team_id, status)
                                    VALUES (:tid, :pid, :gid, :rnd, :home, :away, 'PENDING')
                                """),
                                {
                                    "tid": t_id, "pid": p1[0], "gid": gid, 
                                    "rnd": m['round'], "home": m['home_team_id'], "away": m['away_team_id']
                                }
                            )
                
                db.session.commit()

        return jsonify({"message": "Torneo configurado y proceso de inicio completado", "status": "success"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"WIZARD ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<int:t_id>/advance', methods=['POST'])
def run_tournament_advance(t_id):
    # This endpoint would trigger the actual team advancement logic
    # using tournament_engine.advance_teams(...)
    
    # 1. Get current standings (to have the source teams)
    # 2. Get config from DB
    # 3. Call enhancement
    # 4. Create groups/teams in the new phases
    return jsonify({"message": "Advancement processed"}), 200
    # For now, let's return a structured placeholder
    return jsonify({
        "standings": [], # Derived from group_teams
        "scorers": [],    # To be implemented with match_events
        "fairplay": [],   # To be implemented with match_events
        "defense": []     # To be implemented with group_teams ga
    })

# --- REFEREES ---

@app.route('/api/referees', methods=['GET'])
def list_referees():
    t_id = request.headers.get('X-Tournament-ID')
    if not t_id: return jsonify({"error": "Unauthorized"}), 401
    
    result = db.session.execute(text("SELECT * FROM referees WHERE tournament_id = :tid"), {"tid": t_id})
    columns = result.keys()
    referees = [dict(zip(columns, row)) for row in result]
    return jsonify(referees)

@app.route('/api/referees', methods=['POST'])
def create_referee():
    t_id = request.headers.get('X-Tournament-ID')
    if not t_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    try:
        db.session.execute(
            text("""INSERT INTO referees (tournament_id, document_number, full_name, age, phone, address) 
                 VALUES (:tid, :doc, :name, :age, :phone, :addr)"""),
            {
                "tid": t_id, "doc": data.get('document_number'), "name": data.get('full_name'),
                "age": data.get('age'), "phone": data.get('phone'), "addr": data.get('address')
            }
        )
        db.session.commit()
        return jsonify({"message": "Referee created"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/referees/<int:r_id>', methods=['DELETE'])
def delete_referee(r_id):
    t_id = request.headers.get('X-Tournament-ID')
    if not t_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        db.session.execute(text("DELETE FROM referees WHERE id = :id AND tournament_id = :tid"), {"id": r_id, "tid": t_id})
        db.session.commit()
        return jsonify({"message": "Referee deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<string:slug>/toggle-registration', methods=['POST'])
def toggle_tournament_registration(slug):
    try:
        tournament = db.session.execute(text("SELECT registration_open FROM tournaments WHERE slug = :s"), {"s": slug}).fetchone()
        if not tournament:
            return jsonify({"error": "Tournament not found"}), 404
            
        new_status = not tournament[0]
        db.session.execute(text("UPDATE tournaments SET registration_open = :st WHERE slug = :s"), {"st": new_status, "s": slug})
        db.session.commit()
        return jsonify({"registration_open": new_status, "message": "Estatus actualizado"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<string:slug>/status', methods=['GET'])
def get_tournament_status(slug):
    res = db.session.execute(text("SELECT registration_open FROM tournaments WHERE slug = :s"), {"s": slug}).fetchone()
    if res:
        return jsonify({"registration_open": res[0]})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/tournaments/<string:slug>/scorers', methods=['GET'])
def get_tournament_scorers(slug):
    t_id = request.headers.get('X-Tournament-ID') if slug == 'current' else get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    sql = """
        SELECT p.full_name, t.name as team_name, COUNT(me.id) as goals
        FROM match_events me
        JOIN players p ON me.player_id = p.id
        JOIN teams t ON p.team_id = t.id
        WHERE t.tournament_id = :tid AND me.event_type = 'gol'
        GROUP BY p.id
        ORDER BY goals DESC
        LIMIT 20
    """
    result = db.session.execute(text(sql), {"tid": t_id})
    scorers = [{"name": row[0], "team": row[1], "goals": row[2]} for row in result]
    return jsonify(scorers)

@app.route('/api/tournaments/<string:slug>/teams', methods=['GET'])
def get_tournament_teams(slug):
    t_id = request.headers.get('X-Tournament-ID') if slug == 'current' else get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    sql = """
        SELECT t.id, t.name, t.slug, u.username
        FROM teams t
        LEFT JOIN users u ON t.id = u.team_id AND u.role = 'admin'
        WHERE t.tournament_id = :tid
    """
    result = db.session.execute(text(sql), {"tid": t_id})
    teams = [{"id": row[0], "name": row[1], "slug": row[2], "admin_username": row[3]} for row in result]
    return jsonify(teams)
@app.route('/api/tournaments/<string:slug>/fixtures', methods=['GET'])
def get_tournament_fixtures(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    sql = """
        SELECT m.id, m.status, m.match_date, m.actual_start,
               h.name as home_name, a.name as away_name, m.home_score, m.away_score,
               m.location, m.referee as referee_name, m.veedor_id, u.username as veedor_name
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        LEFT JOIN users u ON m.veedor_id = u.id
        WHERE m.tournament_id = :id
        ORDER BY m.match_date ASC
    """
    result = db.session.execute(text(sql), {"id": t_id}).fetchall()
    fixtures = []
    for row in result:
        fixtures.append({
            "id": row.id, "status": row.status, 
            "match_date": row.match_date.isoformat() if row.match_date else None,
            "actual_start": row.actual_start.isoformat() if row.actual_start else None,
            "home_team": row.home_name, "away_team": row.away_name,
            "home_score": row.home_score, "away_score": row.away_score,
            "location": row.location, "referee_name": row.referee_name,
            "veedor_id": row.veedor_id, "veedor_name": row.veedor_name
        })
    return jsonify(fixtures)


@app.route('/api/tournaments/<string:slug>/stats', methods=['GET'])
def get_tournament_stats_summary(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    # 1. Total teams
    total_teams = db.session.execute(text("SELECT COUNT(*) FROM teams WHERE tournament_id = :tid"), {"tid": t_id}).scalar()
    
    # 2. Total goals
    total_goals = db.session.execute(text("SELECT SUM(home_score + away_score) FROM matches WHERE tournament_id = :tid"), {"tid": t_id}).scalar() or 0
    
    # 3. Finished matches
    finished_matches = db.session.execute(text("SELECT COUNT(*) FROM matches WHERE tournament_id = :tid AND status = 'COMPLETED'"), {"tid": t_id}).scalar()
    
    # 4. Total cards
    total_cards = db.session.execute(text("SELECT COUNT(*) FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = :tid) AND event_type IN ('YELLOW_CARD', 'RED_CARD')"), {"tid": t_id}).scalar() or 0
    
    return jsonify({
        "total_teams": total_teams,
        "total_goals": int(total_goals),
        "finished_matches": finished_matches,
        "total_cards": total_cards
    })

# --- VEEDOR ROUTES ---

@app.route('/api/veedor/matches', methods=['GET'])
def get_veedor_matches():
    # Only show matches for the tournament this veedor is assigned to
    t_id = request.headers.get('X-Tournament-ID')
    if not t_id: return jsonify({"error": "No tournament context"}), 400
    
    u_id = request.headers.get('X-User-ID')
    
    sql = """
        SELECT m.id, m.match_date, m.actual_start, h.name as home, a.name as away, m.status, m.home_score, m.away_score, m.location, m.home_team_id, m.away_team_id,
               v.username as veedor_name
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        LEFT JOIN users v ON m.veedor_id = v.id
        WHERE m.tournament_id = :tid
    """
    params = {"tid": t_id}
    if u_id:
        sql += " AND m.veedor_id = :uid"
        params["uid"] = u_id
    
    sql += " ORDER BY m.match_date ASC"
    result = db.session.execute(text(sql), params).fetchall()
    matches = []
    for r in result:
        matches.append({
            "id": r.id, 
            "date": r.match_date.isoformat() if r.match_date else None,
            "actual_start": r.actual_start.isoformat() if r.actual_start else None,
            "home": r.home, "away": r.away, "status": r.status,
            "home_score": r.home_score, "away_score": r.away_score, "location": r.location,
            "home_id": r.home_team_id, "away_id": r.away_team_id,
            "veedor": r.veedor_name if hasattr(r, 'veedor_name') else None
        })
    return jsonify(matches)

@app.route('/api/matches/<int:match_id>/start', methods=['POST'])
def start_match(match_id):
    try:
        db.session.execute(
            text("UPDATE matches SET status = 'IN_PROGRESS', actual_start = NOW() WHERE id = :id"),
            {"id": match_id}
        )
        db.session.commit()
        return jsonify({"message": "Match started", "actual_start": datetime.now().isoformat()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/matches/<int:match_id>/events', methods=['GET', 'POST'])
def handle_match_events(match_id):
    if request.method == 'GET':
        sql = """
            SELECT e.id, e.event_type, e.event_minute, e.team_id, e.player_id, e.related_player_id,
                   p.full_name as player_name, p2.full_name as related_player_name
            FROM match_events e
            LEFT JOIN players p ON e.player_id = p.id
            LEFT JOIN players p2 ON e.related_player_id = p2.id
            WHERE e.match_id = :mid
            ORDER BY e.event_minute ASC, e.created_at ASC
        """
        result = db.session.execute(text(sql), {"mid": match_id}).fetchall()
        events = []
        for r in result:
            events.append({
                "id": r[0], "type": r[1], "minute": r[2], "team_id": r[3],
                "player_id": r[4], "related_player_id": r[5],
                "player_name": r[6], "related_player_name": r[7]
            })
        return jsonify(events)
    
    # POST
    data = request.json
    try:
        # Calculate minute automatically if not provided
        minute = data.get('minute')
        if minute is None:
            match = db.session.execute(text("SELECT actual_start FROM matches WHERE id = :id"), {"id": match_id}).fetchone()
            if match and match[0]:
                diff = datetime.now() - match[0]
                minute = int(diff.total_seconds() / 60)
            else:
                minute = 0

        # Ensure numeric values are valid (handle empty strings from frontend)
        tid = data.get('team_id')
        pid = data.get('player_id')
        rpid = data.get('related_player_id')
        
        tid = int(tid) if tid and str(tid).isdigit() else None
        pid = int(pid) if pid and str(pid).isdigit() else None
        rpid = int(rpid) if rpid and str(rpid).isdigit() else None

        db.session.execute(
            text("INSERT INTO match_events (match_id, team_id, player_id, related_player_id, event_type, event_minute) "
                 "VALUES (:mid, :tid, :pid, :rpid, :type, :min)"),
            {
                "mid": match_id, "tid": tid, "pid": pid, "rpid": rpid,
                "type": data.get('type'), "min": minute
            }
        )

        # If it's a goal, update matches table score
        if data.get('type') == 'GOAL' and tid:
            # Identify which team scored
            m = db.session.execute(text("SELECT home_team_id, away_team_id FROM matches WHERE id = :id"), {"id": match_id}).fetchone()
            if m:
                if tid == m[0]:
                    db.session.execute(text("UPDATE matches SET home_score = home_score + 1 WHERE id = :id"), {"id": match_id})
                else:
                    db.session.execute(text("UPDATE matches SET away_score = away_score + 1 WHERE id = :id"), {"id": match_id})

        db.session.commit()
        return jsonify({"message": "Event recorded", "minute": minute}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/matches/<int:match_id>/ratings', methods=['GET', 'POST'])
def handle_match_ratings(match_id):
    if request.method == 'GET':
        result = db.session.execute(
            text("SELECT player_id, team_id, rating FROM player_match_ratings WHERE match_id = :mid"),
            {"mid": match_id}
        ).fetchall()
        return jsonify([{"player_id": r[0], "team_id": r[1], "rating": float(r[2]) if r[2] is not None else None} for r in result])

    # POST — bulk upsert
    data = request.json or {}
    ratings = data.get('ratings', [])
    try:
        for r in ratings:
            player_id = sanitize_int(r.get('player_id'))
            team_id = sanitize_int(r.get('team_id'))
            rating = r.get('rating')
            if not player_id or rating in (None, ''):
                continue
            db.session.execute(
                text("""INSERT INTO player_match_ratings (match_id, player_id, team_id, rating)
                     VALUES (:mid, :pid, :tid, :rating)
                     ON DUPLICATE KEY UPDATE rating = VALUES(rating), team_id = VALUES(team_id)"""),
                {"mid": match_id, "pid": player_id, "tid": team_id, "rating": rating}
            )
        db.session.commit()
        return jsonify({"message": "Ratings saved"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/tournaments/<slug>/standings', methods=['GET'])
def api_get_tournament_standings(slug):
    tournament = db.session.execute(text("SELECT id, win_points, draw_points, loss_points FROM tournaments WHERE slug = :slug"), {"slug": slug}).fetchone()
    if not tournament: return jsonify({"error": "Tournament not found"}), 404
    t_id, w_pts, d_pts, l_pts = tournament
    
    # Defaults in case DB values are NULL
    w_pts = w_pts if w_pts is not None else 3
    d_pts = d_pts if d_pts is not None else 1
    l_pts = l_pts if l_pts is not None else 0

    # Get all groups and their teams
    groups_res = db.session.execute(text("""
        SELECT tg.id as group_id, tg.name as group_name, gt.team_id, t.name as team_name
        FROM tournament_groups tg
        JOIN group_teams gt ON tg.id = gt.group_id
        JOIN teams t ON gt.team_id = t.id
        WHERE tg.tournament_id = :tid
    """), {"tid": t_id}).fetchall()

    matches_res = db.session.execute(text("""
        SELECT home_team_id, away_team_id, home_score, away_score, status, group_id
        FROM matches
        WHERE tournament_id = :tid AND status = 'COMPLETED'
    """), {"tid": t_id}).fetchall()

    standings = {} # {group_id: {group_name: "", teams: {team_id: stats}}}

    # Initialize stats for all teams by group
    for r in groups_res:
        gid, gname, tid_val, tname = r
        if gid not in standings:
            standings[gid] = {"name": gname, "teams": {}}
        standings[gid]["teams"][tid_val] = {
            "name": tname, "pj": 0, "pg": 0, "pe": 0, "pp": 0,
            "gf": 0, "gc": 0, "dif": 0, "pts": 0
        }

    # Process matches
    for m in matches_res:
        home_id, away_id, hscore, ascore, status, gid = m
        if gid not in standings: continue
        
        # Home stats
        if home_id in standings[gid]["teams"]:
            s = standings[gid]["teams"][home_id]
            s["pj"] += 1
            s["gf"] += hscore
            s["gc"] += ascore
            if hscore > ascore:
                s["pg"] += 1
                s["pts"] += w_pts
            elif hscore == ascore:
                s["pe"] += 1
                s["pts"] += d_pts
            else:
                s["pp"] += 1
                s["pts"] += l_pts

        # Away stats
        if away_id in standings[gid]["teams"]:
            s = standings[gid]["teams"][away_id]
            s["pj"] += 1
            s["gf"] += ascore
            s["gc"] += hscore
            if ascore > hscore:
                s["pg"] += 1
                s["pts"] += w_pts
            elif ascore == hscore:
                s["pe"] += 1
                s["pts"] += d_pts
            else:
                s["pp"] += 1
                s["pts"] += l_pts

    # Cleanup and Sort
    final_output = []
    for gid, data in standings.items():
        teams_list = []
        for tid_val, s in data["teams"].items():
            s["dif"] = s["gf"] - s["gc"]
            s["id"] = tid_val
            teams_list.append(s)
        
        # Sort by Points, then Diff, then Goals For
        teams_list.sort(key=lambda x: (x["pts"], x["dif"], x["gf"]), reverse=True)
        final_output.append({
            "id": gid,
            "name": data["name"],
            "teams": teams_list
        })

    return jsonify(final_output)

@app.route('/api/tournaments/<int:t_id>/veedores', methods=['GET', 'POST'])
def handle_tournament_veedores(t_id):
    if request.method == 'GET':
        sql = "SELECT id, username FROM users WHERE role = 'veedor' AND tournament_id = :tid"
        result = db.session.execute(text(sql), {"tid": t_id}).fetchall()
        veedores = [{"id": r[0], "username": r[1]} for r in result]
        return jsonify(veedores)
    
    # POST - Create new veedor
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    
    # Force prefix vdr_
    if not username.startswith('vdr_'):
        username = f"vdr_{username}"

    try:
        from werkzeug.security import generate_password_hash
        hashed_pw = generate_password_hash(password)

        # Check if exists
        exists = db.session.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username}).fetchone()
        if exists:
            return jsonify({"error": f"El usuario '{username}' ya existe. Por favor elige otro."}), 400

        db.session.execute(
            text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'veedor', :tid)"),
            {"u": username, "p": hashed_pw, "tid": t_id}
        )
        db.session.commit()
        return jsonify({"message": "Veedor creado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    # For safety, ensure we only delete veedores or specific roles
    # For now, tournament admin can delete their own veedores
    t_id_header = request.headers.get('X-Tournament-ID')
    if not t_id_header:
        # If no tournament header, check if caller is superadmin (simplified check)
        t_id_header = None
    
    try:
        # Verify user belongs to this tournament if not superadmin
        if t_id_header:
            check = db.session.execute(text("SELECT id FROM users WHERE id = :uid AND tournament_id = :tid"), {"uid": user_id, "tid": t_id_header}).fetchone()
            if not check:
                return jsonify({"error": "Unauthorised or user not found in this tournament"}), 403

        db.session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        db.session.commit()
        return jsonify({"message": "Usuario eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/matches/<int:match_id>/assign-veedor', methods=['POST'])
def assign_veedor(match_id):
    data = request.json or {}
    veedor_id = data.get('veedor_id')
    try:
        db.session.execute(text("UPDATE matches SET veedor_id = :vid WHERE id = :mid"), {"vid": veedor_id, "mid": match_id})
        db.session.commit()
        return jsonify({"message": "Veedor assigned successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/matches/<int:match_id>/lineup', methods=['GET', 'POST'])
def manage_match_lineup(match_id):
    if request.method == 'GET':
        res = db.session.execute(text("SELECT player_id FROM match_lineups WHERE match_id = :mid"), {"mid": match_id}).fetchall()
        return jsonify([r[0] for r in res])
        
    data = request.json # List of player IDs
    try:
        # Clear previous lineup if any
        db.session.execute(text("DELETE FROM match_lineups WHERE match_id = :mid"), {"mid": match_id})
        for p_id in data.get('player_ids', []):
            db.session.execute(text(
                "INSERT INTO match_lineups (match_id, player_id) VALUES (:mid, :pid)"
            ), {"mid": match_id, "pid": p_id})
        db.session.commit()
        return jsonify({"message": "Lineup saved"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/veedor-setup', methods=['POST'])
def create_veedor():
    data = request.json or {}
    try:
        from werkzeug.security import generate_password_hash
        username = data.get('username')
        password = data.get('password', '123456')
        tournament_id = data.get('tournament_id')
        
        if not username:
            return jsonify({"error": "Username required"}), 400
            
        hashed_pw = generate_password_hash(password)
        
        # Primero intentar borrar si ya existe para evitar duplicidades
        db.session.execute(text("DELETE FROM users WHERE username = :u"), {"u": username})
        
        # Insertar limpio
        db.session.execute(
            text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'veedor', :tid)"),
            {"u": username, "p": hashed_pw, "tid": tournament_id}
        )
        
        db.session.commit()
        return jsonify({"message": "Veedor account ready"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL ERROR CALLING veedor-setup: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<int:t_id>/import-matches', methods=['POST'])
def import_matches(t_id):
    import pandas as pd
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        # Read the file (CSV or Excel)
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)

        # Standardize columns to lowercase
        df.columns = [c.lower().strip() for c in df.columns]
        
        required = ['fecha', 'local', 'visitante']
        for col in required:
            if col not in df.columns:
                return jsonify({"error": f"Falta la columna obligatoria: {col}"}), 400

        added_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                # 1. Find Teams
                home_name = str(row['local']).strip()
                away_name = str(row['visitante']).strip()
                
                home_id = db.session.execute(text("SELECT id FROM teams WHERE name LIKE :n AND tournament_id = :tid"), {"n": f"%{home_name}%", "tid": t_id}).scalar()
                away_id = db.session.execute(text("SELECT id FROM teams WHERE name LIKE :n AND tournament_id = :tid"), {"n": f"%{away_name}%", "tid": t_id}).scalar()
                
                if not home_id or not away_id:
                    errors.append(f"Fila {index+2}: Equipo no encontrado ({home_name if not home_id else away_name})")
                    continue

                # 2. Find Field (optional)
                field_id = None
                location = str(row.get('campo', 'TBD')).strip()
                if 'campo' in row and pd.notna(row['campo']):
                    fn = str(row['campo']).strip()
                    field_id = db.session.execute(text("SELECT id FROM fields WHERE name LIKE :n"), {"n": f"%{fn}%"}).scalar()

                # 3. Find Referee (optional)
                ref_id = None
                if 'arbitro' in row and pd.notna(row['arbitro']):
                    rn = str(row['arbitro']).strip()
                    ref_id = db.session.execute(text("SELECT id FROM referees WHERE full_name LIKE :n"), {"n": f"%{rn}%"}).scalar()

                # 4. Insert Match
                db.session.execute(
                    text("""INSERT INTO matches (tournament_id, match_date, home_team_id, away_team_id, referee_id, location, status) 
                         VALUES (:tid, :date, :h, :a, :rid, :loc, 'SCHEDULED')"""),
                    {
                        "tid": t_id, "date": row['fecha'], "h": home_id, "a": away_id, 
                        "rid": ref_id, "loc": location
                    }
                )
                added_count += 1
            except Exception as row_err:
                errors.append(f"Fila {index+2}: {str(row_err)}")

        db.session.commit()
        return jsonify({
            "message": f"Se cargaron {added_count} partidos con éxito.",
            "errors": errors
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error procesando archivo: {str(e)}"}), 500

@app.route('/api/tournaments/<string:slug>/phases', methods=['GET'])
def get_tournament_phases(slug):
    if slug == 'undefined' or slug == 'current':
        t_id_header = request.headers.get('X-Tournament-ID')
        if not t_id_header: return jsonify({"error": "No tournament specified"}), 400
        t_id = int(t_id_header)
    else:
        t_id = get_tournament_id_from_slug(slug)
        if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    phases_result = db.session.execute(text(
        "SELECT id, name, phase_order, phase_type, status, is_double_round FROM tournament_phases WHERE tournament_id = :id ORDER BY phase_order ASC"
    ), {"id": t_id}).fetchall()
    
    phases = []
    for p in phases_result:
        p_id = p[0]
        # Get groups for this phase
        groups_result = db.session.execute(text(
            "SELECT id, name FROM tournament_groups WHERE phase_id = :pid"
        ), {"pid": p_id}).fetchall()
        
        groups = []
        for g in groups_result:
            g_id = g[0]
            teams_res = db.session.execute(text(
                "SELECT t.id, t.name, gt.points, gt.goals_for, gt.goals_against, gt.matches_played "
                "FROM group_teams gt JOIN teams t ON gt.team_id = t.id WHERE gt.group_id = :gid ORDER BY gt.points DESC, (gt.goals_for - gt.goals_against) DESC"
            ), {"gid": g_id}).fetchall()
            
            teams = [{"id": tr[0], "name": tr[1], "points": tr[2], "gf": tr[3], "ga": tr[4], "gd": tr[3]-tr[4], "played": tr[5]} for tr in teams_res]
            groups.append({"id": g_id, "name": g[1], "teams": teams})
            
        phases.append({
            "id": p_id, "name": p[1], "order": p[2], "type": p[3], "status": p[4], "is_double_round": bool(p[5]), "groups": groups
        })
    return jsonify(phases)

@app.route('/api/tournaments/<string:slug>/reset', methods=['POST'])
def reset_tournament(slug):
    try:
        t_id = get_tournament_id_from_slug(slug)
        if not t_id:
            return jsonify({"error": "Torneo no encontrado"}), 404

        # Hierarchical deletion
        # 1. Match Events
        db.session.execute(text(
            "DELETE FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = :tid)"
        ), {"tid": t_id})
        
        # 2. Match Lineups
        db.session.execute(text(
            "DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = :tid)"
        ), {"tid": t_id})
        
        # 3. Matches
        db.session.execute(text("DELETE FROM matches WHERE tournament_id = :tid"), {"tid": t_id})
        
        # 4. Group Teams
        db.session.execute(text(
            "DELETE FROM group_teams WHERE group_id IN (SELECT id FROM tournament_groups WHERE tournament_id = :tid)"
        ), {"tid": t_id})
        
        # 5. Tournament Groups
        db.session.execute(text("DELETE FROM tournament_groups WHERE tournament_id = :tid"), {"tid": t_id})
        
        # 6. Tournament Phases
        db.session.execute(text("DELETE FROM tournament_phases WHERE tournament_id = :tid"), {"tid": t_id})
        
        # 7. Optionally reset tournament status to registration open if desired, 
        # but let's just clear data and let the admin decide.
        
        db.session.commit()
        return jsonify({"message": "Torneo reiniciado correctamente. Todos los datos de progreso han sido eliminados."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<string:slug>/phases', methods=['POST'])
def create_tournament_phase(slug):
    if slug == 'undefined' or slug == 'current':
        t_id_header = request.headers.get('X-Tournament-ID')
        if not t_id_header: return jsonify({"error": "No tournament specified"}), 400
        t_id = int(t_id_header)
    else:
        t_id = get_tournament_id_from_slug(slug)
        if not t_id: return jsonify({"error": "Tournament not found"}), 404
    data = request.json
    try:
        result = db.session.execute(text(
            "INSERT INTO tournament_phases (tournament_id, name, phase_order, phase_type, is_double_round) "
            "VALUES (:tid, :name, :order, :type, :double)"
        ), {
            "tid": t_id, 
            "name": data.get('name'), 
            "order": data.get('order', 1), 
            "type": data.get('type', 'ROUND_ROBIN'),
            "double": 1 if data.get('is_double_round') else 0
        })
        phase_id = result.lastrowid
        db.session.commit()
        return jsonify({"message": "Phase created", "phase_id": phase_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/phases/<int:phase_id>', methods=['PUT', 'DELETE'])
def manage_phase_operations(phase_id):
    if request.method == 'PUT':
        data = request.json
        try:
            db.session.execute(text(
                "UPDATE tournament_phases SET name = :name, is_double_round = :double WHERE id = :pid"
            ), {
                "name": data.get('name'), 
                "double": 1 if data.get('is_double_round') else 0,
                "pid": phase_id
            })
            db.session.commit()
            return jsonify({"message": "Fase actualizada correctamente"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
            
    if request.method == 'DELETE':
        try:
            # 1. Clean groups inside this phase
            groups = db.session.execute(text("SELECT id FROM tournament_groups WHERE phase_id = :pid"), {"pid": phase_id}).fetchall()
            for g in groups:
                gid = g[0]
                # Cascaded cleanup for each group
                db.session.execute(text("DELETE FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"), {"gid": gid})
                db.session.execute(text("DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"), {"gid": gid})
                db.session.execute(text("DELETE FROM matches WHERE group_id = :gid"), {"gid": gid})
                db.session.execute(text("DELETE FROM group_teams WHERE group_id = :gid"), {"gid": gid})
                db.session.execute(text("DELETE FROM tournament_groups WHERE id = :gid"), {"gid": gid})
                
            # 2. Finally delete the phase
            db.session.execute(text("DELETE FROM tournament_phases WHERE id = :pid"), {"pid": phase_id})
            db.session.commit()
            return jsonify({"message": "Fase eliminada correctamente"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route('/api/phases/<int:phase_id>/groups', methods=['POST'])
def create_phase_group(phase_id):
    data = request.json
    try:
        t_id_result = db.session.execute(text("SELECT tournament_id FROM tournament_phases WHERE id = :pid"), {"pid": phase_id}).fetchone()
        if not t_id_result: return jsonify({"error": "Phase not found"}), 404
        t_id = t_id_result[0]
        
        result = db.session.execute(text(
            "INSERT INTO tournament_groups (tournament_id, phase_id, name) VALUES (:t_id, :p_id, :name)"
        ), {"t_id": t_id, "p_id": phase_id, "name": data.get('name')})
        group_id = result.lastrowid
        db.session.commit()
        return jsonify({"message": "Group created", "group_id": group_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>', methods=['PUT', 'DELETE'])
def manage_group_operations(group_id):
    if request.method == 'PUT':
        data = request.json
        try:
            db.session.execute(text(
                "UPDATE tournament_groups SET name = :name WHERE id = :gid"
            ), {"name": data.get('name'), "gid": group_id})
            db.session.commit()
            return jsonify({"message": "Grupo actualizado"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
            
    if request.method == 'DELETE':
        try:
            # 1. Matches and related (events, lineups)
            db.session.execute(text("DELETE FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"), {"gid": group_id})
            db.session.execute(text("DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"), {"gid": group_id})
            db.session.execute(text("DELETE FROM matches WHERE group_id = :gid"), {"gid": group_id})
            # 2. Group teams
            db.session.execute(text("DELETE FROM group_teams WHERE group_id = :gid"), {"gid": group_id})
            # 3. Finally the group
            db.session.execute(text("DELETE FROM tournament_groups WHERE id = :gid"), {"gid": group_id})
            db.session.commit()
            return jsonify({"message": "Grupo eliminado correctamente"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/teams', methods=['GET', 'POST'])
def manage_group_teams(group_id):
    if request.method == 'GET':
        try:
            teams_res = db.session.execute(text(
                "SELECT t.id, t.name, t.logo_url, gt.points, gt.goals_for, gt.goals_against, gt.matches_played "
                "FROM group_teams gt JOIN teams t ON gt.team_id = t.id WHERE gt.group_id = :gid"
            ), {"gid": group_id}).fetchall()
            
            teams = []
            for tr in teams_res:
                teams.append({
                    "id": tr[0], 
                    "name": tr[1], 
                    "logo_url": tr[2],
                    "points": tr[3], 
                    "gf": tr[4], 
                    "ga": tr[5], 
                    "gd": tr[4] - tr[5],
                    "played": tr[6]
                })
            return jsonify(teams)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # POST logic
    data = request.json
    team_id = data.get('team_id')
    try:
        db.session.execute(text(
            "INSERT INTO group_teams (group_id, team_id) VALUES (:gid, :tid)"
        ), {"gid": group_id, "tid": team_id})
        db.session.commit()
        return jsonify({"message": "Team added to group"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/teams/<int:team_id>', methods=['DELETE'])
def remove_team_from_group(group_id, team_id):
    try:
        # Check if ANY match exists for this team in this group
        any_match = db.session.execute(text(
            "SELECT id FROM matches WHERE group_id = :gid AND (home_team_id = :tid OR away_team_id = :tid)"
        ), {"gid": group_id, "tid": team_id}).fetchone()
        
        if any_match:
            return jsonify({"error": "No se puede remover el equipo: ya tiene partidos generados. Por favor, restaure el calendario del grupo primero."}), 400

        db.session.execute(text(
            "DELETE FROM group_teams WHERE group_id = :gid AND team_id = :tid"
        ), {"gid": group_id, "tid": team_id})
        db.session.commit()
        return jsonify({"message": "Team removed from group"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<string:slug>/phases/<int:phase_id>/unassigned-teams', methods=['GET'])
def get_unassigned_teams_for_phase(slug, phase_id):
    if slug == 'undefined' or slug == 'current':
        t_id_header = request.headers.get('X-Tournament-ID')
        if not t_id_header: return jsonify({"error": "No tournament specified"}), 400
        t_id = int(t_id_header)
    else:
        t_id = get_tournament_id_from_slug(slug)
        if not t_id: return jsonify({"error": "Tournament not found"}), 404
        
    try:
        # Get assigned teams in this phase
        assigned_res = db.session.execute(text(
            "SELECT team_id FROM group_teams gt JOIN tournament_groups tg ON gt.group_id = tg.id WHERE tg.phase_id = :pid"
        ), {"pid": phase_id}).fetchall()
        assigned_ids = [r[0] for r in assigned_res]
        
        # Get all teams in tournament
        all_teams = db.session.execute(text(
            "SELECT id, name FROM teams WHERE tournament_id = :tid"
        ), {"tid": t_id}).fetchall()
        
        unassigned = [{"id": t[0], "name": t[1]} for t in all_teams if t[0] not in assigned_ids]
        return jsonify(unassigned)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/phases/<int:phase_id>/matches', methods=['POST'])
def create_manual_match(phase_id):
    data = request.json
    try:
        # Get tournament_id from phase
        res = db.session.execute(text("SELECT tournament_id FROM tournament_phases WHERE id = :pid"), {"pid": phase_id}).fetchone()
        if not res: return jsonify({"error": "Phase not found"}), 404
        t_id = res[0]
        
        match_date = data.get('match_date')
        location = data.get('location')
        referee = data.get('referee')

        if match_date:
            if location:
                conflict_field = db.session.execute(text("SELECT id FROM matches WHERE match_date = :d AND location = :l"), {"d": match_date, "l": location}).fetchone()
                if conflict_field: return jsonify({"error": f"La cancha '{location}' ya está ocupada para esa hora."}), 400
            
            if referee and referee != 'Sin asignar / Pendiente':
                conflict_ref = db.session.execute(text("SELECT id FROM matches WHERE match_date = :d AND referee = :r"), {"d": match_date, "r": referee}).fetchone()
                if conflict_ref: return jsonify({"error": f"El árbitro '{referee}' ya tiene otro juego asignado a esta hora."}), 400

        db.session.execute(text(
            "INSERT INTO matches (tournament_id, phase_id, group_id, home_team_id, away_team_id, match_date, match_day, location, referee, veedor_id, status) "
            "VALUES (:t_id, :p_id, :g_id, :home, :away, :date, :day, :loc, :ref, :vid, 'SCHEDULED')"
        ), {
            "t_id": t_id, "p_id": phase_id, "g_id": data.get('group_id'),
            "home": data.get('home_team_id'), "away": data.get('away_team_id'),
            "date": data.get('match_date'), "day": data.get('match_day', 1),
            "loc": location, "ref": referee, "vid": data.get('veedor_id')
        })
        db.session.commit()
        return jsonify({"message": "Match created manually"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/matches/<int:match_id>', methods=['PUT', 'DELETE'])
def manage_match(match_id):
    if request.method == 'DELETE':
        try:
            db.session.execute(text("DELETE FROM matches WHERE id = :id"), {"id": match_id})
            db.session.commit()
            return jsonify({"message": "Match deleted"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
            
    data = request.json
    try:
        match_date = data.get('match_date')
        location = data.get('location')
        referee = data.get('referee')

        if match_date:
            # 1. Validation: Field conflict
            if location:
                conflict_field = db.session.execute(text("""
                    SELECT id FROM matches 
                    WHERE match_date = :date AND location = :loc AND id != :mid
                """), {"date": match_date, "loc": location, "mid": match_id}).fetchone()
                if conflict_field:
                    return jsonify({"error": f"La cancha '{location}' ya tiene un partido programado a esa hora."}), 400

            # 2. Validation: Referee conflict
            if referee and referee != 'Sin asignar / Pendiente':
                conflict_ref = db.session.execute(text("""
                    SELECT id FROM matches 
                    WHERE match_date = :date AND referee = :ref AND id != :mid
                """), {"date": match_date, "ref": referee, "mid": match_id}).fetchone()
                if conflict_ref:
                    return jsonify({"error": f"El árbitro '{referee}' ya está pitando otro encuentro en esta misma hora."}), 400

        # Fetch current record to avoid overwriting with NULLs if partial data is sent
        current = db.session.execute(text("SELECT home_team_id, away_team_id, match_date, location, referee, veedor_id, home_score, away_score, status, match_day FROM matches WHERE id = :id"), {"id": match_id}).fetchone()
        if not current: return jsonify({"error": "Match not found"}), 404

        db.session.execute(text(
            "UPDATE matches SET home_team_id = :h, away_team_id = :a, match_date = :d, "
            "location = :loc, referee = :ref, veedor_id = :vid, "
            "home_score = :hs, away_score = :ascore, status = :st, match_day = :day "
            "WHERE id = :id"
        ), {
            "h": data.get('home_team_id', current[0]), 
            "a": data.get('away_team_id', current[1]), 
            "d": data.get('match_date', current[2]),
            "loc": data.get('location', current[3]), 
            "ref": data.get('referee', current[4]), 
            "vid": data.get('veedor_id', current[5]),
            "hs": data.get('home_score', current[6]), 
            "ascore": data.get('away_score', current[7]), 
            "st": data.get('status', current[8]), 
            "day": data.get('match_day', current[9]),
            "id": match_id
        })
        db.session.commit()
        return jsonify({"message": "Match updated"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/matches', methods=['DELETE'])
def reset_group_matches(group_id):
    try:
        # Prevent reset if any match is COMPLETED
        played = db.session.execute(text(
            "SELECT id FROM matches WHERE group_id = :gid AND status = 'COMPLETED'"
        ), {"gid": group_id}).fetchone()
        
        if played:
            return jsonify({"error": "No se puede reiniciar el calendario: ya existen partidos terminados."}), 400
            
        # Cascaded delete for related records
        db.session.execute(text(
            "DELETE FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"
        ), {"gid": group_id})
        db.session.execute(text(
            "DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE group_id = :gid)"
        ), {"gid": group_id})
        db.session.execute(text("DELETE FROM matches WHERE group_id = :gid"), {"gid": group_id})
        db.session.commit()
        return jsonify({"message": "Group matches reset"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/generate-fixtures', methods=['POST'])
def generate_group_fixtures(group_id):
    try:
        # 1. Get teams and phase/tournament context
        info = db.session.execute(text(
            "SELECT g.phase_id, g.tournament_id, p.is_double_round "
            "FROM tournament_groups g "
            "JOIN tournament_phases p ON g.phase_id = p.id "
            "WHERE g.id = :gid"
        ), {"gid": group_id}).fetchone()
        if not info: return jsonify({"error": "Group not found"}), 404
        p_id, t_id, is_double = info

        # NEW VALIDATION: Cannot re-draw if matches started/finished
        check_progress = db.session.execute(text(
            "SELECT id FROM matches WHERE group_id = :gid AND status IN ('IN_PROGRESS', 'COMPLETED')"
        ), {"gid": group_id}).fetchone()
        if check_progress:
            return jsonify({"error": "No se pueden re-sortear grupos con partidos ya iniciados o finalizados."}), 400
        # Get teams in group
        teams_res = db.session.execute(text(
            "SELECT team_id FROM group_teams WHERE group_id = :gid"
        ), {"gid": group_id}).fetchall()
        teams = [t[0] for t in teams_res]
        
        if len(teams) < 2:
            return jsonify({"error": "Se necesitan al menos 2 equipos en el grupo para generar el calendario."}), 400
            
        import random
        random.shuffle(teams)

        if len(teams) % 2 != 0:
            teams.append(None) # Bye team for odd number
            
        n = len(teams)
        rounds = n - 1
        matches_per_round = n // 2
        
        # Round Robin Algorithm (Polygon Method)
        generated_matches = []
        pairs = [] # To store pairs for second leg
        
        for r in range(rounds):
            for i in range(matches_per_round):
                h = teams[i]
                a = teams[n - 1 - i]
                if h is not None and a is not None:
                    pairs.append((h, a, r + 1))
            # Rotate teams
            teams = [teams[0]] + [teams[-1]] + teams[1:-1]
            
        # If double round, add the reverse matches
        if is_double:
            second_leg = []
            for h, a, day in pairs:
                second_leg.append((a, h, day + rounds))
            pairs.extend(second_leg)
            rounds *= 2

        # Final insertion to DB
        for h_id, a_id, day in pairs:
            db.session.execute(text(
                "INSERT INTO matches (tournament_id, phase_id, group_id, home_team_id, away_team_id, match_day, status) "
                "VALUES (:t_id, :p_id, :g_id, :home, :away, :day, 'SCHEDULED')"
            ), {
                "t_id": t_id, "p_id": p_id, "g_id": group_id,
                "home": h_id, "away": a_id, "day": day
            })
            
            # Fetch for animation
            h_res = db.session.execute(text("SELECT name, logo_url FROM teams WHERE id = :id"), {"id": h_id}).fetchone()
            a_res = db.session.execute(text("SELECT name, logo_url FROM teams WHERE id = :id"), {"id": a_id}).fetchone()
            
            generated_matches.append({
                "home": h_res[0], "home_logo": h_res[1],
                "away": a_res[0], "away_logo": a_res[1],
                "day": day
            })
            
        db.session.commit()
        return jsonify({
            "message": f"Fixture generated for {rounds} matchdays",
            "sequence": generated_matches
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/matches', methods=['GET'])
def get_group_matches(group_id):
    sql = """
        SELECT m.id, m.match_day, m.status, m.match_date, 
               h.name as home_name, a.name as away_name, m.home_score, m.away_score,
               m.home_team_id, m.away_team_id, m.location, m.referee
        FROM matches m
        LEFT JOIN teams h ON m.home_team_id = h.id
        LEFT JOIN teams a ON m.away_team_id = a.id
        WHERE m.group_id = :gid
        ORDER BY m.match_day ASC, m.match_date ASC
    """
    result = db.session.execute(text(sql), {"gid": group_id}).fetchall()
    matches = []
    for row in result:
        matches.append({
            "id": row[0], "day": row[1], "status": row[2], 
            "date": row[3].isoformat() if row[3] else None,
            "home": row[4], "away": row[5], "home_score": row[6], "away_score": row[7],
            "home_id": row[8], "away_id": row[9],
            "location": row[10], "referee": row[11]
        })
    return jsonify(matches)


@app.route('/api/phases/<int:phase_id>/draw', methods=['POST'])
def generate_phase_draw(phase_id):
    import random
    try:
        # Check if phase exists
        phase = db.session.execute(text("SELECT tournament_id FROM tournament_phases WHERE id = :pid"), {"pid": phase_id}).fetchone()
        print(f"DEBUG DRAW - Phase ID: {phase_id}, Found Phase: {phase}", flush=True)
        if not phase: 
            print(f"DEBUG DRAW - ERROR: Phase {phase_id} not found", flush=True)
            return jsonify({"error": "Phase not found"}), 404
        t_id = phase[0]
        
        # Get groups in this phase
        groups = db.session.execute(text("SELECT id FROM tournament_groups WHERE phase_id = :pid"), {"pid": phase_id}).fetchall()
        print(f"DEBUG DRAW - Found Groups: {groups}", flush=True)
        if not groups: 
            print(f"DEBUG DRAW - ERROR: No groups found in phase {phase_id}", flush=True)
            return jsonify({"error": "Create groups first"}), 400
        group_ids = [g[0] for g in groups]
        
        # Get all unassigned teams in the tournament
        assigned_result = db.session.execute(text(
            "SELECT team_id FROM group_teams gt JOIN tournament_groups tg ON gt.group_id = tg.id WHERE tg.phase_id = :pid"
        ), {"pid": phase_id}).fetchall()
        assigned_teams = [r[0] for r in assigned_result]
        
        all_teams = db.session.execute(text("SELECT id FROM teams WHERE tournament_id = :tid"), {"tid": t_id}).fetchall()
        print(f"DEBUG DRAW - Phase ID: {phase_id}, T_ID: {t_id}, All Teams: {all_teams}, Assigned: {assigned_teams}", flush=True)
        unassigned_teams = [t[0] for t in all_teams if t[0] not in assigned_teams]
        
        print(f"DEBUG DRAW - Final Unassigned Teams: {unassigned_teams}", flush=True)
        if not unassigned_teams:
            print(f"DEBUG DRAW - WARNING: No unassigned teams for tournament {t_id}", flush=True)
            return jsonify({"message": "No unassigned teams remaining", "sequence": []}), 200
            
        random.shuffle(unassigned_teams)
        
        group_count = len(group_ids)
        draw_sequence = []
        for idx, team_id in enumerate(unassigned_teams):
            target_group_id = group_ids[idx % group_count]
            db.session.execute(text(
                "INSERT INTO group_teams (group_id, team_id) VALUES (:gid, :tid)"
            ), {"gid": target_group_id, "tid": team_id})
            
            # Context for animation
            t_res = db.session.execute(text("SELECT name, logo_url FROM teams WHERE id = :id"), {"id": team_id}).fetchone()
            g_name = db.session.execute(text("SELECT name FROM tournament_groups WHERE id = :id"), {"id": target_group_id}).fetchone()[0]
            draw_sequence.append({
                "team": t_res[0], 
                "logo": t_res[1],
                "group": g_name, 
                "group_id": target_group_id
            })
            
        db.session.commit()
        return jsonify({
            "message": "Draw generated successfully",
            "sequence": draw_sequence
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/card-template', methods=['GET'])
def get_card_template():
    row = db.session.execute(text("SELECT id, name, canvas_width, canvas_height, background_url, elements FROM card_templates ORDER BY id ASC LIMIT 1")).fetchone()
    if not row:
        return jsonify({"error": "No template found"}), 404
    elements = row[5]
    elements = json.loads(elements) if isinstance(elements, str) else (elements or [])
    return jsonify({
        "id": row[0], "name": row[1], "canvas_width": row[2], "canvas_height": row[3],
        "background_url": row[4], "elements": elements
    })

@app.route('/api/card-template', methods=['PUT'])
def update_card_template():
    data = request.json or {}
    try:
        db.session.execute(
            text("""UPDATE card_templates SET
                 elements = :els, canvas_width = :w, canvas_height = :h, background_url = :bg
                 WHERE id = (SELECT id FROM (SELECT MIN(id) as id FROM card_templates) t)"""),
            {
                "els": json.dumps(data.get('elements', [])),
                "w": data.get('canvas_width', 613),
                "h": data.get('canvas_height', 860),
                "bg": data.get('background_url')
            }
        )
        db.session.commit()
        return jsonify({"message": "Template saved"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings', methods=['GET'])
def get_settings():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    sql = """
        SELECT s.team_id, s.team_name, s.team_logo_url, s.favicon_url, s.updated_at, t.registration_pin, t.slug 
        FROM settings s JOIN teams t ON s.team_id = t.id 
        WHERE s.team_id = :team
    """
    row = db.session.execute(text(sql), {"team": team_id}).fetchone()
    if row:
        cols = ['team_id', 'team_name', 'team_logo_url', 'favicon_url', 'updated_at', 'registration_pin', 'slug']
        return jsonify(dict(zip(cols, row)))
    return jsonify({"error": "Settings not found"}), 404

@app.route('/api/<string:team_slug>/settings', methods=['GET'])
def get_settings_public(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    sql = """
        SELECT s.team_id, s.team_name, s.team_logo_url, s.favicon_url, s.updated_at, t.registration_pin 
        FROM settings s JOIN teams t ON s.team_id = t.id 
        WHERE s.team_id = :team
    """
    row = db.session.execute(text(sql), {"team": team_id}).fetchone()
    if row:
        data = {
            'team_id': row[0], 'team_name': row[1], 'team_logo_url': row[2], 
            'favicon_url': row[3], 'updated_at': row[4],
            'has_pin': bool(row[5])
        }
        return jsonify(data)
    return jsonify({"error": "Settings not found"}), 404

@app.route('/api/<string:team_slug>/validate-pin', methods=['POST'])
def validate_team_pin(team_slug):
    pin = request.json.get('pin')
    if not pin: return jsonify({"error": "PIN requerido"}), 400
    
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    
    actual_pin = db.session.execute(text("SELECT registration_pin FROM teams WHERE id = :tid"), {"tid": team_id}).scalar()
    
    if actual_pin and actual_pin == str(pin):
        return jsonify({"valid": True})
    return jsonify({"error": f"PIN inválido. DB dice: '{actual_pin}', Tú mandaste: '{pin}'"}), 401

@app.route('/api/<string:team_slug>/costs', methods=['GET'])
def get_public_costs(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    result = db.session.execute(text("SELECT id, item_name, amount, is_mandatory FROM team_costs WHERE team_id = :team"), {"team": team_id})
    costs = [{"id": row[0], "name": row[1], "amount": float(row[2]), "is_mandatory": bool(row[3])} for row in result]
    return jsonify(costs)

@app.route('/api/<string:team_slug>/eps', methods=['GET'])
@app.route('/api/teams/<string:team_slug>/eps', methods=['GET'])
def get_eps_list(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    
    result = db.session.execute(
        text("SELECT DISTINCT eps FROM players WHERE team_id = :tid AND eps IS NOT NULL AND eps != '' ORDER BY eps ASC"),
        {"tid": team_id}
    ).fetchall()
    
    eps_list = [row[0] for row in result]
    return jsonify(eps_list)

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        data = request.json
        print(f"DEBUG UPDATE SETTINGS RECEIVED: {data}", flush=True)
        db.session.execute(
            text("""UPDATE settings SET 
                 team_name = :name, team_logo_url = :logo, favicon_url = :favicon
                 WHERE team_id = :team"""),
            {
                "name": data.get('team_name'), "logo": data.get('team_logo_url'),
                "favicon": data.get('favicon_url'), 
                "team": team_id
            }
        )
        
        # update PIN on teams table as well
        if 'registration_pin' in data:
            db.session.execute(
                text("UPDATE teams SET registration_pin = :pin WHERE id = :team"),
                {"pin": data.get('registration_pin') or None, "team": team_id}
            )

        db.session.commit()
        log_activity(team_id, "UPDATE_SETTINGS", "Settings updated by admin")
        return jsonify({"message": "Settings updated"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-logo', methods=['POST'])
def upload_logo():
    # Look for 'logo' or 'file' key for generic usage
    file_key = 'logo' if 'logo' in request.files else 'file'
    if file_key not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files[file_key]
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid cache issues
        filename = f"{int(datetime.now().timestamp())}_{filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        # We return the absolute URL as visible from the frontend
        # Use relative URL so it works behind proxies and with different domains
        logo_url = f"/api/uploads/{filename}"
        return jsonify({"url": logo_url}), 200
    return jsonify({"error": "File type not allowed"}), 400

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def _process_player_photo(p_id, team_id, file):
    """Guarda el original y el recorte (rembg) de la foto de un jugador con timeout de seguridad."""
    if not file:
        return {"error": "No file part"}, 400
    if file.filename == '' or not allowed_file(file.filename):
        return {"error": "File type not allowed"}, 400

    ts = int(datetime.now().timestamp())
    orig_filename = f"player_{p_id}_{ts}_orig.jpg"
    cutout_filename = f"player_{p_id}_{ts}_cutout.png"

    from PIL import Image, ImageOps
    import io
    import concurrent.futures

    image_bytes = file.read()
    try:
        original_img = Image.open(io.BytesIO(image_bytes))
        # Corregir orientación según metadata EXIF (clave para fotos tomadas con móviles)
        original_img = ImageOps.exif_transpose(original_img)
        original_img = original_img.convert('RGB')
    except Exception:
        return {"error": "Archivo de imagen inválido"}, 400

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Redimensionar si excede dimensiones web para rapidez
    max_orig_dim = 1200
    if original_img.width > max_orig_dim or original_img.height > max_orig_dim:
        original_img.thumbnail((max_orig_dim, max_orig_dim), Image.Resampling.LANCZOS)

    orig_path = os.path.join(app.config['UPLOAD_FOLDER'], orig_filename)
    original_img.save(orig_path, format='JPEG', quality=85, optimize=True)
    photo_url = f"/api/uploads/{orig_filename}"

    # Guardar INMEDIATAMENTE en base de datos para asegurar que nunca se pierda la foto
    try:
        db.session.execute(
            text("UPDATE players SET photo_url = :orig WHERE id = :id AND team_id = :team"),
            {"orig": photo_url, "id": p_id, "team": team_id}
        )
        db.session.commit()
    except Exception as dbe:
        db.session.rollback()
        print(f"⚠️ Error actualizando photo_url en BD para jugador {p_id}: {dbe}")

    photo_cutout_url = None
    # Intento de remoción de fondo con miniatura y timeout de 8 segundos
    try:
        thumb_img = original_img.copy()
        if thumb_img.width > 600 or thumb_img.height > 600:
            thumb_img.thumbnail((600, 600), Image.Resampling.BILINEAR)

        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format='PNG')
        thumb_bytes = thumb_buf.getvalue()

        def do_rembg():
            from rembg import remove
            return remove(thumb_bytes)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(do_rembg)
            cutout_bytes = future.result(timeout=8)

        cutout_path = os.path.join(app.config['UPLOAD_FOLDER'], cutout_filename)
        with open(cutout_path, 'wb') as f:
            f.write(cutout_bytes)
        photo_cutout_url = f"/api/uploads/{cutout_filename}"

        db.session.execute(
            text("UPDATE players SET photo_cutout_url = :cutout WHERE id = :id AND team_id = :team"),
            {"cutout": photo_cutout_url, "id": p_id, "team": team_id}
        )
        db.session.commit()
    except concurrent.futures.TimeoutError:
        print(f"⚠️ rembg tardó más de 8s para jugador {p_id}, continuando con foto original.")
    except Exception as e:
        print(f"⚠️ Background removal failed for player {p_id}: {e}")

    try:
        log_activity(team_id, "UPLOAD_PHOTO", f"Photo uploaded for player ID: {p_id}")
    except Exception:
        pass

    if photo_cutout_url is None:
        return {
            "photo_url": photo_url, "photo_cutout_url": None,
            "warning": "La foto se guardó con éxito. El recorte automático se omitió para evitar demoras."
        }, 200
    return {"photo_url": photo_url, "photo_cutout_url": photo_cutout_url}, 200

@app.route('/api/players/<int:p_id>/photo', methods=['POST'])
def upload_player_photo(p_id):
    player = db.session.execute(text("SELECT team_id FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player:
        return jsonify({"error": "Player not found"}), 404

    player_team_id = player[0]
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    body, status = _process_player_photo(p_id, player_team_id, request.files['file'])
    return jsonify(body), status

@app.route('/api/<string:team_slug>/players/<int:p_id>/photo', methods=['POST'])
def upload_player_photo_public(p_id, team_slug):
    """Subida de foto durante el auto-registro público (sin sesión de admin) — se valida
    pertenencia por team_slug + p_id, igual que el resto del registro público."""
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404

    player = db.session.execute(text("SELECT team_id FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player or str(player[0]) != str(team_id):
        return jsonify({"error": "Player not found or unauthorized"}), 404

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    body, status = _process_player_photo(p_id, team_id, request.files['file'])
    return jsonify(body), status

# --- HELPER FUNCTIONS ---

def sync_team_payments(team_id):
    """Updates player statuses based on current mandatory costs."""
    try:
        # 1. Get total mandatory costs
        res = db.session.execute(
            text("SELECT SUM(amount) FROM team_costs WHERE team_id = :tid AND is_mandatory = 1"),
            {"tid": team_id}
        ).fetchone()
        total_mandatory = float(res[0]) if res and res[0] else 0.0
        
        # 2. Synchronize statuses
        # Case A: Marked as Paid but amount is less than total -> change to Abonó
        db.session.execute(
            text("UPDATE players SET payment_status = 'Abonó' WHERE team_id = :tid AND payment_status = 'Pagó' AND payment_amount < :total"),
            {"tid": team_id, "total": total_mandatory}
        )
        
        # Case B: Marked as Abonó but amount is now equal or greater than total -> change to Pagó
        db.session.execute(
            text("UPDATE players SET payment_status = 'Pagó' WHERE team_id = :tid AND payment_status = 'Abonó' AND payment_amount >= :total"),
            {"tid": team_id, "total": total_mandatory}
        )
        
        # Case C: Marked as Pendiente but has enough amount -> change to Pagó
        db.session.execute(
            text("UPDATE players SET payment_status = 'Pagó' WHERE team_id = :tid AND payment_status = 'Pendiente' AND payment_amount >= :total AND payment_amount > 0"),
            {"tid": team_id, "total": total_mandatory}
        )
        
        db.session.commit()
        print(f"Synced payments for team {team_id}. Total mandatory: {total_mandatory}")
    except Exception as e:
        db.session.rollback()
        print(f"Error syncing payments: {e}")

# --- TEAM COSTS ---

@app.route('/api/costs', methods=['GET'])
def get_costs():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    result = db.session.execute(text("SELECT id, item_name, amount, is_mandatory FROM team_costs WHERE team_id = :team"), {"team": team_id})
    costs = [{"id": row[0], "name": row[1], "amount": float(row[2]), "is_mandatory": bool(row[3])} for row in result]
    return jsonify(costs)

@app.route('/api/costs', methods=['POST'])
def add_cost():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    try:
        db.session.execute(
            text("INSERT INTO team_costs (team_id, item_name, amount, is_mandatory) VALUES (:tid, :name, :amt, :mand)"),
            {
                "tid": team_id,
                "name": data.get('item_name'),
                "amt": float(data.get('amount', 0)),
                "mand": data.get('is_mandatory', True)
            }
        )
        db.session.commit()
        sync_team_payments(team_id)
        log_activity(team_id, "ADD_COST", f"Added cost: {data.get('item_name')}")
        return jsonify({"message": "Cost added"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/costs/<int:cost_id>', methods=['DELETE'])
def delete_cost(cost_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        db.session.execute(text("DELETE FROM team_costs WHERE id = :id AND team_id = :tid"), {"id": cost_id, "tid": team_id})
        db.session.commit()
        sync_team_payments(team_id)
        log_activity(team_id, "DELETE_COST", f"Deleted cost ID: {cost_id}")
        return jsonify({"message": "Cost deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/costs/<int:cost_id>', methods=['PUT'])
def update_cost(cost_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    try:
        db.session.execute(
            text("UPDATE team_costs SET item_name = :name, amount = :amt WHERE id = :id AND team_id = :tid"),
            {
                "id": cost_id,
                "tid": team_id,
                "name": data.get('item_name'),
                "amt": float(data.get('amount', 0))
            }
        )
        db.session.commit()
        sync_team_payments(team_id)
        log_activity(team_id, "UPDATE_COST", f"Updated cost: {data.get('item_name')} (ID: {cost_id})")
        return jsonify({"message": "Cost updated"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json or {}
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        # Query user, team, and tournament with LEFT JOINs
        sql = """
            SELECT u.id, u.password_hash, u.team_id, t.slug as team_slug, u.role, u.username, u.tournament_id, tr.slug as tournament_slug, u.player_id, u.must_change_password
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            LEFT JOIN tournaments tr ON u.tournament_id = tr.id
            WHERE u.username = :user
        """
        result = db.session.execute(text(sql), {"user": username}).fetchone()

        if not result:
            return jsonify({"error": "Invalid credentials"}), 401

        user_id = result[0]
        stored_hash = result[1]
        team_id = result[2]
        team_slug = result[3]
        role = result[4]
        db_username = result[5]
        user_tournament_id = result[6]
        tournament_slug = result[7]
        player_id = result[8]
        must_change_password = bool(result[9])

        # Case 1: Match with Hash
        is_correct = check_password_hash(stored_hash, password)
        
        # Case 2: Emergency Fallback / Self-Healing (if stored as plain text)
        if not is_correct and stored_hash == password:
            is_correct = True
            try:
                # Update to secure hash
                new_hash = generate_password_hash(password)
                db.session.execute(text("UPDATE users SET password_hash = :h WHERE id = :id"), {"h": new_hash, "id": user_id})
                db.session.commit()
            except: pass
            
        if is_correct:
            return jsonify({
                "message": "Login successful",
                "role": role,
                "user_id": user_id,
                "team_id": team_id,
                "team_slug": team_slug,
                "tournament_id": user_tournament_id,
                "tournament_slug": tournament_slug,
                "username": db_username,
                "player_id": player_id,
                "must_change_password": must_change_password
            }), 200

        print(f"Login failed: Incorrect password for {username}")
        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        print(f"CRITICAL LOGIN ERROR: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/me/player', methods=['GET'])
def get_my_player_profile():
    user_id = request.headers.get('X-User-ID')
    if not user_id: return jsonify({"error": "Unauthorized"}), 401

    user = db.session.execute(text("SELECT role, player_id, team_id FROM users WHERE id = :id"), {"id": user_id}).fetchone()
    if not user or user[0] != 'player' or not user[1]:
        return jsonify({"error": "Unauthorized"}), 403

    result = db.session.execute(text(CARD_DATA_SQL + " WHERE p.id = :id AND p.team_id = :team"), {"id": user[1], "team": user[2]})
    row = result.fetchone()
    if not row:
        return jsonify({"error": "Player not found"}), 404
    return jsonify(row_to_card_data(row, result.keys()))

@app.route('/api/me/password', methods=['PUT'])
def change_my_password():
    user_id = request.headers.get('X-User-ID')
    if not user_id: return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    if not current_password or not new_password:
        return jsonify({"error": "current_password y new_password son requeridos"}), 400

    user = db.session.execute(text("SELECT password_hash FROM users WHERE id = :id"), {"id": user_id}).fetchone()
    if not user or not check_password_hash(user[0], current_password):
        return jsonify({"error": "Contraseña actual incorrecta"}), 401

    try:
        new_hash = generate_password_hash(new_password)
        db.session.execute(
            text("UPDATE users SET password_hash = :h, must_change_password = 0 WHERE id = :id"),
            {"h": new_hash, "id": user_id}
        )
        db.session.commit()
        return jsonify({"message": "Contraseña actualizada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- SUPER ADMIN TEAM MANAGEMENT ---

@app.route('/api/teams', methods=['GET'])
def list_teams():
    # Only superadmins should see all teams
    # (In a real app, verify role via token, for now check header or params)
    result = db.session.execute(text("SELECT * FROM teams ORDER BY id ASC"))
    columns = result.keys()
    teams = [dict(zip(columns, row)) for row in result]
    return jsonify(teams)

@app.route('/api/teams', methods=['POST'])
def create_team():
    try:
        data = request.json
        name = data.get('name')
        slug = data.get('slug')
        if not slug and name:
            slug = name.lower().replace(" ", "-")
        
        tournament_id = data.get('tournament_id')
        # Ensure tournament_id is a valid integer or None
        t_id = int(tournament_id) if tournament_id and str(tournament_id).isdigit() else None
        reg_pin = data.get('registration_pin')
        
        # New Delegate Fields
        del_doc = data.get('delegate_document')
        del_name = data.get('delegate_name')
        del_email = data.get('delegate_email')
        del_phone = data.get('delegate_phone')
        del_address = data.get('delegate_address')
        del_city = data.get('delegate_city')
        
        if not all([name, slug, del_email]):
            return jsonify({"error": "Nombre del equipo y Email son obligatorios"}), 400
            
        # User Credentials Generation
        import secrets
        import string
        admin_user = (data.get('admin_username') or '').strip() or del_email
        provided_pass = (data.get('admin_password') or '').strip()
        if provided_pass:
            admin_pass = provided_pass
        else:
            alphabet = string.ascii_letters + string.digits
            admin_pass = ''.join(secrets.choice(alphabet) for i in range(8))
            
        # Check if registration is open (only if tournament is selected)
        if t_id:
            reg = db.session.execute(text("SELECT registration_open FROM tournaments WHERE id = :tid"), {"tid": t_id}).fetchone()
            if reg and not reg[0]:
                return jsonify({"error": "El registro está cerrado para este torneo."}), 403

        # 1. Create Team
        res = db.session.execute(
            text("""INSERT INTO teams 
                 (name, slug, tournament_id, delegate_document, delegate_name, delegate_email, delegate_phone, delegate_address, delegate_city, registration_pin, logo_url) 
                 VALUES (:name, :slug, :tid, :ddoc, :dname, :demail, :dphone, :daddress, :dcity, :pin, :logo)"""),
            {
                "name": name, "slug": slug, "tid": t_id, "ddoc": del_doc, "dname": del_name, 
                "demail": del_email, "dphone": del_phone, "daddress": del_address, "dcity": del_city,
                "pin": reg_pin or None, "logo": data.get('logo_url')
            }
        )
        team_id = res.lastrowid
        
        # 2. Create Team Admin
        # First clean up if username exists
        db.session.execute(text("DELETE FROM users WHERE username = :u"), {"u": admin_user})
        
        pass_hash = generate_password_hash(admin_pass)
        db.session.execute(
            text("INSERT INTO users (team_id, username, password_hash, role) VALUES (:tid, :user, :hash, 'admin')"),
            {"tid": team_id, "user": admin_user, "hash": pass_hash}
        )

        # 3. Initialize Settings (optional failure)
        try:
            db.session.execute(
                text("INSERT INTO settings (team_id, team_name) VALUES (:tid, :name)"),
                {"tid": team_id, "name": name}
            )
        except Exception as se:
            print(f"Warning: Could not init settings for team {team_id}: {se}")

        # 4. Initialize Positions (optional failure)
        try:
            default_positions = [
                'Portero', 'Defensa Central', 'Lateral Izquierdo', 'Lateral Derecho',
                'Mediocampista Defensivo', 'Mediocampista Central', 'Mediocampista Ofensivo',
                'Extremo Izquierdo', 'Extremo Derecho', 'Delantero', 'Delantero Móvil'
            ]
            for pos_name in default_positions:
                db.session.execute(
                    text("INSERT INTO positions (team_id, name) VALUES (:tid, :name)"),
                    {"tid": team_id, "name": pos_name}
                )
        except Exception as pe:
            print(f"Warning: Could not init positions for team {team_id}: {pe}")
        
        # 5. Initialize Uniform Numbers (0-100) (optional failure)
        try:
            for i in range(0, 31): # Only create 0-30 to save time/space, can add more later
                db.session.execute(
                    text("INSERT INTO uniform_numbers (team_id, number, is_available) VALUES (:tid, :n, TRUE)"),
                    {"tid": team_id, "n": i}
                )
        except Exception as ue:
            print(f"Warning: Could not init uniforms for team {team_id}: {ue}")

        db.session.commit()

        # Send welcome email to team delegate
        if del_email:
            current_app_url = resolve_app_url(request)
            send_team_welcome_email_async(
                to_email=del_email,
                delegate_name=del_name or name,
                team_name=name,
                slug=slug,
                admin_user=admin_user,
                admin_pass=admin_pass,
                pin=reg_pin,
                app_url=current_app_url
            )

        return jsonify({
            "message": "Equipo creado exitosamente",
            "team_id": team_id,
            "credentials": {
                "username": admin_user,
                "password": admin_pass
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL ERROR CREATING TEAM: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/teams/<int:team_id>', methods=['PUT'])
def update_team(team_id):
    try:
        data = request.json
        name = data.get('name')
        slug = data.get('slug')
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        
        # Update Teams Table
        db.session.execute(
            text("""UPDATE teams SET 
                    name = :name, slug = :slug,
                    delegate_document = :ddoc,
                    delegate_name = :dname,
                    delegate_email = :demail,
                    delegate_phone = :dphone,
                    delegate_address = :daddress,
                    delegate_city = :dcity,
                    registration_pin = :pin
                    WHERE id = :tid"""),
            {
                "name": name, "slug": slug, 
                "ddoc": data.get('delegate_document'),
                "dname": data.get('delegate_name'),
                "demail": data.get('delegate_email'),
                "dphone": data.get('delegate_phone'),
                "daddress": data.get('delegate_address'),
                "dcity": data.get('delegate_city'),
                "pin": data.get('registration_pin') or None,
                "tid": team_id
            }
        )
        
        # Update Admin User if necessary
        if admin_user:
            user_id = db.session.execute(text("SELECT id FROM users WHERE team_id = :tid AND role = 'admin'"), {"tid": team_id}).scalar()
            if user_id:
                if admin_pass:
                    pass_hash = generate_password_hash(admin_pass)
                    db.session.execute(text("UPDATE users SET username = :u, password_hash = :p WHERE id = :uid"), {"u": admin_user, "p": pass_hash, "uid": user_id})
                else:
                    db.session.execute(text("UPDATE users SET username = :u WHERE id = :uid"), {"u": admin_user, "uid": user_id})

        db.session.commit()
        return jsonify({"message": "Team updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Check for duplicate slug or username"}), 500

@app.route('/api/teams/<int:team_id>', methods=['DELETE'])
def delete_team(team_id):
    try:
        # 1. Delete group memberships
        db.session.execute(text("DELETE FROM group_teams WHERE team_id = :tid"), {"tid": team_id})
        # 2. Delete team users
        db.session.execute(text("DELETE FROM users WHERE team_id = :tid"), {"tid": team_id})
        # 3. Delete team players
        db.session.execute(text("DELETE FROM players WHERE team_id = :tid"), {"tid": team_id})
        # 4. Delete team settings
        db.session.execute(text("DELETE FROM settings WHERE team_id = :tid"), {"tid": team_id})
        # 5. Delete the team itself
        db.session.execute(text("DELETE FROM teams WHERE id = :tid"), {"tid": team_id})
        
        db.session.commit()
        return jsonify({"message": "Team deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    result = db.session.execute(text("SELECT * FROM activity_logs WHERE team_id = :team ORDER BY created_at DESC LIMIT 50"), {"team": team_id})
    columns = result.keys()
    logs = [dict(zip(columns, row)) for row in result]
    return jsonify(logs)

# --- COMMUNITIES & SHARED PLAYERS MODULE ---

@app.route('/api/excel-template/players', methods=['GET'])
def download_player_excel_template():
    try:
        sample_data = [
            {
                "documento": "1020304050",
                "nombres": "Carlos Alberto",
                "apellidos": "Valderrama Palacio",
                "posicion": "Mediocampista",
                "telefono": "3001234567",
                "email": "pibe@example.com",
                "fecha_nacimiento": "1995-09-02",
                "dorsal": 10,
                "eps": "Sura",
                "pie_habil": "Derecho",
                "tipo_sangre": "O+"
            },
            {
                "documento": "1098765432",
                "nombres": "Faustino",
                "apellidos": "Asprilla Hinestroza",
                "posicion": "Delantero",
                "telefono": "3109876543",
                "email": "tino@example.com",
                "fecha_nacimiento": "1997-11-10",
                "dorsal": 11,
                "eps": "Sanitas",
                "pie_habil": "Derecho",
                "tipo_sangre": "A+"
            }
        ]
        df = pd.DataFrame(sample_data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Jugadores')
        output.seek(0)
        return send_file(
            output,
            download_name='plantilla_jugadores.xlsx',
            as_attachment=True,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/players/global-search', methods=['GET'])
def global_players_search():
    try:
        q = request.args.get('q', '').strip()
        limit = sanitize_int(request.args.get('limit')) or 30

        sql = """
            SELECT p.document_number,
                   MAX(p.full_name) as full_name,
                   MAX(p.first_name) as first_name,
                   MAX(p.last_name) as last_name,
                   MAX(p.phone) as phone,
                   MAX(p.email) as email,
                   MAX(p.position) as position,
                   MAX(p.preferred_foot) as preferred_foot,
                   MAX(p.photo_url) as photo_url,
                   MAX(p.photo_cutout_url) as photo_cutout_url
            FROM players p
            WHERE (:q = '' OR p.document_number LIKE :like_q OR p.full_name LIKE :like_q)
            GROUP BY p.document_number
            ORDER BY MAX(p.created_at) DESC
            LIMIT :limit
        """
        rows = db.session.execute(text(sql), {"q": q, "like_q": f"%{q}%", "limit": limit}).fetchall()

        players_list = []
        for r in rows:
            doc = r[0]
            teams_res = db.session.execute(
                text("""
                    SELECT tm.id as team_id, tm.name as team_name, tr.id as tournament_id, tr.name as tournament_name
                    FROM players pl
                    JOIN teams tm ON pl.team_id = tm.id
                    LEFT JOIN tournaments tr ON tm.tournament_id = tr.id
                    WHERE pl.document_number = :doc
                """),
                {"doc": doc}
            ).fetchall()

            teams_info = [{
                "team_id": t[0],
                "team_name": t[1],
                "tournament_id": t[2],
                "tournament_name": t[3]
            } for t in teams_res]

            players_list.append({
                "document_number": doc,
                "full_name": r[1],
                "first_name": r[2],
                "last_name": r[3],
                "phone": r[4],
                "email": r[5],
                "position": r[6],
                "preferred_foot": r[7],
                "photo_url": r[8],
                "photo_cutout_url": r[9],
                "teams": teams_info
            })

        return jsonify(players_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/teams/<int:team_id>/enroll-player', methods=['POST'])
def enroll_player_in_team(team_id):
    try:
        data = request.json or {}
        doc_num = data.get('document_number')
        if not doc_num:
            return jsonify({"error": "Document number is required"}), 400

        doc_str = str(doc_num).split('.')[0].strip()

        conflict, conflict_msg = check_player_tournament_conflict(doc_str, team_id)
        if conflict:
            return jsonify({"error": conflict_msg}), 400

        curr = db.session.execute(
            text("SELECT id FROM players WHERE team_id = :tid AND document_number = :doc"),
            {"tid": team_id, "doc": doc_str}
        ).fetchone()
        if curr:
            return jsonify({"error": "El jugador ya está inscrito en este equipo"}), 400

        global_p = db.session.execute(
            text("""
                SELECT document_type, full_name, first_name, last_name, phone, email,
                       address, neighborhood, eps, birth_date, preferred_foot, blood_type,
                       nationality, photo_url, photo_cutout_url, position, primary_position_id
                FROM players
                WHERE document_number = :doc
                ORDER BY (photo_url IS NOT NULL) DESC, created_at DESC
                LIMIT 1
            """),
            {"doc": doc_str}
        ).fetchone()

        full_name = data.get('full_name') or (global_p[1] if global_p else 'Jugador')
        doc_type = data.get('document_type') or (global_p[0] if global_p else 'Cédula de Ciudadanía')
        first_name = data.get('first_name') or (global_p[2] if global_p else None)
        last_name = data.get('last_name') or (global_p[3] if global_p else None)
        phone = data.get('phone') or (global_p[4] if global_p else None)
        email = data.get('email') or (global_p[5] if global_p else None)
        address = data.get('address') or (global_p[6] if global_p else None)
        neighborhood = data.get('neighborhood') or (global_p[7] if global_p else None)
        eps = data.get('eps') or (global_p[8] if global_p else None)
        birth_date = data.get('birth_date') or (global_p[9].strftime('%Y-%m-%d') if global_p and global_p[9] else None)
        foot = data.get('preferred_foot') or (global_p[10] if global_p else None)
        blood = data.get('blood_type') or (global_p[11] if global_p else None)
        nationality = data.get('nationality') or (global_p[12] if global_p else None)
        photo_url = data.get('photo_url') or (global_p[13] if global_p else None)
        cutout_url = data.get('photo_cutout_url') or (global_p[14] if global_p else None)
        position = data.get('position') or (global_p[15] if global_p else None)
        primary_pos_id = sanitize_int(data.get('primary_position_id')) or (global_p[16] if global_p else None)
        uniform_num = sanitize_int(data.get('uniform_number'))

        res = db.session.execute(
            text("""
                INSERT INTO players (team_id, document_type, document_number, full_name, first_name, last_name,
                                    phone, email, address, neighborhood, eps, birth_date, preferred_foot,
                                    blood_type, nationality, photo_url, photo_cutout_url, position,
                                    primary_position_id, uniform_number)
                VALUES (:tid, :type, :doc, :fn, :first, :last, :phone, :email, :addr, :barrio, :eps,
                        :bdate, :foot, :blood, :nat, :photo, :cutout, :pos, :pos_id, :unif)
            """),
            {
                "tid": team_id, "type": doc_type, "doc": doc_str, "fn": full_name,
                "first": first_name, "last": last_name, "phone": phone, "email": email,
                "addr": address, "barrio": neighborhood, "eps": eps, "bdate": birth_date,
                "foot": foot, "blood": blood, "nat": nationality, "photo": photo_url,
                "cutout": cutout_url, "pos": position, "pos_id": primary_pos_id, "unif": uniform_num
            }
        )
        if uniform_num:
            db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": uniform_num})

        db.session.commit()
        log_activity(team_id, "ENROLL_PLAYER", f"Player {full_name} enrolled from global base (Doc: {doc_str})")

        # Enviar correo de bienvenida al jugador si tiene email registrado
        try:
            target_email = email or data.get('email')
            if target_email and '@' in str(target_email):
                t_row = db.session.execute(
                    text("""
                        SELECT t.name, t.logo_url, t.delegate_name, tr.name as tournament_name
                        FROM teams t
                        LEFT JOIN tournaments tr ON t.tournament_id = tr.id
                        WHERE t.id = :tid
                    """),
                    {"tid": team_id}
                ).fetchone()

                pos_name = position or "Sin definir"
                if primary_pos_id:
                    pos_row = db.session.execute(text("SELECT name FROM positions WHERE id = :pid"), {"pid": primary_pos_id}).fetchone()
                    if pos_row and pos_row[0]:
                        pos_name = pos_row[0]

                if t_row:
                    send_player_welcome_email_async(
                        to_email=str(target_email).strip(),
                        player_name=full_name,
                        team_name=t_row[0],
                        uniform_number=uniform_num,
                        position_name=pos_name,
                        delegate_name=t_row[2],
                        team_logo_url=t_row[1],
                        tournament_name=t_row[3]
                    )
        except Exception as mail_err:
            print(f"⚠️ Error preparando correo de bienvenida al jugador manual: {mail_err}")

        return jsonify({"message": "Jugador inscrito exitosamente en el equipo", "player_id": res.lastrowid}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/teams/<int:team_id>/players/import-excel', methods=['POST'])
def import_team_players_excel(team_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    result = process_player_excel_import(file, target_team_id=team_id)
    if not result.get('success'):
        return jsonify(result), 400
    log_activity(team_id, "IMPORT_EXCEL", f"Imported {result.get('imported')} players, updated {result.get('updated')}")
    return jsonify(result), 200

def ensure_community_tables():
    try:
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS communities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                slug VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                city VARCHAR(100),
                logo_url TEXT,
                cover_url TEXT,
                creator_id INT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                player_id INT NULL,
                document_number VARCHAR(50) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(150),
                position VARCHAR(50),
                jersey_number INT NULL,
                role VARCHAR(50) DEFAULT 'MEMBER',
                status VARCHAR(50) DEFAULT 'ACTIVE',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_community_player (community_id, document_number)
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                question VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                expires_at DATETIME NULL,
                created_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_poll_options (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                option_text VARCHAR(255) NOT NULL,
                votes_count INT DEFAULT 0
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_poll_votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                option_id INT NOT NULL,
                voter_identifier VARCHAR(100) NOT NULL,
                voter_name VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_poll_voter (poll_id, voter_identifier)
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_matches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                title VARCHAR(150) NOT NULL,
                match_date DATETIME,
                location VARCHAR(255),
                team_a_name VARCHAR(100) DEFAULT 'Equipo A',
                team_b_name VARCHAR(100) DEFAULT 'Equipo B',
                team_a_score INT DEFAULT 0,
                team_b_score INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'SCHEDULED',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS community_match_roster (
                id INT AUTO_INCREMENT PRIMARY KEY,
                match_id INT NOT NULL,
                community_player_id INT NOT NULL,
                team_side VARCHAR(10) NOT NULL,
                goals INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_match_player_roster (match_id, community_player_id)
            )
        """))
        db.session.commit()
    except Exception as e:
        db.session.rollback()

# --- COMMUNITIES CRUD ---

@app.route('/api/communities', methods=['GET'])
def list_communities():
    try:
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({"error": "No autorizado. Debe iniciar sesión."}), 401

        ensure_community_tables()
        sql = """
            SELECT c.id, c.name, c.slug, c.description, c.city, c.logo_url, c.cover_url,
                   c.is_active, c.created_at,
                   (SELECT COUNT(*) FROM community_players cp WHERE cp.community_id = c.id) as total_players,
                   (SELECT COUNT(*) FROM community_polls pol WHERE pol.community_id = c.id AND pol.is_active = 1) as active_polls,
                   (SELECT COUNT(*) FROM community_matches cm WHERE cm.community_id = c.id) as total_matches
            FROM communities c
            ORDER BY c.created_at DESC
        """
        rows = db.session.execute(text(sql)).fetchall()
        communities = []
        for r in rows:
            communities.append({
                "id": r[0],
                "name": r[1],
                "slug": r[2],
                "description": r[3],
                "city": r[4],
                "logo_url": r[5],
                "cover_url": r[6],
                "is_active": bool(r[7]),
                "created_at": r[8].isoformat() if r[8] else None,
                "total_players": r[9],
                "active_polls": r[10],
                "total_matches": r[11]
            })
        return jsonify(communities)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities', methods=['POST'])
def create_community():
    try:
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({"error": "Debe iniciar sesión como superadministrador para crear comunidades."}), 401

        user = db.session.execute(text("SELECT id, role FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if not user or user[1] != 'superadmin':
            return jsonify({"error": "Solo un superadministrador puede crear comunidades."}), 403

        ensure_community_tables()
        data = request.json or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "Nombre de la comunidad es requerido"}), 400

        base_slug = slugify(name)
        slug = base_slug
        suffix = 1
        while db.session.execute(text("SELECT id FROM communities WHERE slug = :s"), {"s": slug}).fetchone():
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        creator_id = user[0]

        res = db.session.execute(
            text("""
                INSERT INTO communities (name, slug, description, city, logo_url, cover_url, creator_id)
                VALUES (:name, :slug, :desc, :city, :logo, :cover, :creator)
            """),
            {
                "name": name,
                "slug": slug,
                "desc": data.get('description'),
                "city": data.get('city'),
                "logo": data.get('logo_url'),
                "cover": data.get('cover_url'),
                "creator": creator_id
            }
        )
        comm_id = res.lastrowid
        db.session.commit()
        return jsonify({"message": "Comunidad creada exitosamente", "id": comm_id, "slug": slug}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>', methods=['GET'])
def get_community(comm_id):
    try:
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({"error": "No autorizado. Debe iniciar sesión."}), 401

        sql = """
            SELECT c.id, c.name, c.slug, c.description, c.city, c.logo_url, c.cover_url,
                   c.is_active, c.created_at,
                   (SELECT COUNT(*) FROM community_players cp WHERE cp.community_id = c.id) as total_players,
                   (SELECT COUNT(*) FROM community_polls pol WHERE pol.community_id = c.id) as total_polls,
                   (SELECT COUNT(*) FROM community_polls pol WHERE pol.community_id = c.id AND pol.is_active = 1) as active_polls,
                   (SELECT COUNT(*) FROM community_matches cm WHERE cm.community_id = c.id) as total_matches
            FROM communities c
            WHERE c.id = :id
        """
        row = db.session.execute(text(sql), {"id": comm_id}).fetchone()
        if not row:
            return jsonify({"error": "Comunidad no encontrada"}), 404

        return jsonify({
            "id": row[0],
            "name": row[1],
            "slug": row[2],
            "description": row[3],
            "city": row[4],
            "logo_url": row[5],
            "cover_url": row[6],
            "is_active": bool(row[7]),
            "created_at": str(row[8]),
            "total_players": row[9],
            "total_polls": row[10],
            "active_polls": row[11],
            "total_matches": row[12]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>', methods=['PUT'])
def update_community(comm_id):
    try:
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({"error": "Debe iniciar sesión como superadministrador."}), 401

        user = db.session.execute(text("SELECT id, role FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if not user or user[1] != 'superadmin':
            return jsonify({"error": "Solo un superadministrador puede modificar la comunidad."}), 403

        data = request.json or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "Nombre es requerido"}), 400

        db.session.execute(
            text("""
                UPDATE communities SET
                    name = :name, description = :desc, city = :city,
                    logo_url = :logo, cover_url = :cover, is_active = :active
                WHERE id = :id
            """),
            {
                "name": name,
                "desc": data.get('description'),
                "city": data.get('city'),
                "logo": data.get('logo_url'),
                "cover": data.get('cover_url'),
                "active": 1 if data.get('is_active', True) else 0,
                "id": comm_id
            }
        )
        db.session.commit()
        return jsonify({"message": "Comunidad actualizada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>', methods=['DELETE'])
def delete_community(comm_id):
    try:
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({"error": "Debe iniciar sesión como superadministrador."}), 401

        user = db.session.execute(text("SELECT id, role FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if not user or user[1] != 'superadmin':
            return jsonify({"error": "Solo un superadministrador puede eliminar la comunidad."}), 403

        db.session.execute(text("DELETE FROM community_match_roster WHERE match_id IN (SELECT id FROM community_matches WHERE community_id = :id)"), {"id": comm_id})
        db.session.execute(text("DELETE FROM community_matches WHERE community_id = :id"), {"id": comm_id})
        db.session.execute(text("DELETE FROM community_poll_votes WHERE poll_id IN (SELECT id FROM community_polls WHERE community_id = :id)"), {"id": comm_id})
        db.session.execute(text("DELETE FROM community_poll_options WHERE poll_id IN (SELECT id FROM community_polls WHERE community_id = :id)"), {"id": comm_id})
        db.session.execute(text("DELETE FROM community_polls WHERE community_id = :id"), {"id": comm_id})
        db.session.execute(text("DELETE FROM community_players WHERE community_id = :id"), {"id": comm_id})
        db.session.execute(text("DELETE FROM communities WHERE id = :id"), {"id": comm_id})
        db.session.commit()
        return jsonify({"message": "Comunidad eliminada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- COMMUNITY PLAYERS ---

@app.route('/api/communities/<int:comm_id>/players', methods=['GET'])
def get_community_players(comm_id):
    try:
        sql = """
            SELECT cp.id, cp.community_id, cp.player_id, cp.document_number,
                   cp.full_name, cp.phone, cp.email, cp.position, cp.jersey_number,
                   cp.role, cp.status, cp.joined_at,
                   p.photo_url, p.photo_cutout_url, p.preferred_foot, p.birth_date
            FROM community_players cp
            LEFT JOIN players p ON cp.player_id = p.id OR (p.document_number = cp.document_number AND p.photo_url IS NOT NULL)
            WHERE cp.community_id = :cid
            ORDER BY cp.joined_at DESC
        """
        rows = db.session.execute(text(sql), {"cid": comm_id}).fetchall()
        seen_cp_ids = set()
        players = []
        for r in rows:
            if r[0] in seen_cp_ids:
                continue
            seen_cp_ids.add(r[0])
            players.append({
                "id": r[0],
                "community_id": r[1],
                "player_id": r[2],
                "document_number": r[3],
                "full_name": r[4],
                "phone": r[5],
                "email": r[6],
                "position": r[7],
                "jersey_number": r[8],
                "role": r[9],
                "status": r[10],
                "joined_at": r[11].isoformat() if r[11] else None,
                "photo_url": r[12],
                "photo_cutout_url": r[13],
                "preferred_foot": r[14],
                "birth_date": r[15].strftime('%Y-%m-%d') if r[15] else None
            })
        return jsonify(players)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>/players', methods=['POST'])
def add_community_player(comm_id):
    try:
        data = request.json or {}
        doc_num = data.get('document_number')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        full_name = data.get('full_name')

        if (first_name or last_name):
            full_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
        elif full_name:
            parts = full_name.strip().split(' ')
            first_name = parts[0]
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
        else:
            first_name = ''
            last_name = ''

        if not doc_num or not full_name:
            return jsonify({"error": "Documento, nombres y apellidos son requeridos"}), 400

        doc_str = str(doc_num).split('.')[0].strip()

        exist = db.session.execute(
            text("SELECT id FROM community_players WHERE community_id = :cid AND document_number = :doc"),
            {"cid": comm_id, "doc": doc_str}
        ).fetchone()
        if exist:
            return jsonify({"error": "El jugador ya está inscrito en esta comunidad"}), 400

        global_p = db.session.execute(
            text("SELECT id, photo_url FROM players WHERE document_number = :doc LIMIT 1"),
            {"doc": doc_str}
        ).fetchone()

        player_id = None
        if global_p:
            player_id = global_p[0]
        else:
            res_p = db.session.execute(
                text("""
                    INSERT INTO players (document_number, full_name, first_name, last_name, phone, email, position,
                                        birth_date, preferred_foot, blood_type)
                    VALUES (:doc, :name, :fn, :ln, :phone, :email, :pos, :bdate, :foot, :blood)
                """),
                {
                    "doc": doc_str, "name": full_name, "fn": first_name, "ln": last_name, "phone": data.get('phone'),
                    "email": data.get('email'), "pos": data.get('position'),
                    "bdate": data.get('birth_date') or None,
                    "foot": data.get('preferred_foot'), "blood": data.get('blood_type')
                }
            )
            player_id = res_p.lastrowid

        res = db.session.execute(
            text("""
                INSERT INTO community_players (community_id, player_id, document_number, full_name,
                                              phone, email, position, jersey_number, role, status)
                VALUES (:cid, :pid, :doc, :name, :phone, :email, :pos, :jersey, :role, 'ACTIVE')
            """),
            {
                "cid": comm_id, "pid": player_id, "doc": doc_str, "name": full_name,
                "phone": data.get('phone'), "email": data.get('email'),
                "pos": data.get('position'), "jersey": sanitize_int(data.get('jersey_number')),
                "role": data.get('role') or 'MEMBER'
            }
        )
        db.session.commit()
        return jsonify({"message": "Jugador inscrito en la comunidad", "id": res.lastrowid}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>/players/import-excel', methods=['POST'])
def import_community_players_excel(comm_id):
    if 'file' not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400
    file = request.files['file']
    result = process_player_excel_import(file, target_community_id=comm_id)
    if not result.get('success'):
        return jsonify(result), 400
    return jsonify(result), 200

@app.route('/api/communities/<int:comm_id>/players/<int:cp_id>', methods=['PUT'])
def update_community_player(comm_id, cp_id):
    try:
        data = request.json or {}
        db.session.execute(
            text("""
                UPDATE community_players SET
                    role = COALESCE(:role, role),
                    status = COALESCE(:status, status),
                    jersey_number = :jersey,
                    position = COALESCE(:pos, position)
                WHERE id = :id AND community_id = :cid
            """),
            {
                "role": data.get('role'),
                "status": data.get('status'),
                "jersey": sanitize_int(data.get('jersey_number')),
                "pos": data.get('position'),
                "id": cp_id,
                "cid": comm_id
            }
        )
        db.session.commit()
        return jsonify({"message": "Miembro actualizado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>/players/<int:cp_id>', methods=['DELETE'])
def remove_community_player(comm_id, cp_id):
    try:
        db.session.execute(
            text("DELETE FROM community_match_roster WHERE community_player_id = :id"),
            {"id": cp_id}
        )
        db.session.execute(
            text("DELETE FROM community_players WHERE id = :id AND community_id = :cid"),
            {"id": cp_id, "cid": comm_id}
        )
        db.session.commit()
        return jsonify({"message": "Jugador removido de la comunidad"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- COMMUNITY POLLS ---

@app.route('/api/communities/<int:comm_id>/polls', methods=['GET'])
def get_community_polls(comm_id):
    try:
        voter_id = request.headers.get('X-User-ID') or request.args.get('voter_id') or 'anon'

        polls_res = db.session.execute(
            text("SELECT id, question, description, is_active, expires_at, created_by, created_at FROM community_polls WHERE community_id = :cid ORDER BY created_at DESC"),
            {"cid": comm_id}
        ).fetchall()

        polls = []
        for p in polls_res:
            poll_id = p[0]
            options_res = db.session.execute(
                text("SELECT id, option_text, votes_count FROM community_poll_options WHERE poll_id = :pid ORDER BY id ASC"),
                {"pid": poll_id}
            ).fetchall()

            total_votes = sum(o[2] for o in options_res)

            user_voted_option = db.session.execute(
                text("SELECT option_id FROM community_poll_votes WHERE poll_id = :pid AND voter_identifier = :vid LIMIT 1"),
                {"pid": poll_id, "vid": str(voter_id)}
            ).fetchone()

            options = []
            for o in options_res:
                cnt = o[2]
                pct = round((cnt / total_votes * 100), 1) if total_votes > 0 else 0
                options.append({
                    "id": o[0],
                    "option_text": o[1],
                    "votes_count": cnt,
                    "percentage": pct
                })

            polls.append({
                "id": poll_id,
                "question": p[1],
                "description": p[2],
                "is_active": bool(p[3]),
                "expires_at": p[4].isoformat() if p[4] else None,
                "created_by": p[5],
                "created_at": p[6].isoformat() if p[6] else None,
                "total_votes": total_votes,
                "user_voted_option_id": user_voted_option[0] if user_voted_option else None,
                "options": options
            })

        return jsonify(polls)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>/polls', methods=['POST'])
def create_community_poll(comm_id):
    try:
        data = request.json or {}
        question = (data.get('question') or '').strip()
        options = data.get('options') or []

        if not question:
            return jsonify({"error": "La pregunta de la encuesta es requerida"}), 400
        if len(options) < 2:
            return jsonify({"error": "Debes agregar al menos 2 opciones de respuesta"}), 400

        user = request.headers.get('X-User-ID') or 'Admin'

        res = db.session.execute(
            text("""
                INSERT INTO community_polls (community_id, question, description, expires_at, created_by)
                VALUES (:cid, :q, :desc, :exp, :user)
            """),
            {
                "cid": comm_id, "q": question, "desc": data.get('description'),
                "exp": data.get('expires_at') or None, "user": user
            }
        )
        poll_id = res.lastrowid

        for opt in options:
            opt_text = str(opt).strip()
            if opt_text:
                db.session.execute(
                    text("INSERT INTO community_poll_options (poll_id, option_text) VALUES (:pid, :text)"),
                    {"pid": poll_id, "text": opt_text}
                )

        db.session.commit()
        return jsonify({"message": "Encuesta creada exitosamente", "id": poll_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/polls/<int:poll_id>/vote', methods=['POST'])
def vote_community_poll(poll_id):
    try:
        data = request.json or {}
        option_id = data.get('option_id')
        voter_id = data.get('voter_identifier') or request.headers.get('X-User-ID') or request.remote_addr or 'anon'
        voter_name = data.get('voter_name') or 'Usuario'

        if not option_id:
            return jsonify({"error": "Opción no seleccionada"}), 400

        poll = db.session.execute(text("SELECT is_active, expires_at FROM community_polls WHERE id = :id"), {"id": poll_id}).fetchone()
        if not poll or not poll[0]:
            return jsonify({"error": "Esta encuesta ya no está activa"}), 400
        if poll[1] and datetime.now() > poll[1]:
            return jsonify({"error": "La encuesta ya ha expirado"}), 400

        existing_vote = db.session.execute(
            text("SELECT id, option_id FROM community_poll_votes WHERE poll_id = :pid AND voter_identifier = :vid"),
            {"pid": poll_id, "vid": str(voter_id)}
        ).fetchone()

        if existing_vote:
            old_opt_id = existing_vote[1]
            if old_opt_id == option_id:
                return jsonify({"message": "Ya habías votado por esta opción"}), 200
            db.session.execute(
                text("UPDATE community_poll_options SET votes_count = GREATEST(0, votes_count - 1) WHERE id = :oid"),
                {"oid": old_opt_id}
            )
            db.session.execute(
                text("UPDATE community_poll_votes SET option_id = :oid WHERE id = :vid"),
                {"oid": option_id, "vid": existing_vote[0]}
            )
        else:
            db.session.execute(
                text("""
                    INSERT INTO community_poll_votes (poll_id, option_id, voter_identifier, voter_name)
                    VALUES (:pid, :oid, :vid, :vname)
                """),
                {"pid": poll_id, "oid": option_id, "vid": str(voter_id), "vname": voter_name}
            )

        db.session.execute(
            text("UPDATE community_poll_options SET votes_count = votes_count + 1 WHERE id = :oid"),
            {"oid": option_id}
        )
        db.session.commit()
        return jsonify({"message": "Voto registrado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/polls/<int:poll_id>/toggle', methods=['PATCH'])
def toggle_community_poll(poll_id):
    try:
        poll = db.session.execute(text("SELECT is_active FROM community_polls WHERE id = :id"), {"id": poll_id}).fetchone()
        if not poll:
            return jsonify({"error": "Encuesta no encontrada"}), 404
        new_status = 0 if poll[0] else 1
        db.session.execute(text("UPDATE community_polls SET is_active = :st WHERE id = :id"), {"st": new_status, "id": poll_id})
        db.session.commit()
        return jsonify({"message": "Estado de encuesta actualizado", "is_active": bool(new_status)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/polls/<int:poll_id>', methods=['DELETE'])
def delete_community_poll(poll_id):
    try:
        db.session.execute(text("DELETE FROM community_poll_votes WHERE poll_id = :id"), {"id": poll_id})
        db.session.execute(text("DELETE FROM community_poll_options WHERE poll_id = :id"), {"id": poll_id})
        db.session.execute(text("DELETE FROM community_polls WHERE id = :id"), {"id": poll_id})
        db.session.commit()
        return jsonify({"message": "Encuesta eliminada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- COMMUNITY MATCHES ---

@app.route('/api/communities/<int:comm_id>/matches', methods=['GET'])
def get_community_matches(comm_id):
    try:
        sql = """
            SELECT id, title, match_date, location, team_a_name, team_b_name,
                   team_a_score, team_b_score, status, notes, created_at
            FROM community_matches
            WHERE community_id = :cid
            ORDER BY match_date DESC
        """
        rows = db.session.execute(text(sql), {"cid": comm_id}).fetchall()
        matches = []
        for r in rows:
            m_id = r[0]
            roster_rows = db.session.execute(
                text("""
                    SELECT cmr.id, cmr.community_player_id, cmr.team_side, cmr.goals,
                           cp.full_name, cp.position, cp.jersey_number
                    FROM community_match_roster cmr
                    JOIN community_players cp ON cmr.community_player_id = cp.id
                    WHERE cmr.match_id = :mid
                """),
                {"mid": m_id}
            ).fetchall()

            team_a_players = []
            team_b_players = []
            for ply in roster_rows:
                p_obj = {
                    "roster_id": ply[0],
                    "community_player_id": ply[1],
                    "team_side": ply[2],
                    "goals": ply[3],
                    "full_name": ply[4],
                    "position": ply[5],
                    "jersey_number": ply[6]
                }
                if ply[2] == 'A':
                    team_a_players.append(p_obj)
                else:
                    team_b_players.append(p_obj)

            matches.append({
                "id": m_id,
                "title": r[1],
                "match_date": r[2].isoformat() if r[2] else None,
                "location": r[3],
                "team_a_name": r[4] or 'Equipo A',
                "team_b_name": r[5] or 'Equipo B',
                "team_a_score": r[6],
                "team_b_score": r[7],
                "status": r[8] or 'SCHEDULED',
                "notes": r[9],
                "created_at": r[10].isoformat() if r[10] else None,
                "team_a_players": team_a_players,
                "team_b_players": team_b_players
            })
        return jsonify(matches)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/<int:comm_id>/matches', methods=['POST'])
def create_community_match(comm_id):
    try:
        data = request.json or {}
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({"error": "Título del encuentro es requerido"}), 400

        res = db.session.execute(
            text("""
                INSERT INTO community_matches (community_id, title, match_date, location,
                                               team_a_name, team_b_name, notes, status)
                VALUES (:cid, :title, :mdate, :loc, :ta, :tb, :notes, 'SCHEDULED')
            """),
            {
                "cid": comm_id, "title": title, "mdate": data.get('match_date') or None,
                "loc": data.get('location'), "ta": data.get('team_a_name') or 'Equipo A',
                "tb": data.get('team_b_name') or 'Equipo B', "notes": data.get('notes')
            }
        )
        match_id = res.lastrowid
        db.session.commit()
        return jsonify({"message": "Encuentro deportivo creado exitosamente", "id": match_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/matches/<int:match_id>', methods=['PUT'])
def update_community_match(match_id):
    try:
        data = request.json or {}
        db.session.execute(
            text("""
                UPDATE community_matches SET
                    title = COALESCE(:title, title),
                    match_date = COALESCE(:mdate, match_date),
                    location = COALESCE(:loc, location),
                    team_a_name = COALESCE(:ta, team_a_name),
                    team_b_name = COALESCE(:tb, team_b_name),
                    team_a_score = :score_a,
                    team_b_score = :score_b,
                    status = COALESCE(:status, status),
                    notes = COALESCE(:notes, notes)
                WHERE id = :id
            """),
            {
                "title": data.get('title'), "mdate": data.get('match_date'),
                "loc": data.get('location'), "ta": data.get('team_a_name'),
                "tb": data.get('team_b_name'),
                "score_a": sanitize_int(data.get('team_a_score')) if data.get('team_a_score') is not None else 0,
                "score_b": sanitize_int(data.get('team_b_score')) if data.get('team_b_score') is not None else 0,
                "status": data.get('status'), "notes": data.get('notes'),
                "id": match_id
            }
        )
        db.session.commit()
        return jsonify({"message": "Encuentro actualizado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/matches/<int:match_id>/roster', methods=['POST'])
def set_community_match_roster(match_id):
    try:
        data = request.json or {}
        players = data.get('players') or []

        db.session.execute(text("DELETE FROM community_match_roster WHERE match_id = :mid"), {"mid": match_id})

        for p in players:
            cpid = p.get('community_player_id')
            side = p.get('team_side', 'A')
            goals = sanitize_int(p.get('goals')) or 0
            if cpid:
                db.session.execute(
                    text("""
                        INSERT INTO community_match_roster (match_id, community_player_id, team_side, goals)
                        VALUES (:mid, :cpid, :side, :goals)
                    """),
                    {"mid": match_id, "cpid": cpid, "side": side, "goals": goals}
                )

        db.session.commit()
        return jsonify({"message": "Nómina del encuentro actualizada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/communities/matches/<int:match_id>', methods=['DELETE'])
def delete_community_match(match_id):
    try:
        db.session.execute(text("DELETE FROM community_match_roster WHERE match_id = :id"), {"id": match_id})
        db.session.execute(text("DELETE FROM community_matches WHERE id = :id"), {"id": match_id})
        db.session.commit()
        return jsonify({"message": "Encuentro eliminado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
