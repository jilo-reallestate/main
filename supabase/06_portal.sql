-- =====================================================================
--  JILO: client portal (run once, after 01, 03, 04, 05)
--   * client_documents + private storage rules (agents only see THEIR clients' documents)
--   * chat notifications (agent <-> client)
--   * saved-search alert engine: run_saved_search_alerts()  (called daily by a scheduled job, service role only)
--   * contacts are linked to a verified account at creation, so a client who signs up first still sees later enquiries
-- =====================================================================

-- 1. Documents a client uploads (ID, passport, proof of funds...). Files live in the PRIVATE bucket "documents"/{profile_id}/...
create table public.client_documents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'other' check (kind in ('passport','emirates_id','visa','proof_of_funds','salary_certificate','other')),
  file_name  text not null check (char_length(file_name) between 1 and 200),
  path       text not null,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index client_documents_owner_idx on public.client_documents (owner_id, created_at desc);
alter table public.client_documents enable row level security;

create function public.agent_has_client(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_agent() and exists (
    select 1 from public.contacts c where c.profile_id = pid and (
      c.assigned_agent_id = (select auth.uid()) or c.created_by = (select auth.uid())
      or exists (select 1 from public.leads l where l.contact_id = c.id and l.assigned_agent_id = (select auth.uid()))))
$$;
create function public.agent_has_client_path(p text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin return public.agent_has_client(p::uuid); exception when invalid_text_representation then return false; end $$;

create policy admin_all    on public.client_documents for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy active_only  on public.client_documents as restrictive for all to authenticated using ((select not public.is_blocked())) with check ((select not public.is_blocked()));
create policy own_select   on public.client_documents for select to authenticated using (owner_id = (select auth.uid()));
create policy own_insert   on public.client_documents for insert to authenticated with check (owner_id = (select auth.uid()));
create policy own_delete   on public.client_documents for delete to authenticated using (owner_id = (select auth.uid()));
create policy agent_select on public.client_documents for select to authenticated using (public.agent_has_client(owner_id));

-- Storage: admin everything; agents manage property documents (property/{property_id}/...) and READ their own clients' folders only
drop policy if exists "jilo documents staff" on storage.objects;
create policy "jilo documents admin" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_admin()) with check (bucket_id = 'documents' and public.is_admin());
create policy "jilo documents agent property" on storage.objects for all to authenticated
  using      (bucket_id = 'documents' and (storage.foldername(name))[1] = 'property' and public.can_edit_property_path((storage.foldername(name))[2]))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'property' and public.can_edit_property_path((storage.foldername(name))[2]));
create policy "jilo documents agent clients" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.agent_has_client_path((storage.foldername(name))[1]));
create policy "jilo documents own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Chat notifications: tell the other side when a message arrives
create function public.lead_messages_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_agent uuid; v_client uuid; v_to uuid;
begin
  select l.assigned_agent_id, c.profile_id into v_agent, v_client from public.leads l join public.contacts c on c.id = l.contact_id where l.id = new.lead_id;
  v_to := case when new.sender_id = v_client then v_agent else v_client end;
  if v_to is not null and v_to <> new.sender_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_to, 'new_message', 'New message', left(new.body, 140), jsonb_build_object('lead_id', new.lead_id));
  end if;
  return null;
end $$;
create trigger trg_lead_messages_notify after insert on public.lead_messages for each row execute function public.lead_messages_notify();

-- 3. A contact created for an email that already has a VERIFIED account is linked to it straight away
create function public.contacts_link_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if new.profile_id is null and new.email is not null then
    select u.id into v_uid from auth.users u
     where lower(u.email) = lower(new.email) and u.email_confirmed_at is not null
       and not exists (select 1 from public.contacts c where c.profile_id = u.id) limit 1;
    if v_uid is not null and exists (select 1 from public.profiles where id = v_uid) then new.profile_id := v_uid; end if;
  end if;
  return new;
end $$;
create trigger trg_contacts_link_profile before insert on public.contacts for each row execute function public.contacts_link_profile();

-- 4. Saved-search alerts. Run daily (and more often for 'instant'). Creates an in-app notification and returns what to email.
create function public.run_saved_search_alerts()
returns table (user_id uuid, email text, locale text, search_id uuid, search_name text, match_count int, qs text, sample jsonb)
language plpgsql security definer set search_path = '' as $$
declare s record; v_since timestamptz; v_n int; v_sample jsonb; v_qs text;
begin
  for s in
    select ss.*, p.email as p_email, p.preferred_locale as p_locale from public.saved_searches ss join public.profiles p on p.id = ss.user_id
    where ss.alerts_enabled and p.is_active
      and (ss.last_notified_at is null or ss.last_notified_at <= now() - case ss.frequency when 'instant' then interval '0' when 'daily' then interval '23 hours' else interval '6 days 23 hours' end)
  loop
    v_since := coalesce(s.last_notified_at, s.created_at);
    select count(*), coalesce(jsonb_agg(jsonb_build_object('slug', m.slug, 'title', m.title, 'price', m.price, 'currency', m.currency) order by m.published_at desc) filter (where m.rn <= 3), '[]'::jsonb)
      into v_n, v_sample
    from (
      select l.published_at, l.price, l.currency, pt.slug, pt.title, row_number() over (order by l.published_at desc) rn
      from public.listings l join public.properties pr on pr.id = l.property_id
      left join public.areas a on a.id = pr.area_id
      left join public.property_translations pt on pt.property_id = pr.id and pt.locale = s.p_locale
      where l.status = 'published' and l.published_at > v_since
        and (s.filters ->> 'purpose' is null or l.purpose::text = s.filters ->> 'purpose')
        and (coalesce(s.filters ->> 'offplan', '') <> '1' or pr.completion_status = 'off_plan')
        and (s.filters ->> 'type' is null or pr.type::text = s.filters ->> 'type')
        and (s.filters ->> 'area' is null or a.code = s.filters ->> 'area')
        and (s.filters ->> 'beds' is null or (s.filters ->> 'beds' = 's' and pr.bedrooms = 0) or (s.filters ->> 'beds' <> 's' and pr.bedrooms >= (s.filters ->> 'beds')::int))
        and (s.filters ->> 'maxPrice' is null or l.price_aed_normalized <= (s.filters ->> 'maxPrice')::numeric)
    ) m;
    if v_n > 0 then
      select string_agg(key || '=' || replace(value, ' ', '%20'), '&') into v_qs from jsonb_each_text(s.filters) where key in ('purpose','offplan','type','area','beds','maxPrice');
      insert into public.notifications (user_id, type, title, body, data)
      values (s.user_id, 'saved_search', v_n || ' new ' || case when v_n = 1 then 'home matches' else 'homes match' end || ' "' || s.name || '"', null,
              jsonb_build_object('search_id', s.id, 'count', v_n, 'qs', coalesce(v_qs, '')));
      update public.saved_searches set last_notified_at = now() where id = s.id;
      user_id := s.user_id; email := s.p_email; locale := s.p_locale; search_id := s.id; search_name := s.name; match_count := v_n; qs := coalesce(v_qs, ''); sample := v_sample;
      return next;
    end if;
  end loop;
end $$;
revoke execute on function public.run_saved_search_alerts() from public, anon, authenticated;
