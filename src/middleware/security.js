// src/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Helmet con Content-Security-Policy estricto.
 * Cubre RS-02 (XSS/CSP) y RS-06 (headers HTTP).
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],           // Sin inline scripts, sin CDNs no listados
      styleSrc:    ["'self'", "'unsafe-inline'"], // unsafe-inline solo para estilos inline básicos
      imgSrc:      ["'self'", 'data:'],
      fontSrc:     ["'self'"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
    },
  },
  // X-Frame-Options: DENY  → previene clickjacking (RS-06)
  frameguard: { action: 'deny' },
  // X-Content-Type-Options: nosniff  (RS-06)
  noSniff: true,
  // Strict-Transport-Security  (RS-06)
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Referrer-Policy  (RS-06)
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Ocultar "X-Powered-By: Express"
  hidePoweredBy: true,
});

/**
 * Rate limiter para el endpoint de login.
 * 5 intentos por IP → bloqueo 5 minutos (RS-07).
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_BLOCK_MINUTES || '5', 10) * 60 * 1000,
  max: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,   // Solo cuenta los fallos
  message: {
    error: 'Demasiados intentos fallidos. Tu IP ha sido bloqueada temporalmente.',
  },
  handler: (req, res, next, options) => {
    // Registrar el bloqueo en el log de auditoría
    const auditLog = require('../models/auditLog');
    auditLog.log({
      eventType: auditLog.EVENT.LOGIN_BLOCKED,
      ip: req.ip,
      route: req.originalUrl,
      details: { reason: 'rate_limit_exceeded' },
    }).catch(() => {});

    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter general para la API.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta más tarde.' },
});

module.exports = { helmetMiddleware, loginLimiter, apiLimiter };
