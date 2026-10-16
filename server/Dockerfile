# Build stage: compile TypeScript with dev dependencies available.
FROM node:20-alpine AS build
WORKDIR /app
# Copy the lockfile too and use `npm ci` so the image is built from exactly the
# versions that were tested, not whatever `npm install` resolves today.
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies and compiled output only.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Run as the unprivileged user the node image already provides.
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
