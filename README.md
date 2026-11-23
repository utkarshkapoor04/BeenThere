# Been There: landing page + working contact form

Form → `/api/contact` (Vercel function) → **Supabase row** (RLS on) → **email to you** + **auto-reply to the visitor** (Gmail).

## 1. Supabase (5 min)
1. supabase.com → New project.
2. SQL Editor → New query → paste `supabase.sql` → **Run**.
3. Table Editor → `contact_submissions` should show the **RLS enabled** badge.
4. Project Settings → API (or API Keys): copy the **Project URL** and the **anon / publishable** key.
   Do **not** use the `service_role` / secret key. It bypasses RLS.

## 2. Gmail app password (3 min)
1. myaccount.google.com → Security → turn on **2-Step Verification** (required).
2. Search "App passwords" → create one called `Been There` → copy the 16-letter code (no spaces).

## 3. Deploy on Vercel (5 min)
1. Push this folder to a new GitHub repo (or drag-and-drop it after `npm i -g vercel && vercel`).
2. vercel.com → Add New → Project → import the repo → Framework preset: **Other** → Deploy.
3. Project → Settings → Environment Variables → add everything in `.env.example`.
4. Deployments → ⋯ → **Redeploy** (env vars only apply to new deployments).

## 4. Test (the "done" check)
Get a classmate to submit the form on the live URL, then capture:
- Supabase → Table Editor → the new row
- Your inbox → "New Been There enquiry from …"
- Their inbox → "We got your message — Been There"

## If something breaks
| Symptom | Likely cause |
|---|---|
| "Server is not configured yet." | Env vars missing, or you didn't redeploy after adding them |
| "Could not save your message" | Vercel → Logs. `401` = wrong key; `42501`/RLS error = SQL not run or policy missing; `404` = wrong URL or table name |
| Row saved but no emails | Wrong app password, 2-Step off, or spaces in the password. Check Vercel → Logs |
| Auto-reply missing | Check the classmate's Spam folder |
| 404 on `/api/contact` | `api/` folder not at the repo root |
