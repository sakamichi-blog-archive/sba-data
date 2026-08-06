# @sakamichi-blog-archive/web

Astro + React web app that renders GitHub-style contribution heatmaps of each
group's blog posting activity. Reads directly from the `data/*/blogs/` data
directories at the repo root at build time — no runtime data fetching.

All commands below are run from this directory (`.web/`).

## Development

```sh
pnpm install
pnpm dev
```

Visit http://localhost:6728.

## Preview

Builds the static site and serves it locally through the same Workers
runtime (workerd) used in production, rather than Astro's own preview
server:

```sh
pnpm run build
pnpm run preview
```

Visit http://localhost:6728.

## Deploying

`pnpm run build` writes a fully static site to `dist/`, served as Cloudflare
Workers static assets (no server runtime required):

```sh
pnpm run build
pnpm run deploy
```

Deploys to `contributions.sakamichi.co`. In CI, the `Deploy web` workflow does
this automatically on pushes to `main` that touch `.web/` or `data/`.
