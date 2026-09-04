-- ═══════════════════════════════════════════════════════════════════════════
-- 003_storage.sql — Bucket privado para las fotos de garrapatas
--
-- Ruta de cada archivo: {empresa_id}/{animal_id}/{conteo_id}.{ext}
-- El primer segmento del path es lo que la politica compara contra la empresa
-- del usuario, asi que el bucket queda particionado por empresa.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

-- El limite de peso y los tipos permitidos se hacen cumplir del lado del
-- servidor, no solo en el navegador: con su sesion legitima, cualquiera
-- podria subir un archivo de cualquier tipo y tamano a su propia carpeta
-- usando el cliente de Supabase desde la consola.
update storage.buckets
set
  -- 15 MB, el mismo numero que muestra la pantalla de carga
  file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'fotos';

-- El bucket es privado: las previews se sirven con signed URLs desde el cliente.
drop policy if exists "Fotos de mi empresa" on storage.objects;
create policy "Fotos de mi empresa" on storage.objects for all to authenticated
  using (
    bucket_id = 'fotos'
    and (es_super_admin() or (storage.foldername(name))[1] = mi_empresa_id()::text)
  )
  with check (
    bucket_id = 'fotos'
    and (es_super_admin() or (storage.foldername(name))[1] = mi_empresa_id()::text)
  );
