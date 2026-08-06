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

Builds the static site and serves it locally the same way it'll be served in
production:

```sh
pnpm run build
pnpm run preview
```

Visit http://localhost:6728 (if that port's already in use, astro picks the
next free one and prints the actual URL to use instead).

## Deploying

`pnpm run build` writes a fully static site to `dist/`, served as Cloudflare
Workers static assets (no server runtime required):

```sh
pnpm run build
pnpm run deploy
```

Deploys to `contributions.sakamichi.co`. In CI, the `Deploy web` workflow does
this automatically on pushes to `main` that touch `.web/` or `data/`.
