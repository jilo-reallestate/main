-- =====================================================================
--  JILO REAL ESTATE: COMPLETE SUPABASE SCHEMA  (run ONCE on a fresh project)
--  Paste into Supabase Dashboard > SQL Editor > New query > Run.
--  Runs as a single transaction: if anything fails, nothing is applied.
--
--  Sections
--   0  Extensions and enums
--   1  Settings, currencies, exchange rates
--   2  Identity: profiles, agents
--   3  Geography and catalog: developers, areas, amenities
--   4  CRM lookups and contacts
--   5  Off-plan: projects, buildings, floors, payment plans
--   6  Properties, media, documents
--   7  Units, reservations, listings
--   8  CRM: leads, activities, tasks, viewings, messages
--   9  Deals, commissions, off-plan installments
--  10  Rentals: leases, rent schedules, deposits, maintenance
--  11  Finance: invoices, payments, expenses
--  12  Content, SEO, system, AI logs, client features
--  13  Business logic: functions and triggers
--  14  Row Level Security (every table)
--  15  Storage buckets and policies
--  16  Read-only AI schema and role
--  17  Seed data
--  18  Scheduled jobs (pg_cron) and realtime
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS AND ENUMS
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;
create extension if not exists postgis with schema extensions;

create type public.user_role         as enum ('admin','agent','client');
create type public.property_type     as enum ('apartment','villa','townhouse','studio','penthouse','duplex','hotel_apartment','land','office','shop','warehouse','building');
create type public.listing_purpose   as enum ('sale','rent');
create type public.listing_status    as enum ('draft','pending_review','published','reserved','sold','rented','expired','archived');
create type public.furnishing        as enum ('unfurnished','semi_furnished','furnished');
create type public.completion_status as enum ('ready','off_plan');
create type public.rent_period       as enum ('yearly','monthly','weekly','daily');
create type public.media_kind        as enum ('image','video','floorplan','tour_360','brochure');
create type public.doc_kind          as enum ('title_deed','noc','passport','emirates_id','contract','permit','other');
create type public.area_level        as enum ('country','emirate','city','community','sub_community');
create type public.project_status    as enum ('upcoming','launched','under_construction','completed');
create type public.unit_status       as enum ('available','reserved','booked','sold','blocked');
create type public.reservation_status as enum ('active','expired','converted','cancelled');
create type public.milestone_trigger as enum ('on_booking','fixed_date','construction_stage','on_handover','post_handover');
create type public.contact_type      as enum ('buyer','tenant','landlord','investor','other');
create type public.lead_status       as enum ('open','won','lost');
create type public.lead_intent       as enum ('buy','rent','invest','sell','list_property');
create type public.activity_type     as enum ('call','email','whatsapp','sms','note','meeting','viewing','status_change','system');
create type public.viewing_status    as enum ('requested','confirmed','completed','cancelled','no_show');
create type public.priority_level    as enum ('low','medium','high','urgent');
create type public.deal_type         as enum ('sale','rent','offplan_sale');
create type public.deal_status       as enum ('negotiation','reserved','contract_signed','closed','cancelled');
create type public.commission_status as enum ('pending','approved','paid','cancelled');
create type public.lease_status      as enum ('draft','active','expiring','renewed','terminated','expired');
create type public.payment_frequency as enum ('monthly','quarterly','semi_annual','annual','cheques');
create type public.schedule_status   as enum ('scheduled','partial','paid','overdue','waived');
create type public.deposit_status    as enum ('held','partially_refunded','refunded','forfeited');
create type public.renewal_status    as enum ('proposed','accepted','declined','expired');
create type public.maintenance_status as enum ('open','in_progress','resolved','cancelled');
create type public.invoice_status    as enum ('draft','sent','partial','paid','overdue','void');
create type public.payment_method    as enum ('cash','cheque','bank_transfer','card','online');
create type public.payment_status    as enum ('pending','completed','failed','refunded');

create sequence public.property_ref_seq start 1000;
create sequence public.invoice_no_seq   start 1;

-- ---------------------------------------------------------------------
-- 1. SETTINGS, CURRENCIES, EXCHANGE RATES
-- ---------------------------------------------------------------------
create table public.site_settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default false,   -- public = readable by the website
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

create function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.site_settings where key = p_key), p_default)
$$;

create function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.site_settings where key = p_key), p_default)
$$;

create table public.currencies (
  code       text primary key check (code ~ '^[A-Z]{3}$'),
  name_en    text not null,
  name_ar    text not null,
  symbol     text not null,
  is_base    boolean not null default false,
  is_active  boolean not null default true
);

-- rate_to_aed = how many AED one unit of the currency is worth
create table public.exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  currency_code text not null references public.currencies(code),
  rate_to_aed   numeric(18,8) not null check (rate_to_aed > 0),
  rate_date     date not null default current_date,
  source        text,
  created_at    timestamptz not null default now(),
  unique (currency_code, rate_date)
);

create function public.rate_to_aed(p_currency text, p_date date default current_date) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare v numeric;
begin
  select e.rate_to_aed into v
  from public.exchange_rates e
  where e.currency_code = p_currency and e.rate_date <= p_date
  order by e.rate_date desc limit 1;
  if v is null then
    raise exception 'No exchange rate for % on or before %', p_currency, p_date;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 2. IDENTITY
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               public.user_role not null default 'client',
  full_name          text,
  email              text,
  phone              text,
  avatar_url         text,
  preferred_locale   text not null default 'en' check (preferred_locale in ('en','ar')),
  preferred_currency text not null default 'AED' references public.currencies(code),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Public-facing agent card (shown on listing pages, E-E-A-T)
