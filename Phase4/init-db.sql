-- Initialize resources table for Phase4 Booking System
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(200),
  available BOOLEAN DEFAULT false,
  price DECIMAL(10,2) NOT NULL,
  price_unit VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
