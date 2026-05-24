create table if not exists public.dw_study_notes (
    id text primary key,
    passcode text not null,
    content text not null default '',
    updated_at timestamptz not null default now()
);

alter table public.dw_study_notes enable row level security;

drop policy if exists "dw notes shared select" on public.dw_study_notes;
create policy "dw notes shared select"
on public.dw_study_notes
for select
to anon
using (passcode = 'data-warehouse-shared');

drop policy if exists "dw notes shared insert" on public.dw_study_notes;
create policy "dw notes shared insert"
on public.dw_study_notes
for insert
to anon
with check (passcode = 'data-warehouse-shared');

drop policy if exists "dw notes shared update" on public.dw_study_notes;
create policy "dw notes shared update"
on public.dw_study_notes
for update
to anon
using (passcode = 'data-warehouse-shared')
with check (passcode = 'data-warehouse-shared');

drop policy if exists "dw notes shared delete" on public.dw_study_notes;
create policy "dw notes shared delete"
on public.dw_study_notes
for delete
to anon
using (passcode = 'data-warehouse-shared');
