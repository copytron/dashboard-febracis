# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instala bun no runtime para rodar migrations
RUN npm install -g bun

# Copia node_modules do builder (mesmas versões exatas usadas no build)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json drizzle.config.ts ./
COPY src/db ./src/db
COPY scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "bun run db:migrate && node scripts/start-server.mjs"]
