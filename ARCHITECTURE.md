# ARCHITECTURE.md — Arquitectura del Sistema BASEBALL HUB

## 1. Visión y Principios Rectores

**BASEBALL HUB** está concebida como una plataforma deportiva modular, desacoplada y de alto rendimiento. Inspirada en los estándares de ingeniería de datos y experiencia de usuario de las grandes plataformas deportivas profesionales (MLB.com, ESPN, Baseball-Reference), la arquitectura asegura:

1. **Agnóstica a la competición**: Soporte multi-liga (Serie Nacional de Cuba, Liga Élite, MLB, NPB, Serie del Caribe, Clásico Mundial, etc.) mediante identificadores normalizados.
2. **Historial inmutable**: Cada temporada es un registro dimensional independiente; las estadísticas históricas nunca se sobrescriben.
3. **Desacoplamiento estricto**: La capa de presentación (Frontend React SPA) no accede directamente a la base de datos ni incluye bibliotecas de servidor (`pg`, `drizzle-orm`, `firebase-admin`). Consume exclusivamente la API REST interna.
4. **Seguridad y Autorización en Capas (Defense-in-Depth)**:
   - **Autenticación Unificada**: Basada en **Supabase Auth** (con tokens JWT, OAuth de Google y sesiones persistentes).
   - **Capa RLS en Base de Datos**: PostgreSQL Row Level Security activo en todas las tablas, vistas con `security_barrier = true` y validación de roles en servidor (`public.users`).
   - **Aislamiento de Storage**: Reglas RLS en `storage.objects` con control de propiedad de carpetas para avatares y restricciones MIME/tamaño.
   - **Firebase Cloud Messaging (FCM)**: Mantenido **exclusivamente** para el despacho de notificaciones push a navegadores y dispositivos, completamente desacoplado de la autenticación y base de datos.
5. **Fallback y Resiliencia**: Repositorio híbrido con tolerancia a fallos. Si la instancia de base de datos remota es inaccesible, el sistema degrada de manera transparente al almacenamiento local offline (`server/data/database.json`) sin interrumpir la interfaz.

---

## 2. Diagrama de Arquitectura por Capas

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER (Frontend SPA)                 │
│  React 19 + TypeScript + Vite + Tailwind CSS + Lucide + Recharts       │
│                                                                        │
│  • src/context/UserAuthContext.tsx  ── Supabase Auth Client            │
│  • src/context/AdminAuthContext.tsx ── RBAC Session Management         │
│  • src/context/AppContext.tsx       ── Multi-League / Season State     │
│  • src/services/api.ts              ── REST Client (Bearer Auth)       │
│  • src/services/fcm.service.ts      ── Web Push Notifications Listener │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / Bearer Token
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Express Backend)                     │
│  server.ts / server/routes/api.router.ts                               │
│  • server/middleware/auth.ts: Validación estricta con Supabase Auth   │
│  • Sanitización y validación estricta de esquemas (Zod)                │
│  • Rate limiting, CORS y cabeceras de seguridad                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SERVICES & BUSINESS LOGIC                        │
│  server/services/                                                      │
│  • supabase-auth.service.ts   ── Sincronización y RBAC en public.users │
│  • admin-auth.service.ts      ── Sesiones y hashing seguro (Bcrypt)    │
│  • supabase-storage.service.ts── Carga y gestión de imágenes y avatars │
│  • fcm.service.ts             ── Notificaciones Push vía Firebase Admin│
│  • ingestion.service.ts       ── Normalizador y validador de datos     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│   DATA ACCESS & ORM (server/db/)  │ │     LOCAL FALLBACK STORAGE     │
│  • server/db/index.ts (Pool pg)   │ │  • server/data/database.json     │
│  • server/db/schema.ts (Drizzle)  │ │    Respaldo offline seguro       │
│  • server/db/users.ts             │ │    para inicio zero-config       │
│  • server/db/cloudsql-sync.ts     │ └──────────────────────────────────┘
└─────────────────┬─────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PERSISTENCE & SECURITY LAYER (Supabase / PostgreSQL)       │
│  • 19 Tablas relacionales con Row Level Security (RLS) habilitado      │
│  • 5 Migraciones SQL idempotentes en supabase/migrations/             │
│  • Vista pública segura: public.public_user_profiles (security_barrier)│
│  • Triggers anti-escalación y anti-tampering (SECURITY DEFINER)        │
│  • Supabase Storage: Buckets players, teams, news y avatars            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura Canónica de Directorios

