# Multi-stage build for a single deployable API image.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json ./server/
RUN npm ci --workspace server --include-workspace-root
COPY server ./server
RUN npm --workspace server run prisma:generate \
  && npm --workspace server run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY server/package.json ./server/
RUN npm ci --workspace server --omit=dev --include-workspace-root
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY server/prisma ./server/prisma
EXPOSE 4000
CMD ["node", "server/dist/server.js"]
