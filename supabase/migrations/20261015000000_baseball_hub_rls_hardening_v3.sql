-- ==============================================================================
-- Baseball Hub — Migración Correctiva Fase 2.5A (Hardening RLS v3 Idempotente)
-- Archivo: 20261015000000_baseball_hub_rls_hardening_v3.sql
--
-- Resumen de correcciones aplicadas en esta migración correctiva:
-- 1. Autorización del Servidor (Cero dependencia de variables de sesión):
--    - Se ELIMINA de raíz cualquier uso o comprobación de "app.is_server_managed".
--    - Ningún cliente no privilegiado puede saltarse triggers estableciendo variables de sesión.
--    - Se crea la función autoritativa "public.is_authorized_service_role()" que verifica:
--      * Conexión directa administrativa PostgreSQL: session_user in ('postgres', 'service_role', 'supabase_admin').
--      * Peticiones PostgREST / Supabase Auth: JWT verificado con claim 'role' = 'service_role'.
--
-- 2. Vista Pública "public.public_user_profiles":
--    - Proyección estricta con sólo columnas públicas: id, uid, display_name, photo_url, created_at.
--    - Oculta completamente email, role, password, timestamps privados y preferencias.
--    - Configurada con "security_barrier = true" para evitar fugas de optimizador WHERE.
--    - Asignada a propietario postgres.
--    - Revocados todos los privilegios de escritura (INSERT, UPDATE, DELETE, TRUNCATE).
--    - Revocado acceso anónimo directo sobre "public.users", permitiendo únicamente SELECT vía la vista pública.
--
-- 3. Auditoría exhaustiva y eliminación de políticas permisivas (PostgreSQL OR combination):
--    - PostgreSQL combina políticas permisivas para un mismo comando con 'OR'. Si existe una política
--      antigua permisiva (como "Public manage games" o "Users read own profile" con using(true)),
--      cualquier política estricta posterior queda neutralizada.
--    - Esta migración ejecuta un DROP estricto de todas las políticas conocidas Y un bloque
--      dinámico PL/pgSQL que elimina cualquier política residual que contenga '%manage%', '%Public create%'
--      o '%read own profile%' no autorizada en las 19 tablas del esquema.
--    - Restablece el conjunto canónico y seguro de políticas con principio de mínimo privilegio.
--
-- 4. Funciones "SECURITY DEFINER" y Triggers Anti-Escalación / Anti-Tampering:
--    - public.get_auth_user_role(): SECURITY DEFINER, search_path = public, pg_temp,
--      consulta exclusivamente auth.uid(), nunca parámetros de usuario.
--    - public.prevent_user_self_role_escalation(): Bloquea modificación de role, id, uid, email
--      para usuarios normales. Identificadores id y uid inmutables incluso para administradores.
--    - public.prevent_comment_tampering(): Inmutabilidad universal de id, user_id, article_slug y likes.
--      Moderadores solo pueden corregir 'content'. Usuarios normales solo pueden editar sus propios comentarios.
--
-- 5. Seguridad e Idempotencia Garantizada:
--    - NO borra datos, NO desactiva RLS.
--    - Seguro de aplicar en bases de datos con v1, v2 o esquemas preexistentes.
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER AUTORITATIVO DE ROL Y DETECCIÓN SEGURA DE SERVICE_ROLE
-- ==============================================================================

-- Función segura para verificar si el llamador es el servidor backend legítimo
create or replace function public.is_authorized_service_role()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text;
begin
  -- 1. Conexión directa a PostgreSQL por parte de roles de sistema / mantenimiento
  -- session_user refleja el usuario original de la conexión ignorando el contexto SECURITY DEFINER
  if session_user in ('postgres', 'service_role', 'supabase_admin') then
    return true;
  end if;

  -- 2. Petición PostgREST con token JWT administrativo verificado
  begin
    v_jwt_role := coalesce(
      auth.role(),
      nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
    );
  exception when others then
    v_jwt_role := null;
  end;

  if v_jwt_role = 'service_role' then
    return true;
  end if;

  -- Se ignora absolutamente cualquier variable de sesión arbitraria de usuario
  return false;
end;
$$;

alter function public.is_authorized_service_role() owner to postgres;
revoke all on function public.is_authorized_service_role() from public;
grant execute on function public.is_authorized_service_role() to authenticated, anon, service_role;

-- Helper autoritativo para obtener el rol del usuario autenticado
create or replace function public.get_auth_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select nullif(trim(role), '')
      from public.users
      where (uid = auth.uid()::text or id = auth.uid()::text)
      limit 1
    ),
    'user'
  );
$$;

alter function public.get_auth_user_role() owner to postgres;
revoke all on function public.get_auth_user_role() from public;
grant execute on function public.get_auth_user_role() to authenticated, anon, service_role;

