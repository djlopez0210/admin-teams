-- Add registration PIN to teams table
ALTER TABLE teams 
ADD COLUMN registration_pin VARCHAR(4) DEFAULT NULL;