create table public.agent_profiles (
  id               uuid primary key references public.profiles(id) on delete cascade,
  display_name_en  text not null,
  display_name_ar  text,
  title_en         text default 'Property Advisor',
  title_ar         text default 'مستشار عقاري',
  license_number   text,                 -- BRN / broker card number
  bio_en           text,
  bio_ar           text,
  photo_url        text,
  public_phone     text,
  whatsapp         text,
  languages        text[] not null default '{}',
  specialties      text[] not null default '{}',
  years_experience smallint check (years_experience >= 0),
  is_public        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Private agent settings (commission rate, targets, lead routing)
create table public.agent_settings (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  commission_rate    numeric(5,2) not null default 2.00 check (commission_rate between 0 and 100),
  monthly_target_aed numeric(14,2) not null default 0 check (monthly_target_aed >= 0),
  accepts_leads      boolean not null default true,
  last_assigned_at   timestamptz,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. GEOGRAPHY AND CATALOG
-- ---------------------------------------------------------------------
create table public.developers (
  id               uuid primary key default gen_random_uuid(),
  slug_en          text not null unique check (slug_en ~ '^[^\s/?#]+$'),
  slug_ar          text unique check (slug_ar ~ '^[^\s/?#]+$'),
  name_en          text not null,
  name_ar          text,
  logo_url         text,
  website          text,
  description_en   text,
  description_ar   text,
  meta_title_en    text, meta_title_ar text,
  meta_description_en text, meta_description_ar text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.areas (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- stable key, e.g. 'dubai-marina'
  parent_id    uuid references public.areas(id) on delete restrict,
  level        public.area_level not null,
  country_code char(2) not null,
  lat          numeric(9,6) check (lat between -90 and 90),
  lng          numeric(9,6) check (lng between -180 and 180),
  geog         extensions.geography(Point,4326),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.area_translations (
  area_id          uuid not null references public.areas(id) on delete cascade,
  locale           text not null check (locale in ('en','ar')),
  slug             text not null check (slug ~ '^[^\s/?#]+$'),
  name             text not null,
  description      text,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  faq              jsonb not null default '[]'::jsonb,
  primary key (area_id, locale),
  unique (locale, slug)
);

create table public.amenities (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name_en    text not null,
  name_ar    text not null,
  category   text not null default 'general',
  icon       text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- 4. CRM LOOKUPS AND CONTACTS
-- ---------------------------------------------------------------------
create table public.lead_sources (
  id      uuid primary key default gen_random_uuid(),
  key     text not null unique,
  name_en text not null,
  name_ar text not null
);

create table public.pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name_en    text not null,
  name_ar    text not null,
  sort_order int not null,
  color      text,
  is_won     boolean not null default false,
  is_lost    boolean not null default false,
  check (not (is_won and is_lost))
);

create table public.contacts (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid unique references public.profiles(id) on delete set null,  -- set when the person has a portal account
  full_name         text not null,
  email             text,
  phone             text,
  whatsapp          text,
  nationality       text,
  type              public.contact_type not null default 'buyer',
  preferred_locale  text not null default 'en' check (preferred_locale in ('en','ar')),
  source_id         uuid references public.lead_sources(id),
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index contacts_email_uq on public.contacts (lower(email)) where email is not null;
create unique index contacts_phone_uq on public.contacts (phone) where phone is not null;
create index contacts_agent_idx on public.contacts (assigned_agent_id);
create index contacts_name_trgm on public.contacts using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 5. OFF-PLAN PROJECTS
-- ---------------------------------------------------------------------
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  developer_id     uuid references public.developers(id),
  area_id          uuid references public.areas(id),
  status           public.project_status not null default 'upcoming',
  launch_date      date,
  handover_date    date,
  completion_pct   smallint not null default 0 check (completion_pct between 0 and 100),
  lat              numeric(9,6) check (lat between -90 and 90),
  lng              numeric(9,6) check (lng between -180 and 180),
  geog             extensions.geography(Point,4326),
  starting_price   numeric(14,2) check (starting_price >= 0),
  currency         text not null default 'AED' references public.currencies(code),
  brochure_url     text,
  cover_url        text,
  permit_number    text,           -- advertising permit / RERA project number: confirm rules with client
  is_published     boolean not null default false,
  is_featured      boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index projects_area_idx on public.projects (area_id);
create index projects_dev_idx  on public.projects (developer_id);

create table public.project_translations (
  project_id       uuid not null references public.projects(id) on delete cascade,
  locale           text not null check (locale in ('en','ar')),
  slug             text not null check (slug ~ '^[^\s/?#]+$'),
  name             text not null,
  tagline          text,
  description      text,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  faq              jsonb not null default '[]'::jsonb,
  primary key (project_id, locale),
  unique (locale, slug)
);
create index project_tr_name_trgm on public.project_translations using gin (name extensions.gin_trgm_ops);

create table public.project_media (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       public.media_kind not null default 'image',
  path       text not null,         -- storage path in bucket project-media
  alt_en     text, alt_ar text,
  sort_order int not null default 0,
  is_cover   boolean not null default false
);
create index project_media_idx on public.project_media (project_id, sort_order);

create table public.project_updates (            -- construction progress posts
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  update_date    date not null default current_date,
  title_en       text not null, title_ar text,
  body_en        text, body_ar text,
  completion_pct smallint check (completion_pct between 0 and 100),
  media_path     text,
  created_at     timestamptz not null default now()
);
create index project_updates_idx on public.project_updates (project_id, update_date desc);

create table public.buildings (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  code         text not null,
  name_en      text not null,
  name_ar      text,
  floors_count int check (floors_count > 0),
  sort_order   int not null default 0,
  unique (project_id, code)
);

create table public.floors (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings(id) on delete cascade,
  floor_number   int not null,
  plan_image_path text,
  unique (building_id, floor_number)
);

create table public.payment_plans (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references public.projects(id) on delete cascade,   -- null = reusable template
  name_en        text not null, name_ar text,
  description_en text, description_ar text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.payment_plan_milestones (
  id                 uuid primary key default gen_random_uuid(),
  payment_plan_id    uuid not null references public.payment_plans(id) on delete cascade,
  sort_order         int not null,
  label_en           text not null, label_ar text,
  percentage         numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  trigger_type       public.milestone_trigger not null default 'fixed_date',
  due_offset_days    int check (due_offset_days >= 0),   -- days after booking
  fixed_date         date,
  construction_stage text,
  unique (payment_plan_id, sort_order)
);

create view public.payment_plan_totals with (security_invoker = true) as
  select payment_plan_id, sum(percentage) as total_percentage, count(*) as milestones
  from public.payment_plan_milestones group by payment_plan_id;

-- ---------------------------------------------------------------------
-- 6. PROPERTIES (single source of truth for every unit, house, studio)
-- ---------------------------------------------------------------------
create table public.properties (
  id                uuid primary key default gen_random_uuid(),
  reference_code    text not null unique default ('JL-' || lpad(nextval('public.property_ref_seq')::text, 6, '0')),
  type              public.property_type not null,
  area_id           uuid references public.areas(id),
  developer_id      uuid references public.developers(id),
  building_name     text,
  address_line      text,
  lat               numeric(9,6) check (lat between -90 and 90),
  lng               numeric(9,6) check (lng between -180 and 180),
  geog              extensions.geography(Point,4326),
  bedrooms          smallint check (bedrooms >= 0),          -- 0 = studio
  bathrooms         smallint check (bathrooms >= 0),
  size_sqft         numeric(10,2) check (size_sqft > 0),
  plot_sqft         numeric(10,2) check (plot_sqft > 0),
  floor_number      int,
  parking_spaces    smallint check (parking_spaces >= 0),
  furnishing        public.furnishing,
  view_type         text,
  completion_status public.completion_status not null default 'ready',
  handover_date     date,
  year_built        smallint check (year_built between 1900 and 2100),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index properties_area_idx    on public.properties (area_id);
create index properties_type_idx    on public.properties (type, bedrooms);
create index properties_creator_idx on public.properties (created_by);
create index properties_geog_idx    on public.properties using gist (geog);

-- Staff-only data about a property (kept out of the public table on purpose)
create table public.property_internal (
  property_id      uuid primary key references public.properties(id) on delete cascade,
  owner_contact_id uuid references public.contacts(id) on delete set null,
  internal_notes   text,
  keys_location    text,
  source           text,
  updated_at       timestamptz not null default now()
);

create table public.property_translations (
  property_id      uuid not null references public.properties(id) on delete cascade,
  locale           text not null check (locale in ('en','ar')),
  slug             text not null check (slug ~ '^[^\s/?#]+$'),   -- tip: end slugs with the reference code to keep them unique
  title            text not null,
  description      text,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  primary key (property_id, locale),
  unique (locale, slug)
);
create index property_tr_title_trgm on public.property_translations using gin (title extensions.gin_trgm_ops);

create table public.property_media (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind        public.media_kind not null default 'image',
  path        text not null,        -- storage path in bucket property-media: {property_id}/{file}
  alt_en      text, alt_ar text,
  sort_order  int not null default 0,
  is_cover    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index property_media_idx on public.property_media (property_id, sort_order);
create unique index property_media_one_cover on public.property_media (property_id) where is_cover;

create table public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_id  uuid not null references public.amenities(id) on delete cascade,
  primary key (property_id, amenity_id)
);

create table public.property_documents (       -- private bucket: documents
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  kind         public.doc_kind not null default 'other',
  file_name    text not null,
  path         text not null,
  expires_on   date,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index property_docs_idx on public.property_documents (property_id);

-- ---------------------------------------------------------------------
-- 7. UNITS, RESERVATIONS, LISTINGS
-- ---------------------------------------------------------------------
create table public.units (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  building_id    uuid references public.buildings(id) on delete set null,
  floor_id       uuid references public.floors(id) on delete set null,
  property_id    uuid unique references public.properties(id) on delete set null,
  unit_number    text not null,
  unit_type      text,                     -- e.g. '1BR', '2BR+Maid', 'Studio'
  bedrooms       smallint check (bedrooms >= 0),
  size_sqft      numeric(10,2) check (size_sqft > 0),
  view_type      text,
  price          numeric(14,2) not null check (price >= 0),
  currency       text not null default 'AED' references public.currencies(code),
  price_aed      numeric(14,2),
  status         public.unit_status not null default 'available',
  reserved_until timestamptz,
  payment_plan_id uuid references public.payment_plans(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, unit_number)
);
create index units_project_status_idx on public.units (project_id, status);
create index units_floor_idx on public.units (floor_id);

create table public.unit_reservations (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  lead_id     uuid,                       -- FK added after leads exists
  agent_id    uuid references public.profiles(id) on delete set null,
  status      public.reservation_status not null default 'active',
  reserved_at timestamptz not null default now(),
  expires_at  timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index unit_one_active_reservation on public.unit_reservations (unit_id) where status = 'active';

create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  purpose        public.listing_purpose not null,
  status         public.listing_status not null default 'draft',
  price          numeric(14,2) not null check (price >= 0),
  currency       text not null default 'AED' references public.currencies(code),
  price_aed      numeric(14,2),            -- filled by trigger
  price_aed_normalized numeric(14,2),      -- rent normalised to a yearly figure, sale = price_aed
  price_period   public.rent_period,       -- required for rent
  cheques        smallint check (cheques between 1 and 12),
  deposit_amount numeric(14,2) check (deposit_amount >= 0),
  is_negotiable  boolean not null default false,
  permit_number  text,                     -- advertising permit (e.g. Trakheesi in Dubai)
  agent_id       uuid references public.profiles(id) on delete set null,
  is_featured    boolean not null default false,
  published_at   timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (purpose = 'sale' or price_period is not null)
);
create index listings_public_idx   on public.listings (status, purpose, price_aed_normalized);
create index listings_property_idx on public.listings (property_id);
create index listings_agent_idx    on public.listings (agent_id, status);
create unique index listings_one_open_per_purpose
  on public.listings (property_id, purpose) where status in ('draft','pending_review','published','reserved');

-- ---------------------------------------------------------------------
-- 8. CRM
-- ---------------------------------------------------------------------
create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.contacts(id) on delete cascade,
  source_id          uuid references public.lead_sources(id),
  stage_id           uuid not null references public.pipeline_stages(id),
  status             public.lead_status not null default 'open',
  intent             public.lead_intent not null default 'buy',
  assigned_agent_id  uuid references public.profiles(id) on delete set null,
  listing_id         uuid references public.listings(id) on delete set null,
  property_id        uuid references public.properties(id) on delete set null,
  project_id         uuid references public.projects(id) on delete set null,
  budget_min         numeric(14,2) check (budget_min >= 0),
  budget_max         numeric(14,2) check (budget_max >= 0),
  budget_currency    text not null default 'AED' references public.currencies(code),
  message            text,
  locale             text not null default 'en' check (locale in ('en','ar')),
  score              int not null default 0,
  lost_reason        text,
  utm                jsonb not null default '{}'::jsonb,
  sla_due_at         timestamptz,
  first_response_at  timestamptz,
  escalated_at       timestamptz,
  last_activity_at   timestamptz,
  closed_at          timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index leads_agent_status_idx on public.leads (assigned_agent_id, status);
create index leads_stage_idx        on public.leads (stage_id);
create index leads_contact_idx      on public.leads (contact_id);
create index leads_created_idx      on public.leads (created_at desc);
create index leads_sla_idx          on public.leads (sla_due_at) where status = 'open' and first_response_at is null;

alter table public.unit_reservations
  add constraint unit_reservations_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete cascade,
  deal_id     uuid,                       -- FK added after deals exists
  type        public.activity_type not null,
  direction   text check (direction in ('inbound','outbound')),
  summary     text,
  body        text,
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (lead_id is not null or contact_id is not null or deal_id is not null)
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_contact_idx on public.activities (contact_id, created_at desc);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references public.leads(id) on delete cascade,
  deal_id       uuid,                      -- FK added after deals exists
  lease_id      uuid,                      -- FK added after leases exists
  assigned_to   uuid not null references public.profiles(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  title         text not null,
  description   text,
  priority      public.priority_level not null default 'medium',
  due_at        timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (assigned_to, due_at) where completed_at is null;

create table public.viewings (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete set null,
  property_id   uuid references public.properties(id) on delete set null,
  lead_id       uuid references public.leads(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete cascade,
  agent_id      uuid references public.profiles(id) on delete set null,
  scheduled_at  timestamptz not null,
  duration_min  smallint not null default 30 check (duration_min > 0),
  status        public.viewing_status not null default 'requested',
  requested_via text not null default 'website',
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index viewings_agent_idx   on public.viewings (agent_id, scheduled_at);
create index viewings_contact_idx on public.viewings (contact_id);

create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  channel    text not null check (channel in ('email','sms','whatsapp')),
  locale     text not null check (locale in ('en','ar')),
  subject    text,
  body       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, channel, locale)
);

-- In-portal chat between a client and their agent, per lead
create table public.lead_messages (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index lead_messages_idx on public.lead_messages (lead_id, created_at);

-- ---------------------------------------------------------------------
-- 9. DEALS, COMMISSIONS, OFF-PLAN INSTALLMENTS
-- ---------------------------------------------------------------------
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.leads(id) on delete set null,
  contact_id         uuid not null references public.contacts(id),
  listing_id         uuid references public.listings(id) on delete set null,
  property_id        uuid references public.properties(id) on delete set null,
  unit_id            uuid references public.units(id) on delete set null,
  agent_id           uuid references public.profiles(id) on delete set null,
  type               public.deal_type not null,
  status             public.deal_status not null default 'negotiation',
  price              numeric(14,2) not null check (price >= 0),
  currency           text not null default 'AED' references public.currencies(code),
  price_aed          numeric(14,2),
  expected_close_on  date,
  closed_at          timestamptz,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index deals_agent_idx   on public.deals (agent_id, status);
create index deals_contact_idx on public.deals (contact_id);
create index deals_closed_idx  on public.deals (closed_at) where status = 'closed';

alter table public.activities add constraint activities_deal_fk foreign key (deal_id) references public.deals(id) on delete cascade;
alter table public.tasks      add constraint tasks_deal_fk      foreign key (deal_id) references public.deals(id) on delete cascade;

create table public.deal_parties (
  deal_id    uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role       text not null check (role in ('buyer','co_buyer','seller','tenant','landlord','guarantor')),
  primary key (deal_id, contact_id, role)
);

create table public.commissions (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid not null references public.deals(id) on delete cascade,
  agent_id       uuid not null references public.profiles(id),
  rate           numeric(5,2) not null check (rate between 0 and 100),
  amount         numeric(14,2) not null check (amount >= 0),
  currency       text not null references public.currencies(code),
  fx_rate_to_aed numeric(18,8),
  amount_aed     numeric(14,2),
  status         public.commission_status not null default 'pending',
  approved_by    uuid references public.profiles(id) on delete set null,
  approved_at    timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (deal_id, agent_id)
);
create index commissions_agent_idx on public.commissions (agent_id, status);

-- Buyer payment tracker for off-plan sales (one row per milestone per deal)
create table public.deal_installments (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  milestone_id  uuid references public.payment_plan_milestones(id) on delete set null,
  sort_order    int not null,
  label_en      text not null, label_ar text,
  due_date      date not null,
  amount        numeric(14,2) not null check (amount >= 0),
  currency      text not null references public.currencies(code),
  paid_amount   numeric(14,2) not null default 0 check (paid_amount >= 0),
  status        public.schedule_status not null default 'scheduled',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (deal_id, sort_order)
);
create index deal_installments_due_idx on public.deal_installments (due_date) where status in ('scheduled','partial','overdue');

-- ---------------------------------------------------------------------
-- 10. RENTALS
-- ---------------------------------------------------------------------
create table public.leases (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties(id),
  listing_id          uuid references public.listings(id) on delete set null,
  deal_id             uuid references public.deals(id) on delete set null,
  tenant_contact_id   uuid not null references public.contacts(id),
  landlord_contact_id uuid references public.contacts(id),
  agent_id            uuid references public.profiles(id) on delete set null,
  start_date          date not null,
  end_date            date not null,
  annual_rent         numeric(14,2) not null check (annual_rent >= 0),
  currency            text not null default 'AED' references public.currencies(code),
  frequency           public.payment_frequency not null default 'cheques',
  number_of_cheques   smallint check (number_of_cheques between 1 and 12),
  ejari_number        text,               -- tenancy registration number (confirm local rules)
  status              public.lease_status not null default 'draft',
  renewed_from_id     uuid references public.leases(id) on delete set null,
  terminated_at       date,
  termination_reason  text,
  contract_path       text,               -- private bucket: contracts
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date > start_date)
);
create index leases_status_end_idx on public.leases (status, end_date);
create index leases_tenant_idx     on public.leases (tenant_contact_id);
create index leases_agent_idx      on public.leases (agent_id);
alter table public.tasks add constraint tasks_lease_fk foreign key (lease_id) references public.leases(id) on delete cascade;

create table public.rent_schedules (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references public.leases(id) on delete cascade,
  sort_order    int not null,
  due_date      date not null,
  amount        numeric(14,2) not null check (amount >= 0),
  currency      text not null references public.currencies(code),
  paid_amount   numeric(14,2) not null default 0 check (paid_amount >= 0),
  status        public.schedule_status not null default 'scheduled',
  cheque_number text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (lease_id, sort_order)
);
create index rent_schedules_due_idx on public.rent_schedules (due_date) where status in ('scheduled','partial','overdue');

create table public.security_deposits (
  id              uuid primary key default gen_random_uuid(),
  lease_id        uuid not null unique references public.leases(id) on delete cascade,
  amount          numeric(14,2) not null check (amount >= 0),
  currency        text not null references public.currencies(code),
  status          public.deposit_status not null default 'held',
  refunded_amount numeric(14,2) not null default 0 check (refunded_amount >= 0),
  received_on     date,
  refunded_on     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.renewals (
  id              uuid primary key default gen_random_uuid(),
  lease_id        uuid not null references public.leases(id) on delete cascade,
  new_lease_id    uuid references public.leases(id) on delete set null,
  proposed_rent   numeric(14,2) check (proposed_rent >= 0),
  currency        text references public.currencies(code),
  proposed_start  date,
  proposed_end    date,
  status          public.renewal_status not null default 'proposed',
  notice_sent_at  timestamptz,
  responded_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.maintenance_requests (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid references public.leases(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  title         text not null,
  description   text,
  priority      public.priority_level not null default 'medium',
  status        public.maintenance_status not null default 'open',
  assigned_to   uuid references public.profiles(id) on delete set null,
  cost_amount   numeric(14,2) check (cost_amount >= 0),
  currency      text references public.currencies(code),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index maintenance_status_idx on public.maintenance_requests (status, created_at desc);

-- ---------------------------------------------------------------------
-- 11. FINANCE
-- ---------------------------------------------------------------------
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_no_seq')::text, 6, '0')),
  contact_id    uuid not null references public.contacts(id),
  deal_id       uuid references public.deals(id) on delete set null,
  lease_id      uuid references public.leases(id) on delete set null,
  issue_date    date not null default current_date,
  due_date      date not null default (current_date + 14),
  currency      text not null default 'AED' references public.currencies(code),
  subtotal      numeric(14,2) not null default 0,
  vat_rate      numeric(5,2) not null default 5 check (vat_rate between 0 and 100),
  vat_amount    numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  paid_amount   numeric(14,2) not null default 0,
  status        public.invoice_status not null default 'draft',
  notes         text,
  pdf_path      text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index invoices_contact_idx on public.invoices (contact_id);
create index invoices_status_idx  on public.invoices (status, due_date);

create table public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  description_en text not null, description_ar text,
  quantity      numeric(10,2) not null default 1 check (quantity > 0),
  unit_price    numeric(14,2) not null check (unit_price >= 0),
  line_total    numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index invoice_items_idx on public.invoice_items (invoice_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid references public.contacts(id),
  invoice_id          uuid references public.invoices(id) on delete set null,
  deal_id             uuid references public.deals(id) on delete set null,
  lease_id            uuid references public.leases(id) on delete set null,
  rent_schedule_id    uuid references public.rent_schedules(id) on delete set null,
  deal_installment_id uuid references public.deal_installments(id) on delete set null,
  amount              numeric(14,2) not null check (amount > 0),
  currency            text not null default 'AED' references public.currencies(code),
  fx_rate_to_aed      numeric(18,8),     -- frozen at payment time so history never changes
  amount_aed          numeric(14,2),
  method              public.payment_method not null default 'bank_transfer',
  status              public.payment_status not null default 'completed',
  reference           text,
  paid_at             timestamptz not null default now(),
  received_by         uuid references public.profiles(id) on delete set null,
  receipt_path        text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payments_paid_idx     on public.payments (paid_at) where status = 'completed';
create index payments_contact_idx  on public.payments (contact_id);
create index payments_schedule_idx on public.payments (rent_schedule_id);
create index payments_inst_idx     on public.payments (deal_installment_id);
create index payments_invoice_idx  on public.payments (invoice_id);

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  description    text,
  vendor         text,
  amount         numeric(14,2) not null check (amount > 0),
  currency       text not null default 'AED' references public.currencies(code),
  fx_rate_to_aed numeric(18,8),
  amount_aed     numeric(14,2),
  incurred_on    date not null default current_date,
  property_id    uuid references public.properties(id) on delete set null,
  project_id     uuid references public.projects(id) on delete set null,
  deal_id        uuid references public.deals(id) on delete set null,
  receipt_path   text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (incurred_on, category);

-- ---------------------------------------------------------------------
-- 12. CONTENT, SEO, SYSTEM, AI LOGS, CLIENT FEATURES
-- ---------------------------------------------------------------------
create table public.posts (                   -- blog, market reports, area guides
  id               uuid primary key default gen_random_uuid(),
  locale           text not null check (locale in ('en','ar')),
  slug             text not null check (slug ~ '^[^\s/?#]+$'),
  title            text not null,
  excerpt          text,
  content          text,                     -- markdown
  cover_path       text,
  tags             text[] not null default '{}',
  area_id          uuid references public.areas(id) on delete set null,
  author_id        uuid references public.profiles(id) on delete set null,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (locale, slug)
);
create index posts_pub_idx on public.posts (locale, published_at desc);

create table public.slug_redirects (          -- filled automatically when a slug changes
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('property','project','area','post')),
  locale      text not null,
  old_slug    text not null,
  new_slug    text not null,
  created_at  timestamptz not null default now(),
  unique (entity_type, locale, old_slug)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index audit_logs_table_idx on public.audit_logs (table_name, changed_at desc);
create index audit_logs_user_idx  on public.audit_logs (changed_by, changed_at desc);

create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.profiles(id) on delete cascade,
  title      text,
  model      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant','tool','system')),
  content          text,
  model            text,
  prompt_tokens    int,
  completion_tokens int,
  created_at       timestamptz not null default now()
);
create index ai_messages_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_tool_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  message_id      uuid references public.ai_messages(id) on delete set null,
  admin_id        uuid not null references public.profiles(id) on delete cascade,
  tool_name       text not null,
  params          jsonb not null default '{}'::jsonb,
  row_count       int,
  duration_ms     int,
  status          text not null check (status in ('ok','error','denied')),
  error           text,
  created_at      timestamptz not null default now()
);
create index ai_tool_calls_idx on public.ai_tool_calls (admin_id, created_at desc);

create table public.favorites (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  filters          jsonb not null default '{}'::jsonb,
  alerts_enabled   boolean not null default true,
  frequency        text not null default 'daily' check (frequency in ('instant','daily','weekly')),
  last_notified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);

-- ---------------------------------------------------------------------
-- 13. BUSINESS LOGIC: FUNCTIONS AND TRIGGERS
-- ---------------------------------------------------------------------

-- 13.1 Role helpers (security definer so RLS policies can call them without recursion)
create function public.app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.app_role() = 'admin', false) $$;
create function public.is_agent() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.app_role() = 'agent', false) $$;
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.app_role() in ('admin','agent'), false) $$;
create function public.is_blocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.is_active)
$$;

-- 13.2 Access helpers used by policies
create function public.my_contact_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.contacts c where c.profile_id = (select auth.uid())
$$;

create function public.can_edit_property(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or (public.is_agent() and (
            exists (select 1 from public.properties p where p.id = pid and p.created_by = (select auth.uid()))
         or exists (select 1 from public.listings l where l.property_id = pid and l.agent_id = (select auth.uid()))))
$$;

create function public.can_edit_property_path(p text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return public.can_edit_property(p::uuid);
exception when invalid_text_representation then
  return false;
end $$;

create function public.is_property_public(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l where l.property_id = pid and l.status in ('published','reserved','sold','rented'))
      or exists (select 1 from public.units u join public.projects pr on pr.id = u.project_id
                 where u.property_id = pid and pr.is_published)
$$;

create function public.is_project_public(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = pid and p.is_published)
$$;

create function public.agent_has_lead(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leads l where l.id = lid and l.assigned_agent_id = (select auth.uid()))
$$;

create function public.agent_has_deal(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.deals d where d.id = did and d.agent_id = (select auth.uid()))
$$;

create function public.agent_has_contact(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contacts c where c.id = cid and (c.assigned_agent_id = (select auth.uid()) or c.created_by = (select auth.uid())))
      or exists (select 1 from public.leads l where l.contact_id = cid and l.assigned_agent_id = (select auth.uid()))
$$;

create function public.can_access_lead(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or public.agent_has_lead(lid)
      or exists (select 1 from public.leads l where l.id = lid and l.contact_id in (select public.my_contact_ids()))
$$;

create function public.can_see_deal(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or public.agent_has_deal(did)
      or exists (select 1 from public.deals d where d.id = did and d.contact_id in (select public.my_contact_ids()))
      or exists (select 1 from public.deal_parties dp where dp.deal_id = did and dp.contact_id in (select public.my_contact_ids()))
$$;

create function public.can_see_lease(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.leases l where l.id = lid and (
              l.agent_id = (select auth.uid())
           or l.tenant_contact_id in (select public.my_contact_ids())
           or l.landlord_contact_id in (select public.my_contact_ids())))
$$;

-- 13.3 Generic triggers
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create function public.set_geog() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geog := st_setsrid(st_makepoint(new.lng::float8, new.lat::float8), 4326)::geography;
  else
    new.geog := null;
  end if;
  return new;
end $$;
create trigger trg_geog before insert or update of lat, lng on public.areas      for each row execute function public.set_geog();
create trigger trg_geog before insert or update of lat, lng on public.projects   for each row execute function public.set_geog();
create trigger trg_geog before insert or update of lat, lng on public.properties for each row execute function public.set_geog();

create function public.set_price_aed() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.price_aed := round(new.price * public.rate_to_aed(new.currency), 2);
  return new;
end $$;
create trigger trg_price_aed before insert or update of price, currency on public.units for each row execute function public.set_price_aed();
create trigger trg_price_aed before insert or update of price, currency on public.deals for each row execute function public.set_price_aed();

-- 13.4 Auth: create a profile for every new auth user, link past inquiries after verification
create function public.link_contacts_to_profile(p_uid uuid, p_email text, p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if exists (select 1 from public.contacts where profile_id = p_uid) then return; end if;
  if p_email is not null then
    update public.contacts set profile_id = p_uid
    where id = (select id from public.contacts where profile_id is null and lower(email) = lower(p_email) limit 1);
  end if;
  if v_digits <> '' and not exists (select 1 from public.contacts where profile_id = p_uid) then
    update public.contacts set profile_id = p_uid
    where id = (select id from public.contacts where profile_id is null and phone in (v_digits, '+' || v_digits) limit 1);
  end if;
end $$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, phone, full_name, preferred_locale)
  values (new.id, new.email, new.phone,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end);
  -- role is ALWAYS 'client' here. Promote to agent/admin from the dashboard or SQL editor only.
  perform public.link_contacts_to_profile(
    new.id,
    case when new.email_confirmed_at is not null then new.email end,
    case when new.phone_confirmed_at is not null then new.phone end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.link_contacts_to_profile(
    new.id,
    case when new.email_confirmed_at is not null then new.email end,
    case when new.phone_confirmed_at is not null then new.phone end);
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at, phone_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

create function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() is null for the SQL editor and the service role, so you can bootstrap the first admin there.
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'Only an admin can change role or active status';
    end if;
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- 13.5 Contacts: normalise phone/email so duplicates are caught
create function public.contacts_normalize() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.email    := nullif(lower(btrim(new.email)), '');
  new.phone    := nullif(regexp_replace(coalesce(new.phone, ''),    '[^0-9+]', '', 'g'), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9+]', '', 'g'), '');
  return new;
end $$;
create trigger trg_contacts_normalize before insert or update on public.contacts for each row execute function public.contacts_normalize();

-- 13.6 Listings: price in AED, publishing rules
create function public.listings_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.price_aed := round(new.price * public.rate_to_aed(new.currency), 2);
  new.price_aed_normalized := case
    when new.purpose = 'sale' then new.price_aed
    else round(new.price_aed * case new.price_period when 'yearly' then 1 when 'monthly' then 12 when 'weekly' then 52 when 'daily' then 365 end, 2)
  end;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'Only an admin can publish a listing. Submit it for review instead.';
    end if;
    if public.setting_bool('require_permit_number', false) and nullif(btrim(coalesce(new.permit_number, '')), '') is null then
      raise exception 'A permit number is required to publish this listing';
    end if;
    new.published_at := coalesce(new.published_at, now());
    new.expires_at   := coalesce(new.expires_at, now() + make_interval(days => public.setting_int('listing_expiry_days', 90)));
  end if;
  return new;
end $$;
create trigger trg_listings_guard before insert or update on public.listings for each row execute function public.listings_guard();

-- 13.7 Slug changes create 301 redirect rows automatically
create function public.track_slug_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.slug_redirects (entity_type, locale, old_slug, new_slug)
    values (tg_argv[0], new.locale, old.slug, new.slug)
    on conflict (entity_type, locale, old_slug) do update set new_slug = excluded.new_slug;
    update public.slug_redirects set new_slug = new.slug
      where entity_type = tg_argv[0] and locale = new.locale and new_slug = old.slug and old_slug <> old.slug;
    delete from public.slug_redirects
      where entity_type = tg_argv[0] and locale = new.locale and old_slug = new.slug;
  end if;
  return new;
end $$;
create trigger trg_slug before update of slug on public.property_translations for each row execute function public.track_slug_change('property');
create trigger trg_slug before update of slug on public.project_translations  for each row execute function public.track_slug_change('project');
create trigger trg_slug before update of slug on public.area_translations     for each row execute function public.track_slug_change('area');
create trigger trg_slug before update of slug on public.posts                 for each row execute function public.track_slug_change('post');

-- 13.8 Leads
create function public.leads_before() returns trigger
language plpgsql set search_path = '' as $$
declare st record;
begin
  if tg_op = 'INSERT' then
    if new.stage_id is null then
      select id into new.stage_id from public.pipeline_stages where key = 'new';
    end if;
    new.sla_due_at := coalesce(new.sla_due_at, now() + make_interval(mins => public.setting_int('lead_sla_minutes', 5)));
  end if;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    select * into st from public.pipeline_stages where id = new.stage_id;
    new.status := case when st.is_won then 'won'::public.lead_status
                       when st.is_lost then 'lost'::public.lead_status
                       else 'open'::public.lead_status end;
    new.closed_at := case when new.status = 'open' then null else coalesce(new.closed_at, now()) end;
  end if;
  return new;
end $$;
create trigger trg_leads_before before insert or update on public.leads for each row execute function public.leads_before();

create function public.leads_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o text; n text;
begin
  if new.assigned_agent_id is not null and (tg_op = 'INSERT' or new.assigned_agent_id is distinct from old.assigned_agent_id) then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.assigned_agent_id, 'lead_assigned', 'New lead assigned', 'A lead needs a response.', jsonb_build_object('lead_id', new.id));
  end if;
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    select name_en into o from public.pipeline_stages where id = old.stage_id;
    select name_en into n from public.pipeline_stages where id = new.stage_id;
    insert into public.activities (lead_id, type, summary, created_by)
    values (new.id, 'status_change', 'Stage changed: ' || coalesce(o, '?') || ' to ' || coalesce(n, '?'), (select auth.uid()));
  end if;
  return null;
end $$;
create trigger trg_leads_after after insert or update on public.leads for each row execute function public.leads_after();

create function public.activities_touch_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_id is not null then
    update public.leads set
      last_activity_at  = now(),
      first_response_at = case
        when first_response_at is null and new.direction = 'outbound' and new.type in ('call','email','whatsapp','sms','meeting')
        then now() else first_response_at end
    where id = new.lead_id;
  end if;
  return null;
end $$;
create trigger trg_activities_touch after insert on public.activities for each row execute function public.activities_touch_lead();

-- 13.9 Off-plan unit reservations (with expiry timer)
create function public.reservations_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.unit_status;
begin
  if new.status = 'active' then
    select status into v from public.units where id = new.unit_id for update;
    if v is null then raise exception 'Unit not found'; end if;
    if v <> 'available' then raise exception 'This unit is not available (status: %)', v; end if;
    new.expires_at := coalesce(new.expires_at, now() + make_interval(hours => public.setting_int('reservation_hours', 48)));
    update public.units set status = 'reserved', reserved_until = new.expires_at where id = new.unit_id;
  end if;
  return new;
end $$;
create trigger trg_reservations_before before insert on public.unit_reservations for each row execute function public.reservations_before();

create function public.reservations_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and new.status is distinct from 'active' then
    if new.status in ('cancelled','expired') then
      update public.units set status = 'available', reserved_until = null where id = new.unit_id and status = 'reserved';
    elsif new.status = 'converted' then
      update public.units set status = 'booked', reserved_until = null where id = new.unit_id and status in ('reserved','available');
    end if;
  end if;
  return null;
end $$;
create trigger trg_reservations_after after update on public.unit_reservations for each row execute function public.reservations_after();

-- 13.10 Deals and commissions
create function public.deals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'Only an admin can close a deal';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end $$;
create trigger trg_deals_guard before insert or update on public.deals for each row execute function public.deals_guard();

create function public.deals_after_close() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    if new.agent_id is not null then
      insert into public.commissions (deal_id, agent_id, rate, amount, currency)
      select new.id, new.agent_id, s.commission_rate, round(new.price * s.commission_rate / 100, 2), new.currency
      from public.agent_settings s where s.id = new.agent_id
      on conflict (deal_id, agent_id) do nothing;
    end if;
    if new.listing_id is not null then
      update public.listings
         set status = case when new.type = 'rent' then 'rented'::public.listing_status else 'sold'::public.listing_status end
       where id = new.listing_id;
    end if;
    if new.unit_id is not null then
      update public.units set status = 'sold', reserved_until = null where id = new.unit_id;
    end if;
    if new.lead_id is not null then
      update public.leads set stage_id = (select id from public.pipeline_stages where is_won limit 1)
       where id = new.lead_id and status = 'open';
    end if;
  end if;
  return null;
end $$;
create trigger trg_deals_after after insert or update on public.deals for each row execute function public.deals_after_close();

-- 13.11 Money: freeze exchange rate at transaction time
create function public.payments_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    new.fx_rate_to_aed := coalesce(new.fx_rate_to_aed, public.rate_to_aed(new.currency, new.paid_at::date));
  end if;
  new.amount_aed := round(new.amount * new.fx_rate_to_aed, 2);

  if new.rent_schedule_id is not null and not exists
     (select 1 from public.rent_schedules s where s.id = new.rent_schedule_id and s.currency = new.currency) then
    raise exception 'Payment currency must match the rent schedule currency';
  end if;
  if new.deal_installment_id is not null and not exists
     (select 1 from public.deal_installments s where s.id = new.deal_installment_id and s.currency = new.currency) then
    raise exception 'Payment currency must match the installment currency';
  end if;
  if new.invoice_id is not null and not exists
     (select 1 from public.invoices s where s.id = new.invoice_id and s.currency = new.currency) then
    raise exception 'Payment currency must match the invoice currency';
  end if;
  return new;
end $$;
create trigger trg_payments_before before insert or update on public.payments for each row execute function public.payments_before();

create function public.recompute_targets(p_rs uuid, p_di uuid, p_inv uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_rs is not null then
    update public.rent_schedules s set paid_amount = coalesce(
      (select sum(p.amount) from public.payments p where p.rent_schedule_id = s.id and p.status = 'completed'), 0)
    where s.id = p_rs;
    update public.rent_schedules s set status = case
        when s.paid_amount >= s.amount and s.amount > 0 then 'paid'::public.schedule_status
        when s.paid_amount > 0 then 'partial'::public.schedule_status
        when s.due_date < current_date then 'overdue'::public.schedule_status
        else 'scheduled'::public.schedule_status end
    where s.id = p_rs and s.status <> 'waived';
  end if;
  if p_di is not null then
    update public.deal_installments s set paid_amount = coalesce(
      (select sum(p.amount) from public.payments p where p.deal_installment_id = s.id and p.status = 'completed'), 0)
    where s.id = p_di;
    update public.deal_installments s set status = case
        when s.paid_amount >= s.amount and s.amount > 0 then 'paid'::public.schedule_status
        when s.paid_amount > 0 then 'partial'::public.schedule_status
        when s.due_date < current_date then 'overdue'::public.schedule_status
        else 'scheduled'::public.schedule_status end
    where s.id = p_di and s.status <> 'waived';
  end if;
  if p_inv is not null then
    update public.invoices i set paid_amount = coalesce(
      (select sum(p.amount) from public.payments p where p.invoice_id = i.id and p.status = 'completed'), 0)
    where i.id = p_inv;
    update public.invoices i set status = case
        when i.paid_amount >= i.total and i.total > 0 then 'paid'::public.invoice_status
        when i.paid_amount > 0 then 'partial'::public.invoice_status
        when i.status in ('paid','partial') then 'sent'::public.invoice_status
        else i.status end
    where i.id = p_inv and i.status <> 'void';
  end if;
end $$;
revoke execute on function public.recompute_targets(uuid, uuid, uuid) from public, anon, authenticated;

create function public.payments_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recompute_targets(new.rent_schedule_id, new.deal_installment_id, new.invoice_id);
  end if;
  if tg_op in ('UPDATE','DELETE') then
    perform public.recompute_targets(old.rent_schedule_id, old.deal_installment_id, old.invoice_id);
  end if;
  return null;
end $$;
create trigger trg_payments_after after insert or update or delete on public.payments for each row execute function public.payments_after();

create function public.expenses_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    new.fx_rate_to_aed := coalesce(new.fx_rate_to_aed, public.rate_to_aed(new.currency, new.incurred_on));
  end if;
  new.amount_aed := round(new.amount * new.fx_rate_to_aed, 2);
  return new;
end $$;
create trigger trg_expenses_before before insert or update on public.expenses for each row execute function public.expenses_before();

create function public.commissions_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    new.fx_rate_to_aed := coalesce(new.fx_rate_to_aed, public.rate_to_aed(new.currency));
  end if;
  new.amount_aed := round(new.amount * new.fx_rate_to_aed, 2);
  return new;
end $$;
create trigger trg_commissions_before before insert or update on public.commissions for each row execute function public.commissions_before();

create function public.invoice_items_recalc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  v := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  update public.invoices i set
    subtotal   = s.sub,
    vat_amount = round(s.sub * i.vat_rate / 100, 2),
    total      = s.sub + round(s.sub * i.vat_rate / 100, 2)
  from (select coalesce(sum(line_total), 0) as sub from public.invoice_items where invoice_id = v) s
  where i.id = v;
  return null;
end $$;
create trigger trg_invoice_items_recalc after insert or update or delete on public.invoice_items for each row execute function public.invoice_items_recalc();

-- 13.12 Audit trail on sensitive tables
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (table_name, record_id, action, new_data, changed_by)
    values (tg_table_name::text, to_jsonb(new) ->> 'id', 'INSERT', to_jsonb(new), (select auth.uid()));
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
      values (tg_table_name::text, to_jsonb(new) ->> 'id', 'UPDATE', to_jsonb(old), to_jsonb(new), (select auth.uid()));
    end if;
  else
    insert into public.audit_logs (table_name, record_id, action, old_data, changed_by)
    values (tg_table_name::text, to_jsonb(old) ->> 'id', 'DELETE', to_jsonb(old), (select auth.uid()));
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','agent_settings','listings','units','unit_reservations','deals','commissions',
                           'payments','invoices','expenses','leases','rent_schedules','deal_installments','security_deposits','exchange_rates']
  loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- 13.13 Schedules generators (callable from the dashboards)
create function public.generate_deal_installments(p_deal_id uuid, p_plan_id uuid, p_start date default current_date) returns int
language plpgsql security definer set search_path = '' as $$
declare d record; m record; v_total numeric; v_n int; v_i int := 0; v_sum numeric := 0; v_amt numeric; v_due date; v_hand date;
begin
  if (select auth.uid()) is not null and not (public.is_admin() or public.agent_has_deal(p_deal_id)) then
    raise exception 'Not allowed';
  end if;
  select * into d from public.deals where id = p_deal_id;
  if not found then raise exception 'Deal not found'; end if;
  if exists (select 1 from public.deal_installments where deal_id = p_deal_id) then
    raise exception 'Installments already exist for this deal';
  end if;
  select coalesce(sum(percentage), 0), count(*) into v_total, v_n
  from public.payment_plan_milestones where payment_plan_id = p_plan_id;
  if v_n = 0 then raise exception 'The payment plan has no milestones'; end if;
  if v_total <> 100 then raise exception 'Payment plan percentages must add up to 100 (got %)', v_total; end if;

  select pr.handover_date into v_hand from public.units u join public.projects pr on pr.id = u.project_id where u.id = d.unit_id;

  for m in select * from public.payment_plan_milestones where payment_plan_id = p_plan_id order by sort_order loop
    v_i := v_i + 1;
    v_due := case
      when m.fixed_date is not null then m.fixed_date
      when m.trigger_type = 'on_handover'   then coalesce(v_hand, p_start)
      when m.trigger_type = 'post_handover' then coalesce(v_hand, p_start) + coalesce(m.due_offset_days, 0)
      else p_start + coalesce(m.due_offset_days, 0) end;
    v_amt := case when v_i = v_n then d.price - v_sum else round(d.price * m.percentage / 100, 2) end;
    v_sum := v_sum + v_amt;
    insert into public.deal_installments (deal_id, milestone_id, sort_order, label_en, label_ar, due_date, amount, currency)
    values (p_deal_id, m.id, v_i, m.label_en, m.label_ar, v_due, v_amt, d.currency);
  end loop;
  return v_n;
end $$;

create function public.generate_rent_schedule(p_lease_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare l record; n_months int; n int; step int; total numeric; v_sum numeric := 0; v_amt numeric; i int;
begin
  select * into l from public.leases where id = p_lease_id;
  if not found then raise exception 'Lease not found'; end if;
  if (select auth.uid()) is not null and not (public.is_admin() or l.agent_id = (select auth.uid())) then
    raise exception 'Not allowed';
  end if;
  if exists (select 1 from public.rent_schedules where lease_id = p_lease_id) then
    raise exception 'A rent schedule already exists for this lease';
  end if;

  n_months := greatest(1, (extract(year from age(l.end_date + 1, l.start_date)) * 12
                         + extract(month from age(l.end_date + 1, l.start_date)))::int);
  case l.frequency
    when 'monthly'     then step := 1;  n := n_months;
    when 'quarterly'   then step := 3;  n := ceil(n_months / 3.0)::int;
    when 'semi_annual' then step := 6;  n := ceil(n_months / 6.0)::int;
    when 'annual'      then step := 12; n := ceil(n_months / 12.0)::int;
    else n := coalesce(l.number_of_cheques, 1); step := greatest(1, n_months / n);
  end case;
  total := round(l.annual_rent * n_months / 12.0, 2);

  for i in 1..n loop
    v_amt := case when i = n then total - v_sum else round(total / n, 2) end;
    v_sum := v_sum + v_amt;
    insert into public.rent_schedules (lease_id, sort_order, due_date, amount, currency)
    values (p_lease_id, i, (l.start_date + make_interval(months => (i - 1) * step))::date, v_amt, l.currency);
  end loop;
  return n;
end $$;

-- 13.14 Lead capture from the public website (anonymous-safe)
create function public.pick_agent() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  select p.id into v
  from public.profiles p
  join public.agent_settings s on s.id = p.id
  where p.role = 'agent' and p.is_active and s.accepts_leads
  order by (select count(*) from public.leads l where l.assigned_agent_id = p.id and l.status = 'open'),
           s.last_assigned_at nulls first
  limit 1;
  if v is not null then
    update public.agent_settings set last_assigned_at = now() where id = v;
  end if;
  return v;
end $$;
revoke execute on function public.pick_agent() from public, anon, authenticated;

create function public.submit_inquiry(
  p_full_name   text,
  p_email       text default null,
  p_phone       text default null,
  p_message     text default null,
  p_listing_id  uuid default null,
  p_project_id  uuid default null,
  p_intent      text default 'buy',
  p_locale      text default 'en',
  p_source_key  text default 'website',
  p_viewing_at  timestamptz default null,
  p_utm         jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_intent public.lead_intent;
  v_locale text := case when p_locale = 'ar' then 'ar' else 'en' end;
  v_contact uuid; v_lead uuid; v_agent uuid; v_source uuid; v_property uuid; v_recent int;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Please enter your name'; end if;
  if v_email is null and v_phone is null then raise exception 'Please enter an email or phone number'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  if v_phone is not null and char_length(v_phone) not between 7 and 16 then raise exception 'Invalid phone number'; end if;
  if p_message is not null and char_length(p_message) > 2000 then raise exception 'Message is too long'; end if;
  if p_utm is not null and char_length(p_utm::text) > 2000 then p_utm := '{}'::jsonb; end if;

  v_intent := case when p_intent in ('buy','rent','invest','sell','list_property') then p_intent::public.lead_intent else 'buy'::public.lead_intent end;
  select id into v_source from public.lead_sources where key = coalesce(p_source_key, 'website');

  -- Resolve the listing, its property and its agent
  if p_listing_id is not null then
    select l.property_id,
           (select p.id from public.profiles p where p.id = l.agent_id and p.role = 'agent' and p.is_active)
      into v_property, v_agent
    from public.listings l
    where l.id = p_listing_id and l.status in ('published','reserved');
    if not found then p_listing_id := null; end if;
  end if;
  if p_project_id is not null and not exists (select 1 from public.projects where id = p_project_id and is_published) then
    p_project_id := null;
  end if;
  v_agent := coalesce(v_agent, public.pick_agent());

  -- Reuse an existing contact (matched by email or phone) or create one
  select id into v_contact from public.contacts
   where (v_email is not null and lower(email) = v_email) or (v_phone is not null and phone = v_phone)
   order by created_at limit 1;
  if v_contact is null then
    insert into public.contacts (full_name, email, phone, preferred_locale, source_id, assigned_agent_id, type)
    values (v_name, v_email, v_phone, v_locale, v_source, v_agent,
            case v_intent when 'rent' then 'tenant'::public.contact_type
                          when 'sell' then 'landlord'::public.contact_type
                          when 'list_property' then 'landlord'::public.contact_type
                          when 'invest' then 'investor'::public.contact_type
                          else 'buyer'::public.contact_type end)
    returning id into v_contact;
  else
    select count(*) into v_recent from public.leads where contact_id = v_contact and created_at > now() - interval '1 hour';
    if v_recent >= 5 then raise exception 'Too many requests. Please try again later.'; end if;
  end if;

  insert into public.leads (contact_id, source_id, intent, assigned_agent_id, listing_id, property_id, project_id, message, locale, utm)
  values (v_contact, v_source, v_intent, v_agent, p_listing_id, v_property, p_project_id, nullif(btrim(coalesce(p_message, '')), ''), v_locale, coalesce(p_utm, '{}'::jsonb))
  returning id into v_lead;

  if nullif(btrim(coalesce(p_message, '')), '') is not null then
    insert into public.activities (lead_id, contact_id, type, direction, summary, body)
    values (v_lead, v_contact, 'note', 'inbound', 'Website enquiry', btrim(p_message));
  end if;

  if p_viewing_at is not null and p_viewing_at > now() then
    insert into public.viewings (listing_id, property_id, lead_id, contact_id, agent_id, scheduled_at, status, requested_via)
    values (p_listing_id, v_property, v_lead, v_contact, v_agent, p_viewing_at, 'requested', 'website');
  end if;
  return v_lead;
end $$;
revoke execute on function public.submit_inquiry(text,text,text,text,uuid,uuid,text,text,text,timestamptz,jsonb) from public;
grant  execute on function public.submit_inquiry(text,text,text,text,uuid,uuid,text,text,text,timestamptz,jsonb) to anon, authenticated;

-- 13.15 Admin dashboard KPIs
create function public.admin_kpis() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'active_listings',      (select count(*) from public.listings where status = 'published'),
    'open_leads',           (select count(*) from public.leads where status = 'open'),
    'new_leads_30d',        (select count(*) from public.leads where created_at >= now() - interval '30 days'),
    'won_leads_30d',        (select count(*) from public.leads where status = 'won' and closed_at >= now() - interval '30 days'),
    'revenue_mtd_aed',      (select coalesce(sum(amount_aed), 0) from public.payments where status = 'completed' and paid_at >= date_trunc('month', now())),
    'overdue_rent_aed',     (select coalesce(sum((amount - paid_amount) * public.rate_to_aed(currency)), 0) from public.rent_schedules where status in ('scheduled','partial','overdue') and due_date < current_date),
    'leads_breaching_sla',  (select count(*) from public.leads where status = 'open' and first_response_at is null and sla_due_at < now()),
    'leases_expiring_90d',  (select count(*) from public.leases where status in ('active','expiring') and end_date <= current_date + 90)
  );
end $$;

-- 13.16 Scheduled maintenance (called by pg_cron, never by users)
create function public.escalate_overdue_leads() returns void
language plpgsql security definer set search_path = '' as $$
begin
  with l as (
    update public.leads set escalated_at = now()
     where status = 'open' and first_response_at is null and escalated_at is null and sla_due_at < now()
    returning id, assigned_agent_id
  ), to_admins as (
    insert into public.notifications (user_id, type, title, body, data)
    select a.id, 'lead_sla_breach', 'Lead not contacted in time', 'A lead has passed its response time.', jsonb_build_object('lead_id', l.id)
    from l cross join (select id from public.profiles where role = 'admin' and is_active) a
    returning 1
  )
  insert into public.notifications (user_id, type, title, body, data)
  select l.assigned_agent_id, 'lead_sla_breach', 'Respond to your lead now', 'This lead has passed its response time.', jsonb_build_object('lead_id', l.id)
  from l where l.assigned_agent_id is not null;
end $$;

create function public.send_lease_reminders() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select x.uid, 'lease_expiry_' || d.days, 'Lease expiring in ' || d.days || ' days', 'A lease is approaching its end date.',
         jsonb_build_object('lease_id', l.id, 'days', d.days)
  from public.leases l
  cross join (values (90), (60), (30)) as d(days)
  cross join lateral unnest(array[
      l.agent_id,
      (select c.profile_id from public.contacts c where c.id = l.tenant_contact_id),
      (select c.profile_id from public.contacts c where c.id = l.landlord_contact_id)]) as x(uid)
  where l.status in ('active','expiring') and l.end_date = current_date + d.days and x.uid is not null
    and not exists (select 1 from public.notifications n
                    where n.user_id = x.uid and n.type = 'lease_expiry_' || d.days and n.data ->> 'lease_id' = l.id::text);

  insert into public.notifications (user_id, type, title, body, data)
  select c.profile_id, 'rent_due', 'Rent due in 3 days', 'An instalment is due soon.', jsonb_build_object('rent_schedule_id', s.id, 'lease_id', s.lease_id)
  from public.rent_schedules s
  join public.leases l on l.id = s.lease_id
  join public.contacts c on c.id = l.tenant_contact_id
  where s.status in ('scheduled','partial') and s.due_date = current_date + 3 and c.profile_id is not null
    and not exists (select 1 from public.notifications n where n.user_id = c.profile_id and n.type = 'rent_due' and n.data ->> 'rent_schedule_id' = s.id::text);
end $$;

create function public.daily_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings set status = 'expired' where status = 'published' and expires_at < now();

  -- the AFTER trigger on unit_reservations releases each unit back to 'available'
  update public.unit_reservations set status = 'expired' where status = 'active' and expires_at < now();

  update public.leases set status = 'expired'  where status in ('active','expiring') and end_date < current_date;
  update public.leases set status = 'expiring' where status = 'active' and end_date between current_date and current_date + 90;
  update public.rent_schedules     set status = 'overdue' where status = 'scheduled' and due_date < current_date;
  update public.deal_installments  set status = 'overdue' where status = 'scheduled' and due_date < current_date;
  update public.invoices           set status = 'overdue' where status = 'sent' and due_date < current_date;
  perform public.send_lease_reminders();
end $$;

revoke execute on function public.escalate_overdue_leads(), public.send_lease_reminders(), public.daily_maintenance()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 13b. PUBLIC STATS VIEW (programmatic SEO: prices per area)
-- ---------------------------------------------------------------------
create view public.area_stats with (security_invoker = true) as
select p.area_id,
       l.purpose,
       count(*)                                                   as listings_count,
       round(avg(l.price_aed_normalized), 0)                      as avg_price_aed,
       round(avg(l.price_aed_normalized / nullif(p.size_sqft, 0)), 0) as avg_price_per_sqft_aed
from public.listings l
join public.properties p on p.id = l.property_id
where l.status = 'published'
group by p.area_id, l.purpose;

-- ---------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (every table; no policy = no access)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Defense in depth on grants
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated, anon;
grant usage on sequence public.property_ref_seq, public.invoice_no_seq to authenticated;

-- Admin: full access to everything except the audit log (read-only there)
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'audit_logs' loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- A deactivated account loses ALL access, whatever other rules say (RESTRICTIVE policies are ANDed with everything else)
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create policy active_only on public.%I as restrictive for all to authenticated using ((select not public.is_blocked())) with check ((select not public.is_blocked()))', t);
  end loop;
end $$;

create policy admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- Public website: read-only catalog and published content
create policy pub_read on public.currencies         for select to anon, authenticated using (true);
create policy pub_read on public.exchange_rates     for select to anon, authenticated using (true);
create policy pub_read on public.amenities          for select to anon, authenticated using (true);
create policy pub_read on public.area_translations  for select to anon, authenticated using (true);
create policy pub_read on public.slug_redirects     for select to anon, authenticated using (true);
create policy pub_read on public.developers         for select to anon, authenticated using (is_active);
create policy pub_read on public.areas              for select to anon, authenticated using (is_active);
create policy pub_read on public.agent_profiles     for select to anon, authenticated using (is_public);
create policy pub_read on public.site_settings      for select to anon, authenticated using (is_public);
create policy pub_read on public.posts              for select to anon, authenticated using (published_at is not null and published_at <= now());

-- Off-plan projects: public when published, staff see everything
create policy pub_read   on public.projects             for select to anon, authenticated using (is_published);
create policy staff_read on public.projects             for select to authenticated using (public.is_staff());
create policy pub_read   on public.project_translations for select to anon, authenticated using (public.is_project_public(project_id));
create policy staff_read on public.project_translations for select to authenticated using (public.is_staff());
create policy pub_read   on public.project_media        for select to anon, authenticated using (public.is_project_public(project_id));
create policy staff_read on public.project_media        for select to authenticated using (public.is_staff());
create policy pub_read   on public.project_updates      for select to anon, authenticated using (public.is_project_public(project_id));
create policy staff_read on public.project_updates      for select to authenticated using (public.is_staff());
create policy pub_read   on public.buildings            for select to anon, authenticated using (public.is_project_public(project_id));
create policy staff_read on public.buildings            for select to authenticated using (public.is_staff());
create policy pub_read   on public.floors               for select to anon, authenticated using (exists (select 1 from public.buildings b where b.id = building_id));
create policy staff_read on public.floors               for select to authenticated using (public.is_staff());
create policy pub_read   on public.units                for select to anon, authenticated using (public.is_project_public(project_id));
create policy staff_read on public.units                for select to authenticated using (public.is_staff());
create policy pub_read   on public.payment_plans        for select to anon, authenticated using (project_id is not null and public.is_project_public(project_id));
create policy staff_read on public.payment_plans        for select to authenticated using (public.is_staff());
create policy pub_read   on public.payment_plan_milestones for select to anon, authenticated using (exists (select 1 from public.payment_plans pp where pp.id = payment_plan_id));
create policy staff_read on public.payment_plan_milestones for select to authenticated using (public.is_staff());

-- Properties: public when they have a live listing (or belong to a published project)
create policy pub_read on public.properties             for select to anon, authenticated using (public.is_property_public(id));
create policy pub_read on public.property_translations  for select to anon, authenticated using (public.is_property_public(property_id));
create policy pub_read on public.property_media         for select to anon, authenticated using (public.is_property_public(property_id));
create policy pub_read on public.property_amenities     for select to anon, authenticated using (public.is_property_public(property_id));

-- Agents: manage the properties they created or are listing
create policy agent_select on public.properties for select to authenticated using (public.can_edit_property(id));
create policy agent_own_select on public.properties for select to authenticated using (created_by = (select auth.uid()));  -- needed so INSERT ... RETURNING can see the new row
create policy agent_insert on public.properties for insert to authenticated with check (public.is_agent() and created_by = (select auth.uid()));
create policy agent_update on public.properties for update to authenticated using (public.can_edit_property(id)) with check (public.can_edit_property(id));

create policy agent_all on public.property_internal     for all to authenticated using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));
create policy agent_all on public.property_translations for all to authenticated using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));
create policy agent_all on public.property_media        for all to authenticated using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));
create policy agent_all on public.property_amenities    for all to authenticated using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));
create policy agent_all on public.property_documents    for all to authenticated using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));

-- Listings
create policy pub_read      on public.listings for select to anon, authenticated using (status in ('published','reserved','sold','rented'));
create policy agent_select  on public.listings for select to authenticated using (agent_id = (select auth.uid()));
create policy agent_insert  on public.listings for insert to authenticated
  with check (public.is_agent() and agent_id = (select auth.uid()) and public.can_edit_property(property_id));
create policy agent_update  on public.listings for update to authenticated
  using (agent_id = (select auth.uid()))
  with check (agent_id = (select auth.uid()) and public.can_edit_property(property_id));
create policy agent_delete  on public.listings for delete to authenticated using (agent_id = (select auth.uid()) and status = 'draft');

-- Off-plan reservations (agents create and cancel their own)
create policy agent_select on public.unit_reservations for select to authenticated using (agent_id = (select auth.uid()));
create policy agent_insert on public.unit_reservations for insert to authenticated with check (public.is_agent() and agent_id = (select auth.uid()) and status = 'active');
create policy agent_update on public.unit_reservations for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));

-- Identity
create policy own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy own_select on public.agent_profiles for select to authenticated using (id = (select auth.uid()));
create policy own_update on public.agent_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy own_select on public.agent_settings for select to authenticated using (id = (select auth.uid()));

-- CRM lookups
create policy staff_read on public.lead_sources      for select to authenticated using (public.is_staff());
create policy staff_read on public.pipeline_stages   for select to authenticated using (public.is_staff());
create policy staff_read on public.message_templates for select to authenticated using (public.is_staff());

-- Contacts
create policy agent_select  on public.contacts for select to authenticated using (public.is_agent() and public.agent_has_contact(id));
create policy agent_own_select on public.contacts for select to authenticated using (created_by = (select auth.uid()));  -- so INSERT ... RETURNING can see the new row
create policy agent_insert  on public.contacts for insert to authenticated with check (public.is_agent() and created_by = (select auth.uid()));
create policy agent_update  on public.contacts for update to authenticated using (public.is_agent() and public.agent_has_contact(id)) with check (public.is_agent() and public.agent_has_contact(id));
create policy client_select on public.contacts for select to authenticated using (profile_id = (select auth.uid()));

-- Leads
create policy agent_select  on public.leads for select to authenticated using (assigned_agent_id = (select auth.uid()));
create policy agent_insert  on public.leads for insert to authenticated with check (public.is_agent() and assigned_agent_id = (select auth.uid()) and created_by = (select auth.uid()));
create policy agent_update  on public.leads for update to authenticated using (assigned_agent_id = (select auth.uid())) with check (assigned_agent_id = (select auth.uid()));
create policy client_select on public.leads for select to authenticated using (contact_id in (select public.my_contact_ids()));

create policy agent_select on public.activities for select to authenticated using (
  public.is_agent() and (created_by = (select auth.uid())
    or (lead_id is not null and public.agent_has_lead(lead_id))
    or (deal_id is not null and public.agent_has_deal(deal_id))));
create policy agent_insert on public.activities for insert to authenticated with check (
  public.is_agent() and created_by = (select auth.uid())
  and (lead_id is null or public.agent_has_lead(lead_id))
  and (deal_id is null or public.agent_has_deal(deal_id))
  and (contact_id is null or public.agent_has_contact(contact_id)));

create policy agent_all on public.tasks for all to authenticated
  using (public.is_agent() and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  with check (public.is_agent() and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())));

