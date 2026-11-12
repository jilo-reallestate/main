-- =====================================================================
--  JILO: admin management functions (run once, after 01, 03, 04)
--  admin_set_staff()       promote/edit/deactivate a team member (creates the agent rows, protects against admin lock-out)
--  set_commission_status() approve / pay / cancel a commission with valid transitions only
--  admin_team_stats()      performance table (last 30 days)
--  All run as the CALLER and refuse anyone who is not an admin.
-- =====================================================================
create or replace function public.admin_set_staff(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_id uuid; v_old record; v_role public.user_role; v_active boolean; v_others int; v_moved int := 0;
begin
  if not public.is_admin() then raise exception 'Only an admin can manage the team'; end if;
  v_id := nullif(p ->> 'id', '')::uuid;
  if v_id is null and nullif(btrim(coalesce(p ->> 'email', '')), '') is not null then
    select id into v_id from public.profiles where lower(email) = lower(btrim(p ->> 'email'));
  end if;
  if v_id is null then raise exception 'No account found for that email. Ask them to sign up first, or use Invite.'; end if;
  select * into v_old from public.profiles where id = v_id;
  if not found then raise exception 'Account not found'; end if;

  v_role := coalesce(nullif(p ->> 'role', '')::public.user_role, v_old.role);
  v_active := coalesce(nullif(p ->> 'is_active', '')::boolean, v_old.is_active);

  if v_old.role = 'admin' and v_old.is_active and (v_role <> 'admin' or not v_active) then   -- lock-out protection
    if v_id = v_uid then raise exception 'You cannot remove your own admin access'; end if;
    select count(*) into v_others from public.profiles where role = 'admin' and is_active and id <> v_id;
    if v_others = 0 then raise exception 'There must be at least one active admin'; end if;
  end if;

  update public.profiles set role = v_role, is_active = v_active,
    full_name = coalesce(nullif(btrim(coalesce(p ->> 'full_name', '')), ''), full_name), phone = case when p ? 'phone' then nullif(p ->> 'phone', '') else phone end
  where id = v_id;

  if v_role = 'agent' then
    insert into public.agent_settings (id) values (v_id) on conflict (id) do nothing;
    insert into public.agent_profiles (id, display_name_en)
      values (v_id, coalesce(nullif(p ->> 'display_name_en', ''), nullif(p ->> 'full_name', ''), (select full_name from public.profiles where id = v_id), 'Advisor')) on conflict (id) do nothing;
    update public.agent_profiles set
      display_name_en = coalesce(nullif(p ->> 'display_name_en', ''), display_name_en),
      display_name_ar = case when p ? 'display_name_ar' then nullif(p ->> 'display_name_ar', '') else display_name_ar end,
      title_en = case when p ? 'title_en' then nullif(p ->> 'title_en', '') else title_en end,
      title_ar = case when p ? 'title_ar' then nullif(p ->> 'title_ar', '') else title_ar end,
      license_number = case when p ? 'license_number' then nullif(p ->> 'license_number', '') else license_number end,
      public_phone = case when p ? 'public_phone' then nullif(p ->> 'public_phone', '') else public_phone end,
      whatsapp = case when p ? 'whatsapp' then nullif(p ->> 'whatsapp', '') else whatsapp end,
      languages = case when p ? 'languages' then array(select jsonb_array_elements_text(p -> 'languages')) else languages end,
      is_public = coalesce(nullif(p ->> 'is_public', '')::boolean, is_public)
    where id = v_id;
    update public.agent_settings set
      commission_rate = coalesce(nullif(p ->> 'commission_rate', '')::numeric, commission_rate),
      monthly_target_aed = coalesce(nullif(p ->> 'monthly_target_aed', '')::numeric, monthly_target_aed),
      accepts_leads = coalesce(nullif(p ->> 'accepts_leads', '')::boolean, accepts_leads)
    where id = v_id;
  end if;

  -- handing over work when someone is deactivated or stops being an agent
  if (not v_active or v_role <> 'agent') and nullif(p ->> 'reassign_to', '') is not null then
    update public.leads set assigned_agent_id = (p ->> 'reassign_to')::uuid where assigned_agent_id = v_id and status = 'open';
    get diagnostics v_moved = row_count;
    update public.tasks set assigned_to = (p ->> 'reassign_to')::uuid where assigned_to = v_id and completed_at is null;
  end if;
  return jsonb_build_object('id', v_id, 'role', v_role, 'is_active', v_active, 'leads_reassigned', v_moved);
end $$;

create or replace function public.set_commission_status(p_id uuid, p_status text) returns jsonb
language plpgsql set search_path = '' as $$
declare cur public.commission_status; nxt public.commission_status := p_status::public.commission_status;
begin
  if not public.is_admin() then raise exception 'Only an admin can change commissions'; end if;
  select status into cur from public.commissions where id = p_id;
  if cur is null then raise exception 'Commission not found'; end if;
  if not ((cur = 'pending' and nxt in ('approved', 'cancelled')) or (cur = 'approved' and nxt in ('paid', 'cancelled'))) then
    raise exception 'A % commission cannot become %', cur, nxt;
  end if;
  update public.commissions set status = nxt,
    approved_by = case when nxt = 'approved' then (select auth.uid()) else approved_by end, approved_at = case when nxt = 'approved' then now() else approved_at end,
    paid_at = case when nxt = 'paid' then now() else paid_at end
  where id = p_id;
  return jsonb_build_object('id', p_id, 'status', nxt);
end $$;

create or replace function public.admin_team_stats() returns table (
  agent_id uuid, name text, email text, role public.user_role, is_active boolean, open_leads bigint, new_leads_30d bigint, won_30d bigint, lost_30d bigint,
  avg_response_min numeric, deals_closed_30d bigint, deal_value_aed_30d numeric, commission_pending_aed numeric, commission_paid_aed numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(a.display_name_en, p.full_name, p.email), p.email, p.role, p.is_active,
    (select count(*) from public.leads l where l.assigned_agent_id = p.id and l.status = 'open'),
    (select count(*) from public.leads l where l.assigned_agent_id = p.id and l.created_at >= now() - interval '30 days'),
    (select count(*) from public.leads l where l.assigned_agent_id = p.id and l.status = 'won' and l.closed_at >= now() - interval '30 days'),
    (select count(*) from public.leads l where l.assigned_agent_id = p.id and l.status = 'lost' and l.closed_at >= now() - interval '30 days'),
    (select round(avg(extract(epoch from l.first_response_at - l.created_at) / 60)::numeric, 1) from public.leads l
       where l.assigned_agent_id = p.id and l.created_by is null and l.first_response_at is not null and l.created_at >= now() - interval '30 days'),
    (select count(*) from public.deals d where d.agent_id = p.id and d.status = 'closed' and d.closed_at >= now() - interval '30 days'),
    (select coalesce(sum(d.price_aed), 0) from public.deals d where d.agent_id = p.id and d.status = 'closed' and d.closed_at >= now() - interval '30 days'),
    (select coalesce(sum(c.amount_aed), 0) from public.commissions c where c.agent_id = p.id and c.status in ('pending', 'approved')),
    (select coalesce(sum(c.amount_aed), 0) from public.commissions c where c.agent_id = p.id and c.status = 'paid')
  from public.profiles p left join public.agent_profiles a on a.id = p.id
  where public.is_admin() and p.role in ('agent', 'admin')
  order by p.is_active desc, p.role, 2
$$;

revoke execute on function public.admin_set_staff(jsonb), public.set_commission_status(uuid, text), public.admin_team_stats() from public, anon;
grant  execute on function public.admin_set_staff(jsonb), public.set_commission_status(uuid, text), public.admin_team_stats() to authenticated;
