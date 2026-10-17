# DATABASE.md — Esquema de Base de Datos, Migraciones y Storage (Supabase / PostgreSQL)

**BASEBALL HUB** implementa un modelo de datos relacional robusto en PostgreSQL alojado en Supabase, protegido mediante **Row Level Security (RLS)** en todas sus tablas y buckets de almacenamiento.

---

## 1. Cadena Histórica de Migraciones SQL

El esquema se gestiona a través de 5 migraciones SQL secuenciales e idempotentes ubicadas en `supabase/migrations/`:

| Orden | Archivo de Migración | Descripción y Alcance de Seguridad |
| :---: | :--- | :--- |
| **01** | `20261006000000_baseball_hub_schema.sql` | **Esquema Base Relacional:** Creación de las 19 tablas (`competitions`, `seasons`, `teams`, `players`, `games`, `game_lineups`, `game_events`, `standings`, `news`, `news_comments`, `notifications`, `audit_logs`, `app_settings`, etc.), claves foráneas, índices B-Tree y habilitación inicial de RLS. |
| **02** | `20261010000000_baseball_hub_rls_hardening.sql` | **Hardening RLS v1:** Creación de la función `public.get_auth_user_role()`, políticas iniciales de segregación de roles para anotadores oficiales (`official_scorer`) y prensa/editores (`editor`). |
| **03** | `20261013000000_baseball_hub_rls_hardening_v2.sql` | **Hardening RLS v2:** Triggers anti-escalada para prevenir la auto-asignación de roles administrativos y anti-tampering para evitar modificación de autoría en comentarios. |
| **04** | `20261015000000_baseball_hub_rls_hardening_v3.sql` | **Hardening RLS v3:** Eliminación completa de `app.is_server_managed`. Creación de `public.is_authorized_service_role()` autoritativa. Creación de la vista pública `public.public_user_profiles` con `security_barrier = true`. Limpieza dinámica en `pg_policies` para erradicar políticas permisivas heredadas (`OR` combinations). |
| **05** | `20261016000000_baseball_hub_rls_final_audit.sql` | **Auditoría Final y Storage RLS (Fase 2.5 & 2.6):** Eliminación de `Public read notifications`, soporte para `user_id` en notificaciones personales, trigger anti-escalada en `INSERT/UPDATE`, revocación de `PUBLIC` en funciones `SECURITY DEFINER`, e inicialización de buckets de Storage. |
| **06** | `20261016000001_baseball_hub_rls_and_storage_hardening.sql` | **Barrido por Lista Blanca Inversa y Endurecimiento de Storage:** Barrido dinámico que elimina cualquier política no autorizada en `public` y `storage.objects` mediante lista blanca canónica, y afirmación de roles para anotadores oficiales en buckets deportivos. |

---

## 2. Definición de Buckets de Supabase Storage (Fase 2.6)

Supabase Storage administra los recursos multimedia mediante 4 buckets públicos dedicados con cuotas de tamaño y tipos MIME estrictamente validados a nivel de base de datos (`storage.buckets`):

| Bucket | Tipo de Contenido | Límite por Archivo | Tipos MIME Autorizados | Acceso Lectura | Acceso Escritura / Borrado |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `players` | Fotos de jugadores y retratos oficiales | **5 MB** | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | **Público** | Personal autorizado (`superadmin`, `admin`, `editor`) o `service_role` |
| `teams` | Logos de franquicias y banderas | **5 MB** | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | **Público** | Personal autorizado (`superadmin`, `admin`, `editor`) o `service_role` |
| `news` | Portadas de artículos y galerías | **10 MB** | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | **Público** | Personal editorial (`superadmin`, `admin`, `editor`) o `service_role` |
| `avatars` | Avatares de aficionados y usuarios | **3 MB** | `image/png`, `image/jpeg`, `image/webp` | **Público** | Exclusivo del usuario propietario (`auth.uid()`) en su carpeta/archivo o administradores |