create policy agent_select  on public.viewings for select to authenticated using (agent_id = (select auth.uid()) or created_by = (select auth.uid()));
create policy agent_insert  on public.viewings for insert to authenticated with check (public.is_agent() and created_by = (select auth.uid()));
create policy agent_update  on public.viewings for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));
create policy client_select on public.viewings for select to authenticated using (contact_id in (select public.my_contact_ids()));
create policy client_insert on public.viewings for insert to authenticated with check (contact_id in (select public.my_contact_ids()) and status = 'requested');
create policy client_cancel on public.viewings for update to authenticated
  using (contact_id in (select public.my_contact_ids()) and status in ('requested','confirmed'))
  with check (contact_id in (select public.my_contact_ids()) and status = 'cancelled');

create policy chat_select on public.lead_messages for select to authenticated using (public.can_access_lead(lead_id));
create policy chat_insert on public.lead_messages for insert to authenticated with check (sender_id = (select auth.uid()) and public.can_access_lead(lead_id));
create policy chat_read   on public.lead_messages for update to authenticated using (public.can_access_lead(lead_id) and sender_id <> (select auth.uid())) with check (public.can_access_lead(lead_id));

-- Deals and money views for agents and clients
create policy see_select   on public.deals for select to authenticated using (public.can_see_deal(id));
create policy agent_own_select on public.deals for select to authenticated using (agent_id = (select auth.uid()));  -- so INSERT ... RETURNING can see the new row
create policy agent_insert on public.deals for insert to authenticated with check (public.is_agent() and agent_id = (select auth.uid()) and created_by = (select auth.uid()));
create policy agent_update on public.deals for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));

