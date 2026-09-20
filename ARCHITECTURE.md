# ARCHITECTURE.md — Arquitectura del Sistema BASEBALL HUB

## 1. Visión y Principios Rectores

BASEBALL HUB está concebida como una plataforma deportiva modular, desacoplada y de alto rendimiento. Inspirada en los estándares de ingeniería de datos y experiencia de usuario de las grandes plataformas deportivas profesionales (MLB.com, ESPN, Baseball-Reference), la arquitectura asegura:

1. **Agnóstica a la competición**: Soporte multi-liga (Serie Nacional de Cuba, Liga Élite, MLB, NPB, Serie del Caribe, Clásico Mundial, etc.) mediante identificadores normalizados.
2. **Historial inmutable**: Cada temporada es un registro dimensional independiente; las estadísticas históricas nunca se sobrescriben.
3. **Desacoplamiento estricto**: La capa de presentación (Frontend React) desconoce el almacenamiento subyacente; consume exclusivamente la capa de API REST.
4. **Data Ingestion Layer**: Canalización aislada para importación (CSV, JSON, XML, futuras fuentes API o PDFs) con fases de Normalización y Validación antes de la inserción.
5. **Preparación para Alta Concurrencia y Tiempo Real**: Preparada para WebSockets/SSE y almacenamiento en caché (Redis / CDN).

---

## 2. Diagrama de Arquitectura por Capas

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (UI)                     │
│  React 19 + TypeScript + Vite + Tailwind CSS + Lucide + Recharts│
│  - State Context (Active Competition, Season, Theme, Locale)   │
│  - Modular Features: Home, Games, Stats, Standings, Teams, etc. │
│  - Responsive & Accessible Design (WCAG 2.1 AA)                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP REST (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Express.js)                     │
│  - Routes & Controllers (/api/competitions, /api/games, etc.)   │
│  - Input Validation & Parameter Sanitization                    │
│  - Pagination, Filtering, Sorting & Search Middleware           │
│  - Error Handling & Security Headers (CORS, Rate Limit ready)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC (Services)                    │
│  - GameEngine & BoxScore Calculation                           │
│  - Standings Calculator (PCT, Games Behind, Run Differential)   │
│  - Sabermetrics & Advanced Stats (wOBA, FIP, BABIP, OPS+)       │
│  - Data Ingestion Service (Parser -> Normalizer -> Validator)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER (Repositories)             │
│  - Database Abstraction Interface                               │
│  - PostgreSQL / Supabase Driver Client                          │
│  - In-Memory & Seed Store for instant zero-config startup       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 DATABASE (PostgreSQL / Supabase)                │
│  - Relational Schema with Foreign Keys & B-Tree Indexes         │
│  - Multi-season Partitioning & sabermetric projections          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Capa de Ingestión de Datos (Data Ingestion Pipeline)

Para garantizar que fuentes heterogéneas (APIs oficiales, planillas de anotación en CSV, hojas de cálculo de federaciones, o volcado de anotadores manuales) no contaminen el modelo de dominio:

```text
Fuente Externa (CSV / JSON / API / PDF)
                ↓
           [IMPORTER]
    Lectura de stream y parseo
                ↓
          [NORMALIZER]
    Mapeo de nombres variables a claves canónicas:
    ('BA' | 'AVG' | 'Promedio') -> 'batting_average'
    ('HR' | 'Jonrones' | 'Cuadrangulares') -> 'home_runs'
                ↓
          [VALIDATOR]
    Comprobación de tipos, rangos lógicos:
    - AVG entre 0.000 y 1.000
    - ERA >= 0.00
    - Claves foráneas existentes (team_id, player_id)
                ↓
      [PREVIEW & AUDIT]
    Reporte previo: Registros Válidos, Advertencias, Errores
                ↓
          [COMMITTED]
    Persistencia transaccional en Base de Datos
```

---

## 4. Fases de Desarrollo

- **FASE 1 (CORE - Implementada)**:
  - React/TypeScript modular
  - Dashboard Home, Partidos, Equipos, Jugadores, Posiciones, Estadísticas
  - Box Scores completos, Line Score por innings, Play-by-play
  - Líderes estadísticos y gráficos de tendencia (Recharts)
  - Capa de datos inicial multi-competición (Serie Nacional y Liga Élite)
- **FASE 2 (API & Repositorios)**:
  - Endpoints REST `/api/*` completos con filtrado y ordenación
  - Servicios desacoplados y repositorio transaccional
- **FASE 3 (Data Ingestion & Admin)**:
  - Panel administrativo `/admin`
  - Herramienta interactiva de importación CSV/JSON con vista previa y validación
- **FASE 4 (Contenido & Multimedia)**:
  - Noticias categorizadas con enlaces bidireccionales a equipos/jugadores
  - Módulo de vídeos destacados
  - Meta-tags y Schema.org para SEO
- **FASE 5 (Tiempo Real & Avanzadas - Preparado)**:
  - Arquitectura preparada para WebSockets / Server-Sent Events en marcador en vivo
  - Métricas avanzadas (WAR, wOBA, FIP, BABIP, OPS+, ERA+)
