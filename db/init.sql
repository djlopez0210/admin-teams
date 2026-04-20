CREATE DATABASE IF NOT EXISTS football_team;
USE football_team;

-- 1. Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    slug VARCHAR(100) UNIQUE,
    city VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tournament_id INT,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Players
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    uniform_number INT NOT NULL,
    position VARCHAR(50),
    payment_status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (team_id, document_number)
);

-- 5. Matches
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT,
    match_date DATETIME,
    home_team_id INT,
    away_team_id INT,
    location VARCHAR(255),
    status ENUM('SCHEDULED', 'LIVE', 'COMPLETED') DEFAULT 'SCHEDULED',
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA
INSERT INTO tournaments (name, slug, city) VALUES ('Torneo Relámpago', 'torneo-relampago', 'Ciudad Fútbol');

INSERT INTO teams (name, slug, tournament_id) VALUES 
('Alianza F.C.', 'alianza-fc', 1),
('Los Galácticos', 'galacticos', 1);

-- SuperAdmin (Clave: admin123 hashed)
INSERT INTO users (username, password_hash, role) 
VALUES ('dyck.lopez', 'pbkdf2:sha256:600000$yR4p6JpW6k8aJ3f$75e9f8e4a9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e9e', 'superadmin');