create policy see_select   on public.deal_parties for select to authenticated using (public.can_see_deal(deal_id));
create policy agent_write  on public.deal_parties for insert to authenticated with check (public.is_agent() and public.agent_has_deal(deal_id));
create policy agent_delete on public.deal_parties for delete to authenticated using (public.is_agent() and public.agent_has_deal(deal_id));

create policy own_select on public.commissions        for select to authenticated using (agent_id = (select auth.uid()));
create policy see_select on public.deal_installments  for select to authenticated using (public.can_see_deal(deal_id));

-- Rentals
create policy see_select   on public.leases for select to authenticated using (public.can_see_lease(id));
create policy agent_insert on public.leases for insert to authenticated with check (public.is_agent() and agent_id = (select auth.uid()) and created_by = (select auth.uid()));
create policy agent_update on public.leases for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));
create policy see_select on public.rent_schedules    for select to authenticated using (public.can_see_lease(lease_id));
create policy see_select on public.security_deposits for select to authenticated using (public.can_see_lease(lease_id));
create policy see_select on public.renewals          for select to authenticated using (public.can_see_lease(lease_id));

create policy see_select on public.maintenance_requests for select to authenticated
  using (requested_by = (select auth.uid()) or (lease_id is not null and public.can_see_lease(lease_id)));
