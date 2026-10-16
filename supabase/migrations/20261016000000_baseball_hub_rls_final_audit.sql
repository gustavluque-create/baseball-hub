-- ==============================================================================
-- Baseball Hub — Migración de Auditoría Final y Storage RLS (Fase 2.5 & Fase 2.6)
-- Archivo: 20261016000000_baseball_hub_rls_final_audit.sql
--
-- Objetivos:
-- 1. Depuración definitiva de políticas permisivas residuales ("Public read notifications", etc.).
-- 2. Blindaje de notifications (soporte para user_id destinatario + broadcasts públicos).
-- 3. Blindaje de public.users anti-escalada en INSERT y UPDATE (forzar role='user' e id inmutable).
-- 4. Revocación explícita de permisos EXECUTE en funciones SECURITY DEFINER (principio de mínimo privilegio).
-- 5. Configuración e inicialización de buckets en storage.buckets con límites y tipos MIME.
-- 6. Políticas RLS canónicas sobre storage.objects (lectura pública, escritura staff y aislamiento de avatars).
-- ==============================================================================

-- ==============================================================================
-- 1. BLINDAJE DE FUNCIONES SECURITY DEFINER
-- ==============================================================================

-- 1.1 Función autoritativa para verificar service_role / backend directo
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

-- 1.2 Helper autoritativo para consultar el rol del usuario autenticado
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

-- 1.3 Trigger anti-escalada en public.users (aplicable tanto a INSERT como a UPDATE)
create or replace function public.prevent_user_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_user_role text;
begin
  -- Si la llamada proviene del servidor backend legítimo (service_role o PostgreSQL admin)
  if public.is_authorized_service_role() then
    new.updated_at := now();
    return new;
  end if;

  -- Para peticiones iniciadas por clientes / usuarios autenticados:
  if tg_op = 'INSERT' then
    -- En inserciones de clientes, el rol siempre se inicializa en 'user'
    new.role := 'user';
    -- Asegurar vinculación legítima con la identidad de Supabase Auth
    if auth.uid() is null then
      raise exception 'Operación no permitida: se requiere autenticación para registrar perfil.';
    end if;
    new.id := auth.uid()::text;
    new.uid := auth.uid()::text;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  -- Para operaciones UPDATE:
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

-- 1.4 Trigger anti-manipulación de comentarios
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

  -- Inmutabilidad de claves y relaciones
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
-- 2. LIMPIEZA DEFINITIVA DE POLÍTICAS RESIDUALES Y BLINDAJE DE NOTIFICATIONS
-- ==============================================================================

-- Asegurar columna user_id en notifications para destinatarios específicos
alter table public.notifications add column if not exists user_id text references public.users(id) on delete cascade;

-- Eliminar explícitamente políticas antiguas permisivas en notifications
drop policy if exists "Public read notifications" on public.notifications;
drop policy if exists "Public manage notifications" on public.notifications;
drop policy if exists "notifications_manage_staff" on public.notifications;
drop policy if exists "notifications_select_recipient_or_broadcast" on public.notifications;

-- 2.1 Lectura segura de notificaciones:
-- Transmisiones públicas (user_id IS NULL) son legibles por todos; notificaciones privadas sólo por el destinatario o staff
create policy "notifications_select_recipient_or_broadcast"
on public.notifications
for select
using (
  user_id is null
  or (auth.uid() is not null and user_id = auth.uid()::text)
  or (public.is_authorized_service_role() or public.get_auth_user_role() in ('superadmin', 'admin', 'editor'))
);

-- 2.2 Mutación de notificaciones:
-- Creación, actualización y borrado restringidos exclusivamente a personal administrativo o backend
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

-- ==============================================================================
-- 3. AUDITORÍA Y BLINDAJE DE APP_SETTINGS Y AUDIT_LOGS
-- ==============================================================================

-- Limpieza de políticas en app_settings
drop policy if exists "Public manage settings" on public.app_settings;
drop policy if exists "Superadmin manage settings" on public.app_settings;
drop policy if exists "settings_manage_superadmin" on public.app_settings;

-- Solo lectura pública de configuraciones no sensibles
-- (La política "Public read app_settings" de la migración inicial se mantiene o se refirma)
drop policy if exists "Public read app_settings" on public.app_settings;
create policy "settings_select_public"
on public.app_settings
for select
using (true);

-- Modificación restringida exclusivamente al superadministrador o backend
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

-- Revocar accesos directos anónimos a audit_logs
revoke all on public.audit_logs from public, anon;
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

-- ==============================================================================
-- 4. VISTA PÚBLICA SEGURA "public.public_user_profiles"
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

alter view public.public_user_profiles owner to postgres;
revoke all on public.public_user_profiles from public;
revoke insert, update, delete, truncate on public.public_user_profiles from anon, authenticated, public;
grant select on public.public_user_profiles to anon, authenticated, service_role;

-- ==============================================================================
-- 5. CONFIGURACIÓN DE SUPABASE STORAGE (FASE 2.6)
-- ==============================================================================

-- 5.1 Creación / Actualización de Buckets con límites de tamaño y tipos MIME estrictos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'players',
    'players',
    true,
    5242880, -- 5 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  ),
  (
    'teams',
    'teams',
    true,
    5242880, -- 5 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  ),
  (
    'news',
    'news',
    true,
    10485760, -- 10 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  ),
  (
    'avatars',
    'avatars',
    true,
    3145728, -- 3 MB
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 5.2 Habilitar RLS en storage.objects
alter table storage.objects enable row level security;

-- Limpieza de políticas previas en storage.objects
drop policy if exists "Public read baseball storage" on storage.objects;
drop policy if exists "storage_select_public" on storage.objects;
drop policy if exists "storage_staff_manage_content" on storage.objects;
drop policy if exists "storage_avatars_manage" on storage.objects;

-- 5.3 Lectura pública universal para los 4 buckets de la aplicación
create policy "storage_select_public"
on storage.objects
for select
using (bucket_id in ('players', 'teams', 'news', 'avatars'));

-- 5.4 Escritura, actualización y borrado en 'players', 'teams' y 'news' (restringido a staff)
create policy "storage_staff_manage_content"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('players', 'teams', 'news')
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin', 'editor')
  )
)
with check (
  bucket_id in ('players', 'teams', 'news')
  and (
    public.is_authorized_service_role()
    or public.get_auth_user_role() in ('superadmin', 'admin', 'editor')
  )
);

-- 5.5 Escritura, actualización y borrado en 'avatars'
-- Permitido al propio usuario en su carpeta de UID o archivo con su UID, o a administradores
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
        or name = auth.uid()::text || '.webp'
        or name like auth.uid()::text || '/%'
      )
    )
  )
);
