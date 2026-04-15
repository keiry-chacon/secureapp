// src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Conexiones máximas para no saturar la BD
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en pool de PostgreSQL:', err);
  process.exit(-1);
});

/**
 * Ejecuta una consulta parametrizada.
 * SIEMPRE usar $1, $2... nunca concatenar strings.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtiene un cliente del pool para transacciones.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
