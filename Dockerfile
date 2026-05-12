# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ─── Stage 2: Deps de produção ────────────────────────────────────────────────
FROM node:20-alpine AS prod-deps

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile --production && bun add -D drizzle-kit

# ─── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /usr/local/lib/node_modules/bun /usr/local/lib/node_modules/bun
COPY --from=prod-deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /app/dist ./dist
COPY package.json drizzle.config.ts ./
COPY src/db ./src/db
COPY scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "bun run db:migrate && node scripts/start-server.mjs"]
