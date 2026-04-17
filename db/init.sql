CREATE DATABASE IF NOT EXISTS football_team;
USE football_team;

-- 1. Teams table
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users table (Admin accounts)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NULL,  -- NULL means SuperAdmin or global access
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin', -- 'admin', 'superadmin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 3. Positions table (per team)
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY (team_id, name)
);

-- 4. Uniform numbers table (per team)
CREATE TABLE IF NOT EXISTS uniform_numbers (
    team_id INT NOT NULL,
    number INT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (team_id, number),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 5. Players table (per team)
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    neighborhood VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    eps VARCHAR(100),
    uniform_size VARCHAR(10) NOT NULL,
    uniform_number INT NOT NULL,
    primary_position_id INT NOT NULL,
    secondary_position_id INT,
    payment_status VARCHAR(20) DEFAULT 'Pendiente',
    payment_amount DECIMAL(10, 2) DEFAULT 0.00,
    last_registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id, uniform_number) REFERENCES uniform_numbers(team_id, number),
    FOREIGN KEY (primary_position_id) REFERENCES positions(id),
    FOREIGN KEY (secondary_position_id) REFERENCES positions(id),
    UNIQUE KEY (team_id, document_number)
);

-- 6. Player history table (per team)
CREATE TABLE IF NOT EXISTS player_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    player_id INT NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    uniform_number INT NOT NULL,
    primary_position_id INT NOT NULL,
    secondary_position_id INT,
    payment_status VARCHAR(20),
    payment_amount DECIMAL(10, 2),
    registered_date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 7. Activity logs table (per team)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 8. Settings table (per team)
CREATE TABLE IF NOT EXISTS settings (
    team_id INT PRIMARY KEY,
    team_name VARCHAR(100) DEFAULT 'TeamManager',
    team_logo_url TEXT,
    favicon_url TEXT,
    uniform_fee DECIMAL(10, 2) DEFAULT 80000.00,
    registration_fee DECIMAL(10, 2) DEFAULT 40000.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- SEED DATA

-- Default Team
INSERT INTO teams (name, slug) VALUES ('Real Florida FC', 'real-florida');

-- Super Admin
INSERT INTO users (team_id, username, password_hash, role) 
VALUES (NULL, 'dyck.lopez', 'RealFlorida123', 'superadmin');

-- Team Admin
INSERT INTO users (team_id, username, password_hash, role) 
VALUES (1, 'felipe.guerrero', 'RealFlorida1', 'admin');

-- Default Positions for team 1
INSERT INTO positions (team_id, name) VALUES 
(1, 'Portero'), (1, 'Defensa Central'), (1, 'Lateral Izquierdo'), 
(1, 'Lateral Derecho'), (1, 'Mediocampista Defensivo'), 
(1, 'Mediocampista Central'), (1, 'Mediocampista Ofensivo'), 
(1, 'Extremo Izquierdo'), (1, 'Extremo Derecho'), 
(1, 'Delantero'), (1, 'Delantero Móvil');

-- Seed numbers (1-50)
DELIMITER //
CREATE PROCEDURE seed_team_numbers(t_id INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 50 DO
        INSERT IGNORE INTO uniform_numbers (team_id, number, is_available) VALUES (t_id, i, TRUE);
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL seed_team_numbers(1);

-- Default Settings
INSERT INTO settings (team_id, team_name, uniform_fee, registration_fee) 
VALUES (1, 'Real Florida FC', 80000.00, 40000.00);
