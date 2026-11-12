-- =====================================================================
--  JILO: off-plan module (run once, after 01, 03, 04, 05, 06)
--  No new tables. Adds: one column, guards, policies and atomic functions.
--  Functions run as the CALLER (security invoker) so Row Level Security applies,
--  except the two small helpers marked "definer".
--   reserve_unit / cancel_reservation / extend_reservation / convert_reservation
--   save_project / import_units / save_payment_plan / assign_payment_plan
--   record_installment_payment
-- =====================================================================

-- 1. Traceability: which deal a reservation became
alter table public.unit_reservations add column if not exists deal_id uuid references public.deals(id) on delete set null;

-- 2. Reservations can only change through the functions below (an agent could otherwise
--    insert with any expires_at, or flip status by hand). Admin, cron and SQL editor are unaffected.
create or replace function public.reservations_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin()
     and coalesce(current_setting('jilo.rpc', true), '') <> 'reservation' then
    raise exception 'Use the reservation actions (reserve, extend, cancel, convert)';
  end if;
  return new;
end $$;
drop trigger if exists trg_aa_reservations_guard on public.unit_reservations;
create trigger trg_aa_reservations_guard before insert or update on public.unit_reservations
  for each row execute function public.reservations_guard();   -- "aa" so it runs before trg_reservations_before

-- 3. Keep units.reserved_until in step when a reservation is extended (definer: agents cannot write units)
create or replace function public.reservations_sync_unit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and new.expires_at is distinct from old.expires_at then
    update public.units set reserved_until = new.expires_at where id = new.unit_id and status = 'reserved';
  end if;
  return null;
end $$;
drop trigger if exists trg_reservations_sync on public.unit_reservations;
create trigger trg_reservations_sync after update of expires_at on public.unit_reservations
  for each row execute function public.reservations_sync_unit();

-- 4. Expire overdue reservations (definer). Called hourly by cron, and by reserve_unit for the unit in question,
--    so an expired hold never blocks a new reservation even if cron is off. The existing AFTER trigger frees the unit.
create or replace function public.expire_due_reservations(p_unit uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if (select auth.uid()) is not null and not public.is_staff() then raise exception 'Not allowed'; end if;
  perform set_config('jilo.rpc', 'reservation', true);
  update public.unit_reservations set status = 'expired'
   where status = 'active' and expires_at < now() and (p_unit is null or unit_id = p_unit);
  get diagnostics n = row_count;
  return n;
end $$;

-- 5. Reserve a unit for a lead (starts the timer: setting reservation_hours, default 48)
create or replace function public.reserve_unit(p_unit uuid, p_lead uuid, p_notes text default null) returns jsonb
language plpgsql set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); l record; u record; v_agent uuid; v_id uuid; v_exp timestamptz;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  select id, contact_id, assigned_agent_id into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found or not yours'; end if;
  select id, unit_number into u from public.units where id = p_unit;
  if not found then raise exception 'Unit not found'; end if;
  v_agent := case when public.is_admin() then coalesce(l.assigned_agent_id, v_uid) else v_uid end;

  perform set_config('jilo.rpc', 'reservation', true);
  perform public.expire_due_reservations(p_unit);
  begin
    insert into public.unit_reservations (unit_id, contact_id, lead_id, agent_id, notes)
    values (p_unit, l.contact_id, p_lead, v_agent, nullif(btrim(coalesce(p_notes, '')), ''))
    returning id, expires_at into v_id, v_exp;
  exception when unique_violation then
    raise exception 'This unit is already reserved';
  end;
  insert into public.activities (lead_id, contact_id, type, summary, created_by)
  values (p_lead, l.contact_id, 'system', 'Unit ' || u.unit_number || ' reserved until ' || to_char(v_exp at time zone 'Asia/Dubai', 'DD Mon YYYY HH24:MI'), v_uid);
  return jsonb_build_object('reservation_id', v_id, 'expires_at', v_exp);
end $$;

-- 6. Cancel an active reservation (the existing trigger frees the unit)
create or replace function public.cancel_reservation(p_id uuid) returns void
language plpgsql set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r record;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  perform set_config('jilo.rpc', 'reservation', true);
  update public.unit_reservations set status = 'cancelled' where id = p_id and status = 'active'
  returning lead_id, contact_id, unit_id into r;
  if not found then raise exception 'Active reservation not found'; end if;
  if r.lead_id is not null then
    insert into public.activities (lead_id, contact_id, type, summary, created_by)
    values (r.lead_id, r.contact_id, 'system', 'Unit reservation cancelled', v_uid);
  end if;
