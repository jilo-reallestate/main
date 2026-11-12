-- =====================================================================
--  JILO: CRM functions (run once, after 01 and 03)
--  create_lead(): an agent/admin adds a lead by hand (phone call, walk-in, referral...). Finds or creates the contact.
--  create_deal(): opens a deal from a lead. Both run as the CALLER (security invoker): Row Level Security applies.
-- =====================================================================
create or replace function public.create_lead(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_admin boolean := public.is_admin();
  v_name text := btrim(coalesce(p ->> 'full_name', ''));
  v_email text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+]', '', 'g'), '');
  v_contact uuid; v_lead uuid; v_src uuid; v_agent uuid; v_intent public.lead_intent;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if char_length(v_name) < 2 then raise exception 'Name is required'; end if;
  if v_email is null and v_phone is null then raise exception 'Phone or email is required'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  v_intent := case when p ->> 'intent' in ('buy','rent','invest','sell','list_property') then (p ->> 'intent')::public.lead_intent else 'buy'::public.lead_intent end;
  select id into v_src from public.lead_sources where key = coalesce(nullif(p ->> 'source_key', ''), 'phone');
  v_agent := case when v_admin and nullif(p ->> 'agent_id', '') is not null then (p ->> 'agent_id')::uuid else v_uid end;

  select id into v_contact from public.contacts where (v_email is not null and lower(email) = v_email) or (v_phone is not null and phone = v_phone) order by created_at limit 1;
  if v_contact is null then
    begin
      insert into public.contacts (full_name, email, phone, type, source_id, assigned_agent_id, created_by)
      values (v_name, v_email, v_phone,
              case v_intent when 'rent' then 'tenant'::public.contact_type when 'sell' then 'landlord'::public.contact_type when 'list_property' then 'landlord'::public.contact_type
                            when 'invest' then 'investor'::public.contact_type else 'buyer'::public.contact_type end, v_src, v_agent, v_uid)
      returning id into v_contact;
    exception when unique_violation then
      raise exception 'A contact with this phone or email already exists (it may belong to another agent)';
    end;
  end if;

  insert into public.leads (contact_id, source_id, intent, assigned_agent_id, budget_min, budget_max, budget_currency, message, created_by, first_response_at)
  values (v_contact, v_src, v_intent, v_agent, nullif(p ->> 'budget_min', '')::numeric, nullif(p ->> 'budget_max', '')::numeric,
          coalesce(nullif(p ->> 'currency', ''), 'AED'), nullif(btrim(coalesce(p ->> 'message', '')), ''), v_uid, now())
  returning id into v_lead;   -- first_response_at = now(): the agent already has this person, so no response-time alarm
  if nullif(btrim(coalesce(p ->> 'message', '')), '') is not null then
    insert into public.activities (lead_id, type, direction, summary, body, created_by) values (v_lead, 'note', 'inbound', 'Lead added manually', btrim(p ->> 'message'), v_uid);
  end if;
  return jsonb_build_object('lead_id', v_lead, 'contact_id', v_contact);
end $$;

create or replace function public.create_deal(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); l record; v_deal uuid; v_price numeric; v_cur text;
  v_type public.deal_type := coalesce(nullif(p ->> 'type', ''), 'sale')::public.deal_type;
begin
  if v_uid is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  select contact_id, assigned_agent_id, listing_id, property_id into l from public.leads where id = (p ->> 'lead_id')::uuid;
  if not found then raise exception 'Lead not found or not yours'; end if;
  v_price := nullif(p ->> 'price', '')::numeric; v_cur := coalesce(nullif(p ->> 'currency', ''), 'AED');
  if v_price is null and l.listing_id is not null then select price, currency into v_price, v_cur from public.listings where id = l.listing_id; end if;
  if v_price is null or v_price <= 0 then raise exception 'Deal price is required'; end if;
  insert into public.deals (lead_id, contact_id, listing_id, property_id, agent_id, type, price, currency, expected_close_on, notes, created_by)
  values ((p ->> 'lead_id')::uuid, l.contact_id, l.listing_id, l.property_id, coalesce(l.assigned_agent_id, v_uid), v_type, v_price, v_cur,
          nullif(p ->> 'expected_close_on', '')::date, nullif(p ->> 'notes', ''), v_uid)
  returning id into v_deal;
  insert into public.deal_parties (deal_id, contact_id, role) values (v_deal, l.contact_id, case when v_type = 'rent' then 'tenant' else 'buyer' end);
  insert into public.activities (lead_id, deal_id, type, summary, created_by) values ((p ->> 'lead_id')::uuid, v_deal, 'system', 'Deal opened', v_uid);
  return jsonb_build_object('deal_id', v_deal);
end $$;

revoke execute on function public.create_lead(jsonb), public.create_deal(jsonb) from public, anon;
grant  execute on function public.create_lead(jsonb), public.create_deal(jsonb) to authenticated;
