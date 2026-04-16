// src/routes/api.js
const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const { body, validationResult } = require('express-validator');
const { requireJWT, requireRoleAPI } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { productValidations } = require('../controllers/productController');
const audit = require('../models/auditLog');

router.use(apiLimiter);

/**
 * @route  GET /api/health
 * @desc   Health check (público)
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Todos los endpoints debajo requieren JWT ──────────────────────────────
router.use(requireJWT);

// ── Productos ─────────────────────────────────────────────────────────────

/**
 * @route  GET /api/products
 * @access SuperAdmin, Registrador, Auditor
 */
router.get('/products', requireRoleAPI(['SuperAdmin', 'Registrador', 'Auditor']), async (req, res) => {
  const result = await db.query(
    `SELECT id, code, name, description, quantity, price, created_at FROM products ORDER BY created_at DESC`
  );
  res.json({ data: result.rows });
});

/**
 * @route  GET /api/products/:id
 * @access SuperAdmin, Registrador, Auditor
 */
router.get('/products/:id', requireRoleAPI(['SuperAdmin', 'Registrador', 'Auditor']), async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'ID inválido.' });
  const result = await db.query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ data: result.rows[0] });
});

/**
 * @route  POST /api/products
 * @access SuperAdmin, Registrador
 */
router.post('/products', requireRoleAPI(['SuperAdmin', 'Registrador']), productValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { code, name, description, quantity, price } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO products (code, name, description, quantity, price, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
      [code, name, description || null, parseInt(quantity), parseFloat(price), req.jwtUser.id]
    );
    await audit.log({
      eventType: audit.EVENT.CREATE_PRODUCT, userId: req.jwtUser.id,
      username: req.jwtUser.username, ip: req.ip,
      targetType: 'product', targetId: result.rows[0].id, details: { code, name },
    });
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de producto duplicado.' });
    res.status(500).json({ error: 'Error interno.' });
  }
});

/**
 * @route  PUT /api/products/:id
 * @access SuperAdmin, Registrador
 */
router.put('/products/:id', requireRoleAPI(['SuperAdmin', 'Registrador']), productValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'ID inválido.' });

  const { code, name, description, quantity, price } = req.body;
  await db.query(
    `UPDATE products SET code=$1, name=$2, description=$3, quantity=$4,
     price=$5, updated_by=$6, updated_at=NOW() WHERE id=$7`,
    [code, name, description || null, parseInt(quantity), parseFloat(price), req.jwtUser.id, id]
  );
  await audit.log({
    eventType: audit.EVENT.UPDATE_PRODUCT, userId: req.jwtUser.id,
    username: req.jwtUser.username, ip: req.ip,
    targetType: 'product', targetId: parseInt(id),
  });
  res.json({ message: 'Producto actualizado.' });
});

/**
 * @route  DELETE /api/products/:id
 * @access SuperAdmin, Registrador
 */
router.delete('/products/:id', requireRoleAPI(['SuperAdmin', 'Registrador']), async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'ID inválido.' });
  await db.query(`DELETE FROM products WHERE id = $1`, [id]);
  await audit.log({
    eventType: audit.EVENT.DELETE_PRODUCT, userId: req.jwtUser.id,
    username: req.jwtUser.username, ip: req.ip,
    targetType: 'product', targetId: parseInt(id),
  });
  res.json({ message: 'Producto eliminado.' });
});

// ── Usuarios ──────────────────────────────────────────────────────────────

/**
 * @route  GET /api/users
 * @access SuperAdmin, Auditor, Registrador
 */
router.get('/users', requireRoleAPI(['SuperAdmin', 'Auditor', 'Registrador']), async (req, res) => {
  const result = await db.query(`
    SELECT u.id, u.username, u.email, u.is_active, u.last_login_at, r.name as role
    FROM users u LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `);
  res.json({ data: result.rows });
});

/**
 * @route  GET /api/users/:id
 * @access SuperAdmin
 */
router.get('/users/:id', requireRoleAPI('SuperAdmin'), async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'ID inválido.' });
  const result = await db.query(
    `SELECT u.id, u.username, u.email, u.is_active, u.last_login_at, r.name as role
     FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ data: result.rows[0] });
});

module.exports = router;
