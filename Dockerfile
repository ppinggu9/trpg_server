# syntax=docker/dockerfile:1.4
ARG NODE_VERSION=22.16.0
ARG PNPM_VERSION=10.12.4

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM base AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

RUN apt-get update && apt-get install -y \
    postgresql-client \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

USER node

ENV PORT=3000
EXPOSE ${PORT} 


CMD ["node", "dist/main"]