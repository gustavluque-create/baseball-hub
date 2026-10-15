-- ==============================================================================
-- Baseball Hub — Migración Fase 2.5A (Revisión & Hardening RLS Reforzado)
-- Archivo: 20261013000000_baseball_hub_rls_hardening_v2.sql
-- 
-- Resumen de correcciones aplicadas en esta migración complementaria:
-- 1. Trigger de usuarios (prevent_user_self_role_escalation):
--    - Elimina la dependencia insegura de "current_user = 'service_role'".
--    - Emplea un mecanismo robusto y seguro de detección de contexto de ejecución:
--      Verifica (auth.role() = 'service_role' OR auth.jwt()->>'role' = 'service_role' 
--      OR nullif(current_setting('app.is_server_managed', true), '') = 'true').
--    - Si no es contexto de servidor autorizado ni 'superadmin' verificado por get_auth_user_role(),
--      bloquea categóricamente la modificación de 'role', 'id', 'uid' y 'email'.
--
-- 2. Trigger de comentarios (prevent_comment_tampering):
--    - Reorganización estricta: Se valida primero que 'id', 'user_id' y 'article_slug'
--      sean inmutables para TODOS (incluidos moderadores y administradores).
--    - Nadie puede transferir la propiedad de un comentario ni reasignarlo a otro artículo.
--    - Los moderadores ('superadmin', 'editor', 'admin') pueden moderar el texto ('content'),
--      pero no pueden alterar likes directamente ni usurpar autoría.
--    - Los usuarios normales sólo pueden editar el 'content' de sus propios comentarios
--      (con validación de longitud 3..2000), sin tocar likes ni identificadores.
--
-- 3. Auditoría e invalidación de políticas RLS antiguas (PostgreSQL OR combination):
--    - DROP exhaustivo de todas las políticas permisivas previas de las tablas afectadas:
--      users, news_comments, games, game_lineups, game_events, players, player_photos,
--      player_season_batting, player_season_pitching, player_career_stats, standings,
--      competitions, seasons, teams, team_logos, news, app_settings, audit_logs, notifications.
--    - Restablecimiento limpio de políticas con principio de mínimo privilegio:
--      * Tablas deportivas: Lectura pública inalterada, mutación restringida a roles autorizados.
--      * Users: Lectura solo del propio perfil o superadmin/admin.
--      * News comments: Lectura pública, inserción con auth vinculada, actualización segura,
--        eliminación reservada a moderadores.
--
-- 4. Seguridad de funciones y vistas:
--    - public.get_auth_user_role(): SECURITY DEFINER, search_path = public, pg_temp,
--      REVOKE ALL FROM PUBLIC, GRANT EXECUTE TO authenticated, anon, service_role.
--    - public.public_user_profiles: Vista con security_barrier = true, campos restringidos
--      (id, uid, display_name, photo_url, created_at), REVOKE mutaciones, SELECT público.
--
-- 5. Idempotencia y seguridad:
--    - No destructivo: No borra datos, no desactiva RLS, utiliza CREATE OR REPLACE y DROP IF EXISTS.
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER AUTORITATIVO DE ROL
-- ==============================================================================
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

revoke all on function public.get_auth_user_role() from public;
grant execute on function public.get_auth_user_role() to authenticated, anon, service_role;

-- ==============================================================================
-- 2. HARDENING DE "public.users" & TRIGGER ANTI-ELEVACIÓN DE ROL
-- ==============================================================================
-- Limpieza exhaustiva de políticas anteriores para evitar combinación OR permisiva
drop policy if exists "Users read own profile" on public.users;
drop policy if exists "Users update own profile" on public.users;
drop policy if exists "Users read own profile strict" on public.users;
drop policy if exists "Users update own profile safe" on public.users;
drop policy if exists "users_select_own_strict" on public.users;
drop policy if exists "users_update_own_safe" on public.users;

-- Política de lectura: usuarios leen su propio perfil; superadmin/admin leen para administración
create policy "users_select_own_strict"
on public.users
for select
to authenticated
using (
  (auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text))
  or (public.get_auth_user_role() in ('superadmin', 'admin'))
);

-- Trigger seguro: no confía en current_user = 'service_role'
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_server_authorized boolean := false;
  v_auth_role text;
  v_current_user_role text;
