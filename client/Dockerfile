# syntax=docker/dockerfile:1
# The web server image: Caddy with the built client in it. The build context is the REPO ROOT (npm
# workspaces), like server/Dockerfile:
#
#   docker build -f client/Dockerfile -t lovestory-web .
#
# The client calls the API at /api (VITE_API_BASE's default), i.e. on the same domain, so nothing about
# the server is baked in. deploy/docker-compose.yml mounts the Caddyfile and the `site` volume.
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
RUN npm ci --workspace client --include-workspace-root
COPY client ./client
RUN npm --workspace client run build

FROM caddy:2
COPY --from=build /app/client/dist /opt/site

# Caddy serves /srv/site, a volume that outlives the container. On start the new build is copied over it
# without deleting the old hashed files in assets/: a visitor whose page was loaded before the release
# still gets the chunks it asks for later (the photo viewer, the admin). Old ones go after two weeks (cp
# gives every file of the current build a fresh date, so only files no build has had since then go).
COPY --chmod=755 <<'EOF' /usr/local/bin/start-web
#!/bin/sh
set -eu
mkdir -p /srv/site/assets
cp -R /opt/site/assets/. /srv/site/assets/
find /srv/site/assets -type f -mtime +14 -delete
for f in /opt/site/*; do
  [ "$(basename "$f")" = assets ] || cp -R "$f" /srv/site/
done
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
EOF
CMD ["start-web"]
