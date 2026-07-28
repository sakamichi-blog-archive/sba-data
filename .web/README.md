# @sakamichi-blog-archive/web

Astro + React web app that renders GitHub-style contribution heatmaps of each
group's blog posting activity. Reads directly from the `*-blogs/` data
directories at the repo root at build time — no runtime data fetching.

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

`pnpm run build` writes a fully static site to `dist/` — deploy that directory
as-is, no server runtime required.
