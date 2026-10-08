# Deployment checklist

## Frontend (Vercel)

- Set the project root to `frontend`.
- Build command: `npm run build`; output directory: `dist`.
- Set `VITE_API_URL=https://YOUR_BACKEND_DOMAIN/api`.
- `frontend/vercel.json` preserves SPA routes, including password reset.

## Backend

Run the `backend/Dockerfile` on an always-on container host. Set `PORT`, `DATABASE_URL`, `DATABASE_SSL=true` when PostgreSQL requires TLS, `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `FRONTEND_URL`, `APP_URL`, and SMTP variables. The URL variables must use the final HTTPS Vercel origin without a trailing slash.

The service exposes `GET /health`, handles termination gracefully, and uses database leases for scheduled work. Keep the encryption key stable across deployments or encrypted request headers will become unreadable.

## Secrets

Generate independent random values of at least 32 bytes for `JWT_SECRET` and `SECRETS_ENCRYPTION_KEY`. Never commit `.env`, mail credentials, database URLs, reset tokens, or job header values.

## Backups

```bash
pg_dump --format=custom "$DATABASE_URL" > cronhub-$(date +%F).dump
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" cronhub-YYYY-MM-DD.dump
```

Schedule encrypted daily backups, retain at least seven, and test restoration before launch.
