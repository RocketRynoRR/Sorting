# Supabase Setup For Home QR Storage

Use this when you want the app data to sync across devices and stay backed up online.

This setup uses `qr_` table names so it can live safely beside your Dashboard and proofing system in the same Supabase project.

## 1. Create A Supabase Project

1. Go to https://supabase.com
2. Create an account or sign in.
3. Create a new project.
4. Save these two values from `Project Settings > API`:
   - Project URL
   - anon public key

Do not share the service role key.

## 2. Create The Database Tables

Open `SQL Editor` in Supabase and run this:

```sql
create table if not exists public.qr_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_location_id uuid references public.qr_locations(id) on delete set null,
  name text not null,
  area text,
  sections text[] not null default '{}',
  photo_data text,
  created_at timestamptz not null default now()
);

alter table public.qr_locations
add column if not exists parent_location_id uuid references public.qr_locations(id) on delete set null;

alter table public.qr_locations
add column if not exists photo_data text;

alter table public.qr_locations
add column if not exists sections text[] not null default '{}';

create table if not exists public.qr_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.qr_locations(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  category text,
  section text,
  notes text,
  photo_data text,
  created_at timestamptz not null default now()
);

alter table public.qr_items
add column if not exists photo_data text;

alter table public.qr_items
add column if not exists section text;

create table if not exists public.qr_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.qr_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.qr_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dark_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.qr_location_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.qr_locations(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (location_id, recipient_email)
);

create table if not exists public.qr_item_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.qr_items(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (item_id, recipient_email)
);

create table if not exists public.qr_place_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.qr_places(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (place_id, recipient_email)
);

alter table public.qr_locations enable row level security;
alter table public.qr_items enable row level security;
alter table public.qr_places enable row level security;
alter table public.qr_categories enable row level security;
alter table public.qr_user_settings enable row level security;
alter table public.qr_location_shares enable row level security;
alter table public.qr_item_shares enable row level security;
alter table public.qr_place_shares enable row level security;

drop policy if exists "Users can view their own qr_locations" on public.qr_locations;
create policy "Users can view their own qr_locations"
on public.qr_locations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.qr_location_shares
    where qr_location_shares.location_id = qr_locations.id
    and lower(qr_location_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
  or exists (
    select 1 from public.qr_items
    join public.qr_item_shares on qr_item_shares.item_id = qr_items.id
    where qr_items.location_id = qr_locations.id
    and lower(qr_item_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own qr_locations" on public.qr_locations;
create policy "Users can create their own qr_locations"
on public.qr_locations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own qr_locations" on public.qr_locations;
create policy "Users can update their own qr_locations"
on public.qr_locations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own qr_locations" on public.qr_locations;
create policy "Users can delete their own qr_locations"
on public.qr_locations
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own qr_items" on public.qr_items;
create policy "Users can view their own qr_items"
on public.qr_items
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.qr_item_shares
    where qr_item_shares.item_id = qr_items.id
    and lower(qr_item_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
  or exists (
    select 1 from public.qr_location_shares
    where qr_location_shares.location_id = qr_items.location_id
    and lower(qr_location_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own qr_items" on public.qr_items;
create policy "Users can create their own qr_items"
on public.qr_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own qr_items" on public.qr_items;
create policy "Users can update their own qr_items"
on public.qr_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own qr_items" on public.qr_items;
create policy "Users can delete their own qr_items"
on public.qr_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own qr_places" on public.qr_places;
create policy "Users can view their own qr_places"
on public.qr_places
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.qr_place_shares
    where qr_place_shares.place_id = qr_places.id
    and lower(qr_place_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own qr_places" on public.qr_places;
create policy "Users can create their own qr_places"
on public.qr_places
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own qr_places" on public.qr_places;
create policy "Users can update their own qr_places"
on public.qr_places
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own qr_places" on public.qr_places;
create policy "Users can delete their own qr_places"
on public.qr_places
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own qr_categories" on public.qr_categories;
create policy "Users can view their own qr_categories"
on public.qr_categories
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own qr_categories" on public.qr_categories;
create policy "Users can create their own qr_categories"
on public.qr_categories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own qr_categories" on public.qr_categories;
create policy "Users can update their own qr_categories"
on public.qr_categories
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own qr_categories" on public.qr_categories;
create policy "Users can delete their own qr_categories"
on public.qr_categories
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own settings" on public.qr_user_settings;
create policy "Users can view their own settings"
on public.qr_user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own settings" on public.qr_user_settings;
create policy "Users can create their own settings"
on public.qr_user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.qr_user_settings;
create policy "Users can update their own settings"
on public.qr_user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view relevant location shares" on public.qr_location_shares;
create policy "Users can view relevant location shares"
on public.qr_location_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create location shares they own" on public.qr_location_shares;
create policy "Users can create location shares they own"
on public.qr_location_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete location shares they own" on public.qr_location_shares;
create policy "Users can delete location shares they own"
on public.qr_location_shares
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can view relevant item shares" on public.qr_item_shares;
create policy "Users can view relevant item shares"
on public.qr_item_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create item shares they own" on public.qr_item_shares;
create policy "Users can create item shares they own"
on public.qr_item_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete item shares they own" on public.qr_item_shares;
create policy "Users can delete item shares they own"
on public.qr_item_shares
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can view relevant place shares" on public.qr_place_shares;
create policy "Users can view relevant place shares"
on public.qr_place_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create place shares they own" on public.qr_place_shares;
create policy "Users can create place shares they own"
on public.qr_place_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete place shares they own" on public.qr_place_shares;
create policy "Users can delete place shares they own"
on public.qr_place_shares
for delete
to authenticated
using ((select auth.uid()) = owner_id);
```

## 3. Turn On Email Login

1. Open `Authentication > Providers`.
2. Make sure `Email` is enabled.
3. For easier testing, you can temporarily turn off email confirmations in `Authentication > Sign In / Providers > Email`.
4. Open `Authentication > URL Configuration`.
5. Set `Site URL` to:

```text
https://rocketrynorr.github.io/Sorting/
```

6. Add this to redirect URLs if Supabase asks for allowed redirects:

```text
https://rocketrynorr.github.io/Sorting/**
```

## 4. Migration

The app is configured for:

```text
https://gkbpvvhfyarxkjykafun.supabase.co
```

To move data from the old Supabase project:

1. Open the old live app before uploading these new files.
2. Sign in and click `Export`.
3. Upload these updated files to GitHub.
4. Open the updated app, sign in to the new Supabase project, and run the SQL above.
5. Click `Import` and choose the exported JSON file.

The import writes only to the `qr_` tables.


