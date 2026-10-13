-- ==============================================================================
-- Baseball Hub — Migración Fase 2.5A: Hardening de Políticas RLS y Seguridad
-- Archivo: 20261010000000_baseball_hub_rls_hardening.sql
-- 
-- Objetivos y Verificaciones:
-- 1. Helper autoritativo "public.get_auth_user_role()":
--    - Sin parámetros (evita consultar roles de terceros).
--    - SECURITY DEFINER con search_path explícito (search_path = public, pg_temp).
--    - Permisos de ejecución controlados (REVOKE de public, GRANT a roles requeridos).
--    - Fallo seguro estricto: retorna 'user' ante cualquier fallo o usuario no autenticado.
-- 2. Vista pública segura "public.public_user_profiles":
--    - Proyecta EXCLUSIVAMENTE campos no sensibles (id, uid, display_name, photo_url, created_at).
--    - Omite email, role, preferences, hashes y metadatos privados.
--    - security_barrier = true y revocación de escrituras para evitar bypass.
-- 3. Políticas de "public.news_comments":
--    - Creación validada (auth.uid() requerido, longitud 3..2000, autor y slug presentes).
--    - Edición (UPDATE): permitida al autor de sus propios comentarios o a moderadores (superadmin, editor, admin).
--    - Trigger anti-tampering: previene cambiar autor (user_id), artículo, id o me gusta.
--    - Eliminación (DELETE): reservada estrictamente a moderadores y administradores.
-- 4. Auditoría de combinación OR en políticas PostgreSQL:
--    - Se eliminan explícitamente todas las políticas permisivas previas en todas las tablas afectadas
--      para asegurar que no existan políticas residuales que abran accesos indeseados.
-- 5. Tablas deportivas (competitions, seasons, teams, players, games, stats, standings, news):
--    - Lectura pública preservada para clientes y aficionados.
--    - Mutaciones (INSERT, UPDATE, DELETE) estrictamente reservadas para roles administrativos
--      autorizados ('superadmin', 'official_scorer', 'admin', 'editor') o service_role.
-- 6. Aplicación 100% segura e idempotente (DROP IF EXISTS, CREATE OR REPLACE).
-- ==============================================================================

-- ==============================================================================
-- 1. FUNCIÓN HELPER SEGURA PARA OBTENCIÓN DE ROL AUTORITATIVO
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

-- Control estricto de permisos de ejecución
revoke all on function public.get_auth_user_role() from public;
grant execute on function public.get_auth_user_role() to authenticated, anon, service_role;

-- ==============================================================================
-- 2. HARDENING DE "public.users"
-- ==============================================================================
-- Eliminar cualquier política previa (para evitar combinación permisiva OR)
drop policy if exists "Users read own profile" on public.users;
drop policy if exists "Users update own profile" on public.users;
drop policy if exists "Users read own profile strict" on public.users;
drop policy if exists "Users update own profile safe" on public.users;
drop policy if exists "users_select_own_strict" on public.users;
drop policy if exists "users_update_own_safe" on public.users;

-- Política de lectura: los usuarios autenticados SOLO pueden leer su propio perfil.
-- Superadmins o administradores pueden leer perfiles para soporte y gestión.
create policy "users_select_own_strict"
on public.users
for select
to authenticated
using (
  (auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text))
  or (public.get_auth_user_role() in ('superadmin', 'admin'))
);

-- Trigger para impedir elevación de privilegios en UPDATE de public.users
-- Un usuario nunca puede modificar su propio campo 'role' ni 'uid'/'id'/'email'
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Si la modificación proviene de un usuario normal (no service_role ni superadmin)
  if current_user <> 'service_role' and public.get_auth_user_role() not in ('superadmin') then
    if new.role is distinct from old.role then
      raise exception 'Operación no permitida: no tiene autorización para modificar roles de usuario.';
    end if;
    if new.uid is distinct from old.uid or new.id is distinct from old.id then
      raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Operación no permitida: el correo electrónico debe gestionarse mediante el flujo de autenticación.';
    end if;
  end if;
  new.updated_at = now();
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

-- Permisos estrictos en la vista (exclusivamente SELECT público, cero mutaciones)
revoke all on public.public_user_profiles from public;
grant select on public.public_user_profiles to anon, authenticated, service_role;

-- ==============================================================================
-- 4. HARDENING DE "public.news_comments"
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

-- Lectura de comentarios: pública para todos
create policy "news_comments_select_public"
on public.news_comments
for select
using (true);

-- Creación de comentarios: requiere usuario autenticado y límites de contenido
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

