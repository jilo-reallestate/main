-- =====================================================================
--  JILO: save_listing()  (run once, after 01_schema.sql)
--  One atomic call used by the listing form: creates or updates the property, its EN/AR text,
--  amenities and the listing. Runs as the CALLER (security invoker), so Row Level Security and the
--  publish-approval trigger still apply: an agent can only touch their own listings and cannot publish.
--
--  p (jsonb) keys: listing_id (omit to create), intent ('save' | 'submit'), area_code, type, purpose,
--  bedrooms, bathrooms, size_sqft, plot_sqft, floor_number, parking_spaces, furnishing, view_type, building_name,
--  completion_status, lat, lng, price, currency, price_period, cheques, deposit_amount, permit_number,
--  agent_id (admin only), amenities (array of codes), title_en, desc_en, title_ar, desc_ar, slug_en, slug_ar
--  (slug_* = base text; the property reference code is appended so slugs are unique)
-- =====================================================================
create or replace function public.save_listing(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
  v_area uuid; v_prop uuid; v_ref text; v_list uuid; v_cur public.listing_status; v_status public.listing_status;
  v_intent text := coalesce(p ->> 'intent', 'save');
  v_agent uuid;
  n  text := nullif(btrim(p ->> 'title_en'), '');
  na text := nullif(btrim(p ->> 'title_ar'), '');
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if n is null then raise exception 'English title is required'; end if;
  if (p ->> 'price') is null or (p ->> 'price')::numeric <= 0 then raise exception 'Price is required'; end if;
  if v_intent = 'submit' then
    if na is null then raise exception 'Arabic title is required to submit a listing'; end if;
    if (p ->> 'area_code') is null or p ->> 'area_code' = '' then raise exception 'Area is required to submit a listing'; end if;
  end if;

  select id into v_area from public.areas where code = nullif(p ->> 'area_code', '');

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
