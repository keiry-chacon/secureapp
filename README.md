# 🔒 SecureApp — Proyecto 2 ISW-1013

Aplicación Web Segura | Universidad Técnica Nacional | I Cuatrimestre 2026

---

## 🚀 Inicio rápido (una sola línea)

```bash
docker-compose up --build
```

La aplicación estará disponible en **http://localhost:3000**

**Credenciales por defecto:**
| Usuario | Contraseña | Rol |
|---|---|---|
| `superadmin` | `Admin@1234!` | SuperAdmin |

> ⚠️ Cambia la contraseña del superadmin después del primer login.

---

## 📋 Requisitos previos

- [Docker](https://www.docker.com/get-started) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2
- (Opcional para desarrollo local) Node.js ≥ 20

---

## 🌐 Exponer a internet con ngrok (requerido para pentest y defensa)

1. Crear cuenta gratuita en [ngrok.com](https://ngrok.com)
2. Instalar ngrok: [instrucciones oficiales](https://ngrok.com/download)
3. Autenticarse:
   ```bash
   ngrok config add-authtoken <TU_TOKEN>
   ```
4. Con el proyecto corriendo, ejecutar:
   ```bash
   ngrok http 3000
   ```
5. Copiar la URL pública (ejemplo: `https://abc123.ngrok-free.app`) y actualizar este README.

**URL pública actual:** `https://PENDIENTE.ngrok-free.app`

---

## 🛠️ Desarrollo local (sin Docker)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos de PostgreSQL local

# 3. Crear tablas
npm run db:migrate

# 4. Insertar datos iniciales
npm run db:seed

# 5. Correr en modo desarrollo
npm run dev
```

---

## 🏗️ Stack tecnológico

| Capa | Tecnología | Justificación de seguridad |
|---|---|---|
| Runtime | Node.js 20 LTS | Activamente mantenido, parches de seguridad frecuentes |
| Framework | Express 4 | Maduro, ecosistema de seguridad amplio |
| Base de datos | PostgreSQL 16 | Prepared statements nativos, robustez ACID |
| Hashing | bcrypt (cost=12) | Algoritmo adaptativo resistente a fuerza bruta |
| Sesiones | express-session + pg | Almacenamiento server-side, no expone datos al cliente |
| JWT | jsonwebtoken (HS256) | Expiración obligatoria, rechazo de `alg:none` |
| Headers | Helmet 7 | CSP, HSTS, X-Frame-Options, nosniff |
| CSRF | csurf | Token sincronizador en todos los formularios |
| Validación | express-validator | Doble validación: frontend y backend |
| Rate limiting | express-rate-limit | Bloqueo de fuerza bruta en login |

---

## 🔐 Controles de seguridad implementados

| ID | Control | Implementación |
|---|---|---|
| RS-01 | SQLi | Prepared statements `$1,$2...` en todas las queries |
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
| **SuperAdmin** | CRUD | CRUD + roles | ✅ Ver logs |
| **Registrador** | CRUD | Solo lectura | ❌ |
| **Auditor** | Solo lectura | Solo lectura | ❌ |

> Los permisos se validan en el **backend** en cada request, no solo en la UI.

---

## 📡 API REST

Documentación completa: [`api_docs/openapi.yaml`](api_docs/openapi.yaml)

Visualizar en Swagger UI: pegar el contenido del YAML en [editor.swagger.io](https://editor.swagger.io)

### Autenticación

```bash
# 1. Hacer login en el navegador (obtiene cookie de sesión)
# 2. Generar token JWT:
curl -X POST http://localhost:3000/auth/token \
     -H "Cookie: connect.sid=TU_SESSION_ID"

# 3. El token queda en cookie HttpOnly api_token
# 4. Usar la API:
curl http://localhost:3000/api/products \
     -H "Cookie: api_token=TU_JWT"
```

### Endpoints disponibles

```
GET    /api/health           # Público
POST   /auth/token           # Genera JWT (requiere sesión)

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
│   ├── app.js                  # Entry point, middleware pipeline
│   ├── config/
│   │   └── db.js               # Pool de PostgreSQL
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
│   ├── migrate.js              # Crea tablas
│   └── seed.js                 # Datos iniciales
├── api_docs/
│   └── openapi.yaml            # Documentación Swagger
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 🧪 Casos de prueba (resumen)

Ver documento técnico PDF para los 20+ casos completos.

| # | Caso | Tipo |
|---|---|---|
| CP-01 | Login exitoso con credenciales válidas | Funcional |
| CP-02 | Login fallido registra evento en auditoría | Seguridad |
| CP-03 | Bloqueo tras 5 intentos fallidos | RS-07 |
| CP-04 | CRUD producto con rol Registrador | RF-03 |
| CP-05 | Auditor no puede crear productos (403) | RF-05 |
| CP-06 | SQL injection en login bloqueado | RS-01 |
| CP-07 | XSS en descripción de producto escapado | RS-02 |
| CP-08 | CSRF token inválido retorna 403 | RS-03 |
| CP-09 | Sesión expira tras 5 min de inactividad | RS-04 |
| CP-10 | JWT con alg:none rechazado | RS-05 |

---

## 👨‍💻 Equipo

| Nombre | Email | Rol |
|---|---|---|
| (Coordinador) | | Coordinador |
| | | Integrante |
| | | Integrante |
| | | Integrante |
