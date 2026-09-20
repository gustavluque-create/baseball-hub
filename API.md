# API.md — Especificación de Endpoints RESTful

Todos los endpoints responden en formato JSON y siguen las convenciones REST estándar de códigos de estado HTTP (200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error).

Prefijo base: `/api`

---

## 1. Competiciones y Temporadas

### `GET /api/competitions`
- **Descripción**: Lista de competiciones disponibles (Serie Nacional, Liga Élite, etc.).
- **Respuesta**:
  ```json
  [
    {
      "id": "cuba-snb",
      "name": "Serie Nacional de Béisbol",
      "shortName": "SNB",
      "country": "Cuba",
      "status": "active",
      "logo": "https://..."
    }
  ]
  ```

### `GET /api/seasons?competition=cuba-snb`
- **Descripción**: Temporadas asociadas a una competición.

---

## 2. Partidos y Resultados

### `GET /api/games`
- **Query Params**:
  - `competition`: (string) ID de la competición
  - `season`: (string) ID o año de la temporada
  - `date`: (string YYYY-MM-DD) Filtro por fecha
  - `status`: (`ALL` | `LIVE` | `FINAL` | `SCHEDULED`)
  - `team`: (string) Filtro por ID de equipo (local o visitante)
- **Respuesta**: Lista de partidos con marcadores, innings y estado.

### `GET /api/games/:id`
- **Descripción**: Detalle íntegro de un partido.
- **Incluye**:
  - Line score por entradas (R, H, E para ambos equipos)
  - Box score completo de bateo (AB, R, H, RBI, BB, SO, AVG)
  - Box score completo de pitcheo (IP, H, R, ER, BB, SO, ERA)
  - Play-by-play (secuencia cronológica de eventos por entrada)
  - Árbitros, duración, asistencia y estadio.

---

## 3. Equipos y Plantillas

### `GET /api/teams`
- **Query Params**: `competition`, `season`
- **Respuesta**: Lista de equipos con récord actual, estadio y colores institucionales.

### `GET /api/teams/:id`
- **Descripción**: Perfil detallado del equipo, estadísticas acumuladas de bateo/pitcheo colectivo, plantilla activa agrupada por posición (Lanzadores, Receptores, Cuadro, Jardineros), últimos y próximos encuentros.

---

## 4. Jugadores y Estadísticas

### `GET /api/players`
- **Query Params**:
  - `team`: ID de equipo
  - `position`: Posición primaria (ej. `SP`, `SS`, `CF`)
  - `search`: Búsqueda textual por nombre o apellido
  - `page`: Número de página (por defecto 1)
  - `limit`: Límite de resultados (por defecto 20)

### `GET /api/players/:id`
- **Descripción**: Perfil biográfico completo, historial multi-temporada, estadísticas de bateo/pitcheo/defensa, splits y métricas de tendencia.

---

## 5. Tabla de Posiciones y Líderes

### `GET /api/standings`
- **Query Params**: `competition`, `season`, `group`
- **Respuesta**: Tabla de clasificación con JJ, G, P, AVG/PCT, Dif, L10, Racha, Carreras a favor y en contra.

### `GET /api/leaders`
- **Query Params**:
  - `season`: ID de temporada
  - `category`: `batting` | `pitching`
  - `stat`: `avg`, `hr`, `rbi`, `ops`, `era`, `whip`, `so`, `saves`
  - `limit`: 5, 10, 20 o 50
- **Respuesta**: Lista clasificada con ranking, foto del jugador, equipo y valor numérico.

---

## 6. Estadísticas Dinámicas y Sabermetría

### `GET /api/stats`
- **Query Params**:
  - `type`: `batting` | `pitching` | `fielding` | `advanced`
  - `season`: ID de temporada
  - `sortBy`: clave de la estadística (ej: `ops`, `avg`, `war`)
  - `order`: `asc` | `desc`
  - `minPA`: mínimo de apariciones al plato (para calificar)
  - `page`, `limit`

---

## 7. Noticias y Búsqueda Global

### `GET /api/news`
- **Query Params**: `category`, `team`, `player`, `limit`

### `GET /api/news/:slug`
- **Descripción**: Artículo completo con entidades relacionadas.

### `GET /api/search?q=termino`
- **Descripción**: Búsqueda global agregada clasificada en `{ players: [], teams: [], competitions: [] }`.

---

## 8. Ingestión de Datos (Data Ingestion Pipeline)

### `POST /api/ingest/validate`
- **Body**: `{ sourceType: "CSV" | "JSON", rawData: string, dataType: "batting" | "games" | "roster" }`
- **Respuesta**:
  ```json
  {
    "totalRecords": 150,
    "validRecords": 146,
    "warnings": [
      { "row": 12, "field": "AVG", "message": "Calculado a partir de H/AB" }
    ],
    "errors": [
      { "row": 45, "field": "team_id", "message": "Equipo 'XYZ' no encontrado" }
    ],
    "preview": [...]
  }
  ```

### `POST /api/ingest/commit`
- **Body**: `{ importId: string, confirmed: true }`
- **Respuesta**: Confirmación de inserción en base de datos.
