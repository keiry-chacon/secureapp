// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const auditLog = require('../models/auditLog');

/**
 * Protege rutas que requieren sesión web activa.
 * Si no hay sesión válida → redirige al login.
 */
function requireSession(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

/**
 * Protege endpoints de la API REST con JWT.
 * El token debe estar en la cookie HttpOnly 'api_token'.
 */
function requireJWT(req, res, next) {
  const token = req.cookies?.api_token;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido.' });
  }

  try {
    // NUNCA aceptar algoritmo 'none'
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    req.jwtUser = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

/**
 * Fábrica de middleware de autorización por rol.
 * Uso: router.get('/admin', requireRole('SuperAdmin'), handler)
 *      router.get('/reportes', requireRole(['SuperAdmin','Auditor']), handler)
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    // Soporta tanto sesión web como JWT
    const user = req.session?.user || req.jwtUser;

    if (!user) {
      return res.redirect('/auth/login');
    }

    if (!roles.includes(user.role)) {
      // Registrar acceso denegado
      await auditLog.log({
        eventType: auditLog.EVENT.ACCESS_DENIED,
        userId: user.id,
        username: user.username,
        ip: req.ip,
        httpStatus: 403,
        route: req.originalUrl,
        details: { requiredRoles: roles, userRole: user.role },
      });

      // API → JSON, web → página de error
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      return res.status(403).render('error', {
        title: 'Acceso denegado',
        message: 'No tienes permisos para acceder a esta sección.',
        user: req.session.user,
      });
    }

    return next();
  };
}

/**
 * Mismo que requireRole pero para la API (responde siempre JSON).
 */
function requireRoleAPI(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    const user = req.jwtUser;

    if (!user || !roles.includes(user.role)) {
      await auditLog.log({
        eventType: auditLog.EVENT.ACCESS_DENIED,
        userId: user?.id,
        username: user?.username,
        ip: req.ip,
        httpStatus: 403,
        route: req.originalUrl,
        details: { requiredRoles: roles, userRole: user?.role },
      });
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    return next();
  };
}

module.exports = { requireSession, requireJWT, requireRole, requireRoleAPI };
