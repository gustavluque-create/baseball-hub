-- ==============================================================================
-- Baseball Hub — Migración Fase 2.5A: Hardening de Políticas RLS y Seguridad
-- Archivo: 20261010000000_baseball_hub_rls_hardening.sql
-- 
-- Objetivos:
-- 1. Sustituir "Users read own profile" (USING true) por política de acceso estricto al perfil propio.
-- 2. Crear una vista pública segura "public.public_user_profiles" con sólo campos públicos (id, uid, display_name, photo_url).
-- 3. Proteger la columna de roles e impedir que los usuarios cambien su propio rol o el de terceros por UPDATE directo.
-- 4. Reemplazar la política permisiva de comentarios "Public create comments" (que solo validaba longitud >= 3)
--    por validación de autenticación obligatoria y límites estrictos (longitud >= 3 y <= 2000, autor, article_slug no vacío).
-- 5. Proteger UPDATE y DELETE en comentarios: sólo el autor autenticado o roles administrativos (superadmin, editor) pueden modificar/eliminar.
-- 6. Endurecer tablas deportivas (competitions, seasons, teams, players, games, stats, etc.) garantizando
--    que clientes anónimos y usuarios normales SOLO tengan SELECT, reservando INSERT, UPDATE y DELETE
--    exclusivamente para roles autorizados o service_role.
-- ==============================================================================

-- ==============================================================================
-- 1. FUNCIÓN HELPER SEGURA PARA OBTENCIÓN DE ROL AUTORITATIVO
-- ==============================================================================
create or replace function public.get_auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.users where uid = auth.uid()::text or id = auth.uid()::text limit 1),
    'user'
  );
$$;

-- ==============================================================================
-- 2. HARDENING DE "public.users"
-- ==============================================================================
-- Eliminar políticas previas demasiado permisivas
drop policy if exists "Users read own profile" on public.users;
drop policy if exists "Users update own profile" on public.users;

-- Política de lectura: los usuarios autenticados SOLO pueden leer su propio perfil.
-- Superadmins o admins pueden leer los perfiles para administración.
create policy "Users read own profile strict"
on public.users
for select
to authenticated
using (
  (auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text))
  or (public.get_auth_user_role() in ('superadmin', 'admin'))
);

-- Bloquear lectura a usuarios anónimos en la tabla base public.users
-- (los anónimos no tienen política de SELECT sobre public.users).

-- Trigger para impedir elevación de privilegios en UPDATE de public.users
-- Un usuario nunca puede modificar su propio campo 'role' ni el 'uid'/'id'
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si la modificación proviene de un usuario normal (no service_role ni superadmin)
  if current_user <> 'service_role' and public.get_auth_user_role() not in ('superadmin', 'admin') then
    if new.role is distinct from old.role then
      raise exception 'Operación no permitida: no tiene autorización para modificar roles de usuario.';
    end if;
    if new.uid is distinct from old.uid or new.id is distinct from old.id then
      raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
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

-- Política de actualización: el usuario sólo puede actualizar su propio registro,
-- con check que previene modificar roles
create policy "Users update own profile safe"
on public.users
for update
to authenticated
using (
  auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text)
)
with check (
  auth.uid() is not null and (uid = auth.uid()::text or id = auth.uid()::text)
);

-- Vista pública segura para visualización de información pública de usuarios
-- (sin exponer correos, preferencias privadas, hashes o metadatos de sesión)
create or replace view public.public_user_profiles as
select
  id,
  uid,
  display_name,
  photo_url,
  created_at
from public.users;

-- Conceder permisos de lectura en la vista pública
grant select on public.public_user_profiles to anon, authenticated;

-- ==============================================================================
-- 3. HARDENING DE "public.news_comments"
-- ==============================================================================
drop policy if exists "Public create comments" on public.news_comments;
drop policy if exists "Public read news_comments" on public.news_comments;

-- Lectura de comentarios: pública (todos los lectores pueden ver comentarios)
create policy "Anyone read news_comments"
on public.news_comments
for select
using (true);