-- Trigger anti-manipulación para edición de comentarios
create or replace function public.prevent_comment_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Moderadores / Admins pueden actualizar el contenido de comentarios
  if current_user = 'service_role' or public.get_auth_user_role() in ('superadmin', 'editor', 'admin') then
    return new;
  end if;

  -- Para usuarios normales (autor del comentario):
  -- 1. Debe ser el autor del comentario
  if old.user_id is null or old.user_id <> auth.uid()::text then
    raise exception 'Operación denegada: no tiene permisos para editar este comentario.';
  end if;

  -- 2. No permitir cambiar la identidad del autor ni el artículo ni los likes
  if new.user_id is distinct from old.user_id then
    raise exception 'Operación denegada: no está permitido cambiar el autor del comentario.';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Operación denegada: el identificador del comentario es inmutable.';
  end if;
  if new.article_slug is distinct from old.article_slug then
    raise exception 'Operación denegada: no está permitido transferir el comentario a otro artículo.';
  end if;
  if new.likes is distinct from old.likes then
    raise exception 'Operación denegada: no está permitido alterar los votos directamente.';
  end if;
  if length(trim(new.content)) < 3 or length(new.content) > 2000 then
    raise exception 'El contenido del comentario debe contener entre 3 y 2000 caracteres.';
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
-- 5. HARDENING DE TABLAS DEPORTIVAS Y CONTENIDO (ANTI-TAMPERING)
-- ==============================================================================

-- 5.1 GAMES
drop policy if exists "Authorized staff insert games" on public.games;
drop policy if exists "Authorized staff update games" on public.games;
drop policy if exists "Authorized staff delete games" on public.games;
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
drop policy if exists "lineups_manage_staff" on public.game_lineups;
create policy "lineups_manage_staff"
on public.game_lineups
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage events" on public.game_events;
drop policy if exists "events_manage_staff" on public.game_events;
create policy "events_manage_staff"
on public.game_events
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 5.3 PLAYERS & PLAYER PHOTOS
drop policy if exists "Authorized staff manage players" on public.players;
drop policy if exists "players_manage_staff" on public.players;
create policy "players_manage_staff"
on public.players
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage player_photos" on public.player_photos;
drop policy if exists "player_photos_manage_staff" on public.player_photos;
create policy "player_photos_manage_staff"
on public.player_photos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'));

-- 5.4 PLAYER STATS (BATTING, PITCHING, CAREER)
drop policy if exists "Authorized staff manage batting stats" on public.player_season_batting;
drop policy if exists "batting_manage_staff" on public.player_season_batting;
create policy "batting_manage_staff"
on public.player_season_batting
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage pitching stats" on public.player_season_pitching;
drop policy if exists "pitching_manage_staff" on public.player_season_pitching;
create policy "pitching_manage_staff"
on public.player_season_pitching
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage career stats" on public.player_career_stats;
drop policy if exists "career_stats_manage_staff" on public.player_career_stats;
create policy "career_stats_manage_staff"
on public.player_career_stats
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 5.5 STANDINGS, COMPETITIONS, SEASONS, TEAMS, TEAM LOGOS
drop policy if exists "Authorized staff manage standings" on public.standings;
drop policy if exists "standings_manage_staff" on public.standings;
create policy "standings_manage_staff"
on public.standings
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage competitions" on public.competitions;
drop policy if exists "competitions_manage_staff" on public.competitions;
create policy "competitions_manage_staff"
on public.competitions
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage seasons" on public.seasons;
drop policy if exists "seasons_manage_staff" on public.seasons;
create policy "seasons_manage_staff"
on public.seasons
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage teams" on public.teams;
drop policy if exists "teams_manage_staff" on public.teams;
create policy "teams_manage_staff"
on public.teams
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage team logos" on public.team_logos;
drop policy if exists "team_logos_manage_staff" on public.team_logos;
create policy "team_logos_manage_staff"
on public.team_logos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));

-- 5.6 NEWS ARTICLES
drop policy if exists "Authorized editors manage news" on public.news;
drop policy if exists "news_manage_staff" on public.news;
create policy "news_manage_staff"
on public.news
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'))
with check (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'));

-- 5.7 AUDIT LOGS, NOTIFICATIONS & SETTINGS
drop policy if exists "Superadmin manage settings" on public.app_settings;
drop policy if exists "settings_manage_superadmin" on public.app_settings;
create policy "settings_manage_superadmin"
on public.app_settings
for all
to authenticated
using (public.get_auth_user_role() = 'superadmin')
with check (public.get_auth_user_role() = 'superadmin');

drop policy if exists "Superadmin read audit logs" on public.audit_logs;
drop policy if exists "audit_logs_read_superadmin" on public.audit_logs;
create policy "audit_logs_read_superadmin"
on public.audit_logs
for select
to authenticated
using (public.get_auth_user_role() = 'superadmin');

drop policy if exists "notifications_manage_staff" on public.notifications;
create policy "notifications_manage_staff"
on public.notifications
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));

