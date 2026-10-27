# Master Gym

Aplikasi kasir dan membership gym. Next.js 16 + PostgreSQL 16 (Drizzle) + shadcn/ui,
dengan fondasi yang sama seperti sembako. Dua role: `kasir` (operasional harian)
dan `superadmin` (laporan dan data master).

## Dokumentasi

- [docs/HANDOFF.md](docs/HANDOFF.md): konteks proyek, spec, keputusan, status, dan rencana per hari. **Baca ini dulu.**
- [docs/CODEBASE_OVERVIEW.md](docs/CODEBASE_OVERVIEW.md): apa fungsi tiap file, route, alur request
- [docs/AUTH.md](docs/AUTH.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/UI.md](docs/UI.md) · [docs/DOCKER.md](docs/DOCKER.md)

## Setup lokal

```bash
cp .env.example .env
# isi SESSION_SECRET dan NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
openssl rand -base64 32

npm install
# Postgres: PostgreSQL 16 lokal di port 5432 (ubah DATABASE_URL di .env),
# atau Docker: docker compose up -d postgres (127.0.0.1:5434)
npm run db:push
npm run db:seed   # akun dev: superadmin@mastergym.test dan kasir@mastergym.test / password123
npm run dev
```

Untuk server sungguhan, jangan pakai `db:seed`. Buat akun dengan:

```bash
npm run db:create-user -- --name="Kasir" --email=kasir@contoh.id --password=... --role=kasir
```

## Docker

- Dev: `docker compose up -d --build` (app di port `APP_HOST_PORT`, default 3002).
  Isi database container-nya lewat port 5434:
  `DATABASE_URL=postgres://mastergym:mastergym@localhost:5434/mastergym npx drizzle-kit push`
  lalu `DATABASE_URL=... npx tsx lib/db/seed.ts`
- Prod: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
