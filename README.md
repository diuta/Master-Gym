# Master Gym

Aplikasi kasir dan membership gym. Next.js 16 + PostgreSQL 16 (Drizzle) + shadcn/ui,
dengan fondasi yang sama seperti sembako. Dua role: `kasir` (operasional harian)
dan `superadmin` (laporan dan data master).

## Dokumentasi

- [docs/HANDOFF.md](docs/HANDOFF.md): konteks proyek, spec, keputusan, status, dan rencana per hari. **Baca ini dulu.**
- [docs/CODEBASE_OVERVIEW.md](docs/CODEBASE_OVERVIEW.md): apa fungsi tiap file, route, alur request
- [docs/AUTH.md](docs/AUTH.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/UI.md](docs/UI.md) · [docs/DOCKER.md](docs/DOCKER.md)
- `docs/superpowers/specs/` dan `docs/superpowers/plans/`: desain dan rencana per hari (arsip). Kalau bertentangan dengan dokumen di atas, dokumen di atas yang benar.

## Setup lokal

Butuh Node 20+ dan **npm 10** (npm yang sama dengan image Docker). npm 11 menulis
`package-lock.json` tanpa entri opsional `@esbuild/*`, lalu `npm ci` di Docker gagal.
Cek dengan `npm -v`; kalau 11, jalankan `npm install -g npm@10`.

1. Salin file env:

   ```bash
   cp .env.example .env
   ```

2. Isi `SESSION_SECRET` dan `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` di `.env`, masing-masing dengan hasil perintah ini:

   ```bash
   openssl rand -base64 32
   ```

3. Install dependency:

   ```bash
   npm install
   ```

4. Siapkan Postgres. Pakai PostgreSQL 16 lokal di port 5432 (ubah `DATABASE_URL` di `.env`), atau Docker di `127.0.0.1:5434`:

   ```bash
   docker compose up -d postgres
   ```

5. Buat tabel, lalu isi akun dev (`superadmin@mastergym.test` dan `kasir@mastergym.test`, password `password123`) plus kategori pengeluaran awal:

   ```bash
   npm run db:push
   ```

   ```bash
   npm run db:seed
   ```

6. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

Unit test (vitest):

```bash
npm test
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
