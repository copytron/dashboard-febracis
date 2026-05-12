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

RUN npm install -g bun

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json drizzle.config.ts ./
COPY src/db ./src/db
COPY scripts ./scripts

EXPOSE 3000

# Retry migrations até o Postgres estar pronto (necessário em Swarm sem depends_on)
CMD ["sh", "-c", "until bun run db:migrate; do echo '[startup] aguardando postgres...'; sleep 3; done && node scripts/start-server.mjs"]