create policy tenant_insert on public.maintenance_requests for insert to authenticated
  with check (requested_by = (select auth.uid()) and lease_id is not null and public.can_see_lease(lease_id));
create policy agent_update on public.maintenance_requests for update to authenticated
  using (public.is_agent() and lease_id is not null and public.can_see_lease(lease_id))
  with check (public.is_agent() and lease_id is not null and public.can_see_lease(lease_id));

-- Finance: clients see only their own invoices and payments
create policy client_select on public.invoices      for select to authenticated using (contact_id in (select public.my_contact_ids()));
create policy client_select on public.invoice_items for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy client_select on public.payments      for select to authenticated using (contact_id in (select public.my_contact_ids()));

-- Personal data
create policy own_all on public.notifications   for select to authenticated using (user_id = (select auth.uid()));
create policy own_upd on public.notifications   for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_all on public.favorites       for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_all on public.saved_searches  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 15. STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('property-media', 'property-media', true,  52428800, array['image/jpeg','image/png','image/webp','image/avif','video/mp4']),
  ('project-media',  'project-media',  true,  52428800, array['image/jpeg','image/png','image/webp','image/avif','video/mp4','application/pdf']),
  ('avatars',        'avatars',        true,   2097152, array['image/jpeg','image/png','image/webp']),
  ('documents',      'documents',      false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('contracts',      'contracts',      false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Convention: property-media/{property_id}/{file}; avatars, documents, contracts/{profile_id}/{file}
create policy "jilo property media write" on storage.objects for all to authenticated
  using      (bucket_id = 'property-media' and public.can_edit_property_path((storage.foldername(name))[1]))
  with check (bucket_id = 'property-media' and public.can_edit_property_path((storage.foldername(name))[1]));
create policy "jilo staff list media" on storage.objects for select to authenticated
  using (bucket_id in ('property-media','project-media') and public.is_staff());
create policy "jilo project media admin" on storage.objects for all to authenticated
  using (bucket_id = 'project-media' and public.is_admin()) with check (bucket_id = 'project-media' and public.is_admin());
create policy "jilo avatars own" on storage.objects for all to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "jilo documents staff" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_staff()) with check (bucket_id = 'documents' and public.is_staff());
create policy "jilo documents own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "jilo documents own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "jilo contracts staff" on storage.objects for all to authenticated
  using (bucket_id = 'contracts' and public.is_staff()) with check (bucket_id = 'contracts' and public.is_staff());
create policy "jilo contracts own" on storage.objects for select to authenticated
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 16. READ-ONLY AI SCHEMA AND ROLE (OpenRouter assistant, admin only)
--   * The AI server connects as ai_readonly and can ONLY read the views in schema "ai".
--   * Views are aggregates or masked (no emails, phones, IDs, bank details).
--   * After running this script, set a password ONCE (not stored in this file):
--       alter role ai_readonly with login password '<long random password>';
--     and connect with the pooler user  ai_readonly.<project-ref>
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'ai_readonly') then
    create role ai_readonly nologin noinherit;
  end if;
