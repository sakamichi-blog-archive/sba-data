# Contributing

## Branches

Use `features/NAME` for feature branches.

## Tests

`.updater` and `.web` each have a `vitest` suite (`pnpm test` in the package, or `pnpm run test` at the root for both). Add tests alongside new or changed non-trivial logic — e.g. date math, data merging, formatting/filtering helpers — rather than for framework glue (Astro pages, React components) or one-off scripts.

`pnpm run check` runs format, lint, and tests, and is required in CI.

## Commits

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/).

### Scopes

| Scope     | Area                                           |
| --------- | ---------------------------------------------- |
| `github`  | GitHub Actions workflows and Dependabot config |
| `updater` | `.updater/` — data fetching project            |
| `web`     | `.web/` — Astro web app                        |
| `data`    | Blog data files (`*-blogs/`)                   |

### Examples

```
feat(updater): add sakura blog fetcher
fix(data): correct 2024 nogi post counts
chore(github): add daily update workflow
```
