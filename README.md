# BASEBALL HUB ⚾

Plataforma profesional de información, marcadores en vivo, estadísticas avanzadas, líderes y gestión de datos de béisbol.

Inspirada en las mejores experiencias de usuario de plataformas deportivas mundiales, con arquitectura modular por capas y soporte nativo para múltiples competiciones comenzando con el béisbol cubano (Serie Nacional de Béisbol y Liga Élite) y preparada para MLB, NPB, Serie del Caribe y Clásico Mundial.

---

## 🌟 Características Principales

- **Selector Global de Competición y Temporada**: Navegación fluida entre diferentes ligas y temporadas históricas.
- **Centro de Partidos y Marcadores en Vivo**:
  - Ticker de marcadores del día en tiempo real.
  - Box Score interactivo profesional (Bateo, Pitcheo, Decisiones).
  - Line Score entrada por entrada con Hits, Carreras y Errores (R, H, E).
  - Play-by-play cronológico de cada turno al bate y evento.
- **Perfiles Completos de Equipos**:
  - Récord actual, estadio, colores distintivos, manager, alineaciones y plantilla completa por posiciones.
- **Perfiles Individuales de Jugadores**:
  - Ficha biográfica (lado de bateo, brazo de lanzar, peso, talla, dorsal).
  - Estadísticas tradicionales y sabermétricas.
  - Gráficos interactivos de evolución y tendencia (AVG, OPS, ERA, WHIP) con Recharts.
- **Tablas de Posiciones**:
  - Filtros por división / conferencia, cálculo automático de AVG/PCT y Juegos de Diferencia (DIF / GB), rachas y récord local/visitante.
- **Sistema Flexible de Estadísticas**:
  - Bateo, Pitcheo, Defensa y Métricas Avanzadas (WAR, wOBA, FIP, BABIP, ISO, OPS+).
  - Ordenación multi-columna, búsqueda por nombre o equipo, y exportación a CSV.
- **Líderes de la Liga**:
  - Filtro Top 5, Top 10 y Top 20 en AVG, Jonrones, Impulsadas, OPS, Efectividad (ERA), WHIP, Ponches y Salvados.
- **Buscador Global Inteligente**:
  - Acceso instantáneo por atajo de teclado (`/` o `Cmd+K`), con resultados agrupados por Jugadores, Equipos y Competiciones.
- **Capa de Ingestión de Datos (Data Ingestion)**:
  - Validador y normalizador de archivos CSV y JSON con previsualización, conteo de registros válidos, avisos y errores antes de persistir.
- **Panel Administrativo (`/admin`)**:
  - Supervisión de métricas del sistema, gestión manual de entidades y panel de importación.
- **Diseño Responsive y Accesible**:
  - Modo Oscuro / Claro refinado, navegación inferior fija para móviles y drawer de acceso rápido.
  - Soporte multiidioma (Español e Inglés).

---

## 🏗️ Documentación Técnica

- [ARCHITECTURE.md](ARCHITECTURE.md): Arquitectura en capas, principios de modularidad y pipeline de datos.
- [DATABASE.md](DATABASE.md): Esquema completo DDL para PostgreSQL / Supabase, claves foráneas e índices.
- [API.md](API.md): Especificación exhaustiva de endpoints RESTful.
- [DEPLOYMENT.md](DEPLOYMENT.md): Guía de despliegue para Cloud Run, Vercel, Railway y Supabase.

---

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Compilar para producción
npm run build
npm start
```
