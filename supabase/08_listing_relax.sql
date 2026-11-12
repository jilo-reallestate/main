-- =====================================================================
--  JILO: relaxed listing form (run once, after 03_listing_rpc.sql)
--  Replaces save_listing(): nothing is required except the price.
--   - title optional (generated when empty), Arabic title optional (Arabic page shows the English text until one is added)
--   - area optional; the form sends area_name: any text. A name that does not exist yet creates a new area (admin only).
--  New key in p: area_name. area_code still works.
-- =====================================================================
create or replace function public.save_listing(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
  v_area uuid; v_prop uuid; v_ref text; v_list uuid; v_cur public.listing_status; v_status public.listing_status;
  v_intent text := coalesce(p ->> 'intent', 'save');
  v_agent uuid; v_area_name text := nullif(btrim(p ->> 'area_name'), ''); v_slug text; v_i int := 0;
  n  text := nullif(btrim(p ->> 'title_en'), '');
  na text := nullif(btrim(p ->> 'title_ar'), '');
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if nullif(btrim(p ->> 'price'), '') is null or (p ->> 'price')::numeric <= 0 then raise exception 'Price is required'; end if;

  -- Area: optional. Pick by code, or type any name. An unknown name becomes a new area (admin only, because areas are shared and public).
  select id into v_area from public.areas where code = nullif(p ->> 'area_code', '');
  if v_area is null and v_area_name is not null then
    select a.id into v_area from public.areas a join public.area_translations t on t.area_id = a.id
     where lower(t.name) = lower(v_area_name) order by a.is_active desc limit 1;
    if v_area is null then
      if not v_admin then raise exception 'This area is not in the list yet. Pick one from the suggestions, or ask an admin to add it'; end if;
      v_slug := btrim(regexp_replace(lower(v_area_name), '[^a-z0-9\u0621-\u064a]+', '-', 'g'), '-');
      if v_slug = '' then raise exception 'Area name is not valid'; end if;
      declare v_base text := v_slug; begin
        while exists (select 1 from public.areas where code = v_slug) or exists (select 1 from public.area_translations where slug = v_slug) loop
          v_i := v_i + 1; v_slug := v_base || '-' || v_i;
        end loop;
      end;
      insert into public.areas (code, level, country_code) values (v_slug, 'community', 'AE') returning id into v_area;
      insert into public.area_translations (area_id, locale, slug, name) values (v_area, 'en', v_slug, v_area_name), (v_area, 'ar', v_slug, v_area_name);
    end if;
  end if;

  -- Title: optional. Left empty, one is generated, e.g. "Apartment for sale in Dubai Marina".
  if n is null then
    n := initcap(replace(coalesce(nullif(p ->> 'type', ''), 'property'), '_', ' ')) || case when coalesce(p ->> 'purpose', 'sale') = 'rent' then ' for rent' else ' for sale' end
         || coalesce(' in ' || (select t.name from public.area_translations t where t.area_id = v_area order by (t.locale = 'en') desc limit 1), '');
  end if;

  if nullif(p ->> 'listing_id', '') is not null then
    v_list := (p ->> 'listing_id')::uuid;
    select property_id, status into v_prop, v_cur from public.listings where id = v_list;
    if v_prop is null then raise exception 'Listing not found or not yours'; end if;
    update public.properties set
      type = (p ->> 'type')::public.property_type, area_id = v_area, building_name = nullif(p ->> 'building_name', ''),
      bedrooms = nullif(p ->> 'bedrooms', '')::smallint, bathrooms = nullif(p ->> 'bathrooms', '')::smallint,
      size_sqft = nullif(p ->> 'size_sqft', '')::numeric, plot_sqft = nullif(p ->> 'plot_sqft', '')::numeric,
      floor_number = nullif(p ->> 'floor_number', '')::int, parking_spaces = nullif(p ->> 'parking_spaces', '')::smallint,
      furnishing = nullif(p ->> 'furnishing', '')::public.furnishing, view_type = nullif(p ->> 'view_type', ''),
      completion_status = coalesce(nullif(p ->> 'completion_status', ''), 'ready')::public.completion_status,
      lat = nullif(p ->> 'lat', '')::numeric, lng = nullif(p ->> 'lng', '')::numeric
    where id = v_prop;
    if not found then raise exception 'You cannot edit this property'; end if;
  else
    insert into public.properties (type, area_id, building_name, bedrooms, bathrooms, size_sqft, plot_sqft, floor_number, parking_spaces, furnishing, view_type, completion_status, lat, lng, created_by)
    values ((p ->> 'type')::public.property_type, v_area, nullif(p ->> 'building_name', ''), nullif(p ->> 'bedrooms', '')::smallint, nullif(p ->> 'bathrooms', '')::smallint,
            nullif(p ->> 'size_sqft', '')::numeric, nullif(p ->> 'plot_sqft', '')::numeric, nullif(p ->> 'floor_number', '')::int, nullif(p ->> 'parking_spaces', '')::smallint,
            nullif(p ->> 'furnishing', '')::public.furnishing, nullif(p ->> 'view_type', ''), coalesce(nullif(p ->> 'completion_status', ''), 'ready')::public.completion_status,
            nullif(p ->> 'lat', '')::numeric, nullif(p ->> 'lng', '')::numeric, v_uid)
    returning id into v_prop;
  end if;
  select reference_code into v_ref from public.properties where id = v_prop;

  insert into public.property_translations (property_id, locale, slug, title, description, meta_title, meta_description)
  values (v_prop, 'en', coalesce(nullif(p ->> 'slug_en', ''), 'property') || '-' || lower(v_ref), n, nullif(p ->> 'desc_en', ''), n || ' | JILO Real Estate', left(nullif(p ->> 'desc_en', ''), 160))
  on conflict (property_id, locale) do update set title = excluded.title, description = excluded.description, meta_title = excluded.meta_title, meta_description = excluded.meta_description;
  if na is not null then
    insert into public.property_translations (property_id, locale, slug, title, description, meta_title, meta_description)
    values (v_prop, 'ar', coalesce(nullif(p ->> 'slug_ar', ''), 'عقار') || '-' || lower(v_ref), na, nullif(p ->> 'desc_ar', ''), na || ' | جيلو العقارية', left(nullif(p ->> 'desc_ar', ''), 160))
    on conflict (property_id, locale) do update set title = excluded.title, description = excluded.description, meta_title = excluded.meta_title, meta_description = excluded.meta_description;
  else
    insert into public.property_translations (property_id, locale, slug, title, description, meta_title, meta_description)
    values (v_prop, 'ar', 'عقار-' || lower(v_ref), n, nullif(p ->> 'desc_en', ''), n || ' | جيلو العقارية', left(nullif(p ->> 'desc_en', ''), 160))
    on conflict (property_id, locale) do nothing;
  end if;

  delete from public.property_amenities where property_id = v_prop;
  insert into public.property_amenities (property_id, amenity_id)
    select v_prop, a.id from public.amenities a where a.code in (select jsonb_array_elements_text(coalesce(p -> 'amenities', '[]'::jsonb)));

  v_status := case
    when v_intent = 'submit' then (case when v_admin then 'published' else 'pending_review' end)::public.listing_status
    else coalesce(v_cur, 'draft'::public.listing_status) end;
  v_agent := case when v_admin and nullif(p ->> 'agent_id', '') is not null then (p ->> 'agent_id')::uuid else v_uid end;

  if v_list is null then
    insert into public.listings (property_id, purpose, status, price, currency, price_period, cheques, deposit_amount, permit_number, agent_id)
    values (v_prop, (p ->> 'purpose')::public.listing_purpose, v_status, (p ->> 'price')::numeric, coalesce(nullif(p ->> 'currency', ''), 'AED'),
            nullif(p ->> 'price_period', '')::public.rent_period, nullif(p ->> 'cheques', '')::smallint, nullif(p ->> 'deposit_amount', '')::numeric, nullif(p ->> 'permit_number', ''), v_agent)
    returning id into v_list;
  else
    update public.listings set purpose = (p ->> 'purpose')::public.listing_purpose, status = v_status, price = (p ->> 'price')::numeric,
      currency = coalesce(nullif(p ->> 'currency', ''), 'AED'), price_period = nullif(p ->> 'price_period', '')::public.rent_period,
      cheques = nullif(p ->> 'cheques', '')::smallint, deposit_amount = nullif(p ->> 'deposit_amount', '')::numeric, permit_number = nullif(p ->> 'permit_number', ''),
      agent_id = case when v_admin then v_agent else agent_id end
    where id = v_list;
  end if;
  return jsonb_build_object('listing_id', v_list, 'property_id', v_prop, 'reference_code', v_ref, 'status', v_status);
end $$;
revoke execute on function public.save_listing(jsonb) from public, anon;
grant  execute on function public.save_listing(jsonb) to authenticated;
