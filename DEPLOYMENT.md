# DEPLOYMENT.md — Guía de Despliegue y Operaciones

**BASEBALL HUB** está preparado para ejecutarse tanto en entornos de nube modernos (Cloud Run, Vercel, Render, Railway) como en contenedores Docker estándar.

---

## 1. Despliegue Frontend & Backend Unificado (Cloud Run / Render / Railway)

El proyecto utiliza un contenedor Node.js con Express y Vite que sirve la API REST en `/api/*` y la aplicación SPA para el resto de rutas.

### Requisitos Previos:
- Node.js 20+
- npm 10+
- Base de datos PostgreSQL (vía Supabase, Cloud SQL, Neon o RDS)

### Pasos de Construcción y Ejecución:
```bash
# 1. Instalar dependencias
npm install

# 2. Compilar frontend y backend
npm run build

# 3. Iniciar en modo producción
npm start
```

El servidor escucha en el puerto `3000` (o `$PORT` según el entorno) en `0.0.0.0`.

---

## 2. Despliegue Desacoplado (Vercel + Supabase)

Si se opta por arquitectura Serverless / Edge:
- **Frontend**: Desplegar el directorio `dist/` en Vercel o Netlify.
- **Backend**: Desplegar `server/` como Vercel Serverless Functions o en Railway/Render.
- **Base de Datos**: Crear proyecto en [Supabase](https://supabase.com), ejecutar el script DDL de `DATABASE.md` en el SQL Editor y copiar las variables `DATABASE_URL` y `SUPABASE_ANON_KEY`.

---

## 3. Variables de Entorno de Producción

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto de escucha | `3000` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `SUPABASE_URL` | URL de la API Supabase | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave pública para cliente Supabase | `eyJh...` |
| `JWT_SECRET` | Firma de tokens administrativos | Clave criptográfica segura |

---

## 4. Política de Caché y Rendimiento

1. **Browser Cache**: Activos estáticos (`/assets/*`) con hash inmutable y cabecera `Cache-Control: public, max-age=31536000, immutable`.
2. **API Cache**: Endpoints de resultados finalizados y estadísticas históricas devuelven `Cache-Control: public, max-age=300` (5 minutos). Endpoints de partidos en vivo devuelven `Cache-Control: no-cache`.
