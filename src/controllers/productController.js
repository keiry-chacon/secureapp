// src/controllers/productController.js
const { body, validationResult } = require('express-validator');
const db    = require('../config/db');
const audit = require('../models/auditLog');

// ── Validaciones (reutilizables en web y API) ──────────────────────────────
const productValidations = [
  body('code')
    .trim()
    .notEmpty().withMessage('El código es obligatorio.')
    .isAlphanumeric().withMessage('El código solo puede contener letras y números.')
    .isLength({ max: 20 }).withMessage('Máximo 20 caracteres.'),
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 255 }).withMessage('Máximo 255 caracteres.')
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Máximo 2000 caracteres.')
    .escape(),
  body('quantity')
    .notEmpty().withMessage('La cantidad es obligatoria.')
    .isInt({ min: 0 }).withMessage('La cantidad debe ser un entero no negativo.'),
  body('price')
    .notEmpty().withMessage('El precio es obligatorio.')
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número no negativo.')
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Máximo 2 decimales.'),
];

// ── Listar productos ────────────────────────────────────────────────────────
async function index(req, res) {
  try {
    const result = await db.query(
      `SELECT p.*, u.username as created_by_name
       FROM products p
       LEFT JOIN users u ON p.created_by = u.id
       ORDER BY p.created_at DESC`
    );
    res.render('products/index', {
      title: 'Productos',
      products: result.rows,
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Error al cargar productos.', user: req.session.user });
  }
}

// ── Formulario nuevo producto ───────────────────────────────────────────────
function newForm(req, res) {
  res.render('products/form', {
    title: 'Nuevo Producto',
    product: {},
    errors: [],
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

// ── Crear producto ──────────────────────────────────────────────────────────
async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('products/form', {
      title: 'Nuevo Producto',
      product: req.body,
      errors: errors.array(),
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }

  const { code, name, description, quantity, price } = req.body;
  const userId = req.session.user.id;

  try {
    const result = await db.query(
      `INSERT INTO products (code, name, description, quantity, price, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
      [code, name, description || null, parseInt(quantity), parseFloat(price), userId]
    );

    await audit.log({
      eventType:  audit.EVENT.CREATE_PRODUCT,
      userId,
      username:   req.session.user.username,
      ip:         req.ip,
      targetType: 'product',
      targetId:   result.rows[0].id,
      details:    { code, name },
    });

    res.redirect('/products');
  } catch (err) {
    const dupError = err.code === '23505' ? 'El código de producto ya existe.' : 'Error al crear el producto.';
    res.render('products/form', {
      title: 'Nuevo Producto',
      product: req.body,
      errors: [{ msg: dupError }],
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }
}

// ── Formulario editar ───────────────────────────────────────────────────────
async function editForm(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/products');

  const result = await db.query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).render('error', { title: '404', message: 'Producto no encontrado.', user: req.session.user });

  res.render('products/form', {
    title: 'Editar Producto',
    product: result.rows[0],
    errors: [],
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

// ── Actualizar producto ─────────────────────────────────────────────────────
async function update(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/products');

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('products/form', {
      title: 'Editar Producto',
      product: { ...req.body, id },
      errors: errors.array(),
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }

  const { code, name, description, quantity, price } = req.body;
  const userId = req.session.user.id;

  try {
    await db.query(
      `UPDATE products SET code=$1, name=$2, description=$3, quantity=$4,
       price=$5, updated_by=$6, updated_at=NOW()
       WHERE id=$7`,
      [code, name, description || null, parseInt(quantity), parseFloat(price), userId, id]
    );

    await audit.log({
      eventType:  audit.EVENT.UPDATE_PRODUCT,
      userId,
      username:   req.session.user.username,
      ip:         req.ip,
      targetType: 'product',
      targetId:   parseInt(id),
      details:    { code, name },
    });

    res.redirect('/products');
  } catch (err) {
    const dupError = err.code === '23505' ? 'El código de producto ya existe.' : 'Error al actualizar.';
    res.render('products/form', {
      title: 'Editar Producto',
      product: { ...req.body, id },
      errors: [{ msg: dupError }],
      user: req.session.user,
      csrfToken: req.csrfToken(),
    });
  }
}

// ── Eliminar producto ───────────────────────────────────────────────────────
async function destroy(req, res) {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.redirect('/products');

  const result = await db.query(`DELETE FROM products WHERE id = $1 RETURNING code, name`, [id]);

  if (result.rows[0]) {
    await audit.log({
      eventType:  audit.EVENT.DELETE_PRODUCT,
      userId:     req.session.user.id,
      username:   req.session.user.username,
      ip:         req.ip,
      targetType: 'product',
      targetId:   parseInt(id),
      details:    result.rows[0],
    });
  }

  res.redirect('/products');
}

module.exports = { index, newForm, create, editForm, update, destroy, productValidations };
