// src/controllers/userController.js
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db    = require('../config/db');
const audit = require('../models/auditLog');

const BCRYPT_ROUNDS = 12;

const userValidations = [
  body('username')
    .trim()
    .notEmpty().withMessage('El username es obligatorio.')
    .isAlphanumeric().withMessage('Solo letras y números.')
    .isLength({ min: 3, max: 50 }).withMessage('Entre 3 y 50 caracteres.'),
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio.')
    .isEmail().withMessage('Email inválido.')
    .normalizeEmail(),
  body('role_id')
    .notEmpty().withMessage('El rol es obligatorio.')
    .isInt({ min: 1 }).withMessage('Rol inválido.'),
];

const passwordValidation = body('password')
  .notEmpty().withMessage('La contraseña es obligatoria.')
  .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres.')
  .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula.')
  .matches(/[0-9]/).withMessage('Debe contener al menos un número.')
  .matches(/[^A-Za-z0-9]/).withMessage('Debe contener al menos un símbolo.');

// ── Listar usuarios ────────────────────────────────────────────────────────
async function index(req, res) {
  const result = await db.query(`
    SELECT u.id, u.username, u.email, u.is_active,
           u.last_login_at, u.last_login_ip, u.created_at,
           r.name as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `);
  res.render('users/index', {
    title: 'Usuarios',
    users: result.rows,
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

// ── Formulario nuevo usuario ───────────────────────────────────────────────
async function newForm(req, res) {
  const roles = await db.query(`SELECT * FROM roles ORDER BY name`);
  res.render('users/form', {
    title: 'Nuevo Usuario',
    formUser: {},
    roles: roles.rows,
    errors: [],
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

// ── Crear usuario ──────────────────────────────────────────────────────────
async function create(req, res) {
  const rules = [...userValidations, passwordValidation];
  await Promise.all(rules.map(r => r.run(req)));
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const roles = await db.query(`SELECT * FROM roles ORDER BY name`);
    return res.render('users/form', {
      title: 'Nuevo Usuario',
      formUser: req.body,
      roles: roles.rows,
      errors: errors.array(),
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }

  const { username, email, password, role_id } = req.body;
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, email, hash, role_id]
    );

    await audit.log({
      eventType:  audit.EVENT.CREATE_USER,
      userId:     req.session.user.id,
      username:   req.session.user.username,
      ip:         req.ip,
      targetType: 'user',
      targetId:   result.rows[0].id,
      details:    { username, email, role_id },
    });

    res.redirect('/users');
  } catch (err) {
    const roles = await db.query(`SELECT * FROM roles ORDER BY name`);
    const dupMsg = err.code === '23505' ? 'El username o email ya existe.' : 'Error al crear usuario.';
    res.render('users/form', {
      title: 'Nuevo Usuario',
      formUser: req.body,
      roles: roles.rows,
      errors: [{ msg: dupMsg }],
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }
}

// ── Formulario editar ──────────────────────────────────────────────────────
async function editForm(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/users');

  const [userRes, rolesRes] = await Promise.all([
    db.query(`SELECT id, username, email, role_id, is_active FROM users WHERE id = $1`, [id]),
    db.query(`SELECT * FROM roles ORDER BY name`),
  ]);

  if (!userRes.rows[0]) return res.status(404).render('error', { title: '404', message: 'Usuario no encontrado.', user: req.session.user });

  res.render('users/form', {
    title: 'Editar Usuario',
    formUser: userRes.rows[0],
    roles: rolesRes.rows,
    errors: [],
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

// ── Actualizar usuario ─────────────────────────────────────────────────────
async function update(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/users');

  await Promise.all(userValidations.map(r => r.run(req)));
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const roles = await db.query(`SELECT * FROM roles ORDER BY name`);
    return res.render('users/form', {
      title: 'Editar Usuario',
      formUser: { ...req.body, id },
      roles: roles.rows,
      errors: errors.array(),
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }

  const { username, email, role_id, is_active } = req.body;

  // Obtener datos anteriores para el log
  const before = await db.query(`SELECT username, email, role_id FROM users WHERE id = $1`, [id]);

  await db.query(
    `UPDATE users SET username=$1, email=$2, role_id=$3, is_active=$4, updated_at=NOW()
     WHERE id=$5`,
    [username, email, role_id, is_active === 'on', id]
  );

  const oldRole = before.rows[0]?.role_id;
  const eventType = String(oldRole) !== String(role_id)
    ? audit.EVENT.CHANGE_ROLE
    : audit.EVENT.UPDATE_USER;

  await audit.log({
    eventType,
    userId:     req.session.user.id,
    username:   req.session.user.username,
    ip:         req.ip,
    targetType: 'user',
    targetId:   parseInt(id),
    details:    { username, email, role_id, before: before.rows[0] },
  });

  res.redirect('/users');
}

// ── Eliminar usuario ───────────────────────────────────────────────────────
async function destroy(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/users');

  // No permitir que un admin se elimine a sí mismo
  if (parseInt(id) === req.session.user.id) {
    return res.redirect('/users');
  }

  const result = await db.query(`DELETE FROM users WHERE id = $1 RETURNING username, email`, [id]);

  if (result.rows[0]) {
    await audit.log({
      eventType:  audit.EVENT.DELETE_USER,
      userId:     req.session.user.id,
      username:   req.session.user.username,
      ip:         req.ip,
      targetType: 'user',
      targetId:   parseInt(id),
      details:    result.rows[0],
    });
  }

  res.redirect('/users');
}

module.exports = { index, newForm, create, editForm, update, destroy, userValidations };
