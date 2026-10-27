# Docker

[Back to overview](./CODEBASE_OVERVIEW.md)

Master Gym runs as **one compose project with two containers**, the same setup as Sembako:

```
compose project "master-gym-dev"
├── postgres   postgres:16-alpine     data in volume "postgres_data"
└── app        master-gym:dev         the Next.js server (built from Dockerfile)
               └── talks to postgres:5432 over the private compose network
```

## 1. Files

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the app image in 3 stages (below) |
| `.dockerignore` | Keeps `node_modules`, `.next`, `.git`, `.env*`, the Docker files and logs out of the build |
| `docker-compose.yml` | **Development**: app on `APP_HOST_PORT` (3002), Postgres on `127.0.0.1:DB_HOST_PORT` (5434) with the public dev password `mastergym` |
| `docker-compose.prod.yml` | **Production**: DB user/password/name come from `.env.production`; both ports bound to `127.0.0.1` only (put a reverse proxy with HTTPS in front); `NODE_ENV=production` |
| `.env.production.example` | Template for `.env.production` |

## 2. How the image is built (`Dockerfile`)

All stages use `node:20-alpine`.

1. **deps:** copies `package.json` + `package-lock.json` and runs `npm ci` (exact versions from the lockfile).
2. **builder:** copies the code and runs `npm run build`. It sets **placeholder** `DATABASE_URL`, `SESSION_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` only so the build doesn't crash on the startup checks. They are not used at runtime. Creates `public/` if it's missing (the app has none) so the next stage's copy works.
3. **runner:** copies only `.next/standalone` (a self-contained server, thanks to `output: "standalone"` in `next.config.ts`), `.next/static` and `public/`. Runs as a non-root user `nextjs` (uid 1001) with `node server.js` on port 3000.

The real secrets come from the compose file's `environment:` at runtime.

## 3. Development

Docker Desktop must be running ("Engine running"). It doesn't start with Windows.

```bash
docker compose up -d --build          # build and start both containers
docker compose ps                     # status; postgres should say "healthy"
docker compose logs app --tail 50     # app logs
docker compose down                   # stop (data stays in the volume)
docker compose down -v                # stop AND delete the database volume (all data gone)
```

The app waits for Postgres to pass its health check (`pg_isready`) before starting.

**Fill the container database** (it starts empty). `.env` points at the native Postgres, so override the URL for these commands:

```bash
DATABASE_URL=postgres://mastergym:mastergym@localhost:5434/mastergym npx drizzle-kit push
DATABASE_URL=postgres://mastergym:mastergym@localhost:5434/mastergym npx tsx lib/db/seed.ts
```

Then open http://localhost:3002.

You can also run only the database in Docker and the app with `npm run dev`: `docker compose up -d postgres`, and set `DATABASE_URL` in `.env` to port 5434.

## 4. Production

```bash
cp .env.production.example .env.production   # fill DB_PASSWORD, SESSION_SECRET, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Then apply the schema and create real accounts (not the seed) through an SSH tunnel to `127.0.0.1:5432` on the server, with `npm run db:push` and `npm run db:create-user`.

Not set up yet: HTTPS / reverse proxy, backups of the `postgres_data` volume, and the `uploads` volume for member photos (planned for day 2, as in Sembako).

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| `Docker Desktop is unable to start`, or stuck on "Starting the Docker Engine" | Quit Docker Desktop completely, run `wsl --shutdown`, start it again. If that fails, `wsl --update` in an admin terminal and restart the PC |
| Port 3002 or 5434 already in use | Change `APP_HOST_PORT` / `DB_HOST_PORT` in `.env` |
| App container exits immediately | `docker compose logs app`. Usually `SESSION_SECRET` is missing or shorter than 32 characters in `.env` |
| Login says wrong password in Docker but works with `npm run dev` | The Docker database is separate and empty; seed it (section 3) |
