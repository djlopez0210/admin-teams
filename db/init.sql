CREATE DATABASE IF NOT EXISTS football_team;
USE football_team;

-- 1. Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    slug VARCHAR(100) UNIQUE,
    city VARCHAR(100),
    description TEXT,
    image_url TEXT,
    rules_pdf_url TEXT,
    registration_open BOOLEAN DEFAULT 1,
    win_points INT DEFAULT 3,
    draw_points INT DEFAULT 1,
    loss_points INT DEFAULT 0,
    format_type VARCHAR(50) DEFAULT 'league',
    config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tournament_id INT,
    delegate_document VARCHAR(50),
    delegate_name VARCHAR(100),
    delegate_email VARCHAR(100),
    delegate_phone VARCHAR(20),
    delegate_address TEXT,
    delegate_city VARCHAR(100),
    registration_pin VARCHAR(20),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    team_id INT NULL,
    tournament_id INT NULL,
    player_id INT NULL,
    must_change_password BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Players
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NULL,
    document_type VARCHAR(50),
    document_number VARCHAR(50) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(20),
    address VARCHAR(255),
    neighborhood VARCHAR(100),
    eps VARCHAR(100),
    birth_date DATE,
    uniform_number INT,
    uniform_size VARCHAR(10),
    position VARCHAR(50),
    primary_position_id INT,
    secondary_position_id INT,
    tertiary_position_id INT,
    preferred_foot VARCHAR(20),
    blood_type VARCHAR(5),
    nationality VARCHAR(100),
    photo_url TEXT,
    photo_cutout_url TEXT,
    payment_status VARCHAR(50) DEFAULT 'Pendiente',
    payment_amount DECIMAL(10,2) DEFAULT 0,
    last_registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Referees
CREATE TABLE IF NOT EXISTS referees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100),
    document_number VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    age INT,
    address VARCHAR(255),
    tournament_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Matches
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT,
    phase_id INT,
    group_id INT,
    match_day INT DEFAULT 1,
    match_date DATETIME,
    home_team_id INT,
    away_team_id INT,
    referee_id INT,
    referee VARCHAR(100),
    veedor_id INT,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'SCHEDULED',
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Fields & Lineups & Events
CREATE TABLE IF NOT EXISTS fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    address TEXT
);

CREATE TABLE IF NOT EXISTS match_lineups (
    match_id INT,
    player_id INT,
    team_id INT,
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    team_id INT,
    player_id INT,
    event_type VARCHAR(50),
    event_minute INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Activity Logs & Settings & Configuration
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    action VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    team_name VARCHAR(100),
    team_logo_url TEXT,
    favicon_url TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    name VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS uniform_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    number INT,
    is_available BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS player_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    player_id INT,
    document_number VARCHAR(50),
    full_name VARCHAR(100),
    uniform_number INT,
    primary_position_id INT,
    secondary_position_id INT,
    payment_status VARCHAR(50),
    payment_amount DECIMAL(10,2),
    registered_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_costs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    item_name VARCHAR(255),
    description VARCHAR(255),
    amount DECIMAL(10,2),
    is_mandatory BOOLEAN DEFAULT 1
);

-- 9. Tournament Phases & Groups
CREATE TABLE IF NOT EXISTS tournament_phases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT,
    name VARCHAR(100),
    phase_order INT DEFAULT 1,
    phase_type VARCHAR(50) DEFAULT 'ROUND_ROBIN',
    is_double_round BOOLEAN DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT,
    phase_id INT,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_teams (
    group_id INT,
    team_id INT,
    points INT DEFAULT 0,
    goals_for INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    PRIMARY KEY (group_id, team_id)
);

-- 10. Ratings & Card Templates
CREATE TABLE IF NOT EXISTS player_match_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    team_id INT,
    rating DECIMAL(3,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_match_player (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS card_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) DEFAULT 'default',
    canvas_width INT DEFAULT 613,
    canvas_height INT DEFAULT 860,
    background_url TEXT,
    elements JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Communities Module
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
);

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
);

CREATE TABLE IF NOT EXISTS community_polls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_id INT NOT NULL,
    question VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    expires_at DATETIME NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_poll_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    poll_id INT NOT NULL,
    option_text VARCHAR(255) NOT NULL,
    votes_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_poll_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    poll_id INT NOT NULL,
    option_id INT NOT NULL,
    voter_identifier VARCHAR(100) NOT NULL,
    voter_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_poll_voter (poll_id, voter_identifier)
);

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
);

CREATE TABLE IF NOT EXISTS community_match_roster (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    community_player_id INT NOT NULL,
    team_side VARCHAR(10) NOT NULL,
    goals INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_match_player_roster (match_id, community_player_id)
);

-- SEED DATA
INSERT INTO tournaments (name, slug, city) VALUES ('Torneo Relámpago', 'torneo-relampago', 'Ciudad Fútbol')
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO teams (name, slug, tournament_id) VALUES 
('Alianza F.C.', 'alianza-fc', 1),
('Los Galácticos', 'galacticos', 1)
ON DUPLICATE KEY UPDATE name=name;

-- SuperAdmin (Clave: admin123 hashed)
INSERT INTO users (username, password_hash, role) 
VALUES ('dyck.lopez', 'pbkdf2:sha256:600000$yR4p6JpW6k8aJ3f$75e9f8e4a9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e', 'superadmin')
ON DUPLICATE KEY UPDATE username=username;