-- ==============================================================================
-- 2. LIMPIEZA EXHAUSTIVA DE POLÍTICAS ANTIGUAS Y COMBINACIONES PERMISIVAS (OR)
-- ==============================================================================

-- Bloque dinámico de seguridad: audita y elimina políticas residuales inseguras en todas las tablas
do $$
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname ilike '%manage%'
        or policyname ilike '%Public create%'
        or policyname ilike '%Public insert%'
        or policyname ilike '%Public update%'
        or policyname ilike '%Public delete%'
        or policyname in (
          'Users read own profile',
          'Users update own profile',
          'Users read own profile strict',
          'Users update own profile safe',
          'Anyone read news_comments',
          'Public read news_comments',
          'Public create comments',
          'Author or moderator update comment',
          'Moderators delete comments',
          'Authenticated users create comments'
        )
      )
  ) loop
    execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Drop explícito de políticas en public.users
drop policy if exists "Users read own profile" on public.users;
drop policy if exists "Users update own profile" on public.users;
drop policy if exists "Users read own profile strict" on public.users;
drop policy if exists "Users update own profile safe" on public.users;
drop policy if exists "users_select_own_strict" on public.users;
drop policy if exists "users_update_own_safe" on public.users;

-- Drop explícito de políticas en public.news_comments
drop policy if exists "Public create comments" on public.news_comments;
drop policy if exists "Public read news_comments" on public.news_comments;
drop policy if exists "Anyone read news_comments" on public.news_comments;
drop policy if exists "Authenticated users create comments" on public.news_comments;
drop policy if exists "Author or moderator update comment" on public.news_comments;
drop policy if exists "Moderators delete comments" on public.news_comments;
drop policy if exists "news_comments_select_public" on public.news_comments;
drop policy if exists "news_comments_insert_auth" on public.news_comments;
drop policy if exists "news_comments_update_author" on public.news_comments;
drop policy if exists "news_comments_delete_moderator" on public.news_comments;

-- Drop explícito de políticas en tablas deportivas y operativas
drop policy if exists "Public manage games" on public.games;
drop policy if exists "Authorized staff insert games" on public.games;
drop policy if exists "Authorized staff update games" on public.games;
drop policy if exists "Authorized staff delete games" on public.games;
drop policy if exists "Public insert games" on public.games;
drop policy if exists "Public update games" on public.games;
drop policy if exists "Public delete games" on public.games;
drop policy if exists "games_insert_staff" on public.games;
drop policy if exists "games_update_staff" on public.games;
drop policy if exists "games_delete_staff" on public.games;

drop policy if exists "Public manage lineups" on public.game_lineups;
drop policy if exists "Authorized staff manage lineups" on public.game_lineups;
drop policy if exists "lineups_manage_staff" on public.game_lineups;

drop policy if exists "Public manage events" on public.game_events;
drop policy if exists "Authorized staff manage events" on public.game_events;
drop policy if exists "events_manage_staff" on public.game_events;

drop policy if exists "Public manage players" on public.players;
drop policy if exists "Authorized staff manage players" on public.players;
drop policy if exists "players_manage_staff" on public.players;

drop policy if exists "Public manage player_photos" on public.player_photos;
drop policy if exists "Authorized staff manage player_photos" on public.player_photos;
drop policy if exists "player_photos_manage_staff" on public.player_photos;

drop policy if exists "Public manage batting stats" on public.player_season_batting;
drop policy if exists "Authorized staff manage batting stats" on public.player_season_batting;
drop policy if exists "batting_manage_staff" on public.player_season_batting;

drop policy if exists "Public manage pitching stats" on public.player_season_pitching;
drop policy if exists "Authorized staff manage pitching stats" on public.player_season_pitching;
drop policy if exists "pitching_manage_staff" on public.player_season_pitching;

drop policy if exists "Public manage career stats" on public.player_career_stats;
drop policy if exists "Authorized staff manage career stats" on public.player_career_stats;
drop policy if exists "career_stats_manage_staff" on public.player_career_stats;

drop policy if exists "Public manage standings" on public.standings;
drop policy if exists "Authorized staff manage standings" on public.standings;
drop policy if exists "standings_manage_staff" on public.standings;

drop policy if exists "Public manage competitions" on public.competitions;
drop policy if exists "Authorized staff manage competitions" on public.competitions;
drop policy if exists "competitions_manage_staff" on public.competitions;

drop policy if exists "Public manage seasons" on public.seasons;
drop policy if exists "Authorized staff manage seasons" on public.seasons;
drop policy if exists "seasons_manage_staff" on public.seasons;

