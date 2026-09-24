-- Better City v1 schema. Apply this only to the Better City Supabase project.
-- Do not run it against KOS or any other database.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'executive' check (role in ('admin', 'reviewer', 'executive')),
  full_name text not null default '',
  phone text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Role checks. Created after profiles so the table exists when the function is parsed.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'reviewer')
      and active
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and active
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_active_user() to authenticated;

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null default '',
  center_lat double precision not null default 18.5204,
  center_lng double precision not null default 73.8567,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  ward_id uuid references public.wards (id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create table public.profile_cities (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  primary key (profile_id, city_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'map-pin',
  detail_fields jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  area_id uuid references public.areas (id),
  area_other_text text,
  ward_id uuid references public.wards (id),
  category_id uuid not null references public.categories (id),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  original_severity text not null check (original_severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  details jsonb not null default '{}'::jsonb,
  remarks text,
  landmark text,
  address text,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  location_source text not null check (location_source in ('live_gps', 'photo_metadata', 'manual_pin')),
  location geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  submitted_by uuid not null references public.profiles (id),
  status text not null default 'submitted' check (
    status in (
      'draft', 'submitted', 'under_review', 'needs_info', 'duplicate', 'rejected',
      'verified', 'reported_to_city', 'acknowledged', 'resolved', 'closed'
    )
  ),
  duplicate_of uuid references public.reports (id),
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_area_present check (area_id is not null or coalesce(area_other_text, '') <> '')
);

create index reports_city_status_idx on public.reports (city_id, status, created_at desc);
create index reports_submitted_by_idx on public.reports (submitted_by, created_at desc);
create index reports_area_idx on public.reports (area_id);
create index reports_location_idx on public.reports using gist (location);

create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  original_path text not null,
  stamped_path text not null,
  source text not null check (source in ('camera', 'gallery')),
  kind text not null default 'evidence' check (kind in ('evidence', 'after')),
  captured_at timestamptz,
  lat double precision,
  lng double precision,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index report_photos_report_idx on public.report_photos (report_id, sort_order);

create table public.report_notes (
  report_id uuid primary key references public.reports (id) on delete cascade,
  body text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  kind text not null,
  body text,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

create index report_events_report_idx on public.report_events (report_id, created_at);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.collection_reports (
  collection_id uuid not null references public.collections (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  primary key (collection_id, report_id)
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  city_id uuid not null references public.cities (id),
  area_id uuid references public.areas (id),
  ward_id uuid references public.wards (id),
  collection_id uuid references public.collections (id),
  label text not null,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_touch
before update on public.reports
for each row execute function public.touch_updated_at();

create or replace function public.guard_report_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_staff() then
    new.original_severity := old.original_severity;
    new.captured_at := old.captured_at;
    new.lat := old.lat;
    new.lng := old.lng;
    new.location_source := old.location_source;
    new.accuracy_m := old.accuracy_m;
    new.submitted_by := old.submitted_by;
    new.uploaded_at := old.uploaded_at;
    if new.status = 'resolved' and old.status is distinct from 'resolved' then
      if not exists (
        select 1 from public.report_photos
        where report_id = new.id and kind = 'after'
      ) then
        raise exception 'An after photo is required before a report can be resolved';
      end if;
    end if;
    return new;
  end if;

  if old.submitted_by is distinct from (select auth.uid()) then
    raise exception 'You can only edit your own reports';
  end if;

  if old.status not in ('draft', 'submitted', 'needs_info') then
    raise exception 'This report is locked';
  end if;

  new.lat := old.lat;
  new.lng := old.lng;
  new.captured_at := old.captured_at;
  new.location_source := old.location_source;
  new.accuracy_m := old.accuracy_m;
  new.submitted_by := old.submitted_by;
  new.uploaded_at := old.uploaded_at;
  new.original_severity := old.original_severity;
  new.city_id := old.city_id;

  if old.status = 'needs_info' then
    new.status := 'submitted';
  else
    new.status := old.status;
  end if;

  return new;
end;
$$;

create trigger reports_guard
before update on public.reports
for each row execute function public.guard_report_update();

create or replace function public.log_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, actor_id, kind, to_status, body)
    values (new.id, new.submitted_by, 'created', new.status, 'Report submitted');
    insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
    values (new.submitted_by, 'report.create', 'report', new.id, jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status
     or new.severity is distinct from old.severity
     or new.category_id is distinct from old.category_id
     or new.title is distinct from old.title
     or new.area_id is distinct from old.area_id
     or new.ward_id is distinct from old.ward_id
     or new.description is distinct from old.description then
    insert into public.report_events (report_id, actor_id, kind, from_status, to_status, body)
    values (
      new.id,
      (select auth.uid()),
      case when new.status is distinct from old.status then 'status' else 'edit' end,
      old.status,
      new.status,
      case
        when new.status is distinct from old.status then coalesce(new.reject_reason, 'Status updated')
        else 'Report edited'
      end
    );
    insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
    values (
      (select auth.uid()),
      'report.update',
      'report',
      new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'from_severity', old.severity,
        'to_severity', new.severity,
        'from_title', old.title,
        'to_title', new.title
      )
    );
  end if;
  return new;
end;
$$;

create trigger reports_log
after insert or update on public.reports
for each row execute function public.log_report_status();

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null for the service role and the SQL editor. Those callers may change role.
  if (select auth.uid()) is null
     or (public.is_admin() and (select auth.uid()) is distinct from old.id) then
    return new;
  end if;
  new.role := old.role;
  new.active := old.active;
  new.phone := old.phone;
  return new;
end;
$$;

create trigger profiles_guard
before update on public.profiles
for each row execute function public.guard_profile_update();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, must_change_password)
  values (
    new.id,
    case
      when coalesce(new.raw_app_meta_data->>'role', 'executive') in ('admin', 'reviewer', 'executive')
        then coalesce(new.raw_app_meta_data->>'role', 'executive')
      else 'executive'
    end,
    coalesce(new.raw_app_meta_data->>'full_name', ''),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.touch_updated_at() from public, anon;
revoke all on function public.guard_report_update() from public, anon, authenticated;
revoke all on function public.log_report_status() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.wards enable row level security;
alter table public.areas enable row level security;
alter table public.profile_cities enable row level security;
alter table public.categories enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.report_notes enable row level security;
alter table public.report_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.collections enable row level security;
alter table public.collection_reports enable row level security;
alter table public.share_links enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_staff());

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy cities_select on public.cities
for select to authenticated
using (
  public.is_staff()
  or (
    active
    and exists (
      select 1 from public.profile_cities pc
      where pc.city_id = cities.id and pc.profile_id = (select auth.uid())
    )
  )
);

create policy cities_write on public.cities
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy wards_select on public.wards
for select to authenticated
using (
  public.is_staff()
  or (
    active and exists (
      select 1 from public.profile_cities pc
      where pc.city_id = wards.city_id and pc.profile_id = (select auth.uid())
    )
  )
);

create policy wards_write on public.wards
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy areas_select on public.areas
for select to authenticated
using (
  public.is_staff()
  or (
    active and exists (
      select 1 from public.profile_cities pc
      where pc.city_id = areas.city_id and pc.profile_id = (select auth.uid())
    )
  )
);

create policy areas_write on public.areas
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy profile_cities_select on public.profile_cities
for select to authenticated
using (profile_id = (select auth.uid()) or public.is_staff());

create policy profile_cities_write on public.profile_cities
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy categories_select on public.categories
for select to authenticated
using (active or public.is_staff());

create policy categories_write on public.categories
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy reports_select on public.reports
for select to authenticated
using (
  public.is_active_user()
  and (public.is_staff() or submitted_by = (select auth.uid()))
);

create policy reports_insert on public.reports
for insert to authenticated
with check (
  public.is_active_user()
  and submitted_by = (select auth.uid())
  and status in ('draft', 'submitted')
  and exists (
    select 1 from public.profile_cities pc
    where pc.profile_id = (select auth.uid()) and pc.city_id = reports.city_id
  )
);

create policy reports_update on public.reports
for update to authenticated
using (
  public.is_active_user()
  and (public.is_staff() or submitted_by = (select auth.uid()))
)
with check (
  public.is_active_user()
  and (public.is_staff() or submitted_by = (select auth.uid()))
);

create policy photos_select on public.report_photos
for select to authenticated
using (
  exists (
    select 1 from public.reports r
    where r.id = report_photos.report_id
      and (public.is_staff() or r.submitted_by = (select auth.uid()))
  )
);

create policy photos_write on public.report_photos
for insert to authenticated
with check (
  exists (
    select 1 from public.reports r
    where r.id = report_photos.report_id
      and (
        public.is_staff()
        or (r.submitted_by = (select auth.uid()) and r.status in ('draft', 'submitted', 'needs_info'))
      )
  )
);

create policy notes_staff on public.report_notes
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy events_select on public.report_events
for select to authenticated
using (
  exists (
    select 1 from public.reports r
    where r.id = report_events.report_id
      and (public.is_staff() or r.submitted_by = (select auth.uid()))
  )
);

create policy audit_staff on public.audit_log
for select to authenticated
using (public.is_admin());

create policy collections_staff on public.collections
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy collection_reports_staff on public.collection_reports
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy share_links_staff on public.share_links
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on table public.report_notes from anon;
revoke all on table public.audit_log from anon;
revoke all on table public.share_links from anon;
revoke all on table public.reports from anon;

-- Showcase reads go through the service role on the server, never through anon.

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 20971520)
on conflict (id) do nothing;

create policy evidence_read on storage.objects
for select to authenticated
using (
  bucket_id = 'evidence'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

create policy evidence_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'evidence'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

create policy evidence_update on storage.objects
for update to authenticated
using (
  bucket_id = 'evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- Launch seed. Area names are a starter list; edit them in Admin.
-- ---------------------------------------------------------------------------

insert into public.cities (name, state, center_lat, center_lng)
values ('Pune', 'Maharashtra', 18.5204, 73.8567);

insert into public.areas (city_id, name)
select id, area_name
from public.cities
cross join (
  values
    ('Kothrud'),
    ('Baner'),
    ('Hadapsar'),
    ('Shivajinagar'),
    ('Koregaon Park'),
    ('Deccan'),
    ('Wakad'),
    ('Hinjawadi'),
    ('Viman Nagar'),
    ('Camp'),
    ('Aundh'),
    ('Pashan'),
    ('Karve Nagar'),
    ('Kalyani Nagar'),
    ('Sinhagad Road')
) as seed(area_name)
where cities.name = 'Pune';

insert into public.categories (name, icon, sort_order, detail_fields) values
  ('Pothole', 'circle-dot', 10, '[{"key":"size","label":"Approx size","type":"select","options":["S","M","L"]},{"key":"depth","label":"Depth","type":"select","options":["Shallow","Deep"]},{"key":"lane","label":"Lane","type":"text"}]'),
  ('Road damage / cracks', 'route', 20, '[{"key":"span","label":"Span","type":"select","options":["Short","Long stretch"]}]'),
  ('Open / broken manhole', 'circle-alert', 30, '[{"key":"cover","label":"Cover","type":"select","options":["Missing","Broken","Shifted"]}]'),
  ('Waterlogging / blocked drain', 'waves', 40, '[]'),
  ('Garbage dump / overflowing bin', 'trash-2', 50, '[]'),
  ('Broken / non-working streetlight', 'lightbulb', 60, '[{"key":"pole","label":"Pole number","type":"text"}]'),
  ('Damaged footpath', 'footprints', 70, '[]'),
  ('Encroachment', 'construction', 80, '[]'),
  ('Broken signage / signal', 'signpost', 90, '[]'),
  ('Fallen tree / branches', 'tree-deciduous', 100, '[]'),
  ('Stray animal hazard', 'paw-print', 110, '[]'),
  ('Other', 'map-pin', 120, '[]');
