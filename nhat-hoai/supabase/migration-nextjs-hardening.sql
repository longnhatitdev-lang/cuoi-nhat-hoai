-- LCLN Wedding: migration bổ sung cho Next.js.
-- Không xoá hoặc thay đổi bảng wedding_wall, RSVP, wedding_site_content hay album hiện có.
-- Chạy một lần trong Supabase SQL Editor sau khi backup database.

create table if not exists public.wedding_wall_rate_limits (
  client_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.wedding_wall_rate_limits enable row level security;
revoke all on table public.wedding_wall_rate_limits from anon, authenticated;

create or replace function public.wedding_submit_wall_message(
  p_name text,
  p_side text,
  p_status text,
  p_guests integer,
  p_message text,
  p_client_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_row public.wedding_wall;
  v_name text := lower(trim(p_name));
  v_message text := lower(trim(p_message));
begin
  if p_name is null or length(trim(p_name)) not between 1 and 80
     or p_side not in ('nha-trai','nha-gai')
     or p_status not in ('live','yes','no')
     or p_message is null or length(trim(p_message)) not between 1 and 250
     or p_client_key is null or length(p_client_key) <> 64 then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;

  -- Khoá theo IP và tên trong cùng transaction để không bị race condition.
  perform pg_advisory_xact_lock(hashtextextended(p_client_key, 1));
  insert into public.wedding_wall_rate_limits(client_key,window_started_at,request_count,updated_at)
  values (p_client_key,now(),1,now())
  on conflict (client_key) do update set
    window_started_at = case when public.wedding_wall_rate_limits.window_started_at <= now() - interval '1 minute' then now() else public.wedding_wall_rate_limits.window_started_at end,
    request_count = case when public.wedding_wall_rate_limits.window_started_at <= now() - interval '1 minute' then 1 else public.wedding_wall_rate_limits.request_count + 1 end,
    updated_at = now();
  select request_count into v_count from public.wedding_wall_rate_limits where client_key=p_client_key;
  if v_count > 12 then return jsonb_build_object('ok',false,'code','rate_limit'); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_name, 2));
  select count(*) into v_count from public.wedding_wall where lower(trim(name))=v_name;
  if v_count >= 3 then return jsonb_build_object('ok',false,'code','name_limit'); end if;
  if exists(select 1 from public.wedding_wall where lower(trim(name))=v_name and lower(trim(message))=v_message) then
    return jsonb_build_object('ok',false,'code','duplicate');
  end if;

  insert into public.wedding_wall(name,side,status,guests,message)
  values (trim(p_name),p_side,p_status,greatest(0,least(coalesce(p_guests,0),20)),trim(p_message))
  returning * into v_row;
  return jsonb_build_object('ok',true,'row',to_jsonb(v_row));
end;
$$;

revoke all on function public.wedding_submit_wall_message(text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.wedding_submit_wall_message(text,text,text,integer,text,text) to service_role;

-- Dọn dữ liệu giới hạn cũ khi cần (có thể chạy thủ công định kỳ):
-- delete from public.wedding_wall_rate_limits where updated_at < now() - interval '30 days';

-- Giới hạn đăng nhập Admin lưu bền vững trong DB (không phụ thuộc instance Vercel).
create table if not exists public.wedding_admin_login_limits (
  client_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.wedding_admin_login_limits enable row level security;
revoke all on table public.wedding_admin_login_limits from anon, authenticated;

create or replace function public.wedding_admin_login_check(p_client_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if p_client_key is null or length(p_client_key) <> 64 then
    return jsonb_build_object('allowed',false);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_key, 3));
  insert into public.wedding_admin_login_limits(client_key,window_started_at,attempt_count,updated_at)
  values(p_client_key,now(),1,now())
  on conflict(client_key) do update set
    window_started_at=case when public.wedding_admin_login_limits.window_started_at <= now()-interval '10 minutes' then now() else public.wedding_admin_login_limits.window_started_at end,
    attempt_count=case when public.wedding_admin_login_limits.window_started_at <= now()-interval '10 minutes' then 1 else public.wedding_admin_login_limits.attempt_count+1 end,
    updated_at=now();
  select attempt_count into v_count from public.wedding_admin_login_limits where client_key=p_client_key;
  return jsonb_build_object('allowed',v_count <= 10,'remaining',greatest(0,10-v_count));
end; $$;
revoke all on function public.wedding_admin_login_check(text) from public, anon, authenticated;
grant execute on function public.wedding_admin_login_check(text) to service_role;

create or replace function public.wedding_admin_login_reset(p_client_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.wedding_admin_login_limits where client_key=p_client_key;
end; $$;
revoke all on function public.wedding_admin_login_reset(text) from public, anon, authenticated;
grant execute on function public.wedding_admin_login_reset(text) to service_role;

create or replace function public.wedding_wall_read_allowed(p_client_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if p_client_key is null or length(p_client_key) <> 64 then return jsonb_build_object('allowed',false); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_key, 4));
  insert into public.wedding_wall_rate_limits(client_key,window_started_at,request_count,updated_at)
  values(p_client_key,now(),1,now())
  on conflict(client_key) do update set
    window_started_at=case when public.wedding_wall_rate_limits.window_started_at <= now()-interval '1 minute' then now() else public.wedding_wall_rate_limits.window_started_at end,
    request_count=case when public.wedding_wall_rate_limits.window_started_at <= now()-interval '1 minute' then 1 else public.wedding_wall_rate_limits.request_count+1 end,
    updated_at=now();
  select request_count into v_count from public.wedding_wall_rate_limits where client_key=p_client_key;
  return jsonb_build_object('allowed',v_count <= 90,'remaining',greatest(0,90-v_count));
end; $$;
revoke all on function public.wedding_wall_read_allowed(text) from public, anon, authenticated;
grant execute on function public.wedding_wall_read_allowed(text) to service_role;
