# Rencana Kontribusi Tim (2 Anggota, 2 Akun GitHub)

> Tujuan: **setiap anggota punya commit & push atas nama sendiri di GitHub**, sesuai `CLAUDE.md §7`.
> Dosen memverifikasi kontribusi dari **email author tiap commit** — jadi kunci utamanya: setiap commit
> memakai `git config user.email` yang **terdaftar/terverifikasi di akun GitHub orang tersebut**.
>
> Prinsip jujur: masing-masing meng-commit & mem-push bagiannya sendiri, dan **benar-benar memahami**
> file yang di-commit (tiap file punya komentar `SECURITY — Risk/How/Why` yang bisa dijelaskan ke dosen).

## 0. Peran (ikut ownership matrix CLAUDE.md §7)

- **Member A — Security / Auth / User-data / Deploy**
- **Member B — Weather / Frontend / Testing / Docs (PRD, Arch, Testing)**

Isi masing-masing (satu sebelum mulai: samakan siapa A dan siapa B):

| Field                   | Member A | Member B |
| ----------------------- | -------- | -------- |
| Nama                    | `____`   | `____`   |
| Email GitHub (verified) | `____`   | `____`   |
| Username GitHub         | `____`   | `____`   |

## 1. Setup awal GitHub (sekali, lakukan Member A)

1. Buat repo **private** di GitHub (mis. `global-weather-prediction`).
2. Settings → Collaborators → **tambahkan Member B**.
3. (Opsional tapi bagus) Settings → Branches → **protect `main`** (require PR before merge).
4. Member A **zip seluruh project** TANPA `node_modules`, `.next`, `.git`, `.env` → kirim ke Member B
   (Drive/WA). Ini cuma membagikan source; masing-masing tetap commit bagiannya sendiri.

## 2. Pembagian file (daftar `git add`)

**Member A:**

```
# (scaffold/tooling — commit pertama)
package.json  pnpm-lock.yaml  pnpm-workspace.yaml  tsconfig.json
eslint.config.mjs  .prettierrc.json  .prettierignore  postcss.config.mjs
.gitignore  README.md  .env.example
# (security core)
prisma/  prisma.config.ts  src/lib/db.ts  src/lib/env.ts
src/lib/auth/  src/lib/validation/auth.ts  src/lib/validation/favorites.ts
src/lib/http.ts  src/lib/log.ts  src/lib/net.ts  src/lib/rate-limit.ts
src/lib/client/api.ts
src/app/api/auth/  src/app/api/favorites/  src/app/api/history/
src/app/(app)/  src/components/AppNav.tsx
src/middleware.ts  next.config.ts  vercel.json
docs/SECURITY.md  docs/DATABASE.md  docs/DEPLOYMENT.md
```

**Member B:**

```
src/lib/weather/  src/lib/validation/weather.ts
src/app/api/weather/route.ts
src/components/weather/  src/components/GlobeHero.tsx  src/components/LazyGlobe.tsx
src/app/page.tsx  src/app/(auth)/
src/app/layout.tsx  src/app/globals.css  src/app/error.tsx  src/app/global-error.tsx  src/app/favicon.ico
tests/  vitest.config.ts
docs/PRD.md  docs/ARCHITECTURE.md  docs/TESTING.md
```

> Catatan: dependency di `package.json` (termasuk vitest) di-commit di scaffold oleh A — penambahan
> dependency memang lumrah dilakukan satu orang; yang dinilai adalah kepemilikan **kode fitur**.

## 3. Alur branch

`main` (protected) ← `dev` ← `feature/*`. Tiap orang kerja di `feature/*` → **PR ke `dev`** → merge.
Di milestone: PR `dev` → `main`. **Tiap deskripsi PR sebutkan kontrol keamanan yang disentuh** (jadi bukti nilai).

## 4. Langkah Member A (laptop A)

```bash
cd "GlobalWeatherPrediction"
git init
git branch -M main
git config user.name  "Nama A"
git config user.email "emailA@github"      # HARUS email yang terverifikasi di GitHub A

# --- commit bertahap (add HANYA file bagian A) ---
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json \
        eslint.config.mjs .prettierrc.json .prettierignore postcss.config.mjs \
        .gitignore README.md .env.example
git commit -m "chore: scaffold Next.js app, tooling, and config"

git add prisma prisma.config.ts src/lib/db.ts src/lib/env.ts
git commit -m "feat(db): Prisma schema, client singleton, Zod env validation"

git add src/lib/auth src/lib/validation/auth.ts src/lib/http.ts src/lib/log.ts
git commit -m "feat(auth): bcrypt hashing, JWT (jose), secure cookies, CSRF"

git add src/app/api/auth
git commit -m "feat(auth): register/login/logout/me route handlers"

git add src/middleware.ts next.config.ts
git commit -m "feat(security): security headers, nonce CSP, same-origin CORS"

git add src/lib/rate-limit.ts src/lib/net.ts
git commit -m "feat(security): per-IP rate limiting (in-memory/Upstash)"

git add src/lib/validation/favorites.ts src/lib/auth/current-user.ts src/lib/client/api.ts \
        src/app/api/favorites src/app/api/history "src/app/(app)" src/components/AppNav.tsx
git commit -m "feat(user): favorites & history with per-user ownership checks (SR-13)"

git add docs/SECURITY.md docs/DATABASE.md docs/DEPLOYMENT.md vercel.json
git commit -m "docs(security): control index, database & deployment runbook"

# --- push + PR ---
git remote add origin https://github.com/ORG/REPO.git
git push -u origin main
git checkout -b dev && git push -u origin dev
```