end $$;
alter role ai_readonly set statement_timeout = '5s';
alter role ai_readonly set default_transaction_read_only = on;
alter role ai_readonly set idle_in_transaction_session_timeout = '10s';

create schema if not exists ai;
revoke all on all tables in schema public from ai_readonly;
grant usage on schema ai to ai_readonly;

create function ai.mask_name(n text) returns text language sql immutable as $$
  select nullif(btrim(split_part(coalesce(n,''), ' ', 1) || coalesce(' ' || nullif(left(split_part(coalesce(n,''), ' ', 2), 1), '') || '.', '')), '')
$$;

create view ai.revenue_monthly as
  select date_trunc('month', paid_at)::date as month, count(*) as payments_count, round(sum(amount_aed), 2) as revenue_aed
  from public.payments where status = 'completed' group by 1;

create view ai.expenses_monthly as
  select date_trunc('month', incurred_on)::date as month, category, count(*) as expenses_count, round(sum(amount_aed), 2) as total_aed
  from public.expenses group by 1, 2;

create view ai.agent_leads_monthly as
  select date_trunc('month', l.created_at)::date as month,
         l.assigned_agent_id as agent_id,
         coalesce(a.display_name_en, p.full_name, 'Unassigned') as agent_name,
         count(*) as leads_created,
         count(*) filter (where l.status = 'won')  as leads_won,
         count(*) filter (where l.status = 'lost') as leads_lost,
         round(100.0 * count(*) filter (where l.status = 'won') / nullif(count(*), 0), 1) as win_rate_pct
  from public.leads l
  left join public.profiles p on p.id = l.assigned_agent_id
  left join public.agent_profiles a on a.id = l.assigned_agent_id
  group by 1, 2, 3;

