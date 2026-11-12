-- DEMO DATA so the website is not empty while you build. Run once in the SQL Editor AFTER 01_schema.sql.
-- Creates 10 properties (EN + AR), 2 off-plan, 1 project with a payment plan. No photos: upload real ones to the property-media bucket.
-- To remove the demo rows later: delete from public.properties where created_by is null;  (and the project HR1 / developer "Demo Developer")
do $$
declare
  r record; v_prop uuid; v_proj uuid; v_dev uuid; v_plan uuid;
  v_agent uuid := (select id from public.profiles where role = 'agent' order by created_at limit 1);
begin
  for r in select * from (values
    ('apartment','dubai-marina',2,3,1480,'sale',3450000,'AED',null,'Marina view two-bedroom','شقة بغرفتين وإطلالة على المارينا','Bright corner apartment on a high floor with full marina views, a large balcony and two parking spaces.','شقة زاوية مشرقة في طابق مرتفع بإطلالة كاملة على المارينا، مع شرفة واسعة وموقفين للسيارات.',true,false,25.0795,55.1415),
    ('apartment','downtown-dubai',2,2,1210,'rent',145000,'AED','yearly','Furnished city view two-bedroom','شقة مفروشة بإطلالة على المدينة','Fully furnished two-bedroom minutes from the boulevard, available for yearly rent with up to four cheques.','شقة مفروشة بالكامل بغرفتين على بعد دقائق من البوليفارد، متاحة للإيجار السنوي بأربع دفعات.',true,false,25.1962,55.2759),
    ('villa','saadiyat-island',4,5,4100,'sale',3380000,'USD',null,'Four-bedroom garden villa','فيلا بأربع غرف مع حديقة','Family villa near the beach with a private garden, maid''s room and covered parking.','فيلا عائلية قرب الشاطئ مع حديقة خاصة وغرفة خادمة ومواقف مغطاة.',true,false,24.5412,54.4312),
    ('studio','jumeirah-village-circle',0,1,450,'rent',48000,'AED','yearly','Modern studio in JVC','استوديو عصري في JVC','Efficient studio with a built-in kitchen, close to parks and schools.','استوديو عملي بمطبخ مدمج قريب من الحدائق والمدارس.',false,false,25.0612,55.2112),
    ('penthouse','palm-jumeirah',4,5,6200,'sale',18500000,'AED',null,'Palm Jumeirah penthouse','بنتهاوس نخلة جميرا','Sky penthouse with a private pool terrace and panoramic sea views.','بنتهاوس مرتفع مع تراس ومسبح خاص وإطلالة بانورامية على البحر.',true,false,25.1131,55.1401),
    ('apartment','business-bay',1,2,820,'rent',8500,'AED','monthly','Canal view one-bedroom','شقة بغرفة وإطلالة على القناة','Modern one-bedroom with canal view and flexible monthly rent.','شقة حديثة بغرفة نوم وإطلالة على القناة، مع إيجار شهري مرن.',false,false,25.1858,55.2632),
    ('townhouse','dubai-hills-estate',3,4,2650,'sale',4250000,'AED',null,'Dubai Hills townhouse','تاون هاوس في دبي هيلز','Off-plan townhouse in a green, family-friendly community with a flexible payment plan.','تاون هاوس على الخارطة في مجتمع أخضر مناسب للعائلات مع خطة دفع مرنة.',false,true,25.1061,55.2461),
    ('apartment','dubai-marina',1,2,790,'rent',78000,'AED','yearly','One-bedroom in Dubai Marina','شقة بغرفة في دبي مارينا','Well-kept one-bedroom steps from the marina walk, ideal for professionals.','شقة بغرفة نوم بحالة ممتازة على بعد خطوات من ممشى المارينا، مثالية للمهنيين.',false,false,25.0818,55.1389),
    ('apartment','downtown-dubai',3,4,2350,'sale',6200000,'AED',null,'Downtown three-bedroom','شقة بثلاث غرف في الداون تاون','Spacious three-bedroom with skyline views in the heart of the city.','شقة واسعة بثلاث غرف وإطلالة على الأفق في قلب المدينة.',false,false,25.1985,55.2731),
    ('studio','business-bay',0,1,430,'sale',1150000,'AED',null,'Business Bay studio','استوديو في الخليج التجاري','Off-plan studio with a smart layout and strong rental demand.','استوديو على الخارطة بتصميم ذكي وطلب إيجاري قوي.',false,true,25.1841,55.2608)
  ) as t(type, area, beds, baths, sqft, purpose, price, cur, period, title_en, title_ar, desc_en, desc_ar, featured, offplan, lat, lng)
  loop
    insert into public.properties (type, area_id, bedrooms, bathrooms, size_sqft, parking_spaces, floor_number, lat, lng, completion_status, furnishing)
    values (r.type::public.property_type, (select id from public.areas where code = r.area), r.beds, r.baths, r.sqft, 1, 12, r.lat, r.lng,
            case when r.offplan then 'off_plan'::public.completion_status else 'ready'::public.completion_status end,
            case when r.purpose = 'rent' and r.beds > 0 then 'furnished'::public.furnishing else null end)
    returning id into v_prop;

    insert into public.property_translations (property_id, locale, slug, title, description, meta_title, meta_description)
    select v_prop, 'en', trim(both '-' from lower(regexp_replace(r.title_en, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || lower(reference_code), r.title_en, r.desc_en, r.title_en || ' | JILO Real Estate', r.desc_en from public.properties where id = v_prop;
    insert into public.property_translations (property_id, locale, slug, title, description, meta_title, meta_description)
    select v_prop, 'ar', replace(r.title_ar, ' ', '-') || '-' || lower(reference_code), r.title_ar, r.desc_ar, r.title_ar || ' | جيلو العقارية', r.desc_ar from public.properties where id = v_prop;

    insert into public.property_amenities (property_id, amenity_id) select v_prop, id from public.amenities where code in ('pool','gym','parking','security','balcony');

    insert into public.listings (property_id, purpose, status, price, currency, price_period, cheques, agent_id, is_featured, permit_number)
    values (v_prop, r.purpose::public.listing_purpose, 'published', r.price, r.cur, r.period::public.rent_period,
            case when r.purpose = 'rent' and r.period = 'yearly' then 4 end, v_agent, r.featured, '1234' || floor(random() * 9000 + 1000)::int);

    -- off-plan townhouse becomes a unit of project HR1 with a 20/40/40 payment plan
    if r.offplan and r.type = 'townhouse' then
      insert into public.developers (slug_en, name_en, name_ar) values ('demo-developer', 'Demo Developer', 'مطور تجريبي') returning id into v_dev;
      insert into public.projects (code, developer_id, area_id, status, handover_date, completion_pct, lat, lng, starting_price, is_published)
        values ('HR1', v_dev, (select id from public.areas where code = r.area), 'under_construction', current_date + 700, 35, r.lat, r.lng, r.price, true) returning id into v_proj;
      insert into public.project_translations (project_id, locale, slug, name, tagline) values (v_proj, 'en', 'hills-residence', 'Hills Residence', 'Townhouses in Dubai Hills'), (v_proj, 'ar', 'هيلز-ريزيدنس', 'هيلز ريزيدنس', 'تاون هاوس في دبي هيلز');
      insert into public.payment_plans (project_id, name_en, name_ar) values (v_proj, '20/40/40', '20/40/40') returning id into v_plan;
      insert into public.payment_plan_milestones (payment_plan_id, sort_order, label_en, label_ar, percentage, trigger_type, due_offset_days) values
        (v_plan, 1, 'On booking', 'عند الحجز', 20, 'on_booking', 0), (v_plan, 2, 'During construction', 'أثناء البناء', 40, 'fixed_date', 180), (v_plan, 3, 'On handover', 'عند التسليم', 40, 'on_handover', null);
      insert into public.units (project_id, property_id, unit_number, unit_type, bedrooms, size_sqft, price, currency, payment_plan_id)
        values (v_proj, v_prop, 'TH-01', '3BR', r.beds, r.sqft, r.price, 'AED', v_plan);
    end if;
  end loop;
end $$;