begin
  -- 1. Detección segura de contexto de servidor de backend (service_role)
  -- En Supabase PostgREST, el JWT de service_role expone el rol de autenticación
  -- mediante auth.role() o en el claim 'role' del JWT.
  -- También se comprueba la configuración de sesión app.is_server_managed para llamadas RPC internas seguras.
  begin
    v_auth_role := coalesce(auth.role(), nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', ''));
  exception when others then
    v_auth_role := null;
  end;

  if v_auth_role = 'service_role' 
     or nullif(current_setting('app.is_server_managed', true), '') = 'true' then
    v_is_server_authorized := true;
  end if;

  -- 2. Si no es una operación del servidor autorizada con service_role, verificar el rol autoritativo
  if not v_is_server_authorized then
    v_current_user_role := public.get_auth_user_role();

    -- Únicamente superadmin autenticado puede alterar roles mediante flujo normal
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
      -- Incluso para un superadmin, los identificadores 'id' y 'uid' permanecen inmutables
      if new.uid is distinct from old.uid or new.id is distinct from old.id then
        raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prevent_user_self_role_escalation on public.users;
create trigger trg_prevent_user_self_role_escalation
before update on public.users
for each row
execute function public.prevent_user_self_role_escalation();

-- Política de actualización: el usuario sólo puede actualizar su propio registro
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

-- ==============================================================================
-- 3. VISTA PÚBLICA SEGURA "public.public_user_profiles"
-- ==============================================================================
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

revoke all on public.public_user_profiles from public;
grant select on public.public_user_profiles to anon, authenticated, service_role;

-- ==============================================================================
-- 4. HARDENING DE "public.news_comments" & TRIGGER ANTI-TAMPERING REORGANIZADO
-- ==============================================================================
-- Limpieza exhaustiva de políticas previas
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

-- Lectura de comentarios: pública para todos los usuarios y anónimos
create policy "news_comments_select_public"
on public.news_comments
for select
using (true);

-- Creación de comentarios: requiere usuario autenticado y validaciones de datos
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

-- Trigger anti-manipulación reorganizado:
-- 1. Inmutabilidad de id, user_id y article_slug verificada PRIMERO para todos (incluidos moderadores)
-- 2. Likes inmutables mediante UPDATE ordinario para todos (se modifican exclusivamente por el mecanismo autorizado del servidor)
-- 3. Moderadores pueden actualizar únicamente 'content' sin alterar autoría ni artículo
-- 4. Autores pueden actualizar únicamente 'content' de sus propios comentarios
create or replace function public.prevent_comment_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_server_authorized boolean := false;
  v_auth_role text;
  v_user_role text;
begin
  -- Detección segura de contexto de servidor autorizado
  begin
    v_auth_role := coalesce(auth.role(), nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', ''));
  exception when others then
    v_auth_role := null;
  end;

  if v_auth_role = 'service_role' 
     or nullif(current_setting('app.is_server_managed', true), '') = 'true' then
    v_is_server_authorized := true;
  end if;

  -- 1. Validaciones inmutables universales (aplican a clientes directos, moderadores y autores)
  if not v_is_server_authorized then
    -- Identificador del comentario estrictamente inmutable
    if new.id is distinct from old.id then
      raise exception 'Operación denegada: el identificador del comentario es inmutable.';
    end if;

    -- Propietario / Autor estrictamente inmutable (nadie puede transferir la autoría de un comentario)
    if new.user_id is distinct from old.user_id then
      raise exception 'Operación denegada: no está permitido cambiar la propiedad ni el autor del comentario.';
    end if;

    -- Artículo de vinculación estrictamente inmutable (no se permite transferir a otro artículo)
    if new.article_slug is distinct from old.article_slug then
      raise exception 'Operación denegada: no está permitido transferir el comentario a otro artículo.';
    end if;

    -- Likes: inmutables mediante actualizaciones directas de clientes
    -- Solo el mecanismo autorizado de la aplicación (servidor/RPC) puede actualizar contadores de likes
    if new.likes is distinct from old.likes then
      raise exception 'Operación denegada: no está permitido alterar los votos directamente.';
    end if;

    -- Validación de longitud de contenido
    if length(trim(new.content)) < 3 or length(new.content) > 2000 then
      raise exception 'El contenido del comentario debe contener entre 3 y 2000 caracteres.';
    end if;

    -- 2. Comprobación de roles de moderación vs autoría
    v_user_role := public.get_auth_user_role();
    if v_user_role in ('superadmin', 'editor', 'admin') then
      -- Moderador autorizado: puede modificar el contenido para moderar texto inapropiado
      return new;
    end if;

    -- 3. Para usuarios normales (no moderadores):
    -- Debe ser el autor legítimo del comentario
    if old.user_id is null or old.user_id <> auth.uid()::text then
      raise exception 'Operación denegada: no tiene permisos para editar este comentario.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_comment_tampering on public.news_comments;
create trigger trg_prevent_comment_tampering
before update on public.news_comments
for each row
execute function public.prevent_comment_tampering();

-- Actualización de comentarios: autor del comentario o moderadores autorizados
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

-- Eliminación de comentarios: moderadores autorizados exclusivamente
create policy "news_comments_delete_moderator"
on public.news_comments
for delete
to authenticated
using (
  public.get_auth_user_role() in ('superadmin', 'editor', 'admin')
);

-- ==============================================================================
-- 5. AUDITORÍA EXHAUSTIVA DE POLÍTICAS EN TODAS LAS TABLAS DEPORTIVAS Y CONTENIDO
-- ==============================================================================

drop policy if exists "Authorized staff insert games" on public.games;
drop policy if exists "Authorized staff update games" on public.games;
drop policy if exists "Authorized staff delete games" on public.games;
drop policy if exists "Public insert games" on public.games;
drop policy if exists "Public update games" on public.games;
drop policy if exists "Public delete games" on public.games;
drop policy if exists "Public manage games" on public.games;
drop policy if exists "games_insert_staff" on public.games;
drop policy if exists "games_update_staff" on public.games;
drop policy if exists "games_delete_staff" on public.games;

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

-- 5.2 GAME LINEUPS & GAME EVENTS
drop policy if exists "Authorized staff manage lineups" on public.game_lineups;
drop policy if exists "Public manage lineups" on public.game_lineups;
drop policy if exists "lineups_manage_staff" on public.game_lineups;

create policy "lineups_manage_staff"
on public.game_lineups
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage events" on public.game_events;
drop policy if exists "Public manage events" on public.game_events;
drop policy if exists "events_manage_staff" on public.game_events;

create policy "events_manage_staff"
on public.game_events
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 5.3 PLAYERS & PLAYER PHOTOS
drop policy if exists "Authorized staff manage players" on public.players;
drop policy if exists "Public manage players" on public.players;
drop policy if exists "players_manage_staff" on public.players;

create policy "players_manage_staff"
on public.players
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage player_photos" on public.player_photos;
drop policy if exists "Public manage player_photos" on public.player_photos;
drop policy if exists "player_photos_manage_staff" on public.player_photos;

create policy "player_photos_manage_staff"
on public.player_photos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'));

-- 5.4 PLAYER STATS (BATTING, PITCHING, CAREER)
drop policy if exists "Authorized staff manage batting stats" on public.player_season_batting;
drop policy if exists "Public manage batting stats" on public.player_season_batting;
drop policy if exists "batting_manage_staff" on public.player_season_batting;

create policy "batting_manage_staff"
on public.player_season_batting
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage pitching stats" on public.player_season_pitching;
drop policy if exists "Public manage pitching stats" on public.player_season_pitching;
drop policy if exists "pitching_manage_staff" on public.player_season_pitching;

create policy "pitching_manage_staff"
on public.player_season_pitching
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage career stats" on public.player_career_stats;
drop policy if exists "Public manage career stats" on public.player_career_stats;
drop policy if exists "career_stats_manage_staff" on public.player_career_stats;

create policy "career_stats_manage_staff"
on public.player_career_stats
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 5.5 STANDINGS, COMPETITIONS, SEASONS, TEAMS, TEAM LOGOS
drop policy if exists "Authorized staff manage standings" on public.standings;
drop policy if exists "Public manage standings" on public.standings;
drop policy if exists "standings_manage_staff" on public.standings;

create policy "standings_manage_staff"
on public.standings
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage competitions" on public.competitions;
drop policy if exists "Public manage competitions" on public.competitions;
drop policy if exists "competitions_manage_staff" on public.competitions;

create policy "competitions_manage_staff"
on public.competitions
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage seasons" on public.seasons;
drop policy if exists "Public manage seasons" on public.seasons;
drop policy if exists "seasons_manage_staff" on public.seasons;

create policy "seasons_manage_staff"
on public.seasons
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage teams" on public.teams;
drop policy if exists "Public manage teams" on public.teams;
drop policy if exists "teams_manage_staff" on public.teams;

create policy "teams_manage_staff"
on public.teams
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage team logos" on public.team_logos;
drop policy if exists "Public manage team logos" on public.team_logos;
drop policy if exists "team_logos_manage_staff" on public.team_logos;

create policy "team_logos_manage_staff"
on public.team_logos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));

