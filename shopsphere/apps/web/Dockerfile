# Reference image built by CI (docker build, not pushed) and, in production,
# uploaded to S3 behind CloudFront instead of run as a container - see
# infra/terraform/web-hosting.tf. Kept as a container image here too so the
# same artifact can be smoke-tested via docker-compose.yml.
#
# Build context is the shopsphere/ workspace root, not apps/web: the only
# package-lock.json and the shared tsconfig.base.json live there.
#   docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
# Every workspace manifest is needed for `npm ci` to accept the shared lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tests/package.json tests/
RUN npm ci --workspace apps/web
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
