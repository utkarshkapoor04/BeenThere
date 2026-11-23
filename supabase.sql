-- Been There: contact form table
-- Paste this into Supabase → SQL Editor → New query → Run

create table if not exists public.contact_submissions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null check (role in ('student', 'parent', 'mentor', 'other')),
  message     text not null check (char_length(message) between 1 and 2000)
);

-- Row-Level Security: ON. With RLS on, nobody can read or write until a policy allows it.
alter table public.contact_submissions enable row level security;

-- The public (anon) key may only INSERT new rows. No SELECT/UPDATE/DELETE policy exists,
-- so visitors can never read other people's submissions.
drop policy if exists "Anyone can submit the contact form" on public.contact_submissions;
create policy "Anyone can submit the contact form"
  on public.contact_submissions
  for insert
  to anon
  with check (true);

grant insert on table public.contact_submissions to anon;
