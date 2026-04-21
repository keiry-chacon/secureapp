# 🔒 SecureApp — Proyecto 2 ISW-1013

**Aplicación Web Segura** | Universidad Técnica Nacional | I Cuatrimestre 2026

SecureApp es una aplicación web construida con Node.js + Express + PostgreSQL que demuestra controles de seguridad reales: protección contra SQLi, XSS, CSRF, sesiones seguras, JWT, rate limiting y más. Desarrollada como proyecto académico para el curso ISW-1013.

---

## ⚡ Levantar con Docker (recomendado)

> Asegurate de tener **Docker ≥ 24** y **Docker Compose ≥ 2** instalados.

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/keiry-chacon/secureapp
cd secureapp
```

### Paso 2 — Levantar todo con un solo comando

```bash
docker compose up
```

Esto hace automáticamente:
1. Construye la imagen de Node.js
2. Levanta PostgreSQL 16
3. Crea las tablas (`migrate.js`)
4. Inserta datos iniciales (`seed.js`)
5. Inicia la app en el puerto 3000

### Paso 3 — Abrir en el navegador

```
http://localhost:3000
```

### Credenciales por defecto

| Usuario | Contraseña | Rol |
|---|---|---|
| `superadmin` | `Admin@1234!` | SuperAdmin |

> ⚠️ **Cambia la contraseña del superadmin después del primer login.**

### Detener la aplicación

```bash
# Detener sin borrar datos
docker-compose down

# Detener Y borrar la base de datos
docker-compose down -v
```

---

## 🏗️ Stack tecnológico

| Capa | Tecnología | Rol de seguridad |
|---|---|---|
| Runtime | Node.js 20 LTS | Parches de seguridad frecuentes |
| Framework | Express 4 | Ecosistema de seguridad maduro |
| Base de datos | PostgreSQL 16 | Prepared statements, robustez ACID |
| Hashing | bcrypt (cost=12) | Resistente a fuerza bruta |
| Sesiones | express-session + pg | Server-side, cookie HttpOnly |
| JWT | jsonwebtoken (HS256) | Expiración 1h, rechaza `alg:none` |
| Headers | Helmet 7 | CSP, HSTS, X-Frame-Options, nosniff |
| CSRF | csurf | Token sincronizador en formularios POST |
| Validación | express-validator | Doble validación frontend + backend |
| Rate limiting | express-rate-limit | Bloqueo tras 5 intentos fallidos |

---

## 🔐 Controles de seguridad implementados

| ID | Control | Implementación |
|---|---|---|
| RS-01 | SQL Injection | Prepared statements `$1,$2...` en todas las queries |
| RS-02 | XSS | `.escape()` en validadores + CSP estricto via Helmet |
| RS-03 | CSRF | Token `_csrf` oculto en todos los formularios POST |
| RS-04 | Sesiones | Timeout 5 min, regeneración post-login, cookie HttpOnly |
| RS-05 | JWT | HS256 obligatorio, expiración 1h, cookie HttpOnly |
| RS-06 | Headers HTTP | CSP, X-Frame-Options:DENY, nosniff, HSTS, Referrer-Policy |
| RS-07 | Rate limiting | 5 intentos → bloqueo 5 min, registrado en auditoría |

---

## 👥 Roles y permisos

| Rol | Productos | Usuarios | Auditoría |
|---|---|---|---|
| **SuperAdmin** | CRUD completo | CRUD + gestión de roles | ✅ Ver logs |
| **Registrador** | CRUD completo | Solo lectura | ❌ |
| **Auditor** | Solo lectura | Solo lectura | ❌ |

> Los permisos se validan en el **backend** en cada request, no solo en la UI.

---
### Endpoints

```
GET    /api/health           # Health check (público)
POST   /auth/token           # Genera JWT (requiere sesión activa)

GET    /api/products         # Listar productos
POST   /api/products         # Crear producto
GET    /api/products/:id     # Ver producto
PUT    /api/products/:id     # Actualizar producto
DELETE /api/products/:id     # Eliminar producto

GET    /api/users            # Listar usuarios
GET    /api/users/:id        # Ver usuario (solo SuperAdmin)
```

---

## 📁 Estructura del proyecto

```
secureapp/
├── src/
│   ├── app.js                  # Entry point y middleware pipeline
│   ├── config/
│   │   └── db.js               # Pool de conexiones PostgreSQL
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── userController.js
│   │   └── auditController.js
│   ├── middleware/
│   │   ├── auth.js             # requireSession, requireJWT, requireRole
│   │   └── security.js         # Helmet, rate limiter
│   ├── models/
│   │   └── auditLog.js         # Registro de eventos de seguridad
│   ├── routes/
│   │   ├── index.js            # Rutas web
│   │   └── api.js              # Rutas API REST
│   ├── views/                  # Plantillas EJS
│   └── public/css/style.css
├── scripts/
│   ├── migrate.js              # Crea tablas en la BD
│   └── seed.js                 # Inserta datos iniciales
├── api_docs/
│   └── openapi.yaml            # Documentación Swagger
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 👨‍💻 Equipo

| Nombre |
|---|
|Keiry Chacon Sibaja|
|Gredy Corrales Mendoza|
|Deiber Molina Sobalvarro|