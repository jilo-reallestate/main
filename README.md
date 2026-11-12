# JILO Real Estate: website

Next.js 15 (App Router) · Tailwind · next-intl (English/Arabic, RTL) · Supabase · MapLibre. Design: the version the client approved (white, rounded, glass navigation, gold gradient).

## Run it in 2 minutes (demo mode, no database needed)
    npm install
    npm run dev          # http://localhost:3000/en  and  /ar

With no Supabase keys the site runs in **demo mode**: 10 sample properties, working search, filters, map view, save, compare, viewing scheduler and mortgage estimate. Accounts and dashboards are off, and enquiries are not stored. Good for showing the client.

## Go live (connect Supabase), about 15 minutes
1. supabase.com > New project (choose the region closest to the UAE). Save the database password.
2. **SQL Editor > New query**: paste `supabase/00_FULL_DATABASE.sql` and Run. It is one transaction: it either all applies or nothing does. (It is `01_schema.sql` + `03_listing_rpc.sql` + `04_crm_rpc.sql` + `05_admin_rpc.sql` + `06_portal.sql` + `07_offplan.sql` + `08_listing_relax.sql` + `09_amenities.sql`; the numbered files are the same thing in pieces.) Optional: run `supabase/02_demo_seed.sql` for 10 sample properties.
3. Project Settings > API: copy the **Project URL** and the **anon public** key into `.env.local` (copy `.env.example`). Never use the `service_role` key in the website.
4. Authentication > URL Configuration: Site URL = your site; add `http://localhost:3000/auth/callback` and your production `/auth/callback` to Redirect URLs. Authentication > Providers: keep Email on, turn **Confirm email ON**; enable Phone and Google later.
5. `npm run dev`, open `/en/signup`, create your account, confirm the email, then make yourself admin (SQL Editor):
   `update public.profiles set role = 'admin' where email = 'you@company.com';`
6. Add your team in the app: **Admin > Team**. "Invite" emails an invitation (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, server only). Without that key, ask the person to sign up on the site and use "Promote an existing account". No SQL needed.
7. Log in as admin (`/en/dashboard`): Listings > New listing. Add photos on the next screen. Storage buckets (property-media etc.) are created by the script.
8. Optional later: Database > Extensions > enable `pg_cron` (daily lease/overdue jobs, response-time alerts). The script prints a notice if it was off.

## What is built
- **Home:** cinematic skyline hero with parallax, search (Buy / Rent / Off-plan + suggestions), area marquee, animated counters, featured bento, map section, reviews, call to action
- **Properties:** URL-driven filters (shareable, server-rendered), grid or map view, removable filter chips, pagination, noindex on filtered pages
- **Property page:** photo grid + viewer, sticky section tabs, price-per-sqft vs area average, details, amenities, location map, mortgage estimate or payment plan, viewing scheduler (day + time slot) and message form -> CRM (`submit_inquiry`), WhatsApp/Call, similar properties, JSON-LD, hreflang, old-slug redirects
- **Everywhere:** save (synced to Supabase `favorites` when signed in), compare up to 3, Ctrl/Cmd+K and `/` command search, bottom tab bar and action bar on phones, English/Arabic with RTL, light/dark
- **Staff area:** admin KPIs + approve queue; agent leads with response-time badge; **Listings manager**: create/edit a property with EN/AR text, pricing (sale or rent), amenities, map position, **photo upload** (resized in the browser), submit for review (agents) or publish (admin), archive; the database enforces who can do what
- **Agent / CRM workspace:** Pipeline board (drag cards between stages, or a Move menu on phones; "Lost" asks why), lead page (contact, call/WhatsApp/email buttons, activity timeline, log calls and notes, tasks, viewings, stage, open a deal), add a lead by hand, Tasks, Viewings calendar (confirm / complete / no-show / cancel), Deals with commission totals. Admin: sees every agent, filters by agent, reassigns leads, closes deals (which creates the commission and marks the property sold)
- **Admin management:** Team (performance table for the last 30 days, invite or promote, edit public profile, licence, commission rate and target, deactivate with automatic hand-over of open leads, lock-out protection so there is always an admin), Commissions (approve, mark paid, cancel, with valid steps only), Audit log (who changed what, filterable), Settings (response-time target, reservation and listing expiry, permit rule, company phone/email shown in the footer), unassigned leads on the overview with one-click assign
- **Deactivated accounts lose all access immediately** (enforced in the database on every table)
- **Client portal:** overview with upcoming viewings (cancel with one click) and enquiries; **saved searches with alerts** ("Save this search" on the Properties page, daily/weekly/instant, on/off, in-app + email); **chat with the advisor** (live, unread badges, notifications both ways); **documents** (passport, Emirates ID, proof of funds to a private bucket; the client's advisor can see them, no other agent can); profile (name, phone, language, currency); notification centre for everyone
- **Agent lead page** now shows the client chat and the client's documents
- **About (founder) page**, login/signup, client, agent and admin dashboards (restyled), sitemap.xml, robots.txt

## Placeholders to replace with the client's real content
Logo (SVG files, `src/components/ui/Logo.tsx`), founder name/story/photo/team (`messages/*.json` > `v2.x.f`), reviews, footer phone/email, property photos (upload to the `property-media` bucket; until then generated artwork is shown), Arabic copy review by a native editor.

## Rules for the team
1. Logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`/`mr-`/`left-`/`right-` (breaks Arabic).
2. All copy lives in `messages/*.json`; both languages for every key.
3. Publish each property in BOTH languages (each has its own slug; the language switcher needs both).
4. Gold `text-gold-3` is decoration only; use `text-ac` for small gold text (contrast).
5. Never put the service-role or OpenRouter key in a `NEXT_PUBLIC_` variable.

## Known gaps (next builds)
- Calendar-style week view for viewings, email/WhatsApp sending from the lead page (today you log what you did)
- Client portal: payment tracker and tenant lease view arrive with Rentals and Finance
- Map-click position picker and bulk CSV import for listings
- Off-plan project pages (units, availability, payment plans) and CRM screens (pipeline board, calendar)
- Rentals + finance screens, then the admin AI assistant (OpenRouter, read-only `ai` schema)
- Add CAPTCHA + rate limit to the enquiry action before launch
- Viewing time slots are not yet tied to the agent's real calendar
- The map uses free OpenStreetMap tiles (no key). Fine for normal traffic; for heavy traffic host your own tiles or use a paid provider. Labels follow OpenStreetMap, not the site language
