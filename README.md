# sba-data

Blog post data for the Sakamichi Series (Nogizaka46, Keyakizaka46, Sakurazaka46, Hinatazaka46), with a companion web app that visualizes posting activity as GitHub-style contribution heatmaps.

Successor to [sba-contributions](https://github.com/sakamichi-blog-archive/sba-contributions).

## Repository structure

```
data/hinata/blogs/   Hinatazaka46 blog data
data/keyaki/blogs/   Keyakizaka46 blog data
data/nogi/blogs/     Nogizaka46 blog data
data/sakura/blogs/   Sakurazaka46 blog data
.updater/            Node.js project for fetching and updating blog data
.web/                Astro web app + Cloudflare Workers config
```

## Data pipeline

A GitHub Actions workflow runs daily, fetches blog post data from each group's official blog, and commits updated files to the group directories above.

## Web app

The Astro site lives in `.web/` and is deployed to Cloudflare Workers. It reads the data files at build time to render the contribution heatmaps.

```sh
cd .web
pnpm install
pnpm dev
```
