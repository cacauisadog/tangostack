# Starting a project from this template

For you or an agent ("rename tangostack to my-own-product and set it up"). Do the
steps in order; step 1 is tested end to end (backend and frontend checks pass after it).
Delete this file when you are done (last step).

## 1. Rename the project

The name `tangostack` appears in 4 shapes. Pick the new name and derive the rest:

| Variable | Example            | Used for                                                   |
| -------- | ------------------ | ---------------------------------------------------------- |
| `N`      | `my-own-product`   | lowercase, hyphens allowed: images, Kamal services, containers, volumes, buckets |
| `S`      | `my_own_product`   | `N` with `-` as `_`: the Python package, Postgres database/user, `~/.config/<S>/`, TS keys |
| `T`      | `My Own Product`   | display name: UI, emails, API title, docs                  |
| `D`      | `dev.my-product.com` | the local HTTPS dev domain (replaces `dev.tangostack.com`) |

If the name has no hyphen, `N` and `S` are the same. A hyphen in `S` would break Python
and Postgres, which is why the two exist.

From the repository root (clean working tree):

```bash
export N=my-own-product S=my_own_product T="My Own Product" D=dev.my-product.com

# text files that mention it, except what is regenerated below and this file
grep -rIl -i tangostack . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv \
  --exclude-dir=generated --exclude=uv.lock --exclude=pnpm-lock.yaml --exclude=openapi.json \
  --exclude=TEMPLATE.md | grep -v '^./openapi/' > /tmp/rename-files.txt

# order matters: the longer patterns first
xargs perl -pi -e '
  s/dev\.tangostack\.com/$ENV{D}/g;                # the dev domain
  s/Tangostack/$ENV{T}/g;                          # display name
  s{s3://tangostack/}{s3://$ENV{N}/}g;             # bucket names cannot have "_"
  s/tangostack(?=-|__)/$ENV{N}/g;                  # tangostack-backend, tangostack__postgres, ...
  s/^(GHCR = .*\/)tangostack$/$1$ENV{N}/;          # Makefile image prefix
  s/tangostack/$ENV{S}/g;                          # the rest: Python, Postgres, ~/.config
' < /tmp/rename-files.txt

git mv backend/tangostack "backend/$S"             # the Django project package

(cd backend && uv lock)                            # the project name is in uv.lock
make api-generate                                  # openapi/ and frontend/src/api/generated/
make format fe-format                              # a longer name rewraps some lines
```

Check (all must be clean):

```bash
git grep -i tangostack -- ':!TEMPLATE.md'     # prints nothing
make lint test fe-check                       # then, with `make db-up`: make fe-e2e
```

Then, the text the recipe cannot decide for you:

- `frontend/src/components/LandingPage.tsx`: the landing page copy describes the template.
- `README.md`, `backend/README.md`: the intro text.

## 2. A repository without the template's history

Create a new GitHub repository (or use "Use this template" if the template repository
is published as one) and make it `origin`: the image registry owner (`ghcr.io/<owner>/`)
comes from the `origin` remote, so nothing in the repository names the account.

## 3. Local development

`README.md`, "Getting started". Things that change with the rename: `/etc/hosts` needs
`127.0.0.1 <D>`, then `make proxy-up` and `make proxy-trust` again (a new certificate
for the new domain); `backend/.env` (git-ignored, copy of `.env.example`) must list
`<D>` in `ALLOWED_HOSTS` and `https://<D>` in `CSRF_TRUSTED_ORIGINS`.

## 4. Servers (staging and production)

Outside the repository, once. Details for each: `AGENTS.md`, "Deployment".

1. **VPS** with SSH access, then `deploy/bootstrap-server.sh`.
2. **Cloudflare:** the domain, A records for `staging.<domain>`, `<domain>` and
   `grafana.<domain>` (proxied), SSL mode Full (strict), an Origin CA certificate
   (wildcard) saved as files, Web Analytics auto-injection off (the CSP blocks it).
3. **Env files** `~/.config/<S>/staging.env`, `production.env`, `observability.env`
   (never in the repository): `DEPLOY_HOST`, `APP_HOST`, `SECRET_KEY`,
   `POSTGRES_PASSWORD`, `DATABASE_URL`, `VALKEY_PASSWORD`, `EMAIL_PASSWORD`,
   `DEFAULT_FROM_EMAIL`, `TLS_CERT`/`TLS_KEY`, `SSH_KEY_FILE`, `GOOGLE_CLIENT_ID`/
   `GOOGLE_CLIENT_SECRET`; `GRAFANA_HOST` and `GF_SECURITY_ADMIN_PASSWORD` for
   observability. `.kamal/secrets*` lists the names each one needs.
4. **GitHub:** push to `main` (CI builds and pushes the images), `gh auth login` on the
   laptop. Packages are private by default; the registry login is worked out by
   `deploy/defaults.sh`.
5. **Email:** a sender domain verified at the provider (Resend), `EMAIL_PASSWORD` and
   `DEFAULT_FROM_EMAIL` in the env files.
6. **Google login (optional):** an OAuth client with the redirect URIs
   `https://<D>/accounts/google/login/callback/` and
   `https://<staging domain>/accounts/google/login/callback/` (a separate client for
   production). Without the credentials the button is hidden.
7. **Backups (optional):** an R2 bucket named `<N>`, `~/.backup.env` on the server and the
   cron lines (`AGENTS.md`, "Backups").
8. **First deploy:** `deploy/deploy.sh staging <full sha> --first`, then
   `make deploy env=staging`; same for production. Observability once:
   `make obs-deploy first=1`.

## 5. Delete this file

`git rm TEMPLATE.md`, and remove the line pointing to it at the top of `README.md` and
`AGENTS.md`.
