# Chameleon

Self-hosted file conversion. Images, HEIC/HEIF, and PDFs are converted entirely
on your own backend — no third-party conversion APIs are called.

- **Images**: JPG, PNG, WebP, GIF, BMP, TIFF, AVIF (any → any)
- **Apple photos**: HEIC/HEIF → any standard image format
- **Documents**: PDF → image (one file per page), image(s) → PDF

## Highlights

- Single-file and batch conversions, ZIP downloads, and multi-image PDF merging.
- Image resizing, quality controls, and optional metadata preservation.
- Email/password accounts and conversion history, with optional OAuth providers.
- Local temporary storage or optional private S3 archival.
- Docker development setup and an opt-in AWS deployment pipeline using OIDC.

Built with **Next.js 16, React 19, TypeScript, Express, Prisma, MySQL, and sharp**.

## Architecture

For the backend deployment walkthrough, see [My first CI/CD deployment](deploy/CI-CD-PROCESS.md).
For detailed AWS setup instructions, see the [deployment guide](deploy/README.md).

```
chameleon-app/
  backend/    Express + TypeScript API (Prisma/MySQL, sharp, heic-convert, pdf-lib/pdf-to-img)
  frontend/   Next.js (App Router, TypeScript) single-page converter UI
  docker-compose.yml
```

Backend conversion pipeline: `src/services/conversion/` — `image.service.ts` (sharp),
`heic.service.ts` (heic-convert), `pdf.service.ts` (pdf-lib / pdf-to-img), dispatched
by `convert.service.ts`.

## Prerequisites

- Node.js 22 (matches CI)
- MySQL 8 (or use the Docker Compose setup, which provisions one for you)
- Docker + Docker Compose (for the containerized setup)

## Local development (without Docker)

### Backend

```bash
cd backend
cp .env.example .env      # edit DATABASE_URL, JWT_SECRET, etc.
npm ci
npm run prisma:migrate    # creates tables in your MySQL database
npm run dev                # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env       # set NEXT_PUBLIC_API_URL if backend isn't on :4000
npm ci
npm run dev                 # http://localhost:3000
```

## Docker (recommended for self-hosting)

```bash
cp .env.example .env        # edit passwords/secrets at the root
docker compose up --build
```

This starts three containers: `mysql`, `backend` (runs `prisma migrate deploy`
automatically on startup, see `backend/docker-entrypoint.sh`), and `frontend`.
Table creation comes from the committed migration in `backend/prisma/migrations/`
— if you change `schema.prisma`, generate a new one with `npm run prisma:migrate`
(against a real database) before deploying, since `migrate deploy` only applies
migrations that already exist on disk.

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/api/health

If `docker compose up` fails to bind port 3306 (a local MySQL install already
using it), set `MYSQL_PORT` in your root `.env` to something else, e.g. `3307`
— the containers still talk to each other over the internal Docker network
regardless of the host-side port mapping.

## Environment variables

### Backend (`backend/.env`, see `backend/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `DATABASE_URL` | — | MySQL connection string for Prisma |
| `JWT_SECRET` | — | Secret used to sign JWTs — set a long random value |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `UPLOAD_DIR` / `CONVERTED_DIR` | `./storage/...` | Temporary file storage paths |
| `STORAGE_DRIVER` | `local` | Set to `s3` to retain originals and conversion outputs in S3 |
| `S3_BUCKET` / `S3_REGION` | unset | Required when S3 storage is enabled |
| `MAX_FILE_SIZE_MB` | `25` | Max size per uploaded file |
| `MAX_BATCH_FILES` | `20` | Max files per batch request |
| `RETENTION_MINUTES` | `60` | Local temporary files older than this are deleted; S3 objects are retained |
| `CLEANUP_INTERVAL_MINUTES` | `15` | How often the cleanup job runs |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `900000` / `100` | Per-IP rate limit |
| `ENABLE_GOOGLE_OAUTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `false` | See "Enabling OAuth" below |
| `ENABLE_GITHUB_OAUTH`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `false` | See "Enabling OAuth" below |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Base URL the browser uses to reach the backend |

### Root (`.env`, used by `docker-compose.yml`)

See `.env.example` at the repository root — it sets MySQL credentials and passes
through the backend/frontend variables above to each container.

## API reference

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/auth/register` | — | `{ email, password }` → creates an account, sets JWT cookie |
| `POST /api/auth/login` | — | `{ email, password }` → sets JWT cookie |
| `POST /api/auth/logout` | — | Clears the JWT cookie |
| `GET /api/auth/me` | JWT | Current user |
| `POST /api/convert` | optional | multipart `file` + `targetFormat` (+ optional `quality`, `keepMetadata`, `width`, `height`, `fit`) → converted file. Logged-in requests are recorded in history. |
| `POST /api/convert/batch` | optional | multipart `files[]` + `targetFormat` (+ optional resize params) → ZIP of converted files (partial failures are listed in `errors.json` inside the ZIP) |
| `POST /api/convert/batch/merge-pdf` | optional | multipart `files[]` (images) (+ optional resize params) → a single merged PDF, one page per image |

