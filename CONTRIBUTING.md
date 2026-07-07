# Contributing

## Branches

Use `features/NAME` for feature branches.

## Commits

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/).

### Scopes

| Scope | Area |
|---|---|
| `github` | GitHub Actions workflows and Dependabot config |
| `updater` | `.updater/` — data fetching project |
| `web` | `.web/` — Astro web app |
| `data` | Blog data files (`*-blogs/`) |

### Examples

```
feat(updater): add sakura blog fetcher
fix(data): correct 2024 nogi post counts
chore(github): add daily update workflow
```
