-- Runs on first container initialisation: the app user owns both the
-- development database and the isolated integration-test database.
CREATE DATABASE IF NOT EXISTS demo_credit_test;
GRANT ALL PRIVILEGES ON demo_credit_test.* TO 'demo_credit'@'%';
FLUSH PRIVILEGES;
