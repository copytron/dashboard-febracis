# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala bun (usado como package manager)
RUN npm install -g bun

# Copia manifests e instala dependências
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

# Copia o restante do código
COPY . .

# Build de produção (requer Node.js 20+ por causa do Vite 7)
RUN bun run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instala bun no runtime para rodar migrations
RUN npm install -g bun

# Copia o output do build e os arquivos necessários para migrations
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db ./src/db

EXPOSE 3000

# Roda migrations e depois sobe o servidor
CMD bun run db:migrate && node .output/server/index.mjs
