-- 1. Create team_costs table
CREATE TABLE IF NOT EXISTS team_costs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 2. Migrate existing fees from settings to team_costs
INSERT INTO team_costs (team_id, item_name, amount)
SELECT team_id, 'Inscripción', registration_fee FROM settings WHERE registration_fee > 0;

INSERT INTO team_costs (team_id, item_name, amount)
SELECT team_id, 'Uniforme', uniform_fee FROM settings WHERE uniform_fee > 0;