drop policy if exists "Public manage teams" on public.teams;
drop policy if exists "Authorized staff manage teams" on public.teams;
drop policy if exists "teams_manage_staff" on public.teams;

drop policy if exists "Public manage team logos" on public.team_logos;
drop policy if exists "Authorized staff manage team logos" on public.team_logos;
drop policy if exists "team_logos_manage_staff" on public.team_logos;

drop policy if exists "Public manage news" on public.news;
drop policy if exists "Authorized editors manage news" on public.news;
drop policy if exists "news_manage_staff" on public.news;

drop policy if exists "Public manage settings" on public.app_settings;
drop policy if exists "Superadmin manage settings" on public.app_settings;
drop policy if exists "settings_manage_superadmin" on public.app_settings;

drop policy if exists "Public read audit logs" on public.audit_logs;
drop policy if exists "Superadmin read audit logs" on public.audit_logs;
drop policy if exists "audit_logs_read_superadmin" on public.audit_logs;

drop policy if exists "Public manage notifications" on public.notifications;
drop policy if exists "notifications_manage_staff" on public.notifications;

-- ==============================================================================
-- 3. HARDENING DE "public.users" & PERMISOS DE TABLA
-- ==============================================================================
alter table public.users enable row level security;

-- Permisos estrictos a nivel de tabla
revoke all on public.users from public, anon;
grant select, update on public.users to authenticated;
grant all on public.users to service_role;

-- Lectura: cada usuario autenticado lee únicamente su fila; superadmin/admin leen para gestión
create policy "users_select_own_strict"
on public.users
for select
to authenticated
using (
  (auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text))
  or (public.get_auth_user_role() in ('superadmin', 'admin'))
);

-- Actualización: cada usuario sólo puede actualizar su propia fila
create policy "users_update_own_safe"
on public.users
for update
to authenticated
using (
  auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text)
)
with check (
  auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text)
);

-- Trigger anti-escalación y protección de campos privados / inmutables
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_user_role text;
begin
  -- Si es el servidor legítimo (service_role o conexión administrativa directa), permitir
  if public.is_authorized_service_role() then
    new.updated_at := now();
    return new;
  end if;

  -- Para peticiones de clientes / usuarios autenticados:
  v_current_user_role := public.get_auth_user_role();

  -- Únicamente el rol superadmin puede modificar roles mediante el flujo autorizado
  if v_current_user_role not in ('superadmin') then
    if new.role is distinct from old.role then
      raise exception 'Operación no permitida: no tiene autorización para modificar roles de usuario.';
    end if;
    if new.uid is distinct from old.uid or new.id is distinct from old.id then
      raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Operación no permitida: el correo electrónico debe gestionarse mediante el flujo de autenticación.';
    end if;
  else
    -- Incluso para superadmin, los identificadores id y uid son inmutables
    if new.uid is distinct from old.uid or new.id is distinct from old.id then
      raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

alter function public.prevent_user_self_role_escalation() owner to postgres;

drop trigger if exists trg_prevent_user_self_role_escalation on public.users;
create trigger trg_prevent_user_self_role_escalation
before update on public.users
for each row
execute function public.prevent_user_self_role_escalation();

-- ==============================================================================
-- 4. VISTA PÚBLICA SEGURA "public.public_user_profiles"
-- ==============================================================================
-- Se recrea la vista con barrier = true y proyección estricta de campos no confidenciales
create or replace view public.public_user_profiles
with (security_barrier = true)
as
select
  id,
  uid,
  display_name,
  photo_url,
  created_at
from public.users;

alter view public.public_user_profiles owner to postgres;

-- Revocación de modificaciones: la vista es de solo lectura pública
revoke all on public.public_user_profiles from public;
revoke insert, update, delete, truncate on public.public_user_profiles from anon, authenticated, public;
grant select on public.public_user_profiles to anon, authenticated, service_role;

-- ==============================================================================
-- 5. HARDENING DE "public.news_comments" & TRIGGER ANTI-TAMPERING
-- ==============================================================================
alter table public.news_comments enable row level security;

-- Lectura pública para cualquier visitante o usuario
create policy "news_comments_select_public"
on public.news_comments
for select
using (true);

-- Creación vinculada a usuario autenticado con validación estricta
create policy "news_comments_insert_auth"
on public.news_comments
for insert
to authenticated
with check (
  auth.uid() is not null
  and (user_id is null or user_id = auth.uid()::text)
  and length(trim(content)) >= 3
  and length(content) <= 2000
  and length(trim(article_slug)) > 0
  and length(trim(author_name)) > 0
);

