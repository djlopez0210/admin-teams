-- Add representative details to the teams table
ALTER TABLE teams 
ADD COLUMN delegate_document VARCHAR(50) AFTER slug,
ADD COLUMN delegate_name VARCHAR(100) AFTER delegate_document,
ADD COLUMN delegate_email VARCHAR(100) AFTER delegate_name;