end $$;

-- 7. Extend by 1..72 hours. Agents are capped at reservation_max_hours (default 168 = 7 days) in total.
create or replace function public.extend_reservation(p_id uuid, p_hours int) returns timestamptz
language plpgsql set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r record; v_new timestamptz;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_hours is null or p_hours not between 1 and 72 then raise exception 'Extension must be between 1 and 72 hours'; end if;
  select * into r from public.unit_reservations where id = p_id and status = 'active' for update;
  if not found then raise exception 'Active reservation not found'; end if;
  if r.expires_at <= now() then raise exception 'This reservation has already expired. Reserve the unit again.'; end if;
  v_new := r.expires_at + make_interval(hours => p_hours);
  if not public.is_admin() and v_new > r.reserved_at + make_interval(hours => public.setting_int('reservation_max_hours', 168)) then
    raise exception 'Maximum reservation time reached';
  end if;
  perform set_config('jilo.rpc', 'reservation', true);
  update public.unit_reservations set expires_at = v_new where id = p_id;
  return v_new;
end $$;

-- 8. Convert an active reservation into an off-plan deal AND generate the buyer installments, all or nothing.
--    p_plan defaults to the plan assigned to the unit. Only an admin may change the price.
create or replace function public.convert_reservation(p_id uuid, p_plan uuid default null, p_price numeric default null, p_start date default current_date) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); r record; u record; pl record; v_contact uuid; v_price numeric; v_deal uuid; v_n int; v_sum numeric; v_planid uuid;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into r from public.unit_reservations where id = p_id and status = 'active' for update;
  if not found then raise exception 'Active reservation not found'; end if;
  if r.expires_at <= now() then raise exception 'This reservation has expired. Reserve the unit again.'; end if;

  select id, project_id, unit_number, price, currency, payment_plan_id into u from public.units where id = r.unit_id;
  v_contact := coalesce(r.contact_id, (select contact_id from public.leads where id = r.lead_id));
  if v_contact is null then raise exception 'The reservation has no buyer'; end if;

  v_planid := coalesce(p_plan, u.payment_plan_id);
  if v_planid is null then raise exception 'Assign a payment plan to this unit first'; end if;
  select id, project_id, is_active into pl from public.payment_plans where id = v_planid;
  if not found or not pl.is_active then raise exception 'Payment plan not found or inactive'; end if;
  if pl.project_id is not null and pl.project_id <> u.project_id then raise exception 'This payment plan belongs to another project'; end if;
  if exists (select 1 from public.payment_plan_milestones where payment_plan_id = v_planid and trigger_type in ('on_handover','post_handover'))
     and (select handover_date from public.projects where id = u.project_id) is null then
    raise exception 'Set the project handover date before using a plan with handover milestones';
  end if;

  v_price := coalesce(p_price, u.price);
  if v_price is distinct from u.price and not public.is_admin() then raise exception 'Only an admin can change the price'; end if;
  if v_price <= 0 then raise exception 'Price must be greater than zero'; end if;

  insert into public.deals (lead_id, contact_id, unit_id, agent_id, type, status, price, currency, created_by)
  values (r.lead_id, v_contact, r.unit_id, r.agent_id, 'offplan_sale', 'reserved', v_price, u.currency, v_uid)
  returning id into v_deal;
  insert into public.deal_parties (deal_id, contact_id, role) values (v_deal, v_contact, 'buyer');

  perform set_config('jilo.rpc', 'reservation', true);
  update public.unit_reservations set status = 'converted', deal_id = v_deal where id = p_id;   -- trigger sets the unit to 'booked'

  v_n := public.generate_deal_installments(v_deal, v_planid, p_start);
  select coalesce(sum(amount), 0) into v_sum from public.deal_installments where deal_id = v_deal;
  if v_sum <> v_price then raise exception 'Installments (%) do not add up to the price (%)', v_sum, v_price; end if;

  insert into public.activities (lead_id, contact_id, deal_id, type, summary, created_by)
  values (r.lead_id, v_contact, v_deal, 'system', 'Unit ' || u.unit_number || ' converted to a deal with ' || v_n || ' installments', v_uid);
  return jsonb_build_object('deal_id', v_deal, 'installments', v_n);