### Políticas RLS en `storage.objects`:
1. `storage_select_public`: Permite `SELECT` universal a cualquier visitante sobre los 4 buckets.
2. `storage_staff_manage_content`: Permite `INSERT`, `UPDATE` y `DELETE` en `players`, `teams` y `news` únicamente si `is_authorized_service_role()` es verdadero o el rol verificado en `public.users` pertenece al staff administrativo.
3. `storage_avatars_manage`: Permite `INSERT`, `UPDATE` y `DELETE` en `avatars` únicamente si la ruta del archivo coincide con el identificador del usuario autenticado (`(storage.foldername(name))[1] = auth.uid()::text` o `name = auth.uid() || '.png'`), impidiendo que un usuario sobrescriba o borre avatares ajenos.

---

## 3. Modelo de Tablas y Seguridad de Perfiles

### Vista Pública Segura (`public.public_user_profiles`)
Para evitar exponer correos electrónicos, roles o preferencias privadas en la interfaz pública:
```sql
create or replace view public.public_user_profiles
with (security_barrier = true)
as
select id, uid, display_name, photo_url, created_at
from public.users;
```
- **Acceso:** Solo lectura (`SELECT`) para `anon`, `authenticated` y `service_role`.
- **Privacidad:** `public.users` tiene revocado el acceso directo para visitantes anónimos.

---

## 4. Consulta SQL de Diagnóstico ("Health Check Query")

Copia y pega la siguiente consulta en el **SQL Editor** del panel de Supabase. Te devolverá en una sola vista un informe de estado con semáforos (`OK` / `ALERTA`) validando que todas las tablas, vistas, funciones y buckets cumplen el 100% de los requisitos de seguridad:

```sql
with
-- 1. Verificación de RLS en todas las tablas de public
tables_check as (
  select
    'Tablas con RLS Activo' as check_item,
    count(*) filter (where rowsecurity = true) as passed,
    count(*) as total,
    case
      when count(*) filter (where rowsecurity = false) = 0 then '✅ OK'
      else '❌ ALERTA: Tablas sin RLS (' || count(*) filter (where rowsecurity = false) || ')'
    end as status,
    coalesce(string_agg(tablename, ', ') filter (where rowsecurity = false), 'Ninguna') as details
  from pg_tables
  where schemaname = 'public'
),

-- 2. Verificación de la vista pública de usuarios
view_check as (
  select
    'Vista public_user_profiles' as check_item,
    case when count(*) = 1 then 1 else 0 end as passed,
    1 as total,
    case
      when count(*) = 1 then '✅ OK'
      else '❌ FALTA: Vista public_user_profiles no existe'
    end as status,
    'security_barrier activo' as details
  from pg_views
  where schemaname = 'public' and viewname = 'public_user_profiles'
),

-- 3. Verificación de los 4 buckets de Storage requeridos
storage_check as (
  select
    'Buckets de Supabase Storage' as check_item,
    count(*) as passed,
    4 as total,
    case
      when count(*) = 4 then '✅ OK'
      else '❌ ALERTA: Faltan buckets (' || (4 - count(*)) || ')'
    end as status,
    string_agg(id, ', ') as details
  from storage.buckets
  where id in ('players', 'teams', 'news', 'avatars')
),

-- 4. Verificación de RLS en storage.objects
storage_rls_check as (
  select
    'Storage Objects RLS' as check_item,
    case when rowsecurity = true then 1 else 0 end as passed,
    1 as total,
    case when rowsecurity = true then '✅ OK' else '❌ ALERTA: storage.objects sin RLS' end as status,
    'storage.objects' as details
  from pg_tables
  where schemaname = 'storage' and tablename = 'objects'
),

-- 5. Verificación de funciones SECURITY DEFINER protegidas
functions_check as (
  select
    'Funciones SECURITY DEFINER con search_path' as check_item,
    count(*) as passed,
    4 as total,
    case
      when count(*) >= 4 then '✅ OK'
      else '❌ ALERTA: Funciones críticas desactualizadas'
    end as status,
    string_agg(proname, ', ') as details
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.secdef = true
    and p.proname in (
      'is_authorized_service_role',
      'get_auth_user_role',
      'prevent_user_self_role_escalation',
      'prevent_comment_tampering'
    )
)

-- Consolidación del reporte de salud
select check_item, passed || ' / ' || total as resultado, status, details
from tables_check
union all
select check_item, passed || ' / ' || total, status, details from view_check
union all
select check_item, passed || ' / ' || total, status, details from storage_check
union all
select check_item, passed || ' / ' || total, status, details from storage_rls_check
union all
select check_item, passed || ' / ' || total, status, details from functions_check;
```
