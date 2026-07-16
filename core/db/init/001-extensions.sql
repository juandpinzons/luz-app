-- Se ejecuta una sola vez al crear el contenedor de Postgres (dev local).
-- gen_random_uuid() ya es nativo desde PostgreSQL 13, no requiere extensión.
CREATE EXTENSION IF NOT EXISTS vector;
