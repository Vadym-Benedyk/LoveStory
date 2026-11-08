# Multi-stage build for the API image. The build context is the REPO ROOT (npm workspaces):
#
#   docker build -f server/Dockerfile -t lovestory-api .                      # the API (last stage)
#   docker build -f server/Dockerfile --target tools -t lovestory-tools .     # maintenance image
#
# Debian (slim), not Alpine: better-sqlite3 and sharp ship ready-made binaries for glibc on both x86-64
# and arm64. On Alpine (musl) better-sqlite3 has none for arm64, so npm falls back to compiling it
# (needs python/make/g++) and the install fails.
#
# Stages:
#   build    all dependencies (dev tools included), generated Prisma client, compiled TypeScript
#   tools    the build stage as a maintenance image, run against the production data volume, e.g.
#              docker run --rm -v /opt/lovestory/data:/data -e DATABASE_URL=file:/data/lovestory.db \
#                lovestory-tools npm run prisma:push        # create / update the schema
#              ... lovestory-tools npm run prisma:seed       # first run: owner account + default content
#              ... lovestory-tools npm run media:thumbnails  # photos uploaded before the lighter copies
#            `prisma db push` refuses changes that would lose data; do not add --accept-data-loss.
#   runtime  production dependencies + compiled code only (no dev tools, hence no prisma CLI or tsx)
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json ./server/
RUN npm ci --workspace server --include-workspace-root
COPY server ./server
# prisma.config.ts insists on DATABASE_URL even for `prisma generate`, which never opens the database,
# so a placeholder is enough (no .env is copied into the image: see .dockerignore).
RUN DATABASE_URL=file:/tmp/generate-placeholder.db npm --workspace server run prisma:generate \
  && npm --workspace server run build

FROM build AS tools
WORKDIR /app/server

FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY server/package.json ./server/
RUN npm ci --workspace server --omit=dev --include-workspace-root
COPY --from=build /app/server/dist ./server/dist
# The generated Prisma client is in the root node_modules (npm workspaces hoist dependencies).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY server/prisma ./server/prisma
EXPOSE 4000
CMD ["node", "server/dist/server.js"]
