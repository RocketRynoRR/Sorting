# Supabase Setup For Home QR Storage

Use this when you want the app data to sync across devices and stay backed up online.

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
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_location_id uuid references public.locations(id) on delete set null,
  name text not null,
  area text,
  sections text[] not null default '{}',
  photo_data text,
  created_at timestamptz not null default now()
);

alter table public.locations
add column if not exists parent_location_id uuid references public.locations(id) on delete set null;

alter table public.locations
add column if not exists photo_data text;

alter table public.locations
add column if not exists sections text[] not null default '{}';

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  category text,
  section text,
  notes text,
  photo_data text,
  created_at timestamptz not null default now()
);

alter table public.items
add column if not exists photo_data text;

alter table public.items
add column if not exists section text;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dark_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.location_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (location_id, recipient_email)
);

create table if not exists public.item_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (item_id, recipient_email)
);

create table if not exists public.place_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  unique (place_id, recipient_email)
);

alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.places enable row level security;
alter table public.categories enable row level security;
alter table public.user_settings enable row level security;
alter table public.location_shares enable row level security;
alter table public.item_shares enable row level security;
alter table public.place_shares enable row level security;

drop policy if exists "Users can view their own locations" on public.locations;
create policy "Users can view their own locations"
on public.locations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.location_shares
    where location_shares.location_id = locations.id
    and lower(location_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
  or exists (
    select 1 from public.items
    join public.item_shares on item_shares.item_id = items.id
    where items.location_id = locations.id
    and lower(item_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own locations" on public.locations;
create policy "Users can create their own locations"
on public.locations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own locations" on public.locations;
create policy "Users can update their own locations"
on public.locations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own locations" on public.locations;
create policy "Users can delete their own locations"
on public.locations
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own items" on public.items;
create policy "Users can view their own items"
on public.items
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.item_shares
    where item_shares.item_id = items.id
    and lower(item_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
  or exists (
    select 1 from public.location_shares
    where location_shares.location_id = items.location_id
    and lower(location_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own items" on public.items;
create policy "Users can create their own items"
on public.items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own items" on public.items;
create policy "Users can update their own items"
on public.items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own items" on public.items;
create policy "Users can delete their own items"
on public.items
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own places" on public.places;
create policy "Users can view their own places"
on public.places
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.place_shares
    where place_shares.place_id = places.id
    and lower(place_shares.recipient_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can create their own places" on public.places;
create policy "Users can create their own places"
on public.places
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own places" on public.places;
create policy "Users can update their own places"
on public.places
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own places" on public.places;
create policy "Users can delete their own places"
on public.places
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own categories" on public.categories;
create policy "Users can view their own categories"
on public.categories
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own categories" on public.categories;
create policy "Users can create their own categories"
on public.categories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own categories" on public.categories;
create policy "Users can update their own categories"
on public.categories
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own categories" on public.categories;
create policy "Users can delete their own categories"
on public.categories
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own settings" on public.user_settings;
create policy "Users can view their own settings"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own settings" on public.user_settings;
create policy "Users can create their own settings"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view relevant location shares" on public.location_shares;
create policy "Users can view relevant location shares"
on public.location_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create location shares they own" on public.location_shares;
create policy "Users can create location shares they own"
on public.location_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete location shares they own" on public.location_shares;
create policy "Users can delete location shares they own"
on public.location_shares
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can view relevant item shares" on public.item_shares;
create policy "Users can view relevant item shares"
on public.item_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create item shares they own" on public.item_shares;
create policy "Users can create item shares they own"
on public.item_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete item shares they own" on public.item_shares;
create policy "Users can delete item shares they own"
on public.item_shares
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can view relevant place shares" on public.place_shares;
create policy "Users can view relevant place shares"
on public.place_shares
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or lower(recipient_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can create place shares they own" on public.place_shares;
create policy "Users can create place shares they own"
on public.place_shares
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete place shares they own" on public.place_shares;
create policy "Users can delete place shares they own"
on public.place_shares
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

## 4. Connect The App

Send Codex:

- Supabase Project URL
- Supabase anon public key

Then the app can be updated to:

- sign in with email and password
- save locations to Supabase
- save items to Supabase
- load the same data on every device
- keep local export as a backup option
