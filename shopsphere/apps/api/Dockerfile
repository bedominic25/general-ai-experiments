# Reference image built by CI (docker build, not pushed) and by the AWS ECS
# Fargate task defined in infra/terraform/ecs.tf.
#
# Build context is the shopsphere/ workspace root, not apps/api: the only
# package-lock.json and the shared tsconfig.base.json live there.
#   docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
# Prisma's query engine links against OpenSSL, which node:alpine doesn't ship.
RUN apk add --no-cache openssl
WORKDIR /app
# Every workspace manifest is needed for `npm ci` to accept the shared lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tests/package.json tests/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace apps/api
COPY apps/api apps/api
RUN npm run prisma:generate -w apps/api && npm run build -w apps/api

FROM node:20-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# Workspace installs hoist dependencies to /app/node_modules, which Node
# resolves by walking up from apps/api.
COPY --from=build /app /app
WORKDIR /app/apps/api

EXPOSE 4000
CMD ["node", "dist/server.js"]
