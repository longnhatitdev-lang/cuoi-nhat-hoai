-- Chạy bổ sung trong Supabase SQL Editor. Không xoá bảng lời chúc/RSVP hiện có.
create table if not exists public.wedding_site_content (
  side text primary key check (side in ('nam','gai')),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.wedding_site_content(side,content)
values ('nam','{}'::jsonb),('gai','{}'::jsonb)
on conflict (side) do nothing;
alter table public.wedding_site_content enable row level security;
-- Client chỉ đọc qua API /api/site; không cấp quyền truy cập trực tiếp cho anon.
revoke all on table public.wedding_site_content from anon, authenticated;
-- API Vercel dùng server-only SUPABASE_KEY (secret/service_role) để đọc/ghi.
-- Không tạo policy public INSERT/UPDATE/DELETE.

-- Storage: tạo bucket wedding-assets trong Dashboard > Storage, đặt Public = ON
-- để ảnh/nhạc trong thiệp hiển thị cho khách. Không tạo policy upload public.

-- Cấu hình khóa Client sau đám cưới. Không ảnh hưởng RSVP/lời chúc/nội dung thiệp.
create table if not exists public.wedding_site_access_config (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  password_hash text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.wedding_site_access_config(id,enabled,password_hash)
values (1,false,'') on conflict (id) do nothing;
alter table public.wedding_site_access_config enable row level security;
revoke all on table public.wedding_site_access_config from anon, authenticated;

-- Bộ đếm sai và thời gian khóa lưu ở DB để không bị reset khi tải lại trang/Vercel đổi instance.
create table if not exists public.wedding_site_access_attempts (
  client_key text primary key,
  failed_attempts integer not null default 0,
  lock_until timestamptz,
  lock_seconds integer not null default 15,
  updated_at timestamptz not null default now()
);
alter table public.wedding_site_access_attempts enable row level security;
revoke all on table public.wedding_site_access_attempts from anon, authenticated;

create or replace function public.wedding_access_fail(p_client_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.wedding_site_access_attempts;
begin
  insert into public.wedding_site_access_attempts(client_key,failed_attempts,lock_seconds,updated_at)
  values (p_client_key,1,15,now())
  on conflict (client_key) do update set
    failed_attempts = case when public.wedding_site_access_attempts.lock_until is not null and public.wedding_site_access_attempts.lock_until <= now() then 1 else public.wedding_site_access_attempts.failed_attempts + 1 end,
    lock_until = case when public.wedding_site_access_attempts.lock_until is not null and public.wedding_site_access_attempts.lock_until <= now() then null else public.wedding_site_access_attempts.lock_until end,
    updated_at = now()
  returning * into r;
  if r.failed_attempts >= 3 then
    update public.wedding_site_access_attempts set
      lock_until = now() + make_interval(secs => lock_seconds),
      lock_seconds = least(lock_seconds * 2, 86400),
      failed_attempts = 0, updated_at = now()
    where client_key = p_client_key returning * into r;
    return jsonb_build_object('lock_seconds', greatest(1, extract(epoch from (r.lock_until-now()))::integer));
  end if;
  return jsonb_build_object('lock_seconds',0,'remaining',3-r.failed_attempts);
end; $$;
revoke all on function public.wedding_access_fail(text) from public, anon, authenticated;
grant execute on function public.wedding_access_fail(text) to service_role;
