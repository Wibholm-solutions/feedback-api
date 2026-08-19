# feedback-api

A tiny HTTP service that turns feedback submitted from a web front end into a
GitHub issue. A page posts `{ repo, title, description?, type }` to
`POST /api/feedback`; the service validates it, applies a per-IP rate limit and
a honeypot field, and creates an issue in the named repository with the labels
`bug` / `enhancement` / `feedback` plus `from-app`, using a GitHub token from
the environment. Built with [Hono](https://hono.dev) on Node.js.

> Dansk: Central feedback-API der modtager feedback fra alle apps og opretter
> GitHub-issues.

## Status

Small, internal, experimental service written for the maintainer's own sites.
It works, but it is not a general product: single file, no tests, in-memory
rate limiting that resets on restart, and no authentication beyond CORS origin
and the token's own repository permissions. Maintained occasionally.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/feedback/health` | liveness; reports whether a GitHub token is configured |
| `POST` | `/api/feedback` | create an issue; 201 on success, 400 on validation errors, 429 when rate-limited (5 per IP per hour), 502 on GitHub errors |

Without a token the service logs the would-be issue to stdout instead of
calling GitHub.

## Setup

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev        # tsx watch, http://localhost:3000
npm run build      # esbuild bundle in dist/
npm start          # node dist/index.js
```

Configuration is by environment variable:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | listen port | `3000` |
| `GITHUB_TOKEN` | token used to create issues; needs `issues:write` on the target repositories | unset → log-only fallback |
| `ALLOWED_ORIGINS` | comma-separated CORS origins allowed to call `/api/*` | `https://wibholmsolutions.com` |

Container: `docker compose up --build` builds the image and reads
`GITHUB_TOKEN` from the shell environment or a local `.env` file (ignored by
Git). The workflow in `.github/workflows/ci-cd.yml` deploys `master` through
the maintainer's own self-hosted runner and is specific to that environment.

## Data and privacy

The service forwards whatever a visitor types into the feedback form into a
GitHub issue in the target repository, so submitted text becomes visible to
anyone who can read that repository's issues. It keeps submitter IP addresses
in memory only for rate limiting and never writes them anywhere; it stores
nothing else. Be deliberate about which target repositories the token can
write to. The repository contains no credentials or personal data.

## Third-party material

Dependencies are published under the MIT licence (Hono, @hono/node-server,
esbuild, tsx) and Apache-2.0 (TypeScript). Nothing is vendored.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE) © 2026 Wibholm Solutions.
