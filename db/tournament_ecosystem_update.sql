USE football_team;

-- 1. Expand Tournaments table
ALTER TABLE tournaments ADD COLUMN city VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN description TEXT;
ALTER TABLE tournaments ADD COLUMN image_url TEXT;
ALTER TABLE tournaments ADD COLUMN rules_pdf_url TEXT;

-- 2. Link Users to Tournaments
ALTER TABLE users ADD COLUMN tournament_id INT NULL;
ALTER TABLE users ADD CONSTRAINT fk_user_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;

-- 3. Create Referees table
CREATE TABLE IF NOT EXISTS referees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    age INT,
    phone VARCHAR(20),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    UNIQUE KEY (tournament_id, document_number)
);

-- 4. Note: Teams are already linked via tournament_id in previous migrations