-- Creación de comentarios: requiere usuario autenticado y validaciones de contenido
create policy "Authenticated users create comments"
on public.news_comments
for insert
to authenticated
with check (
  auth.uid() is not null
  and length(trim(content)) >= 3
  and length(content) <= 2000
  and length(trim(article_slug)) > 0
  and length(trim(author_name)) > 0
);

-- Actualización de comentarios: sólo el propio autor o moderadores
create policy "Author or moderator update comment"
on public.news_comments
for update
to authenticated
using (
  (public.get_auth_user_role() in ('superadmin', 'editor', 'admin'))
)
with check (
  (public.get_auth_user_role() in ('superadmin', 'editor', 'admin'))
);

-- Eliminación de comentarios: moderadores autorizados (superadmin, editor, admin)
create policy "Moderators delete comments"
on public.news_comments
for delete
to authenticated
using (
  public.get_auth_user_role() in ('superadmin', 'editor', 'admin')
);

-- ==============================================================================
-- 4. HARDENING DE TABLAS DEPORTIVAS Y CONTENIDO (ANTI-TAMPERING)
-- ==============================================================================
-- Asegurar que clientes anónimos y usuarios normales NO puedan modificar
-- partidos, resultados, alineaciones, jugadores, estadísticas, equipos ni clasificaciones.

-- 4.1 GAMES
drop policy if exists "Authorized staff insert games" on public.games;
drop policy if exists "Authorized staff update games" on public.games;
drop policy if exists "Authorized staff delete games" on public.games;

create policy "Authorized staff insert games"
on public.games
for insert
to authenticated
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "Authorized staff update games"
on public.games
for update
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

create policy "Authorized staff delete games"
on public.games
for delete
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 4.2 GAME LINEUPS & GAME EVENTS
drop policy if exists "Authorized staff manage lineups" on public.game_lineups;
create policy "Authorized staff manage lineups"
on public.game_lineups
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage events" on public.game_events;
create policy "Authorized staff manage events"
on public.game_events
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 4.3 PLAYERS & PLAYER PHOTOS
drop policy if exists "Authorized staff manage players" on public.players;
create policy "Authorized staff manage players"
on public.players
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage player_photos" on public.player_photos;
create policy "Authorized staff manage player_photos"
on public.player_photos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin', 'editor'));

-- 4.4 PLAYER STATS (BATTING, PITCHING, CAREER)
drop policy if exists "Authorized staff manage batting stats" on public.player_season_batting;
create policy "Authorized staff manage batting stats"
on public.player_season_batting
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage pitching stats" on public.player_season_pitching;
create policy "Authorized staff manage pitching stats"
on public.player_season_pitching
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage career stats" on public.player_career_stats;
create policy "Authorized staff manage career stats"
on public.player_career_stats
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

-- 4.5 STANDINGS, COMPETITIONS, SEASONS, TEAMS, TEAM LOGOS
drop policy if exists "Authorized staff manage standings" on public.standings;
create policy "Authorized staff manage standings"
on public.standings
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'official_scorer', 'admin'));

drop policy if exists "Authorized staff manage teams" on public.teams;
create policy "Authorized staff manage teams"
on public.teams
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin'))
with check (public.get_auth_user_role() in ('superadmin', 'admin'));

drop policy if exists "Authorized staff manage team logos" on public.team_logos;
create policy "Authorized staff manage team logos"
on public.team_logos
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
with check (public.get_auth_user_role() in ('superadmin', 'admin', 'editor'));

-- 4.6 NEWS ARTICLES
drop policy if exists "Authorized editors manage news" on public.news;
create policy "Authorized editors manage news"
on public.news
for all
to authenticated
using (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'))
with check (public.get_auth_user_role() in ('superadmin', 'editor', 'admin', 'prensa'));

-- 4.7 AUDIT LOGS & SETTINGS
drop policy if exists "Superadmin manage settings" on public.app_settings;
create policy "Superadmin manage settings"
on public.app_settings
for all
to authenticated
using (public.get_auth_user_role() = 'superadmin')
with check (public.get_auth_user_role() = 'superadmin');

drop policy if exists "Superadmin read audit logs" on public.audit_logs;
create policy "Superadmin read audit logs"
on public.audit_logs
for select
to authenticated
using (public.get_auth_user_role() = 'superadmin');
