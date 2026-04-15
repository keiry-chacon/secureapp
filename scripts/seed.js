// scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

const BCRYPT_ROUNDS = 12;

async function seed() {
  const client = await pool.connect();
  try {
    console.log('⏳ Insertando datos iniciales...');

    // 1. Roles
    await client.query(`
      INSERT INTO roles (name) VALUES
        ('SuperAdmin'),
        ('Auditor'),
        ('Registrador')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 2. SuperAdmin por defecto
    const hash = await bcrypt.hash('Admin@1234!', BCRYPT_ROUNDS);
    const roleRes = await client.query(`SELECT id FROM roles WHERE name='SuperAdmin'`);
    const roleId = roleRes.rows[0].id;

    await client.query(`
      INSERT INTO users (username, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING;
    `, ['superadmin', 'admin@secureapp.local', hash, roleId]);

    console.log('✅ Seed completado.');
    console.log('   Usuario:   superadmin');
    console.log('   Password:  Admin@1234!');
    console.log('   ⚠️  Cambia esta contraseña en producción.');
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
