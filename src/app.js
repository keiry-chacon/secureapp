// src/app.js
require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const csrf         = require('csurf');
const path         = require('path');

const { pool }             = require('./config/db');
const { helmetMiddleware } = require('./middleware/security');
const webRoutes            = require('./routes/index');
const apiRoutes            = require('./routes/api');

const app = express();

// ── 1. Headers de seguridad (Helmet) ──────────────────────────────────────
app.use(helmetMiddleware);

// ── 2. Body parsers ───────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── 3. Confiar en proxy (necesario para req.ip real detrás de ngrok/nginx) ─
app.set('trust proxy', 1);

// ── 4. Sesiones con almacenamiento en PostgreSQL ──────────────────────────
//    RS-04: cookie segura, httpOnly, timeout
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,                                      // resetea el timeout con cada request
  cookie: {
    httpOnly: true,                                   // RS-04: no accesible desde JS del cliente
    secure:   process.env.NODE_ENV === 'development',  // RS-04: solo HTTPS en producción
    sameSite: 'strict',                               // RS-03: previene CSRF básico
    maxAge:   5 * 60 * 1000,                          // RS-04: 5 minutos de inactividad
  },
}));

// ── 5. CSRF (protege todas las rutas web con estado) ──────────────────────
//    La API REST usa JWT → excluida del CSRF
const csrfProtection = csrf({ cookie: false });

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  csrfProtection(req, res, next);
});

// ── 6. Motor de vistas ────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── 7. Archivos estáticos ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── 8. Variables globales para todas las vistas ───────────────────────────
app.use((req, res, next) => {
  res.locals.currentUser = req.session?.user || null;
  next();
});

// ── 9. Rutas ──────────────────────────────────────────────────────────────
app.use('/', webRoutes);
app.use('/api', apiRoutes);

// ── 10. Manejador de errores CSRF ─────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Sesión inválida',
      message: 'El token de seguridad expiró o es inválido. Por favor vuelve a intentarlo.',
      user: req.session?.user || null,
    });
  }
  next(err);
});

// ── 11. Manejador de errores genérico ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
  res.status(500).render('error', {
    title: 'Error',
    message: 'Ocurrió un error inesperado.',
    user: req.session?.user || null,
  });
});

// ── 12. 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ruta no encontrada.' });
  }
  res.status(404).render('error', {
    title: '404',
    message: 'Página no encontrada.',
    user: req.session?.user || null,
  });
});

// ── 13. Iniciar servidor ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SecureApp corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV}`);
});

module.exports = app;
