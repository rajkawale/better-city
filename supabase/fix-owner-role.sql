create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

update public.profiles
set role = 'admin', full_name = 'Raj', must_change_password = false
where id = '40c49264-3b32-4370-bee1-2138fa25c06f';
