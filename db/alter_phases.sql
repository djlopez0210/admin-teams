USE football_team;

-- Add phase support to existing tournament_groups
ALTER TABLE tournament_groups ADD COLUMN phase_id INT NULL;
ALTER TABLE tournament_groups ADD CONSTRAINT fk_group_phase FOREIGN KEY (phase_id) REFERENCES tournament_phases(id) ON DELETE CASCADE;

-- Add phase support to existing matches
ALTER TABLE matches ADD COLUMN phase_id INT NULL;
ALTER TABLE matches ADD CONSTRAINT fk_match_phase FOREIGN KEY (phase_id) REFERENCES tournament_phases(id) ON DELETE CASCADE;

-- Modify existing fields on matches
ALTER TABLE matches MODIFY COLUMN home_team_id INT NULL;
ALTER TABLE matches MODIFY COLUMN away_team_id INT NULL;
