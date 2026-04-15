// scripts/migrate.js
require('dotenv').config();
const { pool } = require('../src/config/db');

const schema = `
-- ── Roles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) UNIQUE NOT NULL,   -- 'SuperAdmin', 'Auditor', 'Registrador'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usuarios ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,               -- bcrypt, cost>=12
  role_id       INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),                 -- IPv4 o IPv6
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Productos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20)    UNIQUE NOT NULL,  -- alfanumérico
  name        VARCHAR(255)   NOT NULL,
  description TEXT,
  quantity    INTEGER        NOT NULL CHECK (quantity >= 0),
  price       NUMERIC(12,2)  NOT NULL CHECK (price >= 0),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Log de Auditoría ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  event_type  VARCHAR(50)  NOT NULL,   -- LOGIN_OK, LOGIN_FAIL, CREATE_USER, etc.
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(50),             -- snapshot por si el user se elimina
  ip_address  VARCHAR(45)  NOT NULL,
  target_type VARCHAR(50),             -- 'user', 'product', 'role', etc.
  target_id   INTEGER,
  details     JSONB,                   -- info extra (campo modificado, payload, etc.)
  http_status INTEGER,                 -- 403 para accesos denegados
  route       TEXT,                    -- ruta solicitada
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices para consultas frecuentes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event     ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_code        ON products(code);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('⏳ Ejecutando migraciones...');
    await client.query(schema);
    console.log('✅ Esquema creado correctamente.');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
