# Contributing

Use Node.js 22 and follow the [setup guide](README.md). Keep changes focused and
include reproduction steps or a short explanation of the resulting behavior.

Before submitting a pull request:

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
cd ../frontend
npm ci
npm run lint
npm run build
cd ..
python -m unittest discover -s deploy/tests -v
```

The full backend suite needs a disposable MySQL database with migrations applied.
Set `DATABASE_URL` to that test database before running it. Never use production.
Conversion tests generate their own fixtures. Do not commit generated uploads,
credentials, `.env` files, or build output. Include a Prisma migration for schema
changes. Deployment changes must preserve compatibility with the previous release.
