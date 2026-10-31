# syntax=docker/dockerfile:1
#   docker build -t gaw-web .
#   docker build --secret id=action_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
#     --build-arg GAW_DEPLOYMENT_ID=$(git rev-parse --short HEAD) -t gaw-web .
# One image for every environment: configuration is read at start (ADR-0006), never baked
# in (there are no NEXT_PUBLIC_ variables). All instances of a release share the action
# key and the deployment id, so Server Actions survive across them and across deploys.

FROM node:26-trixie-slim AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tools/api-codegen/package.json tools/api-codegen/
RUN pnpm install --frozen-lockfile
COPY . .
ARG GAW_DEPLOYMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1 GAW_DEPLOYMENT_ID=${GAW_DEPLOYMENT_ID}
RUN --mount=type=secret,id=action_key,required=false \
    if [ -f /run/secrets/action_key ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/action_key)"; fi \
 && pnpm exec next build

# Distroless: no shell, no package manager, non-root (uid 65532).
FROM gcr.io/distroless/nodejs26-debian13:nonroot
WORKDIR /app
COPY --from=build /repo/.next/standalone ./
COPY --from=build /repo/.next/static ./.next/static
COPY --from=build /repo/public ./public
# TLS ends at the reverse proxy, which sets Host and X-Forwarded-* and does not buffer
# streaming responses. Required at start: APP_ORIGIN, API_BASE_URL, OIDC_ISSUER,
# OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SESSION_KEYS (see .env.example).
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# Probe: HTTP GET /healthz (liveness only).
CMD ["server.js"]
