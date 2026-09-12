-- Up Migration
CREATE TABLE system_settings (
 setting_key text PRIMARY KEY, setting_value jsonb NOT NULL CHECK(jsonb_typeof(setting_value)='object'),
 updated_by bigint REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
-- Down Migration
DROP TABLE system_settings;
