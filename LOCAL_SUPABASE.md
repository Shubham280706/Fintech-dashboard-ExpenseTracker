# Run Locally With Supabase

This app now uses Supabase instead of MongoDB for backend storage.

## 1. Start local Supabase

From the repository root:

```bash
npx supabase start
```

This starts the local Supabase stack and prints the local API URL plus service role key.

## 2. Set backend environment variables

Update [backend/.env](/Users/shubham/coding/fintech%20/Fintech-dashboard-ExpenseTracker/backend/.env):

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
PORT=8000
CORS_ORIGINS=http://localhost:3000
```

Use the `service_role` key from `npx supabase start`.

## 3. Apply the schema

If you initialized Supabase in this repo, run:

```bash
npx supabase db reset
```

The migration in `supabase/migrations/20260405170000_init_fintech.sql` creates:

- `users`
- `user_sessions`
- `transactions`
- `budgets`
- `alerts`

## 4. Start the backend

```bash
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn server:app --reload
```

## 5. Start the frontend

```bash
cd frontend
npm install
npm start
```

## Optional: start both from the repo root

After installing the root dev dependency once:

```bash
npm install
npm run dev
```

This starts the frontend on `http://localhost:3000` and the backend on `http://127.0.0.1:8000`.

## Optional: run frontend and backend in Docker

The repo now includes `frontend/Dockerfile`, `backend/Dockerfile`, and `docker-compose.yml`.

1. Make sure `backend/.env` contains the `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase start`.

2. Set the frontend env if needed:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

3. Start the app containers:

```bash
docker compose up --build
```

Notes for the Docker flow:

- Keep local Supabase running separately with `npx supabase start`.
- Compose automatically overrides the backend's `SUPABASE_URL` to `http://host.docker.internal:54321` so the container can reach your host Supabase instance.
- In the browser, the frontend still calls the backend through `http://localhost:8000`.
- If you want a separate Docker-specific backend env template, use `backend/.env.docker.example` as a starting point.
- You can also use the root scripts `npm run docker:up`, `npm run docker:down`, and `npm run docker:logs`.

## Notes

- The backend still owns authentication routes and session tokens.
- Supabase is used as the database layer through PostgREST.
- The old Emergent badge, script, and visual editing integration were removed.
