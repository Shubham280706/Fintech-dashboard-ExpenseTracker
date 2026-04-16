# Deploy To Vercel With GitHub

This repo is set up to deploy as two Vercel projects from the same GitHub repository:

- `fintech-dashboard-expense-tracker-api` with Root Directory `backend`
- `fintech-dashboard-expense-tracker` with Root Directory `frontend`

## Before you deploy

Vercel cannot reach your local Supabase stack.
Use a hosted Supabase project and keep its project URL and service role key in Vercel environment variables.
Before testing auth, run the SQL in `supabase/migrations/20260405170000_init_fintech.sql` against that hosted Supabase project so the `users`, `user_sessions`, `transactions`, `budgets`, and `alerts` tables exist.

## 1. Push the repo to GitHub

Make sure your latest code is on GitHub.

## 2. Create the backend Vercel project

1. In Vercel, click `Add New > Project`
2. Import `Shubham280706/Fintech-dashboard-ExpenseTracker`
3. Name it `fintech-dashboard-expense-tracker-api`
4. Set the Root Directory to `backend`
4. Leave the install/build settings at their defaults
5. Add these environment variables:

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGINS`

6. Deploy

Notes:

- `backend/api/index.py` is the Vercel Python entrypoint
- `backend/.python-version` pins Python `3.13`
- the backend uses Supabase tables for `users`, `user_sessions`, `transactions`, `budgets`, and `alerts`
- `/api/health` now checks database readiness, so it returns success only when Supabase is reachable and the schema is available

## 3. Create the frontend Vercel project

1. In Vercel, click `Add New > Project`
2. Import the same GitHub repository again
3. Name it `fintech-dashboard-expense-tracker`
4. Set the Root Directory to `frontend`
4. Add this environment variable:

   - `REACT_APP_BACKEND_URL`

5. Set `REACT_APP_BACKEND_URL` to your backend Vercel URL, for example:

   - `https://your-backend-project.vercel.app`

6. Deploy

## 4. Update backend CORS

After the frontend deploys, copy the frontend Vercel URL and set:

- `CORS_ORIGINS=https://your-frontend-project.vercel.app`

Then redeploy the backend.

If you use a custom domain later, update `CORS_ORIGINS` again and redeploy.

## 5. Test

After both deployments are live:

1. Open the frontend Vercel URL
2. Create an account
3. Confirm dashboard data loads
4. Add a transaction and refresh
5. Log out and sign back in
