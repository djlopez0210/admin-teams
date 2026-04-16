CREATE DATABASE IF NOT EXISTS football_team;
USE football_team;

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Seed positions
INSERT IGNORE INTO positions (name) VALUES 
('Portero'), ('Defensa Central'), ('Lateral Izquierdo'), 
('Lateral Derecho'), ('Mediocampista Defensivo'), 
('Mediocampista Central'), ('Mediocampista Ofensivo'), 
('Extremo Izquierdo'), ('Extremo Derecho'), 
('Delantero'), ('Delantero Móvil');

-- Uniform numbers table
CREATE TABLE IF NOT EXISTS uniform_numbers (
    number INT PRIMARY KEY,
    is_available BOOLEAN DEFAULT TRUE
);

-- Seed numbers 1-50
DELIMITER //
CREATE PROCEDURE seed_uniform_numbers()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 50 DO
        INSERT IGNORE INTO uniform_numbers (number, is_available) VALUES (i, TRUE);
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL seed_uniform_numbers();
DROP PROCEDURE seed_uniform_numbers;

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(50) NOT NULL UNIQUE,
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
    FOREIGN KEY (uniform_number) REFERENCES uniform_numbers(number),
    FOREIGN KEY (primary_position_id) REFERENCES positions(id),
    FOREIGN KEY (secondary_position_id) REFERENCES positions(id)
);

-- Player history table
CREATE TABLE IF NOT EXISTS player_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    uniform_number INT NOT NULL,
    primary_position_id INT NOT NULL,
    secondary_position_id INT,
    payment_status VARCHAR(20),
    payment_amount DECIMAL(10, 2),
    registered_date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    team_name VARCHAR(100) DEFAULT 'TeamManager',
    team_logo_url TEXT,
    favicon_url TEXT,
    uniform_fee DECIMAL(10, 2) DEFAULT 80000.00,
    registration_fee DECIMAL(10, 2) DEFAULT 40000.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO settings (id, team_name, uniform_fee, registration_fee) 
VALUES (1, 'Real Florida FC', 80000.00, 40000.00);
