# DEPLOYMENT.md — Guía de Despliegue y Operaciones en Producción

**BASEBALL HUB** está preparado para ejecutarse en contenedores estándar o en plataformas de nube modernas (Google Cloud Run, AWS ECS/App Runner, Railway, Render o Vercel), respaldado por una base de datos PostgreSQL gestionada en **Supabase**.

---

## 1. Lista de Verificación Previa al Despliegue (Production Checklist)

Antes de promover una versión a producción, completa rigurosamente los siguientes 5 puntos:

- [ ] **1. Rotación y Aislamiento de Secretos**:
  - Asegurar que `SUPABASE_SERVICE_ROLE_KEY` nunca esté expuesta en variables con prefijo `VITE_` ni en el código empaquetado del cliente.
  - Generar un `JWT_SECRET` seguro para la firma de tokens administrativos (mínimo 64 caracteres aleatorios).
  - Configurar las credenciales administrativas iniciales mediante `ADMIN_PASSWORD_HASH` (hash de bcrypt generado con al menos cost factor 10).
- [ ] **2. Ejecución Secuencial de Migraciones SQL**:
  - Aplicar las 5 migraciones en el SQL Editor o CLI de Supabase en el orden estricto indicado en la sección 3.
- [ ] **3. Diagnóstico de Salud de la Base de Datos**:
  - Ejecutar la **Health Check Query** documentada en `DATABASE.md` para verificar que todas las tablas tienen `rowsecurity = true`, la vista `public_user_profiles` está activa y los 4 buckets de Storage están configurados.
- [ ] **4. Validación Automatizada de Integridad de Código**:
  - Ejecutar localmente o en el pipeline de CI/CD:
    ```bash
    npm run lint   # Validación de tipos estricta sin emitir código (tsc --noEmit)
    npm test       # Ejecución de la suite de 86 pruebas de seguridad
    npm run build  # Compilación de la SPA con Vite y del servidor con Esbuild
    ```
- [ ] **5. Configuración de Firebase Cloud Messaging (Opcional para Notificaciones Push)**:
  - Si se activan las alertas en vivo, cargar `firebase-applet-config.json` con las claves del proyecto y la clave de cuenta de servicio para `server/lib/firebase-admin.ts`.

---

## 2. Variables de Entorno de Producción

Configura las siguientes variables en el gestor de secretos de tu plataforma de alojamiento (Cloud Run, Railway, Render, etc.):

| Variable | Requerida | Ámbito | Descripción |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | **Sí** | Servidor | Debe establecerse en `production`. |
| `PORT` | **Sí** | Servidor | Puerto de escucha HTTP (por defecto `3000`). |
| `SUPABASE_URL` | **Sí** | Servidor / Build | URL de la API del proyecto Supabase (`https://xyz.supabase.co`). |
| `VITE_SUPABASE_URL` | **Sí** | Cliente (Build) | Misma URL de Supabase para el cliente web. |
| `SUPABASE_ANON_KEY` | **Sí** | Servidor / Build | Clave pública anónima de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | **Sí** | Cliente (Build) | Misma clave pública para el cliente web. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | **Solo Servidor** | Clave administrativa secreta para operaciones del backend. **NUNCA exponer al cliente.** |
| `JWT_SECRET` | Recomendada | Solo Servidor | Clave para validación y firma de sesiones del panel de administración. |
| `ADMIN_USERNAME` | Opcional | Solo Servidor | Usuario inicial del superadministrador (por defecto `admin`). |
| `ADMIN_PASSWORD_HASH` | Opcional | Solo Servidor | Hash bcrypt de la contraseña del superadministrador. |
| `SQL_HOST` / `SQL_USER` / `SQL_PASSWORD` / `SQL_DB_NAME` | Opcional | Solo Servidor | Cadena de conexión para réplicas o sincronización directa Cloud SQL / Pool Drizzle. |

---

## 3. Orden de Ejecución de Migraciones SQL

En una instancia nueva o preexistente de Supabase, ejecuta secuencialmente los scripts ubicados en `supabase/migrations/`:

```bash
# 1. Esquema base (19 tablas relacionales e índices B-Tree)
supabase/migrations/20261006000000_baseball_hub_schema.sql

# 2. Hardening RLS v1 (Helper get_auth_user_role)
supabase/migrations/20261010000000_baseball_hub_rls_hardening.sql

# 3. Hardening RLS v2 (Anti-escalación y protección de comentarios)
supabase/migrations/20261013000000_baseball_hub_rls_hardening_v2.sql

# 4. Hardening RLS v3 (is_authorized_service_role y vista public_user_profiles)
supabase/migrations/20261015000000_baseball_hub_rls_hardening_v3.sql

# 5. Auditoría Final y Storage RLS (Fase 2.5 y Fase 2.6)
supabase/migrations/20261016000000_baseball_hub_rls_final_audit.sql
```

> **Nota:** Todos los scripts han sido diseñados con directivas `IF NOT EXISTS`, `OR REPLACE` y bloques `DROP POLICY IF EXISTS`, garantizando ejecución idempotente sin pérdida de datos.

---

## 4. Comandos de Compilación y Arranque

### Compilación Unificada (Build):
```bash
npm run build
```
Este comando ejecuta dos fases:
1. `vite build`: Empaqueta la aplicación React en `dist/` optimizando chunks, CSS y activos estáticos.
2. `esbuild server.ts`: Empaqueta el servidor Express en `dist/server.cjs` para ejecución limpia en Node.js sin transpilación en tiempo de ejecución.

### Inicio de Producción:
```bash
npm start
```
Ejecuta `node server.ts` (o `node dist/server.cjs`), iniciando el servidor HTTP en `0.0.0.0:$PORT`.

---

## 5. Verificación Post-Despliegue

1. **Endpoint de Salud**:
   ```bash
   curl -I https://tu-dominio.com/api/teams
   ```
   Debe devolver HTTP `200 OK` con la lista de franquicias en formato JSON.
2. **Prueba de Inmunidad Anti-Escalada**:
   Verifica que peticiones no autenticadas o con tokens ordinarios a `/api/admin/games` devuelvan `401 Unauthorized` o `403 Forbidden`.
3. **Persistencia Híbrida**:
   Si la conexión a Supabase se interrumpe temporalmente por mantenimiento de red, el backend conmuta de forma transparente al respaldo local `server/data/database.json` manteniendo la navegación de los aficionados activa.
