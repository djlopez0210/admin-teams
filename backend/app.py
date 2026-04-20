import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import text
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@localhost/football_team')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.getenv('SECRET_KEY', 'dev_secret_key_123')

db = SQLAlchemy(app)

# Upload Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
        db.session.execute(text("CREATE TABLE IF NOT EXISTS tournament_phases (id INT AUTO_INCREMENT PRIMARY KEY, tournament_id INT, name VARCHAR(100), phase_order INT DEFAULT 1, phase_type VARCHAR(50) DEFAULT 'ROUND_ROBIN', status VARCHAR(50) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS tournament_groups (id INT AUTO_INCREMENT PRIMARY KEY, tournament_id INT, phase_id INT, name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        db.session.execute(text("CREATE TABLE IF NOT EXISTS group_teams (group_id INT, team_id INT, points INT DEFAULT 0, goals_for INT DEFAULT 0, goals_against INT DEFAULT 0, matches_played INT DEFAULT 0, PRIMARY KEY (group_id, team_id))"))

        # Schema Upgrades (Add missing columns)
        upgrades = [
            # Tournaments
            "ALTER TABLE tournaments ADD COLUMN rules_pdf_url TEXT",
            "ALTER TABLE tournaments ADD COLUMN registration_open BOOLEAN DEFAULT 1",
            "ALTER TABLE tournaments ADD COLUMN image_url TEXT AFTER description",
            "ALTER TABLE tournaments ADD COLUMN win_points INT DEFAULT 3",
            "ALTER TABLE tournaments ADD COLUMN draw_points INT DEFAULT 1",
            "ALTER TABLE tournaments ADD COLUMN loss_points INT DEFAULT 0",
            "ALTER TABLE tournaments ADD COLUMN format_type VARCHAR(50) DEFAULT 'league'",
            # Referees
            "ALTER TABLE referees ADD COLUMN tournament_id INT",
            "ALTER TABLE referees ADD COLUMN age INT",
            "ALTER TABLE referees ADD COLUMN address VARCHAR(255)",
            # Teams
            "ALTER TABLE teams ADD COLUMN delegate_document VARCHAR(50)",
            "ALTER TABLE teams ADD COLUMN delegate_name VARCHAR(100)",
            "ALTER TABLE teams ADD COLUMN delegate_email VARCHAR(100)",
            "ALTER TABLE teams ADD COLUMN registration_pin VARCHAR(20)",
            "ALTER TABLE teams ADD COLUMN logo_url TEXT",
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
        ]

        for q in upgrades:
            try:
                db.session.execute(text(q))
                db.session.commit()
            except Exception:
                db.session.rollback()

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

def get_team_id_from_slug(slug):
    result = db.session.execute(text("SELECT id FROM teams WHERE slug = :slug"), {"slug": slug}).fetchone()
    return result[0] if result else None

def get_tournament_id_from_slug(slug):
    result = db.session.execute(text("SELECT id FROM tournaments WHERE slug = :slug"), {"slug": slug}).fetchone()
    return result[0] if result else None

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
def check_document(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    data = request.json
    doc_number = data.get('document_number')
    if not doc_number:
        return jsonify({"error": "Document number is required"}), 400
    
    result = db.session.execute(
        text("SELECT last_registration_date FROM players WHERE team_id = :team AND document_number = :doc"),
        {"team": team_id, "doc": doc_number}
    ).fetchone()
    
    if not result:
        return jsonify({"status": "disponible", "message": "Documento no registrado"}), 200
    
    last_reg = result[0]
    days_passed = (datetime.now() - last_reg).days
    
    if days_passed < 15:
        return jsonify({
            "status": "bloqueado",
            "days_remaining": 15 - days_passed,
            "message": f"Este documento ya está registrado. Podrá registrarse nuevamente en {15 - days_passed} días"
        }), 200
    else:
        return jsonify({
            "status": "puede_re_registrar",
            "message": "Puede volver a registrarse y actualizar sus datos."
        }), 200

@app.route('/api/<string:team_slug>/players', methods=['POST'])
def register_player(team_slug):
    team_id = get_team_id_from_slug(team_slug)
    if not team_id: return jsonify({"error": "Team not found"}), 404
    try:
        data = request.json or {}
        doc_num = data.get('document_number')
        if not doc_num:
            return jsonify({"error": "Número de documento es requerido"}), 400
        
        # 0. Sanitize and Extract
        def sanitize_int(val):
            if val is None or val == '': return None
            try: return int(val)
            except: return None

        full_name = data.get('full_name') or 'Sin nombre'
        doc_type = data.get('document_type') or 'Otro'
        unif_size = data.get('uniform_size') or 'M'
        
        primary_pos_id = sanitize_int(data.get('primary_position_id'))
        secondary_pos_id = sanitize_int(data.get('secondary_position_id'))
        uniform_num = sanitize_int(data.get('uniform_number'))
        
        # Default payment fields for public registration
        payment_status = 'Pendiente'
        payment_amount = 0.0

        if not uniform_num or not primary_pos_id:
            return jsonify({"error": "Número de uniforme y posición principal son requeridos"}), 400

        # 1. Check existing
        sql_check = "SELECT id, last_registration_date, uniform_number FROM players WHERE team_id = :team AND document_number = :doc"
        existing_row = db.session.execute(text(sql_check), {"team": team_id, "doc": doc_num}).fetchone()
        
        if existing_row:
            player_id = existing_row[0]
            last_reg = existing_row[1]
            old_uniform = existing_row[2]
            
            if (datetime.now() - last_reg).days < 15:
                days_left = 15 - (datetime.now() - last_reg).days
                return jsonify({"error": f"Bloqueado. Podrá registrarse en {days_left} días"}), 400
            
            # History logic
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

            # Update
            db.session.execute(
                text("""UPDATE players SET 
                     document_type = :type, full_name = :name, address = :addr, neighborhood = :barrio,
                     phone = :phone, eps = :eps, uniform_size = :size, uniform_number = :unif,
                     primary_position_id = :p1, secondary_position_id = :p2, 
                     last_registration_date = CURRENT_TIMESTAMP
                     WHERE id = :id AND team_id = :team"""),
                {
                    "type": doc_type, "name": full_name, "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size, 
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "id": player_id, "team": team_id
                }
            )
        else:
            # New
            db.session.execute(
                text("""INSERT INTO players 
                     (team_id, document_type, document_number, full_name, address, neighborhood, phone, eps, uniform_size, uniform_number, primary_position_id, secondary_position_id, payment_status, payment_amount)
                     VALUES (:team, :type, :doc, :name, :addr, :barrio, :phone, :eps, :size, :unif, :p1, :p2, :ps, :pa)"""),
                {
                    "team": team_id, "type": doc_type, "doc": doc_num, "name": full_name, "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size, 
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "ps": payment_status, "pa": payment_amount
                }
            )
        
        db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": uniform_num})
        db.session.commit()
        log_activity(team_id, "REGISTER_PLAYER", f"Player {full_name} registered (Doc: {doc_num})")
        return jsonify({"message": "Player registered successfully"}), 201
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
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    try:
        # Check if player exists and belongs to team
        curr = db.session.execute(text("SELECT team_id, uniform_number, full_name FROM players WHERE id = :id"), {"id": p_id}).fetchone()
        if not curr or str(curr[0]) != str(team_id):
            return jsonify({"error": "Player not found or unauthorized"}), 404
        
        old_uniform = curr[1]
        new_uniform = sanitize_int(data.get('uniform_number'))
        
        # Handle uniform change
        if new_uniform != old_uniform:
            # Check if new number is available
            avail = db.session.execute(
                text("SELECT is_available FROM uniform_numbers WHERE team_id = :team AND number = :n"),
                {"team": team_id, "n": new_uniform}
            ).fetchone()
            if not avail or not avail[0]:
                return jsonify({"error": f"El número {new_uniform} no está disponible"}), 400
            
            # Swap
            db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": old_uniform})
            db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": new_uniform})

        # Update player data
        db.session.execute(
            text("""UPDATE players SET 
                 document_type = :type, document_number = :doc, full_name = :name, 
                 phone = :phone, eps = :eps, uniform_size = :size, uniform_number = :unif,
                 primary_position_id = :p1, secondary_position_id = :p2
                 WHERE id = :id AND team_id = :team"""),
            {
                "type": data.get('document_type'), "doc": data.get('document_number'),
                "name": data.get('full_name'), "phone": data.get('phone'),
                "eps": data.get('eps'), "size": data.get('uniform_size'),
                "unif": new_uniform, "p1": sanitize_int(data.get('primary_position_id')),
                "p2": sanitize_int(data.get('secondary_position_id')),
                "id": p_id, "team": team_id
            }
        )
        
        db.session.commit()
        log_activity(team_id, "EDIT_PLAYER", f"Information updated for player: {curr[2]} (ID: {p_id})")
        return jsonify({"message": "Player updated successfully"})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/players/<int:p_id>', methods=['DELETE'])
def delete_player(p_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    
    player = db.session.execute(text("SELECT uniform_number FROM players WHERE id = :id AND team_id = :team"), {"id": p_id, "team": team_id}).fetchone()
    if player:
        unif = player[0]
        db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE team_id = :team AND number = :n"), {"team": team_id, "n": unif})
        db.session.execute(text("DELETE FROM players WHERE id = :id AND team_id = :team"), {"id": p_id, "team": team_id})
        db.session.commit()
        log_activity(team_id, "DELETE_PLAYER", f"Deleted player ID: {p_id}")
        return jsonify({"message": "Player deleted"})
    return jsonify({"error": "Player not found"}), 404

@app.route('/api/players/<int:p_id>/history', methods=['GET'])
def get_player_history(p_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    
    player = db.session.execute(text("SELECT document_number FROM players WHERE id = :id AND team_id = :team"), {"id": p_id, "team": team_id}).fetchone()
    if not player: return jsonify({"error": "Player not found"}), 404
    
    result = db.session.execute(
        text("SELECT * FROM player_history WHERE team_id = :team AND document_number = :doc ORDER BY registered_date DESC"),
        {"team": team_id, "doc": player[0]}
    )
    columns = result.keys()
    history = [dict(zip(columns, row)) for row in result]
    return jsonify(history)

@app.route('/api/players/<int:p_id>/payment', methods=['PATCH'])
def update_payment(p_id):
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        data = request.json
        status = data.get('payment_status')
        amount = data.get('payment_amount')
        
        db.session.execute(
            text("UPDATE players SET payment_status = :status, payment_amount = :amount WHERE id = :id AND team_id = :team"),
            {"status": status, "amount": amount, "id": p_id, "team": team_id}
        )
        db.session.commit()
        log_activity(team_id, "UPDATE_PAYMENT", f"Updated payment for player ID {p_id} to {status} (${amount})")
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
        # Consulta cruda directa
        res = db.session.execute(text("SELECT id, full_name, document_number, uniform_number, position FROM players WHERE team_id = :t"), {"t": team_id}).fetchall()
        players = []
        for r in res:
            players.append({
                "id": r[0],
                "full_name": r[1],
                "document_number": r[2],
                "uniform_number": r[3],
                "position": r[4]
            })
        return jsonify(players)
    except Exception as e:
        print(f"FATAL ERROR PLAYERS: {e}")
        return jsonify({"error": str(e)}), 500

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
        "SELECT id, name, phase_order, phase_type, status FROM tournament_phases WHERE tournament_id = :id ORDER BY phase_order ASC"
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
            "id": p_id, "name": p[1], "order": p[2], "type": p[3], "status": p[4], "groups": groups
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
            "INSERT INTO tournament_phases (tournament_id, name, phase_order, phase_type) "
            "VALUES (:t_id, :name, :order, :type)"
        ), {
            "t_id": t_id, "name": data.get('name'), "order": data.get('order', 1), "type": data.get('type', 'ROUND_ROBIN')
        })
        phase_id = result.lastrowid
        db.session.commit()
        return jsonify({"message": "Phase created", "phase_id": phase_id}), 201
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
            "SELECT phase_id, tournament_id FROM tournament_groups WHERE id = :gid"
        ), {"gid": group_id}).fetchone()
        if not info: return jsonify({"error": "Group not found"}), 404
        p_id, t_id = info

        # NEW VALIDATION: Cannot re-draw if matches started/finished
        check_progress = db.session.execute(text(
            "SELECT id FROM matches WHERE group_id = :gid AND status IN ('IN_PROGRESS', 'COMPLETED')"
        ), {"gid": group_id}).fetchone()
        if check_progress:
            return jsonify({"error": "No se pueden re-sortear grupos con partidos ya iniciados o finalizados."}), 400
        
        teams_res = db.session.execute(text(
            "SELECT team_id FROM group_teams WHERE group_id = :gid"
        ), {"gid": group_id}).fetchall()
        teams = [t[0] for t in teams_res]
        
        if len(teams) < 2:
            return jsonify({"error": "Need at least 2 teams in the group"}), 400
            
        # Clone teams and shuffle for randomization if desired, but Round Robin is systematic
        # If we want it "random" we can shuffle once at start
        import random
        random.shuffle(teams)

        if len(teams) % 2 != 0:
            teams.append(None) # Bye team for odd number
            
        n = len(teams)
        rounds = n - 1
        matches_per_round = n // 2
        
        # Round Robin Algorithm (Polygon Method)
        generated_matches = []
        for r in range(rounds):
            for i in range(matches_per_round):
                home_id = teams[i]
                away_id = teams[n - 1 - i]
                
                if home_id is not None and away_id is not None:
                    db.session.execute(text(
                        "INSERT INTO matches (tournament_id, phase_id, group_id, home_team_id, away_team_id, match_day, status) "
                        "VALUES (:t_id, :p_id, :g_id, :home, :away, :day, 'SCHEDULED')"
                    ), {
                        "t_id": t_id, "p_id": p_id, "g_id": group_id,
                        "home": home_id, "away": away_id, "day": r + 1
                    })
                    
                    # Fetch names and logos for animation
                    h_res = db.session.execute(text("SELECT name, logo_url FROM teams WHERE id = :id"), {"id": home_id}).fetchone()
                    a_res = db.session.execute(text("SELECT name, logo_url FROM teams WHERE id = :id"), {"id": away_id}).fetchone()
                    
                    generated_matches.append({
                        "home": h_res[0], "home_logo": h_res[1],
                        "away": a_res[0], "away_logo": a_res[1],
                        "day": r + 1
                    })
            # Rotate teams
            teams = [teams[0]] + [teams[-1]] + teams[1:-1]
            
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
        if not phase: return jsonify({"error": "Phase not found"}), 404
        t_id = phase[0]
        
        # Get groups in this phase
        groups = db.session.execute(text("SELECT id FROM tournament_groups WHERE phase_id = :pid"), {"pid": phase_id}).fetchall()
        if not groups: return jsonify({"error": "Create groups first"}), 400
        group_ids = [g[0] for g in groups]
        
        # Get all unassigned teams in the tournament
        assigned_result = db.session.execute(text(
            "SELECT team_id FROM group_teams gt JOIN tournament_groups tg ON gt.group_id = tg.id WHERE tg.phase_id = :pid"
        ), {"pid": phase_id}).fetchall()
        assigned_teams = [r[0] for r in assigned_result]
        
        all_teams = db.session.execute(text("SELECT id FROM teams WHERE tournament_id = :tid"), {"tid": t_id}).fetchall()
        print(f"DEBUG DRAW - Phase ID: {phase_id}, T_ID: {t_id}, All Teams: {all_teams}, Assigned: {assigned_teams}", flush=True)
        unassigned_teams = [t[0] for t in all_teams if t[0] not in assigned_teams]
        
        print(f"DEBUG DRAW - Unassigned Teams: {unassigned_teams}", flush=True)
        if not unassigned_teams:
            return jsonify({"message": "No unassigned teams remaining"}), 200
            
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


@app.route('/api/settings', methods=['GET'])
def get_settings():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    sql = """
        SELECT s.team_id, s.team_name, s.team_logo_url, s.favicon_url, s.updated_at, t.registration_pin 
        FROM settings s JOIN teams t ON s.team_id = t.id 
        WHERE s.team_id = :team
    """
    row = db.session.execute(text(sql), {"team": team_id}).fetchone()
    if row:
        cols = ['team_id', 'team_name', 'team_logo_url', 'favicon_url', 'updated_at', 'registration_pin']
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
            SELECT u.id, u.password_hash, u.team_id, t.slug as team_slug, u.role, u.username, u.tournament_id, tr.slug as tournament_slug
            FROM users u 
            LEFT JOIN teams t ON u.team_id = t.id 
            LEFT JOIN tournaments tr ON u.tournament_id = tr.id
            WHERE u.username = :user
        """
        result = db.session.execute(text(sql), {"user": username}).fetchone()
        
        if not result:
            print(f"Login failed: User {username} not found")
            return jsonify({"error": "Invalid credentials"}), 401
            
        user_id = result[0]
        stored_hash = result[1]
        team_id = result[2]
        team_slug = result[3]
        role = result[4]
        db_username = result[5]
        user_tournament_id = result[6]
        tournament_slug = result[7]

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
                "username": db_username
            }), 200

        print(f"Login failed: Incorrect password for {username}")
        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        print(f"CRITICAL LOGIN ERROR: {e}")
        return jsonify({"error": "Internal server error"}), 500

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
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        tournament_id = data.get('tournament_id')
        # Ensure tournament_id is a valid integer or None
        t_id = int(tournament_id) if tournament_id and str(tournament_id).isdigit() else None
        reg_pin = data.get('registration_pin')
        
        # New Delegate Fields
        del_doc = data.get('delegate_document')
        del_name = data.get('delegate_name')
        del_email = data.get('delegate_email')
        
        if not all([name, slug, admin_user, admin_pass]):
            return jsonify({"error": "Name, Admin User and Password are required"}), 400
            
        # Check if registration is open (only if tournament is selected)
        if t_id:
            reg = db.session.execute(text("SELECT registration_open FROM tournaments WHERE id = :tid"), {"tid": t_id}).fetchone()
            if reg and not reg[0]:
                return jsonify({"error": "El registro está cerrado para este torneo."}), 403

        # 1. Create Team
        res = db.session.execute(
            text("""INSERT INTO teams 
                 (name, slug, tournament_id, delegate_document, delegate_name, delegate_email, registration_pin, logo_url) 
                 VALUES (:name, :slug, :tid, :ddoc, :dname, :demail, :pin, :logo)"""),
            {"name": name, "slug": slug, "tid": t_id, "ddoc": del_doc, "dname": del_name, "demail": del_email, "pin": reg_pin or None, "logo": data.get('logo_url')}
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
        return jsonify({"message": "Team created successfully", "id": team_id}), 201
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL ERROR CREATING TEAM: {e}")
        return jsonify({"error": str(e)}), 500
            
        # 5. Initialize Uniform Numbers (0-100)
        for i in range(0, 101):
            db.session.execute(
                text("INSERT INTO uniform_numbers (team_id, number) VALUES (:tid, :n)"),
                {"tid": team_id, "n": i}
            )
            
        db.session.commit()
        return jsonify({"message": f"Team {name} created successfully with admin {admin_user}", "team_id": team_id}), 201
    except Exception as e:
        db.session.rollback()
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
                    registration_pin = :pin
                    WHERE id = :tid"""),
            {
                "name": name, "slug": slug, 
                "ddoc": data.get('delegate_document'),
                "dname": data.get('delegate_name'),
                "demail": data.get('delegate_email'),
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

@app.route('/api/logs', methods=['GET'])
def get_logs():
    team_id = request.headers.get('X-Team-ID')
    if not team_id: return jsonify({"error": "Unauthorized"}), 401
    result = db.session.execute(text("SELECT * FROM activity_logs WHERE team_id = :team ORDER BY created_at DESC LIMIT 50"), {"team": team_id})
    columns = result.keys()
    logs = [dict(zip(columns, row)) for row in result]
    return jsonify(logs)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
