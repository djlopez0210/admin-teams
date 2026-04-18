-- 1. Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    win_points INT DEFAULT 3,
    draw_points INT DEFAULT 1,
    loss_points INT DEFAULT 0,
    format_type VARCHAR(20) DEFAULT 'liga',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. New tables (These use IF NOT EXISTS Safely)
CREATE TABLE IF NOT EXISTS tournament_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    group_id INT NULL,
    round_number INT NOT NULL DEFAULT 1,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'programado',
    match_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES tournament_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (home_team_id) REFERENCES teams(id),
    FOREIGN KEY (away_team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    team_id INT NOT NULL,
    player_id INT NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    minute INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 3. Essential columns (idempotent)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS delegate_name VARCHAR(100);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS delegate_id VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS delegate_phone VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS delegate_email VARCHAR(100);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tournament_id INT NULL;
ALTER TABLE teams ADD CONSTRAINT fk_team_tournament FOREIGN KEY IF NOT EXISTS (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#00f2fe';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#4facfe';