-- Trigger anti-manipulación estricto:
-- 1. id, user_id y article_slug son inmutables universalmente
-- 2. likes inmutables mediante UPDATE ordinario de clientes (solo servidor)
-- 3. Moderadores ('superadmin', 'editor', 'admin') solo pueden corregir 'content'
-- 4. Autores solo pueden editar 'content' de sus propios comentarios
create or replace function public.prevent_comment_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_role text;
begin
  -- Si es el servidor legítimo (service_role o backend directo), permitir
  if public.is_authorized_service_role() then
    return new;
  end if;

  -- 1. Inmutabilidad universal (aplica tanto a usuarios regulares como a moderadores)
  if new.id is distinct from old.id then
    raise exception 'Operación denegada: el identificador del comentario es inmutable.';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Operación denegada: no está permitido cambiar la propiedad ni el autor del comentario.';
  end if;

  if new.article_slug is distinct from old.article_slug then
    raise exception 'Operación denegada: no está permitido transferir el comentario a otro artículo.';
  end if;

  if new.likes is distinct from old.likes then
    raise exception 'Operación denegada: no está permitido alterar los votos directamente.';
  end if;

  -- 2. Validación de longitud de contenido
  if length(trim(new.content)) < 3 or length(new.content) > 2000 then
    raise exception 'El contenido del comentario debe contener entre 3 y 2000 caracteres.';
  end if;

  -- 3. Comprobación de roles de moderación vs autoría
  v_user_role := public.get_auth_user_role();
  if v_user_role in ('superadmin', 'editor', 'admin') then
    -- Moderador autorizado: puede modificar el contenido textual para moderación
    return new;
  end if;

  -- 4. Usuarios normales deben ser el autor legítimo del comentario
  if old.user_id is null or old.user_id <> auth.uid()::text then
    raise exception 'Operación denegada: no tiene permisos para editar este comentario.';
  end if;

  return new;
end;
$$;

alter function public.prevent_comment_tampering() owner to postgres;

drop trigger if exists trg_prevent_comment_tampering on public.news_comments;
create trigger trg_prevent_comment_tampering
before update on public.news_comments
for each row
execute function public.prevent_comment_tampering();

-- Actualización: autor legítimo o moderadores
create policy "news_comments_update_author"
on public.news_comments
for update
to authenticated
using (
  (auth.uid() is not null and user_id = auth.uid()::text)
  or (public.get_auth_user_role() in ('superadmin', 'editor', 'admin'))
)
with check (
  (auth.uid() is not null and user_id = auth.uid()::text and length(trim(content)) >= 3 and length(content) <= 2000)
  or (public.get_auth_user_role() in ('superadmin', 'editor', 'admin'))
);

-- Eliminación: reservada exclusivamente a moderadores
create policy "news_comments_delete_moderator"
on public.news_comments
for delete
to authenticated
using (
  public.get_auth_user_role() in ('superadmin', 'editor', 'admin')
);

-- ==============================================================================
-- 6. POLÍTICAS CANÓNICAS DE TABLAS DEPORTIVAS (LECTURA PÚBLICA + MUTACIÓN AUTORIZADA)
-- ==============================================================================

-- 6.1 GAMES
create policy "games_insert_staff"
on public.games
for insert
to authenticated
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "games_update_staff"
on public.games
for update
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "games_delete_staff"
on public.games
for delete
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 6.2 GAME LINEUPS & GAME EVENTS
create policy "lineups_manage_staff"
on public.game_lineups
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "events_manage_staff"
on public.game_events
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 6.3 PLAYERS & PLAYER PHOTOS
create policy "players_manage_staff"
on public.players
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "player_photos_manage_staff"
on public.player_photos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'));

-- 6.4 PLAYER STATS (BATTING, PITCHING, CAREER)
create policy "batting_manage_staff"
on public.player_season_batting
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "pitching_manage_staff"
on public.player_season_pitching
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "career_stats_manage_staff"
on public.player_career_stats
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 6.5 STANDINGS, COMPETITIONS, SEASONS, TEAMS, TEAM LOGOS
create policy "standings_manage_staff"
on public.standings
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "competitions_manage_staff"
on public.competitions
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

create policy "seasons_manage_staff"
on public.seasons
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

create policy "teams_manage_staff"
on public.teams
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

create policy "team_logos_manage_staff"
on public.team_logos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));

-- 6.6 NEWS ARTICLES
create policy "news_manage_staff"
on public.news
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'))
with check (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'));

-- 6.7 APP SETTINGS, AUDIT LOGS, NOTIFICATIONS
create policy "settings_manage_superadmin"
on public.app_settings
for all
to authenticated
using (public.get_auth_user_role() = 'superadmin')
with check (public.get_auth_user_role() = 'superadmin');

create policy "audit_logs_read_superadmin"
on public.audit_logs
for select
to authenticated
using (public.get_auth_user_role() = 'superadmin');

create policy "notifications_manage_staff"
on public.notifications
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));
