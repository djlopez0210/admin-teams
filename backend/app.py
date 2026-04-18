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
    slug = name.lower().replace(" ", "-") # Basic slug
    
    try:
        # 1. Create tournament
        res = db.session.execute(
            text("""INSERT INTO tournaments 
                 (name, slug, city, description, image_url, rules_pdf_url, win_points, draw_points, loss_points) 
                 VALUES (:n, :s, :city, :desc, :img, :pdf, :w, :d, :l)"""),
            {
                "n": name, "s": slug, "city": data.get('city'), 
                "desc": data.get('description'), "img": data.get('image_url'),
                "pdf": data.get('rules_pdf_url'),
                "w": data.get('win_points', 3), "d": data.get('draw_points', 1), "l": data.get('loss_points', 0)
            }
        )
        t_id = db.session.execute(text("SELECT LAST_INSERT_ID()")).scalar()

        # 2. Create Tournament Admin User
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        if admin_user and admin_pass:
            pass_hash = generate_password_hash(admin_pass)
            db.session.execute(
                text("INSERT INTO users (username, password_hash, role, tournament_id) VALUES (:u, :p, 'tournament_admin', :tid)"),
                {"u": admin_user, "p": pass_hash, "tid": t_id}
            )

        db.session.commit()
        return jsonify({"message": "Tournament created successfully", "id": t_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tournaments/<int:t_id>', methods=['PUT'])
def update_tournament(t_id):
    data = request.json
    try:
        # Update tournament data
        db.session.execute(
            text("""UPDATE tournaments 
                 SET name = :n, city = :city, description = :desc, image_url = :img, rules_pdf_url = :pdf,
                     win_points = :w, draw_points = :d, loss_points = :l
                 WHERE id = :id"""),
            {
                "id": t_id, "n": data.get('name'), "city": data.get('city'), 
                "desc": data.get('description'), "img": data.get('image_url'),
                "pdf": data.get('rules_pdf_url'),
                "w": data.get('win_points'), "d": data.get('draw_points'), "l": data.get('loss_points')
            }
        )

        # Update or create Admin User
        admin_user = data.get('admin_username')
        admin_pass = data.get('admin_password')
        if admin_user:
            # Check if exists
            existing_user = db.session.execute(text("SELECT id FROM users WHERE tournament_id = :tid"), {"tid": t_id}).scalar()
            if existing_user:
                if admin_pass: # Only update password if provided
                    pass_hash = generate_password_hash(admin_pass)
                    db.session.execute(text("UPDATE users SET username = :u, password_hash = :p WHERE id = :uid"), {"u": admin_user, "p": pass_hash, "uid": existing_user})
                else: # Only update username
                    db.session.execute(text("UPDATE users SET username = :u WHERE id = :uid"), {"u": admin_user, "uid": existing_user})
            else:
                if admin_pass:
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

@app.route('/api/tournaments', methods=['GET'])
def list_tournaments():
    result = db.session.execute(text("SELECT * FROM tournaments ORDER BY created_at DESC"))
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

@app.route('/api/tournaments/<string:slug>', methods=['GET'])
def get_tournament(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    row = db.session.execute(
        text("SELECT id, name, slug, city, description, image_url, rules_pdf_url, win_points, draw_points, loss_points, format_type FROM tournaments WHERE id = :id"),
        {"id": t_id}
    ).fetchone()
    
    if row:
        cols = ['id', 'name', 'slug', 'city', 'description', 'image_url', 'rules_pdf_url', 'win_points', 'draw_points', 'loss_points', 'format_type']
        return jsonify(dict(zip(cols, row)))
    return jsonify({"error": "Data not found"}), 404

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

@app.route('/api/tournaments/<string:slug>/standings', methods=['GET'])
def get_tournament_standings(slug):
    t_id = get_tournament_id_from_slug(slug)
    if not t_id: return jsonify({"error": "Tournament not found"}), 404
    
    # 1. Get points config
    t_config = db.session.execute(text("SELECT win_points, draw_points, loss_points FROM tournaments WHERE id = :id"), {"id": t_id}).fetchone()
    w_pts, d_pts, l_pts = t_config[0], t_config[1], t_config[2]
    
    # 2. Get all teams in tournament
    teams_res = db.session.execute(text("SELECT id, name FROM teams WHERE tournament_id = :id"), {"id": t_id}).fetchall()
    standings = {t[0]: {"id": t[0], "name": t[1], "pj": 0, "pg": 0, "pe": 0, "pp": 0, "gf": 0, "gc": 0, "gd": 0, "pts": 0} for t in teams_res}
    
    # 3. Process matches
    matches = db.session.execute(
        text("SELECT home_team_id, away_team_id, home_score, away_score FROM matches WHERE tournament_id = :id AND status = 'jugado'"), 
        {"id": t_id}
    ).fetchall()
    
    for m in matches:
        h_id, a_id, h_score, a_score = m[0], m[1], m[2], m[3]
        if h_id not in standings or a_id not in standings: continue
        
        standings[h_id]["pj"] += 1
        standings[a_id]["pj"] += 1
        standings[h_id]["gf"] += h_score
        standings[h_id]["gc"] += a_score
        standings[a_id]["gf"] += a_score
        standings[a_id]["gc"] += h_score
        standings[h_id]["gd"] = standings[h_id]["gf"] - standings[h_id]["gc"]
        standings[a_id]["gd"] = standings[a_id]["gf"] - standings[a_id]["gc"]
        
        if h_score > a_score:
            standings[h_id]["pg"] += 1
            standings[h_id]["pts"] += w_pts
            standings[a_id]["pp"] += 1
            standings[a_id]["pts"] += l_pts
        elif a_score > h_score:
            standings[a_id]["pg"] += 1
            standings[a_id]["pts"] += w_pts
            standings[h_id]["pp"] += 1
            standings[h_id]["pts"] += l_pts
        else:
            standings[h_id]["pe"] += 1
            standings[h_id]["pts"] += d_pts
            standings[a_id]["pe"] += 1
            standings[a_id]["pts"] += d_pts
            
    # Sort standings: Puntos desc, GD desc, GF desc
    sorted_standings = sorted(standings.values(), key=lambda x: (x["pts"], x["gd"], x["gf"]), reverse=True)
    return jsonify(sorted_standings)

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
        SELECT m.id, m.round_number, m.status, m.match_date, 
               h.name as home_name, a.name as away_name, m.home_score, m.away_score
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        WHERE m.tournament_id = :id
        ORDER BY m.round_number ASC, m.match_date ASC
    """
    result = db.session.execute(text(sql), {"id": t_id}).fetchall()
    fixtures = []
    for row in result:
        fixtures.append({
            "id": row[0], "round": row[1], "status": row[2], 
            "date": row[3].isoformat() if row[3] else None,
            "home": row[4], "away": row[5], "home_score": row[6], "away_score": row[7]
        })
    return jsonify(fixtures)

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
        reg_pin = data.get('registration_pin')
        
        # New Delegate Fields
        del_doc = data.get('delegate_document')
        del_name = data.get('delegate_name')
        del_email = data.get('delegate_email')
        
        if not all([name, slug, admin_user, admin_pass]):
            return jsonify({"error": "Name, Admin User and Password are required"}), 400
            
        # 1. Create Team
        res = db.session.execute(
            text("""INSERT INTO teams 
                 (name, slug, tournament_id, delegate_document, delegate_name, delegate_email, registration_pin) 
                 VALUES (:name, :slug, :tid, :ddoc, :dname, :demail, :pin)"""),
            {"name": name, "slug": slug, "tid": tournament_id, "ddoc": del_doc, "dname": del_name, "demail": del_email, "pin": reg_pin or None}
        )
        team_id = res.lastrowid
        
        # 2. Create Team Admin
        pass_hash = generate_password_hash(admin_pass)
        db.session.execute(
            text("INSERT INTO users (team_id, username, password_hash, role) VALUES (:tid, :user, :hash, 'admin')"),
            {"tid": team_id, "user": admin_user, "hash": pass_hash}
        )
        
        # 3. Initialize Settings
        db.session.execute(
            text("INSERT INTO settings (team_id, team_name) VALUES (:tid, :name)"),
            {"tid": team_id, "name": name}
        )
        
        # 4. Initialize Positions (Default set)
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
    app.run(host='0.0.0.0', port=5000)