end $$;

-- 9. Project + EN/AR text in one step (admin). Publishing needs both languages (name and slug).
create or replace function public.save_project(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid; v_code text; v_area uuid; v_pub boolean := coalesce((p ->> 'is_published')::boolean, false);
  loc text; t jsonb; v_slug text;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not allowed'; end if;
  if v_pub then
    foreach loc in array array['en','ar'] loop
      if btrim(coalesce(p #>> array['tr', loc, 'name'], '')) = '' or btrim(coalesce(p #>> array['tr', loc, 'slug'], '')) = '' then
        raise exception 'Publish needs a name and a slug in both English and Arabic';
      end if;
    end loop;
  end if;
  if nullif(p ->> 'area_code', '') is not null then
    select id into v_area from public.areas where code = p ->> 'area_code';
    if not found then raise exception 'Unknown area'; end if;
  end if;

  if v_id is null then
    v_code := 'PRJ-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into public.projects (code, created_by) values (v_code, (select auth.uid())) returning id into v_id;
  else
    select code into v_code from public.projects where id = v_id;
    if not found then raise exception 'Project not found'; end if;
  end if;

  update public.projects set
    developer_id = nullif(p ->> 'developer_id', '')::uuid, area_id = v_area,
    status = coalesce(nullif(p ->> 'status', ''), 'upcoming')::public.project_status,
    launch_date = nullif(p ->> 'launch_date', '')::date, handover_date = nullif(p ->> 'handover_date', '')::date,
    completion_pct = coalesce(nullif(p ->> 'completion_pct', '')::smallint, 0),
    lat = nullif(p ->> 'lat', '')::numeric, lng = nullif(p ->> 'lng', '')::numeric,
    brochure_url = nullif(p ->> 'brochure_url', ''), cover_url = nullif(p ->> 'cover_url', ''), permit_number = nullif(p ->> 'permit_number', ''),
    is_published = v_pub, is_featured = coalesce((p ->> 'is_featured')::boolean, false)
  where id = v_id;

  foreach loc in array array['en','ar'] loop
    t := p -> 'tr' -> loc;
    continue when t is null or btrim(coalesce(t ->> 'name', '')) = '';
    v_slug := btrim(coalesce(t ->> 'slug', ''));
    if v_slug = '' then raise exception 'Slug is required (%)', loc; end if;
    if exists (select 1 from public.project_translations where locale = loc and slug = v_slug and project_id <> v_id) then
      v_slug := v_slug || '-' || lower(v_code);
    end if;
    insert into public.project_translations (project_id, locale, slug, name, tagline, description, meta_title, meta_description)
    values (v_id, loc, v_slug, btrim(t ->> 'name'), nullif(t ->> 'tagline', ''), nullif(t ->> 'description', ''), nullif(t ->> 'meta_title', ''), nullif(t ->> 'meta_description', ''))
    on conflict (project_id, locale) do update set slug = excluded.slug, name = excluded.name, tagline = excluded.tagline,
      description = excluded.description, meta_title = excluded.meta_title, meta_description = excluded.meta_description;
  end loop;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- 10. Bulk unit import. p_commit=false returns the validation preview (same rules as the real import);
--     p_commit=true inserts only if EVERY row is valid. Errors are codes (the UI translates them). Admin only.
create or replace function public.import_units(p_project uuid, p_rows jsonb, p_commit boolean default false) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r jsonb; ord int; errs text[]; v_out jsonb := '[]'::jsonb; seen text[] := '{}'; v_bad int := 0; v_good int := 0;
  v_num text; v_price text; v_size text; v_beds text; v_status text; v_type text;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.projects where id = p_project) then raise exception 'Project not found'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'No rows'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'Too many rows (max 2000 per import)'; end if;

  for r, ord in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    errs := '{}';
    v_num    := btrim(coalesce(r ->> 'unit_number', ''));
    v_type   := nullif(btrim(coalesce(r ->> 'unit_type', '')), '');
    v_beds   := btrim(coalesce(r ->> 'bedrooms', ''));
    v_size   := replace(btrim(coalesce(r ->> 'size_sqft', '')), ',', '');
    v_price  := replace(btrim(coalesce(r ->> 'price', '')), ',', '');
    v_status := lower(coalesce(nullif(btrim(coalesce(r ->> 'status', '')), ''), 'available'));

    if v_num = '' then errs := errs || 'unit_number_required';
    elsif char_length(v_num) > 40 then errs := errs || 'unit_number_too_long';
    elsif lower(v_num) = any(seen) then errs := errs || 'duplicate_in_file';
    elsif exists (select 1 from public.units where project_id = p_project and lower(unit_number) = lower(v_num)) then errs := errs || 'already_exists';
    end if;
    if v_num <> '' then seen := seen || lower(v_num); end if;
    if v_beds <> '' and v_beds !~ '^[0-9]{1,2}$' then errs := errs || 'bad_bedrooms'; end if;
    if v_size <> '' and (v_size !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' or v_size::numeric <= 0) then errs := errs || 'bad_size'; end if;
    if v_price = '' then errs := errs || 'price_required';
    elsif v_price !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' or v_price::numeric <= 0 then errs := errs || 'bad_price'; end if;
    if v_status not in ('available','blocked','booked','sold') then errs := errs || 'bad_status'; end if;

    if cardinality(errs) > 0 then v_bad := v_bad + 1; else v_good := v_good + 1; end if;
    v_out := v_out || jsonb_build_object('line', ord, 'unit_number', v_num, 'unit_type', v_type, 'bedrooms', nullif(v_beds, ''),
                                          'size_sqft', nullif(v_size, ''), 'price', nullif(v_price, ''), 'status', v_status, 'errors', to_jsonb(errs));
  end loop;

  if p_commit and v_bad = 0 then
    insert into public.units (project_id, unit_number, unit_type, bedrooms, size_sqft, price, status)
    select p_project, e ->> 'unit_number', e ->> 'unit_type', nullif(e ->> 'bedrooms', '')::smallint, nullif(e ->> 'size_sqft', '')::numeric,
           (e ->> 'price')::numeric, (e ->> 'status')::public.unit_status
    from jsonb_array_elements(v_out) e;
  end if;
  return jsonb_build_object('valid', v_good, 'invalid', v_bad, 'inserted', case when p_commit and v_bad = 0 then v_good else 0 end, 'rows', v_out);
end $$;

-- 11. Payment plan builder: milestones must total exactly 100. project_id null = reusable template.
create or replace function public.save_payment_plan(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid; m jsonb; ord int; v_total numeric := 0; v_n int; v_trig text;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not allowed'; end if;
  if btrim(coalesce(p ->> 'name_en', '')) = '' then raise exception 'Plan name is required'; end if;
  v_n := case when jsonb_typeof(p -> 'milestones') = 'array' then jsonb_array_length(p -> 'milestones') else 0 end;
  if v_n = 0 then raise exception 'Add at least one milestone'; end if;
  for m in select value from jsonb_array_elements(p -> 'milestones') loop
    v_total := v_total + coalesce(nullif(m ->> 'percentage', '')::numeric, 0);
  end loop;
  if v_total <> 100 then raise exception 'Milestones must total 100 percent (now %)', v_total; end if;

  if v_id is null then
    insert into public.payment_plans (project_id, name_en, name_ar, description_en, description_ar, is_active)
    values (nullif(p ->> 'project_id', '')::uuid, btrim(p ->> 'name_en'), nullif(p ->> 'name_ar', ''), nullif(p ->> 'description_en', ''), nullif(p ->> 'description_ar', ''), coalesce((p ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.payment_plans set name_en = btrim(p ->> 'name_en'), name_ar = nullif(p ->> 'name_ar', ''),
      description_en = nullif(p ->> 'description_en', ''), description_ar = nullif(p ->> 'description_ar', ''), is_active = coalesce((p ->> 'is_active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Plan not found'; end if;
  end if;

  for m, ord in select value, ordinality from jsonb_array_elements(p -> 'milestones') with ordinality loop
    v_trig := coalesce(nullif(m ->> 'trigger_type', ''), 'fixed_date');
    if v_trig <> all (enum_range(null::public.milestone_trigger)::text[]) then raise exception 'Invalid milestone type on row %', ord; end if;
    if btrim(coalesce(m ->> 'label_en', '')) = '' then raise exception 'Milestone % needs a label', ord; end if;
    if coalesce(nullif(m ->> 'percentage', '')::numeric, 0) <= 0 then raise exception 'Milestone % needs a percentage above 0', ord; end if;
    if v_trig = 'fixed_date' and nullif(m ->> 'fixed_date', '') is null then raise exception 'Milestone % needs a date', ord; end if;
    if v_trig in ('construction_stage','post_handover') and nullif(m ->> 'fixed_date', '') is null and nullif(m ->> 'due_offset_days', '') is null then
      raise exception 'Milestone % needs a date or a number of days', ord;
    end if;
    insert into public.payment_plan_milestones (payment_plan_id, sort_order, label_en, label_ar, percentage, trigger_type, due_offset_days, fixed_date, construction_stage)
    values (v_id, ord, btrim(m ->> 'label_en'), nullif(m ->> 'label_ar', ''), (m ->> 'percentage')::numeric, v_trig::public.milestone_trigger,
            nullif(m ->> 'due_offset_days', '')::int, nullif(m ->> 'fixed_date', '')::date, nullif(m ->> 'construction_stage', ''))
    on conflict (payment_plan_id, sort_order) do update set label_en = excluded.label_en, label_ar = excluded.label_ar, percentage = excluded.percentage,
      trigger_type = excluded.trigger_type, due_offset_days = excluded.due_offset_days, fixed_date = excluded.fixed_date, construction_stage = excluded.construction_stage;
  end loop;
  delete from public.payment_plan_milestones where payment_plan_id = v_id and sort_order > v_n;   -- ids of kept rows are preserved
  return v_id;
end $$;

-- 12. Assign (or clear, with null) a plan on many units at once. A project plan can only go on units of its own project.
create or replace function public.assign_payment_plan(p_plan uuid, p_unit_ids uuid[]) returns int
language plpgsql set search_path = '' as $$
declare n int; v_proj uuid;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_plan is not null then
    select project_id into v_proj from public.payment_plans where id = p_plan;
    if not found then raise exception 'Plan not found'; end if;
    if v_proj is not null and exists (select 1 from public.units where id = any(p_unit_ids) and project_id <> v_proj) then
      raise exception 'This plan belongs to another project';
    end if;
  end if;
  update public.units set payment_plan_id = p_plan where id = any(p_unit_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- 13. Record a payment against an installment (admin). The existing triggers freeze the exchange rate
--     and recompute paid amount and status. Overpaying is refused; the installment row is locked first.
create or replace function public.record_installment_payment(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); i record; v_contact uuid; v_amt numeric; v_method text; v_paid timestamptz; v_id uuid;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Only an admin can record payments'; end if;
  select * into i from public.deal_installments where id = (p ->> 'installment_id')::uuid for update;
  if not found then raise exception 'Installment not found'; end if;
  if i.status = 'waived' then raise exception 'This installment was waived'; end if;
  select contact_id into v_contact from public.deals where id = i.deal_id;
  v_amt := round(nullif(p ->> 'amount', '')::numeric, 2);
  if v_amt is null or v_amt <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if v_amt > i.amount - i.paid_amount then raise exception 'Amount exceeds the outstanding balance (%)', i.amount - i.paid_amount; end if;
  v_method := coalesce(nullif(p ->> 'method', ''), 'bank_transfer');
  if v_method <> all (enum_range(null::public.payment_method)::text[]) then raise exception 'Invalid payment method'; end if;
  v_paid := coalesce(nullif(p ->> 'paid_at', '')::timestamptz, now());
  if v_paid > now() + interval '1 day' then raise exception 'Payment date cannot be in the future'; end if;

  insert into public.payments (contact_id, deal_id, deal_installment_id, amount, currency, method, status, reference, paid_at, received_by, notes)
  values (v_contact, i.deal_id, i.id, v_amt, i.currency, v_method::public.payment_method, 'completed', nullif(btrim(coalesce(p ->> 'reference', '')), ''), v_paid, v_uid, nullif(btrim(coalesce(p ->> 'notes', '')), ''))
  returning id into v_id;
  select * into i from public.deal_installments where id = i.id;
  return jsonb_build_object('payment_id', v_id, 'status', i.status, 'paid_amount', i.paid_amount);
end $$;

-- 14. Projects show "from AED x": keep starting_price = cheapest AVAILABLE unit (definer: runs on unit changes)
create or replace function public.refresh_project_price() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  foreach pid in array array[case when tg_op <> 'DELETE' then new.project_id end, case when tg_op <> 'INSERT' then old.project_id end] loop
    continue when pid is null;
    update public.projects pr set starting_price = (select min(u.price) from public.units u where u.project_id = pid and u.status = 'available' and u.price > 0)
     where pr.id = pid and pr.starting_price is distinct from (select min(u.price) from public.units u where u.project_id = pid and u.status = 'available' and u.price > 0);
  end loop;
  return null;
end $$;
drop trigger if exists trg_units_price on public.units;
create trigger trg_units_price after insert or delete or update of price, status, project_id on public.units
  for each row execute function public.refresh_project_price();

-- 15. Row Level Security additions (no new tables, so admin_all / active_only already cover everything)
drop policy if exists client_select on public.unit_reservations;
create policy client_select on public.unit_reservations for select to authenticated using (contact_id in (select public.my_contact_ids()));

-- a buyer can still see the unit and project of their own reservation/deal, even if the project is later unpublished
drop policy if exists client_select on public.units;
create policy client_select on public.units for select to authenticated using (
  id in (select unit_id from public.deals where contact_id in (select public.my_contact_ids()))
  or id in (select unit_id from public.unit_reservations where contact_id in (select public.my_contact_ids())));
drop policy if exists client_select on public.projects;
create policy client_select on public.projects for select to authenticated using (exists (select 1 from public.units u where u.project_id = projects.id));
drop policy if exists client_select on public.project_translations;
create policy client_select on public.project_translations for select to authenticated using (exists (select 1 from public.units u where u.project_id = project_translations.project_id));

-- reusable (template) plans become publicly readable once a unit of a public project uses them
drop policy if exists pub_read_assigned on public.payment_plans;
create policy pub_read_assigned on public.payment_plans for select to anon, authenticated
  using (exists (select 1 from public.units u where u.payment_plan_id = payment_plans.id));

-- 16. Who can call what
revoke execute on function
  public.expire_due_reservations(uuid), public.reserve_unit(uuid, uuid, text), public.cancel_reservation(uuid), public.extend_reservation(uuid, int),
  public.convert_reservation(uuid, uuid, numeric, date), public.save_project(jsonb), public.import_units(uuid, jsonb, boolean),
  public.save_payment_plan(jsonb), public.assign_payment_plan(uuid, uuid[]), public.record_installment_payment(jsonb)
  from public, anon;
grant execute on function
  public.expire_due_reservations(uuid), public.reserve_unit(uuid, uuid, text), public.cancel_reservation(uuid), public.extend_reservation(uuid, int),
  public.convert_reservation(uuid, uuid, numeric, date), public.save_project(jsonb), public.import_units(uuid, jsonb, boolean),
  public.save_payment_plan(jsonb), public.assign_payment_plan(uuid, uuid[]), public.record_installment_payment(jsonb)
  to authenticated;

-- 17. Hourly expiry (daily_maintenance still does it too). Needs pg_cron; skipped with a notice if it is off.
do $$
begin
  perform cron.schedule('jilo-expire-reservations', '5 * * * *', 'select public.expire_due_reservations()');
exception when others then
  raise notice 'pg_cron not scheduled (%). Reservations still expire when a unit is reserved again and in daily_maintenance().', sqlerrm;
end $$;

-- 18. Post a construction update and move the project's completion % in one step (admin)
create or replace function public.add_project_update(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare v_proj uuid := (p ->> 'project_id')::uuid; v_id uuid; v_pct smallint := nullif(p ->> 'completion_pct', '')::smallint;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.projects where id = v_proj) then raise exception 'Project not found'; end if;
  if btrim(coalesce(p ->> 'title_en', '')) = '' then raise exception 'Title is required'; end if;
  insert into public.project_updates (project_id, update_date, title_en, title_ar, body_en, body_ar, completion_pct, media_path)
  values (v_proj, coalesce(nullif(p ->> 'update_date', '')::date, current_date), btrim(p ->> 'title_en'), nullif(btrim(coalesce(p ->> 'title_ar', '')), ''),
          nullif(btrim(coalesce(p ->> 'body_en', '')), ''), nullif(btrim(coalesce(p ->> 'body_ar', '')), ''), v_pct, nullif(p ->> 'media_path', ''))
  returning id into v_id;
  if v_pct is not null then update public.projects set completion_pct = v_pct where id = v_proj; end if;
  return v_id;
end $$;
revoke execute on function public.add_project_update(jsonb) from public, anon;
grant  execute on function public.add_project_update(jsonb) to authenticated;
