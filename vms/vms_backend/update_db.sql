-- Migration script to fix missing sequences and 500 error

-- 1. Create missing sequences
CREATE SEQUENCE IF NOT EXISTS users_user_id_seq;
CREATE SEQUENCE IF NOT EXISTS visitors_visitor_id_seq;
CREATE SEQUENCE IF NOT EXISTS visitor_requests_request_id_seq;

-- 2. Associate sequences with ID columns as defaults
ALTER TABLE users ALTER COLUMN user_id SET DEFAULT nextval('users_user_id_seq');
ALTER TABLE visitors ALTER COLUMN visitor_id SET DEFAULT nextval('visitors_visitor_id_seq');
ALTER TABLE visitor_requests ALTER COLUMN request_id SET DEFAULT nextval('visitor_requests_request_id_seq');

-- 3. Sync sequences with current max IDs
SELECT setval('users_user_id_seq', (SELECT COALESCE(MAX(user_id), 1) FROM users));
SELECT setval('visitors_visitor_id_seq', (SELECT COALESCE(MAX(visitor_id), 1) FROM visitors));
SELECT setval('visitor_requests_request_id_seq', (SELECT COALESCE(MAX(request_id), 1) FROM visitor_requests));

-- 4. Add missing columns if they are still missing
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS person_to_visit CHARACTER VARYING(150);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS has_device BOOLEAN DEFAULT FALSE;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS device_type CHARACTER VARYING(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS device_make CHARACTER VARYING(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS device_serial_number CHARACTER VARYING(100);