> Boleh juga tiap grup commit di atas ditaruh di branch `feature/*` terpisah lalu PR→`dev`. Untuk
> kesederhanaan, minimal: A push `main`+`dev`; B kerja lewat `feature/*` → PR (lihat §5).

Setelah selesai, **beri tahu B** bahwa `main`/`dev` sudah ada.

## 5. Langkah Member B (laptop B)

```bash
# 1) clone repo (berisi kerja A)
git clone https://github.com/ORG/REPO.git
cd REPO
git config user.name  "Nama B"
git config user.email "emailB@github"      # HARUS email terverifikasi di GitHub B

# 2) SALIN file bagian B dari zip yang dikirim A ke dalam folder ini
#    (weather, tests, halaman UI, PRD/ARCHITECTURE/TESTING, dll — lihat daftar §2 Member B)
#    Setelah disalin, file-file itu akan muncul sebagai "untracked".

# 3) branch kerja B + commit bertahap (add HANYA file bagian B)
git checkout dev
git checkout -b feature/weather-frontend

git add docs/PRD.md
git commit -m "docs(prd): product requirements document"

git add docs/ARCHITECTURE.md
git commit -m "docs(arch): architecture, trust boundaries, STRIDE-lite threat model"

git add src/lib/weather src/app/api/weather/route.ts
git commit -m "feat(weather): server-side proxy, provider client, caching"

git add src/lib/validation/weather.ts
git commit -m "feat(weather): Zod validation for weather queries"

git add src/components/weather
git commit -m "feat(ui): current/hourly/7-day/AQI forecast components"

git add src/app/page.tsx src/components/GlobeHero.tsx src/components/LazyGlobe.tsx
git commit -m "feat(ui): landing page with lazy-loaded 3D globe"

git add "src/app/(auth)" src/app/layout.tsx src/app/globals.css \
        src/app/error.tsx src/app/global-error.tsx src/app/favicon.ico
git commit -m "feat(ui): login/register pages, root layout, error boundaries"

git add tests vitest.config.ts
git commit -m "test: Vitest unit (auth/validation) + integration (API) suite"

git add docs/TESTING.md
git commit -m "docs(testing): strategy and manual security checklist"

# 4) push + PR
git push -u origin feature/weather-frontend
# buka PR feature/weather-frontend -> dev di GitHub, minta A review, lalu merge
```

## 6. Milestone terakhir

Setelah kerja A & B tergabung di `dev`:

```bash
# dari GitHub: buka PR  dev -> main , review, merge.
```

## 7. Verifikasi (wajib cek sebelum lapor ke dosen)

- Di GitHub → tab **Contributors** / **Insights → Contributors**: harus muncul **dua** kontributor.
- Cek author tiap commit:
  ```bash
  git log --pretty=format:'%h  %an <%ae>  %s'
  ```
  Pastikan commit A ber-email A, commit B ber-email B.
- Kalau ada commit muncul sebagai author yang salah/"unknown": email lokal tidak cocok dengan email di
  akun GitHub. Perbaiki dengan `git config user.email` yang benar (commit lama bisa di-`rebase`/`--amend`
  **sebelum** di-push, atau ulang dari branch bersih).

## 8. Etika akademik (penting)

- Jangan memalsukan author (mis. satu orang commit atas nama temannya). Kalau ketahuan, ini pelanggaran
  integritas akademik — lebih berat daripada pembagian kerja yang tidak sempurna.
- Yang dinilai adalah **paham & bisa menjelaskan kontrol keamanan**. Masing-masing baca file bagiannya
  dan mengerti komentar `SECURITY —` di dalamnya sebelum demo/presentasi.
- Cek kebijakan kelas soal **penggunaan AI**; kalau wajib disclosure, jujur cantumkan. (`.gitignore`
  saat ini menyembunyikan `CLAUDE.md`/prompt dari repo — itu keputusan kalian, bukan alat untuk menutupi.)
