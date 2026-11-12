-- =====================================================================
--  JILO: admins add amenities themselves (run once, after 01_schema.sql)
--  add_amenity(): creates an amenity from a name, with a unique code. Runs as the caller, so only an admin
--  can use it (amenities are shared by all listings). Adding a name that already exists returns the existing one.
--  The Arabic name is optional; when empty, the English name is used until one is added.
-- =====================================================================
create or replace function public.add_amenity(p_name_en text, p_name_ar text default null) returns jsonb
language plpgsql set search_path = '' as $$
declare
  en text := nullif(btrim(p_name_en), ''); ar text := nullif(btrim(p_name_ar), ''); v_base text; v_code text; v_i int := 0; r record;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Only an admin can add amenities'; end if;
  if en is null and ar is null then raise exception 'Amenity name is required'; end if;
  en := coalesce(en, ar); ar := coalesce(ar, en);
  if char_length(en) > 60 or char_length(ar) > 60 then raise exception 'Amenity name is too long (max 60 characters)'; end if;

  select code, name_en, name_ar into r from public.amenities where lower(name_en) = lower(en) or lower(name_ar) = lower(ar) limit 1;
  if found then return jsonb_build_object('code', r.code, 'name_en', r.name_en, 'name_ar', r.name_ar, 'existing', true); end if;

  v_base := coalesce(nullif(btrim(regexp_replace(lower(en), '[^a-z0-9]+', '_', 'g'), '_'), ''), 'amenity');
  v_code := v_base;
  while exists (select 1 from public.amenities where code = v_code) loop v_i := v_i + 1; v_code := v_base || '_' || v_i; end loop;

  insert into public.amenities (code, name_en, name_ar, category, sort_order)
  values (v_code, en, ar, 'general', coalesce((select max(sort_order) from public.amenities), 0) + 1);
  return jsonb_build_object('code', v_code, 'name_en', en, 'name_ar', ar, 'existing', false);
end $$;
revoke execute on function public.add_amenity(text, text) from public, anon;
grant  execute on function public.add_amenity(text, text) to authenticated;
