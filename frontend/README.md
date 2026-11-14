# Chameleon frontend

Next.js App Router interface for the Chameleon file conversion API.

## Development

Use Node.js 22. Start the backend using the [root setup guide](../README.md), then:

```bash
cp .env.example .env
npm ci
npm run dev
```

Open http://localhost:3000. `NEXT_PUBLIC_API_URL` defaults to
http://localhost:4000 and must be set before building for another API origin.

## Checks

```bash
npm run lint
npm run build
```

The interface includes conversion queues, format and resize controls,
authentication, and conversion history.