-- 5.6 NEWS ARTICLES
drop policy if exists "Authorized editors manage news" on public.news;
drop policy if exists "Public manage news" on public.news;
drop policy if exists "news_manage_staff" on public.news;

create policy "news_manage_staff"
on public.news
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'))
with check (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'));

-- 5.7 AUDIT LOGS, NOTIFICATIONS & SETTINGS
drop policy if exists "Superadmin manage settings" on public.app_settings;
drop policy if exists "Public manage settings" on public.app_settings;
drop policy if exists "settings_manage_superadmin" on public.app_settings;

create policy "settings_manage_superadmin"
on public.app_settings
for all
to authenticated
using (public.get_auth_user_role() = 'superadmin')
with check (public.get_auth_user_role() = 'superadmin');

drop policy if exists "Superadmin read audit logs" on public.audit_logs;
drop policy if exists "Public read audit logs" on public.audit_logs;
drop policy if exists "audit_logs_read_superadmin" on public.audit_logs;

create policy "audit_logs_read_superadmin"
on public.audit_logs
for select
to authenticated
using (public.get_auth_user_role() = 'superadmin');

drop policy if exists "notifications_manage_staff" on public.notifications;
drop policy if exists "Public manage notifications" on public.notifications;

create policy "notifications_manage_staff"
on public.notifications
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));
