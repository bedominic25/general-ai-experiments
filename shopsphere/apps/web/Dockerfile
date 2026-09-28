# Reference image built by CI (docker build, not pushed) and, in production,
# uploaded to S3 behind CloudFront instead of run as a container - see
# infra/terraform/web-hosting.tf. Kept as a container image here too so the
# same artifact can be smoke-tested via docker-compose.yml.
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
