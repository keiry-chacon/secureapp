// src/controllers/auditController.js
const auditModel = require('../models/auditLog');

async function index(req, res) {
  const page  = parseInt(req.query.page  || '1', 10);
  const limit = parseInt(req.query.limit || '50', 10);

  const data = await auditModel.getAll({ page, limit });

  res.render('audit/index', {
    title: 'Log de Auditoría',
    ...data,
    user: req.session.user,
    csrfToken: req.csrfToken(),
  });
}

module.exports = { index };
