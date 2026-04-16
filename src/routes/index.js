// src/routes/index.js
const express   = require('express');
const router    = express.Router();

const authCtrl    = require('../controllers/authController');
const productCtrl = require('../controllers/productController');
const userCtrl    = require('../controllers/userController');
const auditCtrl   = require('../controllers/auditController');

const { requireSession, requireRole } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');

// ── Auth ──────────────────────────────────────────────────────────────────
router.get('/auth/login',   authCtrl.getLogin);
router.post('/auth/login',  loginLimiter, authCtrl.postLogin);
router.get('/auth/logout',  requireSession, authCtrl.logout);
router.post('/auth/token',  requireSession, authCtrl.getApiToken);

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => res.redirect('/dashboard'));
router.get('/dashboard', requireSession, (req, res) => {
  res.render('dashboard', { title: 'Dashboard', user: req.session.user, csrfToken: req.csrfToken() });
});

// ── Productos (Registrador y SuperAdmin) ──────────────────────────────────
const canWriteProducts = requireRole(['SuperAdmin', 'Registrador']);
const canReadProducts  = requireRole(['SuperAdmin', 'Registrador', 'Auditor']);

router.get('/products',          requireSession, canReadProducts,  productCtrl.index);
router.get('/products/new',      requireSession, canWriteProducts, productCtrl.newForm);
router.post('/products',         requireSession, canWriteProducts, productCtrl.productValidations, productCtrl.create);
router.get('/products/:id/edit', requireSession, canWriteProducts, productCtrl.editForm);
router.post('/products/:id',     requireSession, canWriteProducts, productCtrl.productValidations, productCtrl.update);
router.post('/products/:id/delete', requireSession, canWriteProducts, productCtrl.destroy);

// ── Usuarios (SuperAdmin) ─────────────────────────────────────────────────
const onlySuperAdmin  = requireRole('SuperAdmin');
const canReadUsers    = requireRole(['SuperAdmin', 'Registrador', 'Auditor']);

router.get('/users',          requireSession, canReadUsers,   userCtrl.index);
router.get('/users/new',      requireSession, onlySuperAdmin, userCtrl.newForm);
router.post('/users',         requireSession, onlySuperAdmin, userCtrl.create);
router.get('/users/:id/edit', requireSession, onlySuperAdmin, userCtrl.editForm);
router.post('/users/:id',     requireSession, onlySuperAdmin, userCtrl.update);
router.post('/users/:id/delete', requireSession, onlySuperAdmin, userCtrl.destroy);

// ── Log de Auditoría (solo SuperAdmin) ───────────────────────────────────
router.get('/audit', requireSession, onlySuperAdmin, auditCtrl.index);

module.exports = router;