```text
├── public/                     # Activos estáticos, manifest PWA, service worker FCM
│   ├── firebase-messaging-sw.js# Service Worker para notificaciones push en segundo plano
│   └── images/                 # Gráficos vectoriales y logos por defecto
├── server/                     # Backend Node.js / Express y lógica de servidor
│   ├── data/                   # Respaldo local offline
│   │   └── database.json       # Semilla local y fallback de tolerancia a fallos
│   ├── db/                     # Capa de base de datos relacional y Drizzle ORM
│   │   ├── cloudsql-sync.ts    # Sincronización con base de datos relacional
│   │   ├── drizzle.config.ts   # Configuración de Drizzle Kit
│   │   ├── index.ts            # Pool de conexión PostgreSQL (pg)
│   │   ├── schema.ts           # Definición de tablas y tipos Drizzle
│   │   └── users.ts            # Operaciones de persistencia de usuarios
│   ├── lib/                    # Clientes de infraestructura de servidor
│   │   ├── firebase-admin.ts   # SDK de Firebase Admin (exclusivo para FCM)
│   │   └── supabase.ts         # Clientes Supabase Server (Service Role / Auth)
│   ├── middleware/             # Middlewares de servidor
│   │   └── auth.ts             # Validación de JWT y control de acceso (RBAC)
│   ├── repositories/           # Repositorio transaccional de béisbol
│   │   └── baseball.repository.ts
│   ├── routes/                 # Rutas REST de Express
│   │   └── api.router.ts
│   └── services/               # Lógica de dominio y servicios auxiliares
│       ├── admin-auth.service.ts
│       ├── fcm.service.ts      # Despacho de notificaciones push
│       ├── ingestion.service.ts
│       ├── notification.service.ts
│       ├── supabase-auth.service.ts
│       └── supabase-storage.service.ts # Carga a buckets de Supabase
├── src/                        # Frontend React SPA (exclusivo de cliente)
│   ├── components/             # Componentes visuales y widgets
│   ├── context/                # Contextos de estado de React
│   │   ├── AdminAuthContext.tsx# Sesión administrativa
│   │   ├── AppContext.tsx      # Competición activa, navegación y tema
│   │   ├── ScoreNotificationContext.tsx # Suscripciones a marcadores
│   │   └── UserAuthContext.tsx # Autenticación de usuario con Supabase Auth
│   ├── lib/                    # Clientes frontend
│   │   ├── firebase.ts         # Inicialización cliente de FCM (Push Messaging)
│   │   └── supabase.ts         # Cliente Supabase navegador (Anon Key)
│   ├── services/               # Clientes HTTP y FCM frontend
│   │   ├── api.ts              # Cliente API REST unificado
│   │   └── fcm.service.ts      # Registro de tokens de notificación en el navegador
│   ├── types/                  # Definiciones de tipos TypeScript compartidos
│   └── views/                  # Vistas principales de la aplicación
├── supabase/                   # Migraciones y configuración de Supabase
│   └── migrations/             # Cadena histórica de migraciones SQL (v1 a v4/final)
├── scripts/                    # Herramientas y suite de pruebas de seguridad
│   └── security-tests.ts       # Suite automatizada (86 pruebas)
└── server.ts                   # Punto de entrada del servidor Express
```

---

## 4. Estrategia de Autenticación y Autorización

### 4.1 Supabase Auth como Fuente Principal
- **Usuarios Finales**: Inicio de sesión mediante OAuth (Google) o email/contraseña gestionado por Supabase Auth.
- **Sincronización Transparente**: Al autenticarse, el cliente envía el token JWT a `/api/auth/sync`, donde el servidor upserta el perfil en `public.users` garantizando que el rol asignado sea estrictamente `'user'` salvo que un superadmin lo modifique.
- **Gestión Administrativa**: Soporte para roles `'superadmin'`, `'admin'`, `'editor'`, `'official_scorer'` y `'prensa'` validados directamente contra la tabla autoritativa `public.users`.

### 4.2 Desacoplamiento de Firebase (Solo FCM)
- **Firebase Authentication** y **Firestore** han sido completamente retirados de los flujos de datos.
- **Firebase Cloud Messaging (FCM)** se conserva única y exclusivamente para registrar tokens de dispositivo del navegador (`public/firebase-messaging-sw.js`, `src/services/fcm.service.ts`) y despachar notificaciones push desde el servidor (`server/services/fcm.service.ts`, `server/lib/firebase-admin.ts`) cuando ocurren cambios de marcador en partidos en vivo.