create view ai.agent_deals_monthly as
  select date_trunc('month', d.closed_at)::date as month,
         d.agent_id,
         coalesce(a.display_name_en, p.full_name, 'Unassigned') as agent_name,
         d.type as deal_type,
         count(*) as deals_closed,
         round(sum(d.price_aed), 2) as deal_value_aed
  from public.deals d
  left join public.profiles p on p.id = d.agent_id
  left join public.agent_profiles a on a.id = d.agent_id
  where d.status = 'closed'
  group by 1, 2, 3, 4;

create view ai.commissions_monthly as
  select date_trunc('month', d.closed_at)::date as month,
         c.agent_id,
         coalesce(a.display_name_en, p.full_name) as agent_name,
         c.status,
         count(*) as commissions_count,
         round(sum(c.amount_aed), 2) as total_aed
  from public.commissions c
  join public.deals d on d.id = c.deal_id
  left join public.profiles p on p.id = c.agent_id
  left join public.agent_profiles a on a.id = c.agent_id
  group by 1, 2, 3, 4;

create view ai.pipeline_summary as
  select s.key as stage_key, s.name_en as stage, s.sort_order,
         count(l.id) as leads_total,
         count(l.id) filter (where l.status = 'open') as leads_open
  from public.pipeline_stages s
  left join public.leads l on l.stage_id = s.id
  group by s.id, s.key, s.name_en, s.sort_order;

create view ai.lead_sources_monthly as
  select date_trunc('month', l.created_at)::date as month, coalesce(src.key, 'unknown') as source,
         count(*) as leads, count(*) filter (where l.status = 'won') as won
  from public.leads l left join public.lead_sources src on src.id = l.source_id
  group by 1, 2;

create view ai.overdue_payments as
  select 'rent'::text as kind, s.due_date, (current_date - s.due_date) as days_overdue,
         round((s.amount - s.paid_amount) * public.rate_to_aed(s.currency), 2) as amount_due_aed,
         pr.reference_code as property_ref, ai.mask_name(c.full_name) as party
  from public.rent_schedules s
  join public.leases l on l.id = s.lease_id
  join public.properties pr on pr.id = l.property_id
  join public.contacts c on c.id = l.tenant_contact_id
  where s.status in ('scheduled','partial','overdue') and s.due_date < current_date and s.amount > s.paid_amount
  union all
  select 'off_plan'::text, di.due_date, (current_date - di.due_date),
         round((di.amount - di.paid_amount) * public.rate_to_aed(di.currency), 2),
         coalesce(u.unit_number, 'n/a'), ai.mask_name(c.full_name)
  from public.deal_installments di
  join public.deals d on d.id = di.deal_id
  left join public.units u on u.id = d.unit_id
  left join public.contacts c on c.id = d.contact_id
  where di.status in ('scheduled','partial','overdue') and di.due_date < current_date and di.amount > di.paid_amount;

create view ai.lease_summary as
  select status, count(*) as leases, round(sum(annual_rent * public.rate_to_aed(currency)), 2) as annual_rent_aed
  from public.leases group by status;

create view ai.leases_expiring as
  select pr.reference_code as property_ref, l.end_date, (l.end_date - current_date) as days_left,
         round(l.annual_rent * public.rate_to_aed(l.currency), 2) as annual_rent_aed, ai.mask_name(c.full_name) as tenant
  from public.leases l
  join public.properties pr on pr.id = l.property_id
  join public.contacts c on c.id = l.tenant_contact_id
  where l.status in ('active','expiring') and l.end_date <= current_date + 120;

create view ai.inventory_summary as
  select l.purpose, l.status as listing_status, p.type as property_type,
         coalesce(t.name, 'Unknown area') as area,
         count(*) as listings,
         round(avg(l.price_aed_normalized), 0) as avg_price_aed,
         round(avg(l.price_aed_normalized / nullif(p.size_sqft, 0)), 0) as avg_price_per_sqft_aed
  from public.listings l
  join public.properties p on p.id = l.property_id
  left join public.area_translations t on t.area_id = p.area_id and t.locale = 'en'
  group by 1, 2, 3, 4;

