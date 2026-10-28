# syntax=docker/dockerfile:1

# Targets:  prod (default) - the Nitro server bundle on bare node, nothing else
#           dev            - vite dev server; the source is bind-mounted over /app
# (Keep PNPM_VERSION in sync with `packageManager` in package.json.)

ARG NODE_VERSION=26
ARG PNPM_VERSION=12.14.0

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV npm_config_store_dir=/pnpm/store
RUN npm install --global pnpm@${PNPM_VERSION} && mkdir /app && chown node /app
WORKDIR /app

FROM base AS deps
COPY --chown=node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm 12 links the packages' agent skills and fails without a directory to put them in.
RUN --mount=type=cache,target=/pnpm/store \
  mkdir -p .claude/skills && \
  pnpm install --frozen-lockfile && chown -R node node_modules .claude


FROM deps AS dev
USER 1000
COPY --chown=node . .
EXPOSE 3000
# node_modules is a volume (see docker-compose.yaml): re-sync it when the lockfile changed.
CMD ["sh", "-c", "pnpm install --frozen-lockfile && exec pnpm dev --host 0.0.0.0"]


FROM deps AS build
# VITE_* values are compiled into the client bundle, so they are build arguments.
ARG VITE_API_URL
ARG VITE_APP_TITLE
COPY . .
RUN pnpm build


# Plain alpine + the node binary and the C++ runtime it was built against:
# leaves out npm, yarn and corepack (~30MB).
FROM alpine:3 AS prod
COPY --from=base /usr/lib/libstdc++.so.6.0.34 /usr/lib/libgcc_s.so.1 /usr/lib/
RUN adduser -D -u 1000 node && ln -s libstdc++.so.6.0.34 /usr/lib/libstdc++.so.6
COPY --from=base /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node /app/.output ./.output
USER 1000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
