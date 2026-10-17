# Master Gym

Absensi check-in member gym. Next.js 16 + PostgreSQL (Drizzle), with the same
foundation as sembako. Design: `docs/superpowers/specs/2026-10-17-foundation-design.md`.

## Setup lokal

```bash
cp .env.example .env
# isi SESSION_SECRET dan NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
openssl rand -base64 32

npm install
docker compose up -d postgres   # Postgres di 127.0.0.1:5434
npm run db:push
npm run db:seed                 # akun dev: admin@mastergym.test / password123
npm run dev
```

Untuk server sungguhan, jangan pakai `db:seed`. Buat akun dengan:

```bash
npm run db:create-user -- --name="Admin" --email=admin@contoh.id --password=...
```

## Docker

- Dev: `docker compose up -d --build` (app di port `APP_HOST_PORT`, default 3002)
- Prod: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
