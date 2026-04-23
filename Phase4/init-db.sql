-- Initialize resources table for Phase4 Booking System
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  available BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
