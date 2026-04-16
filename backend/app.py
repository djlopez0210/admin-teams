import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import text
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://team_user:team_password@localhost/football_team')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Upload Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'ico'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper function to Log Activity
def log_activity(action, details=None):
    try:
        db.session.execute(
            text("INSERT INTO activity_logs (action, details) VALUES (:action, :details)"),
            {"action": action, "details": details}
        )
        db.session.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")

# Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# --- POSITIONS ---

@app.route('/api/positions', methods=['GET'])
def get_positions():
    result = db.session.execute(text("SELECT id, name FROM positions"))
    positions = [{"id": row[0], "name": row[1]} for row in result]
    return jsonify(positions)

@app.route('/api/positions', methods=['POST'])
def create_position():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    try:
        db.session.execute(text("INSERT INTO positions (name) VALUES (:name)"), {"name": name})
        db.session.commit()
        log_activity("CREATE_POSITION", f"Created position: {name}")
        return jsonify({"message": "Position created"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route('/api/positions/<int:pos_id>', methods=['DELETE'])
def delete_position(pos_id):
    try:
        db.session.execute(text("DELETE FROM positions WHERE id = :id"), {"id": pos_id})
        db.session.commit()
        log_activity("DELETE_POSITION", f"Deleted position ID: {pos_id}")
        return jsonify({"message": "Position deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route('/api/positions/<int:pos_id>', methods=['PUT'])
def update_position(pos_id):
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    try:
        db.session.execute(
            text("UPDATE positions SET name = :name WHERE id = :id"),
            {"name": name, "id": pos_id}
        )
        db.session.commit()
        log_activity("UPDATE_POSITION", f"Updated position ID {pos_id} to: {name}")
        return jsonify({"message": "Position updated"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# --- UNIFORM NUMBERS ---

@app.route('/api/uniform-numbers/available', methods=['GET'])
def get_available_numbers():
    result = db.session.execute(text("SELECT number FROM uniform_numbers WHERE is_available = TRUE ORDER BY number"))
    numbers = [row[0] for row in result]
    return jsonify(numbers)

@app.route('/api/uniform-numbers', methods=['GET'])
def get_all_numbers():
    result = db.session.execute(text("SELECT number, is_available FROM uniform_numbers ORDER BY number"))
    numbers = [{"number": row[0], "is_available": bool(row[1])} for row in result]
    return jsonify(numbers)

# --- PLAYERS ---

@app.route('/api/players/check-document', methods=['POST'])
def check_document():
    data = request.json
    doc_number = data.get('document_number')
    if not doc_number:
        return jsonify({"error": "Document number is required"}), 400
    
    result = db.session.execute(
        text("SELECT last_registration_date FROM players WHERE document_number = :doc"),
        {"doc": doc_number}
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

@app.route('/api/players', methods=['POST'])
def register_player():
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
        
        # New payment fields
        payment_status = data.get('payment_status') or 'Pendiente'
        payment_amount = float(data.get('payment_amount') or 0)

        if not uniform_num or not primary_pos_id:
            return jsonify({"error": "Número de uniforme y posición principal son requeridos"}), 400

        # 1. Check existing
        sql_check = "SELECT id, last_registration_date, uniform_number FROM players WHERE document_number = :doc"
        existing_row = db.session.execute(text(sql_check), {"doc": doc_num}).fetchone()
        
        if existing_row:
            # Row mapping (using indices to be 100% safe across SQLAlchemy versions)
            player_id = existing_row[0]
            last_reg = existing_row[1]
            old_uniform = existing_row[2]
            
            if (datetime.now() - last_reg).days < 15:
                days_left = 15 - (datetime.now() - last_reg).days
                return jsonify({"error": f"Bloqueado. Podrá registrarse en {days_left} días"}), 400
            
            # History logic
            curr_row = db.session.execute(text("SELECT * FROM players WHERE id = :id"), {"id": player_id}).fetchone()
            if curr_row:
                # Based on init.sql order: 0:id, 1:doc_type... 11:p2, 12:pay_stat, 13:pay_amt, 14:last_reg
                db.session.execute(
                    text("""INSERT INTO player_history 
                         (player_id, document_number, full_name, uniform_number, primary_position_id, secondary_position_id, payment_status, payment_amount, registered_date)
                         VALUES (:pid, :doc, :name, :unif, :p1, :p2, :ps, :pa, :reg)"""),
                    {
                        "pid": player_id, "doc": curr_row[2], "name": curr_row[3],
                        "unif": curr_row[9], "p1": curr_row[10], 
                        "p2": curr_row[11], "ps": curr_row[12], "pa": curr_row[13], "reg": curr_row[14]
                    }
                )
            
            # Free old uniform if changed
            if uniform_num != old_uniform:
                db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE number = :n"), {"n": old_uniform})

            # Update
            db.session.execute(
                text("""UPDATE players SET 
                     document_type = :type, full_name = :name, address = :addr, neighborhood = :barrio,
                     phone = :phone, eps = :eps, uniform_size = :size, uniform_number = :unif,
                     primary_position_id = :p1, secondary_position_id = :p2, 
                     payment_status = :ps, payment_amount = :pa, last_registration_date = CURRENT_TIMESTAMP
                     WHERE id = :id"""),
                {
                    "type": doc_type, "name": full_name, "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size, 
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "ps": payment_status, "pa": payment_amount, "id": player_id
                }
            )
        else:
            # New
            db.session.execute(
                text("""INSERT INTO players 
                     (document_type, document_number, full_name, address, neighborhood, phone, eps, uniform_size, uniform_number, primary_position_id, secondary_position_id, payment_status, payment_amount)
                     VALUES (:type, :doc, :name, :addr, :barrio, :phone, :eps, :size, :unif, :p1, :p2, :ps, :pa)"""),
                {
                    "type": doc_type, "doc": doc_num, "name": full_name, "addr": data.get('address'), "barrio": data.get('neighborhood'),
                    "phone": data.get('phone'), "eps": data.get('eps'), "size": unif_size, 
                    "unif": uniform_num, "p1": primary_pos_id, "p2": secondary_pos_id,
                    "ps": payment_status, "pa": payment_amount
                }
            )
        
        # Mark occupied
        db.session.execute(text("UPDATE uniform_numbers SET is_available = FALSE WHERE number = :n"), {"n": uniform_num})
        
        db.session.commit()
        log_activity("REGISTER_PLAYER", f"Player {full_name} registered (Doc: {doc_num})")
        return jsonify({"message": "Player registered successfully"}), 201

    except Exception as e:
        db.session.rollback()
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"CRITICAL ERROR: {error_msg}")
        return jsonify({"error": "Error interno del servidor", "details": error_msg}), 500

@app.route('/api/players', methods=['GET'])
def list_players():
    # Join with positions for names
    sql = """
        SELECT p.*, pos1.name as primary_pos_name, pos2.name as secondary_pos_name
        FROM players p
        JOIN positions pos1 ON p.primary_position_id = pos1.id
        LEFT JOIN positions pos2 ON p.secondary_position_id = pos2.id
        ORDER BY p.created_at DESC
    """
    result = db.session.execute(text(sql))
    players = []
    # Fetch result set as dictionaries
    columns = result.keys()
    for row in result:
        players.append(dict(zip(columns, row)))
    return jsonify(players)

@app.route('/api/players/<int:p_id>', methods=['GET'])
def get_player(p_id):
    result = db.session.execute(text("SELECT * FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not result:
        return jsonify({"error": "Not found"}), 404
    columns = db.session.execute(text("SELECT * FROM players WHERE id = :id"), {"id": p_id}).keys()
    return jsonify(dict(zip(columns, result)))

@app.route('/api/players/<int:p_id>', methods=['DELETE'])
def delete_player(p_id):
    player = db.session.execute(text("SELECT uniform_number FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if player:
        unif = player[0]
        db.session.execute(text("UPDATE uniform_numbers SET is_available = TRUE WHERE number = :n"), {"n": unif})
        db.session.execute(text("DELETE FROM players WHERE id = :id"), {"id": p_id})
        db.session.commit()
        log_activity("DELETE_PLAYER", f"Deleted player ID: {p_id}")
        return jsonify({"message": "Player deleted"})
    return jsonify({"error": "Player not found"}), 404

@app.route('/api/players/<int:p_id>/history', methods=['GET'])
def get_player_history(p_id):
    # History by document number linked to player
    player = db.session.execute(text("SELECT document_number FROM players WHERE id = :id"), {"id": p_id}).fetchone()
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    result = db.session.execute(
        text("SELECT * FROM player_history WHERE document_number = :doc ORDER BY registered_date DESC"),
        {"doc": player[0]}
    )
    columns = result.keys()
    history = [dict(zip(columns, row)) for row in result]
    return jsonify(history)

@app.route('/api/players/<int:p_id>/payment', methods=['PATCH'])
def update_payment(p_id):
    try:
        data = request.json
        status = data.get('payment_status')
        amount = data.get('payment_amount')
        
        db.session.execute(
            text("UPDATE players SET payment_status = :status, payment_amount = :amount WHERE id = :id"),
            {"status": status, "amount": amount, "id": p_id}
        )
        db.session.commit()
        log_activity("UPDATE_PAYMENT", f"Updated payment for player ID {p_id} to {status} (${amount})")
        return jsonify({"message": "Payment updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- STATS & LOGS ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_players = db.session.execute(text("SELECT COUNT(*) FROM players")).scalar()
    available_nums = db.session.execute(text("SELECT COUNT(*) FROM uniform_numbers WHERE is_available = TRUE")).scalar()
    
    # Revenue calculations
    revenue_row = db.session.execute(text("SELECT COALESCE(SUM(payment_amount), 0) FROM players")).fetchone()
    revenue = float(revenue_row[0]) if revenue_row else 0.0
    
    # Fetch fees from settings
    settings_row = db.session.execute(text("SELECT uniform_fee, registration_fee FROM settings WHERE id = 1")).fetchone()
    u_fee = float(settings_row[0]) if settings_row else 80000.0
    r_fee = float(settings_row[1]) if settings_row else 40000.0
    total_fee_per_player = u_fee + r_fee
    
    total_expected = total_players * total_fee_per_player
    total_pending = total_expected - revenue

    pos_stats_sql = """
        SELECT pos.name, COUNT(p.id) as count
        FROM positions pos
        LEFT JOIN players p ON pos.id = p.primary_position_id
        GROUP BY pos.id
    """
    pos_stats = db.session.execute(text(pos_stats_sql))
    by_position = {row[0]: row[1] for row in pos_stats}
    
    return jsonify({
        "total_players": total_players,
        "available_numbers": available_nums,
        "total_revenue": revenue,
        "total_pending": total_pending,
        "total_expected": total_expected,
        "fees": {"uniform": u_fee, "registration": r_fee},
        "players_by_position": by_position
    })

@app.route('/api/settings', methods=['GET'])
def get_settings():
    row = db.session.execute(text("SELECT * FROM settings WHERE id = 1")).fetchone()
    if row:
        cols = ['id', 'team_name', 'team_logo_url', 'favicon_url', 'uniform_fee', 'registration_fee', 'updated_at']
        settings_dict = dict(zip(cols, row))
        # Ensure decimals are floats for JSON
        settings_dict['uniform_fee'] = float(settings_dict['uniform_fee'])
        settings_dict['registration_fee'] = float(settings_dict['registration_fee'])
        return jsonify(settings_dict)
    return jsonify({"error": "Settings not found"}), 404

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    try:
        data = request.json
        db.session.execute(
            text("""UPDATE settings SET 
                 team_name = :name, team_logo_url = :logo, favicon_url = :favicon,
                 uniform_fee = :u_fee, registration_fee = :r_fee
                 WHERE id = 1"""),
            {
                "name": data.get('team_name'), "logo": data.get('team_logo_url'),
                "favicon": data.get('favicon_url'), 
                "u_fee": float(data.get('uniform_fee', 0)),
                "r_fee": float(data.get('registration_fee', 0))
            }
        )
        db.session.commit()
        log_activity("UPDATE_SETTINGS", "Application settings updated by admin")
        return jsonify({"message": "Settings updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-logo', methods=['POST'])
def upload_logo():
    if 'logo' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['logo']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid cache issues
        filename = f"{int(datetime.now().timestamp())}_{filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        # We return the absolute URL as visible from the frontend
        # Assuming the backend is at localhost:5001 and serves /uploads
        logo_url = f"http://localhost:5001/api/uploads/{filename}"
        return jsonify({"url": logo_url}), 200
    return jsonify({"error": "File type not allowed"}), 400

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username == 'admin' and password == 'admin321':
        log_activity("ADMIN_LOGIN", "Admin successfully logged in")
        return jsonify({"message": "Login successful", "authenticated": True}), 200
    
    log_activity("FAILED_LOGIN", f"Failed login attempt with username: {username}")
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logs', methods=['GET'])
def get_logs():
    result = db.session.execute(text("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50"))
    columns = result.keys()
    logs = [dict(zip(columns, row)) for row in result]
    return jsonify(logs)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
