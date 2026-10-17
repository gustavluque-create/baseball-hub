-- ==============================================================================
-- Baseball Hub — Migración Correctiva Integral RLS y Storage (Fase 2.5 y Fase 2.6)
-- Archivo: 20261016000001_baseball_hub_rls_and_storage_hardening.sql
--
-- Objetivos de endurecimiento:
-- 1. Barrido absoluto basado en lista blanca canónica (NO dependiente de nombres).
--    Cualquier política no autorizada en public o storage es eliminada dinámicamente.
-- 2. Afirmación 100% idempotente de políticas de Storage (storage_select_public,
--    storage_staff_manage_content y storage_avatars_manage).
-- 3. Blindaje de notifications y app_settings con políticas autoritativas.
-- 4. Blindaje de funciones SECURITY DEFINER (search_path explícito y revocación de PUBLIC).
-- 5. Cero pérdida de datos, sin desactivar RLS en ninguna tabla.
-- ==============================================================================

-- ==============================================================================
-- 1. BARRIDO DINÁMICO EXHAUSTIVO MEDIANTE LISTA BLANCA (INVERSE ALLOWLIST)
-- ==============================================================================

do $$
declare
  r record;
  allowed_public_policies text[] := array[
    -- users
    'users_select_own_strict',
    'users_update_own_safe',
    -- news_comments
    'news_comments_select_public',
    'news_comments_insert_auth',
    'news_comments_update_author',
    'news_comments_delete_moderator',
    -- games
    'Public read games',
    'games_insert_staff',
    'games_update_staff',
    'games_delete_staff',
    -- lineups & events
    'Public read game_lineups',
    'lineups_manage_staff',
    'Public read game_events',
    'events_manage_staff',
    -- players & photos
    'Public read players',
    'players_manage_staff',
    'Public read player_photos',
    'player_photos_manage_staff',
    -- player stats
    'Public read player_season_batting',
    'batting_manage_staff',
    'Public read player_season_pitching',
    'pitching_manage_staff',
    'Public read player_career_stats',
    'career_stats_manage_staff',
    -- standings, competitions, seasons, teams, team_logos
    'Public read standings',
    'standings_manage_staff',
    'Public read competitions',
    'competitions_manage_staff',
    'Public read seasons',
    'seasons_manage_staff',
    'Public read teams',
    'teams_manage_staff',
    'Public read team_logos',
    'team_logos_manage_staff',
    -- news
    'Public read news',
    'news_manage_staff',
    -- settings, audit_logs, notifications
    'settings_select_public',
    'settings_manage_superadmin',
    'audit_logs_read_superadmin',
    'notifications_select_recipient_or_broadcast',
    'notifications_manage_staff'
  ];
  allowed_storage_policies text[] := array[
    'storage_select_public',
    'storage_staff_manage_content',
    'storage_avatars_manage'
  ];
begin
  -- 1. Depurar cualquier política no autorizada en el esquema public
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and not (policyname = any(allowed_public_policies))
  ) loop
    execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- 2. Depurar cualquier política no autorizada en storage.objects
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    for r in (
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and not (policyname = any(allowed_storage_policies))
    ) loop
      execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
    end loop;
  end if;
end $$;

-- ==============================================================================
-- 2. VERIFICACIÓN Y AFIRMACIÓN DE FUNCIONES SECURITY DEFINER
-- ==============================================================================

-- 2.1 Verificación de llamada autoritativa de backend (service_role)
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
  if session_user in ('postgres', 'service_role', 'supabase_admin') then
    return true;
  end if;

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

  return false;
end;
$$;

alter function public.is_authorized_service_role() owner to postgres;
revoke all on function public.is_authorized_service_role() from public;
grant execute on function public.is_authorized_service_role() to authenticated, anon, service_role;

-- 2.2 Consulta autoritativa de rol de usuario
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

-- 2.3 Trigger anti-escalación y protección de perfil
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_user_role text;
begin
  if public.is_authorized_service_role() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    if auth.uid() is null then
      raise exception 'Operación no permitida: se requiere autenticación para registrar perfil.';
    end if;
    new.id := auth.uid()::text;
    new.uid := auth.uid()::text;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  v_current_user_role := public.get_auth_user_role();

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
    if new.uid is distinct from old.uid or new.id is distinct from old.id then
      raise exception 'Operación no permitida: los identificadores de usuario son inmutables.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

alter function public.prevent_user_self_role_escalation() owner to postgres;
revoke all on function public.prevent_user_self_role_escalation() from public;
grant execute on function public.prevent_user_self_role_escalation() to authenticated, service_role;

drop trigger if exists trg_prevent_user_self_role_escalation on public.users;
create trigger trg_prevent_user_self_role_escalation
before insert or update on public.users
for each row
execute function public.prevent_user_self_role_escalation();