Resize params (all optional — omit to keep original dimensions): `width` / `height` in
pixels (max 8000px each, at least one required to trigger a resize), and `fit`
(`inside` [default, keeps aspect ratio], `cover`, `contain`, `fill`, or `outside` —
same semantics as sharp's `resize` fit modes). Resizing applies before format
encoding for images/HEIC/PDF-to-image, and before embedding for image-to-PDF.

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/history` | JWT | Paginated conversion history (`?page=&pageSize=`) |
| `GET /api/health` | — | `{ status, dbConnected, uptimeSeconds }` |

All error responses are JSON: `{ "error": "UnsupportedFormatError", "message": "..." }`.
Relevant error types: `UnsupportedFormatError` (415), `CorruptFileError` (422),
`FileTooLargeError` / Multer size limit (413/400), `ValidationError` (400), `AuthError` (401).

## Security notes

- Uploaded files are validated by real content sniffing (`file-type`, magic bytes), not just
  the extension or the client-supplied `Content-Type`.
- Filenames are sanitized before use; files are stored on disk under generated UUIDs.
- EXIF/metadata is stripped from converted images by default (pass `keepMetadata=true` to preserve it).
- Local temporary uploads are deleted after each request, with a cron-based sweep
  (`RETENTION_MINUTES` / `CLEANUP_INTERVAL_MINUTES`) for orphaned local files.
  Optional [S3 storage](deploy/S3-STORAGE.md) retains originals and converted outputs
  until manually deleted; local cleanup does not delete S3 objects.
- `helmet`, CORS restricted to `CORS_ORIGIN`, and per-IP rate limiting are enabled by default.

## Enabling OAuth (Google / GitHub)

Email/password auth works out of the box. Google and GitHub sign-in are fully scaffolded
in `backend/src/auth/passport.ts` and `backend/src/routes/auth.routes.ts` but inactive
until you turn them on:

1. Create OAuth credentials with Google/GitHub, with callback URLs
   `http://<your-domain>/api/auth/google/callback` and `.../github/callback`.
2. Set `ENABLE_GOOGLE_OAUTH=true` / `ENABLE_GITHUB_OAUTH=true` and the corresponding
   `*_CLIENT_ID` / `*_CLIENT_SECRET` env vars.
3. Restart the backend — the `/api/auth/google` and `/api/auth/github` routes are only
   mounted when their flag is enabled.

## Running tests

```bash
cd backend
npm test
```

Image, PDF, batch, and HEIC-conversion tests generate their own fixtures in-memory
(via `sharp`/`pdf-lib`) and don't need a database. The auth flow tests
(`tests/auth.test.ts`) do need a reachable MySQL database at `DATABASE_URL` — point
it at a disposable test database before running the full suite.

## Notes on format support

- BMP output is produced by hand (sharp has no native BMP encoder) via a raw
  32-bit-per-pixel encoder in `image.service.ts`.
- `heic-convert`, `pdf-to-img`, and `file-type` are ESM-only packages; the backend
  compiles to CommonJS, so they're loaded through a small `dynamicImport` helper
  (`src/utils/dynamicImport.ts`) that prevents TypeScript from downleveling
  `import()` into a broken `require()` call.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks and pull request guidance.
For sensitive bug reports, see [SECURITY.md](SECURITY.md).

AWS deployment is disabled by default. Follow the deployment guide before enabling
`ENABLE_AWS_DEPLOY` as a repository Actions variable. Never commit populated env
files, cloud credentials, or uploaded user files.
