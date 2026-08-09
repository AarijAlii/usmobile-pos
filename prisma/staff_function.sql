-- USMobile POS — self-service profile update
--
-- Not run automatically; fold into a migration once applying against a live
-- Supabase project (same process as prisma/rls_policies.sql,
-- prisma/buyback_function.sql, prisma/layaway_function.sql, and
-- prisma/return_function.sql).
--
-- staff_update_admin_only (see prisma/rls_policies.sql) requires OWNER/ADMIN
-- for ANY update to the staff table — including a staff member updating
-- their own row — because RLS is row-scoped, not column-scoped: a policy
-- that let a caller update "their own row" would also let that caller set
-- their own role or store_id, which is a privilege-escalation path. So
-- self-service profile editing can't be a relaxed RLS policy; it has to be
-- a SECURITY DEFINER function whose body is the only thing narrowing what
-- can change — here, exactly one column (full_name), on exactly one row
-- (auth.uid()'s own). Nothing else is reachable through this function no
-- matter what the caller passes in.

create or replace function public.update_own_display_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'Full name cannot be empty';
  end if;

  update public.staff
  set full_name = trim(p_full_name)
  where id = auth.uid()::text;
end;
$$;

grant execute on function public.update_own_display_name(text) to authenticated;
