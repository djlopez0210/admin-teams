CREATE TABLE IF NOT EXISTS tournament_phases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phase_order INT NOT NULL DEFAULT 1,
    phase_type ENUM('ROUND_ROBIN', 'SINGLE_ELIMINATION', 'GLOBAL_TABLE') NOT NULL DEFAULT 'ROUND_ROBIN',
    status ENUM('DRAFT', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phase_id INT NOT NULL,
    name VARCHAR(100) NOT NULL, -- e.g., "Grupo A", "Grupo B"
    FOREIGN KEY (phase_id) REFERENCES tournament_phases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_teams (
    group_id INT NOT NULL,
    team_id INT NOT NULL,
    points INT DEFAULT 0,
    goals_for INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    matches_won INT DEFAULT 0,
    matches_drawn INT DEFAULT 0,
    matches_lost INT DEFAULT 0,
    PRIMARY KEY (group_id, team_id),
    FOREIGN KEY (group_id) REFERENCES tournament_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    phase_id INT NOT NULL,
    group_id INT NULL, 
    home_team_id INT NULL, -- Can be NULL if placeholder (e.g. Winner of Match 1)
    away_team_id INT NULL,
    match_date DATETIME NULL,
    status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    home_score INT DEFAULT NULL,
    away_score INT DEFAULT NULL,
    match_day INT DEFAULT 1, -- Jornada 1, Jornada 2...
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES tournament_phases(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES tournament_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE SET NULL
);
