// src/models/auditLog.js
const db = require('../config/db');

const EVENT = {
  LOGIN_OK:         'LOGIN_OK',
  LOGIN_FAIL:       'LOGIN_FAIL',
  LOGOUT:           'LOGOUT',
  LOGIN_BLOCKED:    'LOGIN_BLOCKED',
  CREATE_USER:      'CREATE_USER',
  UPDATE_USER:      'UPDATE_USER',
  DELETE_USER:      'DELETE_USER',
  CHANGE_ROLE:      'CHANGE_ROLE',
  CREATE_PRODUCT:   'CREATE_PRODUCT',
  UPDATE_PRODUCT:   'UPDATE_PRODUCT',
  DELETE_PRODUCT:   'DELETE_PRODUCT',
  ACCESS_DENIED:    'ACCESS_DENIED',
};

/**
 * Registra un evento de seguridad en la tabla audit_logs.
 * @param {object} opts
 * @param {string}  opts.eventType  - Constante de EVENT
 * @param {number}  [opts.userId]   - ID del usuario que realiza la acción
 * @param {string}  [opts.username] - Snapshot del username
 * @param {string}  opts.ip         - IP de origen
 * @param {string}  [opts.targetType]
 * @param {number}  [opts.targetId]
 * @param {object}  [opts.details]  - Info extra en JSON
 * @param {number}  [opts.httpStatus]
 * @param {string}  [opts.route]
 */
async function log(opts) {
  const {
    eventType, userId = null, username = null, ip,
    targetType = null, targetId = null,
    details = null, httpStatus = null, route = null,
  } = opts;

  try {
    await db.query(`
      INSERT INTO audit_logs
        (event_type, user_id, username, ip_address,
         target_type, target_id, details, http_status, route)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      eventType, userId, username, ip,
      targetType, targetId,
      details ? JSON.stringify(details) : null,
      httpStatus, route,
    ]);
  } catch (err) {
    // El log nunca debe romper el flujo principal
    console.error('AuditLog error:', err.message);
  }
}

/**
 * Obtiene los logs paginados (solo SuperAdmin puede llamar esto).
 */
async function getAll({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const result = await db.query(`
    SELECT al.*, u.username as actor_username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const count = await db.query(`SELECT COUNT(*) FROM audit_logs`);
  return {
    logs: result.rows,
    total: parseInt(count.rows[0].count, 10),
    page,
    limit,
  };
}

module.exports = { log, getAll, EVENT };