-- 2.4 Trigger anti-tampering de comentarios
create or replace function public.prevent_comment_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_role text;
begin
  if public.is_authorized_service_role() then
    return new;
  end if;

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

  if length(trim(new.content)) < 3 or length(new.content) > 2000 then
    raise exception 'El contenido del comentario debe contener entre 3 y 2000 caracteres.';
  end if;

  v_user_role := public.get_auth_user_role();
  if v_user_role in ('superadmin', 'editor', 'admin') then
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid()::text then
    raise exception 'Operación denegada: no tiene permisos para editar este comentario.';
  end if;

  return new;
end;
$$;

alter function public.prevent_comment_tampering() owner to postgres;
revoke all on function public.prevent_comment_tampering() from public;
grant execute on function public.prevent_comment_tampering() to authenticated, service_role;

drop trigger if exists trg_prevent_comment_tampering on public.news_comments;
create trigger trg_prevent_comment_tampering
before update on public.news_comments
for each row
execute function public.prevent_comment_tampering();

-- ==============================================================================
-- 3. POLÍTICAS CANÓNICAS DE NOTIFICATIONS Y APP_SETTINGS
-- ==============================================================================

alter table public.notifications add column if not exists user_id text references public.users(id) on delete cascade;

drop policy if exists "Public read notifications" on public.notifications;
drop policy if exists "Public manage notifications" on public.notifications;
drop policy if exists "notifications_manage_staff" on public.notifications;
drop policy if exists "notifications_select_recipient_or_broadcast" on public.notifications;

create policy "notifications_select_recipient_or_broadcast"
on public.notifications
for select
using (
  user_id is null
  or (auth.uid() is not null and user_id = auth.uid()::text)
  or (public.is_authorized_service_role() or public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
);

create policy "notifications_manage_staff"
on public.notifications
for all
to authenticated
using (
  public.is_authorized_service_role()
  or public.get_auth_user_role() in ('superadmin', 'admin', 'editor')
)
with check (
  public.is_authorized_service_role()
  or public.get_auth_user_role() in ('superadmin', 'admin', 'editor')
);

-- App Settings
drop policy if exists "Public manage settings" on public.app_settings;
drop policy if exists "Superadmin manage settings" on public.app_settings;
drop policy if exists "settings_manage_superadmin" on public.app_settings;
drop policy if exists "Public read app_settings" on public.app_settings;
drop policy if exists "settings_select_public" on public.app_settings;

create policy "settings_select_public"
on public.app_settings
for select
using (true);

create policy "settings_manage_superadmin"
on public.app_settings
for all
to authenticated
using (
  public.is_authorized_service_role()
  or public.get_auth_user_role() = 'superadmin'
)
with check (
  public.is_authorized_service_role()
  or public.get_auth_user_role() = 'superadmin'
);

-- ==============================================================================
-- 4. BUCKETS DE STORAGE Y POLÍTICAS RLS EN STORAGE.OBJECTS
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('players', 'players', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('teams', 'teams', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('news', 'news', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('avatars', 'avatars', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "Public read baseball storage" on storage.objects;
drop policy if exists "storage_select_public" on storage.objects;
drop policy if exists "storage_staff_manage_content" on storage.objects;
drop policy if exists "storage_avatars_manage" on storage.objects;

-- 4.1 Lectura pública universal en los 4 buckets
create policy "storage_select_public"
on storage.objects
for select
using (bucket_id in ('players', 'teams', 'news', 'avatars'));

-- 4.2 Mutación en players, teams y news restringida a personal autorizado
create policy "storage_staff_manage_content"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('players', 'teams', 'news')
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin', 'editor', 'official_scorer')
  )
)
with check (
  bucket_id in ('players', 'teams', 'news')
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin', 'editor', 'official_scorer')
  )
);

-- 4.3 Mutación en avatars restringida al propio usuario (carpeta/archivo con su UID) o admins
create policy "storage_avatars_manage"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin')
    or (
      auth.uid() is not null
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or name = auth.uid()::text
        or name = auth.uid()::text || '.png'
        or name = auth.uid()::text || '.jpg'
        or name = auth.uid()::text || '.jpeg'
        or name = auth.uid()::text || '.webp'
        or name like auth.uid()::text || '/%'
      )
    )
  )
)
with check (
  bucket_id = 'avatars'
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin')
    or (
      auth.uid() is not null
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or name = auth.uid()::text
        or name = auth.uid()::text || '.png'
        or name = auth.uid()::text || '.jpg'
        or name = auth.uid()::text || '.jpeg'
        or name = auth.uid()::text || '.webp'
        or name like auth.uid()::text || '/%'
      )
    )
  )
);
