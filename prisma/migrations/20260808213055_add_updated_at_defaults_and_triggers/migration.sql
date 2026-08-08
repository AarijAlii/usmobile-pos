-- @updatedAt in schema.prisma is a Prisma-Client-side-only feature — it never
-- becomes a DB-level default or trigger. Since runtime inserts/updates go
-- through the Supabase client (not Prisma Client, see schema.prisma header),
-- every updated_at column needs its own DB-level default (for INSERT) and a
-- trigger (to keep auto-updating on UPDATE, matching what @updatedAt would
-- have done if Prisma Client were writing these rows).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'stores', 'staff', 'customers', 'products',
    'inventory_units', 'stock_levels', 'sales', 'buyback_transactions',
    'repair_tickets'
  ]
  loop
    execute format('alter table public.%I alter column updated_at set default now();', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;