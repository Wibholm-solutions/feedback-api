# Feedback API runtime contract

Version: `1.0.0`

This application-owned contract defines the interface a deployment authority
may rely on. Server-specific ports, paths, image digests, and secret references
belong in the infrastructure repository.

## Image and process

- Image package: `ghcr.io/wibholm-solutions/feedback-api`
- Container process: `node dist/index.js`
- Architecture: Linux `amd64`
- Listen port: TCP `3000`
- Health endpoint: `GET /api/feedback/health`, expected HTTP `200`

The health response reports whether the GitHub token is configured without
returning the token or testing its authority. Deployment verification must
therefore require both HTTP `200` and the JSON field `github` equal to
`configured`. The published image carries the same check as its OCI health
probe, so container health and deployment readiness use one contract.

## Configuration

| Variable | Required | Contract |
| --- | --- | --- |
| `PORT` | no | Defaults to `3000`; production wiring should leave it at `3000`. |
| `GITHUB_TOKEN` | yes for issue creation | Protected value; inject by external secret reference and never place it in an image, repository, or log. |
| `ALLOWED_ORIGINS` | no | Comma-separated origins; defaults to `https://wibholmsolutions.com`. |

## Persistent state and rollback

The service has no persistent filesystem state. Its rate-limit map is in memory
and intentionally resets when the container restarts. A deployment requires no
volume migration, and rolling back to an earlier compatible image does not
alter application data.

Version `1.0.0` permits automatic rollback between images that preserve this
contract. A release that changes the port, endpoint, required configuration,
or persistence model must increment the contract version and be reviewed before
promotion.
