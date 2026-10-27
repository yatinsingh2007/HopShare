CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id     text NOT NULL UNIQUE,
  first_name        text,
  upi_id            text,
  photo_url         text,
  id_verified_at    timestamptz,
  photo_verified_at timestamptz,
  suspended_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