create view ai.offplan_inventory as
  select pr.code as project_code, coalesce(t.name, pr.code) as project,
         count(*) as units_total,
         count(*) filter (where u.status = 'available') as available,
         count(*) filter (where u.status = 'reserved')  as reserved,
         count(*) filter (where u.status = 'booked')    as booked,
         count(*) filter (where u.status = 'sold')      as sold,
         round(coalesce(sum(u.price_aed) filter (where u.status = 'sold'), 0), 2)      as sold_value_aed,
         round(coalesce(sum(u.price_aed) filter (where u.status = 'available'), 0), 2) as available_value_aed
  from public.units u
  join public.projects pr on pr.id = u.project_id
  left join public.project_translations t on t.project_id = pr.id and t.locale = 'en'
  group by pr.id, pr.code, t.name;

grant select on all tables in schema ai to ai_readonly;
grant execute on function ai.mask_name(text) to ai_readonly;
revoke all on schema ai from anon, authenticated;

-- ---------------------------------------------------------------------
-- 17. SEED DATA
-- ---------------------------------------------------------------------
insert into public.currencies (code, name_en, name_ar, symbol, is_base, is_active) values
  ('AED','UAE Dirham','درهم إماراتي','AED', true,  true),
  ('USD','US Dollar','دولار أمريكي','$',    false, true),
  ('GBP','Pound Sterling','جنيه إسترليني','£', false, true),
  ('SAR','Saudi Riyal','ريال سعودي','SAR',  false, false),
  ('QAR','Qatari Riyal','ريال قطري','QAR',  false, false),
  ('KWD','Kuwaiti Dinar','دينار كويتي','KWD', false, false),
  ('BHD','Bahraini Dinar','دينار بحريني','BHD', false, false),
  ('OMR','Omani Rial','ريال عماني','OMR',   false, false);

-- GBP is a PLACEHOLDER. The daily rate job must overwrite it (AED, USD, SAR, QAR are fixed pegs).
insert into public.exchange_rates (currency_code, rate_to_aed, source) values
  ('AED', 1,          'base'),
  ('USD', 3.6725,     'peg'),
  ('GBP', 4.65,       'seed-placeholder'),
  ('SAR', 0.97933333, 'peg'),
  ('QAR', 1.00892857, 'peg');

insert into public.pipeline_stages (key, name_en, name_ar, sort_order, color, is_won, is_lost) values
  ('new',         'New',         'جديد',          1, '#4A6A7D', false, false),
  ('contacted',   'Contacted',   'تم التواصل',    2, '#B8862B', false, false),
  ('viewing',     'Viewing',     'معاينة',        3, '#A88B5B', false, false),
  ('negotiation', 'Negotiation', 'تفاوض',         4, '#7A6238', false, false),
  ('won',         'Won',         'تم الإغلاق',    5, '#4F7A5A', true,  false),
  ('lost',        'Lost',        'خسارة',         6, '#A8453D', false, true);

insert into public.lead_sources (key, name_en, name_ar) values
  ('website','Website','الموقع الإلكتروني'), ('whatsapp','WhatsApp','واتساب'), ('phone','Phone call','اتصال هاتفي'),
  ('walk_in','Walk-in','زيارة مباشرة'), ('social','Social media','وسائل التواصل'), ('referral','Referral','توصية'),
  ('portal','Property portal','بوابة عقارية'), ('event','Event','فعالية'), ('other','Other','أخرى');

insert into public.amenities (code, name_en, name_ar, category, sort_order) values
  ('pool','Swimming pool','مسبح','building',1), ('gym','Gym','نادي رياضي','building',2),
  ('parking','Parking','موقف سيارات','building',3), ('security','24/7 security','حراسة على مدار الساعة','building',4),
  ('concierge','Concierge','خدمة الكونسيرج','building',5), ('kids_play','Children''s play area','منطقة ألعاب أطفال','building',6),
  ('beach_access','Beach access','وصول إلى الشاطئ','building',7), ('bbq','BBQ area','منطقة شواء','building',8),
  ('balcony','Balcony','شرفة','unit',10), ('maid_room','Maid''s room','غرفة خادمة','unit',11),
  ('study','Study room','غرفة دراسة','unit',12), ('central_ac','Central A/C','تكييف مركزي','unit',13),
  ('wardrobes','Built-in wardrobes','خزائن مدمجة','unit',14), ('smart_home','Smart home','منزل ذكي','unit',15),
  ('private_garden','Private garden','حديقة خاصة','unit',16), ('private_pool','Private pool','مسبح خاص','unit',17),
  ('pets','Pets allowed','يسمح بالحيوانات الأليفة','policy',20);

create temp table _seed_areas (
  code text, parent_code text, level public.area_level, cc char(2), lat numeric, lng numeric,
  active boolean, sort int, name_en text, name_ar text
) on commit drop;
insert into _seed_areas values
  ('ae',  null, 'country', 'AE', 23.4241, 53.8478, true, 1, 'United Arab Emirates', 'الإمارات العربية المتحدة'),
  ('sa',  null, 'country', 'SA', null, null, false, 2, 'Saudi Arabia', 'المملكة العربية السعودية'),
  ('qa',  null, 'country', 'QA', null, null, false, 3, 'Qatar', 'قطر'),
  ('kw',  null, 'country', 'KW', null, null, false, 4, 'Kuwait', 'الكويت'),
  ('bh',  null, 'country', 'BH', null, null, false, 5, 'Bahrain', 'البحرين'),
  ('om',  null, 'country', 'OM', null, null, false, 6, 'Oman', 'عُمان'),
  ('dubai',          'ae', 'emirate', 'AE', 25.2048, 55.2708, true, 1, 'Dubai', 'دبي'),
  ('abu-dhabi',      'ae', 'emirate', 'AE', 24.4539, 54.3773, true, 2, 'Abu Dhabi', 'أبوظبي'),
  ('sharjah',        'ae', 'emirate', 'AE', 25.3463, 55.4209, true, 3, 'Sharjah', 'الشارقة'),
  ('ajman',          'ae', 'emirate', 'AE', 25.4052, 55.5136, true, 4, 'Ajman', 'عجمان'),
  ('ras-al-khaimah', 'ae', 'emirate', 'AE', 25.7895, 55.9432, true, 5, 'Ras Al Khaimah', 'رأس الخيمة'),
  ('fujairah',       'ae', 'emirate', 'AE', 25.1288, 56.3265, true, 6, 'Fujairah', 'الفجيرة'),
  ('umm-al-quwain',  'ae', 'emirate', 'AE', 25.5647, 55.5552, true, 7, 'Umm Al Quwain', 'أم القيوين'),
  ('dubai-marina',      'dubai', 'community', 'AE', 25.0805, 55.1403, true, 1, 'Dubai Marina', 'دبي مارينا'),
  ('downtown-dubai',    'dubai', 'community', 'AE', 25.1972, 55.2744, true, 2, 'Downtown Dubai', 'وسط مدينة دبي'),
  ('palm-jumeirah',     'dubai', 'community', 'AE', 25.1124, 55.1390, true, 3, 'Palm Jumeirah', 'نخلة جميرا'),
  ('business-bay',      'dubai', 'community', 'AE', 25.1850, 55.2620, true, 4, 'Business Bay', 'الخليج التجاري'),
  ('jumeirah-village-circle', 'dubai', 'community', 'AE', 25.0600, 55.2100, true, 5, 'Jumeirah Village Circle', 'قرية جميرا الدائرية'),
  ('dubai-hills-estate','dubai', 'community', 'AE', 25.1050, 55.2450, true, 6, 'Dubai Hills Estate', 'دبي هيلز استيت'),
  ('jumeirah-lake-towers','dubai','community', 'AE', 25.0700, 55.1500, true, 7, 'Jumeirah Lake Towers', 'أبراج بحيرات جميرا'),
  ('saadiyat-island',   'abu-dhabi', 'community', 'AE', 24.5400, 54.4300, true, 1, 'Saadiyat Island', 'جزيرة السعديات'),
  ('yas-island',        'abu-dhabi', 'community', 'AE', 24.4900, 54.6000, true, 2, 'Yas Island', 'جزيرة ياس'),
  ('al-reem-island',    'abu-dhabi', 'community', 'AE', 24.4980, 54.4020, true, 3, 'Al Reem Island', 'جزيرة الريم');

insert into public.areas (code, level, country_code, lat, lng, is_active, sort_order)
  select code, level, cc, lat, lng, active, sort from _seed_areas;
update public.areas a set parent_id = p.id
  from _seed_areas s join public.areas p on p.code = s.parent_code
  where a.code = s.code and s.parent_code is not null;
insert into public.area_translations (area_id, locale, slug, name)
  select a.id, 'en', s.code, s.name_en from _seed_areas s join public.areas a on a.code = s.code;
insert into public.area_translations (area_id, locale, slug, name)
  select a.id, 'ar', replace(s.name_ar, ' ', '-'), s.name_ar from _seed_areas s join public.areas a on a.code = s.code;

insert into public.site_settings (key, value, is_public) values
  ('company',              '{"name":"JILO Real Estate","tagline_en":"Architecture. Ownership. Legacy.","tagline_ar":"عمارة. تملّك. إرث.","phone":null,"email":null,"whatsapp":null}'::jsonb, true),
  ('default_currency',     '"AED"'::jsonb, true),
  ('supported_currencies', '["AED","USD","GBP"]'::jsonb, true),
  ('lead_sla_minutes',     '5'::jsonb,  false),
  ('reservation_hours',    '48'::jsonb, false),
  ('listing_expiry_days',  '90'::jsonb, false),
  ('require_permit_number','false'::jsonb, false);   -- set to true once the client confirms advertising-permit rules

insert into public.message_templates (key, channel, locale, subject, body) values
  ('lead_welcome','email',   'en','Thank you for your enquiry','Hello {{name}}, thank you for contacting JILO Real Estate. {{agent}} will be in touch shortly.'),
  ('lead_welcome','email',   'ar','شكراً لاستفسارك','مرحباً {{name}}، شكراً لتواصلك مع جيلو العقارية. سيتواصل معك {{agent}} قريباً.'),
  ('lead_welcome','whatsapp','en',null,'Hello {{name}}, this is {{agent}} from JILO Real Estate. How can I help you with your property search?'),
  ('lead_welcome','whatsapp','ar',null,'مرحباً {{name}}، معك {{agent}} من جيلو العقارية. كيف يمكنني مساعدتك في البحث عن عقارك؟');

-- ---------------------------------------------------------------------
-- 18. SCHEDULED JOBS AND REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('jilo-daily-maintenance', '0 2 * * *',  'select public.daily_maintenance()');   -- 06:00 Dubai time
  perform cron.schedule('jilo-lead-sla',          '* * * * *',  'select public.escalate_overdue_leads()');
exception when others then
  raise notice 'pg_cron not scheduled (%). Enable it in Dashboard > Database > Extensions, then run the two cron.schedule() calls shown in section 18.', sqlerrm;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications, public.leads, public.lead_messages, public.viewings;
exception when others then
  raise notice 'Realtime publication not updated (%). Enable Realtime for notifications, leads, lead_messages, viewings in the Dashboard.', sqlerrm;
end $$;

commit;

-- =====================================================================
--  AFTER RUNNING (manual steps, about 5 minutes)
--  1. Sign up your own account on the site, then promote yourself:
--       update public.profiles set role = 'admin' where email = 'you@company.com';
--  2. Create agents: invite them (Auth > Users), then:
--       update public.profiles set role = 'agent' where email = 'agent@company.com';
--       insert into public.agent_settings (id) select id from public.profiles where email = 'agent@company.com';
--       insert into public.agent_profiles (id, display_name_en) select id, full_name from public.profiles where email = 'agent@company.com';
--  3. Auth > Providers: enable Email, Phone OTP and Google; turn ON email confirmation; require MFA for admins.
--  4. Replace the GBP placeholder rate with a daily job (insert into exchange_rates each day).
--  5. AI role:  alter role ai_readonly with login password '...';
-- =====================================================================
