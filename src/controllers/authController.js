// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const audit  = require('../models/auditLog');

const BCRYPT_ROUNDS = 12;

// ── Mostrar formulario de login ───────────────────────────────────────────
function getLogin(req, res) {
  if (req.session?.user) return res.redirect('/dashboard');
  res.render('auth/login', {
    title: 'Iniciar sesión',
    error: req.session.loginError || null,
    csrfToken: req.csrfToken(),
  });
  delete req.session.loginError;
}

// ── Procesar login ────────────────────────────────────────────────────────
async function postLogin(req, res) {
  const { username, password } = req.body;
  const ip = req.ip;

  // Validación básica
  if (!username || !password) {
    req.session.loginError = 'Completa todos los campos.';
    return res.redirect('/auth/login');
  }

  try {
    const result = await db.query(
      `SELECT u.*, r.name AS role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1 AND u.is_active = TRUE`,
      [username]
    );

    const user = result.rows[0];
    const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !validPassword) {
      await audit.log({
        eventType: audit.EVENT.LOGIN_FAIL,
        username,
        ip,
        details: { reason: !user ? 'user_not_found' : 'wrong_password' },
      });
      req.session.loginError = 'Usuario o contraseña incorrectos.';
      return res.redirect('/auth/login');
    }

    // ── Login exitoso ────────────────────────────────────────────────────
    // RS-04: regenerar ID de sesión tras login (previene Session Fixation)
    req.session.regenerate(async (err) => {
      if (err) return res.redirect('/auth/login');

      req.session.user = {
        id:       user.id,
        username: user.username,
        email:    user.email,
        role:     user.role,
      };

      // Actualizar último login
      await db.query(
        `UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
        [ip, user.id]
      );

      await audit.log({
        eventType: audit.EVENT.LOGIN_OK,
        userId:   user.id,
        username: user.username,
        ip,
      });

      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    });

  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/auth/login');
  }
}

// ── Logout ────────────────────────────────────────────────────────────────
async function logout(req, res) {
  const user = req.session?.user;
  if (user) {
    await audit.log({
      eventType: audit.EVENT.LOGOUT,
      userId:   user.id,
      username: user.username,
      ip:       req.ip,
    });
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.clearCookie('api_token');
    res.redirect('/auth/login');
  });
}

// ── Generar token JWT para la API ─────────────────────────────────────────
async function getApiToken(req, res) {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ error: 'No autenticado.' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  // RS-05: guardar JWT en cookie HttpOnly (NO en localStorage)
  res.cookie('api_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   60 * 60 * 1000, // 1 hora
  });

  return res.json({ message: 'Token generado correctamente.', expiresIn: '1h' });
}

module.exports = { getLogin, postLogin, logout, getApiToken };
