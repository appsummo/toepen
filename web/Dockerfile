# Build stage: produce the static SPA bundle.
FROM node:20-alpine AS build
WORKDIR /app
# Lockfile + `npm ci` keeps the bundle reproducible across rebuilds.
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# Runtime stage: nginx serves the bundle and proxies /api and /ws to the server.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
