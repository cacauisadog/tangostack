# Tangostack frontend

TanStack Start (React 19) with TanStack Router and Query, shadcn/ui on Base UI,
Tailwind 4, and an Orval-generated API client.

Run everything from the repository root with `make` (see `make help`). The
project rules, API workflow, mocks, local HTTPS dev stack and testing are all
documented in [`AGENTS.md`](../AGENTS.md).

```bash
make fe-install    # install dependencies
make fe-dev        # dev server with mocked API (MSW)
make fe-dev-api    # dev server against the real backend
make fe-check      # lint, format check, typecheck, unit tests
make fe-e2e        # Playwright against the real stack (needs `make db-up`)
```

## Layout

| Path              | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `src/routes/`     | File-based routes (TanStack Router; `routeTree.gen.ts` is generated)     |
| `src/components/` | Feature components (`todos/`) and shadcn primitives (`ui/`)              |
| `src/api/`        | `customFetch` and the generated client (`generated/`, never hand-edited) |
| `src/mocks/`      | MSW handlers and in-memory data                                          |
| `e2e/`            | Playwright tests                                                         |

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <component>
make fe-format
```

Check the result afterwards: see "Gotchas" in `AGENTS.md`.
