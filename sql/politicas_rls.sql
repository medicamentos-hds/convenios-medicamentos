-- Políticas RLS para permitir lectura e inserción pública desde el sitio
-- estático (usando la anon key). Ejecutar en el SQL Editor de Supabase.

-- ===== medicamento =====
alter table medicamento enable row level security;

create policy "medicamento_select_publico"
on medicamento for select
using (true);

create policy "medicamento_insert_publico"
on medicamento for insert
with check (true);

-- ===== convenio_act =====
alter table convenio_act enable row level security;

create policy "convenio_act_select_publico"
on convenio_act for select
using (true);

create policy "convenio_act_insert_publico"
on convenio_act for insert
with check (true);

-- ===== convenio_nuevo =====
alter table convenio_nuevo enable row level security;

create policy "convenio_nuevo_select_publico"
on convenio_nuevo for select
using (true);

create policy "convenio_nuevo_insert_publico"
on convenio_nuevo for insert
with check (true);

-- ===== proveedor =====
alter table proveedor enable row level security;

create policy "proveedor_select_publico"
on proveedor for select
using (true);

create policy "proveedor_insert_publico"
on proveedor for insert
with check (true);

-- ===== user =====
-- "user" es palabra reservada en Postgres, por eso va siempre entre comillas.
alter table public."user" enable row level security;

create policy "user_select_publico"
on public."user" for select
using (true);

